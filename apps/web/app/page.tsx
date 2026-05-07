import Image from "next/image";
import Link from "next/link";
import { Hero } from "./components/Hero";
import { Section } from "./components/Section";
import { ServiceCard } from "./components/ServiceCard";
import { TeamCard } from "./components/TeamCard";

const capabilities = [
  {
    name: "Search across two sources",
    role: "Search",
    description:
      "arXiv and Semantic Scholar queried in parallel, deduped by arxivId / DOI / normalized title. Phrase-quoted title boost so an exact title returns the right paper.",
  },
  {
    name: "Structured summaries",
    role: "Summarize",
    description:
      "A five-section structured summary — Objectives, Methodology, Results, Limitations, Contributions — plus auto-extracted keywords, generated end-to-end in about thirty seconds.",
  },
  {
    name: "Talk to the paper",
    role: "RAG chat",
    description:
      "Ask any question about a paper. Each answer is grounded in retrieved chunks with inline citation tooltips showing chunk number, similarity score, and excerpt.",
  },
  {
    name: "Knowledge graph",
    role: "Visualize",
    description:
      "Auto-extracted entities (methods, datasets, metrics, results) and relationships rendered as an interactive graph with a key-concepts rail and click-through neighbours.",
  },
  {
    name: "Library similarity",
    role: "Discover",
    description:
      "Mean paper-level embeddings let us surface the three most similar papers from your own library, side-by-side with the one you are reading.",
  },
  {
    name: "One-click export",
    role: "Export",
    description:
      "Copy any summary as Markdown, download as .md, or grab a clean BibTeX entry with the canonical lastnameYear key.",
  },
];

const services = [
  {
    name: "Route 53 + CloudFront",
    role: "Edge",
    description:
      "DNS, HTTPS on a custom domain, and global edge caching sit in front of the static frontend. A CloudFront Function rewrites nested SPA routes server-side.",
  },
  {
    name: "Amazon Cognito",
    role: "Auth",
    description:
      "Managed user pool with email verification, SRP login, and forgot-password flow. API Gateway validates JWTs before any Lambda runs.",
  },
  {
    name: "API Gateway + 13 Lambdas",
    role: "API",
    description:
      "REST entrypoint with eight authenticated endpoints — health, search, summarize, list/get summaries, related, graph, chat, quota.",
  },
  {
    name: "SQS + Step Functions",
    role: "Orchestration",
    description:
      "Async pipeline: SQS decouples the API from long work; Step Functions coordinates five Lambdas with retries, parallel map, and a failure handler that flips DynamoDB.",
  },
  {
    name: "Amazon Bedrock",
    role: "LLM + embeddings",
    description:
      "Qwen 3 Next 80B (Claude Sonnet swap-ready) for summarization, chat, and graph extraction. Titan Text Embeddings v2 for chunk vectors.",
  },
  {
    name: "DynamoDB + S3",
    role: "Data",
    description:
      "DynamoDB single-table for users, jobs, summaries, embeddings, and graphs with one GSI for cross-user dedup. Two S3 buckets — frontend and raw PDFs with lifecycle policy.",
  },
  {
    name: "CloudWatch + X-Ray",
    role: "Observability",
    description:
      "Structured JSON logs, four alarms wired to SNS email, X-Ray traces across every Lambda and Step Function execution, an operations dashboard, and an AWS Budgets alarm.",
  },
  {
    name: "AWS CDK",
    role: "Infrastructure as Code",
    description:
      "Seven reproducible TypeScript stacks — Auth, Data, Pipeline, Api, Frontend, Ops — deployable from scratch with one command.",
  },
  {
    name: "GitHub Actions",
    role: "CI",
    description:
      "Lint and build on every pull request. The whole infra is checked with cdk synth before merge.",
  },
];

const team = [
  { name: "Shreyas Sankpal", area: "Pipeline & Orchestration" },
  { name: "Pranjal Mishra", area: "Architecture & Frontend" },
  { name: "Yang Zheng", area: "Search & Data Layer" },
  { name: "Kerry Huang", area: "Auth & API" },
];

export default function Home() {
  return (
    <main className="relative overflow-hidden">
      <Hero />

      <Section
        id="capabilities"
        eyebrow="Product"
        title="What you can do once you sign in"
        intro="Everything below is live in production today. Sign up, paste a topic, and get back a structured summary, an interactive chat, and a knowledge graph in under a minute."
      >
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((c) => (
            <ServiceCard key={c.name} {...c} />
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Try it now
          </Link>
          <Link
            href="https://github.com/pmxlr8/research-summarizer"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white/70 px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur transition hover:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-900"
          >
            View source
          </Link>
        </div>
      </Section>

      <Section
        id="architecture"
        eyebrow="Architecture"
        title="Serverless on AWS, end to end"
        intro="Every service is managed — no virtual machines, no containers to babysit, no idle compute charges. The async pipeline is orchestrated by Step Functions; LLM and embedding calls go through Amazon Bedrock."
      >
        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 md:p-8">
          <Image
            src="/architecture.png"
            alt="AWS architecture diagram showing edge, API, pipeline, and data layers"
            width={2000}
            height={1100}
            className="h-auto w-full rounded-lg"
            priority
          />
          <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
            Figure 1 — AWS deployment topology
          </p>
        </div>
      </Section>

      <Section
        id="services"
        eyebrow="Services"
        title="Every piece earns its place"
        intro="Nine functional areas spanning thirteen Lambdas and seven CDK stacks. Hover for the role each one plays."
      >
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <ServiceCard key={s.name} {...s} />
          ))}
        </div>
      </Section>

      <Section
        id="numbers"
        eyebrow="Production numbers"
        title="Verified, not aspirational"
        intro="Every number below comes from real executions on the live deployment."
      >
        <dl className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <NumberCard label="End-to-end summary" value="27–44s" hint="real arXiv papers" />
          <NumberCard label="Search P95 latency" value="~1.4s" hint="arXiv + Semantic Scholar in parallel" />
          <NumberCard label="Cost per summary" value="$0.20" hint="Bedrock-dominated" />
          <NumberCard label="Idle infrastructure" value="$0" hint="serverless, pay-per-use" />
          <NumberCard label="Tests passing" value="14 / 14" hint="vitest" />
          <NumberCard label="API 5xx errors" value="0" hint="lifetime" />
          <NumberCard label="Knowledge graph" value="~25s" hint="first call, instant after" />
          <NumberCard label="Free tier coverage" value="100%" hint="excluding Bedrock" />
        </dl>
      </Section>

      <Section
        id="team"
        eyebrow="Team"
        title="Four engineers, one repo"
        intro="One owner per architectural area. Everyone reviews everyone else's pull requests."
      >
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {team.map((m) => (
            <TeamCard key={m.name} {...m} />
          ))}
        </div>
      </Section>

      <footer className="border-t border-slate-200 py-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <p>
          NYU Cloud Computing · Spring 2026 · Built with Next.js 14, TypeScript,
          AWS CDK, Step Functions, and Amazon Bedrock.
        </p>
      </footer>
    </main>
  );
}

function NumberCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60">
      <dt className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
        {value}
      </dd>
      {hint ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">{hint}</p> : null}
    </div>
  );
}
