import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import { createHash } from "crypto";
import { recordEvent, startTimer, generateRunId } from "../lib/pipeline-metrics";

// Careers signals are given a fixed confidence of 0.75:
//   • At or above the 0.65 CONFIDENCE_INTERPRET threshold → status='pending'
//   • At or above the 0.75 model routing threshold → gpt-4o used in interpret-signals
// Individual job postings are evidence. Patterns are the signal.
const CAREERS_SIGNAL_CONFIDENCE = 0.75;

// Look back 7 days when computing hiring patterns.
const PATTERN_WINDOW_DAYS = 7;
const PATTERN_WINDOW_MS   = PATTERN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

// hiring_spike:  3+ new postings in same canonical function in 7 days
const HIRING_SPIKE_THRESHOLD = 3;

// role_cluster:  5+ postings across ≥2 technical functions (engineering/infrastructure/data/research) in 7 days
const ROLE_CLUSTER_THRESHOLD  = 5;
const ROLE_CLUSTER_TECH_FUNCTIONS = new Set([
  "engineering", "infrastructure", "data", "research",
]);

// Process up to 50 competitors' pending job postings per run.
// Pattern detection groups by competitor, so batch size is in competitors.
const MAX_COMPETITORS_PER_RUN = 50;

// Time window for careers page-diff suppression.
// When we detect hiring patterns and promote a signal, pre-empt the careers page diff.
// A diff on the careers page within this window is the same underlying event.
const DIFF_SUPPRESS_WINDOW_BEFORE_MS = 1 * 60 * 60 * 1000; // 1 hour before oldest posting
const DIFF_SUPPRESS_WINDOW_AFTER_MS  = 6 * 60 * 60 * 1000; // 6 hours after newest posting

interface JobPostingRow {
  id:                   string;
  competitor_id:        string;
  published_at:         string | null;
  department_normalized: string | null;
  location:             string | null;
  title:                string;
  content_hash:         string;
}

// ── ISO week bucket ────────────────────────────────────────────────────────────
// Returns "YYYY-WNN" for a given date. Used to bucket patterns by calendar week.
// Same week → same signal_hash → dedup on re-runs.

function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // Monday = 1, Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Thursday of ISO week
  const year = d.getUTCFullYear();
  const week = Math.ceil((((d.getTime() - Date.UTC(year, 0, 1)) / 86400000) + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

// ── Signal hash for careers pattern signals ────────────────────────────────────
// hiring_spike / role_cluster: sha256(competitorId:signalType:function:weekBucket)[:32]
// new_function / new_region:   sha256(competitorId:signalType:normalizedValue)[:32]
//   (no week bucket — only one per competitor per canonical value ever)

function computePatternSignalHash(
  competitorId: string,
  signalType:   string,
  normalizedValue: string,
  weekBucket?:  string
): string {
  const key = weekBucket
    ? `${competitorId}:${signalType}:${normalizedValue}:${weekBucket}`
    : `${competitorId}:${signalType}:${normalizedValue}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 32);
}

// ── Pattern detection ──────────────────────────────────────────────────────────

interface PatternSignal {
  signalType:      "hiring_spike" | "new_function" | "new_region" | "role_cluster";
  signalHash:      string;
  normalizedValue: string; // function name or region name for the pattern
  poolEventIds:    string[];
  postingCount:    number;
  weekBucket:      string | null;
  currentExcerpt:  string;
}

function detectPatterns(
  competitorId: string,
  recentPostings: JobPostingRow[],
  knownFunctions: Set<string>,   // canonical functions ever seen before this window
  knownLocations: Set<string>    // locations ever seen before this window
): PatternSignal[] {
  const now         = Date.now();
  const windowStart = now - PATTERN_WINDOW_MS;

  // Only postings within the 7-day window
  const windowPostings = recentPostings.filter((p) => {
    if (!p.published_at) return true; // include if date unknown
    return new Date(p.published_at).getTime() >= windowStart;
  });

  if (windowPostings.length === 0) return [];

  const signals: PatternSignal[] = [];

  // ── hiring_spike: 3+ postings in same canonical function / 7 days ─────────
  const byFunction = new Map<string, JobPostingRow[]>();
  for (const p of windowPostings) {
    const fn = p.department_normalized ?? "other";
    if (fn === "other") continue; // "other" is not a meaningful spike signal
    const existing = byFunction.get(fn) ?? [];
    existing.push(p);
    byFunction.set(fn, existing);
  }

  for (const [fn, fnPostings] of byFunction) {
    if (fnPostings.length >= HIRING_SPIKE_THRESHOLD) {
      const refDate   = fnPostings[0].published_at ? new Date(fnPostings[0].published_at) : new Date();
      const weekBucket = isoWeek(refDate);
      const hash      = computePatternSignalHash(competitorId, "hiring_spike", fn, weekBucket);
      signals.push({
        signalType:      "hiring_spike",
        signalHash:      hash,
        normalizedValue: fn,
        poolEventIds:    fnPostings.map((p) => p.id),
        postingCount:    fnPostings.length,
        weekBucket,
        currentExcerpt:  `${fnPostings.length} new ${fn} postings in the past 7 days`,
      });
    }
  }

  // ── new_function: first posting in a canonical function ever ──────────────
  for (const [fn, fnPostings] of byFunction) {
    if (!knownFunctions.has(fn)) {
      const hash = computePatternSignalHash(competitorId, "new_function", fn);
      signals.push({
        signalType:      "new_function",
        signalHash:      hash,
        normalizedValue: fn,
        poolEventIds:    fnPostings.map((p) => p.id),
        postingCount:    fnPostings.length,
        weekBucket:      null,
        currentExcerpt:  `First ${fn} hiring observed`,
      });
    }
  }

  // ── new_region: first posting in a location ever ──────────────────────────
  const byLocation = new Map<string, JobPostingRow[]>();
  for (const p of windowPostings) {
    if (!p.location) continue;
    // Normalise location: lowercase, strip state/province, keep city or country
    const locKey = p.location.split(",")[0].trim().toLowerCase();
    if (!locKey) continue;
    const existing = byLocation.get(locKey) ?? [];
    existing.push(p);
    byLocation.set(locKey, existing);
  }

  for (const [locKey, locPostings] of byLocation) {
    if (!knownLocations.has(locKey)) {
      const hash = computePatternSignalHash(competitorId, "new_region", locKey);
      signals.push({
        signalType:      "new_region",
        signalHash:      hash,
        normalizedValue: locKey,
        poolEventIds:    locPostings.map((p) => p.id),
        postingCount:    locPostings.length,
        weekBucket:      null,
        currentExcerpt:  `New hiring location: ${locPostings[0].location}`,
      });
    }
  }

  // ── role_cluster: 5+ postings across ≥2 technical functions in 7 days ─────
  const techPostings = windowPostings.filter(
    (p) => p.department_normalized && ROLE_CLUSTER_TECH_FUNCTIONS.has(p.department_normalized)
  );
  const techFunctionsPresent = new Set(techPostings.map((p) => p.department_normalized).filter(Boolean));

  if (techPostings.length >= ROLE_CLUSTER_THRESHOLD && techFunctionsPresent.size >= 2) {
    const refDate    = techPostings[0].published_at ? new Date(techPostings[0].published_at) : new Date();
    const weekBucket = isoWeek(refDate);
    const hash       = computePatternSignalHash(competitorId, "role_cluster", "technical", weekBucket);
    signals.push({
      signalType:      "role_cluster",
      signalHash:      hash,
      normalizedValue: "technical",
      poolEventIds:    techPostings.map((p) => p.id),
      postingCount:    techPostings.length,
      weekBucket,
      currentExcerpt:  `${techPostings.length} technical postings across ${techFunctionsPresent.size} functions in the past 7 days`,
    });
  }

  return signals;
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();
  const runId     = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();

  Sentry.captureCheckIn({ monitorSlug: "promote-careers-signals", status: "in_progress" });

  try {
    // ── Find competitors with pending job postings ─────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pendingCompetitorRows, error: pendingError } = await (supabase as any)
      .from("pool_events")
      .select("competitor_id")
      .eq("event_type", "job_posting")
      .eq("normalization_status", "pending")
      .limit(MAX_COMPETITORS_PER_RUN * 10); // fetch extra; we deduplicate below

    if (pendingError) throw pendingError;

    const competitorIds = [
      ...new Set(
        ((pendingCompetitorRows ?? []) as { competitor_id: string }[]).map((r) => r.competitor_id)
      ),
    ].slice(0, MAX_COMPETITORS_PER_RUN);

    if (competitorIds.length === 0) {
      Sentry.captureCheckIn({ monitorSlug: "promote-careers-signals", status: "ok" });
      await Sentry.flush(2000);
      return res.status(200).json({
        ok: true,
        job: "promote-careers-signals",
        competitorsProcessed: 0,
        signalsPromoted: 0,
        signalsDuplicate: 0,
        diffsSuppressed: 0,
        runtimeDurationMs: Date.now() - startedAt,
      });
    }

    // ── Load careers page IDs per competitor (for diff suppression) ───────────
    const { data: careersPageRows } = await supabase
      .from("monitored_pages")
      .select("id, competitor_id")
      .in("competitor_id", competitorIds)
      .eq("page_type", "careers")
      .eq("active", true);

    const careersPageMap = new Map<string, string>(); // competitor_id → page_id
    for (const p of ((careersPageRows ?? []) as { id: string; competitor_id: string }[])) {
      careersPageMap.set(p.competitor_id, p.id);
    }

    let competitorsProcessed = 0;
    let signalsPromoted      = 0;
    let signalsDuplicate     = 0;
    let diffsSuppressed      = 0;

    for (const competitorId of competitorIds) {
      const compElapsed = startTimer();
      try {
        // ── Load all recent job postings for this competitor (7-day window + 30d history) ──
        const historyStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: recentRows } = await (supabase as any)
          .from("pool_events")
          .select("id, competitor_id, published_at, department_normalized, location, title, content_hash, normalization_status")
          .eq("competitor_id", competitorId)
          .eq("event_type", "job_posting")
          .gte("created_at", historyStart)
          .order("published_at", { ascending: false })
          .limit(500);

        const allRecentPostings = (recentRows ?? []) as (JobPostingRow & { normalization_status: string })[];
        const pendingPostings   = allRecentPostings.filter((p) => p.normalization_status === "pending");

        if (pendingPostings.length === 0) continue;

        // ── Build "known" sets from historical postings outside the 7-day window ──
        const windowStart = Date.now() - PATTERN_WINDOW_MS;
        const historicalPostings = allRecentPostings.filter((p) => {
          if (!p.published_at) return false;
          return new Date(p.published_at).getTime() < windowStart;
        });

        const knownFunctions = new Set<string>(
          historicalPostings
            .map((p) => p.department_normalized)
            .filter((f): f is string => !!f && f !== "other")
        );
        const knownLocations = new Set<string>(
          historicalPostings
            .map((p) => p.location?.split(",")[0]?.trim()?.toLowerCase())
            .filter((l): l is string => !!l)
        );

        // ── Detect patterns from recent (7-day) postings ──────────────────────
        const recentOnly7d = allRecentPostings.filter((p) => {
          if (!p.published_at) return true;
          return new Date(p.published_at).getTime() >= windowStart;
        });

        const patterns = detectPatterns(competitorId, recentOnly7d, knownFunctions, knownLocations);

        if (patterns.length === 0) {
          // No patterns yet — mark pending postings as normalised (no signal, not a duplicate)
          const pendingIds = pendingPostings.map((p) => p.id);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("pool_events")
            .update({ normalization_status: "normalised" })
            .in("id", pendingIds);
          competitorsProcessed += 1;
          continue;
        }

        // ── Check for existing signal hashes (dedup) ──────────────────────────
        const patternHashes = patterns.map((p) => p.signalHash);
        const { data: existingHashRows } = await supabase
          .from("signals")
          .select("signal_hash")
          .in("signal_hash", patternHashes);

        const existingHashes = new Set<string>(
          ((existingHashRows ?? []) as { signal_hash: string }[]).map((r) => r.signal_hash)
        );

        // ── Promote patterns → signals ─────────────────────────────────────────
        for (const pattern of patterns) {
          const elapsed2 = startTimer();

          if (existingHashes.has(pattern.signalHash)) {
            signalsDuplicate += 1;
            continue;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: newSignal, error: signalError } = await (supabase as any)
            .from("signals")
            .insert({
              competitor_id:     competitorId,
              monitored_page_id: careersPageMap.get(competitorId) ?? null,
              section_diff_id:   null,
              signal_type:       pattern.signalType,
              severity:          "medium",
              confidence_score:  CAREERS_SIGNAL_CONFIDENCE,
              signal_hash:       pattern.signalHash,
              source_type:       "pool_event",
              status:            "pending",
              interpreted:       false,
              retry_count:       0,
              is_duplicate:      false,
              detected_at:       new Date().toISOString(),
              signal_data:       {
                previous_excerpt: null,
                current_excerpt:  pattern.currentExcerpt,
                pool_event_ids:   pattern.poolEventIds,
                pattern_type:     pattern.signalType,
                posting_count:    pattern.postingCount,
                normalized_value: pattern.normalizedValue,
                week_bucket:      pattern.weekBucket,
              },
            })
            .select("id")
            .single();

          if (signalError) {
            if (signalError.code === "23505") {
              signalsDuplicate += 1;
              continue;
            }
            throw signalError;
          }

          const promotedSignalId = (newSignal as { id: string } | null)?.id ?? null;

          // Mark the contributing pool_events as promoted
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("pool_events")
            .update({
              normalization_status: "promoted",
              promoted_signal_id:   promotedSignalId,
            })
            .in("id", pattern.poolEventIds);

          signalsPromoted += 1;
          void recordEvent({
            run_id: runId,
            stage:  "careers_promote",
            status: "success",
            duration_ms: elapsed2(),
            metadata: {
              competitor_id:    competitorId,
              signal_id:        promotedSignalId,
              signal_type:      pattern.signalType,
              normalized_value: pattern.normalizedValue,
              posting_count:    pattern.postingCount,
            },
          });
        }

        // Mark remaining pending postings (those not part of a pattern) as normalised
        const promotedEventIds = new Set(patterns.flatMap((p) => p.poolEventIds));
        const unpromoted = pendingPostings
          .map((p) => p.id)
          .filter((id) => !promotedEventIds.has(id));

        if (unpromoted.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("pool_events")
            .update({ normalization_status: "normalised" })
            .in("id", unpromoted);
        }

        // ── Task 7: suppress overlapping careers page-diff signals ────────────
        // When hiring patterns are detected, mark careers page diffs in the same
        // time window as signal_detected=true. The pool_event-based signal is
        // the structured representation; the page diff adds no new information.
        const careersPageId = careersPageMap.get(competitorId);
        if (careersPageId && signalsPromoted > 0 && recentOnly7d.length > 0) {
          const publishedTimes = recentOnly7d
            .filter((p) => p.published_at)
            .map((p) => new Date(p.published_at!).getTime());

          if (publishedTimes.length > 0) {
            const earliest = Math.min(...publishedTimes);
            const latest   = Math.max(...publishedTimes);
            const windowStart2 = new Date(earliest - DIFF_SUPPRESS_WINDOW_BEFORE_MS).toISOString();
            const windowEnd2   = new Date(latest   + DIFF_SUPPRESS_WINDOW_AFTER_MS).toISOString();

            const { data: conflictingDiffs } = await supabase
              .from("section_diffs")
              .select("id")
              .eq("monitored_page_id", careersPageId)
              .eq("signal_detected", false)
              .eq("confirmed", true)
              .gte("last_seen_at", windowStart2)
              .lte("last_seen_at", windowEnd2);

            const diffIds = ((conflictingDiffs ?? []) as { id: string }[]).map((d) => d.id);
            if (diffIds.length > 0) {
              await supabase
                .from("section_diffs")
                .update({ signal_detected: true, is_noise: false })
                .in("id", diffIds);
              diffsSuppressed += diffIds.length;
            }
          }
        }

        competitorsProcessed += 1;
        void recordEvent({
          run_id: runId,
          stage:  "careers_promote",
          status: "success",
          duration_ms: compElapsed(),
          metadata: {
            competitor_id:    competitorId,
            patterns_detected: patterns.length,
            pending_postings:  pendingPostings.length,
          },
        });
      } catch (compError) {
        Sentry.captureException(compError);
        void recordEvent({
          run_id: runId,
          stage:  "careers_promote",
          status: "failure",
          duration_ms: compElapsed(),
          metadata: { competitor_id: competitorId, error: String(compError) },
        });
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name:           "promote-careers-signals",
      competitorsProcessed,
      signalsPromoted,
      signalsDuplicate,
      diffsSuppressed,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({ monitorSlug: "promote-careers-signals", status: "ok" });
    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "promote-careers-signals",
      competitorsProcessed,
      signalsPromoted,
      signalsDuplicate,
      diffsSuppressed,
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "promote-careers-signals", status: "error" });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("promote-careers-signals", handler);
