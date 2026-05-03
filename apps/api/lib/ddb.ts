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
  };
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
