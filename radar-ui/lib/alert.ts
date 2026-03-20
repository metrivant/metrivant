// ── Types ─────────────────────────────────────────────────────────────────────

export type AlertRow = {
  id: string;
  signal_id: string;
  competitor_name: string;
  signal_type: string;
  summary: string | null;
  urgency: number;
  severity: string | null;
  created_at: string;
  read: boolean;
};

// ── Signal type display helpers ───────────────────────────────────────────────

export const SIGNAL_TYPE_LABELS: Record<string, string> = {
  pricing_change:    "Pricing Change",
  feature_launch:    "Feature Launch",
  positioning_shift: "Positioning Shift",
  product_release:   "Product Release",
  content_update:    "Content Update",
  messaging_change:  "Messaging Change",
};

export const SIGNAL_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  pricing_change:    { bg: "rgba(245,158,11,0.10)",  text: "#f59e0b" },
  feature_launch:    { bg: "rgba(96,165,250,0.10)",   text: "#60A5FA" },
  positioning_shift: { bg: "rgba(167,139,250,0.10)",  text: "#A78BFA" },
  product_release:   { bg: "rgba(0,180,255,0.10)",   text: "#00B4FF" },
  content_update:    { bg: "rgba(107,114,128,0.10)",  text: "#9ca3af" },
  messaging_change:  { bg: "rgba(251,146,60,0.10)",   text: "#FB923C" },
};

const FALLBACK_COLOR = { bg: "rgba(107,114,128,0.10)", text: "#9ca3af" };

export function signalTypeLabel(type: string): string {
  return (
    SIGNAL_TYPE_LABELS[type] ??
    type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function signalTypeColor(type: string) {
  return SIGNAL_TYPE_COLORS[type] ?? FALLBACK_COLOR;
}

// ── Email template ────────────────────────────────────────────────────────────

export function buildAlertEmailHtml(
  alerts: AlertRow[],
  siteUrl: string
): string {
  const rowsHtml = alerts
    .map((a) => {
      const label = signalTypeLabel(a.signal_type);
      const color = signalTypeColor(a.signal_type);
      return `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #f3f4f6;vertical-align:top;">
          <div style="margin-bottom:5px;">
            <span style="font-weight:700;color:#111827;font-size:14px;">${a.competitor_name}</span>
            <span style="display:inline-block;margin-left:8px;background:${color.bg};color:${color.text};font-size:10px;font-weight:700;letter-spacing:0.08em;padding:2px 8px;border-radius:99px;text-transform:uppercase;">${label}</span>
          </div>
          ${a.summary ? `<div style="color:#4b5563;font-size:13px;line-height:1.55;">${a.summary}</div>` : ""}
        </td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Competitor Movement Detected — Metrivant</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,'Inter',system-ui,sans-serif;color:#111827;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
      <tr>
        <td style="background:#020208;padding:20px 28px;border-bottom:1px solid #0d1020;">
          <div style="font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(0,180,255,0.65);margin-bottom:3px;">Metrivant</div>
          <div style="font-size:17px;font-weight:700;color:#ffffff;">Competitor Movement Detected</div>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 28px 4px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#00B4FF;margin-bottom:8px;">
            ${alerts.length} new signal${alerts.length !== 1 ? "s" : ""}
          </div>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${rowsHtml}
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 28px;">
          <a href="${siteUrl}/app" style="display:inline-block;background:#00B4FF;color:#020208;font-weight:700;font-size:13px;padding:10px 22px;border-radius:99px;text-decoration:none;">View on radar &rarr;</a>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 28px;border-top:1px solid #f3f4f6;">
          <div style="font-size:11px;color:#9ca3af;">
            <a href="${siteUrl}/app/alerts" style="color:#00B4FF;text-decoration:none;">View all alerts &rarr;</a>
          </div>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
