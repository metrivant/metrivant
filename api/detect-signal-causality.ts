/**
 * Signal Causality Detection Handler
 *
 * Hourly cron: detects cause→effect relationships between signals to build
 * strategic narrative chains.
 *
 * Process:
 * 1. Load competitors with ≥2 signals in last 14 days
 * 2. For each competitor, compute causal relationships via template matching
 * 3. Upsert relationships to signal_relationships table
 * 4. Return summary of detected relationships
 *
 * Cron: :47 hourly (after validate-movements at :42, before narrative gen at :45)
 */

import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { recordEvent, startTimer } from "../lib/pipeline-metrics";
import { computeCausalityForCompetitor } from "../lib/compute-causality";

type CompetitorForCausality = {
  id: string;
  name: string;
  signal_count: number;
};

async function handler(req: ApiReq, res: ApiRes) {
  const getDuration = startTimer();

  if (!verifyCronSecret(req, res)) {
    return;
  }

  try {
    // Step 1: Load competitors with ≥2 signals in last 14 days
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: competitors } = await (supabase as any)
      .from("competitors")
      .select(
        `
        id,
        name,
        signals!inner(id)
      `
      )
      .gte("signals.detected_at", since)
      .in("signals.status", ["pending", "interpreted"]);

    if (!competitors || competitors.length === 0) {
      await recordEvent({
        stage: "detect-signal-causality",
        status: "success",
        duration_ms: getDuration(),
        metadata: { message: "no_active_competitors" },
      });

      return res.status(200).json({
        ok: true,
        job: "detect-signal-causality",
        competitorsProcessed: 0,
        relationshipsDetected: 0,
        durationMs: getDuration(),
      });
    }

    // Count signals per competitor
    const competitorMap = new Map<string, CompetitorForCausality>();
    for (const comp of competitors) {
      const existing = competitorMap.get(comp.id);
      if (existing) {
        existing.signal_count += 1;
      } else {
        competitorMap.set(comp.id, {
          id: comp.id,
          name: comp.name,
          signal_count: 1,
        });
      }
    }

    // Filter to competitors with ≥2 signals
    const eligibleCompetitors = Array.from(competitorMap.values()).filter(
      (c) => c.signal_count >= 2
    );

    if (eligibleCompetitors.length === 0) {
      await recordEvent({
        stage: "detect-signal-causality",
        status: "success",
        duration_ms: getDuration(),
        metadata: { message: "no_eligible_competitors", reason: "all_have_single_signal" },
      });

      return res.status(200).json({
        ok: true,
        job: "detect-signal-causality",
        competitorsProcessed: 0,
        relationshipsDetected: 0,
        durationMs: getDuration(),
      });
    }

    // Step 2: Compute causality for each eligible competitor
    let totalRelationships = 0;
    const relationshipsToUpsert: Array<{
      signal_id: string;
      related_signal_id: string;
      relationship_type: string;
      confidence_score: number;
      detection_method: string;
      metadata: Record<string, unknown>;
    }> = [];

    for (const competitor of eligibleCompetitors) {
      const relationships = await computeCausalityForCompetitor(supabase, competitor.id, 14);

      for (const rel of relationships) {
        relationshipsToUpsert.push({
          signal_id: rel.signal_id,
          related_signal_id: rel.related_signal_id,
          relationship_type: rel.relationship_type,
          confidence_score: rel.confidence_score,
          detection_method: rel.detection_method,
          metadata: rel.metadata,
        });
      }

      totalRelationships += relationships.length;
    }

    // Step 3: Upsert relationships to signal_relationships table
    if (relationshipsToUpsert.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: upsertError } = await (supabase as any)
        .from("signal_relationships")
        .upsert(relationshipsToUpsert, {
          onConflict: "signal_id,related_signal_id,relationship_type",
          ignoreDuplicates: false,
        });

      if (upsertError) {
        throw new Error(`Failed to upsert relationships: ${upsertError.message}`);
      }
    }

    // Log success
    await recordEvent({
      stage: "detect-signal-causality",
      status: "success",
      duration_ms: getDuration(),
      metadata: {
        relationships_detected: totalRelationships,
        competitors_processed: eligibleCompetitors.length,
      },
    });

    return res.status(200).json({
      ok: true,
      job: "detect-signal-causality",
      competitorsProcessed: eligibleCompetitors.length,
      relationshipsDetected: totalRelationships,
      durationMs: getDuration(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "unknown_error";

    await recordEvent({
      stage: "detect-signal-causality",
      status: "failure",
      duration_ms: getDuration(),
      metadata: { error: errorMessage },
    });

    return res.status(500).json({
      ok: false,
      job: "detect-signal-causality",
      error: errorMessage,
      durationMs: getDuration(),
    });
  }
}

export default withSentry("detect-signal-causality", handler);
