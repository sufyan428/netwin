"use client";

import { create } from "zustand";

export type ToastKind = "success" | "info" | "warning" | "danger";

export interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
}

interface ToastState {
  items: ToastItem[];
  push: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
}

let counter = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  push: (t) => {
    const id = `toast-${Date.now().toString(36)}-${counter++}`;
    set((s) => ({ items: [...s.items, { ...t, id }] }));
    setTimeout(() => get().dismiss(id), 4200);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

// Convenience call sites: toast.success("Router added"), toast.danger(...)
export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ kind: "success", title, description }),
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ kind: "info", title, description }),
  warning: (title: string, description?: string) =>
    useToastStore.getState().push({ kind: "warning", title, description }),
  danger: (title: string, description?: string) =>
    useToastStore.getState().push({ kind: "danger", title, description }),
};
