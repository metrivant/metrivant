import { createClient } from "../../../../lib/supabase/server";
import { NextResponse } from "next/server";
import { captureException } from "../../../../lib/sentry";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as { url?: string; name?: string; domain?: string };
  const { url, name, domain } = body;

  if (!url || typeof url !== "string" || !name || typeof name !== "string") {
    return NextResponse.json({ error: "url and name are required" }, { status: 400 });
  }

  if (url.length > 2048 || name.length > 200) {
    return NextResponse.json({ error: "Input exceeds maximum length" }, { status: 400 });
  }

  // Prevent SSRF: only allow http/https URLs with no internal/loopback targets.
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("protocol");
    }
    const h = parsed.hostname.toLowerCase();
    if (h === "localhost" || h.startsWith("127.") || h.startsWith("10.") ||
        h.startsWith("192.168.") || h === "0.0.0.0" || h.endsWith(".local") ||
        h === "169.254.169.254") {
      throw new Error("internal");
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // ── Resolve organization: select first, insert on miss, handle race condition.
  //
  // The upsert pattern with onConflict can silently fail when RLS prevents
  // the conflict-path SELECT from returning the existing row.

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
      route: "discover/track",
      step: "org_select",
      user_id: user.id,
    });
    return NextResponse.json({ error: "Failed to resolve organization" }, { status: 500 });
  }

  const existingOrg = orgRows?.[0] ?? null;

  if (existingOrg) {
    orgId = existingOrg.id as string;
  } else {
    // Explicit sector default avoids NOT NULL violations if migration 008 is applied.
    const { data: newOrg, error: insertError } = await supabase
      .from("organizations")
      .insert({ owner_id: user.id, sector: "saas" })
      .select("id")
      .single();

    if (insertError || !newOrg) {
      // Race condition: another request may have inserted between our SELECT and INSERT.
      const { data: raceRows, error: raceError } = await supabase
        .from("organizations")
        .select("id")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);

      const raceOrg = raceRows?.[0] ?? null;
      if (raceOrg) {
        orgId = raceOrg.id as string;
      } else {
        const err = insertError ?? raceError ?? new Error("org insert returned null");
        captureException(err, {
          route: "discover/track",
          step: "org_insert",
          user_id: user.id,
        });
        return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
      }
    } else {
      orgId = newOrg.id as string;
    }
  }

  // ── Plan limit enforcement ────────────────────────────────────────────────
  // Check against the limit only when adding a NEW competitor (not re-adding
  // an existing one — the upsert below is idempotent for duplicates).

  const { count: alreadyTracked } = await supabase
    .from("tracked_competitors")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("website_url", url);

  if ((alreadyTracked ?? 0) === 0) {
    const planValue = user.user_metadata?.plan as string | undefined;
    const limit = planValue === "pro" ? 25 : 10;

    // Count only properly linked rows (competitor_id IS NOT NULL) so ghost rows
    // from failed onboard attempts don't consume plan quota.
    const { count: currentCount } = await supabase
      .from("tracked_competitors")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .not("competitor_id", "is", null);

    if ((currentCount ?? 0) >= limit) {
      return NextResponse.json(
        { error: "Competitor limit reached for your plan", limit, upgrade_url: "/app/billing?limit=1" },
        { status: 403 }
      );
    }
  }

  // ── Upsert tracked competitor (idempotent on org_id + website_url) ──────────

  const { error: competitorError } = await supabase
    .from("tracked_competitors")
    .upsert(
      { org_id: orgId, website_url: url, name },
      { onConflict: "org_id,website_url", ignoreDuplicates: true }
    );

  if (competitorError) {
    captureException(competitorError, {
      route: "discover/track",
      step: "competitor_upsert",
      user_id: user.id,
      org_id: orgId,
    });
    return NextResponse.json({ error: "Failed to track competitor" }, { status: 500 });
  }

  // ── Onboard into pipeline runtime (backfills competitor_id) ──────────────
  //
  // Without this call, the tracked_competitors row has competitor_id = null
  // and is invisible to radar-feed, Market Map, and all cron analysis routes.
  // On any failure we delete the ghost row and surface an error to the caller.

  const runtimeUrl = process.env.RUNTIME_URL ?? "https://metrivant-runtime.vercel.app";
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    // Look up org sector for the onboard call (non-fatal default: "custom")
    let sector = "custom";
    try {
      const { data: orgData } = await supabase
        .from("organizations")
        .select("sector")
        .eq("id", orgId)
        .limit(1);
      if (orgData?.[0]?.sector) sector = orgData[0].sector as string;
    } catch { /* non-fatal — default sector used */ }

    let onboardOk = false;
    try {
      const res = await fetch(`${runtimeUrl}/api/onboard-competitor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({ name, website_url: url, sector }),
      });

      if (res.ok) {
        const body = await res.json() as { competitor_id?: string };
        if (body.competitor_id) {
          await supabase
            .from("tracked_competitors")
            .update({ competitor_id: body.competitor_id })
            .eq("org_id", orgId)
            .eq("website_url", url);
          onboardOk = true;
        }
      }
    } catch { /* network-level failure — handled below */ }

    if (!onboardOk) {
      // Remove the ghost row so it doesn't consume quota or pollute the tracked set
      await supabase
        .from("tracked_competitors")
        .delete()
        .eq("org_id", orgId)
        .eq("website_url", url);
      return NextResponse.json({ error: "Failed to initialize competitor monitoring" }, { status: 503 });
    }
  }

  // PostHog — best-effort, fire-and-forget.
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? process.env.POSTHOG_API_KEY;
  if (posthogKey) {
    void fetch("https://app.posthog.com/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: posthogKey,
        batch: [
          {
            event: "competitor_discovered",
            distinct_id: user.id,
            properties: { source: "discovery" },
          },
          {
            event: "competitor_added_from_discovery",
            distinct_id: user.id,
            properties: {},
          },
        ],
      }),
    });
  }

  return NextResponse.json({ ok: true });
}
