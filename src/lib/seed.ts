import { NetNode, NetEdge } from "./types";

export const seedNodes: NetNode[] = [
  {
    id: "R1",
    label: "R1",
    kind: "router",
    ip: "10.0.0.1",
    model: "vRouter-1000",
    location: "Core / DC-A",
    position: { x: 80, y: 200 },
  },
  {
    id: "R2",
    label: "R2",
    kind: "router",
    ip: "10.0.0.2",
    model: "vRouter-2000",
    location: "Edge / DC-A",
    position: { x: 320, y: 120 },
  },
  {
    id: "R3",
    label: "R3",
    kind: "router",
    ip: "10.0.0.3",
    model: "vRouter-2000",
    location: "Edge / DC-B",
    position: { x: 320, y: 320 },
  },
  {
    id: "R4",
    label: "R4",
    kind: "router",
    ip: "10.0.0.4",
    model: "vRouter-3000",
    location: "Core / DC-B",
    position: { x: 580, y: 220 },
  },
  {
    id: "H1",
    label: "H1",
    kind: "host",
    ip: "10.0.1.10",
    model: "App-Server",
    location: "Tenant A",
    position: { x: 80, y: 420 },
  },
  {
    id: "H2",
    label: "H2",
    kind: "host",
    ip: "10.0.2.10",
    model: "App-Server",
    location: "Tenant B",
    position: { x: 580, y: 420 },
  },
];

export const seedEdges: NetEdge[] = [
  { id: "e-R1-R2", source: "R1", target: "R2", baseLatency: 4, bandwidth: 1000 },
  { id: "e-R2-R4", source: "R2", target: "R4", baseLatency: 8, bandwidth: 1000 },
  { id: "e-R2-R3", source: "R2", target: "R3", baseLatency: 6, bandwidth: 1000 },
  { id: "e-R3-R4", source: "R3", target: "R4", baseLatency: 10, bandwidth: 1000 },
  { id: "e-R1-H1", source: "R1", target: "H1", baseLatency: 2, bandwidth: 1000 },
  { id: "e-R4-H2", source: "R4", target: "H2", baseLatency: 2, bandwidth: 1000 },
];
