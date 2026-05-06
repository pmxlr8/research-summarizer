import SummaryView from "./SummaryView";

// Static export requires every dynamic param to be enumerated at build
// time. We generate a single "_view" placeholder HTML file. CloudFront
// rewrites every /app/summary/<id>/ request to that file, and the client
// component reads the actual id from window.location at runtime.
export function generateStaticParams() {
  return [{ id: "_view" }];
}

export default function SummaryPage({ params }: { params: { id: string } }) {
  return <SummaryView id={params.id} />;
}
