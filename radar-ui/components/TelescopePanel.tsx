"use client";

/**
 * Telescope — Autonomous Signal Observatory
 *
 * Read-only view of the autonomous detection system.
 * Displays signals with automated quality classification.
 * No manual intervention — fully automated noise suppression.
 */

import { useState } from "react";
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
  index,
}: {
  signal: TelescopeSignal;
  isLast: boolean;
  index: number;
}) {
  const [hovered, setHovered] = useState(false);
  const isNoise = signal.is_noise === true;
  const isRetrograded = signal.retrograded_at != null;

  // Recent signal indicator (< 1 hour)
  const ms = Date.now() - new Date(signal.detected_at).getTime();
  const isRecent = ms < 3600000;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.22, ease: "easeOut" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ x: 2 }}
      style={{
        padding: "10px 12px 9px",
        borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.04)",
        opacity: isNoise ? 0.45 : 1,
        background: hovered ? "rgba(0,180,255,0.03)" : isRecent ? "rgba(124,58,237,0.03)" : "transparent",
        borderLeft: isRecent ? "2px solid rgba(124,58,237,0.35)" : "2px solid transparent",
        transition: "all 0.2s ease-out",
        position: "relative",
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

      {/* Row 4: autonomous classification badges */}
      {(isNoise || isRetrograded) && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{ display: "flex", flexWrap: "wrap", gap: 5 }}
        >
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
        </motion.div>
      )}

      {/* Recent signal pulse indicator */}
      {isRecent && !isNoise && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: [0.5, 0.8, 0.5], scale: 1 }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: 2,
            height: "60%",
            background: "linear-gradient(180deg, rgba(124,58,237,0) 0%, rgba(124,58,237,0.8) 50%, rgba(124,58,237,0) 100%)",
          }}
        />
      )}
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TelescopePanel({ signals }: { signals: TelescopeSignal[] }) {
  const count = signals.length;

  // Autonomous metrics (no user feedback)
  const autonomousNoise = signals.filter((s) => s.is_noise === true).length;
  const retrogradedCount = signals.filter((s) => s.retrograded_at != null).length;
  const activeSignals = count - autonomousNoise;
  const recentSignals = signals.filter((s) => {
    const ms = Date.now() - new Date(s.detected_at).getTime();
    return ms < 3600000 && !s.is_noise;
  }).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid rgba(124,58,237,0.12)",
        background: "linear-gradient(180deg, #020208 0%, #08051a 100%)",
        boxShadow: "0 4px 24px rgba(124,58,237,0.08)",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "9px 12px 8px",
          borderBottom: "1px solid rgba(124,58,237,0.12)",
          background: "rgba(124,58,237,0.03)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--font-orbitron)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.22em",
              color: "rgba(124,58,237,0.70)",
              textTransform: "uppercase",
            }}
          >
            Telescope
          </span>
          {recentSignals > 0 && (
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "rgba(124,58,237,0.8)",
                boxShadow: "0 0 8px rgba(124,58,237,0.6)",
              }}
            />
          )}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {activeSignals > 0 && (
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 8,
                color: "rgba(0,180,255,0.50)",
                letterSpacing: "0.04em",
              }}
            >
              {activeSignals} active
            </span>
          )}
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
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: "rgba(255,255,255,0.35)",
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              padding: "0 20px",
              textAlign: "center",
              gap: 8,
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "2px solid rgba(124,58,237,0.25)",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 4,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)",
                }}
              />
            </motion.div>
            <div
              style={{
                fontFamily: "var(--font-orbitron)",
                fontSize: 9,
                letterSpacing: "0.18em",
                color: "rgba(124,58,237,0.40)",
                textTransform: "uppercase",
              }}
            >
              Autonomous Detection Active
            </div>
          </motion.div>
        ) : (
          <AnimatePresence mode="sync">
            {signals.map((s, i) => (
              <SignalCard
                key={s.id}
                signal={s}
                isLast={i === count - 1}
                index={i}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* ── Autonomous stats footer ── */}
      {retrogradedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.2 }}
          style={{
            padding: "7px 12px",
            borderTop: "1px solid rgba(124,58,237,0.08)",
            background: "rgba(124,58,237,0.02)",
            display: "flex",
            gap: 10,
            flexShrink: 0,
          }}
        >
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
        </motion.div>
      )}
    </motion.div>
  );
}
