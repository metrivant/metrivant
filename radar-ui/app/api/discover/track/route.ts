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

  if (!url || !name) {
    return NextResponse.json({ error: "url and name are required" }, { status: 400 });
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
    return NextResponse.json(
      { error: "Failed to resolve organization", detail: selectError.message },
      { status: 500 }
    );
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
        return NextResponse.json(
          { error: "Failed to create organization", detail: String(err) },
          { status: 500 }
        );
      }
    } else {
      orgId = newOrg.id as string;
    }
  }

  // ── Upsert tracked competitor (idempotent on org_id + website_url) ──────────

  const { error: competitorError } = await supabase
    .from("tracked_competitors")
    .upsert(
      { org_id: orgId, website_url: url, name },
      { onConflict: "org_id,website_url" }
    );

  if (competitorError) {
    captureException(competitorError, {
      route: "discover/track",
      step: "competitor_upsert",
      user_id: user.id,
      org_id: orgId,
    });
    return NextResponse.json(
      { error: "Failed to track competitor", detail: competitorError.message },
      { status: 500 }
    );
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
            distinct_id: user.email ?? user.id,
            properties: { domain, name, source: "discovery" },
          },
          {
            event: "competitor_added_from_discovery",
            distinct_id: user.email ?? user.id,
            properties: { domain, name },
          },
        ],
      }),
    });
  }

  return NextResponse.json({ ok: true });
}
