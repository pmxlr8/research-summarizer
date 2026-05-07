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

export type GraphNodeType = "method" | "dataset" | "metric" | "task" | "concept" | "result";
export type GraphEdgeType = "uses" | "achieves" | "extends" | "evaluated_on" | "introduces" | "cites" | "compares_with";

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

export type Summary = {
  id: string;
  paperId: string;
  paper: Paper;
  status: "pending" | "running" | "done" | "failed";
  createdAt: string;   // ISO
  completedAt?: string;
  sections: SummarySection[];   // Objectives, Methods, Results, Limitations, Contributions
  keywords?: string[];
  durationSeconds?: number;
};

export type User = {
  id: string;
  email: string;
  name?: string;
};
