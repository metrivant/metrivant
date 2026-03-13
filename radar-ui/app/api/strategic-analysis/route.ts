// ── /api/strategic-analysis ───────────────────────────────────────────────────
// Vercel cron: daily at 8:00 UTC (0 8 * * *)
// Also callable on-demand via POST with cron secret.
//
// Pipeline:
//  1. Load all orgs
//  2. For each org, fetch radar_feed
//  3. Build structured prompt from competitor movements
//  4. Call gpt-4o to detect cross-competitor patterns
//  5. Store insights in strategic_insights
//  6. Send email if any is_major insights detected
//  7. Fire PostHog batch events

import { NextResponse } from "next/server";
import { createServiceClient } from "../../../lib/supabase/service";
import {
  generateStrategicAnalysis,
  buildStrategyAlertEmailHtml,
  type StrategicInsight,
} from "../../../lib/strategy";
import { sendEmail, FROM_ALERTS } from "../../../lib/email";
import { captureException } from "../../../lib/sentry";
import { writeCronHeartbeat } from "../../../lib/cronHeartbeat";

const OPENAI_API_KEY  = process.env.OPENAI_API_KEY  ?? "";
const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY ?? "";
const SITE_URL        = process.env.NEXT_PUBLIC_SITE_URL ?? "https://metrivant.com";
const CRON_SECRET     = process.env.CRON_SECRET ?? "";

export async function GET(request: Request) {
  return handler(request);
}
export async function POST(request: Request) {
  return handler(request);
}

async function handler(request: Request): Promise<NextResponse> {
  const auth = request.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  const service      = createServiceClient();
  const runStart     = Date.now();
  const analysisDate = new Date().toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
  // Cap OpenAI calls per run — prevents runaway costs at scale.
  // Override via OPENAI_MAX_ORGS_PER_RUN env var (default: 100).
  const maxOrgsPerRun = parseInt(process.env.OPENAI_MAX_ORGS_PER_RUN ?? "100");
  let processedOrgCount = 0;

  const { data: orgs } = await service
    .from("organizations")
    .select("id, owner_id");

  if (!orgs || orgs.length === 0) {
    return NextResponse.json({ ok: true, message: "No orgs to process", insights: 0 });
  }

  let totalInsights = 0;
  let totalMajor    = 0;

  for (const org of orgs) {
    if (processedOrgCount >= maxOrgsPerRun) break;
    try {
      // Load radar feed for this org
      const { data: feed } = await service
        .from("radar_feed")
        .select(
          "competitor_id, competitor_name, signals_7d, weighted_velocity_7d, " +
          "last_signal_at, latest_movement_type, latest_movement_confidence, " +
          "latest_movement_signal_count, latest_movement_velocity, " +
          "latest_movement_first_seen_at, latest_movement_last_seen_at, " +
          "latest_movement_summary, momentum_score"
        )
        .eq("org_id", org.id)
        .order("momentum_score", { ascending: false })
        .limit(30);

      if (!feed || feed.length < 2) continue;

      type FeedRow = {
        latest_movement_type?: string | null;
        signals_7d?: number | null;
      };

      // Need at least 2 competitors with any movement for pattern detection
      const withMovement = (feed as FeedRow[]).filter(
        (c) => c.latest_movement_type || Number(c.signals_7d) > 0
      );
      if (withMovement.length < 2) continue;

      // Generate strategic analysis
      const result = await generateStrategicAnalysis(
        OPENAI_API_KEY,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        feed as any,
        analysisDate
      );

      if (result.insights.length === 0) continue;

      // Insert insights — replace today's batch for this org
      // (idempotent daily run: delete today's then insert fresh)
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      // Guard: if insights were already inserted in the last hour, skip re-generation
      // to prevent double-fire email spam from concurrent cron executions.
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: recentCount } = await service
        .from("strategic_insights")
        .select("*", { count: "exact", head: true })
        .eq("org_id", org.id)
        .gte("created_at", oneHourAgo);
      if ((recentCount ?? 0) > 0) continue;

      await service
        .from("strategic_insights")
        .delete()
        .eq("org_id", org.id)
        .gte("created_at", todayStart.toISOString());

      const rows = result.insights.map((insight: StrategicInsight) => ({
        org_id:               org.id,
        pattern_type:         insight.pattern_type,
        strategic_signal:     insight.strategic_signal,
        description:          insight.description,
        recommended_response: insight.recommended_response,
        confidence:           insight.confidence,
        competitor_count:     insight.competitor_count,
        competitors_involved: insight.competitors_involved,
        is_major:             insight.is_major,
        signal_window_days:   30,
      }));

      await service.from("strategic_insights").insert(rows);
      totalInsights += rows.length;

      const majorInsights = result.insights.filter((i) => i.is_major);
      totalMajor += majorInsights.length;

      // Email via canonical sendEmail() — uses alerts@metrivant.com
      if (majorInsights.length > 0) {
        const { data: userData } = await service.auth.admin.getUserById(
          org.owner_id as string
        );
        const email = userData?.user?.email;

        if (email) {
          const subject =
            majorInsights.length === 1
              ? `Strategic pattern: ${majorInsights[0].strategic_signal.slice(0, 70)}`
              : `${majorInsights.length} strategic market patterns detected`;

          await sendEmail({
            to:      email,
            subject,
            html:    buildStrategyAlertEmailHtml(majorInsights, SITE_URL),
            from:    FROM_ALERTS,
          });
        }
      }

      // PostHog batch events — server-side key, distinct_id required
      if (POSTHOG_API_KEY && result.insights.length > 0) {
        const events = result.insights.map((insight) => ({
          event:       "strategy_pattern_detected",
          distinct_id: "system",
          properties:  {
            org_id:           org.id,
            pattern_type:     insight.pattern_type,
            is_major:         insight.is_major,
            confidence:       insight.confidence,
            competitor_count: insight.competitor_count,
          },
        }));

        await fetch("https://app.posthog.com/batch", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ api_key: POSTHOG_API_KEY, batch: events }),
        }).catch(() => null);
      }
    } catch (err) {
      captureException(err instanceof Error ? err : new Error(String(err)), {
        route:  "strategic-analysis",
        org_id: String(org.id),
      });
      console.error(`strategic-analysis: org ${org.id as string} failed:`, err);
    }
    processedOrgCount++;
  }

  await writeCronHeartbeat(service, "/api/strategic-analysis", "ok", Date.now() - runStart, totalInsights);

  return NextResponse.json({
    ok:            true,
    totalInsights,
    totalMajor,
    processedOrgs: orgs.length,
    analysisDate,
  });
}
