export type Theme = "dark" | "light";

const STORAGE_KEY = "nettwin-theme";

// Inlined into layout.tsx via next/script(beforeInteractive) so the correct
// theme is applied before first paint — no flash of the wrong theme.
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("${STORAGE_KEY}");
    var theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();
`;

export function getStoredTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "light" ? "light" : "dark";
}

export function setTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // storage unavailable (private mode) — theme still applies for this load
  }
}

// Soft tinted background for a token color, e.g. softBg("var(--danger)").
export function softBg(colorVar: string, pct = 14) {
  return `color-mix(in srgb, ${colorVar} ${pct}%, transparent)`;
}

export const tone = {
  accent: "var(--accent)",
  accent2: "var(--accent-2)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  orange: "var(--orange)",
  muted: "var(--text-faint)",
} as const;
