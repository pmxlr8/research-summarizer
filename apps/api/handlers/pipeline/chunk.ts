import { getText, putText, keys } from "../../lib/s3";
import { chunkText } from "../../lib/chunk";
import { embedText } from "../../lib/bedrock";
import { putChunkEmbedding } from "../../lib/ddb";
import { log } from "../../lib/http";
import type { PipelinePayload } from "../../lib/types";

/**
 * Step 3 of the pipeline.
 * Reads extracted text from S3, splits it into overlapping chunks,
 * writes each chunk to S3 (so MapSummarize can read them in parallel),
 * and embeds each chunk into DynamoDB so the /chat endpoint can do
 * retrieval-augmented Q&A on the paper.
 */
export async function handler(event: PipelinePayload): Promise<PipelinePayload> {
  if (!event.textKey) throw new Error("missing textKey");
  log("chunk_start", { jobId: event.jobId, textKey: event.textKey });

  const text = await getText(event.textKey);
  const chunks = chunkText(text);

  if (chunks.length === 0) {
    throw new Error("no chunks produced from extracted text");
  }

  const chunkKeys: string[] = [];
  await Promise.all(chunks.map(async (c, i) => {
    const k = keys.chunk(event.jobId, i);
    await putText(k, c);
    chunkKeys[i] = k;

    // Embed each chunk and persist in DynamoDB. Best-effort — if embedding
    // fails we still produce the summary; the /chat endpoint will lazily
    // backfill on first invocation.
    try {
      const embedding = await embedText(c);
      await putChunkEmbedding({
        jobId: event.jobId,
        index: i,
        text: c,
        embedding,
      });
    } catch (err) {
      log("chunk_embed_failed", { jobId: event.jobId, index: i, message: (err as Error).message });
    }
  }));

  log("chunk_done", { jobId: event.jobId, chunks: chunks.length });
  return { ...event, chunkKeys };
}
