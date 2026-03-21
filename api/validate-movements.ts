import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { recordEvent, startTimer, generateRunId } from "../lib/pipeline-metrics";
import { openai } from "../lib/openai";

// ── /api/validate-movements ───────────────────────────────────────────────────
// Hourly cron (:42): validates AI-generated movement summaries against their
// supporting signals. Ensures movement_summary and strategic_implication are
// grounded in actual signal evidence.
//
// Movements without AI-generated narratives (generation_reason='fallback' or
// 'deterministic') are skipped — only AI-generated content needs validation.

const BATCH_SIZE = 10;
const CONFIDENCE_PENALTY = 0.10;

const SYSTEM_PROMPT = `You are a quality assurance analyst reviewing AI-generated strategic movement summaries.

Given a list of supporting signal summaries and an AI-generated movement narrative, determine whether the narrative is grounded in the signals.

Classify as:
- "valid": The movement summary accurately synthesizes the supporting signals.
- "weak": The movement summary is plausible but overstates the pattern or draws speculative conclusions.
- "hallucinated": The movement summary makes claims not supported by the listed signals.

Return ONLY: { "status": "valid"|"weak"|"hallucinated", "reason": "one sentence" }`;

interface MovementRow {
  id:                    string;
  competitor_id:         string;
  movement_type:         string;
  movement_summary:      string | null;
  strategic_implication: string | null;
  confidence_level:      string | null;
  signal_count:          number;
  generation_reason:     string | null;
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const elapsed = startTimer();
  const runId = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();
  const checkInId = Sentry.captureCheckIn({ monitorSlug: "validate-movements", status: "in_progress" });

  try {
    // Load movements with AI-generated summaries that haven't been validated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: movRows, error: movErr } = await (supabase as any)
      .from("strategic_movements")
      .select("id, competitor_id, movement_type, movement_summary, strategic_implication, confidence_level, signal_count, generation_reason")
      .not("movement_summary", "is", null)
      .is("validation_status", null)
      .in("generation_reason", ["ai", null]) // only validate AI-generated
      .order("created_at", { ascending: false })
      .limit(BATCH_SIZE);

    if (movErr) throw movErr;

    const movements = (movRows ?? []) as MovementRow[];

    if (movements.length === 0) {
      Sentry.captureCheckIn({ monitorSlug: "validate-movements", status: "ok", checkInId });
      await Sentry.flush(2000);
      return res.status(200).json({ ok: true, job: "validate-movements", processed: 0 });
    }

    let validCount = 0, weakCount = 0, hallucinatedCount = 0;

    for (const mov of movements) {
      const timer = startTimer();

      // Load supporting interpretations for this movement's competitor
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: interpRows } = await (supabase as any)
        .from("interpretations")
        .select("summary, change_type")
        .eq("signal_id", mov.competitor_id) // interpretations reference signals, load via competitor's recent signals
        .order("created_at", { ascending: false })
        .limit(10);

      // Fallback: load signal_data excerpts directly
      const { data: sigRows } = await supabase
        .from("signals")
        .select("signal_type, signal_data")
        .eq("competitor_id", mov.competitor_id)
        .gte("detected_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order("detected_at", { ascending: false })
        .limit(10);

      const interpretations = (interpRows ?? []) as { summary: string | null; change_type: string }[];
      const signals = (sigRows ?? []) as { signal_type: string; signal_data: { current_excerpt?: string } | null }[];

      // Build signal list from interpretations first, then signal excerpts
      const lines: string[] = [];
      for (const interp of interpretations) {
        if (interp.summary) lines.push(`[${interp.change_type}] ${interp.summary}`);
      }
      if (lines.length === 0) {
        for (const sig of signals) {
          const excerpt = sig.signal_data?.current_excerpt;
          if (excerpt) lines.push(`[${sig.signal_type}] ${excerpt.slice(0, 200)}`);
        }
      }
      const signalList = lines.map((l, i) => `${i + 1}. ${l}`).join("\n");

      if (!signalList) {
        // No signal summaries to validate against — mark as weak
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("strategic_movements")
          .update({ validation_status: "weak", validation_reason: "No signal summaries available for validation" })
          .eq("id", mov.id);
        weakCount++;
        continue;
      }

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.05,
          max_tokens: 150,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `SUPPORTING SIGNALS:\n${signalList}\n\nMOVEMENT NARRATIVE:\nType: ${mov.movement_type}\nSummary: ${mov.movement_summary}\nImplication: ${mov.strategic_implication ?? "(none)"}\n\nClassify this movement narrative.`,
            },
          ],
        });

        const content = response.choices[0]?.message?.content?.trim() ?? "{}";
        const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned) as { status?: string; reason?: string };

        const status = parsed.status as "valid" | "weak" | "hallucinated";
        const reason = parsed.reason ?? "";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("strategic_movements")
          .update({ validation_status: status, validation_reason: reason })
          .eq("id", mov.id);

        if (status === "valid") validCount++;
        else if (status === "weak") weakCount++;
        else if (status === "hallucinated") {
          hallucinatedCount++;

          // Downgrade confidence_level
          if (mov.confidence_level === "high") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from("strategic_movements")
              .update({ confidence_level: "medium", confidence_reason: `Downgraded: ${reason}` })
              .eq("id", mov.id);
          }

          Sentry.captureMessage("movement_hallucinated", {
            level: "warning",
            extra: { movement_id: mov.id, movement_type: mov.movement_type, reason },
          });
        }
      } catch {
        // GPT call failed — mark as weak
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("strategic_movements")
          .update({ validation_status: "weak", validation_reason: "Validation API call failed" })
          .eq("id", mov.id);
        weakCount++;
      }

      void recordEvent({ run_id: runId, stage: "movement_validation", status: "success", duration_ms: timer(), metadata: { movement_id: mov.id } });
    }

    void recordEvent({
      run_id: runId,
      stage: "movement_validation",
      status: "success",
      duration_ms: elapsed(),
      metadata: { processed: movements.length, valid: validCount, weak: weakCount, hallucinated: hallucinatedCount },
    });

    Sentry.captureCheckIn({ monitorSlug: "validate-movements", status: "ok", checkInId });
    await Sentry.flush(2000);

    res.status(200).json({ ok: true, job: "validate-movements", processed: movements.length, valid: validCount, weak: weakCount, hallucinated: hallucinatedCount, runtimeDurationMs: elapsed() });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "validate-movements", status: "error", checkInId });
    void recordEvent({ run_id: runId, stage: "movement_validation", status: "failure", duration_ms: elapsed(), metadata: { error: error instanceof Error ? error.message : String(error) } });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("validate-movements", handler);
