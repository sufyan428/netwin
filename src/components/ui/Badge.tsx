import { ReactNode } from "react";
import { softBg } from "@/lib/theme";
import { cn } from "@/lib/cn";

export function Badge({
  color,
  children,
  pulse,
  className,
}: {
  color: string;
  children: ReactNode;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium",
        className
      )}
      style={{ background: softBg(color), color }}
    >
      {pulse && (
        <span
          className="status-pulse w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: color }}
        />
      )}
      {children}
    </div>
  );
}
