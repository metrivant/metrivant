import { createClient } from "../../../lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/onboarding-status
 *
 * Returns real-time pipeline progress during sector initialization.
 * Used by SectorSelectClient to show live status as competitors are onboarded.
 *
 * Response shape:
 * {
 *   stage: "seeding" | "onboarding" | "monitoring" | "ready",
 *   tracked: number,          // tracked_competitors rows
 *   onboarded: number,        // competitors with competitor_id backfilled
 *   pages_created: number,    // monitored_pages count
 *   snapshots_captured: number // snapshots count for org's pages
 * }
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve org_id
  const { data: orgRows } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  const orgId = orgRows?.[0]?.id as string | undefined;

  if (!orgId) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Count tracked_competitors
  const { count: trackedCount } = await supabase
    .from("tracked_competitors")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  // Count tracked_competitors with competitor_id backfilled (onboarded)
  const { count: onboardedCount } = await supabase
    .from("tracked_competitors")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .not("competitor_id", "is", null);

  // Count monitored_pages for this org's competitors
  // Join: tracked_competitors -> competitors -> monitored_pages
  const { data: competitorIds } = await supabase
    .from("tracked_competitors")
    .select("competitor_id")
    .eq("org_id", orgId)
    .not("competitor_id", "is", null);

  const compIds = (competitorIds ?? [])
    .map((row) => row.competitor_id)
    .filter((id): id is string => id !== null);

  let pagesCount = 0;
  if (compIds.length > 0) {
    const { count } = await supabase
      .from("monitored_pages")
      .select("*", { count: "exact", head: true })
      .in("competitor_id", compIds);
    pagesCount = count ?? 0;
  }

  // Count snapshots for this org's monitored_pages
  let snapshotsCount = 0;
  if (compIds.length > 0) {
    // Get page IDs first
    const { data: pageRows } = await supabase
      .from("monitored_pages")
      .select("id")
      .in("competitor_id", compIds);

    const pageIds = (pageRows ?? []).map((p) => p.id);

    if (pageIds.length > 0) {
      const { count } = await supabase
        .from("snapshots")
        .select("*", { count: "exact", head: true })
        .in("page_id", pageIds);
      snapshotsCount = count ?? 0;
    }
  }

  // Determine stage
  const tracked = trackedCount ?? 0;
  const onboarded = onboardedCount ?? 0;

  let stage: "seeding" | "onboarding" | "monitoring" | "ready" = "ready";

  if (tracked === 0) {
    stage = "seeding";
  } else if (onboarded < tracked) {
    stage = "onboarding";
  } else if (pagesCount > 0 && snapshotsCount === 0) {
    stage = "monitoring";
  } else if (snapshotsCount > 0) {
    stage = "ready";
  } else {
    // Edge case: onboarded but no pages yet
    stage = "monitoring";
  }

  return NextResponse.json({
    stage,
    tracked,
    onboarded,
    pages_created: pagesCount,
    snapshots_captured: snapshotsCount,
  });
}
