import "../lib/sentry";
import { withSentry } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handler(req: any, res: any) {
  const checkInId = crypto.randomUUID();
  const startedAt = Date.now();

  Sentry.captureCheckIn({
    monitorSlug: "interpret-signals",
    status: "in_progress",
    checkInId,
  });

  try {
    const batchSize = 5;

    // 1. Reset stuck signals
    const { data: resetCount, error: resetError } = await supabase.rpc(
      "reset_stuck_signals",
      { stale_minutes: 30 }
    );

    if (resetError) {
      throw resetError;
    }

    // 2. Fail exhausted signals
    const { data: failedCount, error: failError } = await supabase.rpc(
      "fail_exhausted_signals",
      { max_retries: 5 }
    );

    if (failError) {
      throw failError;
    }

    // 3. Atomically claim pending signals
    const { data: claimedSignals, error: claimError } = await supabase.rpc(
      "claim_pending_signals",
      { batch_size: batchSize }
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
        // Placeholder interpretation logic for now
        const summary = `Placeholder summary for signal ${signal.id}`;
        const strategicImplication = "Placeholder strategic implication";
        const recommendedAction = "Placeholder recommended action";
        const confidence = 0.7;
        const urgency = 2;

        // 4. Write interpretation row
        const { error: insertError } = await supabase
          .from("interpretations")
          .insert({
            signal_id: signal.id,
            model_used: "gpt-4o-mini",
            prompt_hash: "placeholder",
            change_type: signal.signal_type,
            summary,
            strategic_implication: strategicImplication,
            recommended_action: recommendedAction,
            urgency,
            confidence,
            old_content: null,
            new_content: null,
          });

        if (insertError) {
          throw insertError;
        }

        // 5. Mark signal interpreted
        const { error: updateError } = await supabase
          .from("signals")
          .update({
            interpreted: true,
            interpreted_at: new Date().toISOString(),
            status: "interpreted",
          })
          .eq("id", signal.id);

        if (updateError) {
          throw updateError;
        }

        rowsSucceeded += 1;
      } catch (error: any) {
        rowsFailed += 1;

        // Return signal back to pending with retry increment
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
      checkInId,
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
      runtimeDurationMs,S
    });
  } catch (error) {
    Sentry.captureException(error);

    Sentry.captureCheckIn({
      monitorSlug: "interpret-signals",
      status: "error",
      checkInId,
    });

    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("interpret-signals", handler);