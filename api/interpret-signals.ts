import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { openai } from "../lib/openai";
import { verifyCronSecret } from "../lib/withCronAuth";
import { createHash } from "crypto";
import { recordEvent, startTimer, generateRunId } from "../lib/pipeline-metrics";
import { classifySignalRelevance, NoiseExample } from "../lib/signal-relevance";
import { getCompetitorContext, formatContextForPrompt } from "../lib/competitor-context";
import { updateCompetitorContext } from "../lib/context-updater";

const BATCH_SIZE          = 15;
const CONCURRENCY         = 4;
const WALL_CLOCK_GUARD_MS = 25_000;
const STALE_MINUTES       = 240; // 4h — aligns with health.ts STUCK_SIGNAL_MINUTES; was 1440 (24h) which let stuck signals block the pipeline for a full day
const MAX_RETRIES         = 12; // 12 × 30min cadence = 6h survival window for transient outages
const PROMPT_VERSION      = "v1";

// ── Model routing ──────────────────────────────────────────────────────────────
// gpt-4o for high-value page class or high-confidence signals
// gpt-4o-mini for all others
const MODEL_HIGH_VALUE = "gpt-4o";
const MODEL_DEFAULT    = "gpt-4o-mini";

function selectModel(pageClass: string, confidenceScore: number): string {
  if (pageClass === "high_value" || confidenceScore >= 0.75) return MODEL_HIGH_VALUE;
  return MODEL_DEFAULT;
}

const SYSTEM_PROMPT_BASE = `You are a competitive intelligence analyst. A competitor has changed content on their website. Analyze the change and return a JSON object with exactly these fields:
- summary: 1-2 sentence factual description of what changed
- strategic_implication: 1-2 sentence analysis of competitive significance
- recommended_action: 1 sentence describing the recommended response
- urgency: integer 1-5 (1=monitor quietly, 5=immediate action required)
- confidence: float 0.0-1.0 representing your confidence in this interpretation

Return only valid JSON. No prose, no markdown, no extra fields.`;

interface SignalData {
  previous_excerpt?: string;
  current_excerpt?:  string;
  pool_event_ids?:   string[];
  pattern_type?:     string;
  posting_count?:    number;
  normalized_value?: string;
}

interface SignalDetail {
  id:                string;
  signal_type:       string;
  signal_data:       SignalData | null;
  severity:          string;
  monitored_page_id: string;
  retry_count:       number;
  confidence_score:  number;
  competitor_id:     string;
  competitor_name:   string;
  page_type:         string;
  page_url:          string;
  page_class:        string;
}

interface SignalWithJoins {
  id:                string;
  signal_type:       string;
  signal_data:       SignalData | null;
  severity:          string;
  monitored_page_id: string;
  retry_count:       number;
  confidence_score:  number | null;
  // Direct competitor join via signals.competitor_id — primary source for pool-agnostic signals.
  // Populated for all signal source types including feed signals where monitored_page_id is null.
  direct_competitor: { id: string; name: string } | null;
  monitored_pages: {
    page_type:   string;
    url:         string;
    page_class:  string;
    competitors: { id: string; name: string } | null;
  } | null;
}

interface InterpretationResult {
  summary:               string;
  strategic_implication: string;
  recommended_action:    string;
  urgency:               number;
  confidence:            number;
}

interface OpenAICallResult {
  result:            InterpretationResult;
  promptTokens?:     number;
  completionTokens?: number;
}

// ── Feedback context ───────────────────────────────────────────────────────────
// Fetches recent operator feedback to calibrate the model toward org preferences.
// Best-effort — interpretation proceeds without it if the query fails.

async function buildFeedbackContext(): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: feedbackRows } = await (supabase as any)
      .from("signal_feedback")
      .select("verdict, signal_id")
      .in("verdict", ["signal", "noise"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (!feedbackRows || feedbackRows.length === 0) return "";

    const signalIds = (feedbackRows as { verdict: string; signal_id: string }[]).map(r => r.signal_id);

    const { data: interps } = await supabase
      .from("interpretations")
      .select("signal_id, summary")
      .in("signal_id", signalIds);

    if (!interps || interps.length === 0) return "";

    const summaryById = new Map(
      (interps as { signal_id: string; summary: string }[]).map(r => [r.signal_id, r.summary])
    );

    const noiseLines:  string[] = [];
    const signalLines: string[] = [];

    for (const row of feedbackRows as { verdict: string; signal_id: string }[]) {
      const summary = summaryById.get(row.signal_id);
      if (!summary) continue;
      if (row.verdict === "noise"   && noiseLines.length  < 3) noiseLines.push(`- "${summary.slice(0, 80)}"`);
      if (row.verdict === "signal"  && signalLines.length < 3) signalLines.push(`- "${summary.slice(0, 80)}"`);
    }

    if (noiseLines.length === 0 && signalLines.length === 0) return "";

    const lines: string[] = ["\n\nOperator feedback (calibrate your output accordingly):"];
    if (noiseLines.length  > 0) { lines.push("Previously marked as noise:");   lines.push(...noiseLines);  }
    if (signalLines.length > 0) { lines.push("Previously marked as valuable:"); lines.push(...signalLines); }

    return lines.join("\n");
  } catch {
    Sentry.captureMessage("interpret_feedback_context_failed", "warning");
    return "";
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

// ── Careers evidence enrichment ─────────────────────────────────────────────
// Fetches job posting details for careers signals that store pool_event_ids
// in signal_data.  Returns formatted evidence lines or empty string.
// Best-effort — interpretation proceeds with the summary alone on failure.

const MAX_CAREERS_EVIDENCE = 15;

async function fetchCareersEvidence(poolEventIds: string[]): Promise<string> {
  if (poolEventIds.length === 0) return "";
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows } = await (supabase as any)
      .from("pool_events")
      .select("title, department_normalized, location, employment_type")
      .in("id", poolEventIds.slice(0, MAX_CAREERS_EVIDENCE))
      .order("published_at", { ascending: false });

    if (!rows || rows.length === 0) return "";

    const lines: string[] = [];
    for (const r of rows as Array<{
      title: string;
      department_normalized: string | null;
      location: string | null;
      employment_type: string | null;
    }>) {
      const parts = [r.title];
      if (r.department_normalized) parts.push(r.department_normalized);
      if (r.location)              parts.push(r.location);
      if (r.employment_type)       parts.push(r.employment_type);
      lines.push(`- ${parts.join(" | ")}`);
    }

    return [
      ``,
      `Supporting job postings (${poolEventIds.length}${poolEventIds.length > MAX_CAREERS_EVIDENCE ? `, showing ${MAX_CAREERS_EVIDENCE}` : ""}):`,
      ...lines,
    ].join("\n");
  } catch {
    Sentry.captureMessage("interpret_careers_evidence_failed", "warning");
    return "";
  }
}

function buildUserPrompt(signal: SignalDetail, careersEvidence: string = ""): string {
  const prev = signal.signal_data?.previous_excerpt ?? "(no previous content available)";
  const curr = signal.signal_data?.current_excerpt  ?? "(no current content available)";
  const lines = [
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
  ];

  if (careersEvidence) lines.push(careersEvidence);

  return lines.join("\n");
}

function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex").slice(0, 16);
}

async function callOpenAI(
  userPrompt:   string,
  model:        string,
  systemPrompt: string
): Promise<OpenAICallResult> {
  const response = await openai.chat.completions.create({
    model,
    temperature:     0,
    seed:            42,
    max_tokens:      512,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned empty content");

  const parsed = JSON.parse(content) as InterpretationResult;

  if (
    typeof parsed.summary               !== "string" ||
    typeof parsed.strategic_implication !== "string" ||
    typeof parsed.recommended_action    !== "string" ||
    typeof parsed.urgency               !== "number" ||
    typeof parsed.confidence            !== "number"
  ) {
    throw new Error("OpenAI response missing required fields: " + content);
  }

  if (!parsed.summary.trim() || !parsed.strategic_implication.trim()) {
    throw new Error("OpenAI response has empty summary or strategic_implication: " + content);
  }

  // Quality guard: reject interpretations that are too short or generically useless.
  // These indicate the model returned a placeholder rather than a real analysis.
  const GENERIC_PATTERNS = [
    /^(the )?content (was |has been )?(updated|changed|modified)/i,
    /^(some |minor )?changes were (made|detected)/i,
    /^no significant changes/i,
    /^the page (was |has been )?updated/i,
  ];

  if (parsed.summary.length < 20) {
    throw new Error("Interpretation summary too short (" + parsed.summary.length + " chars): " + content);
  }

  if (GENERIC_PATTERNS.some((p) => p.test(parsed.summary))) {
    throw new Error("Interpretation summary is generic boilerplate: " + parsed.summary);
  }

  return {
    result: {
      summary:               parsed.summary,
      strategic_implication: parsed.strategic_implication,
      recommended_action:    parsed.recommended_action,
      urgency:               Math.round(Math.min(5, Math.max(1, parsed.urgency))),
      confidence:            Math.min(1, Math.max(0, parsed.confidence)),
    },
    promptTokens:     response.usage?.prompt_tokens,
    completionTokens: response.usage?.completion_tokens,
  };
}

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

// ── Handler ────────────────────────────────────────────────────────────────────

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();
  const runId     = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();

  const checkInId = Sentry.captureCheckIn({ monitorSlug: "interpret-signals", status: "in_progress" });

  try {
    const { data: resetCount,  error: resetError  } = await supabase.rpc("reset_stuck_signals",  { stale_minutes: STALE_MINUTES });
    if (resetError) throw resetError;

    const { data: failedCount, error: failError   } = await supabase.rpc("fail_exhausted_signals", { max_retries: MAX_RETRIES });
    if (failError) throw failError;

    // Re-queue stale-version interpretations
    let staleResetCount = 0;
    const { data: staleRows, error: staleQueryError } = await supabase
      .from("interpretations")
      .select("signal_id")
      .neq("prompt_version", PROMPT_VERSION)
      .limit(20);

    if (staleQueryError) {
      Sentry.captureException(staleQueryError);
    } else if (staleRows && staleRows.length > 0) {
      const staleIds = (staleRows as Array<{ signal_id: string }>).map(r => r.signal_id);
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
          message:  "Reset stale-version signals for re-interpretation",
          level:    "info",
          data:     { staleResetCount, current_version: PROMPT_VERSION },
        });
      }
    }

    const { data: claimedSignals, error: claimError } = await supabase.rpc(
      "claim_pending_signals",
      { batch_size: BATCH_SIZE }
    );
    if (claimError) throw claimError;

    const rowsClaimed  = claimedSignals?.length ?? 0;
    let rowsProcessed  = 0;
    let rowsSucceeded  = 0;
    let rowsFailed     = 0;
    let rowsSkippedLow = 0;

    Sentry.addBreadcrumb({
      category: "pipeline",
      message:  "Claimed signals for interpretation",
      level:    "info",
      data:     { rowsClaimed, resetCount, failedCount, staleResetCount },
    });

    if (rowsClaimed > 0) {
      const signalIds = (claimedSignals as Array<{ id: string }>).map(s => s.id);

      // Fetch full signal details — includes page_class for model routing.
      // Left joins (no !inner) so feed-sourced signals with null monitored_page_id
      // are included in detailRows.
      //
      // Competitor resolution order (pool-agnostic):
      //   1. direct_competitor (signals.competitor_id FK) — always populated for all pools
      //   2. monitored_pages → competitors               — fallback for page-diff signals
      //   3. "" / "Unknown"                              — only if both joins are null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: detailRows, error: detailError } = await (supabase as any)
        .from("signals")
        .select(
          `id, signal_type, signal_data, severity, monitored_page_id, retry_count, confidence_score,
           direct_competitor:competitors!signals_competitor_id_fkey ( id, name ),
           monitored_pages ( page_type, url, page_class, competitors ( id, name ) )`
        )
        .in("id", signalIds);

      if (detailError) throw detailError;

      const detailMap = new Map<string, SignalDetail>();
      for (const row of (detailRows ?? []) as SignalWithJoins[]) {
        detailMap.set(row.id, {
          id:                row.id,
          signal_type:       row.signal_type,
          signal_data:       row.signal_data ?? null,
          severity:          row.severity ?? "low",
          monitored_page_id: row.monitored_page_id,
          retry_count:       row.retry_count ?? 0,
          confidence_score:  row.confidence_score ?? 0.5,
          competitor_id:     row.direct_competitor?.id   ?? row.monitored_pages?.competitors?.id   ?? "",
          competitor_name:   row.direct_competitor?.name ?? row.monitored_pages?.competitors?.name ?? "Unknown",
          page_type:         row.monitored_pages?.page_type ?? "unknown",
          page_url:          row.monitored_pages?.url       ?? "",
          page_class:        row.monitored_pages?.page_class ?? "standard",
        });
      }

      // ── Pre-load operator-labeled noise examples for few-shot relevance classification ──
      // Loaded once before the parallel map — avoids N+1 per signal.
      // Graceful degradation: errors are silently ignored (classifier falls back to zero-shot).
      const noiseExamples: NoiseExample[] = [];
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: noiseFb } = await (supabase as any)
          .from("signal_feedback")
          .select("noise_category, signals!signal_id ( signal_data )")
          .eq("verdict", "noise")
          .not("noise_category", "is", null)
          .limit(5);

        for (const row of (noiseFb ?? []) as Array<{
          noise_category: string;
          signals: { signal_data: Record<string, string> | null } | null;
        }>) {
          if (row.noise_category && row.signals?.signal_data) {
            noiseExamples.push({
              noise_category:   row.noise_category,
              previous_excerpt: row.signals.signal_data.previous_excerpt ?? "",
              current_excerpt:  row.signals.signal_data.current_excerpt  ?? "",
            });
          }
        }
      }

      // ── Relevance classification — parallel, best-effort ──────────────────
      const relevanceMap = new Map<string, "high" | "medium" | "low">();

      const relevanceResults = await Promise.allSettled(
        signalIds.map(async (id) => {
          const signal = detailMap.get(id);
          if (!signal) return;

          const prev = signal.signal_data?.previous_excerpt ?? "";
          const curr = signal.signal_data?.current_excerpt  ?? "";

          const result = await classifySignalRelevance({
            competitor_name:  signal.competitor_name,
            section_type:     signal.page_type,
            page_class:       signal.page_class,
            signal_type:      signal.signal_type,
            previous_excerpt: prev,
            current_excerpt:  curr,
            noiseExamples:    noiseExamples.length > 0 ? noiseExamples : undefined,
          });

          relevanceMap.set(id, result.relevance_level);

          // Persist relevance to signals table (fire-and-forget, errors captured)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          void (supabase as any)
            .from("signals")
            .update({ relevance_level: result.relevance_level, relevance_rationale: result.rationale })
            .eq("id", id)
            .then(
              ({ error }: { error: unknown }) => { if (error) Sentry.captureException(error); },
              (err: unknown) => Sentry.captureException(err)
            );
        })
      );

      for (const r of relevanceResults) {
        if (r.status === "rejected") Sentry.captureException(r.reason);
      }

      // ── Feedback context — fetched once for the whole batch ───────────────
      const feedbackContext = await buildFeedbackContext();
      const systemPrompt    = SYSTEM_PROMPT_BASE + feedbackContext;

      // ── Per-signal interpretation loop ────────────────────────────────────
      const sem = createSemaphore(CONCURRENCY);

      // Circuit breaker: stop processing after consecutive AI failures to avoid
      // burning the entire batch on a dead OpenAI API.
      let consecutiveAiFailures = 0;
      const CIRCUIT_BREAK_THRESHOLD = 3;

      const signalResults = await Promise.allSettled(
        (claimedSignals as Array<{ id: string; signal_type?: string; retry_count?: number }>).map(
          (claimed) => sem(async () => {
            const elapsed  = startTimer();
            const signal: SignalDetail = detailMap.get(claimed.id) ?? {
              id:                claimed.id,
              signal_type:       claimed.signal_type ?? "content_change",
              signal_data:       null,
              severity:          "low",
              monitored_page_id: "",
              retry_count:       claimed.retry_count ?? 0,
              confidence_score:  0.5,
              competitor_id:     "",
              competitor_name:   "Unknown",
              page_type:         "unknown",
              page_url:          "",
              page_class:        "standard",
            };

            if (Date.now() - startedAt > WALL_CLOCK_GUARD_MS) {
              throw new Error("wall_clock_guard: skipping to avoid Vercel timeout");
            }

            // Circuit breaker: if 3+ consecutive AI calls failed, skip remaining
            if (consecutiveAiFailures >= CIRCUIT_BREAK_THRESHOLD) {
              throw new Error("circuit_breaker: consecutive AI failures, releasing signal");
            }

            // Identical excerpts = noise that slipped through
            const prev = signal.signal_data?.previous_excerpt ?? "";
            const curr = signal.signal_data?.current_excerpt  ?? "";
            if (prev && curr && prev === curr) {
              await supabase
                .from("signals")
                .update({ interpreted: true, interpreted_at: new Date().toISOString(), status: "interpreted" })
                .eq("id", signal.id);
              void recordEvent({ run_id: runId, stage: "interpret", status: "skipped", duration_ms: elapsed(), metadata: { model: MODEL_DEFAULT, signals_interpreted: 0 } });
              return { succeeded: true };
            }

            // ── Relevance gate ─────────────────────────────────────────────
            const relevance = relevanceMap.get(signal.id) ?? "medium";
            if (relevance === "low") {
              await supabase
                .from("signals")
                .update({ interpreted: true, interpreted_at: new Date().toISOString(), status: "interpreted" })
                .eq("id", signal.id)
                .eq("status", "in_progress");
              rowsSkippedLow++;
              void recordEvent({ run_id: runId, stage: "interpret", status: "skipped", duration_ms: elapsed(), metadata: { model: "none", reason: "low_relevance", signals_interpreted: 0 } });
              return { succeeded: true };
            }

            // ── Model routing ──────────────────────────────────────────────
            const modelUsed = selectModel(signal.page_class, signal.confidence_score);

            // ── Careers evidence enrichment (best-effort) ───────────────
            let careersEvidence = "";
            const poolEventIds = signal.signal_data?.pool_event_ids;
            if (poolEventIds && poolEventIds.length > 0) {
              careersEvidence = await fetchCareersEvidence(poolEventIds);
            }

            const userPrompt = buildUserPrompt(signal, careersEvidence);
            const promptHash = hashPrompt(userPrompt);

            // ── Competitor context (best-effort, non-blocking on failure) ──
            let competitorCtx = null;
            let signalSystemPrompt = systemPrompt;
            try {
              if (signal.competitor_id) {
                competitorCtx = await getCompetitorContext(signal.competitor_id);
                if (competitorCtx) {
                  signalSystemPrompt = formatContextForPrompt(competitorCtx) + "\n\n" + systemPrompt;
                }
              }
            } catch {
              // Context fetch failure must never block interpretation
              Sentry.captureMessage("interpret_context_fetch_failed", "warning");
            }

            const { result: interpretation, promptTokens, completionTokens } = await callOpenAI(
              userPrompt,
              modelUsed,
              signalSystemPrompt
            );

            const { error: upsertError } = await supabase
              .from("interpretations")
              .upsert(
                {
                  signal_id:             signal.id,
                  model_used:            modelUsed,
                  prompt_version:        PROMPT_VERSION,
                  prompt_hash:           promptHash,
                  change_type:           signal.signal_type,
                  summary:               interpretation.summary,
                  strategic_implication: interpretation.strategic_implication,
                  recommended_action:    interpretation.recommended_action,
                  urgency:               interpretation.urgency,
                  confidence:            interpretation.confidence,
                  old_content:           signal.signal_data?.previous_excerpt ?? null,
                  new_content:           signal.signal_data?.current_excerpt  ?? null,
                },
                { onConflict: "signal_id" }
              );

            if (upsertError) throw upsertError;

            const { error: updateError } = await supabase
              .from("signals")
              .update({
                interpreted:    true,
                interpreted_at: new Date().toISOString(),
                status:         "interpreted",
                last_error:     null,
              })
              .eq("id", signal.id)
              .eq("status", "in_progress");

            if (updateError) throw updateError;

            // ── Context update (fire-and-forget — must not block pipeline) ─
            void updateCompetitorContext(
              competitorCtx,
              signal.competitor_id,
              "",   // org_id resolved inside context-updater via tracked_competitors lookup
              signal.competitor_name,
              [{
                signal_type:           signal.signal_type,
                summary:               interpretation.summary,
                strategic_implication: interpretation.strategic_implication ?? null,
                detected_at:           new Date().toISOString(),
              }]
            ).catch(() => {});

            consecutiveAiFailures = 0; // reset circuit breaker on success
            void recordEvent({ run_id: runId, stage: "interpret", status: "success", duration_ms: elapsed(), metadata: { model: modelUsed, prompt_tokens: promptTokens, completion_tokens: completionTokens, signals_interpreted: 1 } });
            return { succeeded: true };
          })
        )
      );

      for (let i = 0; i < signalResults.length; i++) {
        rowsProcessed += 1;
        const result  = signalResults[i];
        const claimed = (claimedSignals as Array<{ id: string; retry_count?: number }>)[i];

        if (result.status === "fulfilled") {
          rowsSucceeded += 1;
        } else {
          rowsFailed += 1;
          const err              = result.reason;
          const isWallClockGuard  = err instanceof Error && err.message.startsWith("wall_clock_guard");
          const isCircuitBreaker = err instanceof Error && err.message.startsWith("circuit_breaker");

          if (isCircuitBreaker) {
            // Release back to pending without incrementing retry_count — transient, not structural
            await supabase
              .from("signals")
              .update({ status: "pending", last_error: "circuit_breaker_release" })
              .eq("id", claimed.id)
              .eq("status", "in_progress");
          } else if (!isWallClockGuard) {
            consecutiveAiFailures++;
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
            void recordEvent({ run_id: runId, stage: "interpret", status: "failure", metadata: { model: MODEL_DEFAULT, signals_interpreted: 0 } });
          }
        }
      }
    }

    // ── Low-relevance ratio warning ──────────────────────────────────────────
    // If >80% of claimed signals were skipped as low relevance, the classifier
    // may be miscalibrated or the input quality has degraded.
    if (rowsClaimed >= 5 && rowsSkippedLow / rowsClaimed > 0.80) {
      Sentry.captureMessage("high_low_relevance_ratio", {
        level: "warning",
        extra: {
          rowsClaimed,
          rowsSkippedLow,
          ratio: parseFloat((rowsSkippedLow / rowsClaimed).toFixed(2)),
        },
      });
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name:       "interpret-signals",
      batch_size:       rowsClaimed,
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      rowsSkippedLow,
      resetCount,
      failedCount,
      staleResetCount,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({ monitorSlug: "interpret-signals", status: "ok", checkInId });
    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "interpret-signals",
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      rowsSkippedLow,
      resetCount,
      failedCount,
      staleResetCount,
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "interpret-signals", status: "error", checkInId });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("interpret-signals", handler);
