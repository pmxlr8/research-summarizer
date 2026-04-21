import SummaryView from "./SummaryView";

// Pre-render known mock summary IDs for static export.
// Real summaries load client-side via the CloudFront 404 → /index.html fallback.
export function generateStaticParams() {
  return [{ id: "sum-1" }, { id: "sum-2" }, { id: "sum-3" }];
}

export default function SummaryPage({ params }: { params: { id: string } }) {
  return <SummaryView id={params.id} />;
}
