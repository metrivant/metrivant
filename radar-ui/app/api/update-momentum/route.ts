// ── /api/update-momentum ──────────────────────────────────────────────────────
// Vercel cron: every 6 hours (0 */6 * * *)
// 1. Reads radar_feed for each org
// 2. Appends a momentum_history snapshot per competitor
// 3. Upserts competitor_momentum with current state
// 4. Emails org owner + fires PostHog if any competitor crossed → Accelerating

import { NextResponse } from "next/server";
import { createServiceClient } from "../../../lib/supabase/service";
import {
  getMomentumState,
  getMomentumConfig,
  buildMomentumAlertEmailHtml,
} from "../../../lib/momentum";

const POSTHOG_API_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
const RESEND_API_KEY  = process.env.RESEND_API_KEY ?? "";
const SITE_URL        = process.env.NEXT_PUBLIC_SITE_URL ?? "https://metrivant.com";
const FROM_EMAIL      = process.env.FROM_EMAIL ?? "alerts@metrivant.com";
const CRON_SECRET     = process.env.CRON_SECRET ?? "";

// Vercel cron auto-injects the Authorization header — accept both GET and POST.
export async function GET(request: Request) {
  return handler(request);
}
export async function POST(request: Request) {
  return handler(request);
}

async function handler(request: Request): Promise<NextResponse> {
  // Validate cron secret
  const auth = request.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const now = new Date().toISOString();

  // Load all orgs
  const { data: orgs, error: orgError } = await service
    .from("organizations")
    .select("id, owner_id");

  if (orgError || !orgs) {
    return NextResponse.json({ error: "Failed to load orgs" }, { status: 500 });
  }

  let totalSnapshots = 0;
  let totalAlerts    = 0;

  for (const org of orgs) {
    // Load current radar_feed for this org
    const { data: feed } = await service
      .from("radar_feed")
      .select("competitor_id, competitor_name, momentum_score")
      .eq("org_id", org.id)
      .limit(50);

    if (!feed || feed.length === 0) continue;

    // Load existing momentum states for threshold detection
    const { data: existing } = await service
      .from("competitor_momentum")
      .select("competitor_id, momentum_state")
      .eq("org_id", org.id);

    const prevStateMap = new Map<string, string>(
      (existing ?? []).map((r) => [r.competitor_id as string, r.momentum_state as string])
    );

    const historyRows: {
      org_id: string;
      competitor_id: string;
      momentum_score: number;
      momentum_state: string;
      recorded_at: string;
    }[] = [];

    const momentumUpserts: {
      org_id: string;
      competitor_id: string;
      competitor_name: string;
      momentum_score: number;
      momentum_state: string;
      previous_state: string | null;
      threshold_crossed_at: string | null;
      updated_at: string;
    }[] = [];

    const newlyAccelerating: { name: string; score: number }[] = [];

    for (const comp of feed) {
      const score = Number(comp.momentum_score ?? 0);
      const state = getMomentumState(score);
      const prevState = prevStateMap.get(comp.competitor_id as string) ?? null;
      const crossed = prevState !== "accelerating" && state === "accelerating";

      historyRows.push({
        org_id:         org.id,
        competitor_id:  comp.competitor_id as string,
        momentum_score: score,
        momentum_state: state,
        recorded_at:    now,
      });

      momentumUpserts.push({
        org_id:               org.id,
        competitor_id:        comp.competitor_id as string,
        competitor_name:      comp.competitor_name as string,
        momentum_score:       score,
        momentum_state:       state,
        previous_state:       prevState,
        threshold_crossed_at: crossed ? now : null,
        updated_at:           now,
      });

      if (crossed) {
        newlyAccelerating.push({ name: comp.competitor_name as string, score });
      }
    }

    // Batch insert history
    if (historyRows.length > 0) {
      await service.from("momentum_history").insert(historyRows);
      totalSnapshots += historyRows.length;
    }

    // Batch upsert current state
    if (momentumUpserts.length > 0) {
      await service
        .from("competitor_momentum")
        .upsert(momentumUpserts, { onConflict: "org_id,competitor_id" });
    }

    // Send alert email if new accelerating competitors detected
    if (newlyAccelerating.length > 0 && RESEND_API_KEY) {
      // Get org owner email
      const { data: userData } = await service.auth.admin.getUserById(org.owner_id as string);
      const email = userData?.user?.email;

      if (email) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: email,
            subject: `⚡ ${newlyAccelerating.length === 1 ? newlyAccelerating[0].name + " is" : `${newlyAccelerating.length} rivals are`} accelerating`,
            html: buildMomentumAlertEmailHtml(newlyAccelerating, SITE_URL),
          }),
        }).catch(() => null); // best-effort
      }

      totalAlerts += newlyAccelerating.length;
    }

    // PostHog events — one batch per accelerating competitor
    if (newlyAccelerating.length > 0 && POSTHOG_API_KEY) {
      const events = newlyAccelerating.map((c) => ({
        event: "high_momentum_detected",
        properties: {
          org_id:         org.id,
          competitor_name: c.name,
          momentum_score: c.score,
          momentum_state: "accelerating",
        },
      }));

      await fetch("https://app.posthog.com/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: POSTHOG_API_KEY, batch: events }),
      }).catch(() => null);
    }
  }

  return NextResponse.json({
    ok:             true,
    totalSnapshots,
    totalAlerts,
    processedOrgs:  orgs.length,
    timestamp:      now,
  });
}
