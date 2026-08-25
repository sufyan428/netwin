import { describe, it, expect, beforeEach } from "vitest";
import { useNetTwin } from "./store";

// zustand stores are module-level singletons — snapshot the pristine state
// once and restore it before every test so tests don't leak into each other.
const initialState = useNetTwin.getState();

beforeEach(() => {
  useNetTwin.setState(initialState, true);
});

describe("topology mutations", () => {
  it("addNode adds a router and selects it", () => {
    const before = useNetTwin.getState().nodes.length;
    const id = useNetTwin.getState().addNode("router");
    const state = useNetTwin.getState();
    expect(state.nodes).toHaveLength(before + 1);
    expect(state.selectedNodeId).toBe(id);
    expect(state.nodes.find((n) => n.id === id)?.kind).toBe("router");
  });

  it("deleteNode removes the node and its incident links", () => {
    const { deleteNode } = useNetTwin.getState();
    const edgesBefore = useNetTwin.getState().edges.length;
    const incident = useNetTwin.getState().edges.filter((e) => e.source === "R2" || e.target === "R2").length;
    deleteNode("R2");
    const state = useNetTwin.getState();
    expect(state.nodes.find((n) => n.id === "R2")).toBeUndefined();
    expect(state.edges).toHaveLength(edgesBefore - incident);
  });

  it("addEdge refuses a duplicate link between the same pair", () => {
    const before = useNetTwin.getState().edges.length;
    useNetTwin.getState().addEdge("R1", "R2"); // R1<->R2 already exists in the seed
    expect(useNetTwin.getState().edges).toHaveLength(before);
  });

  it("addEdge refuses a self-loop", () => {
    const before = useNetTwin.getState().edges.length;
    useNetTwin.getState().addEdge("R1", "R1");
    expect(useNetTwin.getState().edges).toHaveLength(before);
  });

  it("deleteEdge removes only that edge and prunes its sim overrides", () => {
    const { runWhatIf, deleteEdge } = useNetTwin.getState();
    runWhatIf("latency-up", "e-R1-R2", 50);
    expect(useNetTwin.getState().simulation.latencyOverrides["e-R1-R2"]).toBe(50);
    deleteEdge("e-R1-R2");
    const state = useNetTwin.getState();
    expect(state.edges.find((e) => e.id === "e-R1-R2")).toBeUndefined();
    expect(state.simulation.latencyOverrides["e-R1-R2"]).toBeUndefined();
  });
});

describe("what-if simulation", () => {
  it("runWhatIf(router-fail) marks the node failed and recomputes analysis", () => {
    useNetTwin.getState().runWhatIf("router-fail", "R2");
    const state = useNetTwin.getState();
    expect(state.simulation.failedNodeIds).toContain("R2");
    expect(state.analysis.status).not.toBe("healthy");
  });

  it("restore clears the specific override, clearWhatIf clears everything", () => {
    const { runWhatIf, clearWhatIf } = useNetTwin.getState();
    runWhatIf("link-fail", "e-R1-R2");
    runWhatIf("bandwidth-down", "e-R2-R4", 100);
    expect(useNetTwin.getState().simulation.failedEdgeIds).toContain("e-R1-R2");
    clearWhatIf();
    const state = useNetTwin.getState();
    expect(state.simulation.failedEdgeIds).toHaveLength(0);
    expect(state.simulation.bandwidthOverrides).toEqual({});
    expect(state.analysis.status).toBe("healthy");
  });

  it("packet-loss and acl-block what-ifs round-trip through restore", () => {
    const { runWhatIf } = useNetTwin.getState();
    runWhatIf("packet-loss", "e-R1-R2", 40);
    runWhatIf("acl-block", "e-R2-R3");
    expect(useNetTwin.getState().simulation.packetLossOverrides["e-R1-R2"]).toBe(40);
    expect(useNetTwin.getState().simulation.aclBlockEdgeIds).toContain("e-R2-R3");
    runWhatIf("restore", "e-R1-R2");
    runWhatIf("restore", "e-R2-R3");
    const state = useNetTwin.getState();
    expect(state.simulation.packetLossOverrides["e-R1-R2"]).toBeUndefined();
    expect(state.simulation.aclBlockEdgeIds).not.toContain("e-R2-R3");
  });
});

describe("undo / redo", () => {
  it("undo reverts the last mutation and redo replays it", () => {
    const nodesBefore = useNetTwin.getState().nodes.length;
    useNetTwin.getState().addNode("host");
    expect(useNetTwin.getState().nodes).toHaveLength(nodesBefore + 1);

    useNetTwin.getState().undo();
    expect(useNetTwin.getState().nodes).toHaveLength(nodesBefore);

    useNetTwin.getState().redo();
    expect(useNetTwin.getState().nodes).toHaveLength(nodesBefore + 1);
  });

  it("a new mutation clears the redo stack", () => {
    useNetTwin.getState().addNode("router");
    useNetTwin.getState().undo();
    expect(useNetTwin.getState().future.length).toBeGreaterThan(0);

    useNetTwin.getState().addNode("host");
    expect(useNetTwin.getState().future).toHaveLength(0);
  });

  it("undo is a no-op with an empty past", () => {
    const state0 = useNetTwin.getState();
    expect(state0.past).toHaveLength(0);
    useNetTwin.getState().undo();
    expect(useNetTwin.getState().nodes).toEqual(state0.nodes);
  });
});

describe("history / versioning", () => {
  it("every mutation appends a new history entry", () => {
    const before = useNetTwin.getState().history.length;
    useNetTwin.getState().addNode("router");
    expect(useNetTwin.getState().history.length).toBe(before + 1);
  });

  it("restoreToVersion returns the topology to that snapshot", () => {
    const v1Nodes = useNetTwin.getState().nodes.length;
    useNetTwin.getState().addNode("router");
    useNetTwin.getState().addNode("host");
    expect(useNetTwin.getState().nodes.length).toBe(v1Nodes + 2);

    useNetTwin.getState().restoreToVersion(1);
    expect(useNetTwin.getState().nodes.length).toBe(v1Nodes);
  });
});

describe("loadProject", () => {
  it("replaces the topology and resets simulation/history/undo state", () => {
    const { runWhatIf, loadProject } = useNetTwin.getState();
    runWhatIf("router-fail", "R2");
    loadProject(
      [
        { id: "X1", label: "X1", kind: "router", ip: "10.9.9.1", model: "m", location: "l", position: { x: 0, y: 0 } },
      ],
      []
    );
    const state = useNetTwin.getState();
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0].id).toBe("X1");
    expect(state.simulation.failedNodeIds).toHaveLength(0);
    expect(state.past).toHaveLength(0);
    expect(state.history).toHaveLength(1);
  });
});
