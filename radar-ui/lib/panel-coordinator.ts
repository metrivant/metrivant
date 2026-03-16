// ── Panel Coordinator ─────────────────────────────────────────────────────────
//
// Shared coordination between HistoricalCapsule and FeatureDiscoveryPanel.
//
// Rules enforced here:
//   - Maximum one panel visible at any time (PANEL_ACTIVE flag)
//   - 90-second minimum gap between any two panels (LAST_CLOSED timestamp)
//   - Both systems check this before surfacing a panel
//
// All state lives in sessionStorage so it resets naturally between tabs and
// sessions without needing any server-side state.

const PANEL_ACTIVE_KEY  = "mv_panel_active";   // "1" | "0"
const PANEL_LAST_KEY    = "mv_panel_last_at";  // epoch ms string

const GAP_MS = 90_000; // 90 seconds minimum between any panels

// ── Read helpers ──────────────────────────────────────────────────────────────

function isPanelActive(): boolean {
  try { return sessionStorage.getItem(PANEL_ACTIVE_KEY) === "1"; } catch { return false; }
}

function lastClosedAt(): number {
  try { return parseInt(sessionStorage.getItem(PANEL_LAST_KEY) ?? "0", 10); } catch { return 0; }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** True when no panel is open AND the minimum gap has elapsed. */
export function canShowPanel(): boolean {
  return !isPanelActive() && Date.now() - lastClosedAt() >= GAP_MS;
}

/** Call when a panel becomes visible. */
export function setPanelOpen(): void {
  try { sessionStorage.setItem(PANEL_ACTIVE_KEY, "1"); } catch { /* non-fatal */ }
}

/** Call when a panel is dismissed. Starts the 90-second gap clock. */
export function setPanelClosed(): void {
  try {
    sessionStorage.setItem(PANEL_ACTIVE_KEY, "0");
    sessionStorage.setItem(PANEL_LAST_KEY, String(Date.now()));
  } catch { /* non-fatal */ }
}

/** Returns a random delay in ms within [minMs, maxMs]. */
export function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(minMs + Math.random() * (maxMs - minMs));
}
