"use client";

import { useMemo, useState } from "react";
import { calcSubnet } from "@/lib/subnet";
import { Card } from "../ui/Panel";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[11px] py-1">
      <span className="text-text-faint">{label}</span>
      <span className="font-mono text-text">{value}</span>
    </div>
  );
}

export default function SubnetCalculator() {
  const [input, setInput] = useState("10.0.0.0/24");

  const result = useMemo(() => {
    try {
      return { info: calcSubnet(input), error: null as string | null };
    } catch (err) {
      return { info: null, error: err instanceof Error ? err.message : "Invalid input" };
    }
  }, [input]);

  return (
    <div className="space-y-2.5">
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="10.0.0.0/24"
        className="w-full text-xs font-mono rounded-lg border border-border bg-surface-2 px-3 py-2 text-text placeholder-text-faint outline-none focus:border-accent"
      />
      {result.error ? (
        <div className="text-[11px] text-danger px-1">{result.error}</div>
      ) : (
        result.info && (
          <Card className="p-3">
            <Row label="Network address" value={result.info.network} />
            <Row label="Broadcast" value={result.info.broadcast ?? "n/a"} />
            <Row label="Subnet mask" value={result.info.mask} />
            <Row label="Wildcard mask" value={result.info.wildcard} />
            <Row
              label="Usable host range"
              value={
                result.info.firstHost && result.info.lastHost
                  ? `${result.info.firstHost} – ${result.info.lastHost}`
                  : "n/a"
              }
            />
            <Row label="Usable hosts" value={result.info.usableHosts.toLocaleString()} />
            <Row label="Total addresses" value={result.info.totalAddresses.toLocaleString()} />
            <Row
              label="Class / scope"
              value={`${result.info.ipClass} · ${result.info.isPrivate ? "Private (RFC1918)" : "Public"}`}
            />
          </Card>
        )
      )}
    </div>
  );
}
