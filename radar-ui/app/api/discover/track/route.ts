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

  // Upsert organization
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .upsert({ owner_id: user.id }, { onConflict: "owner_id" })
    .select("id")
    .single();

  if (orgError || !org) {
    return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
  }

  // Upsert tracked competitor
  const { error: competitorError } = await supabase
    .from("tracked_competitors")
    .upsert(
      { org_id: org.id, website_url: url, name },
      { onConflict: "org_id,website_url" }
    );

  if (competitorError) {
    return NextResponse.json({ error: competitorError.message }, { status: 500 });
  }

  // PostHog — best-effort, fire-and-forget
  const posthogKey = process.env.POSTHOG_API_KEY;
  if (posthogKey) {
    void fetch("https://app.posthog.com/capture/", {
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
