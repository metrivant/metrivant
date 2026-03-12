import { createClient } from "../../../lib/supabase/server";
import { NextResponse } from "next/server";
import { sendEmail, buildTrackingConfirmationEmailHtml } from "../../../lib/email";

const NEXT_PUBLIC_POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const url  = formData.get("url")  as string | null;
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

  // Check if competitor is newly added (for confirmation email — avoid resending on duplicate submits)
  const { data: existing } = await supabase
    .from("tracked_competitors")
    .select("id")
    .eq("org_id", org.id)
    .eq("website_url", url)
    .maybeSingle();

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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://metrivant.com";

  // Send tracking confirmation only for newly added competitors (not duplicate submits).
  if (!existing && user.email) {
    void sendEmail({
      to:      user.email,
      subject: "Your competitor radar is live",
      html:    buildTrackingConfirmationEmailHtml(name, url, siteUrl),
    });
  }

  // Fire competitor_added PostHog event — non-blocking.
  if (NEXT_PUBLIC_POSTHOG_KEY) {
    void fetch("https://app.posthog.com/capture", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key:     NEXT_PUBLIC_POSTHOG_KEY,
        event:       "competitor_added",
        distinct_id: user.id,
        properties:  { competitor_name: name, website_url: url },
      }),
    });
  }

  return NextResponse.redirect(new URL("/app", request.url), { status: 302 });
}
