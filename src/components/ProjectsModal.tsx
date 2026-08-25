"use client";

import { useRef, useState } from "react";
import { Save, Download, Upload, Trash2, Copy, Pencil, FolderOpen } from "lucide-react";
import { useNetTwin } from "@/lib/store";
import { useUI } from "@/lib/uiStore";
import { toast } from "@/lib/toastStore";
import {
  SavedProject,
  listProjects,
  saveProject,
  deleteProject,
  duplicateProject,
  renameProject,
  exportProjectToFile,
  parseImportedProject,
} from "@/lib/projects";
import { Modal } from "./ui/Modal";
import { Button, IconButton } from "./ui/Button";
import { Card } from "./ui/Panel";

export default function ProjectsModal() {
  const open = useUI((s) => s.projectsOpen);
  const setOpen = useUI((s) => s.setProjectsOpen);

  const nodes = useNetTwin((s) => s.nodes);
  const edges = useNetTwin((s) => s.edges);
  const loadProject = useNetTwin((s) => s.loadProject);

  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [newName, setNewName] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reload the list whenever the modal transitions open — adjusted during
  // render (comparing to the previous render's open state) rather than an
  // effect, since listProjects() is a synchronous localStorage read.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setProjects(listProjects());
  }

  function refresh() {
    setProjects(listProjects());
  }

  function handleSaveNew() {
    const name = newName.trim() || `Untitled ${new Date().toLocaleDateString()}`;
    const p = saveProject(null, name, nodes, edges);
    setActiveId(p.id);
    setNewName("");
    refresh();
    toast.success(`Saved "${name}"`);
  }

  function handleSaveOver(id: string) {
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    saveProject(id, p.name, nodes, edges);
    refresh();
    toast.success(`Updated "${p.name}"`);
  }

  function handleLoad(p: SavedProject) {
    loadProject(p.nodes, p.edges);
    setActiveId(p.id);
    setOpen(false);
  }

  function handleDelete(p: SavedProject) {
    deleteProject(p.id);
    if (activeId === p.id) setActiveId(null);
    refresh();
    toast.info(`Deleted "${p.name}"`);
  }

  function handleDuplicate(p: SavedProject) {
    duplicateProject(p.id);
    refresh();
  }

  function handleRename(p: SavedProject) {
    const name = window.prompt("Rename project", p.name);
    if (!name || !name.trim() || name === p.name) return;
    renameProject(p.id, name.trim());
    refresh();
  }

  function handleExportCurrent() {
    exportProjectToFile("nettwin-project", nodes, edges);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const result = parseImportedProject(text);
      loadProject(result.nodes, result.edges);
      setOpen(false);
      toast.success(`Imported "${result.name}"`);
    } catch (err) {
      toast.danger("Import failed", err instanceof Error ? err.message : "Invalid file");
    }
  }

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Projects" className="max-w-lg">
      <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-faint mb-2">
            Save current topology
          </div>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveNew()}
              placeholder={`Untitled ${new Date().toLocaleDateString()}`}
              className="flex-1 text-xs rounded-lg border border-border bg-surface-2 px-3 py-2 text-text placeholder-text-faint outline-none focus:border-accent"
            />
            <Button variant="primary" onClick={handleSaveNew}>
              <Save size={13} /> Save as new
            </Button>
          </div>
          <div className="flex gap-2 mt-2">
            <Button onClick={handleExportCurrent} className="flex-1">
              <Download size={13} /> Export JSON
            </Button>
            <Button onClick={handleImportClick} className="flex-1">
              <Upload size={13} /> Import JSON
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleImportFile}
            />
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-faint mb-2">
            Saved projects ({projects.length})
          </div>
          {projects.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <FolderOpen size={22} className="text-text-faint" />
              <div className="text-xs text-text-faint max-w-[220px]">
                Nothing saved yet — projects live only in this browser. Save one above, or
                export/import a JSON file to move between machines.
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {projects.map((p) => (
                <Card key={p.id} className="p-2.5 flex items-center gap-2">
                  <button
                    onClick={() => handleLoad(p)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="text-xs font-medium text-text truncate">{p.name}</div>
                    <div className="text-[10px] text-text-faint mt-0.5">
                      {p.nodes.length} devices · {p.edges.length} links ·{" "}
                      {new Date(p.updatedAt).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </button>
                  <IconButton aria-label="Save current over this project" onClick={() => handleSaveOver(p.id)}>
                    <Save size={13} />
                  </IconButton>
                  <IconButton aria-label="Rename" onClick={() => handleRename(p)}>
                    <Pencil size={13} />
                  </IconButton>
                  <IconButton aria-label="Duplicate" onClick={() => handleDuplicate(p)}>
                    <Copy size={13} />
                  </IconButton>
                  <IconButton aria-label="Delete" variant="danger" onClick={() => handleDelete(p)}>
                    <Trash2 size={13} />
                  </IconButton>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
