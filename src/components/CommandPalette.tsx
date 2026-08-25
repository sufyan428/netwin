"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Router,
  Server,
  Link2,
  Undo2,
  Redo2,
  RotateCcw,
  SunMoon,
  Keyboard,
  ZapOff,
  FolderOpen,
  Search,
} from "lucide-react";
import { useNetTwin } from "@/lib/store";
import { useUI } from "@/lib/uiStore";
import { useTheme } from "@/lib/useTheme";
import { Modal } from "./ui/Modal";
import { Kbd } from "./ui/Kbd";
import { cn } from "@/lib/cn";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: typeof Router;
  run: () => void;
}

export default function CommandPalette() {
  const paletteOpen = useUI((s) => s.paletteOpen);
  const setPaletteOpen = useUI((s) => s.setPaletteOpen);
  const setShortcutsOpen = useUI((s) => s.setShortcutsOpen);
  const setProjectsOpen = useUI((s) => s.setProjectsOpen);
  const setSidebarTab = useUI((s) => s.setSidebarTab);

  const nodes = useNetTwin((s) => s.nodes);
  const edges = useNetTwin((s) => s.edges);
  const addNode = useNetTwin((s) => s.addNode);
  const setLinkMode = useNetTwin((s) => s.setLinkMode);
  const linkMode = useNetTwin((s) => s.linkMode);
  const undo = useNetTwin((s) => s.undo);
  const redo = useNetTwin((s) => s.redo);
  const clearWhatIf = useNetTwin((s) => s.clearWhatIf);
  const runWhatIf = useNetTwin((s) => s.runWhatIf);
  const { toggle: toggleTheme } = useTheme();

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const base: Command[] = [
      { id: "add-router", label: "Add router", hint: "R", icon: Router, run: () => addNode("router") },
      { id: "add-host", label: "Add host", hint: "H", icon: Server, run: () => addNode("host") },
      {
        id: "link-mode",
        label: linkMode ? "Exit link mode" : "Enter link mode (drag between devices)",
        hint: "L",
        icon: Link2,
        run: () => setLinkMode(!linkMode),
      },
      { id: "undo", label: "Undo", hint: "⌘Z", icon: Undo2, run: undo },
      { id: "redo", label: "Redo", hint: "⌘⇧Z", icon: Redo2, run: redo },
      { id: "restore", label: "Restore network to normal", icon: RotateCcw, run: clearWhatIf },
      { id: "theme", label: "Toggle light / dark theme", icon: SunMoon, run: toggleTheme },
      { id: "shortcuts", label: "Show keyboard shortcuts", hint: "?", icon: Keyboard, run: () => setShortcutsOpen(true) },
      { id: "projects", label: "Open projects (save / load / export)", icon: FolderOpen, run: () => setProjectsOpen(true) },
      { id: "tab-tools", label: "Open network tools (subnet calculator, config generator)", icon: Search, run: () => setSidebarTab("tools") },
    ];
    for (const n of nodes.filter((n) => n.kind === "router")) {
      base.push({
        id: `fail-node-${n.id}`,
        label: `What-if: fail ${n.label}`,
        icon: ZapOff,
        run: () => runWhatIf("router-fail", n.id),
      });
    }
    for (const e of edges) {
      base.push({
        id: `fail-edge-${e.id}`,
        label: `What-if: break link ${e.source} ↔ ${e.target}`,
        icon: ZapOff,
        run: () => runWhatIf("link-fail", e.id),
      });
    }
    return base;
  }, [
    nodes,
    edges,
    linkMode,
    addNode,
    setLinkMode,
    undo,
    redo,
    clearWhatIf,
    toggleTheme,
    setShortcutsOpen,
    setProjectsOpen,
    setSidebarTab,
    runWhatIf,
  ]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  // Reset the highlighted row whenever the query or open-state changes, and
  // clear the query on close — adjusted during render (React's recommended
  // pattern for state derived from a changing value) rather than an effect.
  const [prevQuery, setPrevQuery] = useState(query);
  const [prevOpen, setPrevOpen] = useState(paletteOpen);
  if (paletteOpen !== prevOpen) {
    setPrevOpen(paletteOpen);
    setActive(0);
    if (!paletteOpen) setQuery("");
  } else if (query !== prevQuery) {
    setPrevQuery(query);
    setActive(0);
  }

  useEffect(() => {
    if (!paletteOpen) return;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [paletteOpen]);

  function close() {
    setPaletteOpen(false);
  }

  function exec(cmd: Command) {
    cmd.run();
    close();
  }

  return (
    <Modal open={paletteOpen} onClose={close} align="top" className="max-w-md">
      <div className="flex items-center gap-2 px-3.5 py-3 border-b border-border">
        <Search size={15} className="text-text-faint shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const cmd = filtered[active];
              if (cmd) exec(cmd);
            }
          }}
          placeholder="Type a command…"
          className="flex-1 bg-transparent text-sm text-text placeholder-text-faint outline-none"
        />
        <Kbd>esc</Kbd>
      </div>
      <div className="max-h-80 overflow-y-auto p-1.5">
        {filtered.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-text-faint">No matching commands</div>
        )}
        {filtered.map((cmd, i) => {
          const Icon = cmd.icon;
          return (
            <button
              key={cmd.id}
              onMouseEnter={() => setActive(i)}
              onClick={() => exec(cmd)}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-[13px] transition-colors",
                i === active ? "bg-surface-hover text-text" : "text-text-muted"
              )}
            >
              <Icon size={14} className="shrink-0 text-text-faint" />
              <span className="flex-1 truncate">{cmd.label}</span>
              {cmd.hint && <Kbd>{cmd.hint}</Kbd>}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
