import { createClient } from "../../../../lib/supabase/server";
import { createServiceClient } from "../../../../lib/supabase/service";
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = (body as Record<string, unknown>)?.url;
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  // Resolve the org owned by this user.
  const { data: orgRows, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (orgError) {
    captureException(orgError, { route: "discover/untrack", step: "org_select", user_id: user.id });
    return NextResponse.json({ error: "Failed to resolve organization" }, { status: 500 });
  }

  const orgId = (orgRows?.[0]?.id as string | null) ?? null;
  if (!orgId) {
    return NextResponse.json({ error: "No organization found" }, { status: 404 });
  }

  // Fetch the tracked row first so we have competitor_id for the pipeline step.
  const { data: trackedRow } = await supabase
    .from("tracked_competitors")
    .select("competitor_id")
    .eq("org_id", orgId)
    .eq("website_url", url)
    .maybeSingle();

  const competitorId = (trackedRow as { competitor_id: string | null } | null)?.competitor_id ?? null;

  // Delete the specific tracked competitor for this org.
  // RLS enforces ownership — only rows where org.owner_id = auth.uid() are deletable.
  const { error: deleteError } = await supabase
    .from("tracked_competitors")
    .delete()
    .eq("org_id", orgId)
    .eq("website_url", url);

  if (deleteError) {
    captureException(deleteError, {
      route: "discover/untrack",
      step: "delete",
      user_id: user.id,
      org_id: orgId,
    });
    return NextResponse.json({ error: "Failed to remove competitor" }, { status: 500 });
  }

  // ── Deactivate monitored pages if no org tracks this competitor anymore ─────
  // competitors table is never touched here — it is a pipeline registry.
  // monitored_pages.active = false stops the crawler from fetching orphan pages.
  // Multi-org safe: only deactivate if zero tracked_competitors rows remain
  // for this competitor across all orgs (not just this one).
  // Non-fatal — tracked_competitors row is already gone; radar self-corrects.
  if (competitorId) {
    try {
      const { count: stillTracked } = await supabase
        .from("tracked_competitors")
        .select("*", { count: "exact", head: true })
        .eq("competitor_id", competitorId);

      if ((stillTracked ?? 0) === 0) {
        const serviceSupabase = createServiceClient();
        const { error } = await serviceSupabase
          .from("monitored_pages")
          .update({ active: false })
          .eq("competitor_id", competitorId);
        if (error) captureException(error, { route: "discover/untrack", step: "deactivate_pages", user_id: user.id });
      }
    } catch {
      // Non-fatal — tracked_competitors row already deleted
    }
  }

  return NextResponse.json({ ok: true });
}
