import { createClient } from "../../../lib/supabase/server";
import { NextResponse } from "next/server";
import { captureException } from "../../../lib/sentry";

// POST /api/clean-slate
//
// Removes all tracked competitors for the authenticated user's org and resets
// the sector to "custom". Pipeline-side competitors are deactivated via the
// runtime onboard-competitor inverse (setting active=false) for each known URL.
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
    // No org means no tracked competitors — nothing to do
    return NextResponse.json({ ok: true, removed: 0 });
  }

  const orgId = org.id as string;

  // ── Count tracked competitors before deletion ──────────────────────────────

  const { count } = await supabase
    .from("tracked_competitors")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  const removed = count ?? 0;

  // ── Delete all tracked competitors for this org ────────────────────────────

  const { error: deleteError } = await supabase
    .from("tracked_competitors")
    .delete()
    .eq("org_id", orgId);

  if (deleteError) {
    captureException(deleteError, { route: "clean-slate", step: "delete_competitors", user_id: user.id, org_id: orgId });
    return NextResponse.json({ error: "Failed to clear competitors" }, { status: 500 });
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
