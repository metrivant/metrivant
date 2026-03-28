import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { recordEvent, startTimer, generateRunId } from "../lib/pipeline-metrics";
import { validateBrief } from "../lib/brief-validation";

// ── /api/validate-briefs ───────────────────────────────────────────────────────
// Weekly cron (Mon 10:15 UTC): validates AI-generated weekly briefs against their
// source artifacts (sector_summary, movements, activity).
//
// Briefs with validation_status='hallucinated' skip email delivery and trigger
// Sentry warnings. This prevents unsupported claims from reaching users.

const BATCH_SIZE = 10; // Process up to 10 pending briefs per run
const WALL_CLOCK_GUARD_MS = 55_000; // 55s guard (maxDuration=60s)

interface BriefRow {
  id: string;
  org_id: string;
  content: Record<string, unknown>;
  sector_summary: string | null;
  movements: Array<{
    competitor_name: string;
    movement_type: string;
    movement_summary: string;
    strategic_implication: string | null;
  }>;
  activity: Array<{
    competitor_name: string;
    narrative: string;
    signal_count: number;
  }>;
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const elapsed = startTimer();
  const runId =
    (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();
  const checkInId = Sentry.captureCheckIn({
    monitorSlug: "validate-briefs",
    status: "in_progress",
  });
  const startedAt = Date.now();

  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) throw new Error("OPENAI_API_KEY not set");

    // Load pending briefs from last 7 days (generated but not yet validated)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: briefRows, error: briefErr } = await (supabase as any)
      .from("weekly_briefs")
      .select("id, org_id, content, sector_summary, movements, activity")
      .eq("validation_status", "pending")
      .gte("generated_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("generated_at", { ascending: false })
      .limit(BATCH_SIZE);

    if (briefErr) throw briefErr;

    const briefs = (briefRows ?? []) as BriefRow[];

    if (briefs.length === 0) {
      Sentry.captureCheckIn({ monitorSlug: "validate-briefs", status: "ok", checkInId });
      await Sentry.flush(2000);
      return res.status(200).json({
        ok: true,
        job: "validate-briefs",
        processed: 0,
        skippedByGuard: 0,
      });
    }

    let validatedCount = 0,
      weakCount = 0,
      hallucinatedCount = 0,
      processedCount = 0,
      skippedByGuard = 0;

    for (const brief of briefs) {
      // Wall-clock guard: stop processing if approaching timeout
      if (Date.now() - startedAt > WALL_CLOCK_GUARD_MS) {
        skippedByGuard = briefs.length - processedCount;
        console.log(`wall_clock_guard: skipping ${skippedByGuard} remaining briefs`);
        break;
      }

      const timer = startTimer();

      try {
        // Validate brief against source artifacts
        const result = await validateBrief(
          openaiKey,
          brief.content,
          brief.sector_summary,
          brief.movements,
          brief.activity
        );

        // Update validation_status, validation_reasoning, validated_at
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("weekly_briefs")
          .update({
            validation_status: result.validation_status,
            validation_reasoning: result.validation_reasoning,
            validated_at: new Date().toISOString(),
          })
          .eq("id", brief.id);

        if (result.validation_status === "validated") validatedCount++;
        else if (result.validation_status === "weak") weakCount++;
        else if (result.validation_status === "hallucinated") {
          hallucinatedCount++;

          // Warn operator: brief made unsupported claims, email delivery should skip this brief
          Sentry.captureMessage("brief_hallucinated", {
            level: "warning",
            tags: { brief_id: brief.id, org_id: brief.org_id },
            extra: {
              validation_reasoning: result.validation_reasoning,
              headline: (brief.content as { headline?: string }).headline,
            },
          });
        }

        processedCount++;

        await recordEvent({
          stage: "validate-briefs",
          status: "success",
          duration_ms: timer(),
          metadata: {
            brief_id: brief.id,
            org_id: brief.org_id,
            validation_status: result.validation_status,
          },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "unknown_error";

        // Mark brief as weak on validation failure (fail-safe: don't block email delivery)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("weekly_briefs")
          .update({
            validation_status: "weak",
            validation_reasoning: `Validation failed: ${errorMessage}`,
            validated_at: new Date().toISOString(),
          })
          .eq("id", brief.id);

        weakCount++;
        processedCount++;

        await recordEvent({
          stage: "validate-briefs",
          status: "failure",
          duration_ms: timer(),
          metadata: {
            brief_id: brief.id,
            org_id: brief.org_id,
            error: errorMessage,
          },
        });
      }
    }

    await recordEvent({
      stage: "validate-briefs",
      status: "success",
      duration_ms: elapsed(),
      metadata: {
        run_id: runId,
        processed: processedCount,
        validated: validatedCount,
        weak: weakCount,
        hallucinated: hallucinatedCount,
        skipped_by_guard: skippedByGuard,
      },
    });

    Sentry.captureCheckIn({ monitorSlug: "validate-briefs", status: "ok", checkInId });
    await Sentry.flush(2000);

    return res.status(200).json({
      ok: true,
      job: "validate-briefs",
      processed: processedCount,
      validated: validatedCount,
      weak: weakCount,
      hallucinated: hallucinatedCount,
      skippedByGuard,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "unknown_error";

    await recordEvent({
      stage: "validate-briefs",
      status: "failure",
      duration_ms: elapsed(),
      metadata: { error: errorMessage },
    });

    Sentry.captureCheckIn({
      monitorSlug: "validate-briefs",
      status: "error",
      checkInId,
    });
    Sentry.captureException(error);
    await Sentry.flush(2000);

    return res.status(500).json({
      ok: false,
      job: "validate-briefs",
      error: errorMessage,
    });
  }
}

export default withSentry("validate-briefs", handler);
