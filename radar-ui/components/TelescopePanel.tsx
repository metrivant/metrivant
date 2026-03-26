"use client";

/**
 * Observatory Panel — Layered Signal Quality System
 *
 * Autonomous detection (8 filters + baselines + validation) handles syntactic noise.
 * User feedback handles semantic noise (org-specific strategic irrelevance).
 *
 * Verdict: useful (valid signal) | noise (strategically irrelevant)
 * Writes to signal_feedback → learn-noise-patterns creates semantic suppression rules.
 */

import { useState, useEffect, useCallback } from "react";
import { createClient } from "../lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

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

type Verdict = "valid" | "noise";
type FeedbackMap = Record<string, Verdict>;

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

// ── Verdict button ────────────────────────────────────────────────────────────

function VerdictBtn({
  active,
  type,
  onClick,
  children,
}: {
  active: boolean;
  type: "valid" | "noise";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  const colors = {
    valid: {
      base: "rgba(0,180,255,0.35)",
      active: "rgba(0,180,255,0.85)",
      bg: "rgba(0,180,255,0.08)",
      activeBg: "rgba(0,180,255,0.15)",
    },
    noise: {
      base: "rgba(239,68,68,0.35)",
      active: "rgba(239,68,68,0.80)",
      bg: "rgba(239,68,68,0.06)",
      activeBg: "rgba(239,68,68,0.12)",
    },
  };

  const c = colors[type];

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      style={{
        fontFamily: "var(--font-orbitron)",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: active ? c.active : hovered ? c.active : c.base,
        background: active ? c.activeBg : hovered ? c.bg : "transparent",
        border: `1px solid ${active ? c.active : hovered ? c.active : c.base}40`,
        borderRadius: "9999px",
        padding: "3px 10px",
        cursor: "pointer",
        transition: "all 0.18s ease-out",
      }}
    >
      {children}
    </motion.button>
  );
}

// ── Signal card ───────────────────────────────────────────────────────────────

function SignalCard({
  signal,
  feedback,
  onVerdict,
  isLast,
  index,
}: {
  signal: TelescopeSignal;
  feedback: Verdict | undefined;
  onVerdict: (signalId: string, verdict: Verdict) => void;
  isLast: boolean;
  index: number;
}) {
  const isNoise = signal.is_noise === true;
  const isRetrograded = signal.retrograded_at != null;
  const hasSemanticFeedback = feedback != null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.22, ease: "easeOut" }}
      style={{
        padding: "10px 12px 9px",
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
          gap: 6,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 11,
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
            fontFamily: "ui-monospace, monospace",
            fontSize: 9,
            color: "rgba(255,255,255,0.22)",
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
          gap: 6,
          marginBottom: signal.summary ? 5 : 0,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-orbitron)",
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.12em",
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
            fontFamily: "ui-monospace, monospace",
            fontSize: 9,
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
            fontFamily: "ui-monospace, monospace",
            fontSize: 11,
            lineHeight: "1.5",
            color: "rgba(255,255,255,0.35)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            marginBottom: 6,
          }}
        >
          {signal.summary}
        </div>
      )}

      {/* Row 4: autonomous status badges */}
      {(isNoise || isRetrograded) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {isNoise && signal.noise_reason && (
            <span
              style={{
                fontFamily: "var(--font-orbitron)",
                fontSize: 8,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: noiseReasonColor(signal.noise_reason),
                background: `${noiseReasonColor(signal.noise_reason)}18`,
                padding: "2px 7px",
                borderRadius: "9999px",
                border: `1px solid ${noiseReasonColor(signal.noise_reason)}30`,
              }}
            >
              {noiseReasonLabel(signal.noise_reason)}
            </span>
          )}
          {isRetrograded && (
            <span
              style={{
                fontFamily: "var(--font-orbitron)",
                fontSize: 8,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(168,85,247,0.55)",
                background: "rgba(168,85,247,0.08)",
                padding: "2px 7px",
                borderRadius: "9999px",
                border: "1px solid rgba(168,85,247,0.20)",
              }}
            >
              Retrograded
            </span>
          )}
        </div>
      )}

      {/* Row 5: semantic verdict controls (only for non-noise signals) */}
      {!isNoise && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <VerdictBtn
            active={feedback === "valid"}
            type="valid"
            onClick={() => onVerdict(signal.id, "valid")}
          >
            Valid
          </VerdictBtn>
          <VerdictBtn
            active={feedback === "noise"}
            type="noise"
            onClick={() => onVerdict(signal.id, "noise")}
          >
            Noise
          </VerdictBtn>
          {hasSemanticFeedback && (
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 8,
                color: feedback === "valid"
                  ? "rgba(0,180,255,0.40)"
                  : "rgba(239,68,68,0.40)",
                marginLeft: 2,
                letterSpacing: "0.04em",
              }}
            >
              {feedback === "valid" ? "Confirmed" : "Flagged"}
            </span>
          )}
        </div>
      )}
    </motion.div>
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
      .select("signal_id, verdict")
      .in("signal_id", ids)
      .then(({ data }: { data: Array<{ signal_id: string; verdict: Verdict }> | null }) => {
        if (!data) return;
        const map: FeedbackMap = {};
        for (const row of data) {
          map[row.signal_id] = row.verdict;
        }
        setFeedbackMap(map);
      })
      .catch(() => { /* silent */ });
  }, [signals]);

  const handleVerdict = useCallback(async (signalId: string, verdict: Verdict) => {
    // Optimistic update
    setFeedbackMap((prev) => ({
      ...prev,
      [signalId]: verdict,
    }));

    const supabase = createClient();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("signal_feedback")
        .upsert(
          {
            signal_id: signalId,
            verdict,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "signal_id" }
        );
    } catch {
      /* silent — revert on failure */
      setFeedbackMap((prev) => {
        const next = { ...prev };
        delete next[signalId];
        return next;
      });
    }
  }, []);

  // Metrics
  const autonomousNoise = signals.filter((s) => s.is_noise === true).length;
  const semanticNoise = Object.values(feedbackMap).filter((v) => v === "noise").length;
  const validSignals = Object.values(feedbackMap).filter((v) => v === "valid").length;
  const retrogradedCount = signals.filter((s) => s.retrograded_at != null).length;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.06)",
        background: "#020208",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "9px 12px 8px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-orbitron)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.22em",
            color: "rgba(0,180,255,0.55)",
            textTransform: "uppercase",
          }}
        >
          Observatory
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {autonomousNoise > 0 && (
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 8,
                color: "rgba(100,116,139,0.45)",
                letterSpacing: "0.04em",
              }}
            >
              {autonomousNoise} auto
            </span>
          )}
          <span
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 10,
              letterSpacing: "0.06em",
              color: "rgba(255,255,255,0.28)",
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
              fontFamily: "var(--font-orbitron)",
              fontSize: 9,
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.14)",
              textTransform: "uppercase",
              padding: "0 16px",
              textAlign: "center",
            }}
          >
            Detection Active
          </div>
        ) : (
          <AnimatePresence mode="sync">
            {signals.map((s, i) => (
              <SignalCard
                key={s.id}
                signal={s}
                feedback={feedbackMap[s.id]}
                onVerdict={handleVerdict}
                isLast={i === count - 1}
                index={i}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* ── Stats footer ── */}
      {(semanticNoise > 0 || validSignals > 0 || retrogradedCount > 0) && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          style={{
            padding: "7px 12px",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            display: "flex",
            gap: 10,
            flexShrink: 0,
          }}
        >
          {validSignals > 0 && (
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 8,
                color: "rgba(0,180,255,0.50)",
                letterSpacing: "0.04em",
              }}
            >
              {validSignals} valid
            </span>
          )}
          {semanticNoise > 0 && (
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 8,
                color: "rgba(239,68,68,0.50)",
                letterSpacing: "0.04em",
              }}
            >
              {semanticNoise} noise
            </span>
          )}
          {retrogradedCount > 0 && (
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 8,
                color: "rgba(168,85,247,0.50)",
                letterSpacing: "0.04em",
              }}
            >
              {retrogradedCount} retrograded
            </span>
          )}
        </motion.div>
      )}
    </div>
  );
}
