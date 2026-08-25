"use client";

import { useEffect } from "react";
import { useNetTwin } from "./store";
import { useUI } from "./uiStore";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

// Mounted once (page.tsx). Handles global keyboard shortcuts everywhere
// except when the user is typing in a text field.
export function useGlobalShortcuts() {
  const addNode = useNetTwin((s) => s.addNode);
  const setLinkMode = useNetTwin((s) => s.setLinkMode);
  const linkMode = useNetTwin((s) => s.linkMode);
  const undo = useNetTwin((s) => s.undo);
  const redo = useNetTwin((s) => s.redo);
  const selectNode = useNetTwin((s) => s.selectNode);
  const selectEdge = useNetTwin((s) => s.selectEdge);

  const paletteOpen = useUI((s) => s.paletteOpen);
  const shortcutsOpen = useUI((s) => s.shortcutsOpen);
  const setPaletteOpen = useUI((s) => s.setPaletteOpen);
  const setShortcutsOpen = useUI((s) => s.setShortcutsOpen);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
        return;
      }

      if (isTypingTarget(e.target)) return;

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(!shortcutsOpen);
        return;
      }
      if (e.key === "Escape") {
        if (paletteOpen) setPaletteOpen(false);
        else if (shortcutsOpen) setShortcutsOpen(false);
        else {
          selectNode(null);
          selectEdge(null);
        }
        return;
      }
      if (paletteOpen || shortcutsOpen) return;

      if (e.key.toLowerCase() === "r" && !mod) {
        addNode("router");
      } else if (e.key.toLowerCase() === "h" && !mod) {
        addNode("host");
      } else if (e.key.toLowerCase() === "l" && !mod) {
        setLinkMode(!linkMode);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    addNode,
    setLinkMode,
    linkMode,
    undo,
    redo,
    selectNode,
    selectEdge,
    paletteOpen,
    shortcutsOpen,
    setPaletteOpen,
    setShortcutsOpen,
  ]);
}
