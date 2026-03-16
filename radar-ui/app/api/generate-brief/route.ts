import { NextResponse } from "next/server";
import { getRadarFeed } from "../../../lib/api";
import { generateBrief, buildBriefEmailHtml } from "../../../lib/brief";
import { clusterSignals, type Signal } from "../../../lib/brief/cluster-signals";
import { enrichClusterThemes } from "../../../lib/brief/enrich-cluster-themes";
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

      // ── Fetch raw signals for clustering ─────────────────────────────────
      // Build a richer prompt by clustering raw signals into strategic themes.
      // This step is best-effort — brief generation continues without clusters
      // if the query fails or returns no rows.
      const activeIds = active.map((c) => c.competitor_id);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const competitorNameById = new Map(active.map((c) => [c.competitor_id, c.competitor_name]));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;

      let clusters = undefined;
      try {
        // Fetch signals with their monitored_page (for section_type) and first interpretation
        const { data: rawRows } = await sb
          .from("signals")
          .select("id, competitor_id, signal_type, monitored_page_id, monitored_pages(page_type), interpretations(summary)")
          .in("competitor_id", activeIds)
          .gte("detected_at", sevenDaysAgo)
          .order("detected_at", { ascending: false })
          .limit(200);

        if (rawRows && rawRows.length > 0) {
          // Identify noise-marked signals and exclude them
          const allIds = (rawRows as { id: string }[]).map((r) => r.id);
          let noiseIds = new Set<string>();
          try {
            const { data: feedbackRows } = await sb
              .from("signal_feedback")
              .select("signal_id")
              .in("signal_id", allIds)
              .eq("verdict", "noise");
            noiseIds = new Set(
              ((feedbackRows ?? []) as { signal_id: string }[]).map((r) => r.signal_id)
            );
          } catch {
            // signal_feedback table may not exist in all environments — safe to skip
          }

          const signals: Signal[] = (rawRows as {
            id: string;
            competitor_id: string;
            signal_type: string | null;
            monitored_pages: { page_type: string } | null;
            interpretations: Array<{ summary: string }>;
          }[])
            .filter((r) => !noiseIds.has(r.id))
            .map((r) => ({
              id:              r.id,
              competitor_id:   r.competitor_id,
              competitor_name: competitorNameById.get(r.competitor_id) ?? r.competitor_id,
              section_type:    r.monitored_pages?.page_type ?? null,
              signal_type:     r.signal_type,
              interpretation:  r.interpretations?.[0]?.summary ?? null,
            }));

          const rawClusters = clusterSignals(signals);

          // Enrich cluster labels with gpt-4o-mini when there are ≤8 clusters
          // to keep per-org latency bounded.
          if (rawClusters.clusters.length > 0 && rawClusters.clusters.length <= 8) {
            clusters = await enrichClusterThemes(rawClusters, openaiKey);
          } else {
            clusters = rawClusters;
          }
        }
      } catch (clusterErr) {
        captureException(
          clusterErr instanceof Error ? clusterErr : new Error(String(clusterErr)),
          { route: "generate-brief", step: "cluster_signals", org_id: org.id }
        );
        // Non-fatal — proceed without clusters
      }

      // Generate brief with OpenAI
      const briefContent = await generateBrief(openaiKey, active, week, clusters);

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
