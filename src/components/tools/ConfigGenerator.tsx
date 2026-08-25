"use client";

import { useMemo, useState } from "react";
import { Copy, Download, Check } from "lucide-react";
import { useNetTwin } from "@/lib/store";
import { generateDeviceConfig, generateAllConfigs } from "@/lib/configGen";
import { toast } from "@/lib/toastStore";
import { Button } from "../ui/Button";

function download(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ConfigGenerator() {
  const nodes = useNetTwin((s) => s.nodes);
  const edges = useNetTwin((s) => s.edges);
  const [selectedId, setSelectedId] = useState<string | null>(nodes[0]?.id ?? null);
  const [copied, setCopied] = useState(false);

  const selected = nodes.find((n) => n.id === selectedId) ?? nodes[0] ?? null;
  const config = useMemo(
    () => (selected ? generateDeviceConfig(selected, edges, nodes) : ""),
    [selected, edges, nodes]
  );

  async function copyConfig() {
    try {
      await navigator.clipboard.writeText(config);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.danger("Could not copy", "Clipboard access was blocked by the browser");
    }
  }

  function downloadAll() {
    const all = generateAllConfigs(nodes, edges);
    const text = all.map(({ config }) => config).join("\n\n! " + "=".repeat(40) + "\n\n");
    download(text, "nettwin-all-configs.txt");
  }

  if (nodes.length === 0) {
    return <div className="text-[11px] text-text-faint px-1">Add a device to generate a config.</div>;
  }

  return (
    <div className="space-y-2.5">
      <select
        value={selected?.id ?? ""}
        onChange={(e) => setSelectedId(e.target.value)}
        className="w-full text-xs rounded-lg border border-border bg-surface-2 px-3 py-2 text-text outline-none focus:border-accent"
      >
        {nodes.map((n) => (
          <option key={n.id} value={n.id}>
            {n.label} ({n.kind})
          </option>
        ))}
      </select>

      <pre className="text-[10.5px] font-mono leading-relaxed rounded-lg border border-border bg-surface-2 p-3 overflow-x-auto max-h-64 overflow-y-auto text-text-muted whitespace-pre">
        {config}
      </pre>

      <div className="flex gap-2">
        <Button onClick={copyConfig} className="flex-1">
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
        </Button>
        <Button onClick={() => download(config, `${selected?.label ?? "device"}.cfg`)} className="flex-1">
          <Download size={13} /> Download
        </Button>
      </div>
      <button
        onClick={downloadAll}
        className="w-full text-[11px] text-text-faint hover:text-text underline underline-offset-2"
      >
        Download all device configs (.txt)
      </button>
    </div>
  );
}
