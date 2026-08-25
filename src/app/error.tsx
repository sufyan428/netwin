"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[NetTwin] Unhandled error:", error);
  }, [error]);

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-bg text-text px-4">
      <div className="max-w-sm w-full rounded-xl border border-border bg-surface shadow-lg p-6 text-center">
        <div
          className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-4"
          style={{ background: "color-mix(in srgb, var(--danger) 15%, transparent)" }}
        >
          <AlertTriangle size={22} color="var(--danger)" />
        </div>
        <h1 className="text-sm font-semibold text-text mb-1.5">Something went wrong</h1>
        <p className="text-xs text-text-faint leading-relaxed mb-5">
          NetTwin hit an unexpected error rendering this view. Your topology and history are
          still safe in memory — this is a UI glitch, not data loss. Simulation only; nothing
          real was affected.
        </p>
        <Button variant="primary" className="w-full justify-center" onClick={() => retry()}>
          <RotateCcw size={13} /> Try again
        </Button>
        {error.digest && (
          <p className="text-[10px] text-text-faint mt-4 font-mono">Error ref: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
