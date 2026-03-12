import { createClient } from "../../../lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const url = formData.get("url") as string | null;
  const name = formData.get("name") as string | null;

  if (!url || !name) {
    return NextResponse.json({ error: "url and name are required" }, { status: 400 });
  }

  // Upsert organization for this user
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .upsert({ owner_id: user.id }, { onConflict: "owner_id" })
    .select("id")
    .single();

  if (orgError || !org) {
    return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
  }

  // Insert tracked competitor
  const { error: competitorError } = await supabase
    .from("tracked_competitors")
    .upsert(
      { org_id: org.id, website_url: url, name },
      { onConflict: "org_id,website_url" }
    );

  if (competitorError) {
    return NextResponse.json({ error: competitorError.message }, { status: 500 });
  }

  // Fire competitor_added event — non-blocking, fire and forget.
  const phKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (phKey) {
    fetch("https://app.posthog.com/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key:     phKey,
        event:       "competitor_added",
        distinct_id: user.id,
        properties:  { competitor_name: name, website_url: url },
      }),
    }).catch(() => null);
  }

  return NextResponse.redirect(new URL("/app", request.url), { status: 302 });
}
