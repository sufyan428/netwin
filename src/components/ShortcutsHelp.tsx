"use client";

import { useUI } from "@/lib/uiStore";
import { Modal } from "./ui/Modal";
import { Kbd } from "./ui/Kbd";

const groups: { title: string; items: [string, string][] }[] = [
  {
    title: "Topology",
    items: [
      ["R", "Add router"],
      ["H", "Add host"],
      ["L", "Toggle link mode"],
      ["Delete / Backspace", "Delete selected device or link"],
    ],
  },
  {
    title: "History",
    items: [
      ["⌘/Ctrl Z", "Undo"],
      ["⌘/Ctrl ⇧ Z", "Redo"],
    ],
  },
  {
    title: "General",
    items: [
      ["⌘/Ctrl K", "Open command palette"],
      ["?", "Toggle this shortcuts panel"],
      ["Esc", "Close panel / deselect"],
    ],
  },
];

export default function ShortcutsHelp() {
  const open = useUI((s) => s.shortcutsOpen);
  const setOpen = useUI((s) => s.setShortcutsOpen);

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Keyboard shortcuts" className="max-w-sm">
      <div className="p-4 space-y-4">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="text-[10px] uppercase tracking-wider text-text-faint mb-1.5">
              {g.title}
            </div>
            <div className="space-y-1.5">
              {g.items.map(([key, desc]) => (
                <div key={desc} className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">{desc}</span>
                  <Kbd className="w-auto px-2">{key}</Kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
