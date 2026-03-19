/** A single historical position snapshot for trail rendering. */
export type TrailPoint = {
  x: number;         // SVG user units [0, 1000]
  y: number;         // SVG user units [0, 1000]
  timestamp: string; // ISO 8601 — newest first
};

export type RadarCompetitor = {
  competitor_id: string;
  competitor_name: string;
  website_url: string | null;
  signals_7d: number;
  signals_pending: number;
  weighted_velocity_7d: number;
  last_signal_at: string | null;
  pressure_index: number;
  latest_movement_type: string | null;
  latest_movement_confidence: number | null;
  latest_movement_signal_count: number | null;
  latest_movement_velocity: number | null;
  latest_movement_first_seen_at: string | null;
  latest_movement_last_seen_at: string | null;
  latest_movement_summary: string | null;
  latest_signal_type: string | null;
  momentum_score: number;
  radar_narrative: string | null;
  radar_narrative_signal_count: number | null;
  /** 'fallback' when generated from a single signal with no movement; null otherwise. */
  radar_narrative_generation_reason: string | null;
  /** Interpretation summary for the most recent signal — only present when signals_7d > 0 and no movement. */
  latest_interpretation_summary: string | null;
  /** Up to 7 historical SVG positions, newest first. Empty array until trail records accumulate. */
  trail: TrailPoint[];
};

type RadarFeedResponse = {
  ok: boolean;
  job: string;
  rowsReturned: number;
  runtimeDurationMs: number;
  data: RadarCompetitor[];
};

export type CompetitorSignal = {
  id: string;
  signal_type: string;
  severity: string;
  detected_at: string;
  page_type: string;
  summary: string | null;
  strategic_implication: string | null;
  recommended_action: string | null;
  urgency: number | null;
  confidence: number | null;
  previous_excerpt: string | null;
  current_excerpt: string | null;
};

export type CompetitorMovement = {
  movement_type: string;
  confidence: number;
  signal_count: number;
  velocity: number;
  first_seen_at: string | null;
  last_seen_at: string | null;
};

export type MonitoredPage = {
  page_type: string;
};

export type CompetitorContext = {
  hypothesis:            string | null;
  confidence_level:      string;
  strategic_arc:         string | null;
  signal_count:          number;
  last_updated_at:       string | null;
  previous_hypothesis:   string | null;
  hypothesis_changed_at: string | null;
};

export type CompetitorDetail = {
  competitor: { id: string; name: string; website_url: string | null };
  movements: CompetitorMovement[];
  signals: CompetitorSignal[];
  monitoredPages: MonitoredPage[];
  context?: CompetitorContext | null;
};

export async function getRadarFeed(limit = 24, orgId?: string): Promise<RadarCompetitor[]> {
  const baseUrl =
    process.env.RADAR_API_BASE_URL ?? "https://metrivant-runtime.vercel.app";

  const secret = process.env.CRON_SECRET;
  const headers: Record<string, string> = {};
  if (secret) {
    headers["Authorization"] = `Bearer ${secret}`;
  }

  const params = new URLSearchParams({ limit: String(limit) });
  if (orgId) params.set("org_id", orgId);

  const res = await fetch(baseUrl + "/api/radar-feed?" + params.toString(), {
    cache: "no-store",
    headers,
  });

  if (!res.ok) {
    throw new Error("Failed to fetch radar feed: " + res.status);
  }

  const json: RadarFeedResponse = await res.json();

  if (!json.ok || !Array.isArray(json.data)) {
    throw new Error("Invalid radar feed response");
  }

  return json.data;
}

export async function getCompetitorDetail(
  competitorId: string
): Promise<CompetitorDetail | null> {
  const baseUrl =
    process.env.RADAR_API_BASE_URL ?? "https://metrivant-runtime.vercel.app";

  const secret = process.env.CRON_SECRET;
  const headers: Record<string, string> = {};
  if (secret) {
    headers["Authorization"] = `Bearer ${secret}`;
  }

  const res = await fetch(
    baseUrl + `/api/competitor-detail?id=${encodeURIComponent(competitorId)}`,
    { cache: "no-store", headers }
  );

  if (!res.ok) return null;

  return res.json() as Promise<CompetitorDetail>;
}