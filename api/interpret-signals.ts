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

    for (const signal of claimedSignals ?? []) {
      rowsProcessed += 1;

      try {
        const summary = `Placeholder summary for signal ${signal.id}`;
        const strategicImplication = `Placeholder implication`;
        const recommendedAction = `Placeholder action`;
        const confidence = 0.7;
        const urgency = 2;

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

        await supabase
          .from("signals")
          .update({
            status: "pending",
            retry_count: (signal.retry_count ?? 0) + 1,
            last_error: String(error?.message ?? error),
          })
          .eq("id", signal.id);

        Sentry.captureException(error);
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
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
      runtimeDurationMs,
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