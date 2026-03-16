import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { openai } from "../lib/openai";
import { verifyCronSecret } from "../lib/withCronAuth";
import { createHash } from "crypto";
import { recordEvent, startTimer, generateRunId } from "../lib/pipeline-metrics";

const BATCH_SIZE        = 15;  // raised from 5 — gpt-4o-mini cost is negligible; bottleneck was artificial
const CONCURRENCY       = 4;   // parallel OpenAI calls — keeps total runtime ~8-10s for 15 signals
const WALL_CLOCK_GUARD_MS = 25_000; // stop claiming new work past this elapsed time (Vercel ceiling = 30s)
// Stuck-signal reset window — how long a signal can sit in 'in_progress' before
// being released back to 'pending' for retry.
//
// Design rationale: signal selection is gated on status='pending' and retry_count < MAX_RETRIES,
// NOT on age. A signal created at T+29 min is as valid as one created at T+1 min.
// A narrow time window (previously 30 min) combined with cron jitter silently discarded
// valid signals: detect-signals ran at T-1, interpret-signals ran at T+28, signals
// were already >30 min old and permanently stuck as 'in_progress' with no retry.
// The correct invariant is: if status='pending' and retry_count < MAX_RETRIES, process it.
// The only guard needed is a wide sanity ceiling to prevent reprocessing ancient data.
const STALE_MINUTES = 24 * 60; // 1440 min — release in_progress claims older than 24h
const MAX_RETRIES = 5;
const MODEL_USED = "gpt-4o-mini";
const PROMPT_VERSION = "v1";

// Bump PROMPT_VERSION whenever this template changes to invalidate cached interpretations.
const SYSTEM_PROMPT = `You are a competitive intelligence analyst. A competitor has changed content on their website. Analyze the change and return a JSON object with exactly these fields:
- summary: 1-2 sentence factual description of what changed
- strategic_implication: 1-2 sentence analysis of competitive significance
- recommended_action: 1 sentence describing the recommended response
- urgency: integer 1-5 (1=monitor quietly, 5=immediate action required)
- confidence: float 0.0-1.0 representing your confidence in this interpretation

Return only valid JSON. No prose, no markdown, no extra fields.`;

interface SignalData {
  previous_excerpt?: string;
  current_excerpt?: string;
}

interface SignalDetail {
  id: string;
  signal_type: string;
  signal_data: SignalData | null;
  severity: string;
  monitored_page_id: string;
  retry_count: number;
  competitor_name: string;
  page_type: string;
  page_url: string;
}

interface SignalWithJoins {
  id: string;
  signal_type: string;
  signal_data: SignalData | null;
  severity: string;
  monitored_page_id: string;
  retry_count: number;
  monitored_pages: {
    page_type: string;
    url: string;
    competitors: { name: string } | null;
  } | null;
}

interface InterpretationResult {
  summary: string;
  strategic_implication: string;
  recommended_action: string;
  urgency: number;
  confidence: number;
}

function buildUserPrompt(signal: SignalDetail): string {
  const prev = signal.signal_data?.previous_excerpt ?? "(no previous content available)";
  const curr = signal.signal_data?.current_excerpt ?? "(no current content available)";
  return [
    `Competitor: ${signal.competitor_name}`,
    `Signal type: ${signal.signal_type}`,
    `Severity: ${signal.severity}`,
    `Page type: ${signal.page_type}`,
    `Page URL: ${signal.page_url}`,
    ``,
    `Previous content (excerpt):`,
    prev,
    ``,
    `Current content (excerpt):`,
    curr,
  ].join("\n");
}

function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex").slice(0, 16);
}

interface OpenAICallResult {
  result: InterpretationResult;
  promptTokens?: number;
  completionTokens?: number;
}

async function callOpenAI(userPrompt: string): Promise<OpenAICallResult> {
  const response = await openai.chat.completions.create({
    model: MODEL_USED,
    temperature: 0,
    seed: 42,
    max_tokens: 512,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty content");
  }

  const parsed = JSON.parse(content) as InterpretationResult;

  if (
    typeof parsed.summary !== "string" ||
    typeof parsed.strategic_implication !== "string" ||
    typeof parsed.recommended_action !== "string" ||
    typeof parsed.urgency !== "number" ||
    typeof parsed.confidence !== "number"
  ) {
    throw new Error("OpenAI response missing required fields: " + content);
  }

  if (!parsed.summary.trim() || !parsed.strategic_implication.trim()) {
    throw new Error("OpenAI response has empty summary or strategic_implication: " + content);
  }

  return {
    result: {
      summary: parsed.summary,
      strategic_implication: parsed.strategic_implication,
      recommended_action: parsed.recommended_action,
      urgency: Math.round(Math.min(5, Math.max(1, parsed.urgency))),
      confidence: Math.min(1, Math.max(0, parsed.confidence)),
    },
    promptTokens:     response.usage?.prompt_tokens,
    completionTokens: response.usage?.completion_tokens,
  };
}

// Minimal semaphore for bounded concurrent OpenAI calls.
function createSemaphore(max: number) {
  let running = 0;
  const queue: Array<() => void> = [];
  return function acquire<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        running++;
        fn().then(
          (v) => { running--; if (queue.length) queue.shift()!(); resolve(v); },
          (e) => { running--; if (queue.length) queue.shift()!(); reject(e); }
        );
      };
      if (running < max) run(); else queue.push(run);
    });
  };
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();
  const runId = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();

  Sentry.captureCheckIn({
    monitorSlug: "interpret-signals",
    status: "in_progress",
  });

  try {
    const { data: resetCount, error: resetError } = await supabase.rpc(
      "reset_stuck_signals",
      { stale_minutes: STALE_MINUTES }
    );

    if (resetError) throw resetError;

    const { data: failedCount, error: failError } = await supabase.rpc(
      "fail_exhausted_signals",
      { max_retries: MAX_RETRIES }
    );

    if (failError) throw failError;

    // Re-queue signals whose stored interpretation used an older prompt version.
    // Bounded to 20 per cycle to prevent bulk reprocessing spikes.
    // Non-fatal: a failure here does not block normal interpretation.
    let staleResetCount = 0;
    const { data: staleRows, error: staleQueryError } = await supabase
      .from("interpretations")
      .select("signal_id")
      .neq("prompt_version", PROMPT_VERSION)
      .limit(20);

    if (staleQueryError) {
      Sentry.captureException(staleQueryError);
    } else if (staleRows && staleRows.length > 0) {
      const staleIds = (staleRows as Array<{ signal_id: string }>).map(
        (r) => r.signal_id
      );
      const { error: staleResetError } = await supabase
        .from("signals")
        .update({ status: "pending", interpreted: false, last_error: null })
        .in("id", staleIds)
        .eq("status", "interpreted");

      if (staleResetError) {
        Sentry.captureException(staleResetError);
      } else {
        staleResetCount = staleIds.length;
        Sentry.addBreadcrumb({
          category: "pipeline",
          message: "Reset stale-version signals for re-interpretation",
          level: "info",
          data: { staleResetCount, current_version: PROMPT_VERSION },
        });
      }
    }

    const { data: claimedSignals, error: claimError } = await supabase.rpc(
      "claim_pending_signals",
      { batch_size: BATCH_SIZE }
    );

    if (claimError) throw claimError;

    const rowsClaimed = claimedSignals?.length ?? 0;
    let rowsProcessed = 0;
    let rowsSucceeded = 0;
    let rowsFailed = 0;

    Sentry.addBreadcrumb({
      category: "pipeline",
      message: "Claimed signals for interpretation",
      level: "info",
      data: { rowsClaimed, resetCount, failedCount, staleResetCount },
    });

    if (rowsClaimed > 0) {
      // Fetch full signal details + competitor name for the claimed batch.
      // The claim RPC returns minimal fields; this join supplies what the prompt needs.
      const signalIds = (claimedSignals as Array<{ id: string }>).map((s) => s.id);

      const { data: detailRows, error: detailError } = await supabase
        .from("signals")
        .select(
          `id, signal_type, signal_data, severity, monitored_page_id, retry_count,
           monitored_pages!inner ( page_type, url, competitors!inner ( name ) )`
        )
        .in("id", signalIds);

      if (detailError) throw detailError;

      const detailMap = new Map<string, SignalDetail>();
      for (const row of (detailRows ?? []) as SignalWithJoins[]) {
        detailMap.set(row.id, {
          id: row.id,
          signal_type: row.signal_type,
          signal_data: row.signal_data ?? null,
          severity: row.severity ?? "low",
          monitored_page_id: row.monitored_page_id,
          retry_count: row.retry_count ?? 0,
          competitor_name: row.monitored_pages?.competitors?.name ?? "Unknown",
          page_type: row.monitored_pages?.page_type ?? "unknown",
          page_url: row.monitored_pages?.url ?? "",
        });
      }

      const sem = createSemaphore(CONCURRENCY);

      const signalResults = await Promise.allSettled(
        (claimedSignals as Array<{ id: string; signal_type?: string; retry_count?: number }>).map(
          (claimed) => sem(async () => {
            const elapsed = startTimer();
            const signal: SignalDetail = detailMap.get(claimed.id) ?? {
              id: claimed.id,
              signal_type: claimed.signal_type ?? "content_change",
              signal_data: null,
              severity: "low",
              monitored_page_id: "",
              retry_count: claimed.retry_count ?? 0,
              competitor_name: "Unknown",
              page_type: "unknown",
              page_url: "",
            };

            // Wall-clock guard: stop launching OpenAI calls near the Vercel ceiling.
            // Signals not started here stay in_progress and will be reset on the
            // next run by reset_stuck_signals — no data loss.
            if (Date.now() - startedAt > WALL_CLOCK_GUARD_MS) {
              throw new Error("wall_clock_guard: skipping to avoid Vercel timeout");
            }

            // Identical excerpts = noise that slipped through. Suppress without OpenAI.
            const prev = signal.signal_data?.previous_excerpt ?? "";
            const curr = signal.signal_data?.current_excerpt ?? "";
            if (prev && curr && prev === curr) {
              await supabase
                .from("signals")
                .update({ interpreted: true, interpreted_at: new Date().toISOString(), status: "interpreted" })
                .eq("id", signal.id);
              void recordEvent({ run_id: runId, stage: "interpret", status: "skipped", duration_ms: elapsed(), metadata: { model: MODEL_USED, signals_interpreted: 0 } });
              return { succeeded: true };
            }

            const userPrompt = buildUserPrompt(signal);
            const promptHash = hashPrompt(userPrompt);
            const { result: interpretation, promptTokens, completionTokens } = await callOpenAI(userPrompt);

            const { error: upsertError } = await supabase
              .from("interpretations")
              .upsert(
                {
                  signal_id:            signal.id,
                  model_used:           MODEL_USED,
                  prompt_version:       PROMPT_VERSION,
                  prompt_hash:          promptHash,
                  change_type:          signal.signal_type,
                  summary:              interpretation.summary,
                  strategic_implication: interpretation.strategic_implication,
                  recommended_action:   interpretation.recommended_action,
                  urgency:              interpretation.urgency,
                  confidence:           interpretation.confidence,
                  old_content:          signal.signal_data?.previous_excerpt ?? null,
                  new_content:          signal.signal_data?.current_excerpt ?? null,
                },
                { onConflict: "signal_id" }
              );

            if (upsertError) throw upsertError;

            // Guard with status='in_progress' so a late response from a prior worker
            // cannot overwrite a fresher state.
            const { error: updateError } = await supabase
              .from("signals")
              .update({
                interpreted:     true,
                interpreted_at:  new Date().toISOString(),
                status:          "interpreted",
                last_error:      null,
              })
              .eq("id", signal.id)
              .eq("status", "in_progress");

            if (updateError) throw updateError;

            void recordEvent({ run_id: runId, stage: "interpret", status: "success", duration_ms: elapsed(), metadata: { model: MODEL_USED, prompt_tokens: promptTokens, completion_tokens: completionTokens, signals_interpreted: 1 } });
            return { succeeded: true };
          })
        )
      );

      for (let i = 0; i < signalResults.length; i++) {
        rowsProcessed += 1;
        const result = signalResults[i];
        const claimed = (claimedSignals as Array<{ id: string; retry_count?: number }>)[i];

        if (result.status === "fulfilled") {
          rowsSucceeded += 1;
        } else {
          rowsFailed += 1;
          const err = result.reason;
          const isWallClockGuard = err instanceof Error && err.message.startsWith("wall_clock_guard");

          if (!isWallClockGuard) {
            // Reset to pending only if we still own the in_progress slot.
            const signal = detailMap.get(claimed.id);
            const { error: retryError } = await supabase
              .from("signals")
              .update({
                status:      "pending",
                retry_count: (signal?.retry_count ?? claimed.retry_count ?? 0) + 1,
                last_error:  err instanceof Error ? err.message : String(err),
              })
              .eq("id", claimed.id)
              .eq("status", "in_progress");

            if (retryError) Sentry.captureException(retryError);
            Sentry.captureException(err);
            void recordEvent({ run_id: runId, stage: "interpret", status: "failure", metadata: { model: MODEL_USED, signals_interpreted: 0 } });
          }
          // Wall-clock guard skips are silent — the signal stays in_progress and
          // reset_stuck_signals will requeue it on the next interpret-signals run.
        }
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name: "interpret-signals",
      batch_size: rowsClaimed,
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      resetCount,
      failedCount,
      staleResetCount,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({
      monitorSlug: "interpret-signals",
      status: "ok",
    });

    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "interpret-signals",
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      resetCount,
      failedCount,
      staleResetCount,
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);

    Sentry.captureCheckIn({
      monitorSlug: "interpret-signals",
      status: "error",
    });

    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("interpret-signals", handler);
