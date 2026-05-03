# Vision — what this project can become

Where we are now (May 2026):

- Phase 1 (auth + walking skeleton) — done
- Phase 2 (search) — done, real arXiv integration, deployed
- Phase 3 (summarization pipeline) — done, real PDFs → Bedrock → structured summaries

What's below is not a backlog; it's a menu of meaningful upgrades grouped by category, with honest assessments of effort, course-relevance, and demo impact. Each item is independent — you can pick any subset.

---

## 1. LLM features that move this from "summarizer" to "research agent"

### 1.1 Talk to PDF (RAG chat)

A separate chat panel on the summary page where the user asks questions about the specific paper.

**Mechanics.** When a paper is ingested, we already have the chunked text in S3. Add an embedding step: compute embeddings (Amazon Titan Embeddings v2 or Cohere Embed v3 on Bedrock) for each chunk and store them. On a question, embed the question, retrieve the top-k most similar chunks, stuff them into a Claude/Qwen prompt, return the answer with citations to chunk numbers.

**Where to store vectors.** Three options ordered by simplicity:
1. **DynamoDB with vectors as base64-encoded float32 + brute-force cosine** — fine for dozens of chunks per paper. Zero new infrastructure. Wins for class projects.
2. **OpenSearch Serverless with vector engine** — proper ANN search, scales to millions. Adds ~$30/month minimum cost.
3. **pgvector on Aurora Serverless v2** — most flexible, can query by text + vector together. Adds ~$45/month minimum.

**Effort.** Small (option 1), medium (options 2-3). Two new Lambdas: `embed-chunks` (added to Step Functions after `Chunk`) and `chat` (a new API endpoint).

**Course value.** High — RAG is the canonical genAI architecture and demos beautifully.

### 1.2 Deep research / multi-hop reasoning

Instead of summarizing one paper, the user types a research question, and the agent:
1. Searches arXiv for relevant papers
2. Pulls the top-N abstracts
3. Identifies sub-questions
4. For each sub-question, searches and retrieves more
5. Synthesizes a multi-paper literature review with citations

**Mechanics.** Step Functions with a recursion-bounded loop, each iteration a `plan → search → read → synthesize` cycle. Use Bedrock's tool-use API (Claude or Nova) so the model can call our `searchPapers` and `summarizePaper` functions as tools.

**Effort.** Medium-large. ~3-4 days of focused work. The state machine becomes substantially more complex.

**Demo value.** Massive. This is the feature that gets gasps from a class.

**Course value.** High — agentic loops with tool use is the current frontier in genAI.

### 1.3 Live web access during summarization

Let the LLM look up unknown terms or referenced papers while summarizing. Equivalent to "show your work" mode.

**Mechanics.** A `webSearch` tool exposed to the model via Bedrock tool-use. Implemented as a Lambda that calls Brave/Tavily/Serper search APIs. Add a "deep mode" toggle on the summarize button.

**Effort.** Small — one new Lambda + tool definition. The hard part is paying for a search API (~$5-10/month for free-tier of Brave or Tavily).

**Course value.** Medium — adjacent to the core thesis but a fun feature.

### 1.4 Streaming responses (server-sent events)

Right now summarization is async (submit → wait → see result). Replace the wait with token-by-token streaming for "Talk to PDF" so it feels like ChatGPT.

**Mechanics.** Bedrock `InvokeModelWithResponseStream`. API Gateway doesn't support streaming, so we'd need either Lambda Function URLs (which do) or AppSync subscriptions. Function URLs is the pragmatic choice — bypass API Gateway for this single endpoint, keep auth via a custom Lambda authorizer.

**Effort.** Small-medium.

**Demo value.** High — perceived speed feels 5x faster.

### 1.5 Comparative analysis across papers

User selects 2-5 papers and gets a comparison: where they agree, disagree, gaps in coverage, which is more current.

**Mechanics.** New endpoint `POST /compare {paperIds: [...]}`. Step Functions pulls each paper's stored summary, prompts Claude/Qwen for a comparative table.

**Effort.** Small. Reuses existing data.

**Demo value.** High — answers the "so what?" question of why summarize papers.

### 1.6 Citation graph navigation

Each paper's summary includes its references; clicking a reference launches a new ingest job for that paper. Build a visualizable graph over time.

**Mechanics.** Use Grobid for proper structured PDF extraction (it's better than `pdf-parse` at extracting bibliographies). Resolve references via Crossref/Semantic Scholar APIs. Render a force-directed graph in the UI with d3-force or react-flow.

**Effort.** Medium. Grobid runs in a Docker container — needs Fargate or a self-hosted approach.

**Course value.** High — this is "real" academic tooling.

---

## 2. Prompt engineering improvements

The current prompts are decent v1. Realistic upgrades:

### 2.1 Few-shot exemplars

Include 1-2 examples of the desired output format in the system prompt. Empirically reduces JSON parsing failures from ~5% to <1%.

### 2.2 Self-consistency for low-confidence sections

Run the map step 3x with temperature 0.7, take the majority vote per bullet. Trades cost (3x tokens) for quality where it matters most (results section).

### 2.3 Structured output via Bedrock Converse API

Move from prompt-engineered JSON to Bedrock's native structured output (where the model is constrained to a JSON schema at decoding time). Available for Claude 3.5+ and Nova. Eliminates the JSON parsing fallback paths in `bedrock.ts`.

### 2.4 Two-stage extraction

Stage 1: pull structured metadata (authors, dataset names, model architectures, evaluation metrics). Stage 2: write narrative summary using stage-1 facts as ground truth. Reduces hallucination.

### 2.5 Per-domain prompts

ML papers, biology papers, and physics papers need different sections. Detect the domain from the abstract and route to a specialized prompt.

**Effort for all 5.** Each is 1-2 hours.
**Course value.** High — these are standard prompt engineering techniques worth showcasing.

---

## 3. Frontend upgrades

The current UI is clean but has obvious places to make it feel state-of-the-art.

### 3.1 Real-time job status (WebSocket or polling)

Right now the user has to refresh `/app` to see a job complete. Either:
- **Polling**: dashboard polls `/summaries` every 5s while any job is running. Trivial.
- **WebSockets**: API Gateway WebSocket API + DynamoDB connection table. Reduces backend chatter; better UX.
- **AppSync subscriptions**: GraphQL subscriptions, more complex but cleaner code.

### 3.2 Streaming summary view

When a job is "running", show the partial summary as chunks complete (each Map step writes to DDB; UI streams in). Feels alive.

### 3.3 Inline highlights / citations in the summary

Each bullet has hover-to-show context: which chunk it came from, which paragraph in the original PDF. Clicking jumps to a side-panel PDF viewer with the relevant section highlighted.

**Mechanics.** Store per-bullet provenance (source chunk index, paragraph offset) during the map step. Use `pdfjs-dist` in the frontend to render the PDF and overlay highlights.

### 3.4 Side-by-side PDF viewer

The summary on the left, the original PDF on the right, scrolled in sync. The professional reading experience.

### 3.5 Saved annotations + highlights

Users highlight text in the summary, add notes. Stored per-user in DDB. Lays groundwork for personal knowledge base features.

### 3.6 Sharing + public links

A "Share this summary" button generates a public read-only link. New endpoint `GET /public/{shareId}` that bypasses auth and returns just the summary content.

### 3.7 Dark/light theme toggle

Currently follows OS preference. A manual toggle stored in localStorage (or as a Cognito user attribute) is a quick win.

### 3.8 Command palette (Cmd-K)

A spotlight-style palette to navigate, search papers, switch theme, and start a new summary. Use the `cmdk` npm package — about 2 hours of work.

### 3.9 Skeleton states everywhere

Already there for dashboard and summary detail. Extend to search results and the confirm page for a polished feel.

### 3.10 Keyboard shortcuts

`/` to focus search, `g d` to go to dashboard, `g s` to go to search, `?` to show shortcuts. Use `react-hotkeys-hook`.

---

## 4. ML / pipeline ops upgrades

### 4.1 Embeddings as a first-class citizen

Add an `embed-chunks` step to the state machine; store vectors per chunk in DDB or OpenSearch. Unlocks RAG, semantic search across your library, "find similar papers" features.

### 4.2 Eval harness

A small set of papers with hand-written ground-truth summaries. Run the pipeline against them on every deploy; compute ROUGE, BERTScore, or LLM-as-judge fidelity. Catches prompt regressions before they ship.

### 4.3 Cost + latency dashboards

Per-run cost (tokens × per-token rate), p50/p95/p99 latency per step. Build into a CloudWatch dashboard. Comes free with X-Ray.

### 4.4 Caching identical summaries

Hash the PDF content; if we've summarized that exact PDF before (regardless of user), return the cached result and skip the entire pipeline. Saves money and time.

### 4.5 Background re-summarization

Once a quarter, re-run the pipeline against all stored summaries with the latest model. Track quality drift over time. Demonstrates serious ops thinking.

### 4.6 A/B testing framework

50% of new summaries use prompt A, 50% use prompt B. Track which gets more "useful" votes from users. Bake this into the data layer from day one.

---

## 5. Cloud computing concepts the course probably wants to see

This is a cloud computing class. The course rubric likely rewards:

### 5.1 Containerization

Currently we use Lambda everywhere — that's serverless containers, which counts. But a **Dockerfile** for the frontend and a **Fargate task** for Grobid (PDF extraction) would let you say "we use ECS, Lambda, and Fargate". Easy points.

### 5.2 Infrastructure as Code

Already have CDK. Could add:
- A separate `prod` stage for free
- Multi-region deployment (deploy to us-east-1 and us-west-2 for failover)
- A "destroy and re-create" demo to show reproducibility

### 5.3 CI/CD with ephemeral environments

GitHub Actions deploys a throwaway stack per pull request. Auto-tears-down on merge or 24h. ~2 days of work, very impressive in a demo.

### 5.4 Observability stack

X-Ray traces from API Gateway through Lambda to Bedrock. Custom CloudWatch metrics for token usage. Alarms wired to SNS to email. Half a day, looks production-ready.

### 5.5 Security posture

- AWS WAF in front of CloudFront and API Gateway (rate limiting, OWASP managed rules)
- Secrets Manager for any third-party keys
- KMS customer-managed keys for S3 encryption
- IAM Access Analyzer review

### 5.6 Cost optimization

- AWS Budgets at multiple thresholds ($10, $25, $50)
- DynamoDB autoscaling
- S3 Intelligent-Tiering
- Lambda Graviton (ARM) for 20% cost reduction
- Reserved capacity for predictable workloads

### 5.7 Disaster recovery (DR)

DynamoDB Global Tables, S3 cross-region replication, CloudFront origin failover. Document an RTO/RPO. Probably overkill for a class but a one-slide section on this is impressive.

### 5.8 Load testing

Use k6 or Artillery to fire 100 concurrent searches and 50 concurrent summary jobs. Capture P95 latency and error rates. Show the team can handle real load.

### 5.9 Chaos engineering

AWS Fault Injection Simulator: kill a Lambda mid-execution, throttle Bedrock, drop a DynamoDB read. Verify the pipeline recovers gracefully (DLQ + retries do their job). Awesome-factor: high.

---

## 6. Course-paper deliverables

The course almost certainly requires written components. We have most of these but should formalize:

### 6.1 Architecture report (have)
`docs/reports/Week2_Report.pdf` — extend to cover Phases 2-3 implementation.

### 6.2 Final paper (need)
~6-8 pages: motivation, related work, architecture, evaluation, lessons learned. Standard CS paper format.

### 6.3 Slide deck (need)
12-15 slides, 7-minute presentation:
1. Problem
2. Demo (live, 2 min)
3. Architecture diagram
4. Pipeline detail
5. Tech stack + cloud services used
6. Cost breakdown
7. Performance numbers
8. What we'd do next

### 6.4 Recorded demo (insurance)
A 5-minute screen recording walking through signup → search → summarize → view. Backup if the live demo breaks.

### 6.5 Cost analysis writeup
"$X to summarize 1 paper, $Y/month idle, projected $Z for 1000 users." Concrete numbers, not arm-waving.

---

## 7. What I'd prioritize if you had 2 weeks

Ranked by impact-per-effort for a class demo:

1. **Real-time job status (polling)** — 1 hour. Stops the user from refreshing.
2. **Talk to PDF (RAG)** — 2 days. Single biggest "wow" feature, course-aligned.
3. **Side-by-side PDF viewer** — 1 day. Makes the summary feel grounded.
4. **CloudWatch dashboard + alarms** — half a day. Concrete cloud-ops deliverable.
5. **Comparative analysis (compare 2-3 papers)** — 1 day. High demo value.
6. **Eval harness + cost numbers** — 1 day. Concrete academic credibility.
7. **Slide deck + recorded backup** — 1 day. Insurance.
8. **Final paper draft** — 2 days.

Total: 9-10 working days. Doable if everyone owns one thing.

What I'd skip for a class project: deep research / multi-hop agent (cool but the failure modes are brutal under demo pressure), citation graph (Grobid is finicky), A/B testing framework (premature without users).

---

## 8. Migration safety

Important: nothing on this list requires throwing away current code. The architecture is built for additive changes:

- `lib/api.ts` already abstracts API calls; new endpoints slot in.
- `lib/auth.ts` already abstracts auth; nothing changes when we add features.
- DynamoDB single-table design accommodates new entity types via new SK prefixes (no migration needed).
- Step Functions accepts new states without rewriting existing ones.
- Bedrock client supports both Anthropic and OpenAI-format APIs already.

Decisions made early that we got right and don't need to revisit:
- Single-table DynamoDB
- CDK over CloudFormation/Terraform
- Static frontend export (ships anywhere)
- Cognito JWT at API Gateway (centralized auth)
- Step Functions over single fat Lambda (avoids 15-min limit, gives retries)
- Bundling external deps with esbuild (fast cold starts)

What I'd reconsider only if we add a serious feature:
- If we add streaming, we lose API Gateway for that endpoint (use Lambda Function URLs).
- If we add GraphQL/AppSync for subscriptions, the REST API stays alongside it.
- If we add Grobid, it doesn't fit Lambda — we'd need Fargate.
