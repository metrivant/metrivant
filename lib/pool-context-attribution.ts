// lib/pool-context-attribution.ts
//
// Attributes recently promoted pool_events directly to competitor_contexts.
// Designed to run at :50 each hour, after all pool promotion jobs (:12–:46).
//
// Purpose: competitor_contexts should update within minutes of a high-value
// pool event (acquisition, capital raise, major contract, product launch,
// regulatory disclosure) — not hours later when interpret-signals batches it.
//
// The existing interpret-signals path has two limitations this bypasses:
//   1. interpret-signals runs once at :28 — pool events promoted after that
//      wait up to 70 minutes.
//   2. classifySignalRelevance was designed for page-diff content. Pool events
//      can be mis-classified as low relevance, skipping updateCompetitorContext
//      entirely.
//
// This job runs in parallel with interpret-signals. Minor duplication in the
// evidence_trail is acceptable — the LLM synthesises gracefully, and the
// 20-item rolling window caps trail length.

import { supabase } from "./supabase";
import {
  getCompetitorContext,
} from "./competitor-context";
import { updateCompetitorContext } from "./context-updater";

// ── High-value event type gates ────────────────────────────────────────────────
// Only attribute event subtypes that are unambiguously significant.
// General newsroom posts and low-signal careers events flow through
// interpret-signals on their normal cadence.

const HIGH_VALUE_INVESTOR = new Set([
  "acquisition",
  "capital_raise",
  "strategic_investment",
  "major_contract",
  "partnership",
  "divestiture",
  "investor_presentation",
]);

const HIGH_VALUE_PRODUCT = new Set([
  "major_release",
  "feature_update",
  "api_change",
  "integration_release",
  "deprecation",
]);

const HIGH_VALUE_PROCUREMENT = new Set([
  "major_contract_award",
  "framework_award",
  "program_award",
  "tender_selection",
  "supplier_selection",
]);

const HIGH_VALUE_REGULATORY = new Set([
  "material_event",
  "acquisition_disclosure",
  "major_contract_disclosure",
  "product_approval",
  "executive_change",
  "financial_disclosure",
]);

// Newsroom press releases are always included — they're first-party announcements.
// Include only when there is enough content to be meaningful.
const PRESS_RELEASE_MIN_CHARS = 40;

// ── Pool event row shape (columns we select) ──────────────────────────────────

interface PoolEventRow {
  competitor_id:          string;
  event_type:             string;
  title:                  string;
  summary:                string | null;
  published_at:           string | null;
  investor_event_type:    string | null;
  product_event_type:     string | null;
  procurement_event_type: string | null;
  regulatory_event_type:  string | null;
}

// ── Evidence filtering ─────────────────────────────────────────────────────────

function isHighValue(event: PoolEventRow): boolean {
  switch (event.event_type) {
    case "press_release":
      // Include substantive press releases — title + summary together must have enough content.
      return (event.title.length + (event.summary?.length ?? 0)) >= PRESS_RELEASE_MIN_CHARS;

    case "newsroom_post":
      return false; // Lower signal — let interpret-signals handle these

    case "investor_update":
      return event.investor_event_type != null && HIGH_VALUE_INVESTOR.has(event.investor_event_type);

    case "product_release":
      return event.product_event_type != null && HIGH_VALUE_PRODUCT.has(event.product_event_type);

    case "procurement_event":
      return event.procurement_event_type != null && HIGH_VALUE_PROCUREMENT.has(event.procurement_event_type);

    case "regulatory_filing":
      return event.regulatory_event_type != null && HIGH_VALUE_REGULATORY.has(event.regulatory_event_type);

    default:
      return false;
  }
}

function toSignalType(event: PoolEventRow): string {
  const subtype =
    event.investor_event_type ??
    event.product_event_type ??
    event.procurement_event_type ??
    event.regulatory_event_type;
  if (subtype) return subtype;
  if (event.event_type === "press_release") return "feed_press_release";
  return "content_change";
}

function toSummary(event: PoolEventRow): string {
  return [event.title, event.summary]
    .filter(Boolean)
    .join(". ")
    .slice(0, 280);
}

// ── Main attribution function ──────────────────────────────────────────────────

const MAX_COMPETITORS_PER_RUN = 20;
const LOOKBACK_HOURS          = 2;

export async function attributePoolEventsToContexts(
  openaiKey: string
): Promise<{ competitorsUpdated: number; eventsAttributed: number; errors: number }> {
  const cutoff = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

  // 1 — Fetch promoted high-value pool events from the lookback window
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: eventRows, error: eventsError } = await (supabase as any)
    .from("pool_events")
    .select(
      "competitor_id, event_type, title, summary, published_at, " +
      "investor_event_type, product_event_type, procurement_event_type, regulatory_event_type"
    )
    .eq("normalization_status", "promoted")
    .in("event_type", [
      "press_release",
      "investor_update",
      "product_release",
      "procurement_event",
      "regulatory_filing",
    ])
    .gte("published_at", cutoff)
    .order("published_at", { ascending: true });

  if (eventsError || !eventRows) return { competitorsUpdated: 0, eventsAttributed: 0, errors: 0 };

  // 2 — Filter to high-value events only, then group by competitor_id
  const eventsByCompetitor = new Map<string, PoolEventRow[]>();
  for (const e of (eventRows as PoolEventRow[])) {
    if (!isHighValue(e)) continue;
    const arr = eventsByCompetitor.get(e.competitor_id) ?? [];
    arr.push(e);
    eventsByCompetitor.set(e.competitor_id, arr);
  }

  if (eventsByCompetitor.size === 0) {
    return { competitorsUpdated: 0, eventsAttributed: 0, errors: 0 };
  }

  // 3 — Resolve competitor names
  const competitorIds = [...eventsByCompetitor.keys()].slice(0, MAX_COMPETITORS_PER_RUN);
  const { data: compRows } = await supabase
    .from("competitors")
    .select("id, name")
    .in("id", competitorIds);
  const nameById = new Map<string, string>(
    ((compRows ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name])
  );

  // 4 — Attribute events to contexts
  let competitorsUpdated = 0;
  let eventsAttributed   = 0;
  let errors             = 0;

  for (const competitorId of competitorIds) {
    try {
      const events = eventsByCompetitor.get(competitorId) ?? [];
      if (events.length === 0) continue;

      const competitorName = nameById.get(competitorId);
      if (!competitorName) continue;

      const existing = await getCompetitorContext(competitorId);

      const newEvidence = events.map((e) => ({
        signal_type:           toSignalType(e),
        summary:               toSummary(e),
        strategic_implication: null,
        detected_at:           e.published_at ?? new Date().toISOString(),
      }));

      // Pass orgId="" — context-updater resolves it via tracked_competitors lookup
      await updateCompetitorContext(
        existing,
        competitorId,
        "",           // resolved internally
        competitorName,
        newEvidence
      );

      competitorsUpdated++;
      eventsAttributed += events.length;
    } catch {
      errors++;
    }
  }

  return { competitorsUpdated, eventsAttributed, errors };
}
