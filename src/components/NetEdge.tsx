"use client";

import { memo } from "react";
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from "reactflow";

export interface NetEdgeData {
  failed?: boolean;
  onRoute?: boolean;
  selected?: boolean;
  label?: string;
  degraded?: boolean; // latency/bandwidth overridden
  lowBandwidth?: boolean;
}

function NetEdgeInner({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<NetEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const failed = data?.failed;
  const onRoute = data?.onRoute;
  const degraded = data?.degraded;
  const lowBandwidth = data?.lowBandwidth;

  let stroke = "var(--border-strong)";
  let strokeWidth = 2;
  const style: React.CSSProperties = {};

  if (failed) {
    stroke = "var(--danger)";
    strokeWidth = 2.5;
    style.strokeDasharray = "6 4";
    style.animation = "dash-flow 0.8s linear infinite";
  } else if (onRoute) {
    stroke = "var(--accent-2)";
    strokeWidth = 3;
  } else if (degraded) {
    stroke = lowBandwidth ? "var(--orange)" : "var(--warning)";
    strokeWidth = 2.5;
    style.strokeDasharray = "4 3";
  } else if (selected) {
    stroke = "var(--accent)";
    strokeWidth = 2.5;
  }

  const labelText = data?.label ?? (failed ? "DOWN" : "");
  const labelColor = failed
    ? "var(--danger)"
    : onRoute
    ? "var(--accent-2)"
    : lowBandwidth
    ? "var(--orange)"
    : degraded
    ? "var(--warning)"
    : "var(--text-faint)";
  const labelBorder = failed
    ? "color-mix(in srgb, var(--danger) 40%, transparent)"
    : onRoute
    ? "color-mix(in srgb, var(--accent-2) 40%, transparent)"
    : lowBandwidth
    ? "color-mix(in srgb, var(--orange) 40%, transparent)"
    : degraded
    ? "color-mix(in srgb, var(--warning) 40%, transparent)"
    : "var(--border)";

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke, strokeWidth, ...style }} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
          <div
            className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium border"
            style={{ background: "var(--surface)", color: labelColor, borderColor: labelBorder }}
          >
            {labelText}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const NetEdge = memo(NetEdgeInner);
export default NetEdge;
