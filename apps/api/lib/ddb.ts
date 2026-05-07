import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { SummaryJob, JobStatus, SummarySection, Paper } from "./types";

const TABLE_NAME = process.env.TABLE_NAME!;
const REGION = process.env.AWS_REGION ?? "us-east-1";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } },
);

// ─── Key helpers (single-table design) ──────────────────────────────
//
//   PK = USER#{userId}
//   SK = JOB#{jobId}            — the job/summary record itself
//   GSI1PK = PAPER#{paperId}    — to dedup across users (Phase 2+ optimization)

const userPk = (userId: string) => `USER#${userId}`;
const jobSk = (jobId: string) => `JOB#${jobId}`;
const paperGsiPk = (paperId: string) => `PAPER#${paperId}`;

// ─── Item shape stored in DynamoDB ──────────────────────────────────

type JobItem = {
  PK: string;
  SK: string;
  GSI1PK?: string;
  GSI1SK?: string;
  jobId: string;
  userId: string;
  paperId: string;
  paper: Paper;
  status: JobStatus;
  createdAt: string;
  completedAt?: string;
  durationSeconds?: number;
  sections?: SummarySection[];
  keywords?: string[];
  error?: string;
  sourceJobId?: string;
  paperEmbedding?: number[];
};

function itemToJob(item: JobItem): SummaryJob {
  return {
    id: item.jobId,
    paperId: item.paperId,
    paper: item.paper,
    status: item.status,
    createdAt: item.createdAt,
    completedAt: item.completedAt,
    durationSeconds: item.durationSeconds,
    sections: item.sections,
    keywords: item.keywords,
    error: item.error,
    sourceJobId: item.sourceJobId,
    paperEmbedding: item.paperEmbedding,
  };
}

/** Persist a paper-level mean embedding on the JOB record. */
export async function setPaperEmbedding(args: {
  userId: string;
  jobId: string;
  embedding: number[];
}): Promise<void> {
  await ddb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK: userPk(args.userId), SK: jobSk(args.jobId) },
    UpdateExpression: "SET paperEmbedding = :e",
    ExpressionAttributeValues: { ":e": args.embedding },
  }));
}

// ─── Public operations ──────────────────────────────────────────────

export async function createJob(args: {
  jobId: string;
  userId: string;
  paper: Paper;
}): Promise<void> {
  const now = new Date().toISOString();
  const item: JobItem = {
    PK: userPk(args.userId),
    SK: jobSk(args.jobId),
    GSI1PK: paperGsiPk(args.paper.id),
    GSI1SK: `JOB#${args.jobId}`,
    jobId: args.jobId,
    userId: args.userId,
    paperId: args.paper.id,
    paper: args.paper,
    status: "pending",
    createdAt: now,
  };
  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
}

export async function getJob(
  userId: string,
  jobId: string,
): Promise<SummaryJob | null> {
  const res = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: userPk(userId), SK: jobSk(jobId) },
    }),
  );
  return res.Item ? itemToJob(res.Item as JobItem) : null;
}

/**
 * Search the GSI1 (PAPER#{paperId}) index for any DONE summary of this
 * paper across all users. Used by submit-job for content-level dedup —
 * if anyone has already paid for the Bedrock tokens, we copy the result.
 */
export async function findCompletedSummaryForPaper(
  paperId: string,
): Promise<SummaryJob | null> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: {
        ":pk": paperGsiPk(paperId),
        ":done": "done",
      },
      FilterExpression: "#s = :done",
      ExpressionAttributeNames: { "#s": "status" },
      Limit: 1,
    }),
  );
  const item = res.Items?.[0];
  return item ? itemToJob(item as JobItem) : null;
}

/**
 * Create a job record that's already complete by cloning the sections
 * and keywords from a previous summary. Used when dedup finds an existing
 * result — gives the user instant gratification with no Bedrock cost.
 */
export async function createDedupedJob(args: {
  jobId: string;
  userId: string;
  paper: Paper;
  source: SummaryJob;
}): Promise<void> {
  const now = new Date().toISOString();
  const item: JobItem = {
    PK: userPk(args.userId),
    SK: jobSk(args.jobId),
    GSI1PK: paperGsiPk(args.paper.id),
    GSI1SK: `JOB#${args.jobId}`,
    jobId: args.jobId,
    userId: args.userId,
    paperId: args.paper.id,
    paper: args.paper,
    status: "done",
    createdAt: now,
    completedAt: now,
    durationSeconds: 0, // signals "instant" for the UI
    sections: args.source.sections,
    keywords: args.source.keywords,
    sourceJobId: args.source.id,
  };
  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
}

// ─── Chunk embeddings (for RAG / Talk-to-PDF) ──────────────────────
//
// Stored under a separate partition to keep them out of the user's job
// view. Brute-force cosine similarity at query time is fine for ≤30
// chunks per paper.
//
//   PK = JOB#{jobId}
//   SK = CHUNK#{n}     (n is the zero-padded chunk index)
//   text     (string)  — the chunk text, used to build the LLM prompt
//   embedding (list of N) — Titan v2 normalized vector

const chunkPk = (jobId: string) => `JOB#${jobId}`;
const chunkSk = (n: number) => `CHUNK#${String(n).padStart(4, "0")}`;

export type ChunkRecord = {
  jobId: string;
  index: number;
  text: string;
  embedding: number[];
};

export async function putChunkEmbedding(args: {
  jobId: string;
  index: number;
  text: string;
  embedding: number[];
}): Promise<void> {
  await ddb.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: chunkPk(args.jobId),
      SK: chunkSk(args.index),
      jobId: args.jobId,
      chunkIndex: args.index,
      text: args.text,
      embedding: args.embedding,
    },
  }));
}

export async function getChunkEmbeddings(jobId: string): Promise<ChunkRecord[]> {
  const res = await ddb.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": chunkPk(jobId), ":sk": "CHUNK#" },
  }));
  return (res.Items ?? []).map((item) => ({
    jobId: item.jobId as string,
    index: item.chunkIndex as number,
    text: item.text as string,
    embedding: item.embedding as number[],
  }));
}

// ─── Quota ──────────────────────────────────────────────────────────
//
// Stored as the `quota` attribute on a PROFILE# row. Default 10 per user.
// decrementQuota() is conditional — fails when quota is already 0.

const QUOTA_DEFAULT = 10;
const profileSk = "PROFILE#";

export async function getUserQuota(userId: string): Promise<number> {
  const res = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: userPk(userId), SK: profileSk },
      ProjectionExpression: "quota",
    }),
  );
  if (res.Item?.quota !== undefined) return res.Item.quota as number;
  return QUOTA_DEFAULT;
}

export class QuotaExceededError extends Error {
  constructor() {
    super("quota_exceeded");
    this.name = "QuotaExceededError";
  }
}

/**
 * Atomically decrement the user's quota. If the PROFILE row doesn't yet
 * exist, create it at QUOTA_DEFAULT-1. If quota is already 0, throws
 * QuotaExceededError without decrementing.
 */
export async function decrementQuota(userId: string): Promise<number> {
  // First-time path: create profile if missing.
  try {
    await ddb.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: userPk(userId),
        SK: profileSk,
        userId,
        quota: QUOTA_DEFAULT,
        createdAt: new Date().toISOString(),
      },
      ConditionExpression: "attribute_not_exists(PK)",
    }));
  } catch (err) {
    // ConditionalCheckFailedException means the row already exists; that's expected.
    if ((err as { name?: string }).name !== "ConditionalCheckFailedException") throw err;
  }

  try {
    const res = await ddb.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: userPk(userId), SK: profileSk },
      UpdateExpression: "SET quota = quota - :one",
      ConditionExpression: "quota > :zero",
      ExpressionAttributeValues: { ":one": 1, ":zero": 0 },
      ReturnValues: "UPDATED_NEW",
    }));
    return (res.Attributes?.quota as number) ?? 0;
  } catch (err) {
    if ((err as { name?: string }).name === "ConditionalCheckFailedException") {
      throw new QuotaExceededError();
    }
    throw err;
  }
}

/** Refund quota when we did not consume Bedrock (dedup hit). */
export async function refundQuota(userId: string): Promise<void> {
  await ddb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK: userPk(userId), SK: profileSk },
    UpdateExpression: "SET quota = quota + :one",
    ExpressionAttributeValues: { ":one": 1 },
  }));
}

export async function listJobsForUser(userId: string): Promise<SummaryJob[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": userPk(userId),
        ":sk": "JOB#",
      },
      ScanIndexForward: false, // newest first by default (lexicographic SK)
    }),
  );
  return (res.Items ?? []).map((i) => itemToJob(i as JobItem));
}

export async function updateJobStatus(args: {
  userId: string;
  jobId: string;
  status: JobStatus;
  error?: string;
}): Promise<void> {
  const updates: string[] = ["#s = :s"];
  const names: Record<string, string> = { "#s": "status" };
  const values: Record<string, unknown> = { ":s": args.status };
  if (args.error !== undefined) {
    updates.push("#e = :e");
    names["#e"] = "error";
    values[":e"] = args.error;
  }
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: userPk(args.userId), SK: jobSk(args.jobId) },
      UpdateExpression: "SET " + updates.join(", "),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );
}

export async function completeJob(args: {
  userId: string;
  jobId: string;
  sections: SummarySection[];
  keywords?: string[];
  startedAt: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const durationSeconds = Math.round(
    (Date.parse(now) - Date.parse(args.startedAt)) / 1000,
  );
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: userPk(args.userId), SK: jobSk(args.jobId) },
      UpdateExpression:
        "SET #s = :s, #c = :c, #d = :d, #sec = :sec, #k = :k",
      ExpressionAttributeNames: {
        "#s": "status",
        "#c": "completedAt",
        "#d": "durationSeconds",
        "#sec": "sections",
        "#k": "keywords",
      },
      ExpressionAttributeValues: {
        ":s": "done",
        ":c": now,
        ":d": durationSeconds,
        ":sec": args.sections,
        ":k": args.keywords ?? [],
      },
    }),
  );
}
