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