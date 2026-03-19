import { NextResponse } from "next/server";
import { getRadarFeed, getCompetitorDetail } from "../../../lib/api";

export const maxDuration = 60;
import { buildAlertEmailHtml, type AlertRow } from "../../../lib/alert";
import {
  sendEmail,
  buildFirstSignalEmailHtml,
  buildHypothesisShiftEmailHtml,
  type HypothesisShiftRow,
  FROM_ALERTS,
} from "../../../lib/email";
import { createServiceClient } from "../../../lib/supabase/service";
import { captureException, flush } from "../../../lib/sentry";
import { writeCronHeartbeat } from "../../../lib/cronHeartbeat";

// captureCheckIn is server-only in @sentry/nextjs — require() prevents static analysis
// from including it in client bundles (lib/sentry.ts is also client-bundled via error.tsx).
// Returns the checkInId from "in_progress" so ok/error calls can correlate the same event.
function captureCheckIn(status: "in_progress" | "ok" | "error", checkInId?: string): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (require("@sentry/nextjs") as any).captureCheckIn?.({
      monitorSlug: "check-signals",
      status,
      ...(checkInId ? { checkInId } : {}),
    }) as string | undefined;
  } catch { return undefined; }
}

// ── Alert synthesis via GPT-4o ─────────────────────────────────────────────────
// Generates a concise (≤40 word) analyst-quality alert message.
// Falls back to the signal's existing summary if synthesis fails.

async function synthesizeAlertMessage(
  competitorName:      string,
  signalType:          string,
  summary:             string | null,
  pressureIndex:       number | null,
  recentSignalsCount:  number,
  openaiKey:           string
): Promise<string | null> {
  const prompt = `You are writing a competitive intelligence alert.
Competitor: ${competitorName}
Signal: ${signalType.replace(/_/g, " ")}
Recent signals (7d): ${recentSignalsCount}
${pressureIndex != null ? `Pressure index: ${pressureIndex.toFixed(1)}/10` : ""}
Evidence: ${summary ?? "(no interpretation available)"}

Write ONE alert message. Max 40 words. Explain what happened and why it matters.
No fluff. No hedging. Write like an analyst, not a notification template.
Return only the message text — no JSON, no labels.`;

  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 6000);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
      signal:  controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model:       "gpt-4o",
        messages:    [{ role: "user", content: prompt }],
        max_tokens:  80,
        temperature: 0.1,
      }),
    });

    if (!res.ok) return null;

    const data    = await res.json() as { choices: Array<{ message: { content: string } }> };
    const message = data.choices?.[0]?.message?.content?.trim();
    if (!message) return null;

    // Hard cap at 40 words
    const words = message.split(/\s+/);
    return words.length > 40 ? words.slice(0, 40).join(" ") + "…" : message;
  } catch {
    return null;
  }
}

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
  const checkInId = captureCheckIn("in_progress");
  const runStart = Date.now();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://metrivant.com";
  const supabase = createServiceClient();

  // 1 — Get all orgs
  const { data: orgs, error: orgsError } = await supabase
    .from("organizations")
    .select("id, owner_id");

  if (orgsError) {
    captureException(orgsError, { route: "check-signals", step: "orgs_select" });
    captureCheckIn("error", checkInId);
    await flush();
    return NextResponse.json({ error: "Failed to load orgs" }, { status: 500 });
  }

  if (!orgs || orgs.length === 0) {
    captureCheckIn("ok", checkInId);
    await flush();
    return NextResponse.json({ ok: true, message: "No orgs registered" });
  }

  // 2 — Fetch active competitors (signals in last 7 days)
  let competitors;
  try {
    competitors = await getRadarFeed(50);
  } catch (err) {
    captureException(err instanceof Error ? err : new Error(String(err)), {
      route: "check-signals", step: "radar_feed",
    });
    captureCheckIn("error", checkInId);
    await flush();
    return NextResponse.json({ error: "Failed to fetch radar feed" }, { status: 500 });
  }
  const active = competitors.filter((c) => c.signals_7d > 0);

  if (active.length === 0) {
    await writeCronHeartbeat(supabase, "/api/check-signals", "ok", Date.now() - runStart, 0);
    captureCheckIn("ok", checkInId);
    await flush();
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
    await writeCronHeartbeat(supabase, "/api/check-signals", "ok", Date.now() - runStart, 0);
    captureCheckIn("ok", checkInId);
    await flush();
    return NextResponse.json({ ok: true, signalsFound: 0, alertsCreated: 0 });
  }

  // 5 — Synthesize alert messages via GPT-4o (best-effort, parallel)
  const openaiKey = process.env.OPENAI_API_KEY;

  type QualifyingSignalWithMessage = QualifyingSignal & { synthesized_message: string | null };
  const qualifyingWithMessages: QualifyingSignalWithMessage[] = await Promise.all(
    qualifying.map(async (q) => {
      if (!openaiKey) return { ...q, synthesized_message: null };
      const recentSignals = active.find(c => c.competitor_name === q.competitor_name)?.signals_7d ?? 1;
      const pressureIndex = active.find(c => c.competitor_name === q.competitor_name)?.pressure_index ?? null;
      const message = await synthesizeAlertMessage(
        q.competitor_name,
        q.signal_type,
        q.summary,
        pressureIndex as number | null,
        recentSignals,
        openaiKey
      ).catch(() => null);
      return { ...q, synthesized_message: message };
    })
  );

  // Insert alerts for each org (deduped by UNIQUE constraint)
  let alertsCreated = 0;
  const newAlertsByOrg = new Map<string, AlertRow[]>();

  for (const org of orgs as Array<{ id: string; owner_id: string }>) {
    const payload = qualifyingWithMessages.map((q) => ({
      org_id:          org.id,
      signal_id:       q.signal_id,
      competitor_name: q.competitor_name,
      signal_type:     q.signal_type,
      summary:         q.synthesized_message ?? q.summary,
      urgency:         q.urgency,
      severity:        q.severity,
    }));

    const { data: inserted, error: upsertError } = await supabase
      .from("alerts")
      .upsert(payload, { onConflict: "org_id,signal_id", ignoreDuplicates: true })
      .select("id, signal_id, competitor_name, signal_type, summary, urgency, severity, created_at, read");

    if (upsertError) {
      captureException(upsertError, {
        route: "check-signals", step: "alert_upsert", org_id: org.id,
      });
      // Non-fatal — continue to next org
    } else if (inserted && inserted.length > 0) {
      alertsCreated += inserted.length;
      newAlertsByOrg.set(org.id, inserted as AlertRow[]);
    }
  }

  if (alertsCreated === 0) {
    await writeCronHeartbeat(supabase, "/api/check-signals", "ok", Date.now() - runStart, 0);
    captureCheckIn("ok", checkInId);
    await flush();
    return NextResponse.json({
      ok:          true,
      signalsFound: qualifying.length,
      alertsCreated: 0,
      message:     "All signals already alerted",
    });
  }

  // 6 — Send emails to org owners who have new alerts
  const emailsSent: string[] = [];

  type AuthUser = Awaited<ReturnType<typeof supabase.auth.admin.listUsers>>["data"]["users"][number];
  let users: AuthUser[];
  try {
    // Paginate to avoid silently missing users beyond the first page.
    // perPage: 200 is a safe page size well within Supabase's Admin API limits.
    const collected: AuthUser[] = [];
    let page = 1;
    while (true) {
      const result = await supabase.auth.admin.listUsers({ perPage: 200, page });
      const batch = result.data.users as AuthUser[];
      collected.push(...batch);
      if (batch.length < 200) break;
      page += 1;
    }
    users = collected;
  } catch (err) {
    captureException(err instanceof Error ? err : new Error(String(err)), {
      route: "check-signals", step: "list_users",
    });
    users = [];
  }

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

  // 7 — Hypothesis shift alerting (best-effort, parallel to signal alerts)
  try {
    // Fetch all unalerted hypothesis shifts from the last 72h
    type ShiftRow = {
      org_id:                string;
      competitor_name:       string;
      previous_hypothesis:   string;
      hypothesis:            string;
      confidence_level:      string;
      hypothesis_changed_at: string;
    };

    const { data: shiftRows } = await supabase
      .from("competitor_contexts")
      .select("org_id, competitor_name, previous_hypothesis, hypothesis, confidence_level, hypothesis_changed_at")
      .is("hypothesis_shift_alerted_at", null)
      .not("hypothesis_changed_at", "is", null)
      .not("previous_hypothesis", "is", null)
      .gte("hypothesis_changed_at", new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString());

    if (shiftRows && shiftRows.length > 0) {
      // Group shifts by org_id
      const shiftsByOrg = new Map<string, ShiftRow[]>();
      for (const row of shiftRows as ShiftRow[]) {
        const arr = shiftsByOrg.get(row.org_id) ?? [];
        arr.push(row);
        shiftsByOrg.set(row.org_id, arr);
      }

      // Send email per org + mark alerted
      const shiftEmailTasks = (orgs as Array<{ id: string; owner_id: string }>)
        .filter((org) => shiftsByOrg.has(org.id))
        .map(async (org) => {
          const owner = users.find((u) => u.id === org.owner_id);
          if (!owner?.email) return;

          const shifts = shiftsByOrg.get(org.id)!;
          const shiftParams: HypothesisShiftRow[] = shifts.map((s) => ({
            competitor_name:       s.competitor_name,
            previous_hypothesis:   s.previous_hypothesis,
            hypothesis:            s.hypothesis ?? "",
            confidence_level:      s.confidence_level,
            hypothesis_changed_at: s.hypothesis_changed_at,
          }));

          await sendEmail({
            to:      owner.email,
            subject: `Strategy pivot detected — ${shifts.length === 1 ? shifts[0].competitor_name : `${shifts.length} competitors`}`,
            html:    buildHypothesisShiftEmailHtml(shiftParams, siteUrl),
            from:    FROM_ALERTS,
          });

          // Mark alerted so we don't re-send
          const competitorNames = shifts.map((s) => s.competitor_name);
          await supabase
            .from("competitor_contexts")
            .update({ hypothesis_shift_alerted_at: new Date().toISOString() })
            .eq("org_id", org.id)
            .in("competitor_name", competitorNames);
        });

      await Promise.allSettled(shiftEmailTasks);
    }
  } catch {
    // Non-fatal — signal alert path already completed
  }

  // 8 — PostHog events (best-effort)
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
  captureCheckIn("ok", checkInId);
  await flush();

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
