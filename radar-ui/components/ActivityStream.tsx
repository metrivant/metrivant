"use client";

/**
 * Activity Stream — Strategic Movement Feed
 *
 * Minimal chronological feed showing recent strategic movements across
 * all tracked competitors. Replaces forensic signal inspection with
 * actionable intelligence prioritization.
 *
 * Core concept: Show WHAT strategic movements are happening, not quality metrics.
 */

import { motion } from "framer-motion";
import { translateMovementType } from "../lib/sector-config";

export type ActivityEntry = {
  competitor_id: string;
  competitor_name: string;
  movement_type: string;
  movement_summary: string | null;
  confidence_level: string | null;
  last_seen_at: string;
  momentum_score: number | null;
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "1d";
  return `${days}d`;
}

function getMomentumIndicator(score: number | null): {
  symbol: string;
  color: string;
} {
  if (score === null || score < 1.5) {
    return { symbol: "·", color: "#475569" }; // slate-600
  }
  if (score >= 5) {
    return { symbol: "⚡", color: "#ef4444" }; // red - accelerating
  }
  if (score >= 3) {
    return { symbol: "↑", color: "#f59e0b" }; // amber - rising
  }
  return { symbol: "→", color: "#2EE6A6" }; // green - stable/active
}

function getConfidenceColor(level: string | null): string {
  switch (level) {
    case "high":
      return "#00B4FF"; // cyan
    case "medium":
      return "#f59e0b"; // amber
    case "low":
      return "#64748b"; // slate
    default:
      return "#475569"; // slate-600
  }
}

export default function ActivityStream({
  activities,
  sector,
  onSelectCompetitor,
}: {
  activities: ActivityEntry[];
  sector?: string | null;
  onSelectCompetitor?: (competitorId: string) => void;
}) {
  if (activities.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 text-center">
        <div className="mv-label mb-2" style={{ fontSize: 11, color: "rgba(100,116,139,0.5)" }}>
          ACTIVITY STREAM
        </div>
        <p className="mv-body text-xs text-slate-600">
          No strategic movements detected yet
        </p>
        <p className="mv-body mt-1 text-xs text-slate-700">
          Pipeline monitoring active
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="mv-label" style={{ fontSize: 11, color: "rgba(100,116,139,0.75)" }}>
          ACTIVITY STREAM
        </div>
        <div className="mv-micro text-slate-700">
          {activities.length} movement{activities.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* Activity list */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {activities.map((activity, idx) => {
          const momentum = getMomentumIndicator(activity.momentum_score);
          const confColor = getConfidenceColor(activity.confidence_level);
          const movementLabel = translateMovementType(activity.movement_type, sector);

          return (
            <motion.button
              key={activity.competitor_id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: idx * 0.04 }}
              onClick={() => onSelectCompetitor?.(activity.competitor_id)}
              className="group w-full rounded-lg border border-[#0d1020] bg-[#03030c] p-3 text-left transition-all hover:border-[#1a2540] hover:bg-[#05050f]"
            >
              {/* Competitor name + momentum indicator */}
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="mv-body min-w-0 flex-1 truncate text-sm font-medium text-slate-300 group-hover:text-slate-100">
                  {activity.competitor_name}
                </div>
                <div
                  className="mv-body shrink-0 text-base font-bold leading-none"
                  style={{ color: momentum.color }}
                >
                  {momentum.symbol}
                </div>
              </div>

              {/* Movement type */}
              <div className="mb-1.5 flex items-center gap-1.5">
                <div
                  className="h-1 w-1 shrink-0 rounded-full"
                  style={{
                    backgroundColor: confColor,
                    boxShadow: `0 0 4px ${confColor}60`,
                  }}
                />
                <div className="mv-body min-w-0 flex-1 truncate text-xs" style={{ color: confColor }}>
                  {movementLabel}
                </div>
              </div>

              {/* Summary (if available) */}
              {activity.movement_summary && (
                <p className="mv-body mb-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                  {activity.movement_summary}
                </p>
              )}

              {/* Timestamp */}
              <div className="mv-micro text-slate-700">
                {timeAgo(activity.last_seen_at)}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
