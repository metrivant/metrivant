// Detects multi-pool activity sequences per competitor within a 14-day window.
// Writes results to activity_events (event_type='multi_pool_sequence').
// Non-destructive — only inserts, never modifies signals or pool_events.
//
// activity_events columns used:
//   competitor_id, event_type, source_headline, url, detected_at, page_class, raw_data

import { supabase } from "./supabase";

// ── Sequence definitions ───────────────────────────────────────────────────────

const SEQUENCES = [
  {
    name:        "hiring_build_plus_product_launch",
    poolTypes:   ["careers", "product"],
    description: "Hiring surge accompanied by product release — coordinated build-out signal",
    minEvents:   2,
  },
  {
    name:        "contract_win_plus_investor_announcement",
    poolTypes:   ["procurement", "investor"],
    description: "Contract award corroborated by investor announcement — major deal confirmed",
    minEvents:   2,
  },
  {
    name:        "regulatory_filing_plus_newsroom",
    poolTypes:   ["regulatory", "newsroom"],
    description: "Regulatory disclosure accompanied by press release — public-facing material event",
    minEvents:   2,
  },
  {
    name:        "full_campaign",
    poolTypes:   ["newsroom", "investor", "product"],
    description: "Simultaneous newsroom, investor, and product activity — coordinated launch campaign",
    minEvents:   3,
  },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

type PoolEvent = {
  id:            string;
  competitor_id: string;
  source_type:   string;
  event_type:    string;
  created_at:    string;
};

// ── Main export ────────────────────────────────────────────────────────────────

export async function detectPoolSequences(): Promise<{
  checked:        number;
  sequencesFound: number;
}> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: events, error } = await (supabase as any)
    .from("pool_events")
    .select("id, competitor_id, source_type, event_type, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error || !events || events.length === 0) return { checked: 0, sequencesFound: 0 };

  // Group pool_events by competitor
  const byCompetitor = new Map<string, PoolEvent[]>();
  for (const e of events as PoolEvent[]) {
    const arr = byCompetitor.get(e.competitor_id) ?? [];
    arr.push(e);
    byCompetitor.set(e.competitor_id, arr);
  }

  let sequencesFound = 0;

  for (const [competitorId, competitorEvents] of byCompetitor) {
    for (const seq of SEQUENCES) {
      // Check if competitor has events from all required pool types
      const presentPools = new Set(competitorEvents.map((e) => e.source_type));
      const allPresent   = seq.poolTypes.every((pt) => presentPools.has(pt));
      if (!allPresent) continue;

      // Check that we have the minimum number of matching events
      const matchingEvents = competitorEvents.filter((e) =>
        (seq.poolTypes as readonly string[]).includes(e.source_type)
      );
      if (matchingEvents.length < seq.minEvents) continue;

      // Dedup: skip if we already recorded this sequence for this competitor in the last 7 days
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dedupeCheck = await (supabase as any)
        .from("activity_events")
        .select("id")
        .eq("competitor_id", competitorId)
        .eq("event_type", "multi_pool_sequence")
        .gte("detected_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        // raw_data->>'sequence_name' filter via textSearch is not available; instead
        // we fetch and filter client-side for the rare case of multiple sequence types
        .limit(10);

      const existingForCompetitor = (
        (dedupeCheck.data ?? []) as Array<{ id: string }>
      );

      // We fetch up to 10 recent multi_pool_sequence events for this competitor and
      // check whether this specific sequence name has already been recorded.
      // For performance we accept a small over-fetch rather than a per-sequence DB call.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingFull = existingForCompetitor.length > 0
        ? await (supabase as any)
          .from("activity_events")
          .select("raw_data")
          .eq("competitor_id", competitorId)
          .eq("event_type", "multi_pool_sequence")
          .gte("detected_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .limit(10)
        : { data: [] };

      const alreadyRecorded = ((existingFull.data ?? []) as Array<{ raw_data: { sequence_name?: string } | null }>)
        .some((row) => row.raw_data?.sequence_name === seq.name);

      if (alreadyRecorded) continue;

      // Insert activity event — non-blocking
      void (supabase as any)
        .from("activity_events")
        .insert({
          competitor_id:   competitorId,
          event_type:      "multi_pool_sequence",
          source_headline: seq.description,
          url:             null,
          detected_at:     new Date().toISOString(),
          page_class:      "ambient",
          raw_data: {
            sequence_name: seq.name,
            pool_types:    seq.poolTypes,
            event_count:   matchingEvents.length,
            window_days:   14,
          },
        })
        .catch(() => {}); // non-blocking

      sequencesFound++;
    }
  }

  return { checked: (events as PoolEvent[]).length, sequencesFound };
}
