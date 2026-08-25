import { NetNode, NetEdge } from "./types";

export interface SavedProject {
  id: string;
  name: string;
  updatedAt: number;
  nodes: NetNode[];
  edges: NetEdge[];
}

const STORAGE_KEY = "nettwin-projects-v1";

function readAll(): SavedProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(projects: SavedProject[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // localStorage unavailable (private mode / quota) — save silently no-ops
  }
}

export function listProjects(): SavedProject[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveProject(
  id: string | null,
  name: string,
  nodes: NetNode[],
  edges: NetEdge[]
): SavedProject {
  const all = readAll();
  const existingIdx = id ? all.findIndex((p) => p.id === id) : -1;
  const project: SavedProject = {
    id: id ?? `proj-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
    name,
    updatedAt: Date.now(),
    nodes: JSON.parse(JSON.stringify(nodes)),
    edges: JSON.parse(JSON.stringify(edges)),
  };
  if (existingIdx >= 0) all[existingIdx] = project;
  else all.push(project);
  writeAll(all);
  return project;
}

export function deleteProject(id: string) {
  writeAll(readAll().filter((p) => p.id !== id));
}

export function duplicateProject(id: string): SavedProject | null {
  const all = readAll();
  const src = all.find((p) => p.id === id);
  if (!src) return null;
  const copy: SavedProject = {
    ...src,
    id: `proj-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
    name: `${src.name} (copy)`,
    updatedAt: Date.now(),
    nodes: JSON.parse(JSON.stringify(src.nodes)),
    edges: JSON.parse(JSON.stringify(src.edges)),
  };
  all.push(copy);
  writeAll(all);
  return copy;
}

export function renameProject(id: string, name: string) {
  const all = readAll();
  const p = all.find((x) => x.id === id);
  if (!p) return;
  p.name = name;
  p.updatedAt = Date.now();
  writeAll(all);
}

export function exportProjectToFile(name: string, nodes: NetNode[], edges: NetEdge[]) {
  const payload = {
    format: "nettwin-project",
    version: 1,
    name,
    exportedAt: new Date().toISOString(),
    nodes,
    edges,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[^a-z0-9-_]+/gi, "_") || "nettwin-project"}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  name: string;
  nodes: NetNode[];
  edges: NetEdge[];
}

export function parseImportedProject(raw: string): ImportResult {
  const data = JSON.parse(raw);
  if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
    throw new Error("Not a valid NetTwin project file — missing nodes/edges.");
  }
  return {
    name: typeof data.name === "string" && data.name.trim() ? data.name : "Imported project",
    nodes: data.nodes,
    edges: data.edges,
  };
}
