import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type { SummarySection } from "./types";

const REGION = process.env.AWS_REGION ?? "us-east-1";
// Default to Qwen 3 Next 80B because:
//   - it's an active model with on-demand throughput,
//   - it doesn't require Anthropic's use-case-details form,
//   - quality is good enough for academic paper summarization.
// Swap to "us.anthropic.claude-sonnet-4-5-20250929-v1:0" once the
// AWS account has Anthropic access enabled.
const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? "qwen.qwen3-next-80b-a3b";
const EMBED_MODEL_ID = process.env.BEDROCK_EMBED_MODEL_ID ?? "amazon.titan-embed-text-v2:0";

const bedrock = new BedrockRuntimeClient({ region: REGION });

// ─── Prompts ────────────────────────────────────────────────────────

const MAP_SYSTEM_PROMPT = `You are an expert academic research assistant. Given an excerpt from an academic paper, extract:
- The objectives or research questions discussed in this excerpt
- The methodology described
- Any results or findings reported
- Any limitations or caveats mentioned
- Any contributions claimed

Reply ONLY with valid JSON in this exact shape (no prose, no markdown fences):
{
  "objectives": ["..."],
  "methodology": ["..."],
  "results": ["..."],
  "limitations": ["..."],
  "contributions": ["..."]
}

Each bullet must be one concise sentence. Use empty arrays for sections this excerpt doesn't cover.`;

const REDUCE_SYSTEM_PROMPT = `You are an expert academic research assistant. You will receive a JSON array of partial summaries — one per chunk of a single research paper. Combine them into ONE coherent paper-level summary.

Reply ONLY with valid JSON in this exact shape (no prose, no markdown fences):
{
  "objectives": ["..."],
  "methodology": ["..."],
  "results": ["..."],
  "limitations": ["..."],
  "contributions": ["..."],
  "keywords": ["..."]
}

Rules:
- Deduplicate near-identical bullets across chunks.
- Keep at most 5 bullets per section, each one sentence.
- "keywords" is a list of 3-7 single- or two-word topical keywords.`;

export type ChunkSummary = {
  objectives: string[];
  methodology: string[];
  results: string[];
  limitations: string[];
  contributions: string[];
};

export type FinalSummary = ChunkSummary & { keywords: string[] };

// ─── Public API ─────────────────────────────────────────────────────

export async function summarizeChunk(text: string): Promise<ChunkSummary> {
  const raw = await invokeModel({
    system: MAP_SYSTEM_PROMPT,
    user: `Excerpt:\n\n${text}`,
    maxTokens: 1500,
  });
  return parseJson<ChunkSummary>(raw);
}

export async function reduceSummaries(chunks: ChunkSummary[]): Promise<FinalSummary> {
  const raw = await invokeModel({
    system: REDUCE_SYSTEM_PROMPT,
    user: `Partial summaries (one per chunk):\n\n${JSON.stringify(chunks, null, 2)}`,
    maxTokens: 1500,
  });
  return parseJson<FinalSummary>(raw);
}

export function toSummarySections(s: FinalSummary): SummarySection[] {
  const sections: SummarySection[] = [];
  if (s.objectives?.length) sections.push({ heading: "Objectives", bullets: s.objectives });
  if (s.methodology?.length) sections.push({ heading: "Methodology", bullets: s.methodology });
  if (s.results?.length) sections.push({ heading: "Results", bullets: s.results });
  if (s.limitations?.length) sections.push({ heading: "Limitations", bullets: s.limitations });
  if (s.contributions?.length) sections.push({ heading: "Contributions", bullets: s.contributions });
  return sections;
}

// ─── Internals ──────────────────────────────────────────────────────

async function invokeModel(args: {
  system: string;
  user: string;
  maxTokens: number;
}): Promise<string> {
  const isAnthropic = MODEL_ID.includes("anthropic") || MODEL_ID.includes("claude");

  const body = isAnthropic
    ? {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: args.maxTokens,
        system: args.system,
        messages: [{ role: "user", content: args.user }],
      }
    : {
        // OpenAI-compatible chat completions format used by Qwen, DeepSeek, gpt-oss, etc.
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.user },
        ],
        max_completion_tokens: args.maxTokens,
      };

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await bedrock.send(new InvokeModelCommand({
        modelId: MODEL_ID,
        body: Buffer.from(JSON.stringify(body)),
        contentType: "application/json",
      }));
      const decoded = JSON.parse(new TextDecoder().decode(res.body));
      const text = isAnthropic
        ? decoded?.content?.[0]?.text
        : decoded?.choices?.[0]?.message?.content;
      if (typeof text !== "string") {
        throw new Error("unexpected model response shape");
      }
      return text;
    } catch (err) {
      lastErr = err;
      const name = (err as { name?: string }).name ?? "";
      const transient = ["ThrottlingException", "ServiceUnavailableException", "ModelTimeoutException"].includes(name);
      if (!transient || attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
  throw lastErr;
}

// ─── Embeddings ─────────────────────────────────────────────────────

/** Generate a dense vector embedding for the given text using Titan v2. */
export async function embedText(text: string): Promise<number[]> {
  const body = {
    inputText: text.slice(0, 50_000), // Titan accepts up to ~50K characters
    dimensions: 1024,
    normalize: true,
  };

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await bedrock.send(new InvokeModelCommand({
        modelId: EMBED_MODEL_ID,
        body: Buffer.from(JSON.stringify(body)),
        contentType: "application/json",
      }));
      const decoded = JSON.parse(new TextDecoder().decode(res.body));
      const vec = decoded?.embedding;
      if (!Array.isArray(vec)) throw new Error("unexpected embed response shape");
      return vec as number[];
    } catch (err) {
      lastErr = err;
      const name = (err as { name?: string }).name ?? "";
      const transient = ["ThrottlingException", "ServiceUnavailableException", "ModelTimeoutException"].includes(name);
      if (!transient || attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
  throw lastErr;
}

/** Cosine similarity between two equally-sized vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // vectors are pre-normalized by Titan, so dot product == cosine
}

/** Free-form chat completion (used by /chat endpoint). */
export async function chat(args: {
  system: string;
  user: string;
  maxTokens: number;
}): Promise<string> {
  return invokeModel(args);
}

// ─── Knowledge graph extraction ─────────────────────────────────────

import type { KnowledgeGraph } from "./types";

const GRAPH_SYSTEM_PROMPT = `You are an expert at building knowledge graphs from academic papers. Given a structured paper summary, extract entities and relationships.

Reply ONLY with valid JSON in this exact shape (no prose, no markdown fences):
{
  "nodes": [
    {"id": "snake_case_id", "label": "Display Label", "type": "method|dataset|metric|task|concept|result", "summary": "one concise sentence"}
  ],
  "edges": [
    {"source": "node_id_1", "target": "node_id_2", "label": "short verb phrase", "type": "uses|achieves|extends|evaluated_on|introduces|cites|compares_with"}
  ]
}

Hard rules:
- 8 to 22 nodes. Pick the MOST important ones; do not pad with vague concepts.
- 8 to 35 edges. Every edge's source and target MUST be a node id from the nodes array.
- Node ids in lowercase snake_case (e.g., "self_attention", "wmt_2014").
- Node "type" picks one of: method (algorithms, architectures, models), dataset, metric (e.g., BLEU, F1), task (e.g., translation), concept (theoretical idea), result (specific finding/number).
- Edge "type" picks one of: uses, achieves, extends, evaluated_on, introduces, cites, compares_with.
- Edge "label" is a short verb phrase (max 4 words).
- "summary" on each node is ONE sentence.
- No duplicate node ids. No self-loops.`;

export async function extractKnowledgeGraph(args: {
  paperTitle: string;
  paperAuthors: string[];
  abstract: string;
  sections: SummarySection[];
  keywords: string[];
}): Promise<KnowledgeGraph> {
  const userMessage = [
    `Paper: ${args.paperTitle}`,
    `Authors: ${args.paperAuthors.slice(0, 5).join(", ")}`,
    "",
    `Abstract: ${args.abstract}`,
    "",
    "Structured summary:",
    ...args.sections.map((s) => `\n## ${s.heading}\n` + s.bullets.map((b) => `- ${b}`).join("\n")),
    "",
    `Keywords: ${(args.keywords ?? []).join(", ")}`,
  ].join("\n");

  const raw = await invokeModel({
    system: GRAPH_SYSTEM_PROMPT,
    user: userMessage,
    maxTokens: 3000,
  });
  const parsed = parseJson<KnowledgeGraph>(raw);
  return sanitizeGraph(parsed);
}

/** Drop dangling edges, dedupe, clamp counts so the UI doesn't drown. */
function sanitizeGraph(g: KnowledgeGraph): KnowledgeGraph {
  const seenIds = new Set<string>();
  const nodes = g.nodes
    .filter((n) => {
      if (!n.id || !n.label) return false;
      if (seenIds.has(n.id)) return false;
      seenIds.add(n.id);
      return true;
    })
    .slice(0, 25);

  const validIds = new Set(nodes.map((n) => n.id));
  const edges = g.edges
    .filter((e) => e.source !== e.target && validIds.has(e.source) && validIds.has(e.target))
    .slice(0, 40);

  return { nodes, edges };
}

function parseJson<T>(raw: string): T {
  // Models occasionally wrap output in ```json fences or add stray text.
  let cleaned = raw.trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/```\s*$/, "");
  // If there's leading prose followed by JSON, take the JSON block.
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace > 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned) as T;
}
