"use client";

import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { useNetTwin } from "@/lib/store";
import { riskTone, riskLabel, statusTone } from "@/lib/statusColors";
import { Button } from "./ui/Button";
import { softBg } from "@/lib/theme";

const scenarioTypeLabel: Record<string, string> = {
  "link-fail": "Link failure",
  "router-fail": "Router failure",
  "latency-up": "High latency",
  "bandwidth-down": "Reduced bandwidth",
  "packet-loss": "Packet loss",
  "mtu-mismatch": "MTU mismatch",
  "acl-block": "ACL block",
  "vlan-mismatch": "VLAN mismatch",
  restore: "Restored",
};

export default function SimulationBanner() {
  const analysis = useNetTwin((s) => s.analysis);
  const nodes = useNetTwin((s) => s.nodes);
  const clearWhatIf = useNetTwin((s) => s.clearWhatIf);

  const hasSim = analysis.scenarios.length > 0;
  const show = hasSim && analysis.status !== "healthy";

  const routeLabels = analysis.alternativeRoute
    ? analysis.alternativeRoute.path.map((id) => nodes.find((n) => n.id === id)?.label ?? id).join(" -> ")
    : null;

  const primaryScenario = analysis.scenarios[0];
  const accent = statusTone[analysis.status];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-[min(720px,calc(100%-2rem))]"
        >
          <div
            className="rounded-xl border bg-surface/95 backdrop-blur-md shadow-lg px-4 py-3"
            style={{ borderColor: softBg(accent, 40) }}
          >
            <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="status-pulse w-2 h-2 rounded-full" style={{ background: accent }} />
                <span className="text-sm font-semibold" style={{ color: accent }}>
                  {analysis.status === "partitioned" ? "Network Partitioned" : "Network Degraded"}
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                  style={{ background: softBg(riskTone[analysis.risk]), color: riskTone[analysis.risk] }}
                >
                  Risk: {riskLabel[analysis.risk]}
                </span>
                {primaryScenario && (
                  <span className="text-[10px] text-text-faint">
                    {scenarioTypeLabel[primaryScenario.type] ?? "What-if"}
                  </span>
                )}
              </div>
              <Button onClick={clearWhatIf}>
                <RotateCcw size={12} /> Restore
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-[11px]">
              <Info label="Scenario" value={primaryScenario ? primaryScenario.detail : "—"} color={accent} />
              <Info
                label="Alternative route"
                value={
                  routeLabels
                    ? routeLabels
                    : analysis.status === "partitioned"
                    ? "None — endpoints partitioned"
                    : "n/a — original path still in use"
                }
                color={
                  routeLabels
                    ? "var(--accent-2)"
                    : analysis.status === "partitioned"
                    ? "var(--danger)"
                    : "var(--text-faint)"
                }
              />
              <Info
                label="Latency change"
                value={
                  analysis.extraLatency !== null
                    ? `+${analysis.extraLatency} ms (${analysis.alternativeRoute?.latency}ms vs ${analysis.failedEdgeLatency}ms)`
                    : "n/a"
                }
                color={analysis.extraLatency !== null ? "var(--warning)" : "var(--text-faint)"}
              />
              <Info
                label="Reachable / Total"
                value={`${analysis.reachableCount} / ${nodes.length}`}
                color={analysis.unreachableCount === 0 ? "var(--success)" : "var(--warning)"}
              />
              <Info
                label="Unreachable"
                value={
                  analysis.affectedDevices.length > 0
                    ? analysis.affectedDevices.map((id) => nodes.find((n) => n.id === id)?.label ?? id).join(", ")
                    : "0 — still connected"
                }
                color={analysis.affectedDevices.length > 0 ? "var(--danger)" : "var(--success)"}
              />
              <Info
                label="Affected links"
                value={analysis.affectedLinks.length > 0 ? `${analysis.affectedLinks.length} link(s) failed/degraded` : "0"}
                color={analysis.affectedLinks.length > 0 ? "var(--orange)" : "var(--success)"}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Info({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="text-text-faint text-[10px] uppercase tracking-wide">{label}</div>
      <div className="font-mono mt-0.5 break-words" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
