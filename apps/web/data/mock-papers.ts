import type { Paper } from "@/lib/types";

export const mockPapers: Paper[] = [
  {
    id: "paper-1",
    title: "Attention Is All You Need",
    authors: ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar", "Jakob Uszkoreit"],
    abstract:
      "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.",
    year: 2017,
    venue: "NeurIPS",
    arxivId: "1706.03762",
    pdfUrl: "https://arxiv.org/pdf/1706.03762",
  },
  {
    id: "paper-2",
    title: "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
    authors: ["Jacob Devlin", "Ming-Wei Chang", "Kenton Lee", "Kristina Toutanova"],
    abstract:
      "We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers. Unlike recent language representation models, BERT is designed to pre-train deep bidirectional representations from unlabeled text.",
    year: 2018,
    venue: "NAACL",
    arxivId: "1810.04805",
    pdfUrl: "https://arxiv.org/pdf/1810.04805",
  },
  {
    id: "paper-3",
    title: "Language Models are Few-Shot Learners",
    authors: ["Tom B. Brown", "Benjamin Mann", "Nick Ryder", "Melanie Subbiah"],
    abstract:
      "Recent work has demonstrated substantial gains on many NLP tasks and benchmarks by pre-training on a large corpus of text followed by fine-tuning on a specific task. We show that scaling up language models greatly improves task-agnostic, few-shot performance.",
    year: 2020,
    venue: "NeurIPS",
    arxivId: "2005.14165",
    pdfUrl: "https://arxiv.org/pdf/2005.14165",
  },
  {
    id: "paper-4",
    title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
    authors: ["Patrick Lewis", "Ethan Perez", "Aleksandra Piktus", "Fabio Petroni"],
    abstract:
      "Large pre-trained language models have been shown to store factual knowledge in their parameters. We introduce retrieval-augmented generation (RAG) — models which combine pre-trained parametric and non-parametric memory for language generation.",
    year: 2020,
    venue: "NeurIPS",
    arxivId: "2005.11401",
    pdfUrl: "https://arxiv.org/pdf/2005.11401",
  },
  {
    id: "paper-5",
    title: "A Survey of Large Language Models",
    authors: ["Wayne Xin Zhao", "Kun Zhou", "Junyi Li", "Tianyi Tang"],
    abstract:
      "Ever since the Turing Test was proposed in the 1950s, humans have explored the mastering of language intelligence by machines. Language is a prominent ability for human beings to express and communicate. Recently, LLMs have been significantly advancing the field.",
    year: 2023,
    venue: "arXiv",
    arxivId: "2303.18223",
    pdfUrl: "https://arxiv.org/pdf/2303.18223",
  },
  {
    id: "paper-6",
    title: "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models",
    authors: ["Jason Wei", "Xuezhi Wang", "Dale Schuurmans", "Maarten Bosma"],
    abstract:
      "We explore how generating a chain of thought — a series of intermediate reasoning steps — significantly improves the ability of large language models to perform complex reasoning.",
    year: 2022,
    venue: "NeurIPS",
    arxivId: "2201.11903",
    pdfUrl: "https://arxiv.org/pdf/2201.11903",
  },
  {
    id: "paper-7",
    title: "LoRA: Low-Rank Adaptation of Large Language Models",
    authors: ["Edward J. Hu", "Yelong Shen", "Phillip Wallis", "Zeyuan Allen-Zhu"],
    abstract:
      "We propose Low-Rank Adaptation, or LoRA, which freezes the pre-trained model weights and injects trainable rank decomposition matrices into each layer of the Transformer architecture, greatly reducing the number of trainable parameters for downstream tasks.",
    year: 2021,
    venue: "ICLR",
    arxivId: "2106.09685",
    pdfUrl: "https://arxiv.org/pdf/2106.09685",
  },
  {
    id: "paper-8",
    title: "Transformer Models in Healthcare: A Survey of Applications",
    authors: ["Sara Ahmed", "Michael Chen", "Priya Raman"],
    abstract:
      "Transformer-based architectures have revolutionized natural language processing and are increasingly applied to clinical and biomedical data. This survey reviews recent applications of transformer models in healthcare, spanning electronic health records, medical imaging, and drug discovery.",
    year: 2024,
    venue: "arXiv",
    arxivId: "2401.12345",
    pdfUrl: "https://arxiv.org/pdf/2401.12345",
  },
];
