// lib/competitor-context.ts
// Reads and updates the competitor_contexts table.
// Called by interpret-signals: read before OpenAI call, update after batch.

import { supabase } from "./supabase";

export type ContextEvidenceItem = {
  date: string;          // ISO date string
  signal_type: string;
  summary: string;
  verdict: "validates" | "contradicts" | "neutral";
};

export type CompetitorContext = {
  id?: string;
  competitor_id: string;
  org_id: string;
  competitor_name: string;
  hypothesis: string | null;
  confidence_level: "low" | "medium" | "high";
  evidence_trail: ContextEvidenceItem[];
  open_questions: string[];
  strategic_arc: string | null;
  signal_count: number;
  last_updated_at: string;
  previous_hypothesis:         string | null;
  hypothesis_changed_at:       string | null;
  hypothesis_shift_alerted_at: string | null;
};

export async function getCompetitorContext(
  competitorId: string
): Promise<CompetitorContext | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("competitor_contexts")
    .select("*")
    .eq("competitor_id", competitorId)
    .single();
  if (error || !data) return null;
  return data as CompetitorContext;
}

export function formatContextForPrompt(ctx: CompetitorContext): string {
  const lines: string[] = [
    `=== STRATEGIC CONTEXT: ${ctx.competitor_name} ===`,
  ];
  if (ctx.hypothesis) {
    lines.push(`Hypothesis (${ctx.confidence_level} confidence): ${ctx.hypothesis}`);
  }
  if (ctx.evidence_trail.length > 0) {
    lines.push("Recent evidence:");
    // Last 5 evidence items only — avoid context bloat
    ctx.evidence_trail.slice(-5).forEach((e) => {
      lines.push(`  [${e.date}] ${e.signal_type}: ${e.summary} → ${e.verdict}`);
    });
  }
  if (ctx.open_questions.length > 0) {
    lines.push(`Open questions: ${ctx.open_questions.slice(0, 2).join(" | ")}`);
  }
  if (ctx.strategic_arc) {
    lines.push(`Strategic arc: ${ctx.strategic_arc}`);
  }
  lines.push("=== END CONTEXT ===");
  return lines.join("\n");
}

export async function upsertCompetitorContext(
  ctx: Omit<CompetitorContext, "id" | "last_updated_at">
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("competitor_contexts").upsert(
    {
      ...ctx,
      last_updated_at: new Date().toISOString(),
    },
    { onConflict: "competitor_id" }
  );
}
