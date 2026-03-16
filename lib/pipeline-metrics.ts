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
      (err: unknown) => { console.error("[pipeline-metrics] recordEvent failed:", err); }
    );
}
