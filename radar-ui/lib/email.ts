// ── Canonical Resend email client for Metrivant ───────────────────────────────
// All outbound email originates here.
// Fails gracefully — missing RESEND_API_KEY silently skips without crashing
// unrelated product surfaces.

const RESEND_API = "https://api.resend.com/emails";

// ── Types ─────────────────────────────────────────────────────────────────────

export type EmailParams = {
  to:      string;
  subject: string;
  html:    string;
  from?:   string; // defaults to hello@metrivant.com
};

export type EmailResult = {
  ok:     boolean;
  error?: string;
};

// ── Address helpers ───────────────────────────────────────────────────────────

// FROM_EMAIL env var overrides all sender addresses when set.
// Otherwise, each flow uses its dedicated subdomain address.
function fromAddr(prefix: "hello" | "alerts" | "briefs"): string {
  const override = process.env.FROM_EMAIL;
  if (override) return `Metrivant <${override}>`;
  return `Metrivant <${prefix}@metrivant.com>`;
}

export const FROM_HELLO  = fromAddr("hello");
export const FROM_ALERTS = fromAddr("alerts");
export const FROM_BRIEFS = fromAddr("briefs");

// ── Send ──────────────────────────────────────────────────────────────────────

export async function sendEmail({
  to,
  subject,
  html,
  from = FROM_HELLO,
}: EmailParams): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY not set" };

  try {
    const res = await fetch(RESEND_API, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${key}`,
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      const msg = `[email] Resend ${res.status}: ${detail}`;
      console.error(msg);
      return { ok: false, error: msg };
    }

    return { ok: true };
  } catch (err) {
    const msg = `[email] network error to ${to}: ${err instanceof Error ? err.message : String(err)}`;
    console.error(msg);
    return { ok: false, error: msg };
  }
}

// ── Shared layout ─────────────────────────────────────────────────────────────

function emailShell(title: string, bodyHtml: string, footerHtml = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${title} — Metrivant</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,'Inter',system-ui,sans-serif;color:#111827;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
      <tr>
        <td style="background:#020208;padding:20px 28px;border-bottom:1px solid #0d1020;">
          <div style="font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(0,180,255,0.65);margin-bottom:3px;">Metrivant</div>
          <div style="font-size:17px;font-weight:700;color:#ffffff;">${title}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 28px 20px;">
          ${bodyHtml}
        </td>
      </tr>
      ${footerHtml ? `
      <tr>
        <td style="padding:16px 28px;border-top:1px solid #f3f4f6;">
          ${footerHtml}
        </td>
      </tr>` : ""}
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── Hypothesis shift email ────────────────────────────────────────────────────

export type HypothesisShiftRow = {
  competitor_name:     string;
  previous_hypothesis: string;
  hypothesis:          string;
  confidence_level:    string;
  hypothesis_changed_at: string;
};

export function buildHypothesisShiftEmailHtml(
  shifts: HypothesisShiftRow[],
  siteUrl: string,
): string {
  const rowsHtml = shifts.map((s) => {
    const changedDate = new Date(s.hypothesis_changed_at).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
    const confColor =
      s.confidence_level === "high"   ? "#00B4FF" :
      s.confidence_level === "medium" ? "#f59e0b" : "#9ca3af";

    return `
      <tr>
        <td style="padding:18px 0;border-bottom:1px solid #f3f4f6;vertical-align:top;">
          <div style="margin-bottom:8px;display:flex;align-items:center;gap:8px;">
            <span style="font-weight:700;color:#111827;font-size:14px;">${s.competitor_name}</span>
            <span style="display:inline-block;margin-left:8px;background:rgba(155,92,255,0.10);color:#9B5CFF;font-size:10px;font-weight:700;letter-spacing:0.08em;padding:2px 8px;border-radius:99px;text-transform:uppercase;">Strategy Pivot</span>
            <span style="display:inline-block;margin-left:4px;font-size:10px;font-weight:700;color:${confColor};text-transform:uppercase;letter-spacing:0.06em;">${s.confidence_level} confidence</span>
          </div>
          <div style="font-size:11px;color:#9ca3af;margin-bottom:10px;">${changedDate}</div>
          <div style="background:#fef9f0;border-left:3px solid #f59e0b;padding:10px 14px;border-radius:0 6px 6px 0;margin-bottom:8px;">
            <div style="font-size:10px;font-weight:700;letter-spacing:0.10em;text-transform:uppercase;color:#f59e0b;margin-bottom:4px;">Previously</div>
            <div style="font-size:13px;line-height:1.55;color:#6b7280;">${s.previous_hypothesis}</div>
          </div>
          <div style="background:#f0fdf4;border-left:3px solid #00B4FF;padding:10px 14px;border-radius:0 6px 6px 0;">
            <div style="font-size:10px;font-weight:700;letter-spacing:0.10em;text-transform:uppercase;color:#00B4FF;margin-bottom:4px;">Now</div>
            <div style="font-size:13px;line-height:1.55;color:#374151;font-weight:500;">${s.hypothesis}</div>
          </div>
        </td>
      </tr>`;
  }).join("");

  return emailShell(
    `Strategy Pivot${shifts.length > 1 ? "s" : ""} Detected`,
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">
      Metrivant detected a significant shift in the strategic direction of ${shifts.length === 1 ? "a competitor" : `${shifts.length} competitors`} you are monitoring.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      ${rowsHtml}
    </table>
    <a href="${siteUrl}/app/strategy"
       style="display:inline-block;background:#9B5CFF;color:#ffffff;font-weight:700;font-size:13px;padding:10px 22px;border-radius:99px;text-decoration:none;">
      View Strategic Landscape &rarr;
    </a>`,
    `<div style="font-size:11px;color:#9ca3af;">
      <a href="${siteUrl}/app" style="color:#00B4FF;text-decoration:none;">Open radar &rarr;</a>
    </div>`
  );
}

// ── Welcome email ─────────────────────────────────────────────────────────────

export function buildWelcomeEmailHtml(siteUrl: string): string {
  const onboardingUrl = `${siteUrl}/app/onboarding`;
  return emailShell(
    "Welcome to Metrivant",
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">
      Your competitive intelligence radar is ready.
    </p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#6b7280;">
      Add the competitors you want to monitor. Metrivant will track their websites and surface meaningful changes as structured intelligence.
    </p>
    <a href="${onboardingUrl}"
       style="display:inline-block;background:#00B4FF;color:#020208;font-weight:700;font-size:13px;padding:10px 22px;border-radius:99px;text-decoration:none;">
      Add your first competitor &rarr;
    </a>`,
    `<div style="font-size:11px;color:#9ca3af;">Reply to this email with any questions.</div>`
  );
}

// ── Tracking confirmation email ───────────────────────────────────────────────

export function buildTrackingConfirmationEmailHtml(
  competitorName: string,
  websiteUrl:     string,
  siteUrl:        string,
): string {
  const radarUrl = `${siteUrl}/app`;
  const domain   = websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return emailShell(
    "Your competitor radar is live",
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">
      Metrivant is now monitoring <strong>${competitorName}</strong>.
    </p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin:0 0 20px;font-size:13px;font-family:monospace;color:#6b7280;">
      ${domain}
    </div>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#6b7280;">
      When Metrivant detects meaningful changes — pricing moves, product updates, repositioning — you'll receive an alert.
    </p>
    <a href="${radarUrl}"
       style="display:inline-block;background:#00B4FF;color:#020208;font-weight:700;font-size:13px;padding:10px 22px;border-radius:99px;text-decoration:none;">
      Open radar &rarr;
    </a>`,
    `<div style="font-size:11px;color:#9ca3af;">
      <a href="${siteUrl}/app/alerts" style="color:#00B4FF;text-decoration:none;">Manage alerts &rarr;</a>
    </div>`
  );
}

// ── First signal email ────────────────────────────────────────────────────────

type SignalRow = {
  competitor_name: string;
  signal_type:     string;
  summary:         string | null;
};

export function buildFirstSignalEmailHtml(
  signals: SignalRow[],
  siteUrl: string,
): string {
  const top = signals.slice(0, 3);
  const rows = top.map((s) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;vertical-align:top;">
        <div style="margin-bottom:4px;">
          <span style="font-weight:700;color:#111827;font-size:14px;">${s.competitor_name}</span>
          <span style="display:inline-block;margin-left:8px;background:rgba(0,180,255,0.10);color:#00B4FF;font-size:10px;font-weight:700;letter-spacing:0.08em;padding:2px 8px;border-radius:99px;text-transform:uppercase;">
            ${s.signal_type.replace(/_/g, " ")}
          </span>
        </div>
        ${s.summary ? `<div style="color:#6b7280;font-size:13px;line-height:1.5;">${s.summary}</div>` : ""}
      </td>
    </tr>`).join("");

  return emailShell(
    "First competitor signal detected",
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">
      Metrivant detected its first movement signal from your competitor radar.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      ${rows}
    </table>
    <a href="${siteUrl}/app"
       style="display:inline-block;background:#00B4FF;color:#020208;font-weight:700;font-size:13px;padding:10px 22px;border-radius:99px;text-decoration:none;">
      View on radar &rarr;
    </a>`,
    `<div style="font-size:11px;color:#9ca3af;">
      <a href="${siteUrl}/app/alerts" style="color:#00B4FF;text-decoration:none;">View all alerts &rarr;</a>
    </div>`
  );
}
