"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  type Edge,
  type Node,
  type NodeTypes,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import type { GraphEdge, GraphNode, KnowledgeGraph } from "@/lib/types";

// Map our node types → visual style.
const NODE_STYLES: Record<GraphNode["type"], { bg: string; border: string; text: string; glyph: string }> = {
  method:   { bg: "rgba(99, 102, 241, 0.10)",  border: "#6366f1", text: "#4338ca", glyph: "M" },
  dataset:  { bg: "rgba(34, 211, 238, 0.10)",  border: "#0891b2", text: "#0e7490", glyph: "D" },
  metric:   { bg: "rgba(139, 92, 246, 0.10)",  border: "#8b5cf6", text: "#6d28d9", glyph: "%" },
  task:     { bg: "rgba(16, 185, 129, 0.10)",  border: "#10b981", text: "#047857", glyph: "T" },
  concept:  { bg: "rgba(100, 116, 139, 0.10)", border: "#64748b", text: "#334155", glyph: "•" },
  result:   { bg: "rgba(245, 158, 11, 0.10)",  border: "#f59e0b", text: "#b45309", glyph: "→" },
};

const EDGE_STYLES: Record<GraphEdge["type"], { stroke: string; dashed?: boolean }> = {
  uses:          { stroke: "#6366f1" },
  achieves:      { stroke: "#f59e0b" },
  extends:       { stroke: "#0891b2" },
  evaluated_on:  { stroke: "#10b981" },
  introduces:    { stroke: "#8b5cf6" },
  cites:         { stroke: "#94a3b8", dashed: true },
  compares_with: { stroke: "#64748b", dashed: true },
};

const NODE_W = 200;
const NODE_H = 64;

function CustomNode({ data, selected }: { data: GraphNode & { selected?: boolean }; selected?: boolean }) {
  const style = NODE_STYLES[data.type] ?? NODE_STYLES.concept;
  return (
    <div
      className={`rounded-xl px-3 py-2 transition ${selected ? "ring-2 ring-cyan-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-950" : ""}`}
      style={{
        width: NODE_W,
        background: style.bg,
        border: `1.5px solid ${style.border}`,
        color: style.text,
        backdropFilter: "blur(6px)",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div className="flex items-start gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-bold"
          style={{ background: style.border, color: "#fff" }}
          aria-hidden
        >
          {style.glyph}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold leading-tight">{data.label}</p>
          <p className="mt-0.5 truncate text-[10px] uppercase tracking-wider opacity-70">{data.type}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes: NodeTypes = { kg: CustomNode };

/** Layout nodes/edges with dagre (top-to-bottom). */
function layout(graph: KnowledgeGraph): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 80, marginx: 20, marginy: 20 });

  for (const n of graph.nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H });
  for (const e of graph.edges) g.setEdge(e.source, e.target);

  dagre.layout(g);

  const nodes: Node[] = graph.nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      id: n.id,
      type: "kg",
      position: { x: (pos?.x ?? 0) - NODE_W / 2, y: (pos?.y ?? 0) - NODE_H / 2 },
      data: n,
    };
  });

  const edges: Edge[] = graph.edges.map((e, i) => {
    const style = EDGE_STYLES[e.type] ?? EDGE_STYLES.uses;
    return {
      id: `e${i}`,
      source: e.source,
      target: e.target,
      label: e.label,
      labelStyle: { fontSize: 10, fontWeight: 500, fill: "#475569" },
      labelBgStyle: { fill: "rgba(255,255,255,0.85)" },
      labelBgPadding: [4, 2],
      labelBgBorderRadius: 4,
      type: "smoothstep",
      animated: e.type === "achieves" || e.type === "introduces",
      style: {
        stroke: style.stroke,
        strokeWidth: 1.5,
        strokeDasharray: style.dashed ? "5 4" : undefined,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: style.stroke, width: 16, height: 16 },
    };
  });

  return { nodes, edges };
}

function Inner({ graph }: { graph: KnowledgeGraph }) {
  const { fitView } = useReactFlow();
  const [selected, setSelected] = useState<GraphNode | null>(null);

  const { nodes: laidOutNodes, edges: laidOutEdges } = useMemo(() => layout(graph), [graph]);

  // Refit when nodes change.
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 100);
    return () => clearTimeout(t);
  }, [laidOutNodes, fitView]);

  const onNodeClick = useCallback((_e: unknown, node: Node) => {
    setSelected(node.data as GraphNode);
  }, []);

  // Pre-compute neighbours of the selected node.
  const neighbours = useMemo(() => {
    if (!selected) return { incoming: [], outgoing: [] };
    const incoming = graph.edges
      .filter((e) => e.target === selected.id)
      .map((e) => ({ edge: e, node: graph.nodes.find((n) => n.id === e.source) }))
      .filter((x): x is { edge: GraphEdge; node: GraphNode } => !!x.node);
    const outgoing = graph.edges
      .filter((e) => e.source === selected.id)
      .map((e) => ({ edge: e, node: graph.nodes.find((n) => n.id === e.target) }))
      .filter((x): x is { edge: GraphEdge; node: GraphNode } => !!x.node);
    return { incoming, outgoing };
  }, [selected, graph]);

  return (
    <div className="relative h-[640px] w-full overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <ReactFlow
        nodes={laidOutNodes}
        edges={laidOutEdges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={() => setSelected(null)}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: "smoothstep" }}
        minZoom={0.2}
        maxZoom={2.5}
      >
        <Background gap={24} size={1} color="#e2e8f0" />
        <Controls
          showInteractive={false}
          className="!bg-white/80 !border-slate-200 dark:!bg-slate-900/80 dark:!border-slate-700"
        />
      </ReactFlow>

      {/* Legend */}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2 text-[10px]">
        {Object.entries(NODE_STYLES).map(([type, s]) => (
          <span
            key={type}
            className="inline-flex items-center gap-1 rounded-md bg-white/80 px-2 py-1 backdrop-blur dark:bg-slate-900/80"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: s.border }} />
            <span className="font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300">{type}</span>
          </span>
        ))}
      </div>

      {/* Side panel */}
      {selected ? (
        <aside className="absolute right-0 top-0 flex h-full w-[320px] flex-col border-l border-slate-200 bg-white/95 p-5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {selected.type}
            </span>
            <button
              onClick={() => setSelected(null)}
              className="text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
              aria-label="close"
            >
              ✕
            </button>
          </div>
          <h3 className="mt-2 text-base font-semibold leading-tight text-slate-900 dark:text-slate-50">
            {selected.label}
          </h3>
          <p className="mt-3 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
            {selected.summary}
          </p>

          <div className="mt-5 space-y-3 overflow-y-auto pr-1">
            {neighbours.incoming.length > 0 ? (
              <Section title="Incoming">
                {neighbours.incoming.map((x, i) => (
                  <NeighbourRow
                    key={`in-${i}`}
                    arrow="←"
                    rel={x.edge.label}
                    node={x.node}
                    onClick={() => setSelected(x.node)}
                  />
                ))}
              </Section>
            ) : null}
            {neighbours.outgoing.length > 0 ? (
              <Section title="Outgoing">
                {neighbours.outgoing.map((x, i) => (
                  <NeighbourRow
                    key={`out-${i}`}
                    arrow="→"
                    rel={x.edge.label}
                    node={x.node}
                    onClick={() => setSelected(x.node)}
                  />
                ))}
              </Section>
            ) : null}
          </div>
        </aside>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
        {title}
      </p>
      <ul className="mt-1.5 space-y-1">{children}</ul>
    </div>
  );
}

function NeighbourRow({
  arrow,
  rel,
  node,
  onClick,
}: {
  arrow: string;
  rel: string;
  node: GraphNode;
  onClick: () => void;
}) {
  const style = NODE_STYLES[node.type] ?? NODE_STYLES.concept;
  return (
    <li>
      <button
        onClick={onClick}
        className="group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        <span className="font-mono text-slate-400 dark:text-slate-500">{arrow}</span>
        <span className="flex-1">
          <span className="italic text-slate-500 dark:text-slate-400">{rel} </span>
          <span className="font-medium" style={{ color: style.text }}>
            {node.label}
          </span>
        </span>
      </button>
    </li>
  );
}

export function KnowledgeGraphView({ graph }: { graph: KnowledgeGraph }) {
  if (graph.nodes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-sm font-semibold">No graph available</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          The summary didn&apos;t produce enough structured content to extract a knowledge graph.
        </p>
      </div>
    );
  }
  return (
    <ReactFlowProvider>
      <Inner graph={graph} />
    </ReactFlowProvider>
  );
}
