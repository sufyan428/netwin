"use client";

import { useState } from "react";
import {
  Router,
  Server,
  Link2,
  Undo2,
  Redo2,
  RotateCcw,
  SunMoon,
  Command,
  Menu,
  MoreHorizontal,
  FolderOpen,
  Network,
} from "lucide-react";
import { useNetTwin } from "@/lib/store";
import { useUI } from "@/lib/uiStore";
import { useTheme } from "@/lib/useTheme";
import { Badge } from "./ui/Badge";
import { IconButton, Button } from "./ui/Button";
import { Tooltip } from "./ui/Tooltip";
import { riskTone, riskLabel, statusTone, statusLabel } from "@/lib/statusColors";

export default function Header() {
  const status = useNetTwin((s) => s.analysis.status);
  const risk = useNetTwin((s) => s.analysis.risk);
  const hasSim = useNetTwin(
    (s) =>
      s.simulation.failedEdgeIds.length > 0 ||
      s.simulation.failedNodeIds.length > 0 ||
      Object.keys(s.simulation.latencyOverrides).length > 0 ||
      Object.keys(s.simulation.bandwidthOverrides).length > 0
  );
  const clearWhatIf = useNetTwin((s) => s.clearWhatIf);
  const addNode = useNetTwin((s) => s.addNode);
  const linkMode = useNetTwin((s) => s.linkMode);
  const setLinkMode = useNetTwin((s) => s.setLinkMode);
  const undo = useNetTwin((s) => s.undo);
  const redo = useNetTwin((s) => s.redo);
  const canUndo = useNetTwin((s) => s.past.length > 0);
  const canRedo = useNetTwin((s) => s.future.length > 0);

  const setPaletteOpen = useUI((s) => s.setPaletteOpen);
  const setProjectsOpen = useUI((s) => s.setProjectsOpen);
  const sidebarCollapsed = useUI((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUI((s) => s.setSidebarCollapsed);
  const { theme, toggle: toggleTheme } = useTheme();

  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <header className="h-14 shrink-0 flex items-center justify-between gap-2 px-3 sm:px-5 border-b border-border bg-surface">
      <div className="flex items-center gap-2 min-w-0">
        <IconButton
          className="md:hidden"
          aria-label="Toggle sidebar"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          <Menu size={16} />
        </IconButton>
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border"
            style={{ borderColor: "var(--accent)", background: "var(--surface-2)" }}
          >
            <Network size={14} strokeWidth={2.25} color="var(--accent)" />
          </div>
          <div className="leading-none min-w-0">
            <div className="text-[15px] font-semibold tracking-tight truncate">NetTwin</div>
            <div className="text-[10px] text-text-faint mt-0.5 truncate uppercase tracking-wider">
              Network Digital Twin
            </div>
          </div>
        </div>
      </div>

      {/* Desktop toolbar */}
      <div className="hidden md:flex items-center gap-2">
        <div className="flex items-center gap-1.5 pr-2 mr-1 border-r border-border">
          <Tooltip label="Add router (R)">
            <Button onClick={() => addNode("router")}>
              <Router size={13} /> Router
            </Button>
          </Tooltip>
          <Tooltip label="Add host (H)">
            <Button onClick={() => addNode("host")}>
              <Server size={13} /> Host
            </Button>
          </Tooltip>
          <Tooltip label="Link mode (L)">
            <Button
              variant={linkMode ? "primary" : "secondary"}
              onClick={() => setLinkMode(!linkMode)}
            >
              <Link2 size={13} /> Link
            </Button>
          </Tooltip>
        </div>

        <div className="flex items-center gap-1 pr-2 mr-1 border-r border-border">
          <Tooltip label="Undo (⌘Z)">
            <IconButton disabled={!canUndo} onClick={undo} aria-label="Undo">
              <Undo2 size={15} />
            </IconButton>
          </Tooltip>
          <Tooltip label="Redo (⌘⇧Z)">
            <IconButton disabled={!canRedo} onClick={redo} aria-label="Redo">
              <Redo2 size={15} />
            </IconButton>
          </Tooltip>
        </div>

        {hasSim && <Badge color={riskTone[risk]}>Risk: {riskLabel[risk]}</Badge>}
        <Badge color={statusTone[status]} pulse>
          {statusLabel[status]}
        </Badge>

        <Button onClick={clearWhatIf} disabled={!hasSim}>
          <RotateCcw size={13} /> Restore
        </Button>
      </div>

      <div className="flex items-center gap-1.5">
        <Tooltip label="Projects">
          <IconButton className="hidden sm:inline-flex" onClick={() => setProjectsOpen(true)} aria-label="Projects">
            <FolderOpen size={15} />
          </IconButton>
        </Tooltip>
        <Tooltip label="Command palette (⌘K)">
          <Button variant="secondary" onClick={() => setPaletteOpen(true)} className="hidden sm:inline-flex">
            <Command size={13} />
            <span className="hidden lg:inline">Commands</span>
          </Button>
        </Tooltip>
        <Tooltip label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>
          <IconButton onClick={toggleTheme} aria-label="Toggle theme">
            <SunMoon size={15} />
          </IconButton>
        </Tooltip>
        <IconButton
          className="md:hidden"
          aria-label="More actions"
          onClick={() => setMobileMenu((v) => !v)}
        >
          <MoreHorizontal size={15} />
        </IconButton>
      </div>

      {/* Mobile toolbar drawer */}
      {mobileMenu && (
        <div className="absolute top-14 left-0 right-0 z-30 flex flex-wrap gap-1.5 p-2.5 border-b border-border bg-surface md:hidden">
          <Button onClick={() => addNode("router")}>
            <Router size={13} /> Router
          </Button>
          <Button onClick={() => addNode("host")}>
            <Server size={13} /> Host
          </Button>
          <Button variant={linkMode ? "primary" : "secondary"} onClick={() => setLinkMode(!linkMode)}>
            <Link2 size={13} /> Link
          </Button>
          <IconButton disabled={!canUndo} onClick={undo} aria-label="Undo">
            <Undo2 size={15} />
          </IconButton>
          <IconButton disabled={!canRedo} onClick={redo} aria-label="Redo">
            <Redo2 size={15} />
          </IconButton>
          <Button onClick={clearWhatIf} disabled={!hasSim}>
            <RotateCcw size={13} /> Restore
          </Button>
          <Badge color={statusTone[status]} pulse>
            {statusLabel[status]}
          </Badge>
        </div>
      )}
    </header>
  );
}
