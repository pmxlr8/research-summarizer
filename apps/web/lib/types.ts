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
