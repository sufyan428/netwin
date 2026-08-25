"use client";

import dynamic from "next/dynamic";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import SimulationBanner from "@/components/SimulationBanner";
import Inspector from "@/components/Inspector";
import CommandPalette from "@/components/CommandPalette";
import ShortcutsHelp from "@/components/ShortcutsHelp";
import ProjectsModal from "@/components/ProjectsModal";
import { Toaster } from "@/components/ui/Toaster";
import { useGlobalShortcuts } from "@/lib/useGlobalShortcuts";

const NetworkCanvas = dynamic(() => import("@/components/NetworkCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center text-text-faint text-sm">
      Loading network canvas…
    </div>
  ),
});

export default function Home() {
  useGlobalShortcuts();

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-bg">
      <Header />
      <div className="flex-1 flex min-h-0 relative">
        <Sidebar />
        <main className="flex-1 relative min-w-0">
          <NetworkCanvas />
          <SimulationBanner />
          <Inspector />
        </main>
      </div>
      <CommandPalette />
      <ShortcutsHelp />
      <ProjectsModal />
      <Toaster />
    </div>
  );
}
