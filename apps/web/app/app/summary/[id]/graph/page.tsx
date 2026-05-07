import GraphPageClient from "./GraphPageClient";

export function generateStaticParams() {
  return [{ id: "_view" }];
}

export default function GraphPage({ params }: { params: { id: string } }) {
  return <GraphPageClient id={params.id} />;
}
