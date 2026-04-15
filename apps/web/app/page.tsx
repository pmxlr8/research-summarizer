import Image from "next/image";
import { Hero } from "./components/Hero";
import { Section } from "./components/Section";
import { ServiceCard } from "./components/ServiceCard";
import { TeamCard } from "./components/TeamCard";
import { PhaseTimeline } from "./components/PhaseTimeline";

const services = [
  {
    name: "Route 53 + CloudFront",
    role: "Edge",
    description:
      "DNS, HTTPS on a custom domain, and global edge caching sitting in front of the static frontend and the API.",
  },
  {
    name: "Amazon Cognito",
    role: "Auth",
    description:
      "Managed user pool. Issues JWTs on login; API Gateway validates them before any Lambda runs.",
  },
  {
    name: "API Gateway + Lambda",
    role: "API",
    description:
      "Single REST entrypoint routing authenticated requests to small, focused Lambda handlers.",
  },
  {
    name: "SQS + Step Functions",
    role: "Orchestration",
    description:
      "Async pipeline: SQS decouples the API from long work; Step Functions coordinates the five summarization steps with retries and parallel map.",
  },
  {
    name: "Amazon Bedrock",
    role: "LLM",
    description:
      "Claude Sonnet invoked via IAM — no API keys to manage. Generates the structured per-chunk summaries.",
  },
  {
    name: "DynamoDB + S3",
    role: "Data",
    description:
      "DynamoDB single-table for users, jobs, and summaries. S3 buckets for the Next.js build and raw PDFs.",
  },
];

const team = [
  { name: "Shreyas Sankpal", area: "Pipeline & Orchestration" },
  { name: "Pranjal Mishra", area: "Architecture & Frontend" },
  { name: "Yang Zheng", area: "Data Layer" },
  { name: "Kerry Huang", area: "Auth & API" },
];

const phases = [
  { label: "Phase 0", title: "Foundation", when: "Week 3 (early)", summary: "Repo, AWS account, CDK scaffold, CI." },
  { label: "Phase 1", title: "Walking Skeleton", when: "Week 3 (late)", summary: "Empty end-to-end deployment: frontend, Cognito, one stub API." },
  { label: "Phase 2", title: "Search", when: "Week 4", summary: "arXiv integration, search UI, results page." },
  { label: "Phase 3", title: "Summarization Pipeline", when: "Weeks 5–6", summary: "Step Functions, pipeline Lambdas, Bedrock, DynamoDB." },
  { label: "Phase 4", title: "Polish", when: "Week 7", summary: "UX, observability, load testing, docs." },
  { label: "Phase 5", title: "Demo", when: "Week 8", summary: "Rehearsal, slides, final presentation." },
];

export default function Home() {
  return (
    <main className="relative overflow-hidden">
      <Hero />

      <Section
        id="architecture"
        eyebrow="Architecture"
        title="Serverless on AWS, end to end"
        intro="Every service is managed — no virtual machines, no containers to babysit, no idle compute charges. The async pipeline is orchestrated by Step Functions; the LLM is Claude Sonnet invoked through Amazon Bedrock."
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
        title="What each piece does"
        intro="Twelve AWS services, each earning its place. One card per functional area."
      >
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <ServiceCard key={s.name} {...s} />
          ))}
        </div>
      </Section>

      <Section
        id="phases"
        eyebrow="Execution"
        title="Six phases from scaffold to demo"
        intro="Each phase has an explicit done-when checkpoint. We do not start the next until the previous is green."
      >
        <PhaseTimeline phases={phases} />
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
          AWS CDK, and Amazon Bedrock.
        </p>
      </footer>
    </main>
  );
}
