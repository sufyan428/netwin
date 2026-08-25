"use client";

import { motion } from "framer-motion";
import { useNetTwin } from "@/lib/store";
import { useUI, SidebarTab } from "@/lib/uiStore";
import AIEngineer from "./AIEngineer";
import NetworkTools from "./NetworkTools";
import { NetNode, NetEdge } from "@/lib/types";
import { Card } from "./ui/Panel";
import { Button } from "./ui/Button";
import { cn } from "@/lib/cn";

// Compute a simple diff between two snapshots (added/removed nodes & edges)
function diffSnapshots(
  a: { nodes: NetNode[]; edges: NetEdge[] },
  b: { nodes: NetNode[]; edges: NetEdge[] }
) {
  const aNodeIds = new Set(a.nodes.map((n) => n.id));
  const bNodeIds = new Set(b.nodes.map((n) => n.id));
  const aEdgeKeys = new Set(a.edges.map((e) => [e.source, e.target].sort().join("|")));
  const bEdgeKeys = new Set(b.edges.map((e) => [e.source, e.target].sort().join("|")));

  const addedNodes = b.nodes.filter((n) => !aNodeIds.has(n.id));
  const removedNodes = a.nodes.filter((n) => !bNodeIds.has(n.id));
  const addedEdges = b.edges.filter((e) => !aEdgeKeys.has([e.source, e.target].sort().join("|")));
  const removedEdges = a.edges.filter((e) => !bEdgeKeys.has([e.source, e.target].sort().join("|")));

  const changedEdges: { edge: NetEdge; oldLat: number; newLat: number }[] = [];
  for (const be of b.edges) {
    const key = [be.source, be.target].sort().join("|");
    const ae = a.edges.find((x) => [x.source, x.target].sort().join("|") === key);
    if (ae && ae.baseLatency !== be.baseLatency) {
      changedEdges.push({ edge: be, oldLat: ae.baseLatency, newLat: be.baseLatency });
    }
  }

  return { addedNodes, removedNodes, addedEdges, removedEdges, changedEdges };
}

function edgePairLabel(e: NetEdge) {
  return `${e.source} <-> ${e.target}`;
}

const tabs: { id: SidebarTab; label: string }[] = [
  { id: "network", label: "Network" },
  { id: "tools", label: "Tools" },
  { id: "ai", label: "AI" },
  { id: "history", label: "History" },
];

export default function Sidebar() {
  const tab = useUI((s) => s.sidebarTab);
  const setTab = useUI((s) => s.setSidebarTab);
  const collapsed = useUI((s) => s.sidebarCollapsed);
  const setCollapsed = useUI((s) => s.setSidebarCollapsed);

  const nodes = useNetTwin((s) => s.nodes);
  const edges = useNetTwin((s) => s.edges);
  const simulation = useNetTwin((s) => s.simulation);
  const failedEdgeIds = simulation.failedEdgeIds;
  const routeEdgeIds = useNetTwin((s) => s.routeEdgeIds);
  const selectedNodeId = useNetTwin((s) => s.selectedNodeId);
  const selectedEdgeId = useNetTwin((s) => s.selectedEdgeId);
  const selectNode = useNetTwin((s) => s.selectNode);
  const selectEdge = useNetTwin((s) => s.selectEdge);
  const history = useNetTwin((s) => s.history);
  const diffVersion = useNetTwin((s) => s.diffVersion);
  const setDiffVersion = useNetTwin((s) => s.setDiffVersion);
  const restoreToVersion = useNetTwin((s) => s.restoreToVersion);
  const affectedDevices = useNetTwin((s) => s.analysis.affectedDevices);

  const currentSnapshot = { nodes, edges };
  const diffEntry = diffVersion ? history.find((h) => h.version === diffVersion) : null;
  const diff = diffEntry ? diffSnapshots(diffEntry.snapshot, currentSnapshot) : null;

  return (
    <>
      {!collapsed && (
        <div
          onClick={() => setCollapsed(true)}
          className="fixed inset-0 top-14 z-20 bg-black/50 md:hidden"
          aria-hidden
        />
      )}
      <aside
      className={cn(
        "shrink-0 h-full flex-col border-r border-border bg-surface",
        "md:flex md:w-[300px]",
        collapsed
          ? "hidden"
          : "flex fixed md:static inset-y-0 left-0 top-14 z-30 w-[85vw] max-w-[320px] shadow-lg md:shadow-none"
      )}
    >
      <div className="flex border-b border-border shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 relative py-3 text-xs font-medium transition-colors"
            style={{ color: tab === t.id ? "var(--text)" : "var(--text-faint)" }}
          >
            {t.label}
            {tab === t.id && (
              <motion.div
                layoutId="tab-underline"
                className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-accent"
              />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === "network" && (
          <div className="p-4 space-y-5">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-text-faint mb-2">
                Overview
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Devices" value={nodes.length} />
                <Stat label="Links" value={edges.length} />
                <Stat label="Failed" value={failedEdgeIds.length} danger={failedEdgeIds.length > 0} />
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-text-faint mb-2">
                Devices
              </div>
              <div className="space-y-1">
                {nodes.map((n) => {
                  const failed =
                    simulation.failedNodeIds.includes(n.id) ||
                    simulation.vlanMismatchNodeIds.includes(n.id);
                  const isolated = affectedDevices.includes(n.id);
                  const dotColor = failed || isolated ? "var(--danger)" : n.kind === "host" ? "var(--warning)" : "var(--accent)";
                  return (
                    <button
                      key={n.id}
                      onClick={() => selectNode(n.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors hover:bg-surface-hover",
                        selectedNodeId === n.id && "bg-surface-hover"
                      )}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />
                      <span className="text-xs font-medium">{n.label}</span>
                      <span className="text-[10px] text-text-faint font-mono ml-auto">{n.ip}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-text-faint mb-2">
                Links
              </div>
              <div className="space-y-1">
                {edges.map((e) => {
                  const blocked = simulation.aclBlockEdgeIds.includes(e.id);
                  const failed = failedEdgeIds.includes(e.id) || blocked;
                  const onRoute = routeEdgeIds.has(e.id);
                  const latOv = simulation.latencyOverrides[e.id];
                  const bwOv = simulation.bandwidthOverrides[e.id];
                  const lossOv = simulation.packetLossOverrides[e.id];
                  const mtuMismatch = simulation.mtuMismatchEdgeIds.includes(e.id);
                  const dot = failed
                    ? "var(--danger)"
                    : lossOv !== undefined || mtuMismatch || bwOv !== undefined
                    ? "var(--orange)"
                    : latOv !== undefined
                    ? "var(--warning)"
                    : onRoute
                    ? "var(--accent-2)"
                    : "var(--border-strong)";
                  const label = failed
                    ? blocked
                      ? "BLOCKED"
                      : "DOWN"
                    : lossOv !== undefined
                    ? `${lossOv}% loss`
                    : mtuMismatch
                    ? "MTU!"
                    : latOv !== undefined
                    ? `${latOv}ms`
                    : `${e.baseLatency}ms`;
                  return (
                    <button
                      key={e.id}
                      onClick={() => selectEdge(e.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors hover:bg-surface-hover",
                        selectedEdgeId === e.id && "bg-surface-hover"
                      )}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} />
                      <span className="text-xs font-mono">
                        {e.source} {"<->"} {e.target}
                      </span>
                      <span className="text-[10px] text-text-faint ml-auto font-mono">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === "tools" && <NetworkTools />}

        {tab === "ai" && <AIEngineer />}

        {tab === "history" && (
          <div className="p-4 space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-text-faint mb-2">
                Version Timeline
              </div>
              <div className="space-y-1.5">
                {[...history].reverse().map((h) => {
                  const color =
                    h.status === "healthy"
                      ? "var(--success)"
                      : h.status === "degraded"
                      ? "var(--warning)"
                      : "var(--danger)";
                  const isDiff = diffVersion === h.version;
                  const isLatest = h.version === history.length;
                  return (
                    <div key={h.id} className="fade-in-up">
                      <button
                        onClick={() => setDiffVersion(isDiff ? null : h.version)}
                        className={cn(
                          "w-full rounded-lg border p-2.5 text-left transition-colors",
                          isDiff ? "border-accent bg-surface-hover" : "border-border bg-surface-2"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-bg text-accent">
                            v{h.version}
                          </span>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                          <span className="text-[9px] uppercase tracking-wide" style={{ color }}>
                            {h.status}
                          </span>
                          {isLatest && (
                            <span className="text-[8px] px-1 py-0.5 rounded bg-accent/15 text-accent ml-auto">
                              CURRENT
                            </span>
                          )}
                          <span
                            className="text-[9px] text-text-faint font-mono"
                            style={{ marginLeft: isLatest ? 0 : "auto" }}
                          >
                            {new Date(h.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div className="text-[11px] text-text leading-snug">{h.action}</div>
                      </button>
                      {!isLatest && (
                        <Button
                          onClick={() => restoreToVersion(h.version)}
                          className="w-full mt-1 !text-[10px]"
                        >
                          Restore to v{h.version}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {diff && diffEntry && (
              <Card className="border-accent/30 p-3 fade-in-up">
                <div className="text-[10px] uppercase tracking-wider text-accent mb-2">
                  Diff: v{diffEntry.version} {"->"} v{history.length}
                </div>
                <div className="space-y-2 text-[11px]">
                  <DiffSection
                    title="Added devices"
                    items={diff.addedNodes.map((n) => `${n.label} (${n.kind})`)}
                    color="var(--success)"
                    prefix="+"
                  />
                  <DiffSection
                    title="Removed devices"
                    items={diff.removedNodes.map((n) => `${n.label} (${n.kind})`)}
                    color="var(--danger)"
                    prefix="-"
                  />
                  <DiffSection
                    title="Added links"
                    items={diff.addedEdges.map((e) => `${edgePairLabel(e)} (${e.baseLatency}ms)`)}
                    color="var(--success)"
                    prefix="+"
                  />
                  <DiffSection
                    title="Removed links"
                    items={diff.removedEdges.map((e) => `${edgePairLabel(e)}`)}
                    color="var(--danger)"
                    prefix="-"
                  />
                  <DiffSection
                    title="Latency changes"
                    items={diff.changedEdges.map((c) => `${edgePairLabel(c.edge)}: ${c.oldLat}ms -> ${c.newLat}ms`)}
                    color="var(--warning)"
                    prefix="~"
                  />
                  {diff.addedNodes.length === 0 &&
                    diff.removedNodes.length === 0 &&
                    diff.addedEdges.length === 0 &&
                    diff.removedEdges.length === 0 &&
                    diff.changedEdges.length === 0 && (
                      <div className="text-text-faint">No topology changes — only simulation state differs.</div>
                    )}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
      </aside>
    </>
  );
}

function DiffSection({
  title,
  items,
  color,
  prefix,
}: {
  title: string;
  items: string[];
  color: string;
  prefix: string;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-text-faint mb-0.5">{title}</div>
      <div className="space-y-0.5">
        {items.map((it, i) => (
          <div key={i} className="font-mono" style={{ color }}>
            {prefix} {it}
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <Card className="p-2.5 text-center">
      <div className="text-lg font-semibold" style={{ color: danger ? "var(--danger)" : "var(--text)" }}>
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wide text-text-faint mt-0.5">{label}</div>
    </Card>
  );
}
