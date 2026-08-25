"use client";

import { create } from "zustand";
import {
  NetNode,
  NetEdge,
  AnalysisResult,
  HistoryEntry,
  ChatMessage,
  SimulationConfig,
  NodeKind,
  SimScenarioType,
  NetworkSnapshot,
} from "./types";
import { seedNodes, seedEdges } from "./seed";
import { analyzeNetwork, emptySim } from "./graph";
import { toast } from "./toastStore";

let counter = 0;
function uid(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

// Counters for auto-labeling new nodes
let routerSeq = 5; // seed has R1-R4
let hostSeq = 3; // seed has H1-H2

function nextLabel(kind: NodeKind): string {
  if (kind === "host") return `H${hostSeq++}`;
  return `R${routerSeq++}`;
}

function ipForLabel(label: string, kind: NodeKind): string {
  const num = parseInt(label.replace(/\D/g, ""), 10) || 1;
  if (kind === "host") return `10.0.${num}.10`;
  return `10.0.0.${num}`;
}

// Drop any sim overrides that reference a node/edge no longer in the topology
// (used after deleteNode/deleteEdge so stale ids don't linger forever).
function pruneSim(
  sim: SimulationConfig,
  nextNodes: NetNode[],
  nextEdges: NetEdge[]
): SimulationConfig {
  const nodeIds = new Set(nextNodes.map((n) => n.id));
  const edgeIds = new Set(nextEdges.map((e) => e.id));
  return {
    failedEdgeIds: sim.failedEdgeIds.filter((eid) => edgeIds.has(eid)),
    failedNodeIds: sim.failedNodeIds.filter((nid) => nodeIds.has(nid)),
    latencyOverrides: Object.fromEntries(
      Object.entries(sim.latencyOverrides).filter(([eid]) => edgeIds.has(eid))
    ),
    bandwidthOverrides: Object.fromEntries(
      Object.entries(sim.bandwidthOverrides).filter(([eid]) => edgeIds.has(eid))
    ),
    packetLossOverrides: Object.fromEntries(
      Object.entries(sim.packetLossOverrides).filter(([eid]) => edgeIds.has(eid))
    ),
    mtuMismatchEdgeIds: sim.mtuMismatchEdgeIds.filter((eid) => edgeIds.has(eid)),
    aclBlockEdgeIds: sim.aclBlockEdgeIds.filter((eid) => edgeIds.has(eid)),
    vlanMismatchNodeIds: sim.vlanMismatchNodeIds.filter((nid) => nodeIds.has(nid)),
  };
}

function cloneSim(sim: SimulationConfig): SimulationConfig {
  return {
    failedEdgeIds: [...sim.failedEdgeIds],
    failedNodeIds: [...sim.failedNodeIds],
    latencyOverrides: { ...sim.latencyOverrides },
    bandwidthOverrides: { ...sim.bandwidthOverrides },
    packetLossOverrides: { ...sim.packetLossOverrides },
    mtuMismatchEdgeIds: [...sim.mtuMismatchEdgeIds],
    aclBlockEdgeIds: [...sim.aclBlockEdgeIds],
    vlanMismatchNodeIds: [...sim.vlanMismatchNodeIds],
  };
}

function snapshot(
  nodes: NetNode[],
  edges: NetEdge[],
  sim: SimulationConfig
): NetworkSnapshot {
  return {
    nodes: JSON.parse(JSON.stringify(nodes)) as NetNode[],
    edges: JSON.parse(JSON.stringify(edges)) as NetEdge[],
    simulation: cloneSim(sim),
  };
}

const UNDO_LIMIT = 50;

const initialSim = emptySim();
const initialAnalysis = analyzeNetwork(seedNodes, seedEdges, initialSim);

interface NetTwinState {
  nodes: NetNode[];
  edges: NetEdge[];
  simulation: SimulationConfig;
  analysis: AnalysisResult;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  history: HistoryEntry[];
  chat: ChatMessage[];
  routeEdgeIds: Set<string>;
  routeNodeIds: Set<string>;
  aiAvailable: boolean;
  linkMode: boolean; // when true, dragging from a handle creates a link
  diffVersion: number | null; // selected version to diff against current
  past: NetworkSnapshot[]; // undo stack
  future: NetworkSnapshot[]; // redo stack

  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  setLinkMode: (v: boolean) => void;
  setDiffVersion: (v: number | null) => void;

  // Editable topology
  addNode: (kind: NodeKind, position?: { x: number; y: number }) => string;
  deleteNode: (id: string) => void;
  addEdge: (source: string, target: string, baseLatency?: number, bandwidth?: number) => void;
  deleteEdge: (id: string) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;

  // What-if simulation
  runWhatIf: (type: SimScenarioType, target: string, value?: number) => void;
  setLatencyOverride: (edgeId: string, latency: number) => void;
  setBandwidthOverride: (edgeId: string, bandwidth: number) => void;
  clearWhatIf: () => void;

  // History / versions
  restoreToVersion: (version: number) => void;
  undo: () => void;
  redo: () => void;
  pushChat: (msg: Omit<ChatMessage, "id" | "at">) => void;
  setAiAvailable: (v: boolean) => void;

  // Whole-project load (import / new project) — resets everything, no undo
  loadProject: (nodes: NetNode[], edges: NetEdge[]) => void;
}

function recompute(nodes: NetNode[], edges: NetEdge[], sim: SimulationConfig) {
  return analyzeNetwork(nodes, edges, sim);
}

function makeVersion(history: HistoryEntry[]): number {
  return history.length + 1;
}

// Capture current state onto the undo stack before a mutation is applied,
// and clear the redo stack (standard undo/redo semantics: any new change
// invalidates the redo history).
function captureUndo(get: () => NetTwinState): Pick<NetTwinState, "past" | "future"> {
  const { nodes, edges, simulation, past } = get();
  return {
    past: [...past, snapshot(nodes, edges, simulation)].slice(-UNDO_LIMIT),
    future: [],
  };
}

export const useNetTwin = create<NetTwinState>((set, get) => ({
  nodes: seedNodes,
  edges: seedEdges,
  simulation: initialSim,
  analysis: initialAnalysis,
  selectedNodeId: null,
  selectedEdgeId: null,
  history: [
    {
      id: uid("h"),
      timestamp: Date.now(),
      version: 1,
      action: "Initialized network (6 devices, 6 links)",
      status: "healthy",
      snapshot: snapshot(seedNodes, seedEdges, initialSim),
    },
  ],
  chat: [],
  routeEdgeIds: initialAnalysis.routeEdgeIds,
  routeNodeIds: initialAnalysis.routeNodeIds,
  aiAvailable: true,
  linkMode: false,
  diffVersion: null,
  past: [],
  future: [],

  selectNode: (id) =>
    set((s) => ({ selectedNodeId: id, selectedEdgeId: id ? null : s.selectedEdgeId })),
  selectEdge: (id) =>
    set((s) => ({ selectedEdgeId: id, selectedNodeId: id ? null : s.selectedNodeId })),
  setLinkMode: (v) => set({ linkMode: v }),
  setDiffVersion: (v) => set({ diffVersion: v }),

  addNode: (kind, position) => {
    const label = nextLabel(kind);
    const id = uid("n");
    const node: NetNode = {
      id,
      label,
      kind,
      ip: ipForLabel(label, kind),
      model: kind === "host" ? "App-Server" : "vRouter-2000",
      location: kind === "host" ? "New Tenant" : "Edge / New",
      position: position ?? { x: 200 + Math.random() * 200, y: 200 + Math.random() * 150 },
    };
    const { nodes, edges, simulation, history } = get();
    const nextNodes = [...nodes, node];
    const analysis = recompute(nextNodes, edges, simulation);
    const ver = makeVersion(history);
    set({
      ...captureUndo(get),
      nodes: nextNodes,
      analysis,
      routeEdgeIds: analysis.routeEdgeIds,
      routeNodeIds: analysis.routeNodeIds,
      selectedNodeId: id,
      history: [
        ...history,
        {
          id: uid("h"),
          timestamp: Date.now(),
          version: ver,
          action: `Added ${kind} ${label}`,
          status: analysis.status,
          snapshot: snapshot(nextNodes, edges, simulation),
        },
      ],
    });
    toast.success(`${kind === "host" ? "Host" : "Router"} ${label} added`);
    return id;
  },

  deleteNode: (id) => {
    const { nodes, edges, simulation, history } = get();
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    const nextNodes = nodes.filter((n) => n.id !== id);
    const nextEdges = edges.filter((e) => e.source !== id && e.target !== id);
    const nextSim = pruneSim(simulation, nextNodes, nextEdges);
    const analysis = recompute(nextNodes, nextEdges, nextSim);
    const ver = makeVersion(history);
    set({
      ...captureUndo(get),
      nodes: nextNodes,
      edges: nextEdges,
      simulation: nextSim,
      analysis,
      routeEdgeIds: analysis.routeEdgeIds,
      routeNodeIds: analysis.routeNodeIds,
      selectedNodeId: null,
      history: [
        ...history,
        {
          id: uid("h"),
          timestamp: Date.now(),
          version: ver,
          action: `Deleted ${node.label} and its links`,
          status: analysis.status,
          snapshot: snapshot(nextNodes, nextEdges, nextSim),
        },
      ],
    });
    toast.info(`${node.label} deleted`);
  },

  addEdge: (source, target, baseLatency, bandwidth) => {
    const { nodes, edges, simulation, history } = get();
    if (source === target) return;
    const exists = edges.some(
      (e) =>
        (e.source === source && e.target === target) ||
        (e.source === target && e.target === source)
    );
    if (exists) {
      toast.warning("Link already exists between these devices");
      return;
    }
    const a = nodes.find((n) => n.id === source);
    const b = nodes.find((n) => n.id === target);
    if (!a || !b) return;
    const edge: NetEdge = {
      id: `e-${a.label}-${b.label}-${uid("x").slice(-4)}`,
      source,
      target,
      baseLatency: baseLatency ?? 6,
      bandwidth: bandwidth ?? 1000,
    };
    const nextEdges = [...edges, edge];
    const analysis = recompute(nodes, nextEdges, simulation);
    const ver = makeVersion(history);
    set({
      ...captureUndo(get),
      edges: nextEdges,
      analysis,
      routeEdgeIds: analysis.routeEdgeIds,
      routeNodeIds: analysis.routeNodeIds,
      selectedEdgeId: edge.id,
      history: [
        ...history,
        {
          id: uid("h"),
          timestamp: Date.now(),
          version: ver,
          action: `Added link ${a.label}<->${b.label} (${edge.baseLatency}ms)`,
          status: analysis.status,
          snapshot: snapshot(nodes, nextEdges, simulation),
        },
      ],
    });
    toast.success(`Link ${a.label} ↔ ${b.label} added`);
  },

  deleteEdge: (id) => {
    const { nodes, edges, simulation, history } = get();
    const edge = edges.find((e) => e.id === id);
    if (!edge) return;
    const nextEdges = edges.filter((e) => e.id !== id);
    const nextSim = pruneSim(simulation, nodes, nextEdges);
    const analysis = recompute(nodes, nextEdges, nextSim);
    const ver = makeVersion(history);
    set({
      ...captureUndo(get),
      edges: nextEdges,
      simulation: nextSim,
      analysis,
      routeEdgeIds: analysis.routeEdgeIds,
      routeNodeIds: analysis.routeNodeIds,
      selectedEdgeId: null,
      history: [
        ...history,
        {
          id: uid("h"),
          timestamp: Date.now(),
          version: ver,
          action: `Deleted link ${edge.source}<->${edge.target}`,
          status: analysis.status,
          snapshot: snapshot(nodes, nextEdges, nextSim),
        },
      ],
    });
    toast.info("Link deleted");
  },

  updateNodePosition: (id, position) => {
    set({
      ...captureUndo(get),
      nodes: get().nodes.map((n) => (n.id === id ? { ...n, position } : n)),
    });
  },

  runWhatIf: (type, target, value) => {
    const { nodes, edges, simulation, history } = get();
    const nextSim: SimulationConfig = cloneSim(simulation);
    let action = "";
    if (type === "link-fail") {
      if (!nextSim.failedEdgeIds.includes(target)) nextSim.failedEdgeIds.push(target);
      const e = edges.find((x) => x.id === target);
      action = `What-if: link ${e ? `${e.source}<->${e.target}` : target} FAILED`;
    } else if (type === "router-fail") {
      if (!nextSim.failedNodeIds.includes(target)) nextSim.failedNodeIds.push(target);
      const n = nodes.find((x) => x.id === target);
      action = `What-if: ${n ? n.label : target} FAILED (all links isolated)`;
    } else if (type === "latency-up") {
      if (typeof value === "number") nextSim.latencyOverrides[target] = value;
      const e = edges.find((x) => x.id === target);
      action = `What-if: latency on ${e ? `${e.source}<->${e.target}` : target} -> ${value}ms`;
    } else if (type === "bandwidth-down") {
      if (typeof value === "number") nextSim.bandwidthOverrides[target] = value;
      const e = edges.find((x) => x.id === target);
      action = `What-if: bandwidth on ${e ? `${e.source}<->${e.target}` : target} -> ${value}Mbps`;
    } else if (type === "packet-loss") {
      if (typeof value === "number") nextSim.packetLossOverrides[target] = value;
      const e = edges.find((x) => x.id === target);
      action = `What-if: packet loss on ${e ? `${e.source}<->${e.target}` : target} -> ${value}%`;
    } else if (type === "mtu-mismatch") {
      if (!nextSim.mtuMismatchEdgeIds.includes(target)) nextSim.mtuMismatchEdgeIds.push(target);
      const e = edges.find((x) => x.id === target);
      action = `What-if: MTU mismatch on ${e ? `${e.source}<->${e.target}` : target}`;
    } else if (type === "acl-block") {
      if (!nextSim.aclBlockEdgeIds.includes(target)) nextSim.aclBlockEdgeIds.push(target);
      const e = edges.find((x) => x.id === target);
      action = `What-if: ACL blocked ${e ? `${e.source}<->${e.target}` : target}`;
    } else if (type === "vlan-mismatch") {
      if (!nextSim.vlanMismatchNodeIds.includes(target)) nextSim.vlanMismatchNodeIds.push(target);
      const n = nodes.find((x) => x.id === target);
      action = `What-if: ${n ? n.label : target} put on wrong VLAN`;
    } else if (type === "restore") {
      nextSim.failedEdgeIds = nextSim.failedEdgeIds.filter((x) => x !== target);
      nextSim.failedNodeIds = nextSim.failedNodeIds.filter((x) => x !== target);
      nextSim.mtuMismatchEdgeIds = nextSim.mtuMismatchEdgeIds.filter((x) => x !== target);
      nextSim.aclBlockEdgeIds = nextSim.aclBlockEdgeIds.filter((x) => x !== target);
      nextSim.vlanMismatchNodeIds = nextSim.vlanMismatchNodeIds.filter((x) => x !== target);
      delete nextSim.latencyOverrides[target];
      delete nextSim.bandwidthOverrides[target];
      delete nextSim.packetLossOverrides[target];
      const e = edges.find((x) => x.id === target);
      const n = nodes.find((x) => x.id === target);
      action = `Restored ${e ? `link ${e.source}<->${e.target}` : n ? n.label : target}`;
    }
    const analysis = recompute(nodes, edges, nextSim);
    const ver = makeVersion(history);
    set({
      ...captureUndo(get),
      simulation: nextSim,
      analysis,
      routeEdgeIds: analysis.routeEdgeIds,
      routeNodeIds: analysis.routeNodeIds,
      history: [
        ...history,
        {
          id: uid("h"),
          timestamp: Date.now(),
          version: ver,
          action,
          status: analysis.status,
          snapshot: snapshot(nodes, edges, nextSim),
        },
      ],
    });
    if (type === "restore") toast.success(action);
    else if (analysis.status === "partitioned") toast.danger("Network partitioned", action);
    else toast.warning("What-if simulation running", action);
  },

  setLatencyOverride: (edgeId, latency) => {
    get().runWhatIf("latency-up", edgeId, latency);
  },

  setBandwidthOverride: (edgeId, bandwidth) => {
    get().runWhatIf("bandwidth-down", edgeId, bandwidth);
  },

  clearWhatIf: () => {
    const { nodes, edges, history } = get();
    const nextSim = emptySim();
    const analysis = recompute(nodes, edges, nextSim);
    const ver = makeVersion(history);
    set({
      ...captureUndo(get),
      simulation: nextSim,
      analysis,
      routeEdgeIds: analysis.routeEdgeIds,
      routeNodeIds: analysis.routeNodeIds,
      history: [
        ...history,
        {
          id: uid("h"),
          timestamp: Date.now(),
          version: ver,
          action: "Cleared all what-if simulations — network restored",
          status: analysis.status,
          snapshot: snapshot(nodes, edges, nextSim),
        },
      ],
    });
    toast.success("Network restored to normal");
  },

  restoreToVersion: (version) => {
    const { history } = get();
    const entry = history.find((h) => h.version === version);
    if (!entry) return;
    const snap = entry.snapshot;
    const analysis = recompute(snap.nodes, snap.edges, snap.simulation);
    const ver = makeVersion(history);
    set({
      ...captureUndo(get),
      nodes: JSON.parse(JSON.stringify(snap.nodes)) as NetNode[],
      edges: JSON.parse(JSON.stringify(snap.edges)) as NetEdge[],
      simulation: cloneSim(snap.simulation),
      analysis,
      routeEdgeIds: analysis.routeEdgeIds,
      routeNodeIds: analysis.routeNodeIds,
      selectedNodeId: null,
      selectedEdgeId: null,
      diffVersion: null,
      history: [
        ...history,
        {
          id: uid("h"),
          timestamp: Date.now(),
          version: ver,
          action: `Restored network to v${version} — "${entry.action}"`,
          status: analysis.status,
          snapshot: snapshot(snap.nodes, snap.edges, snap.simulation),
        },
      ],
    });
    toast.success(`Restored to v${version}`);
  },

  undo: () => {
    const { past, future, nodes, edges, simulation, history } = get();
    if (past.length === 0) return;
    const target = past[past.length - 1];
    const currentSnap = snapshot(nodes, edges, simulation);
    const analysis = recompute(target.nodes, target.edges, target.simulation);
    const ver = makeVersion(history);
    set({
      nodes: JSON.parse(JSON.stringify(target.nodes)) as NetNode[],
      edges: JSON.parse(JSON.stringify(target.edges)) as NetEdge[],
      simulation: cloneSim(target.simulation),
      analysis,
      routeEdgeIds: analysis.routeEdgeIds,
      routeNodeIds: analysis.routeNodeIds,
      selectedNodeId: null,
      selectedEdgeId: null,
      past: past.slice(0, -1),
      future: [...future, currentSnap].slice(-UNDO_LIMIT),
      history: [
        ...history,
        {
          id: uid("h"),
          timestamp: Date.now(),
          version: ver,
          action: "Undo",
          status: analysis.status,
          snapshot: snapshot(target.nodes, target.edges, target.simulation),
        },
      ],
    });
  },

  redo: () => {
    const { past, future, nodes, edges, simulation, history } = get();
    if (future.length === 0) return;
    const target = future[future.length - 1];
    const currentSnap = snapshot(nodes, edges, simulation);
    const analysis = recompute(target.nodes, target.edges, target.simulation);
    const ver = makeVersion(history);
    set({
      nodes: JSON.parse(JSON.stringify(target.nodes)) as NetNode[],
      edges: JSON.parse(JSON.stringify(target.edges)) as NetEdge[],
      simulation: cloneSim(target.simulation),
      analysis,
      routeEdgeIds: analysis.routeEdgeIds,
      routeNodeIds: analysis.routeNodeIds,
      selectedNodeId: null,
      selectedEdgeId: null,
      future: future.slice(0, -1),
      past: [...past, currentSnap].slice(-UNDO_LIMIT),
      history: [
        ...history,
        {
          id: uid("h"),
          timestamp: Date.now(),
          version: ver,
          action: "Redo",
          status: analysis.status,
          snapshot: snapshot(target.nodes, target.edges, target.simulation),
        },
      ],
    });
  },

  pushChat: (msg) =>
    set((s) => ({
      chat: [...s.chat, { ...msg, id: uid("m"), at: Date.now() }],
    })),

  setAiAvailable: (v) => set({ aiAvailable: v }),

  loadProject: (nodes, edges) => {
    const sim = emptySim();
    const analysis = recompute(nodes, edges, sim);
    set({
      nodes,
      edges,
      simulation: sim,
      analysis,
      routeEdgeIds: analysis.routeEdgeIds,
      routeNodeIds: analysis.routeNodeIds,
      selectedNodeId: null,
      selectedEdgeId: null,
      diffVersion: null,
      past: [],
      future: [],
      chat: [],
      history: [
        {
          id: uid("h"),
          timestamp: Date.now(),
          version: 1,
          action: `Loaded project (${nodes.length} devices, ${edges.length} links)`,
          status: analysis.status,
          snapshot: snapshot(nodes, edges, sim),
        },
      ],
    });
    toast.success("Project loaded");
  },
}));
