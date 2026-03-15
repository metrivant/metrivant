import { createClient } from "../../../lib/supabase/server";
import { createServiceClient } from "../../../lib/supabase/service";
import { NextResponse } from "next/server";
import { captureException } from "../../../lib/sentry";

// POST /api/clean-slate
//
// Removes all tracked competitors for the authenticated user's org and resets
// the sector to "custom".
//
// Architecture note:
//   competitors            = pipeline registry — NEVER modified here
//   tracked_competitors    = org-scoped tracking relation — deleted here
//   monitored_pages.active = set false for competitors no longer tracked by ANY org
//
// radar-feed.ts uses tracked_competitors as the source of truth, so deleting
// the tracking rows is sufficient for the radar to clear immediately.
// monitored_pages are deactivated to stop the crawler from fetching orphan pages,
// but only when no other org still tracks the same competitor (multi-org safe).
//
// This is a destructive but recoverable action — users can re-add competitors
// from the Discover page or by switching to any sector.

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Resolve org ────────────────────────────────────────────────────────────

  const { data: orgRows, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (orgError) {
    captureException(orgError, { route: "clean-slate", step: "org_select", user_id: user.id });
    return NextResponse.json({ error: "Failed to resolve organization" }, { status: 500 });
  }

  const org = orgRows?.[0] ?? null;
  if (!org) {
    return NextResponse.json({ ok: true, removed: 0 });
  }

  const orgId = org.id as string;

  // ── Collect competitor_ids before deletion (needed for page deactivation) ────

  const { data: trackedRows, count } = await supabase
    .from("tracked_competitors")
    .select("competitor_id", { count: "exact" })
    .eq("org_id", orgId);

  const removed = count ?? 0;
  const competitorIds = [
    ...new Set(
      ((trackedRows ?? []) as { competitor_id: string | null }[])
        .map((r) => r.competitor_id)
        .filter((id): id is string => !!id)
    ),
  ];

  // ── Delete all tracked competitors for this org ────────────────────────────

  const { error: deleteError } = await supabase
    .from("tracked_competitors")
    .delete()
    .eq("org_id", orgId);

  if (deleteError) {
    captureException(deleteError, { route: "clean-slate", step: "delete_competitors", user_id: user.id, org_id: orgId });
    return NextResponse.json({ error: "Failed to clear competitors" }, { status: 500 });
  }

  // ── Deactivate monitored pages for fully untracked competitors ────────────
  // Only deactivate pages for competitors that are no longer tracked by ANY org.
  // Competitors still tracked by another org must keep their pages active.

  if (competitorIds.length > 0) {
    try {
      const { data: stillTrackedRows } = await supabase
        .from("tracked_competitors")
        .select("competitor_id")
        .in("competitor_id", competitorIds);

      const stillTrackedIds = new Set(
        ((stillTrackedRows ?? []) as { competitor_id: string }[]).map((r) => r.competitor_id)
      );
      const fullyUntracked = competitorIds.filter((id) => !stillTrackedIds.has(id));

      if (fullyUntracked.length > 0) {
        const serviceSupabase = createServiceClient();
        const { error } = await serviceSupabase
          .from("monitored_pages")
          .update({ active: false })
          .in("competitor_id", fullyUntracked);
        if (error) captureException(error, { route: "clean-slate", step: "deactivate_pages", user_id: user.id, org_id: orgId });
      }
    } catch (pageError) {
      // Non-fatal — competitor removal already succeeded
      captureException(pageError, { route: "clean-slate", step: "deactivate_pages_catch", user_id: user.id, org_id: orgId });
    }
  }

  // ── Reset sector to custom ─────────────────────────────────────────────────

  const { error: sectorError } = await supabase
    .from("organizations")
    .update({ sector: "custom" })
    .eq("id", orgId);

  if (sectorError) {
    captureException(sectorError, { route: "clean-slate", step: "reset_sector", user_id: user.id, org_id: orgId });
    // Non-fatal — competitor removal already succeeded
  }

  return NextResponse.json({ ok: true, removed });
}
