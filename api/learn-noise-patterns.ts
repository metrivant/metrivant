import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { recordEvent, generateRunId, startTimer } from "../lib/pipeline-metrics";

/**
 * learn-noise-patterns (REACTIVATED 2026-03-26)
 *
 * Layered noise learning: learns SEMANTIC noise patterns from user feedback.
 * Runs AFTER autonomous detection (8 filters handle syntactic noise).
 *
 * Creates suppression rules for org-specific patterns where signals pass
 * autonomous filters but are strategically irrelevant ("this signal type
 * doesn't matter for our ICP").
 *
 * Weekly Sun 07:00 UTC.
 */

const MIN_SAMPLES = 5;
const NOISE_THRESHOLD = 0.80; // 80% noise rate required to create rule

interface PatternStats {
  org_id: string;
  section_type: string;
  signal_type: string;
  competitor_id: string | null;
  total: number;
  noise: number;
  noise_rate: number;
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const elapsed = startTimer();
  const runId = generateRunId();
  const checkInId = Sentry.captureCheckIn({
    monitorSlug: "learn-noise-patterns",
    status: "in_progress",
  });

  try {
    // ── Step 1: Query feedback for signals that passed autonomous filters ────
    // Only process signals where is_noise = false (autonomous filters already handled true)
    const { data: feedbackRows } = await supabase
      .from("signal_feedback")
      .select(`
        signal_id,
        verdict,
        signals!inner(
          id,
          signal_type,
          section_diff_id,
          section_diffs!inner(
            id,
            section_type,
            is_noise,
            monitored_page_id,
            monitored_pages!inner(
              competitor_id,
              competitors!inner(
                tracked_competitors!inner(org_id)
              )
            )
          )
        )
      `)
      .eq("signals.section_diffs.is_noise", false) // Only semantic noise candidates
      .gte("updated_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()); // 90d window

    if (!feedbackRows || feedbackRows.length === 0) {
      Sentry.captureCheckIn({
        monitorSlug: "learn-noise-patterns",
        status: "ok",
        checkInId,
      });
      return res.json({
        ok: true,
        patternsAnalyzed: 0,
        rulesCreated: 0,
        rulesUpdated: 0,
        message: "No feedback data available",
      });
    }

    // ── Step 2: Group by pattern dimensions ──────────────────────────────────
    const patternMap = new Map<string, PatternStats>();

    for (const row of feedbackRows) {
      const signal = (row.signals as any);
      const diff = signal?.section_diffs;
      const page = diff?.monitored_pages;
      const competitor = page?.competitors;
      const tracked = competitor?.tracked_competitors;

      if (!tracked || !Array.isArray(tracked) || tracked.length === 0) continue;

      const orgId = tracked[0].org_id;
      const sectionType = diff.section_type;
      const signalType = signal.signal_type;
      const competitorId = page.competitor_id;

      // Three pattern granularities:
      // 1. org + section + signal + competitor (most specific)
      // 2. org + section + signal (competitor-agnostic)
      // 3. org + signal (section-agnostic)

      const patterns = [
        `${orgId}::${sectionType}::${signalType}::${competitorId}`,
        `${orgId}::${sectionType}::${signalType}::*`,
        `${orgId}::*::${signalType}::*`,
      ];

      for (const patternKey of patterns) {
        if (!patternMap.has(patternKey)) {
          const [o, s, sig, c] = patternKey.split("::");
          patternMap.set(patternKey, {
            org_id: o,
            section_type: s === "*" ? null : s,
            signal_type: sig,
            competitor_id: c === "*" ? null : c,
            total: 0,
            noise: 0,
            noise_rate: 0,
          });
        }

        const stats = patternMap.get(patternKey)!;
        stats.total++;
        if (row.verdict === "noise") stats.noise++;
      }
    }

    // Calculate noise rates
    for (const stats of patternMap.values()) {
      stats.noise_rate = stats.total > 0 ? stats.noise / stats.total : 0;
    }

    // ── Step 3: Create/update suppression rules ──────────────────────────────
    let rulesCreated = 0;
    let rulesUpdated = 0;

    for (const stats of patternMap.values()) {
      // Only create rules when we have sufficient samples + high noise rate
      if (stats.total < MIN_SAMPLES || stats.noise_rate < NOISE_THRESHOLD) continue;

      // Check if rule exists
      const { data: existing } = await supabase
        .from("noise_suppression_rules")
        .select("id, is_active, samples")
        .eq("org_id", stats.org_id)
        .eq("signal_type", stats.signal_type)
        .eq("section_type", stats.section_type || "")
        .eq("competitor_id", stats.competitor_id || "")
        .maybeSingle();

      if (existing) {
        // Update existing rule
        await supabase
          .from("noise_suppression_rules")
          .update({
            noise_rate: stats.noise_rate,
            samples: stats.total,
            is_active: stats.noise_rate >= NOISE_THRESHOLD, // Deactivate if rate drops
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        rulesUpdated++;
      } else {
        // Create new rule
        await supabase.from("noise_suppression_rules").insert({
          org_id: stats.org_id,
          section_type: stats.section_type,
          signal_type: stats.signal_type,
          competitor_id: stats.competitor_id,
          noise_rate: stats.noise_rate,
          samples: stats.total,
          rule_type: "semantic", // Distinguishes from autonomous filter rules
          is_active: true,
        });
        rulesCreated++;
      }
    }

    void recordEvent({
      run_id: runId,
      stage: "noise_pattern_learn",
      status: "success",
      duration_ms: elapsed(),
      metadata: {
        patterns_analyzed: patternMap.size,
        rules_created: rulesCreated,
        rules_updated: rulesUpdated,
      },
    });

    if (rulesCreated > 0) {
      Sentry.captureMessage("semantic_noise_rules_created", {
        level: "info",
        extra: { count: rulesCreated },
      });
    }

    Sentry.captureCheckIn({
      monitorSlug: "learn-noise-patterns",
      status: "ok",
      checkInId,
    });
    await Sentry.flush(2000);

    return res.json({
      ok: true,
      patternsAnalyzed: patternMap.size,
      rulesCreated,
      rulesUpdated,
      runtimeDurationMs: elapsed(),
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({
      monitorSlug: "learn-noise-patterns",
      status: "error",
      checkInId,
    });
    void recordEvent({
      run_id: runId,
      stage: "noise_pattern_learn",
      status: "failure",
      duration_ms: elapsed(),
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("learn-noise-patterns", handler);
