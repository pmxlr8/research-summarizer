import type { Summary } from "@/lib/types";
import { mockPapers } from "./mock-papers";

function iso(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

export const mockSummaries: Summary[] = [
  {
    id: "sum-1",
    paperId: "paper-1",
    paper: mockPapers[0],
    status: "done",
    createdAt: iso(2),
    completedAt: iso(2),
    durationSeconds: 47,
    keywords: ["transformer", "attention", "sequence-to-sequence"],
    sections: [
      {
        heading: "Objectives",
        bullets: [
          "Propose a new network architecture based solely on attention mechanisms.",
          "Eliminate recurrence and convolutions from sequence transduction models.",
          "Demonstrate superior quality and parallelizability over recurrent models.",
        ],
      },
      {
        heading: "Methodology",
        bullets: [
          "Introduce the Transformer architecture using multi-head self-attention.",
          "Stack encoder and decoder layers of identical structure.",
          "Apply positional encodings to inject order information.",
          "Train on WMT 2014 English-German and English-French translation tasks.",
        ],
      },
      {
        heading: "Results",
        bullets: [
          "Achieves 28.4 BLEU on WMT 2014 English-German, 2 BLEU over prior best.",
          "Achieves 41.8 BLEU on WMT 2014 English-French after 3.5 days of training.",
          "Trains significantly faster than recurrent or convolutional alternatives.",
        ],
      },
      {
        heading: "Limitations",
        bullets: [
          "Context window bounded by quadratic attention cost.",
          "Evaluated primarily on translation; generalization to other tasks unproven at publication.",
        ],
      },
      {
        heading: "Contributions",
        bullets: [
          "Establishes attention as a first-class modeling primitive.",
          "Provides the foundation for modern large language models.",
        ],
      },
    ],
  },
  {
    id: "sum-2",
    paperId: "paper-7",
    paper: mockPapers[6],
    status: "done",
    createdAt: iso(5),
    completedAt: iso(5),
    durationSeconds: 34,
    keywords: ["fine-tuning", "parameter-efficient", "LoRA"],
    sections: [
      {
        heading: "Objectives",
        bullets: [
          "Reduce the parameter footprint of adapting large pre-trained models to downstream tasks.",
          "Avoid full fine-tuning while preserving task performance.",
        ],
      },
      {
        heading: "Methodology",
        bullets: [
          "Freeze pre-trained weights; inject low-rank decomposition matrices into attention layers.",
          "Train only the injected matrices for each downstream task.",
          "Evaluate on RoBERTa, DeBERTa, GPT-2, and GPT-3 across GLUE and natural language generation tasks.",
        ],
      },
      {
        heading: "Results",
        bullets: [
          "Matches or exceeds full fine-tuning performance with 10,000x fewer trainable parameters on GPT-3 175B.",
          "No additional inference latency because adapters merge into the base weights at deployment.",
        ],
      },
      {
        heading: "Limitations",
        bullets: [
          "Per-task adapter weights still required; selection adds operational complexity.",
          "Rank hyperparameter must be tuned per model scale.",
        ],
      },
      {
        heading: "Contributions",
        bullets: [
          "Introduces a practical and widely-adopted parameter-efficient fine-tuning method.",
          "Demonstrates that low-rank updates capture most task-specific adaptation.",
        ],
      },
    ],
  },
  {
    id: "sum-3",
    paperId: "paper-6",
    paper: mockPapers[5],
    status: "running",
    createdAt: iso(0),
    keywords: [],
    sections: [],
  },
];
