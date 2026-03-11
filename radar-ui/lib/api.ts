export type RadarCompetitor = {
  competitor_id: string;
  competitor_name: string;
  website_url: string | null;
  signals_7d: number;
  weighted_velocity_7d: number;
  last_signal_at: string | null;
  latest_movement_type: string | null;
  latest_movement_confidence: number | null;
  latest_movement_signal_count: number | null;
  latest_movement_velocity: number | null;
  latest_movement_first_seen_at: string | null;
  latest_movement_last_seen_at: string | null;
  latest_movement_summary: string | null;
  momentum_score: number;
};

type RadarFeedResponse = {
  ok: boolean;
  job: string;
  rowsReturned: number;
  runtimeDurationMs: number;
  data: RadarCompetitor[];
};

export async function getRadarFeed(limit = 24): Promise<RadarCompetitor[]> {
  const baseUrl =
    process.env.RADAR_API_BASE_URL ?? "https://metrivant-runtime.vercel.app";

  const res = await fetch(baseUrl + "/api/radar-feed?limit=" + limit, {
    cache: "no-store",
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