// ── /api/update-positioning ───────────────────────────────────────────────────
// Vercel cron: daily at 9:00 UTC (0 9 * * *)
// Runs after /api/strategic-analysis (08:00) to use fresh signal context.
//
// Pipeline:
//  1. Load all orgs
//  2. For each org, fetch radar_feed (via service client)
//  3. Call OpenAI gpt-4o to score competitors on the 2-axis market map
//  4. Detect significant shifts vs. previous known positions
//  5. Upsert competitor_positioning (current state)
//  6. Insert positioning_history (time series)
//  7. Email org owner if significant shift detected
//  8. Fire PostHog events

import { NextResponse } from "next/server";
import { createServiceClient } from "../../../lib/supabase/service";
import {
  generatePositioning,
  detectSignificantShift,
  buildRepositioningEmailHtml,
  type PositionShift,
} from "../../../lib/positioning";
import { sendEmail, FROM_ALERTS } from "../../../lib/email";
import { captureException } from "../../../lib/sentry";

const OPENAI_API_KEY  = process.env.OPENAI_API_KEY  ?? "";
const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY ?? "";
const SITE_URL        = process.env.NEXT_PUBLIC_SITE_URL ?? "https://metrivant.com";
const CRON_SECRET     = process.env.CRON_SECRET ?? "";

export async function GET(request: Request) { return handler(request); }
export async function POST(request: Request) { return handler(request); }

async function handler(request: Request): Promise<NextResponse> {
  const auth = request.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  const service      = createServiceClient();
  const analysisDate = new Date().toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  const { data: orgs } = await service
    .from("organizations")
    .select("id, owner_id");

  if (!orgs || orgs.length === 0) {
    return NextResponse.json({ ok: true, message: "No orgs", updated: 0 });
  }

  let totalUpdated = 0;
  let totalShifts  = 0;

  for (const org of orgs) {
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

      if (!feed || feed.length === 0) continue;

      // Generate positioning scores
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await generatePositioning(OPENAI_API_KEY, feed as any, analysisDate);

      if (result.positioning.length === 0) continue;

      // Load existing positions for shift detection
      const { data: existing } = await service
        .from("competitor_positioning")
        .select("competitor_id, market_focus_score, customer_segment_score")
        .eq("org_id", org.id);

      const prevMap = new Map(
        (existing ?? []).map((r) => [
          r.competitor_id as string,
          {
            market_focus_score:     Number(r.market_focus_score),
            customer_segment_score: Number(r.customer_segment_score),
          },
        ])
      );

      const now          = new Date().toISOString();
      const shifts:      PositionShift[] = [];
      const upsertRows:  object[]        = [];
      const historyRows: object[]        = [];

      for (const score of result.positioning) {
        const prev = prevMap.get(score.competitor_id);

        // Detect significant shift (only if we have a previous position)
        if (prev && detectSignificantShift(score, prev)) {
          shifts.push({
            competitor_name: score.competitor_name,
            old_focus:       prev.market_focus_score,
            new_focus:       score.market_focus_score,
            old_segment:     prev.customer_segment_score,
            new_segment:     score.customer_segment_score,
            rationale:       score.rationale,
          });
        }

        upsertRows.push({
          org_id:                 org.id,
          competitor_id:          score.competitor_id,
          competitor_name:        score.competitor_name,
          market_focus_score:     score.market_focus_score,
          customer_segment_score: score.customer_segment_score,
          confidence:             score.confidence,
          rationale:              score.rationale,
          updated_at:             now,
        });

        historyRows.push({
          org_id:                 org.id,
          competitor_id:          score.competitor_id,
          competitor_name:        score.competitor_name,
          market_focus_score:     score.market_focus_score,
          customer_segment_score: score.customer_segment_score,
          recorded_at:            now,
        });
      }

      // Upsert current positions
      if (upsertRows.length > 0) {
        await service
          .from("competitor_positioning")
          .upsert(upsertRows, { onConflict: "org_id,competitor_id" });
        totalUpdated += upsertRows.length;
      }

      // Append history (time series)
      if (historyRows.length > 0) {
        await service.from("positioning_history").insert(historyRows);
      }

      // Email on significant shifts — via canonical sendEmail()
      if (shifts.length > 0) {
        const { data: userData } = await service.auth.admin.getUserById(
          org.owner_id as string
        );
        const email = userData?.user?.email;

        if (email) {
          await sendEmail({
            to:      email,
            subject: shifts.length === 1
              ? `Competitor repositioning detected: ${shifts[0].competitor_name}`
              : `${shifts.length} competitors repositioning on market map`,
            html:    buildRepositioningEmailHtml(shifts, SITE_URL),
            from:    FROM_ALERTS,
          });

          totalShifts += shifts.length;
        }
      }

      // PostHog events — server-side key, distinct_id required
      if (POSTHOG_API_KEY && result.positioning.length > 0) {
        const events = result.positioning.map((p) => ({
          event:       "positioning_updated",
          distinct_id: "system",
          properties:  {
            org_id:                 org.id,
            competitor_id:          p.competitor_id,
            market_focus_score:     p.market_focus_score,
            customer_segment_score: p.customer_segment_score,
            confidence:             p.confidence,
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
        route:  "update-positioning",
        org_id: String(org.id),
      });
      console.error(`update-positioning: org ${org.id as string} failed:`, err);
    }
  }

  return NextResponse.json({
    ok:            true,
    totalUpdated,
    totalShifts,
    processedOrgs: orgs.length,
    analysisDate,
  });
}
