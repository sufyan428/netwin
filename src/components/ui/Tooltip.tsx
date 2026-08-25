import { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Tooltip({
  label,
  children,
  side = "bottom",
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
}) {
  return (
    <span className={cn("group relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 -translate-x-1/2 z-50 whitespace-nowrap",
          "rounded-md border border-border bg-surface-2 px-2 py-1 text-[10px] font-medium text-text shadow-md",
          "opacity-0 scale-95 transition-all duration-100 group-hover:opacity-100 group-hover:scale-100",
          side === "bottom" ? "top-[calc(100%+6px)]" : "bottom-[calc(100%+6px)]"
        )}
      >
        {label}
      </span>
    </span>
  );
}
