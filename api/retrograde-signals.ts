/**
 * Retrograde Signals
 *
 * Hourly cron (:37) — downgrade signals with hallucinated interpretations.
 *
 * Phase 3: Interpretation validation correlation — autonomous feedback loop.
 * When validate-interpretations detects a hallucinated interpretation, this
 * handler retroactively reduces the underlying signal's confidence and status.
 *
 * Prevents re-interpretation of downgraded signals.
 */

import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { recordEvent, generateRunId } from "../lib/pipeline-metrics";

const CONFIDENCE_INTERPRET = 0.65; // Must match detect-signals.ts
const RETROGRADE_PENALTY = 0.20;   // Confidence reduction for hallucinated interp

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const runId = generateRunId();
  const startTime = Date.now();

  try {
    // ── Step 1: Find hallucinated interpretations (not yet processed) ─────────
    const { data: hallucinated } = await supabase
      .from("interpretations")
      .select("id, signal_id, signals!inner(id, confidence_score, status, retrograded_at)")
      .eq("validation_status", "hallucinated")
      .is("signals.retrograded_at", null); // Only process signals not yet retrograded

    if (!hallucinated || hallucinated.length === 0) {
      void recordEvent({
        run_id: runId,
        stage: "retrograde",
        status: "success",
        duration_ms: Date.now() - startTime,
        metadata: { retrograded_count: 0 },
      });
      return res.json({ ok: true, retrograded: 0 });
    }

    let retrograded = 0;
    let downgraded = 0; // Count of signals downgraded to pending_review

    // ── Step 2: Retrograde each signal ────────────────────────────────────────
    for (const interp of hallucinated) {
      const signal = (interp.signals as unknown as {
        id: string;
        confidence_score: number;
        status: string;
        retrograded_at: string | null;
      });

      if (!signal || signal.retrograded_at) continue; // Already processed

      const originalConfidence = signal.confidence_score;
      const newConfidence = Math.max(0.0, originalConfidence - RETROGRADE_PENALTY);
      const newStatus =
        newConfidence < CONFIDENCE_INTERPRET && signal.status === "pending"
          ? "pending_review"
          : signal.status;

      await supabase
        .from("signals")
        .update({
          confidence_score: newConfidence,
          status: newStatus,
          retrograded_at: new Date().toISOString(),
        })
        .eq("id", signal.id);

      retrograded++;
      if (newStatus === "pending_review" && signal.status === "pending") {
        downgraded++;
      }
    }

    // ── Step 3: Log metrics ───────────────────────────────────────────────────
    void recordEvent({
      run_id: runId,
      stage: "retrograde",
      status: "success",
      duration_ms: Date.now() - startTime,
      metadata: {
        retrograded_count: retrograded,
        downgraded_count: downgraded,
        avg_penalty: RETROGRADE_PENALTY,
      },
    });

    // Alert if many signals are being retrograded (possible systematic issue)
    if (retrograded >= 5) {
      Sentry.captureMessage("High retrograde rate detected", {
        level: "warning",
        extra: {
          retrograded_count: retrograded,
          downgraded_count: downgraded,
          threshold: 5,
        },
      });
    }

    return res.json({
      ok: true,
      retrograded,
      downgraded,
    });
  } catch (error) {
    void recordEvent({
      run_id: runId,
      stage: "retrograde",
      status: "failure",
      duration_ms: Date.now() - startTime,
      metadata: { error: String(error) },
    });
    Sentry.captureException(error);
    console.error("retrograde-signals error:", error);
    return res.status(500).json({ error: "Internal error" });
  }
}

export default withSentry("retrograde-signals", handler);
