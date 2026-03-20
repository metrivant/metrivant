// ── Theme toggle ─────────────────────────────────────────────────────────────
//
// Two themes: classic (passive instrument) and hud (active pilot interface).
// Persisted to localStorage. Applied via data-theme attribute on <html>.
// CSS-only — no component or layout changes between themes.

export type Theme = "classic" | "hud";

const STORAGE_KEY = "metrivant-theme";

/** Apply a theme and persist the choice. */
export function setTheme(mode: Theme): void {
  document.documentElement.setAttribute("data-theme", mode);
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch { /* storage unavailable */ }
}

/** Read the persisted theme. Falls back to classic. */
export function getTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "hud") return "hud";
  } catch { /* storage unavailable */ }
  return "classic";
}

/** Toggle between classic and hud. Returns the new theme. */
export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "classic" ? "hud" : "classic";
  setTheme(next);
  return next;
}
