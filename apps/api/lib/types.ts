export type Paper = {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  year: number;
  venue?: string;
  arxivId?: string;
  doi?: string;
  pdfUrl?: string;
};

export type SummarySection = {
  heading: string;
  bullets: string[];
};

export type JobStatus = "pending" | "running" | "done" | "failed";

export type SummaryJob = {
  id: string;          // jobId / summaryId — same thing
  paperId: string;
  paper: Paper;
  status: JobStatus;
  createdAt: string;   // ISO
  completedAt?: string;
  durationSeconds?: number;
  sections?: SummarySection[];
  keywords?: string[];
  error?: string;
  // For deduped jobs: the original jobId that ran the pipeline. Used by
  // the chat endpoint to find the source chunks for RAG retrieval.
  sourceJobId?: string;
  // Paper-level mean embedding (avg of chunk vectors). Used for the
  // "related papers" feature; lazily filled if not present.
  paperEmbedding?: number[];
  // Knowledge graph extracted from the structured summary; lazily generated.
  graph?: KnowledgeGraph;
};

// ─── Knowledge graph ────────────────────────────────────────────────

export type GraphNodeType =
  | "method"
  | "dataset"
  | "metric"
  | "task"
  | "concept"
  | "result";

export type GraphEdgeType =
  | "uses"
  | "achieves"
  | "extends"
  | "evaluated_on"
  | "introduces"
  | "cites"
  | "compares_with";

export type GraphNode = {
  id: string;
  label: string;
  type: GraphNodeType;
  summary: string;
};

export type GraphEdge = {
  source: string;
  target: string;
  label: string;
  type: GraphEdgeType;
};

export type KnowledgeGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

// Internal payload threaded through the Step Functions state machine.
// Heavy data (raw text, chunks) is kept in S3; only keys are passed.
export type PipelinePayload = {
  jobId: string;
  userId: string;
  paper: Paper;
  startedAt: string;     // ISO when FetchPDF started
  pdfKey?: string;       // S3 key after FetchPDF
  textKey?: string;      // S3 key after ExtractText
  chunkKeys?: string[];  // S3 keys after Chunk
};