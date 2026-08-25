import { NetNode, NetEdge, Route, AnalysisResult, SimulationStatus, SimulationConfig, RiskLevel, SimScenarioEntry } from "./types";

// Build adjacency from nodes/edges honoring simulation overrides.
// - failedEdgeIds: links removed from graph
// - failedNodeIds: nodes removed from graph (and all their incident links)
// - latencyOverrides: replace an edge's latency
export function buildAdjacency(
  nodes: NetNode[],
  edges: NetEdge[],
  sim: SimulationConfig
): Map<string, { to: string; latency: number; edgeId: string }[]> {
  // ACL blocks and VLAN mismatches remove connectivity the same way a
  // physical failure does — they're just a different root cause for display.
  const failedSet = new Set([...sim.failedEdgeIds, ...sim.aclBlockEdgeIds]);
  const failedNodeSet = new Set([...sim.failedNodeIds, ...sim.vlanMismatchNodeIds]);
  const adj = new Map<string, { to: string; latency: number; edgeId: string }[]>();
  for (const n of nodes) {
    if (failedNodeSet.has(n.id)) continue; // failed nodes are not in the graph
    adj.set(n.id, []);
  }
  for (const e of edges) {
    if (failedSet.has(e.id)) continue;
    if (failedNodeSet.has(e.source) || failedNodeSet.has(e.target)) continue;
    const lat = sim.latencyOverrides[e.id] ?? e.baseLatency;
    adj.get(e.source)!.push({ to: e.target, latency: lat, edgeId: e.id });
    adj.get(e.target)!.push({ to: e.source, latency: lat, edgeId: e.id });
  }
  return adj;
}

// Back-compat overload: accept failedEdgeIds array (legacy callers)
export function buildAdjacencyLegacy(
  nodes: NetNode[],
  edges: NetEdge[],
  failedEdgeIds: string[]
): Map<string, { to: string; latency: number; edgeId: string }[]> {
  return buildAdjacency(nodes, edges, {
    failedEdgeIds,
    failedNodeIds: [],
    latencyOverrides: {},
    bandwidthOverrides: {},
    packetLossOverrides: {},
    mtuMismatchEdgeIds: [],
    aclBlockEdgeIds: [],
    vlanMismatchNodeIds: [],
  });
}

export function bfs(
  start: string,
  adj: Map<string, { to: string; latency: number; edgeId: string }[]>
): Set<string> {
  const visited = new Set<string>([start]);
  const queue: string[] = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const nb of adj.get(cur) ?? []) {
      if (!visited.has(nb.to)) {
        visited.add(nb.to);
        queue.push(nb.to);
      }
    }
  }
  return visited;
}

// Dijkstra: lowest-latency path from start to target
export function dijkstra(
  start: string,
  target: string,
  adj: Map<string, { to: string; latency: number; edgeId: string }[]>
): Route | null {
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const prevEdge = new Map<string, string | null>();
  const visited = new Set<string>();
  for (const key of adj.keys()) {
    dist.set(key, Infinity);
    prev.set(key, null);
    prevEdge.set(key, null);
  }
  dist.set(start, 0);

  // simple priority via array scan (network is tiny)
  while (visited.size < adj.size) {
    let u: string | null = null;
    let best = Infinity;
    for (const [k, d] of dist) {
      if (!visited.has(k) && d < best) {
        best = d;
        u = k;
      }
    }
    if (u === null || best === Infinity) break;
    if (u === target) break;
    visited.add(u);
    for (const nb of adj.get(u) ?? []) {
      if (visited.has(nb.to)) continue;
      const alt = dist.get(u)! + nb.latency;
      if (alt < dist.get(nb.to)!) {
        dist.set(nb.to, alt);
        prev.set(nb.to, u);
        prevEdge.set(nb.to, nb.edgeId);
      }
    }
  }

  if (dist.get(target) === Infinity) return null; // unreachable

  // reconstruct path
  const path: string[] = [];
  let cur: string | null = target;
  while (cur) {
    path.unshift(cur);
    cur = prev.get(cur) ?? null;
  }
  return { path, latency: dist.get(target)! };
}

// Find the edge id connecting two nodes (either direction)
function edgeBetween(
  edges: NetEdge[],
  a: string,
  b: string
): NetEdge | undefined {
  return edges.find(
    (e) => (e.source === a && e.target === b) || (e.source === b && e.target === a)
  );
}

// Collect edge ids along a node path
function edgesAlongPath(edges: NetEdge[], path: string[]): string[] {
  const ids: string[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const e = edgeBetween(edges, path[i], path[i + 1]);
    if (e) ids.push(e.id);
  }
  return ids;
}

// Connected components over the (failure-aware) adjacency
function connectedComponents(
  nodes: NetNode[],
  adj: Map<string, { to: string; latency: number; edgeId: string }[]>
): Set<string>[] {
  const seen = new Set<string>();
  const comps: Set<string>[] = [];
  for (const n of nodes) {
    if (seen.has(n.id)) continue;
    if (!adj.has(n.id)) {
      // failed node — its own component of one (itself)
      seen.add(n.id);
      comps.push(new Set([n.id]));
      continue;
    }
    const comp = bfs(n.id, adj);
    for (const id of comp) seen.add(id);
    comps.push(comp);
  }
  return comps;
}

// Compute a risk level from the analysis state.
// Factors: partition (critical), isolated devices (high), extra latency (medium),
// heavy packet loss (high/medium), latency/bw/mtu degradation (low/medium).
function computeRisk(
  status: SimulationStatus,
  unreachableCount: number,
  extraLatency: number | null,
  degradedLinkCount: number,
  maxPacketLoss = 0
): RiskLevel {
  if (status === "partitioned") {
    if (unreachableCount >= 2) return "critical";
    return "high";
  }
  if (unreachableCount > 0) return "high";
  if (maxPacketLoss >= 20) return "high";
  if (maxPacketLoss >= 5) return "medium";
  if (extraLatency !== null && extraLatency > 0) {
    if (extraLatency >= 20) return "medium";
    return "low";
  }
  if (degradedLinkCount > 0) return "medium";
  return "low";
}

export function emptySim(): SimulationConfig {
  return {
    failedEdgeIds: [],
    failedNodeIds: [],
    latencyOverrides: {},
    bandwidthOverrides: {},
    packetLossOverrides: {},
    mtuMismatchEdgeIds: [],
    aclBlockEdgeIds: [],
    vlanMismatchNodeIds: [],
  };
}

// Main analysis. Accepts a full SimulationConfig (router failures, latency/bw overrides, link failures).
export function analyzeNetwork(
  nodes: NetNode[],
  edges: NetEdge[],
  sim: SimulationConfig
): AnalysisResult {
  const adj = buildAdjacency(nodes, edges, sim);

  let status: SimulationStatus = "healthy";
  let alternativeRoute: Route | null = null;
  let affectedDevices: string[] = [];
  let extraLatency: number | null = null;
  let failedEdgeLatency: number | null = null;
  let routeEdgeIds = new Set<string>();
  let routeNodeIds = new Set<string>();
  const scenarios: SimScenarioEntry[] = [];

  const hasFailure =
    sim.failedEdgeIds.length > 0 ||
    sim.failedNodeIds.length > 0 ||
    Object.keys(sim.latencyOverrides).length > 0 ||
    Object.keys(sim.bandwidthOverrides).length > 0 ||
    Object.keys(sim.packetLossOverrides).length > 0 ||
    sim.mtuMismatchEdgeIds.length > 0 ||
    sim.aclBlockEdgeIds.length > 0 ||
    sim.vlanMismatchNodeIds.length > 0;

  // Build scenario entries for display + AI context
  for (const eid of sim.failedEdgeIds) {
    const e = edges.find((x) => x.id === eid);
    scenarios.push({
      type: "link-fail",
      target: eid,
      detail: e ? `${e.source}<->${e.target} (${e.baseLatency}ms DOWN)` : eid,
    });
  }
  for (const nid of sim.failedNodeIds) {
    const n = nodes.find((x) => x.id === nid);
    scenarios.push({
      type: "router-fail",
      target: nid,
      detail: n ? `${n.label} (${n.kind}) FAILED — all links isolated` : nid,
    });
  }
  for (const [eid, lat] of Object.entries(sim.latencyOverrides)) {
    const e = edges.find((x) => x.id === eid);
    scenarios.push({
      type: "latency-up",
      target: eid,
      detail: e ? `${e.source}<->${e.target}: ${e.baseLatency}ms -> ${lat}ms` : `${eid}: -> ${lat}ms`,
    });
  }
  for (const [eid, bw] of Object.entries(sim.bandwidthOverrides)) {
    const e = edges.find((x) => x.id === eid);
    scenarios.push({
      type: "bandwidth-down",
      target: eid,
      detail: e ? `${e.source}<->${e.target}: ${e.bandwidth}Mbps -> ${bw}Mbps` : `${eid}: -> ${bw}Mbps`,
    });
  }
  for (const [eid, loss] of Object.entries(sim.packetLossOverrides)) {
    const e = edges.find((x) => x.id === eid);
    scenarios.push({
      type: "packet-loss",
      target: eid,
      detail: e ? `${e.source}<->${e.target}: ${loss}% packet loss` : `${eid}: ${loss}% packet loss`,
    });
  }
  for (const eid of sim.mtuMismatchEdgeIds) {
    const e = edges.find((x) => x.id === eid);
    scenarios.push({
      type: "mtu-mismatch",
      target: eid,
      detail: e ? `${e.source}<->${e.target}: MTU mismatch (fragmentation risk)` : eid,
    });
  }
  for (const eid of sim.aclBlockEdgeIds) {
    const e = edges.find((x) => x.id === eid);
    scenarios.push({
      type: "acl-block",
      target: eid,
      detail: e ? `${e.source}<->${e.target} BLOCKED by ACL policy` : eid,
    });
  }
  for (const nid of sim.vlanMismatchNodeIds) {
    const n = nodes.find((x) => x.id === nid);
    scenarios.push({
      type: "vlan-mismatch",
      target: nid,
      detail: n ? `${n.label} on wrong VLAN — isolated from its segment` : nid,
    });
  }

  // Affected links = failed/blocked + degraded (latency/bw/loss/mtu changed)
  const affectedLinks: string[] = [
    ...sim.failedEdgeIds,
    ...sim.aclBlockEdgeIds,
    ...Object.keys(sim.latencyOverrides),
    ...Object.keys(sim.bandwidthOverrides),
    ...Object.keys(sim.packetLossOverrides),
    ...sim.mtuMismatchEdgeIds,
  ];

  const degradedLinkCount =
    Object.keys(sim.latencyOverrides).length +
    Object.keys(sim.bandwidthOverrides).length +
    Object.keys(sim.packetLossOverrides).length +
    sim.mtuMismatchEdgeIds.length;

  // Worst active packet-loss %, used as a risk input independent of reachability.
  const maxPacketLoss =
    Object.values(sim.packetLossOverrides).length > 0
      ? Math.max(...Object.values(sim.packetLossOverrides))
      : 0;

  if (!hasFailure) {
    const comps0 = connectedComponents(nodes, adj);
    const largest0 = comps0.reduce((a, b) => (b.size > a.size ? b : a), comps0[0]);
    return {
      status: "healthy",
      failedEdgeIds: [],
      failedNodeIds: [],
      alternativeRoute: null,
      affectedDevices: [],
      affectedLinks: [],
      extraLatency: null,
      failedEdgeLatency: null,
      routeEdgeIds,
      routeNodeIds,
      risk: "low",
      reachableCount: largest0.size,
      unreachableCount: 0,
      scenarios: [],
    };
  }

  // Compute connected components to detect partitions / isolated devices
  const comps = connectedComponents(nodes, adj);
  const largest = comps.reduce((a, b) => (b.size > a.size ? b : a), comps[0]);
  affectedDevices = nodes
    .filter((n) => !largest.has(n.id))
    .map((n) => n.id)
    .sort();

  const unreachableCount = affectedDevices.length;
  const reachableCount = largest.size;

  // Determine status: partitioned if more than one real component (excluding
  // pure single failed-node self-components that don't break others — but a
  // failed router that had links DOES break the graph).
  // We treat partitioned when ANY non-largest component contains a non-failed
  // node (i.e. a live node got isolated).
  const selfIsolating = new Set([...sim.failedNodeIds, ...sim.vlanMismatchNodeIds]);
  const liveIsolated = affectedDevices.filter((id) => !selfIsolating.has(id));
  if (comps.length > 1 && liveIsolated.length > 0) {
    status = "partitioned";
  } else if (
    sim.failedEdgeIds.length > 0 ||
    sim.failedNodeIds.length > 0 ||
    sim.aclBlockEdgeIds.length > 0 ||
    sim.vlanMismatchNodeIds.length > 0 ||
    degradedLinkCount > 0
  ) {
    status = "degraded";
  }

  // For the first failed EDGE, try to find an alternative route.
  // (Router failures + latency/bw-only changes: route is the lowest-latency
  // path across the whole graph between the two most distant live nodes —
  // but for display we focus on the first failed edge if present.)
  if (sim.failedEdgeIds.length > 0 || sim.aclBlockEdgeIds.length > 0) {
    const fe = edges.find(
      (e) => e.id === sim.failedEdgeIds[0] || e.id === sim.aclBlockEdgeIds[0]
    )!;
    const route = dijkstra(fe.source, fe.target, adj);
    alternativeRoute = route;
    failedEdgeLatency = fe.baseLatency;
    extraLatency = route ? route.latency - fe.baseLatency : null;
    if (route) {
      routeEdgeIds = new Set(edgesAlongPath(edges, route.path));
      routeNodeIds = new Set(route.path);
    }
  } else if (Object.keys(sim.latencyOverrides).length > 0) {
    // Latency change: show new shortest route between the endpoints of the
    // modified link (which now uses the new latency) so the user sees impact.
    const eid = Object.keys(sim.latencyOverrides)[0];
    const e = edges.find((x) => x.id === eid);
    if (e) {
      const route = dijkstra(e.source, e.target, adj);
      alternativeRoute = route;
      failedEdgeLatency = e.baseLatency;
      extraLatency = route ? route.latency - e.baseLatency : null;
      if (route) {
        routeEdgeIds = new Set(edgesAlongPath(edges, route.path));
        routeNodeIds = new Set(route.path);
      }
    }
  }

  const risk = computeRisk(status, unreachableCount, extraLatency, degradedLinkCount, maxPacketLoss);

  return {
    status,
    // Merged with ACL blocks / VLAN mismatches: both remove connectivity the
    // same way a physical failure does, so the UI's "is this down" checks
    // (red styling, DOWN badges) treat them the same. The scenario list above
    // still carries the distinct root cause for the banner/AI narrative.
    failedEdgeIds: [...sim.failedEdgeIds, ...sim.aclBlockEdgeIds],
    failedNodeIds: [...sim.failedNodeIds, ...sim.vlanMismatchNodeIds],
    alternativeRoute,
    affectedDevices,
    affectedLinks,
    extraLatency,
    failedEdgeLatency,
    routeEdgeIds,
    routeNodeIds,
    risk,
    reachableCount,
    unreachableCount,
    scenarios,
  };
}

// ---- Structural resilience: articulation points & bridges (Tarjan) ----
// Runs on the FULL topology (no sim overrides) — this answers "what is a
// single point of failure in this design", independent of any active what-if.
export interface CriticalityResult {
  articulationPoints: string[]; // node ids whose removal would partition the graph
  bridges: string[]; // edge ids whose removal would partition the graph
}

export function findCriticalPoints(nodes: NetNode[], edges: NetEdge[]): CriticalityResult {
  const adj = new Map<string, { to: string; edgeId: string }[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    adj.get(e.source)?.push({ to: e.target, edgeId: e.id });
    adj.get(e.target)?.push({ to: e.source, edgeId: e.id });
  }

  const disc = new Map<string, number>();
  const low = new Map<string, number>();
  const articulation = new Set<string>();
  const bridges = new Set<string>();
  let timer = 0;

  function dfs(root: string) {
    // iterative DFS (explicit stack) to avoid recursion-depth issues on large graphs
    type Frame = { u: string; parentEdge: string | null; iter: number; children: number };
    const stack: Frame[] = [{ u: root, parentEdge: null, iter: 0, children: 0 }];
    disc.set(root, timer);
    low.set(root, timer);
    timer++;

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const neighbors = adj.get(frame.u) ?? [];
      if (frame.iter < neighbors.length) {
        const { to: v, edgeId } = neighbors[frame.iter];
        frame.iter++;
        if (edgeId === frame.parentEdge) continue;
        if (disc.has(v)) {
          low.set(frame.u, Math.min(low.get(frame.u)!, disc.get(v)!));
        } else {
          frame.children++;
          disc.set(v, timer);
          low.set(v, timer);
          timer++;
          stack.push({ u: v, parentEdge: edgeId, iter: 0, children: 0 });
        }
      } else {
        stack.pop();
        const parent = stack[stack.length - 1];
        if (!parent) continue;
        low.set(parent.u, Math.min(low.get(parent.u)!, low.get(frame.u)!));
        if (low.get(frame.u)! > disc.get(parent.u)!) {
          bridges.add(frame.parentEdge!);
        }
        if (parent.parentEdge !== null && low.get(frame.u)! >= disc.get(parent.u)!) {
          articulation.add(parent.u);
        }
        if (parent.parentEdge === null && parent.children > 1) {
          articulation.add(parent.u);
        }
      }
    }
  }

  for (const n of nodes) {
    if (!disc.has(n.id)) dfs(n.id);
  }

  return { articulationPoints: [...articulation], bridges: [...bridges] };
}

// Convenience: analyze using only failedEdgeIds (legacy link-failure path)
export function analyzeLinkFailure(
  nodes: NetNode[],
  edges: NetEdge[],
  failedEdgeIds: string[]
): AnalysisResult {
  return analyzeNetwork(nodes, edges, { ...emptySim(), failedEdgeIds });
}
