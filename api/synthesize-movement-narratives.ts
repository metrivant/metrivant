// Decoupled narrative synthesis for strategic_movements.
//
// Runs after detect-movements as a separate cron job.
// Selects movements where movement_summary IS NULL, synthesizes a
// GPT-4o narrative, and writes the result back.
//
// Decoupling ensures LLM latency and failures cannot interfere with
// movement detection throughput.

import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { synthesizeMovement } from "../lib/movement-synthesis";
import type { SignalForSynthesis } from "../lib/movement-synthesis";
import { recordEvent, startTimer } from "../lib/pipeline-metrics";

interface MovementRow {
  id:            string;
  competitor_id: string;
  movement_type: string;
  summary:       string | null;
}

const BATCH_SIZE   = 10;
const SINCE_DAYS   = 14;

async function writeNarrative(
  movementId:           string,
  movementSummary:      string,
  strategicImplication: string | null,
  confidenceLevel:      string | null,
  confidenceReason:     string | null
): Promise<void> {
  const payload: Record<string, unknown> = {
    movement_summary:       movementSummary,
    narrative_generated_at: new Date().toISOString(),
  };
  if (strategicImplication) payload.strategic_implication = strategicImplication;
  if (confidenceLevel)      payload.confidence_level      = confidenceLevel;
  if (confidenceReason)     payload.confidence_reason     = confidenceReason;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("strategic_movements")
    .update(payload)
    .eq("id", movementId);
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    res.status(500).json({ error: "OPENAI_API_KEY not configured" });
    return;
  }

  const checkInId = Sentry.captureCheckIn({ monitorSlug: "synthesize-movement-narratives", status: "in_progress" });

  let movementsProcessed  = 0;
  let narrativesGenerated = 0;
  let narrativesFallback  = 0;

  try {
    // 1 — Fetch movements not yet synthesized
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: movements, error: movementsError } = await (supabase as any)
      .from("strategic_movements")
      .select("id, competitor_id, movement_type, summary")
      .is("movement_summary", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (movementsError) throw movementsError;

    if (!movements || movements.length === 0) {
      Sentry.captureCheckIn({ monitorSlug: "synthesize-movement-narratives", status: "ok", checkInId });
      await Sentry.flush(2000);
      res.status(200).json({
        ok: true, job: "synthesize-movement-narratives",
        movementsProcessed: 0, narrativesGenerated: 0, narrativesFallback: 0,
        runtimeDurationMs: Date.now() - startedAt,
      });
      return;
    }

    // 2 — Sector per competitor (via tracked_competitors → organizations join)
    // Resolves sector per competitor to handle multi-org deployments correctly.
    const competitorSectorMap = new Map<string, string>();
    try {
      const movementCompetitorIds = (movements as MovementRow[]).map((m) => m.competitor_id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: tcRows } = await (supabase as any)
        .from("tracked_competitors")
        .select("competitor_id, organizations(sector)")
        .in("competitor_id", movementCompetitorIds);
      for (const row of (tcRows ?? []) as { competitor_id: string; organizations: { sector: string | null } | null }[]) {
        const sector = row.organizations?.sector;
        if (sector && !competitorSectorMap.has(row.competitor_id)) {
          competitorSectorMap.set(row.competitor_id, sector);
        }
      }
    } catch { /* non-fatal */ }

    const since = new Date(Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    for (const movement of movements as MovementRow[]) {
      movementsProcessed++;

      try {
        // 3 — Fetch competitor name
        const { data: compRow } = await supabase
          .from("competitors")
          .select("name")
          .eq("id", movement.competitor_id)
          .single();

        const competitorName = (compRow as { name: string } | null)?.name ?? movement.competitor_id;

        // 4 — Fetch signals for this competitor in the 14-day window
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: signalRows } = await (supabase as any)
          .from("signals")
          .select("id, signal_type, detected_at, monitored_pages(page_type)")
          .eq("competitor_id", movement.competitor_id)
          .gte("detected_at", since)
          .eq("interpreted", true)
          .or("confidence_score.is.null,confidence_score.gte.0.40")
          .order("detected_at", { ascending: false })
          .limit(8);

        if (!signalRows || signalRows.length === 0) {
          await writeNarrative(movement.id, movement.summary ?? movement.movement_type, null, null, null);
          narrativesFallback++;
          continue;
        }

        // 5 — Batch-load interpretations for those signals
        const signalIds = (signalRows as { id: string }[]).map((r) => r.id);
        const { data: interpretations } = await supabase
          .from("interpretations")
          .select("signal_id, summary, strategic_implication")
          .in("signal_id", signalIds);

        const interpMap = new Map<string, { summary: string; strategic_implication: string }>();
        for (const row of (interpretations ?? []) as { signal_id: string; summary: string; strategic_implication: string }[]) {
          interpMap.set(row.signal_id, { summary: row.summary, strategic_implication: row.strategic_implication });
        }

        // 6 — Build signal context for synthesis
        const signalsForSynthesis: SignalForSynthesis[] = (signalRows as {
          id: string;
          signal_type: string;
          detected_at: string;
          monitored_pages: { page_type: string } | null;
        }[]).map((s) => {
          const interp = interpMap.get(s.id);
          return {
            signal_type:             s.signal_type,
            section_type:            s.monitored_pages?.page_type ?? "unknown",
            summary:                 interp?.summary ?? null,
            strategic_implication:   interp?.strategic_implication ?? null,
            detected_at:             s.detected_at,
            changed_content_snippet: interp?.summary ? interp.summary.slice(0, 300) : null,
          };
        });

        const hasEvidence = signalsForSynthesis.some((s) => s.summary !== null);
        if (!hasEvidence) {
          await writeNarrative(movement.id, movement.summary ?? movement.movement_type, null, null, null);
          narrativesFallback++;
          continue;
        }

        // 7 — GPT-4o synthesis
        const movementSector = competitorSectorMap.get(movement.competitor_id) ?? "custom";
        const aiElapsed = startTimer();
        const synthesis = await synthesizeMovement(
          competitorName,
          movement.movement_type,
          movementSector,
          signalsForSynthesis
        ).catch(() => null);

        void recordEvent({
          stage:    "movement_synthesis",
          status:   synthesis ? "success" : "failure",
          duration_ms: aiElapsed(),
          metadata: {
            model:      "gpt-4o",
            batch_size: 1,
            competitor_id: movement.competitor_id,
          },
        });

        if (synthesis) {
          await writeNarrative(
            movement.id,
            synthesis.movement_summary,
            synthesis.strategic_implication,
            synthesis.confidence_level,
            synthesis.confidence_reason
          );
          narrativesGenerated++;
        } else {
          await writeNarrative(movement.id, movement.summary ?? movement.movement_type, null, null, null);
          narrativesFallback++;
        }
      } catch (movErr) {
        Sentry.captureException(movErr instanceof Error ? movErr : new Error(String(movErr)));
        // Non-fatal — continue to next movement
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name:           "synthesize-movement-narratives",
      movements_processed:  movementsProcessed,
      narratives_generated: narrativesGenerated,
      narratives_fallback:  narrativesFallback,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({ monitorSlug: "synthesize-movement-narratives", status: "ok", checkInId });
    await Sentry.flush(2000);

    res.status(200).json({
      ok:                   true,
      job:                  "synthesize-movement-narratives",
      movementsProcessed,
      narrativesGenerated,
      narrativesFallback,
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "synthesize-movement-narratives", status: "error", checkInId });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("synthesize-movement-narratives", handler);
