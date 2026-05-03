// pdf-parse imports a debug helper at module load time that touches the
// filesystem; CommonJS-style require keeps esbuild from inlining that branch.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require("pdf-parse") as (data: Buffer) => Promise<{ text: string }>;

import { getBytes, putText, keys } from "../../lib/s3";
import { log } from "../../lib/http";
import type { PipelinePayload } from "../../lib/types";

const MAX_TEXT_CHARS = 250_000; // hard cap; papers beyond this get truncated

/**
 * Step 2 of the pipeline.
 * Reads the PDF from S3, extracts plain text, writes the text back to S3.
 */
export async function handler(event: PipelinePayload): Promise<PipelinePayload> {
  if (!event.pdfKey) throw new Error("missing pdfKey");
  log("extract_text_start", { jobId: event.jobId, pdfKey: event.pdfKey });

  const buffer = await getBytes(event.pdfKey);

  let text: string;
  try {
    const parsed = await pdfParse(buffer);
    text = parsed.text;
  } catch (err) {
    throw new Error(`pdf-parse failed: ${(err as Error).message}`);
  }

  // Normalize whitespace, strip noise.
  const cleaned = text
    .replace(/\f/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const final = cleaned.length > MAX_TEXT_CHARS ? cleaned.slice(0, MAX_TEXT_CHARS) : cleaned;

  if (final.length < 200) {
    throw new Error(`extracted text suspiciously short (${final.length} chars) — likely a scanned/encrypted PDF`);
  }

  const textKey = keys.text(event.jobId);
  await putText(textKey, final);

  log("extract_text_done", { jobId: event.jobId, textKey, chars: final.length });
  return { ...event, textKey };
}
