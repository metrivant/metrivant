/**
 * Calculate Sector Baselines
 *
 * Cron: Weekly (Sunday 04:00 UTC)
 * Calculates median, p75, p90 metrics per sector across all orgs.
 * Enables "above/below sector avg" benchmarking in UI.
 *
 * Metrics:
 *   - signals_per_week: avg signal generation rate (last 30d)
 *   - pressure_index: avg competitor pressure
 *   - hiring_velocity: avg roles posted per week (from careers pool events)
 *   - movement_frequency: avg movements per month (last 30d)
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "../../../lib/supabase/server-service";

export const runtime = "nodejs";
export const maxDuration = 60;

// Auth check
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expectedAuth = `Bearer ${process.env.CRON_SECRET?.trim()}`;

  if (!process.env.CRON_SECRET || authHeader !== expectedAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // Fetch all orgs with their sectors
    const { data: orgs, error: orgsError } = await supabase
      .from("organizations")
      .select("id, sector");

    if (orgsError) throw orgsError;
    if (!orgs || orgs.length === 0) {
      return NextResponse.json({ ok: true, message: "No orgs to analyze" });
    }

    // Group orgs by sector
    const orgsBySector = new Map<string, string[]>();
    orgs.forEach((org) => {
      const sector = org.sector ?? "saas";
      if (!orgsBySector.has(sector)) {
        orgsBySector.set(sector, []);
      }
      orgsBySector.get(sector)!.push(org.id);
    });

    const calculatedAt = new Date().toISOString();
    const insertRows: Array<{
      sector: string;
      metric_type: string;
      median_value: number;
      p75_value: number;
      p90_value: number;
      sample_size: number;
      calculated_at: string;
    }> = [];

    // Calculate baselines per sector
    for (const [sector, orgIds] of orgsBySector.entries()) {
      // Metric 1: signals_per_week
      const { data: signalData } = await supabase
        .from("signals")
        .select("competitor_id")
        .gte("detected_at", thirtyDaysAgo)
        .eq("status", "interpreted");

      const { data: trackedComps } = await supabase
        .from("tracked_competitors")
        .select("org_id, competitor_id")
        .in("org_id", orgIds);

      const signalsPerOrg = new Map<string, number>();
      (trackedComps ?? []).forEach((tc) => {
        if (!signalsPerOrg.has(tc.org_id)) {
          signalsPerOrg.set(tc.org_id, 0);
        }
      });

      (signalData ?? []).forEach((s) => {
        const tc = (trackedComps ?? []).find((t) => t.competitor_id === s.competitor_id);
        if (tc) {
          signalsPerOrg.set(tc.org_id, (signalsPerOrg.get(tc.org_id) ?? 0) + 1);
        }
      });

      const signalsPerWeek = Array.from(signalsPerOrg.values()).map((count) => count / 4.3); // 30d ≈ 4.3 weeks
      if (signalsPerWeek.length > 0) {
        insertRows.push({
          sector,
          metric_type: "signals_per_week",
          ...calculatePercentiles(signalsPerWeek),
          sample_size: signalsPerWeek.length,
          calculated_at: calculatedAt,
        });
      }

      // Metric 2: pressure_index
      const { data: competitors } = await supabase
        .from("competitors")
        .select("id, pressure_index")
        .in("id", (trackedComps ?? []).map((tc) => tc.competitor_id));

      const pressureByOrg = new Map<string, number[]>();
      (trackedComps ?? []).forEach((tc) => {
        if (!pressureByOrg.has(tc.org_id)) {
          pressureByOrg.set(tc.org_id, []);
        }
        const comp = (competitors ?? []).find((c) => c.id === tc.competitor_id);
        if (comp && comp.pressure_index != null) {
          pressureByOrg.get(tc.org_id)!.push(comp.pressure_index);
        }
      });

      const avgPressurePerOrg = Array.from(pressureByOrg.values())
        .map((pressures) => pressures.reduce((sum, p) => sum + p, 0) / pressures.length)
        .filter((avg) => !isNaN(avg));

      if (avgPressurePerOrg.length > 0) {
        insertRows.push({
          sector,
          metric_type: "pressure_index",
          ...calculatePercentiles(avgPressurePerOrg),
          sample_size: avgPressurePerOrg.length,
          calculated_at: calculatedAt,
        });
      }

      // Metric 3: movement_frequency (movements per month)
      const { data: movements } = await supabase
        .from("strategic_movements")
        .select("competitor_id")
        .gte("last_seen_at", thirtyDaysAgo);

      const movementsPerOrg = new Map<string, number>();
      (trackedComps ?? []).forEach((tc) => {
        if (!movementsPerOrg.has(tc.org_id)) {
          movementsPerOrg.set(tc.org_id, 0);
        }
      });

      (movements ?? []).forEach((m) => {
        const tc = (trackedComps ?? []).find((t) => t.competitor_id === m.competitor_id);
        if (tc) {
          movementsPerOrg.set(tc.org_id, (movementsPerOrg.get(tc.org_id) ?? 0) + 1);
        }
      });

      const movementsPerMonth = Array.from(movementsPerOrg.values());
      if (movementsPerMonth.length > 0) {
        insertRows.push({
          sector,
          metric_type: "movement_frequency",
          ...calculatePercentiles(movementsPerMonth),
          sample_size: movementsPerMonth.length,
          calculated_at: calculatedAt,
        });
      }

      // Metric 4: hiring_velocity (roles per week from careers pool)
      const { data: poolEvents } = await supabase
        .from("pool_events")
        .select("competitor_id, event_type")
        .eq("pool_type", "careers")
        .eq("event_type", "job_posting")
        .gte("event_date", thirtyDaysAgo);

      const hiringPerOrg = new Map<string, number>();
      (trackedComps ?? []).forEach((tc) => {
        if (!hiringPerOrg.has(tc.org_id)) {
          hiringPerOrg.set(tc.org_id, 0);
        }
      });

      (poolEvents ?? []).forEach((e) => {
        const tc = (trackedComps ?? []).find((t) => t.competitor_id === e.competitor_id);
        if (tc) {
          hiringPerOrg.set(tc.org_id, (hiringPerOrg.get(tc.org_id) ?? 0) + 1);
        }
      });

      const hiringVelocity = Array.from(hiringPerOrg.values()).map((count) => count / 4.3); // roles per week
      if (hiringVelocity.length > 0) {
        insertRows.push({
          sector,
          metric_type: "hiring_velocity",
          ...calculatePercentiles(hiringVelocity),
          sample_size: hiringVelocity.length,
          calculated_at: calculatedAt,
        });
      }
    }

    // Insert baselines
    if (insertRows.length > 0) {
      const { error: insertError } = await supabase
        .from("sector_baselines")
        .insert(insertRows);

      if (insertError) throw insertError;
    }

    return NextResponse.json({
      ok: true,
      sectors: orgsBySector.size,
      baselines: insertRows.length,
      calculatedAt,
    });
  } catch (error) {
    console.error("calculate-sector-baselines error:", error);
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}

// Helper: Calculate median, p75, p90
function calculatePercentiles(values: number[]): {
  median_value: number;
  p75_value: number;
  p90_value: number;
} {
  if (values.length === 0) {
    return { median_value: 0, p75_value: 0, p90_value: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const median = percentile(sorted, 0.5);
  const p75 = percentile(sorted, 0.75);
  const p90 = percentile(sorted, 0.9);

  return {
    median_value: Math.round(median * 100) / 100,
    p75_value: Math.round(p75 * 100) / 100,
    p90_value: Math.round(p90 * 100) / 100,
  };
}

function percentile(sorted: number[], p: number): number {
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) {
    return sorted[lower];
  }

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}
