"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
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

// ─── Visual styles per type ─────────────────────────────────────────

const NODE_STYLES: Record<GraphNode["type"], {
  bg: string;
  bgDark: string;
  border: string;
  text: string;
  textDark: string;
  accent: string;
  label: string;
  desc: string;
}> = {
  method:  { bg: "#eef2ff", bgDark: "rgba(99,102,241,0.10)",  border: "#6366f1", text: "#3730a3", textDark: "#a5b4fc", accent: "#6366f1", label: "Method",  desc: "An algorithm, model, or architecture" },
  dataset: { bg: "#ecfeff", bgDark: "rgba(34,211,238,0.10)",  border: "#0891b2", text: "#155e75", textDark: "#67e8f9", accent: "#06b6d4", label: "Dataset", desc: "A benchmark or training corpus" },
  metric:  { bg: "#f5f3ff", bgDark: "rgba(139,92,246,0.10)",  border: "#8b5cf6", text: "#5b21b6", textDark: "#c4b5fd", accent: "#8b5cf6", label: "Metric",  desc: "An evaluation measure" },
  task:    { bg: "#ecfdf5", bgDark: "rgba(16,185,129,0.10)",  border: "#10b981", text: "#065f46", textDark: "#6ee7b7", accent: "#10b981", label: "Task",    desc: "A problem or downstream application" },
  concept: { bg: "#f8fafc", bgDark: "rgba(100,116,139,0.10)", border: "#64748b", text: "#1e293b", textDark: "#cbd5e1", accent: "#64748b", label: "Concept", desc: "A theoretical or design idea" },
  result:  { bg: "#fffbeb", bgDark: "rgba(245,158,11,0.10)",  border: "#f59e0b", text: "#92400e", textDark: "#fcd34d", accent: "#f59e0b", label: "Result",  desc: "A specific finding or number" },
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

const NODE_W = 260;
const NODE_H_BASE = 110;
const NODE_H_HIGHLIGHT = 130;

// ─── Custom node ────────────────────────────────────────────────────

type NodeData = GraphNode & { degree: number; central: boolean };

function CustomNode({ data, selected }: { data: NodeData; selected?: boolean }) {
  const style = NODE_STYLES[data.type] ?? NODE_STYLES.concept;
  const ringClass = selected
    ? "ring-2 ring-cyan-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-950"
    : data.central
      ? "shadow-[0_0_24px_rgba(99,102,241,0.35)]"
      : "";

  return (
    <div
      className={`group/node rounded-2xl px-4 py-3 transition ${ringClass}`}
      style={{
        width: NODE_W,
        background: style.bg,
        border: `1.5px solid ${style.border}`,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />

      <div className="flex items-center gap-2">
        <span
          className="flex h-5 items-center rounded-md px-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white"
          style={{ background: style.accent }}
        >
          {data.type}
        </span>
        {data.central ? (
          <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            ⊙ central
          </span>
        ) : null}
        <span className="ml-auto font-mono text-[10px] text-slate-500 dark:text-slate-400">
          {data.degree} link{data.degree === 1 ? "" : "s"}
        </span>
      </div>

      <h4
        className="mt-1.5 text-[13px] font-semibold leading-tight"
        style={{ color: style.text }}
      >
        {data.label}
      </h4>
      <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-slate-700 dark:text-slate-200">
        {data.summary}
      </p>

      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes: NodeTypes = { kg: CustomNode };

// ─── Layout ─────────────────────────────────────────────────────────

function layoutGraph(graph: KnowledgeGraph): {
  nodes: Node<NodeData>[];
  edges: Edge[];
  centralId: string | null;
  degrees: Map<string, number>;
} {
  // Compute degrees
  const degrees = new Map<string, number>();
  for (const n of graph.nodes) degrees.set(n.id, 0);
  for (const e of graph.edges) {
    degrees.set(e.source, (degrees.get(e.source) ?? 0) + 1);
    degrees.set(e.target, (degrees.get(e.target) ?? 0) + 1);
  }
  let centralId: string | null = null;
  let maxDeg = -1;
  degrees.forEach((d, id) => {
    if (d > maxDeg) { maxDeg = d; centralId = id; }
  });

  // Dagre LR — reads like a network, not a flowchart
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "LR",
    nodesep: 30,
    ranksep: 130,
    marginx: 30,
    marginy: 30,
    align: "DL",
  });

  for (const n of graph.nodes) {
    const isCentral = n.id === centralId;
    g.setNode(n.id, { width: NODE_W, height: isCentral ? NODE_H_HIGHLIGHT : NODE_H_BASE });
  }
  for (const e of graph.edges) g.setEdge(e.source, e.target);

  dagre.layout(g);

  const nodes: Node<NodeData>[] = graph.nodes.map((n) => {
    const pos = g.node(n.id);
    const isCentral = n.id === centralId;
    return {
      id: n.id,
      type: "kg",
      position: { x: (pos?.x ?? 0) - NODE_W / 2, y: (pos?.y ?? 0) - (isCentral ? NODE_H_HIGHLIGHT : NODE_H_BASE) / 2 },
      data: { ...n, degree: degrees.get(n.id) ?? 0, central: isCentral },
    };
  });

  const edges: Edge[] = graph.edges.map((e, i) => {
    const style = EDGE_STYLES[e.type] ?? EDGE_STYLES.uses;
    return {
      id: `e${i}`,
      source: e.source,
      target: e.target,
      label: e.label,
      labelStyle: { fontSize: 11, fontWeight: 500, fill: "#475569" },
      labelBgStyle: { fill: "rgba(255,255,255,0.92)" },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 4,
      type: "smoothstep",
      animated: e.type === "achieves" || e.type === "introduces",
      style: {
        stroke: style.stroke,
        strokeWidth: 1.6,
        strokeDasharray: style.dashed ? "5 4" : undefined,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: style.stroke, width: 18, height: 18 },
    };
  });

  return { nodes, edges, centralId, degrees };
}

// ─── Top "Key concepts" rail ────────────────────────────────────────

function KeyConcepts({
  graph,
  degrees,
  onPick,
  activeId,
}: {
  graph: KnowledgeGraph;
  degrees: Map<string, number>;
  onPick: (n: GraphNode) => void;
  activeId: string | null;
}) {
  const top = useMemo(() => {
    return [...graph.nodes]
      .map((n) => ({ node: n, degree: degrees.get(n.id) ?? 0 }))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 4);
  }, [graph, degrees]);

  if (top.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {top.map(({ node, degree }, idx) => {
        const style = NODE_STYLES[node.type] ?? NODE_STYLES.concept;
        const isActive = activeId === node.id;
        return (
          <button
            key={node.id}
            type="button"
            onClick={() => onPick(node)}
            className={`group/key relative overflow-hidden rounded-xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900/60 ${
              isActive
                ? "border-cyan-500 shadow-md"
                : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
            }`}
          >
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-[3px]"
              style={{ background: style.accent }}
            />
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] font-bold uppercase tracking-wider" style={{ color: style.accent }}>
                {idx === 0 ? "Most central" : `#${idx + 1}`}
              </span>
              <span className="ml-auto font-mono text-[10px] text-slate-500 dark:text-slate-400">{degree} links</span>
            </div>
            <h4 className="mt-1.5 line-clamp-2 text-sm font-semibold leading-tight text-slate-900 dark:text-slate-50">
              {node.label}
            </h4>
            <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
              {node.summary}
            </p>
            <p className="mt-2 text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {style.label}
            </p>
          </button>
        );
      })}
    </div>
  );
}

// ─── Inner (uses ReactFlowProvider) ─────────────────────────────────

function Inner({ graph }: { graph: KnowledgeGraph }) {
  const { fitView, setCenter, getNode } = useReactFlow();
  const [selected, setSelected] = useState<GraphNode | null>(null);

  const { nodes, edges, degrees } = useMemo(() => layoutGraph(graph), [graph]);

  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.18, duration: 500 }), 100);
    return () => clearTimeout(t);
  }, [nodes, fitView]);

  const onNodeClick = useCallback((_e: unknown, node: Node) => {
    setSelected(node.data as GraphNode);
  }, []);

  const onKeyConceptPick = useCallback(
    (n: GraphNode) => {
      setSelected(n);
      const node = getNode(n.id);
      if (node) {
        setCenter(node.position.x + NODE_W / 2, node.position.y + NODE_H_BASE / 2, {
          zoom: 1.1,
          duration: 600,
        });
      }
    },
    [getNode, setCenter],
  );

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
    <div className="space-y-5">
      <KeyConcepts
        graph={graph}
        degrees={degrees}
        onPick={onKeyConceptPick}
        activeId={selected?.id ?? null}
      />

      <div className="relative h-[78vh] min-h-[600px] w-full overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={() => setSelected(null)}
          fitView
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ type: "smoothstep" }}
          minZoom={0.2}
          maxZoom={2.5}
          nodesConnectable={false}
        >
          <Background gap={32} size={1} color="#e2e8f0" />
          <Controls
            showInteractive={false}
            className="!bg-white/80 !border-slate-200 dark:!bg-slate-900/80 dark:!border-slate-700"
          />
          <MiniMap
            zoomable
            pannable
            nodeStrokeWidth={2}
            nodeColor={(n) => NODE_STYLES[(n.data as NodeData)?.type]?.accent ?? "#94a3b8"}
            className="!bg-white/80 !border-slate-200 dark:!bg-slate-900/80 dark:!border-slate-700"
          />
        </ReactFlow>

        {/* Legend */}
        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5 text-[10px]">
          {Object.entries(NODE_STYLES).map(([type, s]) => (
            <span
              key={type}
              className="inline-flex items-center gap-1.5 rounded-md bg-white/85 px-2 py-1 backdrop-blur dark:bg-slate-900/80"
              title={s.desc}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: s.accent }} />
              <span className="font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {s.label}
              </span>
            </span>
          ))}
        </div>

        {/* Side panel */}
        {selected ? (
          <aside className="absolute right-0 top-0 flex h-full w-[340px] flex-col overflow-hidden border-l border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
            <div className="flex shrink-0 items-baseline justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <span
                className="font-mono text-[10px] font-bold uppercase tracking-wider"
                style={{ color: NODE_STYLES[selected.type].accent }}
              >
                {NODE_STYLES[selected.type].label}
              </span>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
                aria-label="close"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <h3 className="text-base font-semibold leading-tight text-slate-900 dark:text-slate-50">
                {selected.label}
              </h3>
              <p className="mt-1 text-[11px] italic text-slate-500 dark:text-slate-400">
                {NODE_STYLES[selected.type].desc}
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">
                {selected.summary}
              </p>

              <div className="mt-6 space-y-4">
                {neighbours.incoming.length > 0 ? (
                  <NeighbourSection title="What flows in">
                    {neighbours.incoming.map((x, i) => (
                      <NeighbourRow
                        key={`in-${i}`}
                        arrow="←"
                        rel={x.edge.label}
                        node={x.node}
                        onClick={() => setSelected(x.node)}
                      />
                    ))}
                  </NeighbourSection>
                ) : null}
                {neighbours.outgoing.length > 0 ? (
                  <NeighbourSection title="What flows out">
                    {neighbours.outgoing.map((x, i) => (
                      <NeighbourRow
                        key={`out-${i}`}
                        arrow="→"
                        rel={x.edge.label}
                        node={x.node}
                        onClick={() => setSelected(x.node)}
                      />
                    ))}
                  </NeighbourSection>
                ) : null}
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function NeighbourSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
        {title}
      </p>
      <ul className="mt-1.5 space-y-0.5">{children}</ul>
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
  const style = NODE_STYLES[node.type];
  return (
    <li>
      <button
        onClick={onClick}
        className="group/n flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        <span className="mt-px font-mono text-slate-400 dark:text-slate-500">{arrow}</span>
        <span className="flex-1">
          <span className="italic text-slate-500 dark:text-slate-400">{rel} </span>
          <span className="font-semibold" style={{ color: style.accent }}>
            {node.label}
          </span>
          <span className="block truncate text-[11px] text-slate-400 dark:text-slate-500">
            {style.label} · {node.summary.slice(0, 80)}{node.summary.length > 80 ? "…" : ""}
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
