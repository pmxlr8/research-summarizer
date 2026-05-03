import { reduceSummaries, toSummarySections, type ChunkSummary } from "../../lib/bedrock";
import { completeJob, updateJobStatus } from "../../lib/ddb";
import { log } from "../../lib/http";

/**
 * Step 5 of the pipeline (final state).
 *
 * Receives the array of partial chunk summaries (output of the Map state)
 * plus the original payload context. Merges them into one paper-level
 * summary via Bedrock and writes the final result to DynamoDB.
 */
export async function handler(event: {
  jobId: string;
  userId: string;
  startedAt: string;
  chunkSummaries: ChunkSummary[];
}): Promise<void> {
  log("reduce_start", {
    jobId: event.jobId,
    chunks: event.chunkSummaries.length,
  });

  if (!event.chunkSummaries || event.chunkSummaries.length === 0) {
    await updateJobStatus({
      userId: event.userId,
      jobId: event.jobId,
      status: "failed",
      error: "no chunk summaries to reduce",
    });
    throw new Error("no chunk summaries");
  }

  let final;
  try {
    final = await reduceSummaries(event.chunkSummaries);
  } catch (err) {
    const message = (err as Error).message;
    log("reduce_failed", { jobId: event.jobId, message });
    await updateJobStatus({
      userId: event.userId,
      jobId: event.jobId,
      status: "failed",
      error: `reduce_failed: ${message}`,
    });
    throw err;
  }

  await completeJob({
    userId: event.userId,
    jobId: event.jobId,
    sections: toSummarySections(final),
    keywords: final.keywords ?? [],
    startedAt: event.startedAt,
  });

  log("reduce_done", { jobId: event.jobId });
}
