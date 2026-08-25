"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { motion } from "framer-motion";
import { Router, Server, X, Route as RouteIcon, AlertTriangle } from "lucide-react";

export interface RouterNodeData {
  label: string;
  ip: string;
  kind: "router" | "host" | "switch";
  selected?: boolean;
  onRoute?: boolean;
  isolated?: boolean;
  failed?: boolean;
}

const positions = [Position.Top, Position.Left, Position.Bottom, Position.Right];

function RouterNodeInner({ data, selected }: NodeProps<RouterNodeData>) {
  const isHost = data.kind === "host";
  const accent = isHost ? "var(--warning)" : "var(--accent)";
  const iconColor = data.failed ? "var(--danger)" : accent;

  const borderColor = data.failed
    ? "var(--danger)"
    : selected
    ? accent
    : data.onRoute
    ? "var(--accent-2)"
    : "var(--border)";

  const boxBackground = "var(--surface)";

  const boxShadow = selected
    ? `0 0 0 3px color-mix(in srgb, ${accent} 25%, transparent)`
    : "var(--shadow-sm)";

  const Icon = isHost ? Server : Router;

  return (
    <motion.div
      initial={false}
      animate={{ scale: selected ? 1.05 : 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="relative flex flex-col items-center"
      style={{ cursor: "pointer" }}
    >
      {positions.map((p) => (
        <Handle key={`s-${p}`} type="source" position={p} style={{ opacity: 0 }} />
      ))}
      {positions.map((p) => (
        <Handle key={`t-${p}`} type="target" position={p} style={{ opacity: 0 }} />
      ))}

      <div
        className="relative w-14 h-14 rounded-lg flex items-center justify-center border-2 transition-all"
        style={{
          borderColor,
          background: boxBackground,
          boxShadow,
          opacity: data.failed ? 0.85 : 1,
        }}
      >
        <Icon size={22} strokeWidth={1.6} color={iconColor} />

        {data.failed && (
          <div
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center status-pulse"
            style={{ background: "var(--danger)", color: "var(--bg)" }}
          >
            <X size={11} strokeWidth={3} />
          </div>
        )}
        {!data.failed && data.onRoute && (
          <div
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: "var(--accent-2)", color: "var(--bg)" }}
          >
            <RouteIcon size={11} strokeWidth={2.5} />
          </div>
        )}
        {!data.failed && data.isolated && (
          <div
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: "var(--danger)", color: "var(--bg)" }}
          >
            <AlertTriangle size={11} strokeWidth={2.5} />
          </div>
        )}
      </div>

      <div className="mt-1.5 flex flex-col items-center">
        <span
          className="text-[11px] font-semibold"
          style={{ color: data.failed ? "var(--danger)" : selected ? accent : "var(--text)" }}
        >
          {data.label}
        </span>
        <span className="text-[9px] text-text-faint font-mono">{data.ip}</span>
      </div>
    </motion.div>
  );
}

export const RouterNode = memo(RouterNodeInner);
export default RouterNode;
