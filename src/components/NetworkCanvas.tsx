"use client";

import { useMemo, useCallback } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Node,
  Edge,
  ConnectionLineType,
  Connection,
} from "reactflow";
import "reactflow/dist/style.css";
import { useNetTwin } from "@/lib/store";
import { useUI } from "@/lib/uiStore";
import { RouterNode, RouterNodeData } from "./RouterNode";
import { NetEdge, NetEdgeData } from "./NetEdge";

// nodeTypes/edgeTypes MUST be defined outside the component to avoid
// React Flow warning #002 (recreation on every render).
const nodeTypes = { netNode: RouterNode };
const edgeTypes = { netEdge: NetEdge };

export default function NetworkCanvas() {
  const nodes = useNetTwin((s) => s.nodes);
  const edges = useNetTwin((s) => s.edges);
  const simulation = useNetTwin((s) => s.simulation);
  // analysis.failedNodeIds/failedEdgeIds are already merged with ACL blocks
  // and VLAN mismatches by analyzeNetwork() — use those as the single
  // "is this down" source of truth instead of re-deriving it here.
  const failedNodeIds = useNetTwin((s) => s.analysis.failedNodeIds);
  const failedEdgeIdsMerged = useNetTwin((s) => s.analysis.failedEdgeIds);
  const routeEdgeIds = useNetTwin((s) => s.routeEdgeIds);
  const routeNodeIds = useNetTwin((s) => s.routeNodeIds);
  const affectedDevices = useNetTwin((s) => s.analysis.affectedDevices);
  const selectedNodeId = useNetTwin((s) => s.selectedNodeId);
  const selectedEdgeId = useNetTwin((s) => s.selectedEdgeId);
  const selectNode = useNetTwin((s) => s.selectNode);
  const selectEdge = useNetTwin((s) => s.selectEdge);
  const addEdge = useNetTwin((s) => s.addEdge);
  const deleteEdge = useNetTwin((s) => s.deleteEdge);
  const deleteNode = useNetTwin((s) => s.deleteNode);
  const updateNodePosition = useNetTwin((s) => s.updateNodePosition);
  const linkMode = useNetTwin((s) => s.linkMode);
  const setSidebarCollapsed = useUI((s) => s.setSidebarCollapsed);

  const rfNodes = useMemo<Node<RouterNodeData>[]>(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: "netNode",
        position: n.position,
        data: {
          label: n.label,
          ip: n.ip,
          kind: n.kind,
          selected: selectedNodeId === n.id,
          onRoute: routeNodeIds.has(n.id),
          isolated: affectedDevices.includes(n.id),
          failed: failedNodeIds.includes(n.id),
        },
        selectable: true,
        deletable: true,
      })),
    [nodes, selectedNodeId, routeNodeIds, affectedDevices, failedNodeIds]
  );

  const rfEdges = useMemo<Edge<NetEdgeData>[]>(
    () =>
      edges.map((e) => {
        const failed = failedEdgeIdsMerged.includes(e.id);
        const blocked = simulation.aclBlockEdgeIds.includes(e.id);
        const latOv = simulation.latencyOverrides[e.id];
        const bwOv = simulation.bandwidthOverrides[e.id];
        const lossOv = simulation.packetLossOverrides[e.id];
        const mtuMismatch = simulation.mtuMismatchEdgeIds.includes(e.id);
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
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: "netEdge",
          data: {
            failed,
            onRoute: routeEdgeIds.has(e.id),
            selected: selectedEdgeId === e.id,
            label,
            degraded:
              !failed &&
              (latOv !== undefined || bwOv !== undefined || lossOv !== undefined || mtuMismatch),
            lowBandwidth: bwOv !== undefined && bwOv < e.bandwidth,
          },
          selected: selectedEdgeId === e.id,
        };
      }),
    [edges, simulation, routeEdgeIds, selectedEdgeId, failedEdgeIdsMerged]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => selectNode(node.id), [selectNode]);
  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => selectEdge(edge.id), [selectEdge]);

  const onPaneClick = useCallback(() => {
    selectNode(null);
    selectEdge(null);
    setSidebarCollapsed(true);
  }, [selectNode, selectEdge, setSidebarCollapsed]);

  const onConnect = useCallback(
    (conn: Connection) => {
      if (conn.source && conn.target) addEdge(conn.source, conn.target);
    },
    [addEdge]
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      updateNodePosition(node.id, node.position);
    },
    [updateNodePosition]
  );

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      for (const n of deleted) deleteNode(n.id);
    },
    [deleteNode]
  );
  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      for (const e of deleted) deleteEdge(e.id);
    },
    [deleteEdge]
  );

  return (
    <div className="absolute inset-0 canvas-grid">
      {linkMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-lg border border-accent/40 bg-accent/10 text-[11px] text-accent pointer-events-none">
          Link mode: drag from one node handle to another to connect them
        </div>
      )}
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        deleteKeyCode={["Backspace", "Delete"]}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable
        zoomOnScroll
        panOnScroll={false}
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--border)" />
        <Controls showInteractive={false} />
        <MiniMap
          className="hidden sm:block"
          nodeColor={(n) => {
            const d = n.data as RouterNodeData;
            if (d?.failed) return "var(--danger)";
            if (d?.isolated) return "var(--danger)";
            if (d?.onRoute) return "var(--accent-2)";
            return d?.kind === "host" ? "var(--warning)" : "var(--accent)";
          }}
          nodeStrokeWidth={2}
          maskColor="color-mix(in srgb, var(--bg) 70%, transparent)"
        />
      </ReactFlow>
    </div>
  );
}
