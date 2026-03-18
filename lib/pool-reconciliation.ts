// Cross-pool signal reconciliation.
// Finds signals created in the last 72h from pool sources (source_type='feed_event')
// where the same competitor has 2+ signals across different pool types within 24h.
// Boosts confidence on lower-confidence signals: +0.08 per corroborating pool.

import { supabase } from "./supabase";

type PoolSignal = {
  id:               string;
  competitor_id:    string;
  signal_type:      string;
  confidence_score: number;
  detected_at:      string;
  source_type:      string | null;
};

export async function reconcilePoolSignals(): Promise<{
  checked: number;
  boosted: number;
}> {
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

  // Fetch recent pool-sourced signals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: signals, error } = await (supabase as any)
    .from("signals")
    .select("id, competitor_id, signal_type, confidence_score, detected_at, source_type")
    .eq("source_type", "feed_event")
    .gte("detected_at", since)
    .order("detected_at", { ascending: false })
    .limit(500);

  if (error || !signals || signals.length === 0) return { checked: 0, boosted: 0 };

  // Group by competitor_id
  const byCompetitor = new Map<string, PoolSignal[]>();
  for (const s of signals as PoolSignal[]) {
    const arr = byCompetitor.get(s.competitor_id) ?? [];
    arr.push(s);
    byCompetitor.set(s.competitor_id, arr);
  }

  let boosted = 0;

  for (const [, competitorSignals] of byCompetitor) {
    if (competitorSignals.length < 2) continue;

    // Check pairs within 24h window
    for (let i = 0; i < competitorSignals.length; i++) {
      const anchor     = competitorSignals[i];
      const anchorTime = new Date(anchor.detected_at).getTime();
      const corroborators: PoolSignal[] = [];

      for (let j = 0; j < competitorSignals.length; j++) {
        if (i === j) continue;
        const candidate = competitorSignals[j];
        // Different signal types (not duplicates) within 24h
        if (
          candidate.signal_type !== anchor.signal_type &&
          Math.abs(new Date(candidate.detected_at).getTime() - anchorTime) < 24 * 60 * 60 * 1000
        ) {
          corroborators.push(candidate);
        }
      }

      if (corroborators.length === 0) continue;

      // Boost anchor confidence
      const boost         = Math.min(0.20, corroborators.length * 0.08);
      const newConfidence = Math.min(1.0, anchor.confidence_score + boost);

      if (newConfidence > anchor.confidence_score + 0.001) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("signals")
          .update({ confidence_score: newConfidence })
          .eq("id", anchor.id);
        boosted++;
      }
    }
  }

  return { checked: (signals as PoolSignal[]).length, boosted };
}
