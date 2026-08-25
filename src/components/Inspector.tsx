"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Router, Server, ZapOff, RotateCcw, Trash2, ShieldOff, Ruler, Tags } from "lucide-react";
import { useNetTwin } from "@/lib/store";
import { IconButton, Button } from "./ui/Button";

export default function Inspector() {
  const nodes = useNetTwin((s) => s.nodes);
  const edges = useNetTwin((s) => s.edges);
  const analysis = useNetTwin((s) => s.analysis);
  const simulation = useNetTwin((s) => s.simulation);
  const selectedNodeId = useNetTwin((s) => s.selectedNodeId);
  const selectedEdgeId = useNetTwin((s) => s.selectedEdgeId);
  const selectNode = useNetTwin((s) => s.selectNode);
  const selectEdge = useNetTwin((s) => s.selectEdge);
  const deleteNode = useNetTwin((s) => s.deleteNode);
  const deleteEdge = useNetTwin((s) => s.deleteEdge);
  const runWhatIf = useNetTwin((s) => s.runWhatIf);

  const node = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;
  const edge = selectedEdgeId ? edges.find((e) => e.id === selectedEdgeId) : null;

  const open = !!(node || edge);

  const nodeFailed = node ? simulation.failedNodeIds.includes(node.id) : false;
  const nodeVlanMismatch = node ? simulation.vlanMismatchNodeIds.includes(node.id) : false;
  const edgeFailed = edge ? simulation.failedEdgeIds.includes(edge.id) : false;
  const edgeAclBlocked = edge ? simulation.aclBlockEdgeIds.includes(edge.id) : false;
  const edgeMtuMismatch = edge ? simulation.mtuMismatchEdgeIds.includes(edge.id) : false;
  const edgeLatOv = edge ? simulation.latencyOverrides[edge.id] : undefined;
  const edgeBwOv = edge ? simulation.bandwidthOverrides[edge.id] : undefined;
  const edgeLossOv = edge ? simulation.packetLossOverrides[edge.id] : undefined;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
          className="absolute bottom-4 right-4 w-[min(288px,calc(100vw-2rem))] max-h-[min(560px,calc(100vh-6rem))] rounded-xl border border-border bg-surface/95 backdrop-blur-md shadow-lg z-20 overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
            <span className="text-xs font-semibold text-text flex items-center gap-1.5">
              {node ? <Router size={13} /> : <Server size={13} />}
              {node ? "Device" : "Link"} Inspector
            </span>
            <IconButton
              onClick={() => {
                selectNode(null);
                selectEdge(null);
              }}
              aria-label="Close inspector"
            >
              <X size={14} />
            </IconButton>
          </div>

          <div className="p-4 space-y-3 overflow-y-auto">
            {node && (
              <>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold">{node.label}</span>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded uppercase font-medium"
                      style={{
                        background:
                          node.kind === "host"
                            ? "color-mix(in srgb, var(--warning) 15%, transparent)"
                            : "color-mix(in srgb, var(--accent) 15%, transparent)",
                        color: node.kind === "host" ? "var(--warning)" : "var(--accent)",
                      }}
                    >
                      {node.kind}
                    </span>
                  </div>
                  <div className="text-[11px] text-text-faint mt-1 font-mono">{node.ip}</div>
                </div>

                <Row label="Model" value={node.model} />
                <Row label="Location" value={node.location} />

                <div className="pt-1">
                  {nodeFailed ? (
                    <StatusLine color="var(--danger)" pulse text="FAILED — all links isolated (what-if)" />
                  ) : nodeVlanMismatch ? (
                    <StatusLine color="var(--danger)" pulse text="Wrong VLAN — isolated from its segment (what-if)" />
                  ) : analysis.affectedDevices.includes(node.id) ? (
                    <StatusLine color="var(--danger)" text="Isolated — unreachable due to failure" />
                  ) : (
                    <StatusLine color="var(--success)" text="Reachable from all live devices" />
                  )}
                </div>

                {node.kind === "router" && (
                  <Button
                    onClick={() =>
                      nodeFailed ? runWhatIf("restore", node.id) : runWhatIf("router-fail", node.id)
                    }
                    variant={nodeFailed ? "secondary" : "danger"}
                    className="w-full"
                  >
                    {nodeFailed ? <RotateCcw size={13} /> : <ZapOff size={13} />}
                    {nodeFailed ? "Restore device" : "What-if: Fail this device"}
                  </Button>
                )}

                <Button
                  onClick={() =>
                    nodeVlanMismatch
                      ? runWhatIf("restore", node.id)
                      : runWhatIf("vlan-mismatch", node.id)
                  }
                  variant={nodeVlanMismatch ? "secondary" : "danger"}
                  className="w-full"
                >
                  <Tags size={13} />
                  {nodeVlanMismatch ? "Fix VLAN assignment" : "What-if: Wrong VLAN"}
                </Button>

                <Button onClick={() => deleteNode(node.id)} className="w-full">
                  <Trash2 size={13} /> Delete device
                </Button>
              </>
            )}

            {edge && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold font-mono">{edge.source}</span>
                  <span className="text-text-faint">{"<->"}</span>
                  <span className="text-sm font-semibold font-mono">{edge.target}</span>
                </div>

                <Row label="Latency" value={`${edge.baseLatency} ms`} />
                <Row label="Bandwidth" value={`${edge.bandwidth} Mbps`} />
                <Row label="Link ID" value={edge.id} mono />

                <div className="pt-1">
                  {edgeFailed ? (
                    <StatusLine color="var(--danger)" pulse text="DOWN — failure simulated (what-if)" />
                  ) : edgeAclBlocked ? (
                    <StatusLine color="var(--danger)" pulse text="BLOCKED by ACL policy (what-if)" />
                  ) : edgeMtuMismatch ? (
                    <StatusLine color="var(--orange)" text="MTU mismatch — fragmentation risk (what-if)" />
                  ) : edgeLossOv !== undefined ? (
                    <StatusLine color="var(--orange)" text={`${edgeLossOv}% packet loss (what-if)`} />
                  ) : edgeLatOv !== undefined ? (
                    <StatusLine color="var(--warning)" text={`Latency raised to ${edgeLatOv}ms (what-if)`} />
                  ) : edgeBwOv !== undefined ? (
                    <StatusLine color="var(--orange)" text={`Bandwidth reduced to ${edgeBwOv}Mbps (what-if)`} />
                  ) : analysis.routeEdgeIds.has(edge.id) ? (
                    <StatusLine color="var(--accent-2)" text="On alternative route" />
                  ) : (
                    <StatusLine color="var(--success)" text="UP — operational" />
                  )}
                </div>

                <Button
                  onClick={() => (edgeFailed ? runWhatIf("restore", edge.id) : runWhatIf("link-fail", edge.id))}
                  variant={edgeFailed ? "secondary" : "danger"}
                  className="w-full"
                >
                  {edgeFailed ? <RotateCcw size={13} /> : <ZapOff size={13} />}
                  {edgeFailed ? "Restore link" : "What-if: Fail this link"}
                </Button>

                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    onClick={() =>
                      edgeAclBlocked ? runWhatIf("restore", edge.id) : runWhatIf("acl-block", edge.id)
                    }
                    variant={edgeAclBlocked ? "secondary" : "danger"}
                  >
                    <ShieldOff size={12} /> {edgeAclBlocked ? "Unblock" : "ACL block"}
                  </Button>
                  <Button
                    onClick={() =>
                      edgeMtuMismatch ? runWhatIf("restore", edge.id) : runWhatIf("mtu-mismatch", edge.id)
                    }
                    variant={edgeMtuMismatch ? "secondary" : "danger"}
                  >
                    <Ruler size={12} /> {edgeMtuMismatch ? "Fix MTU" : "MTU mismatch"}
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-text-faint">
                    <span>What-if packet loss</span>
                    <span className="font-mono" style={{ color: "var(--orange)" }}>
                      {edgeLossOv !== undefined ? `${edgeLossOv}%` : "0%"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    defaultValue={edgeLossOv ?? 0}
                    key={`loss-${edge.id}-${edgeLossOv ?? "base"}`}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (v === 0) runWhatIf("restore", edge.id);
                      else runWhatIf("packet-loss", edge.id, v);
                    }}
                    className="w-full accent-[var(--orange)] h-1"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-text-faint">
                    <span>What-if latency</span>
                    <span className="font-mono" style={{ color: "var(--warning)" }}>
                      {edgeLatOv !== undefined ? `${edgeLatOv}ms` : `${edge.baseLatency}ms`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={edge.baseLatency}
                    max={200}
                    step={2}
                    defaultValue={edgeLatOv ?? edge.baseLatency}
                    key={`lat-${edge.id}-${edgeLatOv ?? "base"}`}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (v === edge.baseLatency) runWhatIf("restore", edge.id);
                      else runWhatIf("latency-up", edge.id, v);
                    }}
                    className="w-full accent-[var(--warning)] h-1"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-text-faint">
                    <span>What-if bandwidth</span>
                    <span className="font-mono" style={{ color: "var(--orange)" }}>
                      {edgeBwOv !== undefined ? `${edgeBwOv}Mbps` : `${edge.bandwidth}Mbps`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={edge.bandwidth}
                    step={10}
                    defaultValue={edgeBwOv ?? edge.bandwidth}
                    key={`bw-${edge.id}-${edgeBwOv ?? "base"}`}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (v === edge.bandwidth) runWhatIf("restore", edge.id);
                      else runWhatIf("bandwidth-down", edge.id, v);
                    }}
                    className="w-full accent-[var(--orange)] h-1"
                  />
                </div>

                <Button onClick={() => deleteEdge(edge.id)} className="w-full">
                  <Trash2 size={13} /> Delete link
                </Button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StatusLine({ color, text, pulse }: { color: string; text: string; pulse?: boolean }) {
  return (
    <div className="text-[11px] flex items-center gap-1.5" style={{ color }}>
      <span
        className={`w-1.5 h-1.5 rounded-full ${pulse ? "status-pulse" : ""}`}
        style={{ background: color }}
      />
      {text}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-text-faint">{label}</span>
      <span className={`text-[11px] text-text ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
