/**
 * Text chunking for LLM map-reduce summarization.
 *
 * Strategy: split on paragraph boundaries first, then pack paragraphs into
 * chunks of approximately TARGET_CHARS characters each, with OVERLAP_CHARS
 * carried forward between adjacent chunks for context continuity.
 *
 * Char-based rather than token-based because (a) we don't ship a tokenizer
 * to Lambda and (b) for English academic prose the approximation
 * 1 token ≈ 4 characters is good enough for safety margins.
 */

const TARGET_CHARS = 6_000;   // ~1500 tokens — comfortably below Claude's 200k limit
const OVERLAP_CHARS = 400;
const MAX_CHUNKS = 30;        // safety cap; very long papers get truncated

export function chunkText(text: string): string[] {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (normalized.length === 0) return [];
  if (normalized.length <= TARGET_CHARS) return [normalized];

  const paragraphs = normalized.split(/\n\n+/);
  const chunks: string[] = [];
  let buffer = "";

  for (const p of paragraphs) {
    if (buffer.length === 0) {
      buffer = p;
      continue;
    }
    if (buffer.length + 2 + p.length <= TARGET_CHARS) {
      buffer += "\n\n" + p;
    } else {
      chunks.push(buffer);
      const tail = buffer.slice(-OVERLAP_CHARS);
      buffer = (tail.length > 0 ? tail + "\n\n" : "") + p;
    }
  }
  if (buffer.length > 0) chunks.push(buffer);

  // Pathological case: a single paragraph larger than TARGET_CHARS.
  // Hard-split anything still oversize.
  const expanded: string[] = [];
  for (const c of chunks) {
    if (c.length <= TARGET_CHARS * 1.2) {
      expanded.push(c);
    } else {
      for (let i = 0; i < c.length; i += TARGET_CHARS - OVERLAP_CHARS) {
        expanded.push(c.slice(i, i + TARGET_CHARS));
      }
    }
  }

  return expanded.slice(0, MAX_CHUNKS);
}
