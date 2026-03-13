import { NextResponse } from "next/server";
import { getRadarFeed, getCompetitorDetail } from "../../../lib/api";
import { buildAlertEmailHtml, type AlertRow } from "../../../lib/alert";
import {
  sendEmail,
  buildFirstSignalEmailHtml,
  FROM_ALERTS,
} from "../../../lib/email";
import { createServiceClient } from "../../../lib/supabase/service";
import { writeCronHeartbeat } from "../../../lib/cronHeartbeat";

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
  const runStart = Date.now();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://metrivant.com";
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
    signal_id:       string;
    competitor_name: string;
    signal_type:     string;
    summary:         string | null;
    urgency:         number;
    severity:        string | null;
  };

  const qualifying: QualifyingSignal[] = [];
  // JS-level dedup: guard against backend returning the same signal_id twice
  const seenSignalIds = new Set<string>();

  detailResults.forEach((result, i) => {
    if (result.status !== "fulfilled" || !result.value) return;
    const { signals } = result.value;
    const competitorName = toCheck[i].competitor_name;

    signals.forEach((signal) => {
      if (seenSignalIds.has(signal.id)) return;
      const urgency = signal.urgency ?? 0;
      // Validate detected_at before using it — malformed dates silently fail isRecent()
      const detectedMs = signal.detected_at ? new Date(signal.detected_at).getTime() : NaN;
      if (urgency >= 3 && !isNaN(detectedMs) && isRecent(signal.detected_at)) {
        seenSignalIds.add(signal.id);
        qualifying.push({
          signal_id:       signal.id,
          competitor_name: competitorName,
          signal_type:     signal.signal_type,
          summary:         signal.summary ?? null,
          urgency,
          severity:        signal.severity ?? null,
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
      org_id:          org.id,
      signal_id:       q.signal_id,
      competitor_name: q.competitor_name,
      signal_type:     q.signal_type,
      summary:         q.summary,
      urgency:         q.urgency,
      severity:        q.severity,
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
      ok:          true,
      signalsFound: qualifying.length,
      alertsCreated: 0,
      message:     "All signals already alerted",
    });
  }

  // 6 — Send emails to org owners who have new alerts
  const emailsSent: string[] = [];

  const {
    data: { users },
  } = await supabase.auth.admin.listUsers({ perPage: 500 });

  const emailTasks = (orgs as Array<{ id: string; owner_id: string }>)
    .filter((org) => newAlertsByOrg.has(org.id))
    .map(async (org) => {
      const owner = users.find((u) => u.id === org.owner_id);
      if (!owner?.email) return;

      const newAlerts = newAlertsByOrg.get(org.id)!;

      // Detect first-ever signal for this org: if total alerts == newly inserted,
      // these are the only alerts this org has ever received.
      const { count: totalAlerts } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("org_id", org.id);

      const isFirstSignal = (totalAlerts ?? 0) === newAlerts.length;

      const result = isFirstSignal
        ? await sendEmail({
            to:      owner.email,
            subject: "Metrivant detected its first competitor signal",
            html:    buildFirstSignalEmailHtml(newAlerts, siteUrl),
            from:    FROM_ALERTS,
          })
        : await sendEmail({
            to:      owner.email,
            subject: `Competitor movement detected — ${newAlerts.length} new signal${newAlerts.length !== 1 ? "s" : ""}`,
            html:    buildAlertEmailHtml(newAlerts, siteUrl),
            from:    FROM_ALERTS,
          });

      if (result.ok) emailsSent.push(owner.email);
    });

  await Promise.allSettled(emailTasks);

  // 7 — PostHog events (best-effort)
  const posthogKey = process.env.POSTHOG_API_KEY;
  if (posthogKey) {
    const events = qualifying.map((q) => ({
      event:       "alert_triggered",
      distinct_id: "system",
      properties:  {
        competitor_name: q.competitor_name,
        signal_type:     q.signal_type,
        urgency:         q.urgency,
      },
    }));

    void fetch("https://app.posthog.com/batch", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ api_key: posthogKey, batch: events }),
    });
  }

  await writeCronHeartbeat(supabase, "/api/check-signals", "ok", Date.now() - runStart, alertsCreated);

  return NextResponse.json({
    ok:           true,
    signalsFound: qualifying.length,
    alertsCreated,
    emailsSent:   emailsSent.length,
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
