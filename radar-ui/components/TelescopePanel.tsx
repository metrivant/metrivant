"use client";

/**
 * TelescopePanel — Read-Only Signal Observatory
 *
 * Autonomous noise detection visibility — no user feedback required.
 * Shows recent signals with autonomous classification metadata:
 * - Noise filter hits (8 filters)
 * - Confidence calibration (baseline-adjusted)
 * - Retrograde status (hallucination feedback)
 */

import { useState, useEffect } from "react";
import { createClient } from "../lib/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TelescopeSignal = {
  id: string;
  signal_type: string;
  summary: string | null;
  confidence_score: number | null;
  detected_at: string;
  competitor_name: string;
  is_noise?: boolean;
  noise_reason?: string | null;
  retrograded_at?: string | null;
};

interface NoiseStats {
  total_diffs: number;
  noise_diffs: number;
  filter_breakdown: Record<string, number>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSignalType(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function confColor(conf: number | null): string {
  if (conf == null) return "rgba(100,116,139,0.60)";
  if (conf >= 0.65) return "rgba(0,180,255,0.80)";
  if (conf >= 0.40) return "rgba(245,158,11,0.70)";
  return "rgba(100,116,139,0.60)";
}

function confLabel(conf: number | null): string {
  if (conf == null) return "—";
  return (conf * 100).toFixed(0) + "%";
}

function noiseReasonLabel(reason: string): string {
  return reason.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function noiseReasonColor(reason: string): string {
  const colors: Record<string, string> = {
    whitespace_only: "rgba(100,116,139,0.55)",
    dynamic_content_only: "rgba(245,158,11,0.55)",
    oscillation: "rgba(168,85,247,0.55)",
    infrastructure: "rgba(59,130,246,0.55)",
    structural: "rgba(100,116,139,0.55)",
    churn: "rgba(239,68,68,0.55)",
    reversion: "rgba(168,85,247,0.55)",
    semantic_similarity: "rgba(245,158,11,0.55)",
  };
  return colors[reason] || "rgba(100,116,139,0.55)";
}

// ── Signal card ───────────────────────────────────────────────────────────────

function SignalCard({
  signal,
  isLast,
}: {
  signal: TelescopeSignal;
  isLast: boolean;
}) {
  const isNoise = signal.is_noise === true;
  const isRetrograded = signal.retrograded_at != null;

  return (
    <div
      style={{
        padding: "8px 10px 7px",
        borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.04)",
        opacity: isNoise ? 0.45 : 1,
      }}
    >
      {/* Row 1: competitor + time */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 4,
          marginBottom: 3,
        }}
      >
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 8.5,
            fontWeight: 600,
            color: "rgba(255,255,255,0.72)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {signal.competitor_name}
        </span>
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 7,
            color: "rgba(255,255,255,0.18)",
            flexShrink: 0,
          }}
        >
          {timeAgo(signal.detected_at)}
        </span>
      </div>

      {/* Row 2: signal type badge + confidence */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          marginBottom: signal.summary ? 3 : 0,
        }}
      >
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 7,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: isNoise ? "rgba(100,116,139,0.45)" : "rgba(0,180,255,0.65)",
            textTransform: "uppercase",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {formatSignalType(signal.signal_type)}
        </span>
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 7,
            fontWeight: 600,
            color: confColor(signal.confidence_score),
            flexShrink: 0,
          }}
        >
          {confLabel(signal.confidence_score)}
        </span>
      </div>

      {/* Row 3: summary */}
      {signal.summary && (
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 7.5,
            lineHeight: "1.4",
            color: "rgba(255,255,255,0.30)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            marginBottom: 4,
          }}
        >
          {signal.summary}
        </div>
      )}

      {/* Row 4: autonomous status badges */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: signal.summary ? 0 : 4 }}>
        {isNoise && signal.noise_reason && (
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 6.5,
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: noiseReasonColor(signal.noise_reason),
              background: `${noiseReasonColor(signal.noise_reason)}18`,
              padding: "2px 5px",
              borderRadius: 3,
              border: `1px solid ${noiseReasonColor(signal.noise_reason)}30`,
            }}
          >
            {noiseReasonLabel(signal.noise_reason)}
          </span>
        )}
        {isRetrograded && (
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 6.5,
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: "rgba(168,85,247,0.55)",
              background: "rgba(168,85,247,0.08)",
              padding: "2px 5px",
              borderRadius: 3,
              border: "1px solid rgba(168,85,247,0.20)",
            }}
          >
            Retrograded
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TelescopePanel({ signals }: { signals: TelescopeSignal[] }) {
  const count = signals.length;
  const [stats, setStats] = useState<NoiseStats | null>(null);

  // Load noise stats (24h window)
  useEffect(() => {
    const supabase = createClient();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Query section_diffs for noise stats
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("section_diffs")
      .select("is_noise, noise_reason")
      .gte("first_seen_at", twentyFourHoursAgo)
      .then(({ data }: { data: Array<{ is_noise: boolean; noise_reason: string | null }> | null }) => {
        if (!data) return;
        const total = data.length;
        const noise = data.filter((d) => d.is_noise === true);
        const breakdown: Record<string, number> = {};
        for (const d of noise) {
          if (d.noise_reason) {
            breakdown[d.noise_reason] = (breakdown[d.noise_reason] || 0) + 1;
          }
        }
        setStats({
          total_diffs: total,
          noise_diffs: noise.length,
          filter_breakdown: breakdown,
        });
      })
      .catch(() => { /* silent */ });
  }, []);

  // Metrics
  const noiseCount = signals.filter((s) => s.is_noise === true).length;
  const retrogradedCount = signals.filter((s) => s.retrograded_at != null).length;
  const noiseRate = stats ? (stats.total_diffs > 0 ? (stats.noise_diffs / stats.total_diffs) : 0) : 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.06)",
        background: "#040406",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "7px 10px 6px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: "rgba(0,180,255,0.55)",
            textTransform: "uppercase",
          }}
        >
          Observatory
        </span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {stats && (
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 7,
                color: noiseRate > 0.5 ? "rgba(239,68,68,0.45)" : "rgba(255,255,255,0.18)",
                letterSpacing: "0.06em",
              }}
            >
              {Math.round(noiseRate * 100)}% filtered
            </span>
          )}
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 8,
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.22)",
            }}
          >
            {count}
          </span>
        </div>
      </div>

      {/* ── Signal feed ── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {count === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              fontFamily: "monospace",
              fontSize: 8,
              letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.14)",
              textTransform: "uppercase",
              padding: "0 12px",
              textAlign: "center",
            }}
          >
            Autonomous detection active
          </div>
        ) : (
          signals.map((s, i) => (
            <SignalCard
              key={s.id}
              signal={s}
              isLast={i === count - 1}
            />
          ))
        )}
      </div>

      {/* ── Stats footer ── */}
      {(noiseCount > 0 || retrogradedCount > 0) && (
        <div
          style={{
            padding: "6px 10px",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            display: "flex",
            gap: 8,
            flexShrink: 0,
          }}
        >
          {noiseCount > 0 && (
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 6.5,
                color: "rgba(100,116,139,0.50)",
                letterSpacing: "0.06em",
              }}
            >
              {noiseCount} noise
            </span>
          )}
          {retrogradedCount > 0 && (
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 6.5,
                color: "rgba(168,85,247,0.50)",
                letterSpacing: "0.06em",
              }}
            >
              {retrogradedCount} retrograded
            </span>
          )}
        </div>
      )}
    </div>
  );
}
