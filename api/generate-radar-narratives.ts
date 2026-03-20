// Decoupled radar narrative generation.
//
// Runs hourly. Checks 4 trigger conditions per competitor and generates
// AI explanations for radar node activity. Rate-limited to 12h except
// when a high_value signal arrives.
//
// Trigger conditions:
//   1. Strategic movement updated since last narrative
//   2. ≥2 new signals in last 7d since last narrative
//   3. Pressure index increased ≥1.5 since last narrative
//   4. high_value signal arrived since last narrative (bypasses rate limit)
//
// Radar physics and node positions remain deterministic and unaffected.

import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import {
  selectSignalsForNarrative,
  generateRadarNarrative,
} from "../lib/radar-narrative";
import type { SignalForNarrative } from "../lib/radar-narrative";
import { recordEvent, startTimer } from "../lib/pipeline-metrics";

const TWELVE_HOURS_MS     = 12 * 60 * 60 * 1000;
const SINCE_14D_MS        = 14 * 24 * 60 * 60 * 1000;
const SINCE_7D_MS         =  7 * 24 * 60 * 60 * 1000;
const WALL_CLOCK_GUARD_MS = 85_000;

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();

  const checkInId = Sentry.captureCheckIn({ monitorSlug: "generate-radar-narratives", status: "in_progress" });

  let candidatesChecked   = 0;
  let narrativesGenerated = 0;
  let narrativesFallback  = 0;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const since14d = new Date(Date.now() - SINCE_14D_MS).toISOString();
    const since7d  = new Date(Date.now() - SINCE_7D_MS).toISOString();

    // ── Step 1: All tracked competitor IDs (deduplicated across orgs) ─────────
    const { data: trackedRows } = await sb
      .from("tracked_competitors")
      .select("competitor_id")
      .not("competitor_id", "is", null);

    const trackedIds = [...new Set(
      ((trackedRows ?? []) as { competitor_id: string }[])
        .map((r) => r.competitor_id)
        .filter(Boolean)
    )];

    if (trackedIds.length === 0) {
      await finalize("ok");
      return respond(res, startedAt, 0, 0, 0);
    }

    // ── Step 2: Competitor metadata ───────────────────────────────────────────
    const { data: compRows } = await supabase
      .from("competitors")
      .select("id, name, pressure_index")
      .in("id", trackedIds);

    const competitorMap = new Map<string, { name: string; pressure_index: number }>();
    for (const c of (compRows ?? []) as { id: string; name: string; pressure_index: number | null }[]) {
      competitorMap.set(c.id, { name: c.name, pressure_index: c.pressure_index ?? 0 });
    }

    // ── Step 3: Latest narrative per competitor ────────────────────────────────
    const { data: narrativeRows } = await sb
      .from("radar_narratives")
      .select("competitor_id, created_at, pressure_index, generation_reason")
      .in("competitor_id", trackedIds)
      .order("created_at", { ascending: false })
      .limit(trackedIds.length * 2);

    const lastNarrativeMap = new Map<string, { created_at: string; pressure_index: number | null; generation_reason: string | null }>();
    for (const n of (narrativeRows ?? []) as { competitor_id: string; created_at: string; pressure_index: number | null; generation_reason: string | null }[]) {
      if (!lastNarrativeMap.has(n.competitor_id)) {
        lastNarrativeMap.set(n.competitor_id, n);
      }
    }

    // ── Step 4: Signals in 14d window with page_class ─────────────────────────
    const { data: signalRows } = await sb
      .from("signals")
      .select("id, signal_type, detected_at, competitor_id, relevance_level, monitored_pages(page_class, page_type)")
      .in("competitor_id", trackedIds)
      .gte("detected_at", since14d)
      .eq("interpreted", true)
      .order("detected_at", { ascending: false })
      .limit(trackedIds.length * 20);

    type RawSignal = {
      id: string;
      signal_type: string;
      detected_at: string;
      competitor_id: string;
      relevance_level: string | null;
      monitored_pages: { page_class: string; page_type: string } | null;
    };

    const signalsByCompetitor = new Map<string, RawSignal[]>();
    for (const s of (signalRows ?? []) as RawSignal[]) {
      const arr = signalsByCompetitor.get(s.competitor_id) ?? [];
      arr.push(s);
      signalsByCompetitor.set(s.competitor_id, arr);
    }

    // ── Step 5: Recent movements (for trigger 1) ──────────────────────────────
    const { data: movementRows } = await supabase
      .from("strategic_movements")
      .select("competitor_id, last_seen_at")
      .in("competitor_id", trackedIds)
      .gte("last_seen_at", since14d);

    const movementsByCompetitor = new Map<string, { last_seen_at: string | null }[]>();
    for (const m of (movementRows ?? []) as { competitor_id: string; last_seen_at: string | null }[]) {
      const arr = movementsByCompetitor.get(m.competitor_id) ?? [];
      arr.push(m);
      movementsByCompetitor.set(m.competitor_id, arr);
    }

    // ── Step 6: Sector per competitor (via tracked_competitors → organizations) ──
    // Resolves sector per competitor to handle multi-org deployments correctly.
    const competitorSectorMap = new Map<string, string>();
    try {
      const { data: tcRows } = await sb
        .from("tracked_competitors")
        .select("competitor_id, organizations(sector)")
        .in("competitor_id", trackedIds);
      for (const row of (tcRows ?? []) as { competitor_id: string; organizations: { sector: string | null } | null }[]) {
        const sector = row.organizations?.sector;
        if (sector && !competitorSectorMap.has(row.competitor_id)) {
          competitorSectorMap.set(row.competitor_id, sector);
        }
      }
    } catch { /* non-fatal */ }

    // ── Step 7: Determine which competitors need new narratives ───────────────
    const toGenerate: string[] = [];
    // Tracks competitors that triggered via the fallback condition (single signal,
    // no movement, no prior narrative) so the insert can be tagged generation_reason='fallback'.
    const fallbackTriggerSet = new Set<string>();
    const now = Date.now();
    const SINCE_48H_MS = 48 * 60 * 60 * 1000;
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

    for (const competitorId of trackedIds) {
      candidatesChecked++;

      const comp     = competitorMap.get(competitorId);
      const signals  = signalsByCompetitor.get(competitorId) ?? [];
      if (!comp || signals.length === 0) continue;

      const lastNarrative   = lastNarrativeMap.get(competitorId);
      const lastNarrativeMs = lastNarrative ? new Date(lastNarrative.created_at).getTime() : 0;

      // Trigger 4 — high_value override (bypasses rate limit)
      const highValueOverride = signals.some(
        (s) =>
          s.monitored_pages?.page_class === "high_value" &&
          new Date(s.detected_at).getTime() > lastNarrativeMs
      );

      // Rate limit: fallback narratives are held to 24h; standard triggers use 12h.
      // This prevents a single weak signal from regenerating every 12h indefinitely.
      const lastWasFallback = lastNarrative?.generation_reason === "fallback";
      const rateLimit = lastWasFallback ? TWENTY_FOUR_HOURS_MS : TWELVE_HOURS_MS;
      const timeSinceLast = lastNarrative ? now - lastNarrativeMs : Infinity;
      if (timeSinceLast < rateLimit && !highValueOverride) continue;

      // No narrative yet — check if this is a fallback trigger or a standard first run
      if (!lastNarrative) {
        const movements = movementsByCompetitor.get(competitorId) ?? [];
        const hasMovement = movements.length > 0;
        // Trigger 5 (fallback): interpreted signal within 48h, no movement, not low-relevance
        const freshRelevantSignal = signals.find((s) => {
          const age = now - new Date(s.detected_at).getTime();
          const level = s.relevance_level ?? null;
          return age <= SINCE_48H_MS && level !== "low";
        });
        if (freshRelevantSignal && !hasMovement) {
          fallbackTriggerSet.add(competitorId);
        }
        toGenerate.push(competitorId);
        continue;
      }

      // Trigger 1 — strategic movement updated since last narrative
      const movements   = movementsByCompetitor.get(competitorId) ?? [];
      const newMovement = movements.some((m) => {
        const t = m.last_seen_at ? new Date(m.last_seen_at).getTime() : 0;
        return t > lastNarrativeMs;
      });

      // Trigger 2 — ≥2 new signals in last 7d since last narrative
      const since7dMs      = now - SINCE_7D_MS;
      const newRecentCount = signals.filter((s) => {
        const t = new Date(s.detected_at).getTime();
        return t > lastNarrativeMs && t >= since7dMs;
      }).length;
      const signalBurst = newRecentCount >= 2;

      // Trigger 3 — pressure index increase ≥1.5 since last narrative
      const lastPressure = lastNarrative.pressure_index ?? 0;
      const currentPressure = comp.pressure_index;
      const pressureJump = (currentPressure - lastPressure) >= 1.5;

      if (newMovement || signalBurst || pressureJump || highValueOverride) {
        toGenerate.push(competitorId);
      }
    }

    if (toGenerate.length === 0) {
      await finalize("ok");
      return respond(res, startedAt, candidatesChecked, 0, 0);
    }

    // ── Step 8: Batch-load interpretations for selected signals ──────────────
    // Pre-select using selectSignalsForNarrative (page_class priority order)
    // so interpretations are fetched for the signals that will actually be used.
    const neededSignalIds = new Set<string>();
    for (const competitorId of toGenerate) {
      const rawSigs = signalsByCompetitor.get(competitorId) ?? [];
      const preSelected = selectSignalsForNarrative(rawSigs.map((s) => ({
        signal_id:               s.id,
        page_class:              s.monitored_pages?.page_class ?? "standard",
        section_type:            s.monitored_pages?.page_type  ?? "unknown",
        summary:                 null,
        changed_content_snippet: null,
        detected_at:             s.detected_at,
      })));
      for (const s of preSelected) neededSignalIds.add(s.signal_id);
    }

    const { data: interpRows } = await supabase
      .from("interpretations")
      .select("signal_id, summary")
      .in("signal_id", [...neededSignalIds]);

    const summaryBySignalId = new Map<string, string>();
    for (const i of (interpRows ?? []) as { signal_id: string; summary: string }[]) {
      if (i.summary) summaryBySignalId.set(i.signal_id, i.summary);
    }

    // ── Step 9: Generate and store narratives ─────────────────────────────────
    let skippedByGuard = 0;

    for (const competitorId of toGenerate) {
      if (Date.now() - startedAt > WALL_CLOCK_GUARD_MS) {
        skippedByGuard = toGenerate.length - (narrativesGenerated + narrativesFallback);
        console.log(`wall_clock_guard: skipping ${skippedByGuard} remaining competitors to avoid Vercel timeout`);
        break;
      }

      const comp    = competitorMap.get(competitorId)!;
      const rawSigs = signalsByCompetitor.get(competitorId) ?? [];

      // Build SignalForNarrative array with changed_content_snippet
      const signalsWithMeta: SignalForNarrative[] = rawSigs.map((s) => ({
        signal_id:               s.id,
        page_class:              s.monitored_pages?.page_class ?? "standard",
        section_type:            s.monitored_pages?.page_type  ?? "unknown",
        summary:                 summaryBySignalId.get(s.id) ?? null,
        changed_content_snippet: summaryBySignalId.has(s.id)
          ? summaryBySignalId.get(s.id)!.slice(0, 300)
          : null,
        detected_at: s.detected_at,
      }));

      const selected = selectSignalsForNarrative(signalsWithMeta);
      if (selected.length === 0) continue;

      // Call GPT-4o-mini
      const competitorSector = competitorSectorMap.get(competitorId) ?? "custom";
      const aiElapsed = startTimer();
      const result = await generateRadarNarrative(
        comp.name,
        competitorSector,
        comp.pressure_index,
        selected
      ).catch(() => null);

      void recordEvent({
        stage:    "radar_narrative",
        status:   result ? "success" : "failure",
        duration_ms: aiElapsed(),
        metadata: {
          model:         "gpt-4o-mini",
          batch_size:    selected.length,
          competitor_id: competitorId,
        },
      });

      const narrative = result?.radar_explanation
        ?? `${comp.name} had ${rawSigs.length} signal${rawSigs.length !== 1 ? "s" : ""} in the last 14 days.`;
      const signalCount = result?.signal_count ?? selected.length;
      const isFallback  = !result;

      // Insert time-series row
      const { error: insertError } = await sb
        .from("radar_narratives")
        .insert({
          competitor_id:       competitorId,
          pressure_index:      comp.pressure_index,
          signal_count:        signalCount,
          narrative,
          evidence_signal_ids: selected.map((s) => s.signal_id),
          // Fallback trigger: single signal, no movement — labeled for honest display
          ...(fallbackTriggerSet.has(competitorId) ? { generation_reason: "fallback" } : {}),
        });

      if (insertError) {
        Sentry.captureException(insertError);
        continue;
      }

      if (isFallback) {
        narrativesFallback++;
      } else {
        narrativesGenerated++;
      }
    }

    await finalize("ok");
    return respond(res, startedAt, candidatesChecked, narrativesGenerated, narrativesFallback, skippedByGuard);
  } catch (error) {
    Sentry.captureException(error);
    await finalize("error");
    throw error;
  }

  async function finalize(status: "ok" | "error") {
    Sentry.captureCheckIn({ checkInId, monitorSlug: "generate-radar-narratives", status });
    await Sentry.flush(2000);
  }

  function respond(
    res: ApiRes,
    startedAt: number,
    checked: number,
    generated: number,
    fallback: number,
    skipped: number = 0
  ) {
    const runtimeDurationMs = Date.now() - startedAt;
    Sentry.setContext("run_metrics", {
      stage_name:           "generate-radar-narratives",
      candidates_checked:   checked,
      narratives_generated: generated,
      narratives_fallback:  fallback,
      skipped_by_guard:     skipped,
      runtimeDurationMs,
    });
    res.status(200).json({
      ok:                   true,
      job:                  "generate-radar-narratives",
      candidates_checked:   checked,
      narratives_generated: generated,
      narratives_fallback:  fallback,
      skipped_by_guard:     skipped,
      runtimeDurationMs,
    });
  }
}

export default withSentry("generate-radar-narratives", handler);
