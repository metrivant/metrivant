import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

// ── Types ──────────────────────────────────────────────────────────────────────

type PositionInput = {
  competitor_id: string;
  x: number;
  y: number;
  pressure_index: number;
};

// ── Handler ────────────────────────────────────────────────────────────────────
//
// Records SVG node positions for temporal trail visualization.
// Called by Radar.tsx fire-and-forget after each layout computation.
//
// Server-side dedup: if any position for this org_id exists in the last 6 hours,
// the entire batch is skipped. This limits inserts to ~4 per day per org.
//
// Coordinate space: SVG user units [0, 1000] matching radar viewBox 0 0 1000 1000.

export async function POST(request: Request): Promise<NextResponse> {
  // Auth: get authenticated user's org_id — do not trust client-provided org_id
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Resolve org_id from authenticated user
  const { data: orgRow } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!orgRow?.id) {
    return NextResponse.json({ ok: false, error: "No organization found" }, { status: 400 });
  }

  const org_id: string = orgRow.id;

  // Parse body
  let positions: PositionInput[] | undefined;
  try {
    ({ positions } = await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  if (!Array.isArray(positions) || positions.length === 0) {
    return NextResponse.json({ ok: false, error: "positions[] required" }, { status: 400 });
  }

  // Dedup: skip entire batch if any position for this org was recorded in last 6h
  const since6h = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recent } = await (supabase as any)
    .from("radar_positions")
    .select("id")
    .eq("org_id", org_id)
    .gte("created_at", since6h)
    .limit(1);

  if ((recent ?? []).length > 0) {
    return NextResponse.json({ ok: true, recorded: 0, skipped: "within_6h" });
  }

  // Sanitize and clamp coordinates to valid SVG user-unit range
  const rows = positions
    .filter(
      (p) =>
        typeof p.competitor_id === "string" &&
        p.competitor_id.length > 0 &&
        typeof p.x === "number" &&
        typeof p.y === "number" &&
        Number.isFinite(p.x) &&
        Number.isFinite(p.y),
    )
    .slice(0, 50) // max 50 nodes per batch
    .map((p) => ({
      competitor_id: p.competitor_id,
      org_id,
      x: Math.round(Math.min(1000, Math.max(0, p.x))),
      y: Math.round(Math.min(1000, Math.max(0, p.y))),
      pressure_index: Math.max(0, Number(p.pressure_index) || 0),
    }));

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, recorded: 0 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("radar_positions").insert(rows);

  if (error) {
    console.error("[record-positions]", error.message);
    return NextResponse.json({ ok: false, error: "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, recorded: rows.length });
}
