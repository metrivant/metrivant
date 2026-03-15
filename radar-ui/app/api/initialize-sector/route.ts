import { createClient } from "../../../lib/supabase/server";
import { NextResponse } from "next/server";
import { getSectorRandomDefaults } from "../../../lib/sector-catalog";
import { captureException, captureMessage } from "../../../lib/sentry";

// All sectors accepted by the onboarding selector.
// The core pipeline is sector-agnostic; this string is stored for display
// language and catalog curation purposes only.
const VALID_SECTORS = [
  "saas",
  "cybersecurity",
  "energy",
  "defense",
  "fintech",
  "ai-infrastructure",
  "devtools",
  "healthcare",
  "consumer-tech",
  "custom",
] as const;

type ValidSector = (typeof VALID_SECTORS)[number];

function isValidSector(v: unknown): v is ValidSector {
  return typeof v === "string" && (VALID_SECTORS as readonly string[]).includes(v);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sector = (body as Record<string, unknown>)?.sector;

  if (!isValidSector(sector)) {
    return NextResponse.json({ error: "Invalid sector" }, { status: 400 });
  }

  // ── Step 1: Resolve or create the organization ────────────────────────────

  let orgId: string | null = null;

  // Use limit(1) instead of maybeSingle() to tolerate duplicate org rows.
  // maybeSingle() returns PGRST116 if >1 row exists; limit(1) always succeeds.
  const { data: orgRows, error: selectError } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (selectError) {
    captureException(selectError, {
      route: "initialize-sector",
      step: "org_select",
      user_id: user.id,
    });
    return NextResponse.json({ error: "Failed to resolve organization" }, { status: 500 });
  }

  const existingOrg = orgRows?.[0] ?? null;

  if (existingOrg) {
    orgId = existingOrg.id as string;

    const { error: updateError } = await supabase
      .from("organizations")
      .update({ sector })
      .eq("owner_id", user.id);

    if (updateError) {
      captureException(updateError, {
        route: "initialize-sector",
        step: "org_sector_update",
        user_id: user.id,
        sector,
      });
      return NextResponse.json({ error: "Failed to update sector" }, { status: 500 });
    }
  } else {
    const { data: newOrg, error: insertError } = await supabase
      .from("organizations")
      .insert({ owner_id: user.id, sector })
      .select("id")
      .single();

    if (insertError || !newOrg) {
      // Race condition: re-select before failing.
      const { data: raceRows } = await supabase
        .from("organizations")
        .select("id")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);

      const raceOrg = raceRows?.[0] ?? null;
      if (raceOrg) {
        orgId = raceOrg.id as string;
      } else {
        const err = insertError ?? new Error("org insert returned null");
        captureException(err, {
          route: "initialize-sector",
          step: "org_insert",
          user_id: user.id,
        });
        return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
      }
    } else {
      orgId = newOrg.id as string;
    }
  }

  // ── Step 2: Clear existing tracked competitors for this org ───────────────
  //
  // Sector switch resets the competitor slate. Users who want to keep specific
  // competitors can re-add them manually after onboarding.

  const { error: deleteError } = await supabase
    .from("tracked_competitors")
    .delete()
    .eq("org_id", orgId);

  if (deleteError) {
    captureException(deleteError, {
      route: "initialize-sector",
      step: "clear_competitors",
      user_id: user.id,
      org_id: orgId,
    });
    return NextResponse.json({ error: "Failed to clear existing competitors" }, { status: 500 });
  }

  // ── Step 3: Seed default competitors for the selected sector ──────────────
  //
  // "custom" has no defaults — user starts with an empty slate.
  // Top 5 competitors are always included; remaining slots are randomly sampled
  // from the extended pool (priority 6–15) for variety across sector switches.
  //
  // Count is plan-aware: analyst/trial = 10, pro = up to 15 (catalog ceiling).
  // "starter" is the legacy value for analyst — normalised here.

  const plan = user.user_metadata?.plan as string | undefined;
  const normalizedPlan = !plan || plan === "starter" ? "analyst" : plan;
  const seedCount = normalizedPlan === "pro" ? 15 : 10;

  const defaults = getSectorRandomDefaults(sector, seedCount);
  let seeded = 0;

  if (defaults.length > 0) {
    const rows = defaults.map(({ name, website_url }) => ({
      org_id: orgId as string,
      name,
      website_url,
    }));

    const { error: seedError } = await supabase
      .from("tracked_competitors")
      .insert(rows);

    if (seedError) {
      captureException(seedError, {
        route: "initialize-sector",
        step: "seed_competitors",
        user_id: user.id,
        org_id: orgId,
        sector,
      });
      return NextResponse.json({ error: "Failed to seed competitors" }, { status: 500 });
    }

    // seeded is incremented per-competitor after successful onboard + backfill below.
  }

  // ── Step 4: Bridge to pipeline runtime ────────────────────────────────────
  //
  // Onboard each competitor into the pipeline so that monitored_pages and
  // extraction_rules are created immediately. Runs in parallel and awaited
  // before returning — Vercel terminates the function on response so a
  // fire-and-forget IIFE would never complete.

  const runtimeUrl = process.env.RUNTIME_URL ?? "https://metrivant-runtime.vercel.app";
  const cronSecret = process.env.CRON_SECRET;

  let failedCount = 0;

  if (cronSecret && defaults.length > 0) {
    const onboardResults = await Promise.allSettled(
      defaults.map((comp) =>
        fetch(`${runtimeUrl}/api/onboard-competitor`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${cronSecret}`,
          },
          body: JSON.stringify({ name: comp.name, website_url: comp.website_url, sector }),
        })
      )
    );

    for (let index = 0; index < onboardResults.length; index++) {
      const result = onboardResults[index];
      const comp = defaults[index];

      if (result.status === "rejected") {
        // Network-level failure — fetch itself threw (timeout, DNS, etc.)
        failedCount += 1;
        captureException(
          new Error(`onboard-competitor network error: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`),
          {
            route: "initialize-sector",
            step: "onboard_competitor_network",
            competitor_name: comp?.name ?? "unknown",
            org_id: orgId,
            sector,
          }
        );
        // Remove the null row — a failed onboard produces a ghost entry that
        // is invisible to radar-feed but pollutes tracked_competitors.
        await supabase
          .from("tracked_competitors")
          .delete()
          .eq("org_id", orgId)
          .eq("website_url", comp.website_url);
      } else if (!result.value.ok) {
        // HTTP-level failure — runtime responded but with a non-2xx status.
        // Use captureMessage (warning) not captureException — this is a transient
        // infrastructure failure, not a code bug. Avoids Sentry error noise.
        failedCount += 1;
        captureMessage(
          `onboard-competitor HTTP ${result.value.status} for ${comp?.name ?? "unknown"}`,
          {
            route: "initialize-sector",
            step: "onboard_competitor_http",
            competitor_name: comp?.name ?? "unknown",
            http_status: result.value.status,
            org_id: orgId,
            sector,
          },
          "warning"
        );
        // Remove the null row for the same reason as above.
        await supabase
          .from("tracked_competitors")
          .delete()
          .eq("org_id", orgId)
          .eq("website_url", comp.website_url);
      } else {
        // Success — parse the response body and backfill competitor_id into
        // tracked_competitors so radar-feed can surface this competitor.
        // Without this, tracked_competitors rows have competitor_id = null and
        // are invisible to the pipeline (radar-feed filters .not("competitor_id", "is", null)).
        try {
          const responseBody = await result.value.json() as { competitor_id?: string };
          if (responseBody.competitor_id) {
            await supabase
              .from("tracked_competitors")
              .update({ competitor_id: responseBody.competitor_id })
              .eq("org_id", orgId)
              .eq("website_url", comp.website_url);
            seeded += 1;
          }
        } catch (backfillErr) {
          // Backfill failed — remove the null row so it doesn't ghost the radar.
          captureException(
            new Error(`onboard-competitor: failed to backfill competitor_id for ${comp?.name ?? "unknown"}`),
            {
              route: "initialize-sector",
              step: "backfill_competitor_id",
              competitor_name: comp?.name ?? "unknown",
              org_id: orgId,
              sector,
              original_error: backfillErr instanceof Error ? backfillErr.message : String(backfillErr),
            }
          );
          failedCount += 1;
          await supabase
            .from("tracked_competitors")
            .delete()
            .eq("org_id", orgId)
            .eq("website_url", comp.website_url);
        }
      }
    }
  }

  // Post-seeding integrity warning: if any competitors failed to onboard they will
  // exist in tracked_competitors (and eventually in the competitors pipeline table)
  // but have no monitored_pages. They will show on the radar with momentum_score=0
  // permanently — visually indistinguishable from a real quiet competitor.
  if (failedCount > 0) {
    captureMessage(
      "tracked_competitor_no_monitored_pages",
      {
        failed_count: failedCount,
        seeded_count: seeded,
        org_id: orgId ?? "unknown",
        sector,
      },
      "warning"
    );
  }

  return NextResponse.json({
    ok: true,
    seeded,
    attempted: defaults.length,
    failed: failedCount,
    partial: failedCount > 0,
    custom: sector === "custom",
  });
}
