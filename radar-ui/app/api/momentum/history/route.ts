// ── /api/momentum/history ─────────────────────────────────────────────────────
// GET /api/momentum/history?competitor_id=xxx
// Returns the last 60 momentum snapshots (≈15 days at 6h cron cadence)
// for a specific competitor, scoped to the requesting user's org.

import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { captureException } from "../../../../lib/sentry";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const competitorId = searchParams.get("competitor_id");

  if (!competitorId) {
    return NextResponse.json({ error: "competitor_id required" }, { status: 400 });
  }

  // Authenticate user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve org
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!org) {
    return NextResponse.json({ points: [] });
  }

  const { data: history, error: historyError } = await supabase
    .from("momentum_history")
    .select("momentum_score, momentum_state, recorded_at")
    .eq("org_id", org.id)
    .eq("competitor_id", competitorId)
    .order("recorded_at", { ascending: true })
    .limit(60);

  if (historyError) {
    captureException(new Error("momentum/history: DB query failed"), {
      route: "momentum/history",
      competitor_id: competitorId,
      error_message: historyError.message,
    });
    return NextResponse.json({ points: [] });
  }

  const points = (history ?? []).map((row) => ({
    score:      Number(row.momentum_score),
    state:      row.momentum_state as string,
    recordedAt: row.recorded_at as string,
  }));

  return NextResponse.json({ points }, {
    headers: { "Cache-Control": "no-store" },
  });
}
