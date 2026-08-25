import { NetNode, NetEdge, AnalysisResult } from "./types";

export const AI_SYSTEM_PROMPT = `You are NetTwin's AI Network Engineer, embedded inside a network digital-twin simulation app.

HARD RULES:
- You are analyzing a SIMULATION ONLY. You have NOT touched any real router, switch, or host. Never claim or imply that a real device was modified, configured, rebooted, or changed in any way. Everything is a virtual model.
- Be concise, specific, and grounded in the provided live topology snapshot. Use exact device labels (e.g. R1, R2, H1) and exact latencies.
- When you mention a fix, frame it as a recommendation within the twin (e.g. "restore the link in the twin" or "add a redundant link in the twin"), not a real-world command on real gear.
- If the network is healthy, say so plainly. If degraded/partitioned, explain the root cause (link failure, router failure, latency increase, bandwidth reduction), what the alternative route is (if any), the extra latency it adds, which devices are affected, and the risk level.
- Keep answers under ~160 words unless the user asks for detail.
- Respond with the final answer only. Do not show step-by-step reasoning, chain-of-thought, or <think> blocks — think privately, then output just the answer.
- Output plain prose only — no markdown (no **bold**, no #headings, no bullet/dash lists, no backticks). The UI renders your response as plain text, so markdown syntax would show up as literal asterisks and hashes.`;

export function buildNetworkContext(
  nodes: NetNode[],
  edges: NetEdge[],
  analysis: AnalysisResult
): string {
  const lines: string[] = [];
  lines.push("=== LIVE NETWORK TOPOLOGY (simulation snapshot) ===");
  lines.push("DEVICES:");
  for (const n of nodes) {
    const failed = analysis.failedNodeIds.includes(n.id);
    lines.push(
      `- ${n.label} (${n.kind}, ${n.ip}, ${n.model}, ${n.location})${failed ? " [FAILED/DOWN]" : ""}`
    );
  }
  lines.push("");
  lines.push("LINKS:");
  for (const e of edges) {
    const failed = analysis.failedEdgeIds.includes(e.id);
    const latOverride = analysis.scenarios.find(
      (s) => s.type === "latency-up" && s.target === e.id
    );
    const bwOverride = analysis.scenarios.find(
      (s) => s.type === "bandwidth-down" && s.target === e.id
    );
    const latStr = latOverride ? latOverride.detail : `${e.baseLatency}ms`;
    const bwStr = bwOverride ? bwOverride.detail : `${e.bandwidth}Mbps`;
    const tag = failed ? "[FAILED/DOWN]" : "[UP]";
    lines.push(`- ${e.source}<->${e.target}: latency ${latStr}, bw ${bwStr} ${tag}`);
  }
  lines.push("");
  lines.push(`CURRENT STATUS: ${analysis.status.toUpperCase()}`);
  lines.push(`RISK LEVEL: ${analysis.risk.toUpperCase()}`);
  lines.push(`REACHABLE DEVICES: ${analysis.reachableCount} / ${nodes.length}`);
  lines.push(`UNREACHABLE/ISOLATED DEVICES: ${analysis.unreachableCount}`);

  if (analysis.scenarios.length > 0) {
    lines.push("");
    lines.push("ACTIVE WHAT-IF SCENARIOS:");
    for (const s of analysis.scenarios) {
      lines.push(`- [${s.type}] ${s.detail}`);
    }
  }

  if (analysis.failedEdgeIds.length > 0) {
    const fe = edges.find((ed) => ed.id === analysis.failedEdgeIds[0]);
    lines.push(`FAILED LINK: ${fe ? `${fe.source}<->${fe.target} (${fe.baseLatency}ms)` : "unknown"}`);
  }
  if (analysis.failedNodeIds.length > 0) {
    const labels = analysis.failedNodeIds
      .map((id) => nodes.find((n) => n.id === id)?.label ?? id)
      .join(", ");
    lines.push(`FAILED DEVICES (routers/hosts): ${labels} — all their links are isolated from the graph.`);
  }
  if (analysis.alternativeRoute) {
    const r = analysis.alternativeRoute;
    lines.push(
      `ALTERNATIVE ROUTE (lowest latency, excludes failed links): ${r.path.join(" -> ")} = ${r.latency}ms total`
    );
    if (analysis.extraLatency !== null) {
      lines.push(
        `EXTRA LATENCY vs original: +${analysis.extraLatency}ms (new route ${r.latency}ms vs original ${analysis.failedEdgeLatency}ms)`
      );
    }
  } else if (analysis.failedEdgeIds.length > 0) {
    lines.push("ALTERNATIVE ROUTE: none — endpoints are partitioned (unreachable).");
  }
  if (analysis.affectedDevices.length > 0) {
    const labels = analysis.affectedDevices
      .map((id) => nodes.find((n) => n.id === id)?.label ?? id)
      .join(", ");
    lines.push(`AFFECTED/ISOLATED DEVICES: ${labels}`);
  } else {
    lines.push("AFFECTED/ISOLATED DEVICES: none — all devices still reachable.");
  }
  if (analysis.affectedLinks.length > 0) {
    const labels = analysis.affectedLinks
      .map((eid) => {
        const e = edges.find((x) => x.id === eid);
        return e ? `${e.source}<->${e.target}` : eid;
      })
      .join(", ");
    lines.push(`AFFECTED LINKS (failed or degraded): ${labels}`);
  }
  lines.push("");
  lines.push("REMINDER: This is a simulation twin. No real devices were modified.");
  return lines.join("\n");
}
