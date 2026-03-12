import { NextResponse } from "next/server";
import { getRadarFeed } from "../../../lib/api";
import { generateBrief, buildBriefEmailHtml } from "../../../lib/brief";
import { sendEmail, FROM_BRIEFS } from "../../../lib/email";
import { createServiceClient } from "../../../lib/supabase/service";

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

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://metrivant.com";

  // 1 — Fetch active competitors (signals in last 7 days)
  const allCompetitors = await getRadarFeed(50);
  const active = allCompetitors.filter((c) => c.signals_7d > 0);
  const signalCount = active.reduce((sum, c) => sum + (c.signals_7d ?? 0), 0);
  const week = weekLabel(new Date());

  // 2 — Generate brief with OpenAI
  const briefContent = await generateBrief(openaiKey, active, week);

  // 3 — Persist to Supabase (service role, bypasses RLS)
  const supabase = createServiceClient();
  const { data: briefRow, error: insertError } = await supabase
    .from("weekly_briefs")
    .insert({
      org_id:       null, // system-wide brief
      content:      briefContent,
      signal_count: signalCount,
      generated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[generate-brief] insert failed:", insertError.message);
    // Non-fatal — continue to email delivery
  }

  // 4 — Gather email recipients (all org owners)
  let recipients: string[] = [];
  try {
    const { data: orgs } = await supabase
      .from("organizations")
      .select("owner_id");

    if (orgs && orgs.length > 0) {
      const ownerIds = orgs.map((o: { owner_id: string }) => o.owner_id);
      const {
        data: { users },
      } = await supabase.auth.admin.listUsers({ perPage: 500 });

      recipients = users
        .filter((u) => u.email && ownerIds.includes(u.id))
        .map((u) => u.email!)
        .filter(Boolean);
    }
  } catch (err) {
    console.error("[generate-brief] failed to fetch recipients:", err);
  }

  // 5 — Send emails via canonical email module
  const emailsSent: string[] = [];

  if (recipients.length > 0) {
    const emailHtml = buildBriefEmailHtml(briefContent, week, siteUrl);

    const emailTasks = recipients.map((email) =>
      sendEmail({
        to:      email,
        subject: `Your weekly competitor intelligence brief — ${week}`,
        html:    emailHtml,
        from:    FROM_BRIEFS,
      }).then((result) => {
        if (result.ok) emailsSent.push(email);
      })
    );

    await Promise.allSettled(emailTasks);
  }

  // 6 — PostHog event (best-effort)
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
          signal_count:           signalCount,
          competitors_analyzed:   briefContent.competitors_analyzed.length,
          emails_sent:            emailsSent.length,
          week,
          brief_id:               briefRow?.id ?? null,
          prompt_tokens:          briefContent.prompt_tokens,
          completion_tokens:      briefContent.completion_tokens,
        },
      }),
    });
  }

  return NextResponse.json({
    ok:                   true,
    brief_id:             briefRow?.id ?? null,
    week,
    signal_count:         signalCount,
    competitors_analyzed: briefContent.competitors_analyzed.length,
    emails_sent:          emailsSent.length,
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
