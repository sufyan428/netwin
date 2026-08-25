import { NetNode, NetEdge, AnalysisResult } from "@/lib/types";

function labelOf(nodes: NetNode[], id: string): string {
  return nodes.find((n) => n.id === id)?.label ?? id;
}

function edgeLabel(edges: NetEdge[], id: string): string {
  const e = edges.find((x) => x.id === id);
  return e ? `${e.source}<->${e.target}` : id;
}

// Rule-based topology-aware answer used whenever no AI provider is
// configured/available. This is the zero-key path — always on.
export function offlineAnswer(
  question: string,
  nodes: NetNode[],
  edges: NetEdge[],
  analysis: AnalysisResult
): string {
  const q = question.toLowerCase();
  const status = analysis.status;
  const failedEdge =
    analysis.failedEdgeIds.length > 0
      ? edges.find((e) => e.id === analysis.failedEdgeIds[0])
      : null;
  const failedNodeLabels = analysis.failedNodeIds.map((id) => labelOf(nodes, id));
  const affectedLabels = analysis.affectedDevices.map((id) => labelOf(nodes, id)).join(", ");

  const isRisk = /risk|severe|how bad|serious|danger|impact/.test(q);
  const isRouter = /router|node|r2|r3|r1|r4 fail|device fail/.test(q);
  const isLatency = /latency|delay|slow|lag|ms/.test(q);
  const isBw = /bandwidth|bw|throughput|capacity|congest/.test(q);
  const isLoss = /packet loss|dropp?ed?|loss/.test(q);
  const isMtu = /mtu|fragment/.test(q);
  const isAcl = /acl|blocked?|firewall|polic(y|ies)/.test(q);
  const isVlan = /vlan/.test(q);
  const isWhy = /why|cause|reason|happen|degrad|what.*wrong|broke/.test(q);
  const isFix = /fix|safe|safest|resolve|recover|repair|restore|how.*do/.test(q);

  if (status === "healthy" && analysis.scenarios.length === 0) {
    return `The twin is currently healthy — all ${edges.length} links are UP and all ${nodes.length} devices are reachable. Risk: ${analysis.risk}. There is no failure to explain. Remember: this is a simulation; no real routers were touched.`;
  }

  if (isLoss) {
    const s = analysis.scenarios.find((x) => x.type === "packet-loss");
    if (s) {
      return (
        `In the twin, link ${edgeLabel(edges, s.target)} is dropping packets (${s.detail}). ` +
        `Status: ${status}. Risk: ${analysis.risk}. This degrades throughput and retransmissions without necessarily breaking the path — ` +
        `${analysis.reachableCount}/${nodes.length} devices are still reachable. ` +
        `Safest fix: restore the link in the twin. Simulation only — no real link was reconfigured.`
      );
    }
  }
  if (isMtu) {
    const s = analysis.scenarios.find((x) => x.type === "mtu-mismatch");
    if (s) {
      return (
        `In the twin, link ${edgeLabel(edges, s.target)} has an MTU mismatch between its two ends. ` +
        `Large packets can be silently dropped or fragmented (a classic "black hole" issue that's hard to spot from ping alone). ` +
        `Status: ${status}. Risk: ${analysis.risk}. Safest fix: align the MTU on both interfaces in the twin. Simulation only.`
      );
    }
  }
  if (isAcl) {
    const s = analysis.scenarios.find((x) => x.type === "acl-block");
    if (s) {
      return (
        `In the twin, link ${edgeLabel(edges, s.target)} is administratively BLOCKED by an ACL/firewall policy — ` +
        `this is a configuration decision, not a physical failure. Status: ${status}. Risk: ${analysis.risk}. ` +
        `${analysis.reachableCount}/${nodes.length} devices reachable. Safest fix: remove or correct the blocking rule in the twin. Simulation only.`
      );
    }
  }
  if (isVlan) {
    const s = analysis.scenarios.find((x) => x.type === "vlan-mismatch");
    if (s) {
      const n = nodes.find((x) => x.id === s.target);
      return (
        `In the twin, ${n ? n.label : s.target} is assigned to the wrong VLAN and can't reach its default gateway or the rest of its segment. ` +
        `Status: ${status}. Risk: ${analysis.risk}. ${analysis.reachableCount}/${nodes.length} devices still reachable. ` +
        `Safest fix: correct the VLAN assignment in the twin. Simulation only — no real switchport was reconfigured.`
      );
    }
  }

  if (isRisk) {
    const reason =
      status === "partitioned"
        ? `the network is partitioned with ${analysis.unreachableCount} device(s) unreachable`
        : analysis.failedNodeIds.length > 0
        ? `device(s) ${failedNodeLabels.join(", ")} failed`
        : analysis.extraLatency !== null && analysis.extraLatency > 0
        ? `a failure forced a +${analysis.extraLatency}ms detour`
        : Object.keys(analysis).length > 0
        ? "links are degraded"
        : "of an active simulation";
    return (
      `Risk: ${analysis.risk.toUpperCase()}. ` +
      `This is ${reason}. ` +
      `${analysis.reachableCount} of ${nodes.length} devices are reachable; ${analysis.unreachableCount} isolated. ` +
      `Simulation only — no real device was modified.`
    );
  }

  if (isRouter && analysis.failedNodeIds.length > 0) {
    const r = analysis.alternativeRoute;
    const rLabels = r ? r.path.map((id) => labelOf(nodes, id)).join(" -> ") : "none";
    if (status === "partitioned") {
      return (
        `Device ${failedNodeLabels.join(", ")} FAILED in the twin — every link touching it was removed from the graph. ` +
        `This partitioned the network: ${affectedLabels || "devices"} became isolated with no alternative path. ` +
        `Risk: ${analysis.risk}. Reachable: ${analysis.reachableCount}/${nodes.length}. ` +
        `Safest fix: restore the failed device (clear the what-if) or add a redundant link around it in the twin. ` +
        `Simulation only — no real router was rebooted or modified.`
      );
    }
    return (
      `Device ${failedNodeLabels.join(", ")} FAILED in the twin — all its links were isolated. ` +
      `The network is ${status}: ${analysis.reachableCount}/${nodes.length} devices remain reachable` +
      `${r ? ` via route ${rLabels} = ${r.latency}ms` : ""}. ` +
      `Risk: ${analysis.risk}. ` +
      `Simulation only — no real router was modified.`
    );
  }

  if (isLatency) {
    const latScenario = analysis.scenarios.find((s) => s.type === "latency-up");
    if (latScenario) {
      const r = analysis.alternativeRoute;
      const rLabels = r ? r.path.map((id) => labelOf(nodes, id)).join(" -> ") : "none";
      return (
        `In the twin, link ${edgeLabel(edges, latScenario.target)} had its latency changed (${latScenario.detail}). ` +
        `Status: ${status}. Risk: ${analysis.risk}. ` +
        (r
          ? `The new shortest route across it is ${rLabels} = ${r.latency}ms. `
          : `No alternative route is available. `) +
        `Reachable: ${analysis.reachableCount}/${nodes.length}. ` +
        `Simulation only — no real link was reconfigured.`
      );
    }
  }

  if (isBw) {
    const bwScenario = analysis.scenarios.find((s) => s.type === "bandwidth-down");
    if (bwScenario) {
      return (
        `In the twin, link ${edgeLabel(edges, bwScenario.target)} had its bandwidth reduced (${bwScenario.detail}). ` +
        `Status: ${status}. Risk: ${analysis.risk}. ` +
        `Lower bandwidth can cause congestion under load but does not by itself break reachability — ` +
        `${analysis.reachableCount}/${nodes.length} devices are still reachable. ` +
        `Simulation only — no real link was reconfigured.`
      );
    }
  }

  if (isWhy) {
    if (analysis.failedNodeIds.length > 0) {
      return (
        `The network is ${status} because device ${failedNodeLabels.join(", ")} FAILED in the twin, isolating all its links. ` +
        (status === "partitioned"
          ? `That left ${affectedLabels || "devices"} unreachable with no alternative path. `
          : `Connectivity held: ${analysis.reachableCount}/${nodes.length} devices are still reachable. `) +
        `Risk: ${analysis.risk}. Simulation only — no real device was modified.`
      );
    }
    if (status === "partitioned") {
      return (
        `The network is partitioned because link ${failedEdge?.source}<->${failedEdge?.target} (${failedEdge?.baseLatency}ms) was taken DOWN in the twin. ` +
        `With that link removed there is no remaining path between its endpoints, so ${affectedLabels || "some devices"} became isolated. ` +
        `Risk: ${analysis.risk}. No alternative route exists. Simulation only — no real device was modified.`
      );
    }
    const r = analysis.alternativeRoute;
    const rLabels = r ? r.path.map((id) => labelOf(nodes, id)).join(" -> ") : "none";
    const latScenario = analysis.scenarios.find((s) => s.type === "latency-up");
    if (latScenario) {
      return (
        `The network degraded because link ${edgeLabel(edges, latScenario.target)} had its latency raised (${latScenario.detail}). ` +
        `The new shortest route is ${rLabels} = ${r?.latency}ms. Risk: ${analysis.risk}. ` +
        `Simulation only — no real link was modified.`
      );
    }
    return (
      `The network degraded because link ${failedEdge?.source}<->${failedEdge?.target} (${failedEdge?.baseLatency}ms) was taken DOWN in the twin. ` +
      `Traffic now follows the lowest-latency alternative route ${rLabels} = ${r?.latency}ms, adding +${analysis.extraLatency}ms. ` +
      `No devices are isolated. Risk: ${analysis.risk}. Simulation only — no real router was modified.`
    );
  }

  if (isFix) {
    const target =
      analysis.failedNodeIds.length > 0
        ? `device ${failedNodeLabels.join(", ")}`
        : `link ${failedEdge?.source}<->${failedEdge?.target}`;
    if (status === "partitioned") {
      return (
        `Safest fix in the twin: restore ${target} (click "Restore" or clear the what-if). ` +
        `Right now ${affectedLabels || "devices"} are isolated with no alternative path, so restoring is the only way to re-establish connectivity. ` +
        `For future resilience, add a redundant link so a single failure never partitions the network. ` +
        `Risk: ${analysis.risk}. Simulation only — no real device was configured.`
      );
    }
    return (
      `Safest fix in the twin: restore ${target} to return to the original path` +
      `${analysis.extraLatency !== null ? ` and remove the +${analysis.extraLatency}ms penalty` : ""}. ` +
      `The network is currently ${status} but still connected, so there is no outage — only added cost. ` +
      `For longer-term resilience, add a redundant direct link. ` +
      `Risk: ${analysis.risk}. Simulation only — no real router was touched.`
    );
  }

  const rLabels = analysis.alternativeRoute
    ? analysis.alternativeRoute.path.map((id) => labelOf(nodes, id)).join(" -> ")
    : "none (partitioned)";
  const scenarioSummary =
    analysis.scenarios.length > 0
      ? analysis.scenarios.map((s) => s.detail).join("; ")
      : "no active scenarios";
  return (
    `Current state: ${status.toUpperCase()} (risk ${analysis.risk}). ` +
    `Active what-if: ${scenarioSummary}. ` +
    `Alternative route: ${rLabels}${analysis.extraLatency !== null ? ` (+${analysis.extraLatency}ms)` : ""}. ` +
    `Reachable: ${analysis.reachableCount}/${nodes.length}. ` +
    `Affected devices: ${analysis.affectedDevices.length > 0 ? affectedLabels : "none"}. ` +
    `Ask "why did it degrade?", "what is the risk?", or "what is the safest fix?". ` +
    `Simulation only — no real devices were modified.`
  );
}
