import { getText, putText, keys } from "../../lib/s3";
import { chunkText } from "../../lib/chunk";
import { log } from "../../lib/http";
import type { PipelinePayload } from "../../lib/types";

/**
 * Step 3 of the pipeline.
 * Reads extracted text from S3, splits it into overlapping chunks,
 * writes each chunk to S3, and emits a list of chunk keys for the
 * Map state in Step Functions to fan out over.
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
  }));

  log("chunk_done", { jobId: event.jobId, chunks: chunks.length });
  return { ...event, chunkKeys };
}
