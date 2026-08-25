"use client";

import { useSyncExternalStore } from "react";
import { Theme, getStoredTheme, setTheme as persistTheme } from "./theme";

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function getServerSnapshot(): Theme {
  return "dark";
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getStoredTheme, getServerSnapshot);

  function toggle() {
    persistTheme(theme === "dark" ? "light" : "dark");
  }

  return { theme, toggle };
}
