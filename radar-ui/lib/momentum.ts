// ── Momentum state definitions ────────────────────────────────────────────────
// These thresholds map momentum_score (from radar_feed) to a human state.
// Cooling < 1.5 ≤ Stable < 3 ≤ Rising < 5 ≤ Accelerating

export type MomentumState = "cooling" | "stable" | "rising" | "accelerating";

export function getMomentumState(score: number): MomentumState {
  if (score >= 5)   return "accelerating";
  if (score >= 3)   return "rising";
  if (score >= 1.5) return "stable";
  return "cooling";
}

export type MomentumConfig = {
  label: string;
  color: string;
  bg:    string;
  arrow: string;
};

export const MOMENTUM_STATE_CONFIG: Record<MomentumState, MomentumConfig> = {
  cooling:      { label: "Cooling",      color: "#64748b", bg: "rgba(100,116,139,0.10)", arrow: "↓" },
  stable:       { label: "Stable",       color: "#00B4FF", bg: "rgba(0,180,255,0.08)",  arrow: "→" },
  rising:       { label: "Rising",       color: "#f59e0b", bg: "rgba(245,158,11,0.10)",  arrow: "↑" },
  accelerating: { label: "Accelerating", color: "#ef4444", bg: "rgba(239,68,68,0.12)",   arrow: "⚡" },
};

export function getMomentumConfig(score: number): MomentumConfig {
  return MOMENTUM_STATE_CONFIG[getMomentumState(score)];
}

// Echo ring duration per state — accelerating blips pulse faster
export function getMomentumEchoDuration(score: number): number {
  if (score >= 5) return 1.5;
  if (score >= 3) return 2.2;
  return 3.0;
}

// Email alert body for momentum threshold crossing
export function buildMomentumAlertEmailHtml(
  competitors: { name: string; score: number }[],
  siteUrl: string
): string {
  const rows = competitors
    .map(
      (c) =>
        `<tr>
          <td style="padding:8px 12px;color:#e2e8f0;font-size:14px;">${c.name}</td>
          <td style="padding:8px 12px;color:#ef4444;font-size:14px;font-weight:600;text-align:right;">${c.score.toFixed(1)}</td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#000002;font-family:Inter,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:48px 24px;">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#020208;border:1px solid #152415;border-radius:16px;overflow:hidden;">

        <tr>
          <td style="padding:32px 32px 0;border-bottom:1px solid #0d1020;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.22em;color:rgba(0,180,255,0.5);">
              Metrivant · Momentum Alert
            </p>
            <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;color:#fff;line-height:1.2;">
              ⚡ Accelerating competitor${competitors.length > 1 ? "s" : ""} detected
            </h1>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px;">
            <p style="margin:0 0 16px;font-size:14px;color:#94a3b8;line-height:1.6;">
              The following rival${competitors.length > 1 ? "s have" : " has"} crossed the
              <strong style="color:#ef4444;">Accelerating</strong> momentum threshold (score ≥ 5).
              This indicates sustained, high-frequency activity that may warrant a strategic response.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#03030c;border:1px solid #152415;border-radius:10px;overflow:hidden;margin-bottom:24px;">
              <tr>
                <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.16em;color:#475569;">Competitor</th>
                <th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.16em;color:#475569;">Score</th>
              </tr>
              ${rows}
            </table>

            <a href="${siteUrl}/app"
              style="display:inline-block;padding:12px 24px;background:#00B4FF;color:#000;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;">
              Open Radar →
            </a>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 32px;border-top:1px solid #0d1020;">
            <p style="margin:0;font-size:11px;color:#334155;">
              Metrivant · competitive intelligence radar
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
