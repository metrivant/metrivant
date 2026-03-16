import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { recordEvent, startTimer, generateRunId } from "../lib/pipeline-metrics";

interface SectionRow {
  id: string;
  monitored_page_id: string;
  snapshot_id: string;
  section_type: string;
  section_hash: string;
  section_text: string;
  created_at: string;
  validation_status: string | null;
}

interface BaselineRow {
  monitored_page_id: string;
  section_type: string;
  section_hash: string;
  source_section_id: string | null;
}

interface DiffRow {
  id: string;
  monitored_page_id: string;
  section_type: string;
  previous_section_id: string | null;
  current_section_id: string;
  observation_count: number | null;
  confirmed: boolean | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  signal_detected: boolean | null;
  status: string | null;
}

interface PageSectionHashRow {
  id: string;
  section_hash: string;
}

const SECTION_SCAN_LIMIT    = 500;
const MAX_OBSERVATION_COUNT = 5;
// Only consider sections created within this window. Prevents stale sections
// (from days/weeks ago) crowding out fresh ones in the top-N scan and ensures
// detect-diffs always reflects the current pipeline state.
const SECTION_RECENCY_HOURS = 48;

function makeSectionKey(monitoredPageId: string, sectionType: string): string {
  return monitoredPageId + "::" + sectionType;
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();
  const runId = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();

  Sentry.captureCheckIn({
    monitorSlug: "detect-diffs",
    status: "in_progress",
  });

  try {
    const sectionSince = new Date(
      Date.now() - SECTION_RECENCY_HOURS * 60 * 60 * 1000
    ).toISOString();

    const { data: recentSections, error: sectionsError } = await supabase
      .from("page_sections")
      .select(
        "id, monitored_page_id, snapshot_id, section_type, section_hash, section_text, created_at, validation_status"
      )
      .eq("validation_status", "valid")
      .gte("created_at", sectionSince)
      .order("created_at", { ascending: false })
      .limit(SECTION_SCAN_LIMIT);

    if (sectionsError) {
      throw sectionsError;
    }

    const sectionRows = (recentSections ?? []) as SectionRow[];

    const latestSectionMap = new Map<string, SectionRow>();

    for (const row of sectionRows) {
      const key = makeSectionKey(row.monitored_page_id, row.section_type);
      if (!latestSectionMap.has(key)) {
        latestSectionMap.set(key, row);
      }
    }

    const latestSections = Array.from(latestSectionMap.values());
    const monitoredPageIds = Array.from(
      new Set(latestSections.map((row) => row.monitored_page_id))
    );

    const { data: baselines, error: baselinesError } = await supabase
      .from("section_baselines")
      .select("monitored_page_id, section_type, section_hash, source_section_id")
      .in("monitored_page_id", monitoredPageIds);

    if (baselinesError) {
      throw baselinesError;
    }

    const baselineMap = new Map<string, BaselineRow>();

    for (const baseline of (baselines ?? []) as BaselineRow[]) {
      baselineMap.set(
        makeSectionKey(baseline.monitored_page_id, baseline.section_type),
        baseline
      );
    }

    // ── Pre-filter: identify sections that differ from their baseline ─────────
    // This separates counting from processing and drives both bulk fetches below.
    let sectionsSkippedNoBaseline = 0;
    let sectionsSkippedStable = 0;

    const changedSections: SectionRow[] = [];

    for (const section of latestSections) {
      const key = makeSectionKey(section.monitored_page_id, section.section_type);
      const baseline = baselineMap.get(key);

      if (!baseline || !baseline.source_section_id) {
        sectionsSkippedNoBaseline += 1;
        void recordEvent({ run_id: runId, stage: "compare", status: "skipped", monitored_page_id: section.monitored_page_id, snapshot_id: section.snapshot_id, metadata: { changed: false, section_type: section.section_type, confirmation_window_state: "no_baseline" } });
        continue;
      }

      if (
        section.id === baseline.source_section_id ||
        section.section_hash === baseline.section_hash
      ) {
        sectionsSkippedStable += 1;
        void recordEvent({ run_id: runId, stage: "compare", status: "skipped", monitored_page_id: section.monitored_page_id, snapshot_id: section.snapshot_id, metadata: { changed: false, section_type: section.section_type, confirmation_window_state: "stable" } });
        continue;
      }

      changedSections.push(section);
      void recordEvent({ run_id: runId, stage: "compare", status: "success", monitored_page_id: section.monitored_page_id, snapshot_id: section.snapshot_id, metadata: { changed: true, section_type: section.section_type, confirmation_window_state: "changed" } });
    }

    const changedPageIds = [...new Set(changedSections.map((s) => s.monitored_page_id))];

    // ── Batch-load page_class for all changed pages ───────────────────────────
    // Written onto new section_diff rows so downstream stages can filter by
    // page_class at the DB layer without a monitored_pages join.
    const pageClassMap = new Map<string, string>();
    if (changedPageIds.length > 0) {
      const { data: pageClassRows, error: pageClassError } = await supabase
        .from("monitored_pages")
        .select("id, page_class")
        .in("id", changedPageIds);
      if (pageClassError) throw pageClassError;
      for (const row of (pageClassRows ?? []) as { id: string; page_class: string }[]) {
        pageClassMap.set(row.id, row.page_class);
      }
    }

    // ── Batch-load existing diffs for all changed pages (eliminates N+1) ─────
    // Keyed by "page_id::section_type::previous_section_id" → most-recent DiffRow.
    const diffMapByKey = new Map<string, DiffRow>();

    if (changedPageIds.length > 0) {
      const { data: existingDiffs, error: existingDiffsError } = await supabase
        .from("section_diffs")
        .select(
          "id, monitored_page_id, section_type, previous_section_id, current_section_id, observation_count, confirmed, first_seen_at, last_seen_at, signal_detected, status"
        )
        .in("monitored_page_id", changedPageIds)
        .order("last_seen_at", { ascending: false });

      if (existingDiffsError) throw existingDiffsError;

      // Keep the most-recent diff per (page, type, previous_section_id).
      for (const diff of (existingDiffs ?? []) as DiffRow[]) {
        if (!diff.previous_section_id) continue;
        const key = `${diff.monitored_page_id}::${diff.section_type}::${diff.previous_section_id}`;
        if (!diffMapByKey.has(key)) diffMapByKey.set(key, diff);
      }
    }

    // ── Batch-load section hashes referenced by existing diffs ───────────────
    // Used to detect when the new section is a re-observation of the same change.
    const existingCurrentIds = [
      ...new Set([...diffMapByKey.values()].map((d) => d.current_section_id)),
    ];
    const sectionHashMap = new Map<string, string>(); // section_id → section_hash

    if (existingCurrentIds.length > 0) {
      const { data: sectionHashes, error: hashError } = await supabase
        .from("page_sections")
        .select("id, section_hash")
        .in("id", existingCurrentIds);

      if (hashError) throw hashError;

      for (const row of (sectionHashes ?? []) as PageSectionHashRow[]) {
        sectionHashMap.set(row.id, row.section_hash);
      }
    }

    const rowsClaimed = changedSections.length;
    let rowsProcessed = 0;
    let rowsSucceeded = 0;
    let rowsFailed = 0;
    let diffsCreated = 0;
    let diffsConfirmed = 0;
    let sectionsSkippedSameCurrent = 0;
    let diffStabilityWarnings = 0;

    for (const section of changedSections) {
      rowsProcessed += 1;
      const elapsed = startTimer();

      try {
        const key = makeSectionKey(section.monitored_page_id, section.section_type);
        const baseline = baselineMap.get(key)!; // guaranteed by changedSections filter

        const diffKey = `${section.monitored_page_id}::${section.section_type}::${baseline.source_section_id}`;
        const existingDiff = diffMapByKey.get(diffKey) ?? null;

        if (existingDiff && existingDiff.current_section_id === section.id) {
          sectionsSkippedSameCurrent += 1;
          continue;
        }

        let shouldUpdateExisting = false;

        if (existingDiff) {
          const existingCurrentHash = sectionHashMap.get(existingDiff.current_section_id);
          if (existingCurrentHash && existingCurrentHash === section.section_hash) {
            shouldUpdateExisting = true;
          }
        }

        if (shouldUpdateExisting && existingDiff) {
          const previousCount = existingDiff.observation_count ?? 1;
          const nextCount = Math.min(previousCount + 1, MAX_OBSERVATION_COUNT);
          // Confirm on first observation — AI interpretation is the quality gate,
          // not the observation count. Requiring >= 2 observations at 4h cron
          // cadence delayed first signals by 8h+ unnecessarily.
          const confirmed = nextCount >= 1;

          const { error: updateDiffError } = await supabase
            .from("section_diffs")
            .update({
              current_section_id: section.id,
              diff_text: section.section_text,
              detected_at: section.created_at,
              retry_count: 0,
              last_error: null,
              is_noise: false,
              noise_reason: null,
              status: confirmed ? "confirmed" : "unconfirmed",
              structured_diff: {
                previous_hash: baseline.section_hash,
                current_hash: section.section_hash,
              },
              confirmation_count: nextCount,
              observation_count: nextCount,
              confirmed: confirmed,
              last_seen_at: section.created_at,
            })
            .eq("id", existingDiff.id);

          if (updateDiffError) {
            throw updateDiffError;
          }

          rowsSucceeded += 1;
          void recordEvent({ run_id: runId, stage: "diff", status: "success", monitored_page_id: section.monitored_page_id, section_diff_id: existingDiff.id, duration_ms: elapsed(), metadata: { diff_size_chars: section.section_text.length, section_type: section.section_type } });

          if (confirmed) {
            diffsConfirmed += 1;
          }

          // Diff stability warning: a diff re-observed MAX times without a signal
          // indicates consistent suppression — normalization mismatch, confidence
          // floor, or unstable extraction producing valid-but-un-signalable content.
          // Force signal_detected=true to clear it from the queue; the warning flags
          // it for investigation. Without this, these accumulate as phantom diffBacklog.
          if (
            nextCount >= MAX_OBSERVATION_COUNT &&
            existingDiff.signal_detected !== true
          ) {
            Sentry.captureMessage("diff_stability_warning", {
              level: "warning",
              extra: {
                diff_id:            existingDiff.id,
                monitored_page_id:  existingDiff.monitored_page_id,
                section_type:       existingDiff.section_type,
                observation_count:  nextCount,
              },
            });
            diffStabilityWarnings += 1;

            // Clear from queue — detect-signals will no longer re-evaluate this diff.
            await supabase
              .from("section_diffs")
              .update({ signal_detected: true })
              .eq("id", existingDiff.id);
          }

          continue;
        }

        // ignoreDuplicates: true → ON CONFLICT DO NOTHING.
        // Guards against concurrent cron + manual invocations both finding no
        // existing diff and racing to insert the same (page, type, previous) row.
        const { error: insertDiffError } = await supabase
          .from("section_diffs")
          .upsert(
            {
              monitored_page_id: section.monitored_page_id,
              section_type: section.section_type,
              previous_section_id: baseline.source_section_id,
              current_section_id: section.id,
              diff_text: section.section_text,
              detected_at: section.created_at,
              signal_detected: false,
              retry_count: 0,
              last_error: null,
              is_noise: false,
              noise_reason: null,
              // Confirmed on first observation — AI interpretation is the quality gate.
              status: "confirmed",
              structured_diff: {
                previous_hash: baseline.section_hash,
                current_hash: section.section_hash,
              },
              confirmation_count: 1,
              observation_count: 1,
              confirmed: true,
              first_seen_at: section.created_at,
              last_seen_at: section.created_at,
              // Denormalized from monitored_pages — enables DB-layer filtering in
              // detect-ambient and detect-signals without a join on every query.
              page_class: pageClassMap.get(section.monitored_page_id) ?? "standard",
            },
            {
              onConflict: "monitored_page_id,section_type,previous_section_id",
              ignoreDuplicates: true,
            }
          );

        if (insertDiffError) {
          throw insertDiffError;
        }

        rowsSucceeded += 1;
        diffsCreated += 1;
        void recordEvent({ run_id: runId, stage: "diff", status: "success", monitored_page_id: section.monitored_page_id, duration_ms: elapsed(), metadata: { diff_size_chars: section.section_text.length, section_type: section.section_type } });
      } catch (error) {
        rowsFailed += 1;
        Sentry.captureException(error);
        void recordEvent({ run_id: runId, stage: "diff", status: "failure", monitored_page_id: section.monitored_page_id, duration_ms: elapsed(), metadata: { section_type: section.section_type } });
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name: "detect-diffs",
      batch_size: rowsClaimed,
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      diffsCreated,
      diffsConfirmed,
      sectionsSkippedNoBaseline,
      sectionsSkippedStable,
      sectionsSkippedSameCurrent,
      diffStabilityWarnings,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({
      monitorSlug: "detect-diffs",
      status: "ok",
    });

    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "detect-diffs",
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      diffsCreated,
      diffsConfirmed,
      sectionsSkippedNoBaseline,
      sectionsSkippedStable,
      sectionsSkippedSameCurrent,
      diffStabilityWarnings,
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);

    Sentry.captureCheckIn({
      monitorSlug: "detect-diffs",
      status: "error",
    });

    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("detect-diffs", handler);