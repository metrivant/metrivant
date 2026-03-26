/**
 * Update Noise Baselines
 *
 * Daily cron (04:30 UTC) — calculates 30-day rolling noise rates per competitor
 * for confidence calibration in detect-signals.
 *
 * No user feedback involved — purely statistical from autonomous noise detection.
 */

import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import type { NoiseReason } from "../lib/noise-detection";

interface BaselineUpdate {
  competitor_id: string;
  total_diffs: number;
  noise_diffs: number;
  noise_rate: number;
  reason_breakdown: Record<NoiseReason, number>;
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // ── Step 1: Get all active competitors ────────────────────────────────────
    const { data: competitors } = await supabase
      .from("competitors")
      .select("id")
      .eq("active", true);

    if (!competitors || competitors.length === 0) {
      return res.json({ ok: true, updated: 0, message: "No active competitors" });
    }

    const updates: BaselineUpdate[] = [];

    // ── Step 2: Calculate noise stats per competitor ──────────────────────────
    for (const competitor of competitors) {
      // Get all diffs for this competitor's pages in last 30 days
      const { data: pages } = await supabase
        .from("monitored_pages")
        .select("id")
        .eq("competitor_id", competitor.id);

      if (!pages || pages.length === 0) continue;

      const pageIds = pages.map((p) => p.id);

      const { data: diffs } = await supabase
        .from("section_diffs")
        .select("id, is_noise, noise_reason")
        .in("monitored_page_id", pageIds)
        .gte("created_at", thirtyDaysAgo);

      if (!diffs || diffs.length === 0) {
        // No recent diffs — set to zero baseline
        updates.push({
          competitor_id: competitor.id,
          total_diffs: 0,
          noise_diffs: 0,
          noise_rate: 0.0,
          reason_breakdown: {} as Record<NoiseReason, number>,
        });
        continue;
      }

      const total = diffs.length;
      const noiseDiffs = diffs.filter((d) => d.is_noise === true);
      const noiseCount = noiseDiffs.length;
      const rate = total > 0 ? noiseCount / total : 0.0;

      // Build breakdown by reason
      const breakdown: Record<string, number> = {};
      for (const diff of noiseDiffs) {
        if (diff.noise_reason) {
          breakdown[diff.noise_reason] = (breakdown[diff.noise_reason] || 0) + 1;
        }
      }

      updates.push({
        competitor_id: competitor.id,
        total_diffs: total,
        noise_diffs: noiseCount,
        noise_rate: parseFloat(rate.toFixed(4)),
        reason_breakdown: breakdown as Record<NoiseReason, number>,
      });
    }

    // ── Step 3: Upsert baselines ──────────────────────────────────────────────
    for (const update of updates) {
      await supabase.from("competitor_noise_baselines").upsert(
        {
          competitor_id: update.competitor_id,
          total_diffs: update.total_diffs,
          noise_diffs: update.noise_diffs,
          noise_rate: update.noise_rate,
          reason_breakdown: update.reason_breakdown,
          last_updated_at: new Date().toISOString(),
        },
        { onConflict: "competitor_id" }
      );
    }

    // ── Step 4: Log anomalies ──────────────────────────────────────────────────
    const highNoiseCompetitors = updates.filter(
      (u) => u.noise_rate > 0.50 && u.total_diffs >= 10
    );

    if (highNoiseCompetitors.length > 0) {
      Sentry.captureMessage("High noise rate detected for competitors", {
        level: "warning",
        extra: {
          competitors: highNoiseCompetitors.map((u) => ({
            competitor_id: u.competitor_id,
            noise_rate: u.noise_rate,
            total_diffs: u.total_diffs,
            top_reasons: Object.entries(u.reason_breakdown)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 3)
              .map(([reason, count]) => `${reason}:${count}`),
          })),
        },
      });
    }

    return res.json({
      ok: true,
      updated: updates.length,
      highNoiseCount: highNoiseCompetitors.length,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error("update-noise-baselines error:", error);
    return res.status(500).json({ error: "Internal error" });
  }
}

export default withSentry("update-noise-baselines", handler);
