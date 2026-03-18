// ── /api/gravity-data ──────────────────────────────────────────────────────────
// GET — returns GravityNode[] for the authenticated user's org.
//
// Data assembly:
//  1. Resolve org_id from the authenticated user's session
//  2. Fetch radar-feed (runtime) for base competitor list
//  3. Enrich via Supabase: avg_confidence + avg_urgency (signals 7d)
//                          movement_count (strategic_movements 30d)
//  4. Compute mass + positions via positionNodes()
//  5. Return GravityNode[] sorted descending by mass_score_raw

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createServiceClient } from "../../../lib/supabase/service";
import { getRadarFeed } from "../../../lib/api";
import { positionNodes } from "../../../components/gravity-map/gravityMath";
import type { GravityNode } from "../../../components/gravity-map/gravityMath";
import { captureException } from "../../../lib/sentry";

export type { GravityNode };

// Selection cap: show top 8 active + pad to 5 with zero-mass if needed
const MAX_ACTIVE_NODES = 8;
const MIN_TOTAL_NODES  = 5;

type SignalRow   = { competitor_id: string; confidence_score: number | null; urgency: number | null };
type MovementRow = { competitor_id: string };

export async function GET(): Promise<NextResponse> {
  const startedAt = Date.now();

  try {
    // ── 1. Resolve org from authenticated session ──────────────────────────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    let orgId: string | undefined;
    try {
      const { data: orgRows } = await supabase
        .from("organizations")
        .select("id")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);
      orgId = (orgRows?.[0]?.id as string | undefined) ?? undefined;
    } catch {
      // Non-fatal — proceed without org scoping
    }

    // ── 2. Fetch radar-feed ────────────────────────────────────────────────
    const radarData = await getRadarFeed(50, orgId);

    if (radarData.length === 0) {
      return NextResponse.json({ ok: true, data: [], runtimeMs: Date.now() - startedAt });
    }

    const competitorIds  = radarData.map((c) => c.competitor_id);
    const sevenDaysAgo   = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const service        = createServiceClient();

    // ── 3. Enrich — parallel Supabase queries ─────────────────────────────
    let signalRows:   SignalRow[]   = [];
    let movementRows: MovementRow[] = [];

    try {
      const [sigResult, movResult] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any)
          .from("signals")
          .select("competitor_id, confidence_score, urgency")
          .in("competitor_id", competitorIds)
          .gte("detected_at", sevenDaysAgo)
          .limit(500),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any)
          .from("strategic_movements")
          .select("competitor_id")
          .in("competitor_id", competitorIds)
          .gte("first_seen_at", thirtyDaysAgo)
          .limit(200),
      ]);
      signalRows   = (sigResult.data  ?? []) as SignalRow[];
      movementRows = (movResult.data  ?? []) as MovementRow[];
    } catch (enrichErr) {
      captureException(enrichErr, { route: "gravity-data", step: "enrich" });
      // Fall through — mass formula degrades gracefully to radar-feed fields only
    }

    // ── 4. Aggregate enrichment per competitor ─────────────────────────────
    type SignalAgg = { confSum: number; confCount: number; urgSum: number; urgCount: number };
    const signalAgg = new Map<string, SignalAgg>();

    for (const row of signalRows) {
      if (!signalAgg.has(row.competitor_id)) {
        signalAgg.set(row.competitor_id, { confSum: 0, confCount: 0, urgSum: 0, urgCount: 0 });
      }
      const agg = signalAgg.get(row.competitor_id)!;
      if (row.confidence_score != null) { agg.confSum += row.confidence_score; agg.confCount++; }
      if (row.urgency != null)          { agg.urgSum  += row.urgency;          agg.urgCount++;  }
    }

    const movementCountMap = new Map<string, number>();
    for (const row of movementRows) {
      movementCountMap.set(row.competitor_id, (movementCountMap.get(row.competitor_id) ?? 0) + 1);
    }

    // ── 5. Build GravityNode inputs ────────────────────────────────────────
    type NodeInput = Omit<GravityNode,
      "mass_score_raw" | "mass_score_visual" | "rank" | "relative_mass_pct" | "gridX" | "gridZ">;

    const nodeInputs: NodeInput[] = radarData.map((c) => {
      const agg            = signalAgg.get(c.competitor_id);
      const avg_confidence = agg && agg.confCount > 0 ? agg.confSum / agg.confCount : 0;
      const avg_urgency    = agg && agg.urgCount  > 0 ? agg.urgSum  / agg.urgCount  : null;

      return {
        competitor_id:              c.competitor_id,
        name:                       c.competitor_name,
        website_url:                c.website_url,
        signal_count_7d:            c.signals_7d,
        avg_confidence,
        movement_count:             movementCountMap.get(c.competitor_id) ?? 0,
        pressure_index:             c.pressure_index,
        avg_urgency,
        top_interpretation_summary: c.latest_interpretation_summary
                                 ?? c.latest_movement_summary
                                 ?? null,
      };
    });

    // ── 6. Cap active nodes; pad with zero-mass if count < MIN_TOTAL ──────
    const active  = nodeInputs.filter((n) => n.signal_count_7d > 0 || n.pressure_index > 0 || n.movement_count > 0);
    const passive = nodeInputs.filter((n) => n.signal_count_7d === 0 && n.pressure_index === 0 && n.movement_count === 0);

    const selectedActive  = active.slice(0, MAX_ACTIVE_NODES);
    const passiveNeeded   = Math.max(0, MIN_TOTAL_NODES - selectedActive.length);
    const selectedPassive = passive.slice(0, passiveNeeded);

    // ── 7. Position nodes ──────────────────────────────────────────────────
    const positioned = positionNodes([...selectedActive, ...selectedPassive]);

    return NextResponse.json({
      ok:        true,
      data:      positioned,
      runtimeMs: Date.now() - startedAt,
    });

  } catch (err) {
    captureException(err, { route: "gravity-data" });
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
