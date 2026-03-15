import { NextResponse } from "next/server";
import { getRadarFeed } from "../../../lib/api";
import { generateBrief, buildBriefEmailHtml } from "../../../lib/brief";
import { sendEmail, FROM_BRIEFS } from "../../../lib/email";
import { createServiceClient } from "../../../lib/supabase/service";
import { captureException } from "../../../lib/sentry";
import { writeCronHeartbeat } from "../../../lib/cronHeartbeat";

function weekLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day:   "numeric",
    year:  "numeric",
  });
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

async function runGeneration(): Promise<NextResponse> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 500 }
    );
  }

  const runStart  = Date.now();
  const siteUrl   = process.env.NEXT_PUBLIC_SITE_URL ?? "https://metrivant.com";
  const week      = weekLabel(new Date());
  const supabase  = createServiceClient();

  // 1 — Load all organisations
  const { data: orgs, error: orgsError } = await supabase
    .from("organizations")
    .select("id, owner_id");

  if (orgsError) {
    captureException(orgsError, { route: "generate-brief", step: "fetch_orgs" });
    return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 });
  }

  if (!orgs || orgs.length === 0) {
    await writeCronHeartbeat(supabase, "/api/generate-brief", "ok", Date.now() - runStart, 0);
    return NextResponse.json({ ok: true, briefs_generated: 0, emails_sent: 0, message: "No organizations" });
  }

  // 2 — Load all auth users once (for email lookup per org owner)
  let userEmailById: Map<string, string> = new Map();
  try {
    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 500 });
    userEmailById = new Map(
      users.filter((u) => u.email).map((u) => [u.id, u.email!])
    );
  } catch (err) {
    captureException(err instanceof Error ? err : new Error(String(err)), {
      route: "generate-brief", step: "fetch_users",
    });
    // Non-fatal — briefs are generated even if emails can't be sent
  }

  // 3 — Per-org brief generation
  let briefsGenerated = 0;
  let emailsSent      = 0;
  let totalSignals    = 0;

  for (const org of orgs as { id: string; owner_id: string }[]) {
    try {
      // Fetch this org's tracked competitor set (same source as Radar + Market Map)
      const allCompetitors = await getRadarFeed(50, org.id);
      const active = allCompetitors.filter((c) => c.signals_7d > 0);

      if (active.length === 0) continue; // no signal data — skip this org

      const signalCount = active.reduce((sum, c) => sum + (c.signals_7d ?? 0), 0);
      totalSignals += signalCount;

      // Generate brief with OpenAI
      const briefContent = await generateBrief(openaiKey, active, week);

      // Persist to Supabase scoped to this org
      const { data: briefRow, error: insertError } = await supabase
        .from("weekly_briefs")
        .insert({
          org_id:       org.id,
          content:      briefContent,
          signal_count: signalCount,
          generated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertError) {
        captureException(insertError, {
          route: "generate-brief",
          step: "brief_insert",
          org_id: org.id,
        });
        // Non-fatal — continue to next org
      } else {
        briefsGenerated++;
        void briefRow; // referenced in PostHog below if needed
      }

      // Send email to this org's owner
      const ownerEmail = userEmailById.get(org.owner_id);
      if (ownerEmail) {
        const emailHtml = buildBriefEmailHtml(briefContent, week, siteUrl);
        const result = await sendEmail({
          to:      ownerEmail,
          subject: `Your weekly competitor intelligence brief — ${week}`,
          html:    emailHtml,
          from:    FROM_BRIEFS,
        });
        if (result.ok) emailsSent++;
      }
    } catch (orgErr) {
      captureException(orgErr instanceof Error ? orgErr : new Error(String(orgErr)), {
        route: "generate-brief",
        step: "per_org_generation",
        org_id: org.id,
      });
      // Non-fatal — continue to next org
    }
  }

  // 4 — PostHog event (best-effort)
  const posthogKey = process.env.POSTHOG_API_KEY;
  if (posthogKey) {
    void fetch("https://app.posthog.com/capture", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key:     posthogKey,
        event:       "brief_generated",
        distinct_id: "system",
        properties:  {
          orgs_processed:  orgs.length,
          briefs_generated: briefsGenerated,
          emails_sent:      emailsSent,
          total_signals:    totalSignals,
          week,
        },
      }),
    });
  }

  await writeCronHeartbeat(supabase, "/api/generate-brief", "ok", Date.now() - runStart, emailsSent);

  return NextResponse.json({
    ok:               true,
    week,
    orgs_processed:   orgs.length,
    briefs_generated: briefsGenerated,
    emails_sent:      emailsSent,
    total_signals:    totalSignals,
  });
}

// GET — called by Vercel cron (Authorization: Bearer {CRON_SECRET} injected automatically)
export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runGeneration();
}

// POST — for manual triggers during development
export async function POST(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runGeneration();
}
