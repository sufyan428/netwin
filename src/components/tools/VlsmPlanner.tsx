"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { planVlsm, VlsmRequest } from "@/lib/subnet";
import { Card } from "../ui/Panel";
import { IconButton } from "../ui/Button";

let seq = 0;
function makeId() {
  seq += 1;
  return `req-${seq}`;
}

export default function VlsmPlanner() {
  const [base, setBase] = useState("10.0.0.0/24");
  const [requests, setRequests] = useState<VlsmRequest[]>([
    { id: makeId(), name: "Sales", hosts: 50 },
    { id: makeId(), name: "Engineering", hosts: 25 },
    { id: makeId(), name: "WAN link", hosts: 2 },
  ]);

  const result = useMemo(() => {
    try {
      return { ...planVlsm(base, requests), parseError: null as string | null };
    } catch (err) {
      return {
        allocations: [],
        error: null,
        parseError: err instanceof Error ? err.message : "Invalid base network",
      };
    }
  }, [base, requests]);

  function update(id: string, patch: Partial<VlsmRequest>) {
    setRequests((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRequests((rs) => [...rs, { id: makeId(), name: `Subnet ${rs.length + 1}`, hosts: 10 }]);
  }

  function removeRow(id: string) {
    setRequests((rs) => rs.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-2.5">
      <input
        value={base}
        onChange={(e) => setBase(e.target.value)}
        placeholder="10.0.0.0/24"
        className="w-full text-xs font-mono rounded-lg border border-border bg-surface-2 px-3 py-2 text-text placeholder-text-faint outline-none focus:border-accent"
      />

      <div className="space-y-1.5">
        {requests.map((r) => (
          <div key={r.id} className="flex items-center gap-1.5">
            <input
              value={r.name}
              onChange={(e) => update(r.id, { name: e.target.value })}
              className="flex-1 min-w-0 text-xs rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-text outline-none focus:border-accent"
            />
            <input
              type="number"
              min={1}
              value={r.hosts}
              onChange={(e) => update(r.id, { hosts: Math.max(1, Number(e.target.value) || 1) })}
              className="w-16 text-xs rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-text outline-none focus:border-accent"
            />
            <IconButton variant="danger" onClick={() => removeRow(r.id)} aria-label="Remove">
              <Trash2 size={12} />
            </IconButton>
          </div>
        ))}
      </div>

      <button
        onClick={addRow}
        className="w-full flex items-center justify-center gap-1.5 text-[11px] font-medium text-text-muted hover:text-text py-1.5 rounded-lg border border-dashed border-border hover:border-border-strong transition-colors"
      >
        <Plus size={12} /> Add subnet requirement
      </button>

      {result.parseError && <div className="text-[11px] text-danger px-1">{result.parseError}</div>}
      {result.error && <div className="text-[11px] text-danger px-1">{result.error}</div>}

      {result.allocations.length > 0 && (
        <div className="space-y-1.5">
          {result.allocations.map((a) => (
            <Card key={a.id} className="p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text">{a.name}</span>
                <span className="text-xs font-mono text-accent-2">{a.cidr}</span>
              </div>
              <div className="text-[10px] text-text-faint mt-1 font-mono">
                {a.firstHost} – {a.lastHost} · {a.usableHosts} usable (requested {a.hostsRequested})
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
