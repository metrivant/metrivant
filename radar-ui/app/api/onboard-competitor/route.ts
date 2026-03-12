import { createClient } from "../../../lib/supabase/server";
import { NextResponse } from "next/server";
import { sendEmail, buildTrackingConfirmationEmailHtml } from "../../../lib/email";
import { captureException } from "../../../lib/sentry";

const NEXT_PUBLIC_POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const url    = formData.get("url")    as string | null;
  const name   = formData.get("name")   as string | null;
  const sector = formData.get("sector") as string | null;

  if (!url || !name) {
    return NextResponse.json({ error: "url and name are required" }, { status: 400 });
  }

  // ── Resolve organization: select first, insert on miss, handle race condition.
  //
  // Reasoning: upsert() with onConflict silently returns null rows when the
  // conflict path performs a no-op UPDATE (no columns changed). This causes
  // orgError=null and data=null, which triggers a false "Failed to create
  // organization" error. The explicit select→insert pattern is robust.

  let orgId: string | null = null;

  const { data: existingOrg, error: selectError } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (selectError) {
    captureException(selectError, {
      route: "onboard-competitor",
      step: "org_select",
      user_id: user.id,
    });
    return NextResponse.json(
      { error: "Failed to resolve organization", detail: selectError.message },
      { status: 500 }
    );
  }

  if (existingOrg) {
    orgId = existingOrg.id as string;

    // Update sector if a valid new value was provided.
    if (sector) {
      const { error: updateError } = await supabase
        .from("organizations")
        .update({ sector })
        .eq("owner_id", user.id);

      if (updateError) {
        // Non-fatal: sector update failure does not block competitor tracking.
        captureException(updateError, {
          route: "onboard-competitor",
          step: "org_sector_update",
          user_id: user.id,
          sector,
        });
      }
    }
  } else {
    // No org — create one. Include sector default so NOT NULL constraint is met.
    const insertPayload: Record<string, string> = {
      owner_id: user.id,
      sector: sector ?? "saas",
    };

    const { data: newOrg, error: insertError } = await supabase
      .from("organizations")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insertError || !newOrg) {
      // Race condition: another concurrent request may have inserted between
      // our SELECT and INSERT. Re-select before returning an error.
      const { data: raceOrg, error: raceError } = await supabase
        .from("organizations")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (raceOrg) {
        orgId = raceOrg.id as string;
      } else {
        const err = insertError ?? raceError ?? new Error("org insert returned null");
        captureException(err, {
          route: "onboard-competitor",
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

  // ── Check if this is a new competitor (for deduplicating confirmation email) ──

  const { data: existing } = await supabase
    .from("tracked_competitors")
    .select("id")
    .eq("org_id", orgId)
    .eq("website_url", url)
    .maybeSingle();

  // ── Upsert tracked competitor (idempotent on org_id + website_url) ─────────

  const { error: competitorError } = await supabase
    .from("tracked_competitors")
    .upsert(
      { org_id: orgId, website_url: url, name },
      { onConflict: "org_id,website_url" }
    );

  if (competitorError) {
    captureException(competitorError, {
      route: "onboard-competitor",
      step: "competitor_upsert",
      user_id: user.id,
      org_id: orgId,
    });
    return NextResponse.json(
      { error: "Failed to track competitor", detail: competitorError.message },
      { status: 500 }
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://metrivant.com";

  // Send tracking confirmation only for new competitors (not duplicate submits).
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
