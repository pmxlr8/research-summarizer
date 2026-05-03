import { getText } from "../../lib/s3";
import { summarizeChunk, type ChunkSummary } from "../../lib/bedrock";
import { log } from "../../lib/http";

/**
 * Step 4 of the pipeline (one Map iteration per chunk).
 *
 * Receives a single chunk key from the Step Functions Map state,
 * loads the chunk from S3, invokes Bedrock, returns the partial summary.
 *
 * The Map state runs these in parallel — one Lambda invocation per chunk.
 */
export async function handler(event: {
  jobId: string;
  chunkKey: string;
}): Promise<ChunkSummary> {
  log("map_summarize_start", { jobId: event.jobId, chunkKey: event.chunkKey });

  const text = await getText(event.chunkKey);
  const summary = await summarizeChunk(text);

  log("map_summarize_done", { jobId: event.jobId, chunkKey: event.chunkKey });
  return summary;
}
