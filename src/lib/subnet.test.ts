import { describe, it, expect } from "vitest";
import {
  ipToInt,
  intToIp,
  isValidIpv4,
  parseCidr,
  calcSubnet,
  cidrsOverlap,
  planVlsm,
  isPrivateIp,
  ipClassOf,
} from "./subnet";

describe("isValidIpv4", () => {
  it("accepts valid addresses", () => {
    expect(isValidIpv4("10.0.0.1")).toBe(true);
    expect(isValidIpv4("255.255.255.255")).toBe(true);
    expect(isValidIpv4("0.0.0.0")).toBe(true);
  });
  it("rejects invalid addresses", () => {
    expect(isValidIpv4("256.0.0.1")).toBe(false);
    expect(isValidIpv4("10.0.0")).toBe(false);
    expect(isValidIpv4("10.0.0.0.1")).toBe(false);
    expect(isValidIpv4("abc.0.0.1")).toBe(false);
  });
});

describe("ipToInt / intToIp round-trip", () => {
  it("round-trips a range of addresses", () => {
    for (const ip of ["0.0.0.0", "10.0.0.1", "192.168.1.1", "255.255.255.255"]) {
      expect(intToIp(ipToInt(ip))).toBe(ip);
    }
  });
});

describe("parseCidr", () => {
  it("parses a valid CIDR", () => {
    expect(parseCidr("10.0.0.0/24")).toEqual({ ip: "10.0.0.0", prefix: 24 });
  });
  it("throws on malformed input", () => {
    expect(() => parseCidr("not-a-cidr")).toThrow();
    expect(() => parseCidr("10.0.0.0/33")).toThrow();
    expect(() => parseCidr("10.0.0.0")).toThrow();
  });
});

describe("calcSubnet", () => {
  it("computes a standard /24", () => {
    const s = calcSubnet("10.0.0.0/24");
    expect(s.network).toBe("10.0.0.0");
    expect(s.broadcast).toBe("10.0.0.255");
    expect(s.mask).toBe("255.255.255.0");
    expect(s.wildcard).toBe("0.0.0.255");
    expect(s.firstHost).toBe("10.0.0.1");
    expect(s.lastHost).toBe("10.0.0.254");
    expect(s.usableHosts).toBe(254);
    expect(s.totalAddresses).toBe(256);
  });

  it("normalizes a non-network-aligned address to its network", () => {
    const s = calcSubnet("10.0.0.130/25");
    expect(s.network).toBe("10.0.0.128");
    expect(s.broadcast).toBe("10.0.0.255");
  });

  it("handles /31 as a 2-host point-to-point link (RFC 3021)", () => {
    const s = calcSubnet("10.0.0.0/31");
    expect(s.usableHosts).toBe(2);
    expect(s.broadcast).toBeNull();
    expect(s.firstHost).toBe("10.0.0.0");
    expect(s.lastHost).toBe("10.0.0.1");
  });

  it("handles /32 as a single host", () => {
    const s = calcSubnet("10.0.0.5/32");
    expect(s.usableHosts).toBe(1);
    expect(s.firstHost).toBe("10.0.0.5");
    expect(s.lastHost).toBe("10.0.0.5");
  });

  it("classifies RFC1918 space as private", () => {
    expect(calcSubnet("10.0.0.0/24").isPrivate).toBe(true);
    expect(calcSubnet("172.16.0.0/24").isPrivate).toBe(true);
    expect(calcSubnet("192.168.1.0/24").isPrivate).toBe(true);
    expect(calcSubnet("8.8.8.0/24").isPrivate).toBe(false);
  });
});

describe("ipClassOf", () => {
  it("classifies legacy address classes", () => {
    expect(ipClassOf("10.0.0.1")).toBe("A");
    expect(ipClassOf("172.16.0.1")).toBe("B");
    expect(ipClassOf("192.168.0.1")).toBe("C");
  });
});

describe("isPrivateIp", () => {
  it("flags loopback as private too", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
  });
});

describe("cidrsOverlap", () => {
  it("detects overlap when one contains the other", () => {
    expect(cidrsOverlap("10.0.0.0/24", "10.0.0.128/25")).toBe(true);
  });
  it("detects no overlap for disjoint ranges", () => {
    expect(cidrsOverlap("10.0.0.0/24", "10.0.1.0/24")).toBe(false);
  });
  it("detects overlap for identical ranges", () => {
    expect(cidrsOverlap("10.0.0.0/24", "10.0.0.0/24")).toBe(true);
  });
});

describe("planVlsm", () => {
  it("allocates largest-first without overlap, within the base network", () => {
    const { allocations, error } = planVlsm("10.0.0.0/24", [
      { id: "a", name: "Sales", hosts: 100 },
      { id: "b", name: "Eng", hosts: 50 },
      { id: "c", name: "WAN", hosts: 2 },
    ]);
    expect(error).toBeNull();
    expect(allocations).toHaveLength(3);
    // Sales (100 hosts) needs a /25 (126 usable) and must come first (100 > 50 > 2)
    expect(allocations[0].name).toBe("Sales");
    expect(allocations[0].prefix).toBe(25);
    expect(allocations[0].usableHosts).toBeGreaterThanOrEqual(100);

    // No two allocations should overlap
    for (let i = 0; i < allocations.length; i++) {
      for (let j = i + 1; j < allocations.length; j++) {
        expect(cidrsOverlap(allocations[i].cidr, allocations[j].cidr)).toBe(false);
      }
    }

    // Every allocation must fit inside the base /24
    for (const a of allocations) {
      expect(cidrsOverlap(a.cidr, "10.0.0.0/24")).toBe(true);
    }
  });

  it("returns an error when the base network is too small", () => {
    const { error } = planVlsm("10.0.0.0/28", [{ id: "a", name: "Too big", hosts: 1000 }]);
    expect(error).not.toBeNull();
  });

  it("allocates a /31 point-to-point block for a 2-host WAN link", () => {
    const { allocations } = planVlsm("10.0.0.0/24", [{ id: "a", name: "WAN", hosts: 2 }]);
    expect(allocations[0].prefix).toBe(31);
  });
});
