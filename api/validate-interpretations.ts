import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { recordEvent, startTimer, generateRunId } from "../lib/pipeline-metrics";
import { validateInterpretation } from "../lib/interpretation-validator";

// ── /api/validate-interpretations ─────────────────────────────────────────────
// Hourly cron: validates recent interpretations against their evidence.
//
// Processes interpretations where validation_status IS NULL (not yet checked).
// Each interpretation is sent to GPT-4o-mini for evidence-grounding check.
//
// Results:
//   valid        → no action (interpretation is good)
//   weak         → no confidence change (plausible but overstated)
//   hallucinated → reduce parent signal confidence by HALLUCINATION_PENALTY
//
// This creates a double-gated quality system:
//   Input gate:  noise pattern suppression (detect-signals)
//   Output gate: hallucination detection (validate-interpretations)

const BATCH_SIZE = 15;  // interpretations per run (each = 1 GPT call)
const HALLUCINATION_PENALTY = 0.15;
const MIN_CONFIDENCE_AFTER_PENALTY = 0.20;

interface InterpRow {
  id:                    string;
  signal_id:             string;
  summary:               string | null;
  strategic_implication:  string | null;
  recommended_action:    string | null;
  old_content:           string | null;
  new_content:           string | null;
  confidence:            number | null;
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const elapsed = startTimer();
  const runId = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();
  const checkInId = Sentry.captureCheckIn({ monitorSlug: "validate-interpretations", status: "in_progress" });

  try {
    // ── Load unvalidated interpretations ───────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: interpRows, error: interpErr } = await (supabase as any)
      .from("interpretations")
      .select("id, signal_id, summary, strategic_implication, recommended_action, old_content, new_content, confidence")
      .is("validation_status", null)
      .order("created_at", { ascending: false })
      .limit(BATCH_SIZE);

    if (interpErr) throw interpErr;

    const interps = (interpRows ?? []) as InterpRow[];

    if (interps.length === 0) {
      Sentry.captureCheckIn({ monitorSlug: "validate-interpretations", status: "ok", checkInId });
      await Sentry.flush(2000);
      return res.status(200).json({ ok: true, job: "validate-interpretations", processed: 0 });
    }

    // ── Validate each interpretation ──────────────────────────────────────
    let validCount = 0;
    let weakCount = 0;
    let hallucinatedCount = 0;

    for (const interp of interps) {
      const timer = startTimer();

      const result = await validateInterpretation({
        old_content: interp.old_content,
        new_content: interp.new_content,
        summary: interp.summary,
        strategic_implication: interp.strategic_implication,
        recommended_action: interp.recommended_action,
      });

      // Update interpretation with validation result
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("interpretations")
        .update({
          validation_status: result.status,
          validation_reason: result.reason,
          validated_at: new Date().toISOString(),
        })
        .eq("id", interp.id);

      if (result.status === "valid") {
        validCount++;
      } else if (result.status === "weak") {
        weakCount++;
      } else if (result.status === "hallucinated") {
        hallucinatedCount++;

        // Reduce parent signal's confidence
        const { data: sigRows } = await supabase
          .from("signals")
          .select("confidence_score")
          .eq("id", interp.signal_id)
          .limit(1);

        const currentConf = ((sigRows ?? []) as { confidence_score: number }[])[0]?.confidence_score;
        if (currentConf != null) {
          const newConf = Math.max(MIN_CONFIDENCE_AFTER_PENALTY, currentConf - HALLUCINATION_PENALTY);
          await supabase
            .from("signals")
            .update({ confidence_score: newConf })
            .eq("id", interp.signal_id);
        }

        Sentry.captureMessage("interpretation_hallucinated", {
          level: "warning",
          extra: {
            interpretation_id: interp.id,
            signal_id: interp.signal_id,
            reason: result.reason,
            original_confidence: currentConf,
          },
        });
      }

      void recordEvent({
        run_id: runId,
        stage: "interpretation_validation",
        status: "success",
        duration_ms: timer(),
        metadata: {
          interpretation_id: interp.id,
          validation_status: result.status,
          reason: result.reason,
        },
      });
    }

    void recordEvent({
      run_id: runId,
      stage: "interpretation_validation",
      status: "success",
      duration_ms: elapsed(),
      metadata: {
        processed: interps.length,
        valid: validCount,
        weak: weakCount,
        hallucinated: hallucinatedCount,
      },
    });

    Sentry.captureCheckIn({ monitorSlug: "validate-interpretations", status: "ok", checkInId });
    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "validate-interpretations",
      processed: interps.length,
      valid: validCount,
      weak: weakCount,
      hallucinated: hallucinatedCount,
      runtimeDurationMs: elapsed(),
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "validate-interpretations", status: "error", checkInId });
    void recordEvent({ run_id: runId, stage: "interpretation_validation", status: "failure", duration_ms: elapsed(), metadata: { error: error instanceof Error ? error.message : String(error) } });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("validate-interpretations", handler);
