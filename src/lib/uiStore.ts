"use client";

import { create } from "zustand";

export type SidebarTab = "network" | "tools" | "ai" | "history";

interface UIState {
  paletteOpen: boolean;
  shortcutsOpen: boolean;
  projectsOpen: boolean;
  sidebarTab: SidebarTab;
  sidebarCollapsed: boolean;
  setPaletteOpen: (v: boolean) => void;
  setShortcutsOpen: (v: boolean) => void;
  setProjectsOpen: (v: boolean) => void;
  setSidebarTab: (t: SidebarTab) => void;
  setSidebarCollapsed: (v: boolean) => void;
}

export const useUI = create<UIState>((set) => ({
  paletteOpen: false,
  shortcutsOpen: false,
  projectsOpen: false,
  sidebarTab: "network",
  sidebarCollapsed: true, // mobile drawer starts closed; md:flex always shows it on desktop
  setPaletteOpen: (v) => set({ paletteOpen: v }),
  setShortcutsOpen: (v) => set({ shortcutsOpen: v }),
  setProjectsOpen: (v) => set({ projectsOpen: v }),
  setSidebarTab: (t) => set({ sidebarTab: t, sidebarCollapsed: false }),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
}));
