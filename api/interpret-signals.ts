import "../lib/sentry";
import { withSentry } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/db/supabase";

const BATCH_SIZE = 5;
const STALE_MINUTES = 30;
const MAX_RETRIES = 5;
const MODEL_USED = "gpt-4o-mini";

function buildPlaceholderInterpretation(signal: {
  id: string;
  signal_type: string;
}) {
  return {
    model_used: MODEL_USED,
    prompt_hash: "placeholder-v1",
    change_type: signal.signal_type,
    summary: "Placeholder summary for signal " + signal.id,
    strategic_implication: "Placeholder strategic implication",
    recommended_action: "Placeholder recommended action",
    urgency: 2,
    confidence: 0.7,
    old_content: null,
    new_content: null,
  };
}

async function handler(req: any, res: any) {
  const startedAt = Date.now();

  Sentry.captureCheckIn({
    monitorSlug: "interpret-signals",
    status: "in_progress",
  });

  try {
    const { data: resetCount, error: resetError } = await supabase.rpc(
      "reset_stuck_signals",
      { stale_minutes: STALE_MINUTES }
    );

    if (resetError) {
      throw resetError;
    }

    const { data: failedCount, error: failError } = await supabase.rpc(
      "fail_exhausted_signals",
      { max_retries: MAX_RETRIES }
    );

    if (failError) {
      throw failError;
    }

    const { data: claimedSignals, error: claimError } = await supabase.rpc(
      "claim_pending_signals",
      { batch_size: BATCH_SIZE }
    );

    if (claimError) {
      throw claimError;
    }

    const rowsClaimed = claimedSignals?.length ?? 0;
    let rowsProcessed = 0;
    let rowsSucceeded = 0;
    let rowsFailed = 0;

    Sentry.addBreadcrumb({
      category: "pipeline",
      message: "Claimed signals for interpretation",
      level: "info",
      data: {
        rowsClaimed,
        resetCount,
        failedCount,
      },
    });

    for (const signal of claimedSignals ?? []) {
      rowsProcessed += 1;

      try {
        const interpretation = buildPlaceholderInterpretation(signal);

        const { error: upsertError } = await supabase
          .from("interpretations")
          .upsert(
            {
              signal_id: signal.id,
              ...interpretation,
            },
            {
              onConflict: "signal_id",
            }
          );

        if (upsertError) {
          throw upsertError;
        }

        const { error: updateError } = await supabase
          .from("signals")
          .update({
            interpreted: true,
            interpreted_at: new Date().toISOString(),
            status: "interpreted",
            last_error: null,
          })
          .eq("id", signal.id);

        if (updateError) {
          throw updateError;
        }

        rowsSucceeded += 1;
      } catch (error: any) {
        rowsFailed += 1;

        const { error: retryError } = await supabase
          .from("signals")
          .update({
            status: "pending",
            retry_count: (signal.retry_count ?? 0) + 1,
            last_error: String(error?.message ?? error),
          })
          .eq("id", signal.id);

        if (retryError) {
          Sentry.captureException(retryError);
        }

        Sentry.captureException(error);
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      resetCount,
      failedCount,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({
      monitorSlug: "interpret-signals",
      status: "ok",
    });

    await Sentry.flush(2000);

    res.status(200).json({ok: true,
      job: "interpret-signals",
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      resetCount,
      failedCount,
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
