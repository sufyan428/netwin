import { cn } from "@/lib/cn";

export function Kbd({ className, children }: { className?: string; children: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded border border-border-strong",
        "bg-surface-2 text-[10px] font-mono font-medium text-text-muted",
        className
      )}
    >
      {children}
    </kbd>
  );
}
