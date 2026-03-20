"use client";

/**
 * TelescopePanel — Signal Review Instrument
 *
 * Scrollable feed of recent signals across all tracked competitors.
 * Each card: competitor name, signal type, summary, confidence, time.
 * Inline verdict controls: useful / noise / unsure.
 * Fills the full remaining sidebar height.
 */

import { useState, useEffect, useCallback } from "react";
import { createClient } from "../lib/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TelescopeSignal = {
  id: string;
  signal_type: string;
  summary: string | null;
  confidence_score: number | null;
  detected_at: string;
  competitor_name: string;
};

type Verdict = "useful" | "noise" | "unsure";
type NoiseCategory = "cosmetic_change" | "dynamic_content" | "false_positive" | "irrelevant" | "duplicate";

type FeedbackMap = Record<string, { verdict: Verdict; noise_category: NoiseCategory | null }>;

const NOISE_CATEGORIES: { value: NoiseCategory; label: string }[] = [
  { value: "cosmetic_change",  label: "Cosmetic" },
  { value: "dynamic_content",  label: "Dynamic" },
  { value: "false_positive",   label: "False pos" },
  { value: "irrelevant",       label: "Irrelevant" },
  { value: "duplicate",        label: "Duplicate" },
];

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

// ── Verdict button ────────────────────────────────────────────────────────────

function VerdictBtn({
  active,
  color,
  activeColor,
  title,
  onClick,
  children,
}: {
  active: boolean;
  color: string;
  activeColor: string;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={title}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "1px 3px",
        fontFamily: "monospace",
        fontSize: 9,
        fontWeight: 700,
        lineHeight: 1,
        color: active ? activeColor : hovered ? activeColor : color,
        opacity: active ? 1 : hovered ? 0.8 : 0.4,
        transition: "color 0.15s, opacity 0.15s",
      }}
    >
      {children}
    </button>
  );
}

// ── Signal card ───────────────────────────────────────────────────────────────

function SignalCard({
  signal,
  feedback,
  onVerdict,
  isLast,
}: {
  signal: TelescopeSignal;
  feedback: { verdict: Verdict; noise_category: NoiseCategory | null } | undefined;
  onVerdict: (signalId: string, verdict: Verdict, noiseCategory?: NoiseCategory) => void;
  isLast: boolean;
}) {
  const [showNoise, setShowNoise] = useState(false);
  const currentVerdict = feedback?.verdict;

  function handleVerdict(v: Verdict) {
    if (v === "noise") {
      if (currentVerdict === "noise") {
        // Toggle off
        setShowNoise(false);
      } else {
        setShowNoise(true);
      }
    } else {
      setShowNoise(false);
    }
    onVerdict(signal.id, v);
  }

  function handleNoiseCategory(cat: NoiseCategory) {
    onVerdict(signal.id, "noise", cat);
    setShowNoise(false);
  }

  return (
    <div
      style={{
        padding: "8px 10px 7px",
        borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.04)",
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
            color: "rgba(0,180,255,0.65)",
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

      {/* Row 4: verdict controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 2, marginTop: signal.summary ? 0 : 4 }}>
        <VerdictBtn
          active={currentVerdict === "useful"}
          color="rgba(255,255,255,0.25)"
          activeColor="rgba(0,180,255,0.85)"
          title="Useful signal"
          onClick={() => handleVerdict("useful")}
        >
          ✓
        </VerdictBtn>
        <VerdictBtn
          active={currentVerdict === "noise"}
          color="rgba(255,255,255,0.25)"
          activeColor="rgba(239,68,68,0.80)"
          title="Noise"
          onClick={() => handleVerdict("noise")}
        >
          ✕
        </VerdictBtn>
        <VerdictBtn
          active={currentVerdict === "unsure"}
          color="rgba(255,255,255,0.25)"
          activeColor="rgba(100,116,139,0.80)"
          title="Unsure"
          onClick={() => handleVerdict("unsure")}
        >
          ?
        </VerdictBtn>
        {/* Existing feedback indicator */}
        {feedback?.noise_category && currentVerdict === "noise" && (
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 6.5,
              color: "rgba(239,68,68,0.45)",
              marginLeft: 4,
              letterSpacing: "0.06em",
            }}
          >
            {feedback.noise_category.replace(/_/g, " ")}
          </span>
        )}
      </div>

      {/* Noise category picker */}
      {showNoise && currentVerdict === "noise" && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 3,
            marginTop: 4,
            paddingTop: 4,
            borderTop: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          {NOISE_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => handleNoiseCategory(cat.value)}
              style={{
                background: feedback?.noise_category === cat.value
                  ? "rgba(239,68,68,0.12)"
                  : "rgba(255,255,255,0.04)",
                border: feedback?.noise_category === cat.value
                  ? "1px solid rgba(239,68,68,0.25)"
                  : "1px solid rgba(255,255,255,0.06)",
                borderRadius: 3,
                padding: "2px 5px",
                fontFamily: "monospace",
                fontSize: 6.5,
                color: feedback?.noise_category === cat.value
                  ? "rgba(239,68,68,0.70)"
                  : "rgba(255,255,255,0.30)",
                cursor: "pointer",
                letterSpacing: "0.04em",
                transition: "all 0.12s",
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TelescopePanel({ signals }: { signals: TelescopeSignal[] }) {
  const count = signals.length;
  const [feedbackMap, setFeedbackMap] = useState<FeedbackMap>({});

  // Load existing feedback for displayed signals
  useEffect(() => {
    if (signals.length === 0) return;
    const supabase = createClient();
    const ids = signals.map((s) => s.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("signal_feedback")
      .select("signal_id, verdict, noise_category")
      .in("signal_id", ids)
      .then(({ data }: { data: Array<{ signal_id: string; verdict: Verdict; noise_category: NoiseCategory | null }> | null }) => {
        if (!data) return;
        const map: FeedbackMap = {};
        for (const row of data) {
          map[row.signal_id] = { verdict: row.verdict, noise_category: row.noise_category };
        }
        setFeedbackMap(map);
      })
      .catch(() => { /* table may not exist yet — silent */ });
  }, [signals]);

  const handleVerdict = useCallback(async (signalId: string, verdict: Verdict, noiseCategory?: NoiseCategory) => {
    // Optimistic update
    setFeedbackMap((prev) => ({
      ...prev,
      [signalId]: {
        verdict,
        noise_category: verdict === "noise" ? (noiseCategory ?? prev[signalId]?.noise_category ?? null) : null,
      },
    }));

    const supabase = createClient();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("signal_feedback")
        .upsert(
          {
            signal_id:      signalId,
            verdict,
            noise_category: verdict === "noise" ? (noiseCategory ?? null) : null,
            updated_at:     new Date().toISOString(),
          },
          { onConflict: "signal_id" }
        );
    } catch {
      /* silent — table may not exist yet */
    }
  }, []);

  // Metrics
  const labeled = Object.keys(feedbackMap).length;
  const noiseCount = Object.values(feedbackMap).filter((f) => f.verdict === "noise").length;

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
          Telescope
        </span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {labeled > 0 && (
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 7,
                color: noiseCount > 0 ? "rgba(239,68,68,0.45)" : "rgba(255,255,255,0.18)",
                letterSpacing: "0.06em",
              }}
            >
              {labeled}/{count}
              {noiseCount > 0 && ` · ${noiseCount} noise`}
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
            No signals detected
          </div>
        ) : (
          signals.map((s, i) => (
            <SignalCard
              key={s.id}
              signal={s}
              feedback={feedbackMap[s.id]}
              onVerdict={handleVerdict}
              isLast={i === count - 1}
            />
          ))
        )}
      </div>
    </div>
  );
}
