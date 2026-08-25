"use client";

import { ReactNode, useState } from "react";
import { ChevronDown, ImageDown, Calculator, Network, ShieldCheck, FileCode2 } from "lucide-react";
import { useNetTwin } from "@/lib/store";
import { exportDiagramPng } from "@/lib/diagramExport";
import { toast } from "@/lib/toastStore";
import { Button } from "./ui/Button";
import { cn } from "@/lib/cn";
import SubnetCalculator from "./tools/SubnetCalculator";
import VlsmPlanner from "./tools/VlsmPlanner";
import HealthChecks from "./tools/HealthChecks";
import ConfigGenerator from "./tools/ConfigGenerator";

function Section({
  title,
  icon: Icon,
  defaultOpen,
  children,
}: {
  title: string;
  icon: typeof Calculator;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-surface-hover transition-colors"
      >
        <Icon size={13} className="text-text-faint shrink-0" />
        <span className="text-xs font-medium text-text flex-1">{title}</span>
        <ChevronDown
          size={13}
          className={cn("text-text-faint transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function NetworkTools() {
  const nodes = useNetTwin((s) => s.nodes);

  async function handleExportPng() {
    try {
      await exportDiagramPng(nodes);
    } catch (err) {
      toast.danger("Export failed", err instanceof Error ? err.message : "Try again");
    }
  }

  return (
    <div>
      <Section title="Subnet / CIDR calculator" icon={Calculator} defaultOpen>
        <SubnetCalculator />
      </Section>
      <Section title="VLSM planner" icon={Network}>
        <VlsmPlanner />
      </Section>
      <Section title="Health checks" icon={ShieldCheck} defaultOpen>
        <HealthChecks />
      </Section>
      <Section title="Config generator" icon={FileCode2}>
        <ConfigGenerator />
      </Section>
      <div className="p-4">
        <Button onClick={handleExportPng} className="w-full">
          <ImageDown size={13} /> Export diagram as PNG
        </Button>
      </div>
    </div>
  );
}
