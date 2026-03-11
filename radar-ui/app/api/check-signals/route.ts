import { NextResponse } from "next/server";
import { getRadarFeed, getCompetitorDetail } from "../../../lib/api";
import { buildAlertEmailHtml, type AlertRow } from "../../../lib/alert";
import { createServiceClient } from "../../../lib/supabase/service";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

// Signals detected within this window are considered "new"
const WINDOW_MINUTES = 120;

function isRecent(detectedAt: string): boolean {
  const cutoff = Date.now() - WINDOW_MINUTES * 60 * 1000;
  return new Date(detectedAt).getTime() > cutoff;
}

async function runCheck(): Promise<NextResponse> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.metrivant.com";
  const supabase = createServiceClient();

  // 1 — Get all orgs
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, owner_id");

  if (!orgs || orgs.length === 0) {
    return NextResponse.json({ ok: true, message: "No orgs registered" });
  }

  // 2 — Fetch active competitors (signals in last 7 days)
  const competitors = await getRadarFeed(50);
  const active = competitors.filter((c) => c.signals_7d > 0);

  if (active.length === 0) {
    return NextResponse.json({ ok: true, signalsFound: 0, alertsCreated: 0 });
  }

  // 3 — Fetch competitor details concurrently (capped at 20 for safety)
  const toCheck = active.slice(0, 20);
  const detailResults = await Promise.allSettled(
    toCheck.map((c) => getCompetitorDetail(c.competitor_id))
  );

  // 4 — Collect qualifying signals
  type QualifyingSignal = {
    signal_id: string;
    competitor_name: string;
    signal_type: string;
    summary: string | null;
    urgency: number;
    severity: string | null;
  };

  const qualifying: QualifyingSignal[] = [];

  detailResults.forEach((result, i) => {
    if (result.status !== "fulfilled" || !result.value) return;
    const { signals } = result.value;
    const competitorName = toCheck[i].competitor_name;

    signals.forEach((signal) => {
      const urgency = signal.urgency ?? 0;
      if (urgency >= 3 && signal.detected_at && isRecent(signal.detected_at)) {
        qualifying.push({
          signal_id: signal.id,
          competitor_name: competitorName,
          signal_type: signal.signal_type,
          summary: signal.summary ?? null,
          urgency,
          severity: signal.severity ?? null,
        });
      }
    });
  });

  if (qualifying.length === 0) {
    return NextResponse.json({ ok: true, signalsFound: 0, alertsCreated: 0 });
  }

  // 5 — Insert alerts for each org (deduped by UNIQUE constraint)
  let alertsCreated = 0;
  const newAlertsByOrg = new Map<string, AlertRow[]>();

  for (const org of orgs as Array<{ id: string; owner_id: string }>) {
    const payload = qualifying.map((q) => ({
      org_id: org.id,
      signal_id: q.signal_id,
      competitor_name: q.competitor_name,
      signal_type: q.signal_type,
      summary: q.summary,
      urgency: q.urgency,
      severity: q.severity,
    }));

    const { data: inserted } = await supabase
      .from("alerts")
      .upsert(payload, { onConflict: "org_id,signal_id", ignoreDuplicates: true })
      .select("id, signal_id, competitor_name, signal_type, summary, urgency, severity, created_at, read");

    if (inserted && inserted.length > 0) {
      alertsCreated += inserted.length;
      newAlertsByOrg.set(org.id, inserted as AlertRow[]);
    }
  }

  if (alertsCreated === 0) {
    return NextResponse.json({
      ok: true,
      signalsFound: qualifying.length,
      alertsCreated: 0,
      message: "All signals already alerted",
    });
  }

  // 6 — Send emails to org owners who have new alerts
  const resendKey = process.env.RESEND_API_KEY;
  const emailsSent: string[] = [];

  if (resendKey) {
    const {
      data: { users },
    } = await supabase.auth.admin.listUsers({ perPage: 500 });

    const emailTasks = (orgs as Array<{ id: string; owner_id: string }>)
      .filter((org) => newAlertsByOrg.has(org.id))
      .map(async (org) => {
        const owner = users.find((u) => u.id === org.owner_id);
        if (!owner?.email) return;

        const newAlerts = newAlertsByOrg.get(org.id)!;
        const html = buildAlertEmailHtml(newAlerts, siteUrl);

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: "Metrivant <alerts@metrivant.com>",
            to: owner.email,
            subject: `Competitor movement detected — ${newAlerts.length} new signal${newAlerts.length !== 1 ? "s" : ""}`,
            html,
          }),
        });

        if (res.ok) emailsSent.push(owner.email);
      });

    await Promise.allSettled(emailTasks);
  }

  // 7 — PostHog events (best-effort)
  const posthogKey = process.env.POSTHOG_API_KEY;
  if (posthogKey) {
    const events = qualifying.map((q) => ({
      event: "alert_triggered",
      distinct_id: "system",
      properties: {
        competitor_name: q.competitor_name,
        signal_type: q.signal_type,
        urgency: q.urgency,
      },
    }));

    void fetch("https://app.posthog.com/capture/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: posthogKey,
        batch: events,
      }),
    });
  }

  return NextResponse.json({
    ok: true,
    signalsFound: qualifying.length,
    alertsCreated,
    emailsSent: emailsSent.length,
  });
}

// GET — Vercel cron (Authorization: Bearer {CRON_SECRET} injected automatically)
export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runCheck();
}

// POST — manual trigger
export async function POST(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runCheck();
}
