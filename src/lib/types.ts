export type NodeKind = "router" | "host" | "switch";

export interface NetNode {
  id: string;
  label: string;
  kind: NodeKind;
  ip: string;
  model: string;
  location: string;
  position: { x: number; y: number };
}

export interface NetEdge {
  id: string;
  source: string;
  target: string;
  baseLatency: number; // ms
  bandwidth: number; // Mbps
}

export interface Route {
  path: string[];      // ordered node ids
  latency: number;     // total ms along path
}

export type SimulationStatus = "healthy" | "degraded" | "partitioned";

export type RiskLevel = "low" | "medium" | "high" | "critical";

// ---- What-If simulation scenarios ----
// A single "what-if" can combine multiple overrides at once
// (e.g. one router failed + one link with high latency).
export interface SimulationConfig {
  failedEdgeIds: string[];       // links taken DOWN
  failedNodeIds: string[];       // routers/hosts failed (isolates all their links)
  latencyOverrides: Record<string, number>;  // edgeId -> new latency (ms)
  bandwidthOverrides: Record<string, number>; // edgeId -> new bandwidth (Mbps)
  packetLossOverrides: Record<string, number>; // edgeId -> loss % (0-100); degrades quality, doesn't break reachability
  mtuMismatchEdgeIds: string[];   // links with an MTU mismatch (fragmentation/black-holing risk)
  aclBlockEdgeIds: string[];      // links administratively blocked by policy (excluded from routing, like a failed link)
  vlanMismatchNodeIds: string[];  // devices on the wrong VLAN (isolated from their segment, like a failed device)
}

export type SimScenarioType =
  | "link-fail"
  | "router-fail"
  | "latency-up"
  | "bandwidth-down"
  | "packet-loss"
  | "mtu-mismatch"
  | "acl-block"
  | "vlan-mismatch"
  | "restore";

export interface SimScenarioEntry {
  type: SimScenarioType;
  target: string;   // edgeId or nodeId depending on type
  detail: string;   // human-readable detail e.g. "8ms -> 100ms"
}

export interface AnalysisResult {
  status: SimulationStatus;
  failedEdgeIds: string[];        // edges currently treated as DOWN (incl. those isolated by failed nodes)
  failedNodeIds: string[];        // nodes currently failed
  alternativeRoute: Route | null;     // lowest-latency path between first failed-edge endpoints (excluding failed links)
  affectedDevices: string[];          // node ids that are isolated/unreachable
  affectedLinks: string[];            // edge ids that are DOWN or degraded (latency/bw changed)
  extraLatency: number | null;        // alternativeRoute.latency - failedEdge.baseLatency
  failedEdgeLatency: number | null;   // base latency of the failed edge (for comparison)
  routeEdgeIds: Set<string>;          // edge ids along the alternative route (for highlighting)
  routeNodeIds: Set<string>;          // node ids along the alternative route (for highlighting)
  risk: RiskLevel;                    // computed risk level
  reachableCount: number;             // count of devices reachable from the largest component
  unreachableCount: number;           // count of devices NOT reachable
  scenarios: SimScenarioEntry[];      // active what-if scenarios (for display + AI context)
}

// ---- Versioned history with snapshots ----
export interface NetworkSnapshot {
  nodes: NetNode[];
  edges: NetEdge[];
  simulation: SimulationConfig;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  version: number;            // version number (v1, v2, ...)
  action: string;             // human-readable description
  status: SimulationStatus;
  snapshot: NetworkSnapshot;  // full topology + sim state at this point
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: number;
  offline?: boolean;
}
