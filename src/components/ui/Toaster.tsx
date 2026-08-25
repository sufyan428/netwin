"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from "lucide-react";
import { useToastStore, ToastKind } from "@/lib/toastStore";
import { tone } from "@/lib/theme";
import { IconButton } from "./Button";

const iconFor: Record<ToastKind, typeof CheckCircle2> = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  danger: XCircle,
};

const colorFor: Record<ToastKind, string> = {
  success: tone.success,
  info: tone.accent2,
  warning: tone.warning,
  danger: tone.danger,
};

export function Toaster() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 w-[min(380px,calc(100vw-2rem))] pointer-events-none">
      <AnimatePresence>
        {items.map((t) => {
          const Icon = iconFor[t.kind];
          const color = colorFor[t.kind];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-3 shadow-lg"
            >
              <Icon size={16} style={{ color }} className="shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-text">{t.title}</div>
                {t.description && (
                  <div className="text-[11px] text-text-muted mt-0.5 leading-snug">
                    {t.description}
                  </div>
                )}
              </div>
              <IconButton
                size="sm"
                className="w-5 h-5 -mt-0.5 -mr-0.5"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
              >
                <X size={12} />
              </IconButton>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
