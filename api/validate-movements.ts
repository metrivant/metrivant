import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { recordEvent, startTimer, generateRunId } from "../lib/pipeline-metrics";
import { openai } from "../lib/openai";
import { validateSector } from "../lib/sector-validation";
import { buildSectorValidationGuidance, type SectorId } from "../lib/sector-prompting";

// ── /api/validate-movements ───────────────────────────────────────────────────
// Hourly cron (:42): validates AI-generated movement summaries against their
// supporting signals. Ensures movement_summary and strategic_implication are
// grounded in actual signal evidence.
//
// Movements without AI-generated narratives (generation_reason='fallback' or
// 'deterministic') are skipped — only AI-generated content needs validation.

const BATCH_SIZE = 10;
const CONFIDENCE_PENALTY = 0.10;

// Wall-clock guard: maxDuration is 60s, leave 5s safety margin for final flush + response.
const WALL_CLOCK_GUARD_MS = 55_000;

const BASE_SYSTEM_PROMPT = `You are a quality assurance analyst reviewing AI-generated strategic movement summaries.

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
  const startedAt = Date.now();

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
      return res.status(200).json({ ok: true, job: "validate-movements", processed: 0, skippedByGuard: 0 });
    }

    // ── Batch-fetch sectors for all competitors ───────────────────────────
    const competitorIds = Array.from(new Set(movements.map(m => m.competitor_id)));
    const sectorMap = new Map<string, SectorId | null>();

    if (competitorIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: orgRows } = await (supabase as any)
        .from("tracked_competitors")
        .select("competitor_id, organizations(sector)")
        .in("competitor_id", competitorIds);

      for (const row of (orgRows ?? []) as Array<{ competitor_id: string; organizations?: { sector: string } | null }>) {
        const rawSector = row.organizations?.sector;
        sectorMap.set(row.competitor_id, validateSector(rawSector));
      }
    }

    let validCount = 0, weakCount = 0, hallucinatedCount = 0, processedCount = 0, skippedByGuard = 0;

    for (const mov of movements) {
      // Wall-clock guard: stop processing if we're approaching the timeout.
      if (Date.now() - startedAt > WALL_CLOCK_GUARD_MS) {
        skippedByGuard = movements.length - processedCount;
        console.log(`wall_clock_guard: skipping ${skippedByGuard} remaining movements`);
        break;
      }

      const timer = startTimer();

      // Get sector for this movement's competitor
      const sector = sectorMap.get(mov.competitor_id) ?? null;

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
        // Build sector-aware system prompt
        const sectorGuidance = buildSectorValidationGuidance(sector);
        const systemPrompt = BASE_SYSTEM_PROMPT + sectorGuidance;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.05,
          max_tokens: 150,
          messages: [
            { role: "system", content: systemPrompt },
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
            extra: {
              movement_id: mov.id,
              movement_type: mov.movement_type,
              competitor_id: mov.competitor_id,
              sector,
              reason,
            },
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

      void recordEvent({
        run_id: runId,
        stage: "movement_validation",
        status: "success",
        duration_ms: timer(),
        metadata: {
          movement_id: mov.id,
          sector,
        },
      });

      processedCount++;
    }

    void recordEvent({
      run_id: runId,
      stage: "movement_validation",
      status: "success",
      duration_ms: elapsed(),
      metadata: { processed: processedCount, valid: validCount, weak: weakCount, hallucinated: hallucinatedCount, skippedByGuard },
    });

    Sentry.captureCheckIn({ monitorSlug: "validate-movements", status: "ok", checkInId });
    await Sentry.flush(2000);

    res.status(200).json({ ok: true, job: "validate-movements", processed: processedCount, valid: validCount, weak: weakCount, hallucinated: hallucinatedCount, skippedByGuard, runtimeDurationMs: elapsed() });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "validate-movements", status: "error", checkInId });
    void recordEvent({ run_id: runId, stage: "movement_validation", status: "failure", duration_ms: elapsed(), metadata: { error: error instanceof Error ? error.message : String(error) } });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("validate-movements", handler);
