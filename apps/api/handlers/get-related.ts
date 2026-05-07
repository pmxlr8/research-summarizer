import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ok, clientError, serverError, log } from "../lib/http";
import {
  getJob,
  listJobsForUser,
  getChunkEmbeddings,
  setPaperEmbedding,
} from "../lib/ddb";
import { cosineSimilarity } from "../lib/bedrock";
import type { Paper, SummaryJob } from "../lib/types";

const TOP_K = 3;
const MIN_SCORE = 0.25; // Below this, papers are essentially unrelated.

/**
 * Returns the top-K papers in the user's library most similar to the
 * given summary, ranked by cosine similarity over paper-level mean
 * embeddings. Lazily computes and persists the mean embedding for any
 * job that doesn't have one yet.
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext?.requestId ?? "unknown";
  const claims = (event.requestContext as { authorizer?: { claims?: { sub?: string } } })?.authorizer?.claims;
  const userId = claims?.sub;
  if (!userId) return clientError(401, "unauthorized", "missing user identity");

  const id = event.pathParameters?.id;
  if (!id) return clientError(400, "invalid_id", "missing id");

  try {
    const target = await getJob(userId, id);
    if (!target) return clientError(404, "not_found", `summary ${id} not found`);
    if (target.status !== "done") return ok({ related: [] });

    const targetEmbedding = await ensureEmbedding(target, userId);
    if (!targetEmbedding) return ok({ related: [] });

    const others = (await listJobsForUser(userId)).filter(
      (j) => j.id !== id && j.status === "done",
    );

    const scored: { job: SummaryJob; score: number }[] = [];
    for (const o of others) {
      const e = await ensureEmbedding(o, userId);
      if (!e) continue;
      scored.push({ job: o, score: cosineSimilarity(targetEmbedding, e) });
    }

    const related = scored
      .filter((s) => s.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_K)
      .map(({ job, score }) => ({
        id: job.id,
        paper: trimPaper(job.paper),
        score: Number(score.toFixed(3)),
        keywords: (job.keywords ?? []).slice(0, 5),
      }));

    log("related_success", { requestId, target: id, returned: related.length });
    return ok({ related }, { "Cache-Control": "no-store" });
  } catch (err) {
    log("related_failed", { requestId, message: (err as Error).message });
    return serverError(500, "internal_error", "could not compute related");
  }
}

async function ensureEmbedding(job: SummaryJob, userId: string): Promise<number[] | null> {
  if (job.paperEmbedding && job.paperEmbedding.length > 0) return job.paperEmbedding;

  // For deduped jobs, the chunks live under the source job's partition.
  const chunkOwner = job.sourceJobId ?? job.id;
  const chunks = await getChunkEmbeddings(chunkOwner);
  if (chunks.length === 0) return null;

  const dim = chunks[0].embedding.length;
  const sum = new Array<number>(dim).fill(0);
  for (const c of chunks) {
    for (let i = 0; i < dim; i++) sum[i] += c.embedding[i];
  }
  // Normalize to unit length so dot product == cosine.
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += sum[i] * sum[i];
  norm = Math.sqrt(norm) || 1;
  const avg = sum.map((v) => v / norm);

  await setPaperEmbedding({ userId, jobId: job.id, embedding: avg });
  return avg;
}

function trimPaper(p: Paper): Paper {
  return {
    id: p.id,
    title: p.title,
    authors: p.authors.slice(0, 4),
    abstract: "", // not needed for the cards
    year: p.year,
    venue: p.venue,
    arxivId: p.arxivId,
    doi: p.doi,
    pdfUrl: p.pdfUrl,
  };
}
