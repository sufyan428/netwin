import { describe, it, expect } from "vitest";
import {
  bfs,
  dijkstra,
  buildAdjacency,
  analyzeNetwork,
  emptySim,
  findCriticalPoints,
} from "./graph";
import { NetNode, NetEdge, SimulationConfig } from "./types";

// A small diamond: R1 -- R2 -- R4
//                    \-- R3 --/
// with H1 hanging off R1 (a leaf, so R1 is an articulation point).
const nodes: NetNode[] = [
  { id: "R1", label: "R1", kind: "router", ip: "10.0.0.1", model: "m", location: "l", position: { x: 0, y: 0 } },
  { id: "R2", label: "R2", kind: "router", ip: "10.0.0.2", model: "m", location: "l", position: { x: 0, y: 0 } },
  { id: "R3", label: "R3", kind: "router", ip: "10.0.0.3", model: "m", location: "l", position: { x: 0, y: 0 } },
  { id: "R4", label: "R4", kind: "router", ip: "10.0.0.4", model: "m", location: "l", position: { x: 0, y: 0 } },
  { id: "H1", label: "H1", kind: "host", ip: "10.0.1.10", model: "m", location: "l", position: { x: 0, y: 0 } },
];

const edges: NetEdge[] = [
  { id: "e-R1-R2", source: "R1", target: "R2", baseLatency: 4, bandwidth: 1000 },
  { id: "e-R1-R3", source: "R1", target: "R3", baseLatency: 5, bandwidth: 1000 },
  { id: "e-R2-R4", source: "R2", target: "R4", baseLatency: 8, bandwidth: 1000 },
  { id: "e-R3-R4", source: "R3", target: "R4", baseLatency: 10, bandwidth: 1000 },
  { id: "e-R1-H1", source: "R1", target: "H1", baseLatency: 2, bandwidth: 1000 },
];

function sim(overrides: Partial<SimulationConfig> = {}): SimulationConfig {
  return { ...emptySim(), ...overrides };
}

describe("bfs", () => {
  it("visits every reachable node", () => {
    const adj = buildAdjacency(nodes, edges, emptySim());
    const visited = bfs("R1", adj);
    expect(visited).toEqual(new Set(["R1", "R2", "R3", "R4", "H1"]));
  });

  it("stops at a removed edge", () => {
    const adj = buildAdjacency(nodes, edges, sim({ failedEdgeIds: ["e-R1-H1"] }));
    const visited = bfs("R1", adj);
    expect(visited.has("H1")).toBe(false);
  });
});

describe("dijkstra", () => {
  it("finds the lowest-latency path", () => {
    const adj = buildAdjacency(nodes, edges, emptySim());
    const route = dijkstra("R1", "R4", adj);
    expect(route).not.toBeNull();
    // R1-R2-R4 = 4+8=12 vs R1-R3-R4 = 5+10=15 -> should pick the R2 path
    expect(route!.path).toEqual(["R1", "R2", "R4"]);
    expect(route!.latency).toBe(12);
  });

  it("reroutes around a failed edge", () => {
    const adj = buildAdjacency(nodes, edges, sim({ failedEdgeIds: ["e-R2-R4"] }));
    const route = dijkstra("R1", "R4", adj);
    expect(route!.path).toEqual(["R1", "R3", "R4"]);
    expect(route!.latency).toBe(15);
  });

  it("returns null when unreachable", () => {
    const adj = buildAdjacency(nodes, edges, sim({ failedNodeIds: ["R1"] }));
    const route = dijkstra("H1", "R4", adj);
    expect(route).toBeNull();
  });
});

describe("analyzeNetwork", () => {
  it("reports healthy with no active scenario", () => {
    const result = analyzeNetwork(nodes, edges, emptySim());
    expect(result.status).toBe("healthy");
    expect(result.risk).toBe("low");
    expect(result.unreachableCount).toBe(0);
    expect(result.scenarios).toHaveLength(0);
  });

  it("degrades (not partitions) on a redundant link failure", () => {
    const result = analyzeNetwork(nodes, edges, sim({ failedEdgeIds: ["e-R2-R4"] }));
    expect(result.status).toBe("degraded");
    expect(result.unreachableCount).toBe(0);
    // dijkstra runs between the failed edge's own endpoints (R2 -> R4)
    expect(result.alternativeRoute?.path).toEqual(["R2", "R1", "R3", "R4"]);
    expect(result.alternativeRoute?.latency).toBe(19); // 4 + 5 + 10
    expect(result.extraLatency).toBe(19 - 8);
  });

  it("partitions when a leaf link fails", () => {
    const result = analyzeNetwork(nodes, edges, sim({ failedEdgeIds: ["e-R1-H1"] }));
    expect(result.status).toBe("partitioned");
    expect(result.affectedDevices).toEqual(["H1"]);
    expect(result.risk).toBe("high"); // 1 unreachable device -> high, not critical
  });

  it("escalates to critical when a failure isolates 2+ live devices", () => {
    // Failing R1 isolates H1, and R1 itself also drops out of the largest
    // component (unreachableCount counts every node outside the largest
    // component, including the failed node) — but "partitioned" status is
    // driven by *live* isolated devices, so add H2 to be unambiguous.
    const withH2: NetNode[] = [
      ...nodes,
      { id: "H2", label: "H2", kind: "host", ip: "10.0.1.11", model: "m", location: "l", position: { x: 0, y: 0 } },
    ];
    const withH2Edges: NetEdge[] = [
      ...edges,
      { id: "e-R1-H2", source: "R1", target: "H2", baseLatency: 2, bandwidth: 1000 },
    ];
    const result = analyzeNetwork(withH2, withH2Edges, sim({ failedNodeIds: ["R1"] }));
    expect(result.status).toBe("partitioned");
    expect(result.affectedDevices.sort()).toEqual(["H1", "H2", "R1"]);
    expect(result.unreachableCount).toBe(3); // H1, H2, and R1 itself (outside the largest component)
    expect(result.risk).toBe("critical");
  });

  it("packet loss degrades status and risk without breaking reachability", () => {
    const result = analyzeNetwork(nodes, edges, sim({ packetLossOverrides: { "e-R1-R2": 30 } }));
    expect(result.status).toBe("degraded");
    expect(result.unreachableCount).toBe(0);
    expect(result.risk).toBe("high"); // >= 20% loss
    expect(result.scenarios[0].type).toBe("packet-loss");
  });

  it("ACL block removes connectivity and computes a reroute like a link failure", () => {
    const result = analyzeNetwork(nodes, edges, sim({ aclBlockEdgeIds: ["e-R2-R4"] }));
    expect(result.status).toBe("degraded");
    expect(result.unreachableCount).toBe(0); // R2 still reachable via R1 -> R3 -> R4
    expect(result.failedEdgeIds).toContain("e-R2-R4");
    expect(result.alternativeRoute?.path).toEqual(["R2", "R1", "R3", "R4"]);
    expect(result.alternativeRoute?.latency).toBe(19); // 4 + 5 + 10
    expect(result.scenarios[0].type).toBe("acl-block");
  });

  it("VLAN mismatch isolates a device like a node failure, without over-counting itself", () => {
    const result = analyzeNetwork(nodes, edges, sim({ vlanMismatchNodeIds: ["H1"] }));
    // H1 is a leaf — isolating it via VLAN mismatch shouldn't be reported as
    // a network "partition" (only degraded), matching router-fail semantics.
    expect(result.status).toBe("degraded");
    expect(result.affectedDevices).toEqual(["H1"]);
    expect(result.failedNodeIds).toContain("H1");
  });

  it("restore (empty sim) returns to healthy", () => {
    const degraded = analyzeNetwork(nodes, edges, sim({ failedEdgeIds: ["e-R2-R4"] }));
    expect(degraded.status).toBe("degraded");
    const restored = analyzeNetwork(nodes, edges, emptySim());
    expect(restored.status).toBe("healthy");
  });
});

describe("findCriticalPoints", () => {
  it("identifies R1 as an articulation point (H1 hangs off it alone)", () => {
    const { articulationPoints, bridges } = findCriticalPoints(nodes, edges);
    expect(articulationPoints).toContain("R1");
    expect(bridges).toContain("e-R1-H1");
  });

  it("does not flag R2/R3/R4 as articulation points (they're in a cycle)", () => {
    const { articulationPoints } = findCriticalPoints(nodes, edges);
    expect(articulationPoints).not.toContain("R2");
    expect(articulationPoints).not.toContain("R3");
    expect(articulationPoints).not.toContain("R4");
  });

  it("finds no bridges in a fully cyclic graph", () => {
    const cycle: NetNode[] = [
      { id: "A", label: "A", kind: "router", ip: "1.1.1.1", model: "m", location: "l", position: { x: 0, y: 0 } },
      { id: "B", label: "B", kind: "router", ip: "1.1.1.2", model: "m", location: "l", position: { x: 0, y: 0 } },
      { id: "C", label: "C", kind: "router", ip: "1.1.1.3", model: "m", location: "l", position: { x: 0, y: 0 } },
    ];
    const cycleEdges: NetEdge[] = [
      { id: "e-A-B", source: "A", target: "B", baseLatency: 1, bandwidth: 1000 },
      { id: "e-B-C", source: "B", target: "C", baseLatency: 1, bandwidth: 1000 },
      { id: "e-C-A", source: "C", target: "A", baseLatency: 1, bandwidth: 1000 },
    ];
    const { articulationPoints, bridges } = findCriticalPoints(cycle, cycleEdges);
    expect(articulationPoints).toHaveLength(0);
    expect(bridges).toHaveLength(0);
  });
});
