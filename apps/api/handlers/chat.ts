import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ok, clientError, serverError, log } from "../lib/http";
import {
  getChunkEmbeddings,
  putChunkEmbedding,
  getJob,
  type ChunkRecord,
} from "../lib/ddb";
import { embedText, cosineSimilarity, chat } from "../lib/bedrock";
import { getText, listChunkKeys } from "../lib/s3";

const TOP_K = 3;

const SYSTEM_PROMPT = `You are an expert academic research assistant. The user is asking a question about a specific research paper. You will be given the most relevant excerpts from that paper. Use ONLY those excerpts to answer.

Rules:
- If the excerpts don't contain enough information to answer, say so directly. Don't speculate.
- Cite excerpts inline using [1], [2], etc. matching the order they appear below.
- Keep answers concise — 2-4 sentences unless the question requires more.
- Reply with a single answer — no preamble, no markdown headers.`;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext?.requestId ?? "unknown";
  const claims = (event.requestContext as { authorizer?: { claims?: { sub?: string } } })?.authorizer?.claims;
  const userId = claims?.sub;
  if (!userId) return clientError(401, "unauthorized", "missing user identity");

  let body: { jobId?: string; question?: string };
  try { body = JSON.parse(event.body ?? "{}"); }
  catch { return clientError(400, "invalid_body", "request body is not valid JSON"); }

  const { jobId, question } = body;
  if (!jobId) return clientError(400, "invalid_input", "jobId is required");
  if (!question || question.trim().length < 3) {
    return clientError(400, "invalid_input", "question is required (min 3 characters)");
  }
  if (question.length > 1000) {
    return clientError(400, "invalid_input", "question must be <= 1000 characters");
  }

  // 1. Verify the user owns the job
  const job = await getJob(userId, jobId);
  if (!job) return clientError(404, "not_found", `summary ${jobId} not found`);
  if (job.status !== "done") {
    return clientError(409, "job_not_ready", `summary is still ${job.status}`);
  }

  // Deduped jobs reuse the chunks of their source job (no point re-embedding
  // the same paper for every user that summarizes it).
  const chunkOwner = job.sourceJobId ?? jobId;

  try {
    // 2. Pull (or backfill) chunk embeddings for this job
    let chunks = await getChunkEmbeddings(chunkOwner);
    if (chunks.length === 0) {
      log("chat_backfill_start", { requestId, jobId, chunkOwner });
      chunks = await backfillEmbeddings(chunkOwner);
      log("chat_backfill_done", { requestId, jobId, chunkOwner, count: chunks.length });
      if (chunks.length === 0) {
        return serverError(500, "no_chunks", "no chunks available for this paper");
      }
    }

    // 3. Embed the question and rank chunks by cosine similarity
    const qEmbed = await embedText(question);
    const ranked = chunks
      .map((c) => ({ chunk: c, score: cosineSimilarity(qEmbed, c.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_K);

    // 4. Build the prompt and ask the LLM
    const userMessage = [
      `Question: ${question}`,
      "",
      "Excerpts (most relevant first):",
      ...ranked.map(
        (r, i) => `\n[${i + 1}] (chunk ${r.chunk.index + 1}, similarity ${r.score.toFixed(3)}):\n${r.chunk.text}`,
      ),
    ].join("\n");

    const answer = await chat({
      system: SYSTEM_PROMPT,
      user: userMessage,
      maxTokens: 600,
    });

    log("chat_success", { requestId, jobId, topScore: ranked[0]?.score });
    return ok({
      answer: answer.trim(),
      citations: ranked.map((r, i) => ({
        index: i + 1,
        chunkIndex: r.chunk.index,
        snippet: r.chunk.text.slice(0, 240) + (r.chunk.text.length > 240 ? "…" : ""),
        score: Number(r.score.toFixed(3)),
      })),
    }, { "Cache-Control": "no-store" });
  } catch (err) {
    log("chat_failed", { requestId, jobId, message: (err as Error).message });
    return serverError(500, "internal_error", "could not answer the question");
  }
}

/**
 * Backfill: re-embed chunks from S3 for an old summary that didn't get
 * embeddings written at pipeline time.
 */
async function backfillEmbeddings(jobId: string): Promise<ChunkRecord[]> {
  const chunkKeys = await listChunkKeys(jobId);
  if (chunkKeys.length === 0) return [];

  const records: ChunkRecord[] = [];
  for (const key of chunkKeys) {
    const text = await getText(key);
    const embedding = await embedText(text);
    const match = key.match(/chunks\/[^/]+\/(\d+)\.txt$/);
    const index = match ? Number(match[1]) : records.length;
    await putChunkEmbedding({ jobId, index, text, embedding });
    records.push({ jobId, index, text, embedding });
  }
  return records.sort((a, b) => a.index - b.index);
}
