"use client";

import { type RadarCompetitor } from "../lib/api";
import {
  getMomentumState,
  MOMENTUM_STATE_CONFIG,
  type MomentumState,
} from "../lib/momentum";

// ── Simple relative-time helper (no date-fns dependency) ─────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ── Freshness color for pipeline heartbeat ───────────────────────────────────

function freshnessColor(iso: string): string {
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (hours < 6) return "rgba(0,180,255,0.50)";
  if (hours < 24) return "rgba(245,158,11,0.40)";
  return "rgba(100,116,139,0.45)";
}

// ── Momentum badge colors ────────────────────────────────────────────────────

const MOMENTUM_COLORS: Record<MomentumState, string> = {
  cooling: "#64748b",
  stable: "#00B4FF",
  rising: "#f59e0b",
  accelerating: "#ef4444",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function MobileFeed({
  competitors,
}: {
  competitors: RadarCompetitor[];
}) {
  // Sort by most recent activity (last_signal_at DESC, nulls last)
  const sorted = [...competitors].sort((a, b) => {
    if (!a.last_signal_at && !b.last_signal_at) return 0;
    if (!a.last_signal_at) return 1;
    if (!b.last_signal_at) return -1;
    return (
      new Date(b.last_signal_at).getTime() -
      new Date(a.last_signal_at).getTime()
    );
  });

  // Stats
  const totalRivals = competitors.length;
  const activeCount = competitors.filter(
    (c) => c.momentum_score >= 1.5
  ).length;
  const totalSignals7d = competitors.reduce(
    (sum, c) => sum + c.signals_7d,
    0
  );

  // Pipeline heartbeat — latest signal_at across all competitors
  const latestSignalAt = competitors.reduce<string | null>((latest, c) => {
    if (!c.last_signal_at) return latest;
    if (!latest) return c.last_signal_at;
    return new Date(c.last_signal_at) > new Date(latest)
      ? c.last_signal_at
      : latest;
  }, null);

  // ── Empty state ──────────────────────────────────────────────────────────

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 pt-32 pb-[80px]">
        <p
          style={{
            fontFamily: "monospace",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: "rgba(0,180,255,0.55)",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Monitoring Active
        </p>
        <p style={{ fontSize: 14, color: "#64748b", textAlign: "center" }}>
          Pipeline running — first signals arriving shortly
        </p>
      </div>
    );
  }

  // ── Feed ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ width: "100%", paddingBottom: 80 }}>
      {/* Header strip */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "rgba(2,8,2,0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #0d1020",
          padding: "12px 16px",
        }}
      >
        <p
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.22em",
            color: "rgba(0,180,255,0.55)",
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          Intelligence Feed
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 6,
          }}
        >
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            {totalRivals} rivals · {activeCount} active · {totalSignals7d}{" "}
            signals 7d
          </span>

          {latestSignalAt && (
            <span
              style={{
                fontSize: 11,
                color: freshnessColor(latestSignalAt),
                fontFamily: "monospace",
              }}
            >
              Updated {timeAgo(latestSignalAt)}
            </span>
          )}
        </div>
      </div>

      {/* Cards */}
      <div style={{ padding: "8px 12px 0" }}>
        {sorted.map((c) => {
          const state = getMomentumState(c.momentum_score);
          const config = MOMENTUM_STATE_CONFIG[state];
          const accentColor = MOMENTUM_COLORS[state];

          return (
            <div
              key={c.competitor_id}
              style={{
                background: "#020208",
                border: "1px solid #0d1020",
                borderLeft: `3px solid ${accentColor}`,
                borderRadius: 8,
                padding: 16,
                marginBottom: 8,
                minHeight: 44,
              }}
            >
              {/* Row 1: name + momentum badge */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#fff",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {c.competitor_name}
                </span>

                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: accentColor,
                    background: config.bg,
                    padding: "2px 8px",
                    borderRadius: 9999,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {config.arrow} {config.label}
                </span>
              </div>

              {/* Movement type */}
              {c.latest_movement_type && (
                <p
                  style={{
                    fontSize: 12,
                    color: "#94a3b8",
                    margin: "6px 0 0",
                    textTransform: "capitalize",
                  }}
                >
                  {c.latest_movement_type.replace(/_/g, " ")}
                </p>
              )}

              {/* Movement summary — 2 lines max */}
              {c.latest_movement_summary && (
                <p
                  style={{
                    fontSize: 13,
                    color: "#cbd5e1",
                    margin: "4px 0 0",
                    lineHeight: 1.4,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {c.latest_movement_summary}
                </p>
              )}

              {/* Footer: signal count + last signal */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "#475569",
                    fontFamily: "monospace",
                  }}
                >
                  {c.signals_7d} signals · 7d
                </span>

                {c.last_signal_at && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "#475569",
                      fontFamily: "monospace",
                    }}
                  >
                    {timeAgo(c.last_signal_at)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
