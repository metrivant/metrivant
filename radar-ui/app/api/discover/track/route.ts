import { createClient } from "../../../../lib/supabase/server";
import { NextResponse } from "next/server";

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

  // Resolve organisation — select first, insert on miss, handle race condition.
  // The upsert pattern with onConflict can silently fail when RLS prevents
  // the conflict-path SELECT from returning the existing row.
  let orgId: string | null = null;

  const { data: existingOrg } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (existingOrg) {
    orgId = existingOrg.id as string;
  } else {
    const { data: newOrg, error: insertError } = await supabase
      .from("organizations")
      .insert({ owner_id: user.id })
      .select("id")
      .single();

    if (insertError || !newOrg) {
      // Race condition: another request may have inserted between our SELECT and INSERT.
      const { data: raceOrg } = await supabase
        .from("organizations")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!raceOrg) {
        return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
      }
      orgId = raceOrg.id as string;
    } else {
      orgId = newOrg.id as string;
    }
  }

  // Upsert tracked competitor
  const { error: competitorError } = await supabase
    .from("tracked_competitors")
    .upsert(
      { org_id: orgId, website_url: url, name },
      { onConflict: "org_id,website_url" }
    );

  if (competitorError) {
    return NextResponse.json({ error: competitorError.message }, { status: 500 });
  }

  // PostHog — best-effort, fire-and-forget
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
