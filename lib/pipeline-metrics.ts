import { randomUUID } from "crypto";
import { supabase } from "./supabase";

export type PipelineEvent = {
  run_id?: string;
  stage: string;
  status: "success" | "failure" | "skipped";
  monitored_page_id?: string;
  snapshot_id?: string;
  section_diff_id?: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
};

export function generateRunId(): string {
  return randomUUID();
}

export function startTimer(): () => number {
  const start = Date.now();
  return () => Date.now() - start;
}

/**
 * Serialize an error for pipeline_events metadata.
 * Handles Error instances, Supabase error objects, and unknown types.
 */
export function serializeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function recordEvent(event: PipelineEvent): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (supabase as any)
    .from("pipeline_events")
    .insert({
      run_id:            event.run_id            ?? null,
      stage:             event.stage,
      status:            event.status,
      monitored_page_id: event.monitored_page_id ?? null,
      snapshot_id:       event.snapshot_id       ?? null,
      section_diff_id:   event.section_diff_id   ?? null,
      duration_ms:       event.duration_ms        ?? null,
      metadata:          event.metadata           ?? {},
    })
    .then(
      () => { /* best-effort — success is silent */ },
      (err: unknown) => {
        console.error("[pipeline-metrics] recordEvent failed:", err);
        try {
          // Dynamic require avoids circular import (many files import both pipeline-metrics and sentry)
          const { Sentry } = require("./sentry") as { Sentry: { captureMessage: (msg: string, opts: unknown) => void } };
          Sentry.captureMessage("pipeline_event_insert_failed", {
            level: "warning",
            extra: { stage: event.stage, error: err instanceof Error ? err.message : String(err) },
          });
        } catch { /* Sentry itself failed — console.error above is the fallback */ }
      }
    );
}
