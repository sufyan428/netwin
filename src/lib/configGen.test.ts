import { describe, it, expect } from "vitest";
import { generateDeviceConfig, generateAllConfigs } from "./configGen";
import { NetNode, NetEdge } from "./types";

const nodes: NetNode[] = [
  { id: "R1", label: "R1", kind: "router", ip: "10.0.0.1", model: "vRouter-1000", location: "Core", position: { x: 0, y: 0 } },
  { id: "R2", label: "R2", kind: "router", ip: "10.0.0.2", model: "vRouter-2000", location: "Edge", position: { x: 0, y: 0 } },
  { id: "H1", label: "H1", kind: "host", ip: "10.0.1.10", model: "App-Server", location: "Tenant A", position: { x: 0, y: 0 } },
];

const edges: NetEdge[] = [
  { id: "e-R1-R2", source: "R1", target: "R2", baseLatency: 4, bandwidth: 1000 },
  { id: "e-R1-H1", source: "R1", target: "H1", baseLatency: 2, bandwidth: 1000 },
];

describe("generateDeviceConfig", () => {
  it("includes the hostname and one interface per connected link", () => {
    const cfg = generateDeviceConfig(nodes[0], edges, nodes); // R1 has 2 links
    expect(cfg).toContain("hostname R1");
    expect(cfg).toContain("interface GigabitEthernet0/0");
    expect(cfg).toContain("interface GigabitEthernet0/1");
    expect(cfg).not.toContain("GigabitEthernet0/2");
  });

  it("uses Ethernet naming for hosts", () => {
    const cfg = generateDeviceConfig(nodes[2], edges, nodes); // H1
    expect(cfg).toContain("interface Ethernet0/0");
  });

  it("only emits a routing protocol block for routers", () => {
    const routerCfg = generateDeviceConfig(nodes[0], edges, nodes);
    const hostCfg = generateDeviceConfig(nodes[2], edges, nodes);
    expect(routerCfg).toContain("router ospf 1");
    expect(hostCfg).not.toContain("router ospf 1");
  });

  it("gives both endpoints of a link the same transit subnet", () => {
    const r1Cfg = generateDeviceConfig(nodes[0], edges, nodes);
    const r2Cfg = generateDeviceConfig(nodes[1], edges, nodes);
    const subnetOf = (cfg: string) => cfg.match(/ip address 10\.255\.\d+\.\d+ (255\.255\.255\.252)/)?.[1];
    expect(subnetOf(r1Cfg)).toBe("255.255.255.252");
    expect(subnetOf(r2Cfg)).toBe("255.255.255.252");
  });

  it("a device with no links only gets a loopback", () => {
    const isolated: NetNode = { id: "R3", label: "R3", kind: "router", ip: "10.0.0.3", model: "m", location: "l", position: { x: 0, y: 0 } };
    const cfg = generateDeviceConfig(isolated, edges, [...nodes, isolated]);
    expect(cfg).not.toMatch(/interface GigabitEthernet0\/0/);
    expect(cfg).toContain("interface Loopback0");
    expect(cfg).toContain("10.0.0.3");
  });
});

describe("generateAllConfigs", () => {
  it("returns one config per device", () => {
    const all = generateAllConfigs(nodes, edges);
    expect(all).toHaveLength(nodes.length);
    expect(all.map((x) => x.node.id)).toEqual(["R1", "R2", "H1"]);
  });
});
