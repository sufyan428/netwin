"use client";

import { useMemo } from "react";
import { ShieldCheck, AlertTriangle, ShieldAlert } from "lucide-react";
import { useNetTwin } from "@/lib/store";
import { findCriticalPoints } from "@/lib/graph";
import { isValidIpv4 } from "@/lib/subnet";
import { Card } from "../ui/Panel";

interface Check {
  id: string;
  severity: "warning" | "danger";
  title: string;
  detail: string;
}

export default function HealthChecks() {
  const nodes = useNetTwin((s) => s.nodes);
  const edges = useNetTwin((s) => s.edges);

  const checks = useMemo<Check[]>(() => {
    const out: Check[] = [];

    const byIp = new Map<string, string[]>();
    for (const n of nodes) {
      if (!byIp.has(n.ip)) byIp.set(n.ip, []);
      byIp.get(n.ip)!.push(n.label);
    }
    for (const [ip, labels] of byIp) {
      if (labels.length > 1) {
        out.push({
          id: `dup-${ip}`,
          severity: "danger",
          title: `Duplicate IP address ${ip}`,
          detail: `Assigned to ${labels.join(", ")} — this would cause an ARP/IP conflict on a real network.`,
        });
      }
    }

    for (const n of nodes) {
      if (!isValidIpv4(n.ip)) {
        out.push({
          id: `bad-ip-${n.id}`,
          severity: "danger",
          title: `Invalid IP address on ${n.label}`,
          detail: `"${n.ip}" is not a valid IPv4 address.`,
        });
      }
    }

    if (nodes.length > 0 && edges.length > 0) {
      const { articulationPoints, bridges } = findCriticalPoints(nodes, edges);
      const byId = new Map(nodes.map((n) => [n.id, n]));
      for (const id of articulationPoints) {
        const n = byId.get(id);
        out.push({
          id: `ap-${id}`,
          severity: "warning",
          title: `${n?.label ?? id} is a single point of failure`,
          detail: `If ${n?.label ?? id} goes down, part of the network would be partitioned. Add a redundant link around it.`,
        });
      }
      for (const eid of bridges) {
        const e = edges.find((x) => x.id === eid);
        if (!e) continue;
        out.push({
          id: `bridge-${eid}`,
          severity: "warning",
          title: `${e.source} ↔ ${e.target} is a critical link`,
          detail: `This is the only path between the two sides — if it fails, the network partitions. Consider a redundant link.`,
        });
      }
    }

    return out;
  }, [nodes, edges]);

  if (checks.length === 0) {
    return (
      <Card className="p-4 flex items-start gap-2.5">
        <ShieldCheck size={16} className="text-success shrink-0 mt-0.5" />
        <div>
          <div className="text-xs font-medium text-text">No issues found</div>
          <div className="text-[11px] text-text-faint mt-0.5">
            No duplicate IPs, invalid addresses, or single points of failure detected in the
            current design.
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-1.5">
      {checks.map((c) => {
        const Icon = c.severity === "danger" ? ShieldAlert : AlertTriangle;
        const color = c.severity === "danger" ? "var(--danger)" : "var(--warning)";
        return (
          <Card key={c.id} className="p-2.5 flex items-start gap-2.5">
            <Icon size={14} className="shrink-0 mt-0.5" style={{ color }} />
            <div className="min-w-0">
              <div className="text-xs font-medium text-text">{c.title}</div>
              <div className="text-[11px] text-text-faint mt-0.5 leading-snug">{c.detail}</div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
