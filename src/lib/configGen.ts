import { NetNode, NetEdge } from "./types";
import { calcSubnet } from "./subnet";

// Deterministic synthetic /30 point-to-point transit block per link, so both
// endpoints of the same link always agree on the same subnet.
function transitSubnetForEdge(edgeIndex: number): string {
  const octet3 = edgeIndex % 256;
  return `10.255.${octet3}.0/30`;
}

function interfaceName(kind: NetNode["kind"], i: number): string {
  return kind === "host" ? `Ethernet0/${i}` : `GigabitEthernet0/${i}`;
}

// Generates a Cisco-IOS-style config snippet for one device from its live
// position in the topology. Transit-link IPs are synthetic (derived from the
// topology, not real IPAM) — this is a starting template, not a real device
// export. Loopback0 uses the device's twin IP as its management identity.
export function generateDeviceConfig(node: NetNode, edges: NetEdge[], nodes: NetNode[]): string {
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const connected = edges
    .map((edge, index) => ({ edge, index }))
    .filter(({ edge }) => edge.source === node.id || edge.target === node.id);

  const lines: string[] = [];
  lines.push(`! NetTwin generated config — ${node.label} (${node.kind}, ${node.model})`);
  lines.push(`! Simulation twin only. Transit subnets are synthetic point-to-point`);
  lines.push(`! blocks derived from this topology, not real IPAM allocations.`);
  lines.push(`!`);
  lines.push(`hostname ${node.label}`);
  lines.push(`!`);

  connected.forEach(({ edge, index }, i) => {
    const otherId = edge.source === node.id ? edge.target : edge.source;
    const other = nodesById.get(otherId);
    const info = calcSubnet(transitSubnetForEdge(index));
    const ip = node.id < otherId ? info.firstHost : info.lastHost;
    lines.push(`interface ${interfaceName(node.kind, i)}`);
    lines.push(
      ` description Link to ${other ? other.label : otherId} (${edge.baseLatency}ms, ${edge.bandwidth}Mbps)`
    );
    lines.push(` ip address ${ip} ${info.mask}`);
    lines.push(` no shutdown`);
    lines.push(`!`);
  });

  lines.push(`interface Loopback0`);
  lines.push(` description Management / twin identity address`);
  lines.push(` ip address ${node.ip} 255.255.255.255`);
  lines.push(`!`);

  if (node.kind === "router") {
    lines.push(`router ospf 1`);
    lines.push(` network ${node.ip} 0.0.0.0 area 0`);
    connected.forEach(({ index }) => {
      const info = calcSubnet(transitSubnetForEdge(index));
      lines.push(` network ${info.network} ${info.wildcard} area 0`);
    });
    lines.push(`!`);
  }

  lines.push(`end`);
  return lines.join("\n");
}

export function generateAllConfigs(
  nodes: NetNode[],
  edges: NetEdge[]
): { node: NetNode; config: string }[] {
  return nodes.map((n) => ({ node: n, config: generateDeviceConfig(n, edges, nodes) }));
}
