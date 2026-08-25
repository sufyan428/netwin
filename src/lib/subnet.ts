// Pure IPv4 subnet math — no framework dependencies, fully unit-testable.

export function isValidIpv4(ip: string): boolean {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
}

export function ipToInt(ip: string): number {
  const parts = ip.trim().split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    throw new Error(`Invalid IPv4 address: "${ip}"`);
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

export function intToIp(n: number): string {
  return [24, 16, 8, 0].map((shift) => (n >>> shift) & 255).join(".");
}

export function maskFromPrefix(prefix: number): string {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return intToIp(mask);
}

export function wildcardFromPrefix(prefix: number): string {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return intToIp((~mask) >>> 0);
}

export interface ParsedCidr {
  ip: string;
  prefix: number;
}

export function parseCidr(input: string): ParsedCidr {
  const trimmed = input.trim();
  const match = trimmed.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/);
  if (!match) {
    throw new Error('Enter an address in CIDR form, e.g. "10.0.0.0/24"');
  }
  const [, ip, prefixStr] = match;
  const prefix = Number(prefixStr);
  if (!isValidIpv4(ip)) throw new Error(`Invalid IPv4 address: "${ip}"`);
  if (prefix < 0 || prefix > 32) throw new Error(`Prefix must be between 0 and 32, got /${prefix}`);
  return { ip, prefix };
}

export function ipClassOf(ip: string): "A" | "B" | "C" | "D" | "E" {
  const first = Number(ip.split(".")[0]);
  if (first < 128) return "A";
  if (first < 192) return "B";
  if (first < 224) return "C";
  if (first < 240) return "D";
  return "E";
}

export function isPrivateIp(ip: string): boolean {
  const n = ipToInt(ip);
  const inRange = (base: string, prefix: number) => {
    const b = ipToInt(base);
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (n & mask) === (b & mask);
  };
  return (
    inRange("10.0.0.0", 8) ||
    inRange("172.16.0.0", 12) ||
    inRange("192.168.0.0", 16) ||
    inRange("127.0.0.0", 8)
  );
}

export interface SubnetInfo {
  input: string;
  ip: string;
  prefix: number;
  mask: string;
  wildcard: string;
  network: string;
  broadcast: string | null;
  firstHost: string | null;
  lastHost: string | null;
  totalAddresses: number;
  usableHosts: number;
  ipClass: "A" | "B" | "C" | "D" | "E";
  isPrivate: boolean;
}

export function calcSubnet(input: string): SubnetInfo {
  const { ip, prefix } = parseCidr(input);
  const ipInt = ipToInt(ip);
  const maskInt = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const networkInt = (ipInt & maskInt) >>> 0;
  const totalAddresses = Math.pow(2, 32 - prefix);
  const broadcastInt = prefix >= 31 ? null : (networkInt + totalAddresses - 1) >>> 0;

  let firstHost: string | null;
  let lastHost: string | null;
  let usableHosts: number;

  if (prefix === 32) {
    firstHost = intToIp(networkInt);
    lastHost = intToIp(networkInt);
    usableHosts = 1;
  } else if (prefix === 31) {
    firstHost = intToIp(networkInt);
    lastHost = intToIp((networkInt + 1) >>> 0);
    usableHosts = 2;
  } else {
    firstHost = intToIp((networkInt + 1) >>> 0);
    lastHost = intToIp((broadcastInt as number) - 1);
    usableHosts = Math.max(totalAddresses - 2, 0);
  }

  return {
    input,
    ip,
    prefix,
    mask: maskFromPrefix(prefix),
    wildcard: wildcardFromPrefix(prefix),
    network: intToIp(networkInt),
    broadcast: broadcastInt !== null ? intToIp(broadcastInt) : null,
    firstHost,
    lastHost,
    totalAddresses,
    usableHosts,
    ipClass: ipClassOf(ip),
    isPrivate: isPrivateIp(ip),
  };
}

export function cidrsOverlap(a: string, b: string): boolean {
  const pa = parseCidr(a);
  const pb = parseCidr(b);
  // Normalize both addresses down to the coarser (smaller-prefix, i.e. wider)
  // of the two networks, then compare — this is the correct containment
  // check. (Masking each to its OWN prefix and comparing under the more
  // specific mask, as an earlier version of this function did, incorrectly
  // reports a smaller subnet nested inside a larger one as non-overlapping.)
  const widerPrefix = Math.min(pa.prefix, pb.prefix);
  const mask = widerPrefix === 0 ? 0 : (0xffffffff << (32 - widerPrefix)) >>> 0;
  const aNet = (ipToInt(pa.ip) & mask) >>> 0;
  const bNet = (ipToInt(pb.ip) & mask) >>> 0;
  return aNet === bNet;
}

// ---- VLSM planner ----
export interface VlsmRequest {
  id: string;
  name: string;
  hosts: number;
}

export interface VlsmAllocation {
  id: string;
  name: string;
  hostsRequested: number;
  prefix: number;
  cidr: string;
  network: string;
  broadcast: string | null;
  firstHost: string | null;
  lastHost: string | null;
  usableHosts: number;
}

// Smallest prefix length whose usable-host count covers `hosts`.
function prefixForHosts(hosts: number): number {
  if (hosts <= 0) return 32;
  if (hosts === 1) return 32;
  if (hosts === 2) return 31;
  let prefix = 30;
  while (prefix > 0 && Math.pow(2, 32 - prefix) - 2 < hosts) prefix -= 1;
  return prefix;
}

export function planVlsm(
  baseCidrInput: string,
  requests: VlsmRequest[]
): { allocations: VlsmAllocation[]; error: string | null } {
  const base = parseCidr(baseCidrInput);
  const baseMask = base.prefix === 0 ? 0 : (0xffffffff << (32 - base.prefix)) >>> 0;
  const baseNetworkInt = (ipToInt(base.ip) & baseMask) >>> 0;
  const baseSize = Math.pow(2, 32 - base.prefix);
  const baseEnd = (baseNetworkInt + baseSize - 1) >>> 0;

  const sorted = [...requests].filter((r) => r.hosts > 0).sort((a, b) => b.hosts - a.hosts);

  let cursor = baseNetworkInt;
  const allocations: VlsmAllocation[] = [];

  for (const req of sorted) {
    const prefix = prefixForHosts(req.hosts);
    const size = Math.pow(2, 32 - prefix);
    // align cursor up to a boundary for this block size
    const aligned = Math.ceil(cursor / size) * size;
    const networkInt = aligned;
    const endInt = networkInt + size - 1;

    if (endInt > baseEnd) {
      return {
        allocations,
        error: `Base network ${baseCidrInput} is too small — ran out of space allocating "${req.name}" (${req.hosts} hosts).`,
      };
    }

    const broadcastInt = prefix >= 31 ? null : networkInt + size - 1;
    let firstHost: string | null;
    let lastHost: string | null;
    let usableHosts: number;
    if (prefix === 32) {
      firstHost = intToIp(networkInt);
      lastHost = intToIp(networkInt);
      usableHosts = 1;
    } else if (prefix === 31) {
      firstHost = intToIp(networkInt);
      lastHost = intToIp(networkInt + 1);
      usableHosts = 2;
    } else {
      firstHost = intToIp(networkInt + 1);
      lastHost = intToIp((broadcastInt as number) - 1);
      usableHosts = size - 2;
    }

    allocations.push({
      id: req.id,
      name: req.name,
      hostsRequested: req.hosts,
      prefix,
      cidr: `${intToIp(networkInt)}/${prefix}`,
      network: intToIp(networkInt),
      broadcast: broadcastInt !== null ? intToIp(broadcastInt) : null,
      firstHost,
      lastHost,
      usableHosts,
    });

    cursor = networkInt + size;
  }

  return { allocations, error: null };
}
