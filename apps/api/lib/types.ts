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