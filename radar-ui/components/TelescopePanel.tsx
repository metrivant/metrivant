"use client";

/**
 * Telescope — High-Confidence Signal Observatory
 *
 * Redesigned to serve Metrivant's core concept:
 * - Prioritizes high-confidence signals (validated, evidence-grounded)
 * - Shows strategic context to inform critical business decisions
 * - Delivers precision-filtered intelligence
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
  strategic_implication?: string | null;
  previous_excerpt?: string | null;
  current_excerpt?: string | null;
};

type ConfidenceFilter = "all" | "high" | "medium";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSignalType(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function confLabel(conf: number | null): string {
  if (conf == null) return "—";
  if (conf >= 0.80) return "Very High";
  if (conf >= 0.65) return "High";
  if (conf >= 0.50) return "Medium";
  return "Low";
}

function confValue(conf: number | null): string {
  if (conf == null) return "—";
  return Math.round(conf * 100) + "%";
}

function truncateExcerpt(text: string | null, maxLen = 80): string {
  if (!text) return "—";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "…";
}

// ── Signal card ───────────────────────────────────────────────────────────────

function SignalCard({
  signal,
  index,
}: {
  signal: TelescopeSignal;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const conf = signal.confidence_score ?? 0;

  // Recent signal indicator (< 2 hours)
  const ms = Date.now() - new Date(signal.detected_at).getTime();
  const isRecent = ms < 7200000;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02, duration: 0.2, ease: "easeOut" }}
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        background: "rgba(0,0,0,0.30)",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
        style={{
          padding: "12px 14px",
          background: expanded ? "rgba(0,180,255,0.04)" : "transparent",
          borderLeft: isRecent ? "2px solid rgba(0,180,255,0.50)" : "2px solid transparent",
          transition: "all 0.15s ease-out",
          cursor: "pointer",
        }}
      >
        {/* Header row: Confidence + Competitor + Time */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2.5">
            {/* Confidence badge */}
            <div
              className="flex flex-col items-center justify-center px-2 py-1"
              style={{
                background: conf >= 0.65 ? "rgba(0,180,255,0.12)" : "rgba(245,158,11,0.12)",
                border: conf >= 0.65 ? "1px solid rgba(0,180,255,0.30)" : "1px solid rgba(245,158,11,0.30)",
                borderRadius: "4px",
                minWidth: "48px",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-orbitron)",
                  fontSize: "8px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: conf >= 0.65 ? "rgba(0,180,255,0.70)" : "rgba(245,158,11,0.70)",
                  textTransform: "uppercase",
                  lineHeight: 1,
                }}
              >
                {confLabel(signal.confidence_score)}
              </span>
              <span
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: "10px",
                  fontWeight: 600,
                  color: conf >= 0.65 ? "rgba(0,180,255,0.85)" : "rgba(245,158,11,0.85)",
                  marginTop: "2px",
                }}
              >
                {confValue(signal.confidence_score)}
              </span>
            </div>

            {/* Competitor name */}
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "rgba(255,255,255,0.85)",
                letterSpacing: "0.01em",
              }}
            >
              {signal.competitor_name}
            </span>
          </div>

          {/* Time + expand indicator */}
          <div className="flex items-center gap-2">
            {isRecent && (
              <motion.div
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "rgba(0,180,255,0.80)",
                  boxShadow: "0 0 8px rgba(0,180,255,0.60)",
                }}
              />
            )}
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "9px",
                color: "rgba(255,255,255,0.25)",
                whiteSpace: "nowrap",
              }}
            >
              {timeAgo(signal.detected_at)}
            </span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              style={{
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease-out",
                opacity: 0.35,
              }}
            >
              <path
                d="M3 4.5L6 7.5L9 4.5"
                stroke="rgba(0,180,255,0.70)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Signal type */}
        <div
          style={{
            fontFamily: "var(--font-orbitron)",
            fontSize: "9px",
            fontWeight: 600,
            letterSpacing: "0.12em",
            color: "rgba(0,180,255,0.60)",
            textTransform: "uppercase",
            marginBottom: expanded ? "8px" : 0,
          }}
        >
          {formatSignalType(signal.signal_type)}
        </div>
      </button>

      {/* Expanded content: Strategic implication + Evidence */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{
              overflow: "hidden",
              background: "rgba(0,180,255,0.02)",
              borderTop: "1px solid rgba(0,180,255,0.08)",
            }}
          >
            <div style={{ padding: "12px 14px" }}>
              {/* Strategic implication */}
              {signal.strategic_implication && (
                <div className="mb-4">
                  <div
                    style={{
                      fontFamily: "var(--font-orbitron)",
                      fontSize: "8px",
                      fontWeight: 700,
                      letterSpacing: "0.18em",
                      color: "rgba(0,180,255,0.50)",
                      textTransform: "uppercase",
                      marginBottom: "4px",
                    }}
                  >
                    Strategic Context
                  </div>
                  <p
                    style={{
                      fontSize: "12px",
                      lineHeight: "1.6",
                      color: "rgba(255,255,255,0.70)",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {signal.strategic_implication}
                  </p>
                </div>
              )}

              {/* Summary fallback */}
              {!signal.strategic_implication && signal.summary && (
                <div className="mb-4">
                  <p
                    style={{
                      fontSize: "12px",
                      lineHeight: "1.6",
                      color: "rgba(255,255,255,0.55)",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {signal.summary}
                  </p>
                </div>
              )}

              {/* Evidence: Before → After */}
              {(signal.previous_excerpt || signal.current_excerpt) && (
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-orbitron)",
                      fontSize: "8px",
                      fontWeight: 700,
                      letterSpacing: "0.18em",
                      color: "rgba(0,180,255,0.50)",
                      textTransform: "uppercase",
                      marginBottom: "6px",
                    }}
                  >
                    Evidence
                  </div>
                  <div className="flex flex-col gap-2">
                    {signal.previous_excerpt && (
                      <div>
                        <div
                          style={{
                            fontSize: "9px",
                            fontWeight: 600,
                            color: "rgba(255,255,255,0.35)",
                            marginBottom: "3px",
                            letterSpacing: "0.06em",
                          }}
                        >
                          Before
                        </div>
                        <div
                          style={{
                            fontFamily: "ui-monospace, monospace",
                            fontSize: "10px",
                            lineHeight: "1.5",
                            color: "rgba(239,68,68,0.65)",
                            background: "rgba(239,68,68,0.05)",
                            border: "1px solid rgba(239,68,68,0.15)",
                            borderRadius: "4px",
                            padding: "6px 8px",
                          }}
                        >
                          {truncateExcerpt(signal.previous_excerpt, 120)}
                        </div>
                      </div>
                    )}
                    {signal.current_excerpt && (
                      <div>
                        <div
                          style={{
                            fontSize: "9px",
                            fontWeight: 600,
                            color: "rgba(255,255,255,0.35)",
                            marginBottom: "3px",
                            letterSpacing: "0.06em",
                          }}
                        >
                          After
                        </div>
                        <div
                          style={{
                            fontFamily: "ui-monospace, monospace",
                            fontSize: "10px",
                            lineHeight: "1.5",
                            color: "rgba(46,230,166,0.75)",
                            background: "rgba(46,230,166,0.05)",
                            border: "1px solid rgba(46,230,166,0.15)",
                            borderRadius: "4px",
                            padding: "6px 8px",
                          }}
                        >
                          {truncateExcerpt(signal.current_excerpt, 120)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TelescopePanel({ signals }: { signals: TelescopeSignal[] }) {
  const [filter, setFilter] = useState<ConfidenceFilter>("high");

  // Filter signals by confidence
  const filtered = signals.filter((s) => {
    // Always exclude noise
    if (s.is_noise === true) return false;
    if (s.retrograded_at != null) return false;

    const conf = s.confidence_score ?? 0;
    if (filter === "high") return conf >= 0.65;
    if (filter === "medium") return conf >= 0.50 && conf < 0.65;
    return true; // "all"
  });

  // Sort by confidence desc, then recency
  const sorted = [...filtered].sort((a, b) => {
    const confA = a.confidence_score ?? 0;
    const confB = b.confidence_score ?? 0;
    if (confB !== confA) return confB - confA;
    return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime();
  });

  const highCount = signals.filter((s) => !s.is_noise && !s.retrograded_at && (s.confidence_score ?? 0) >= 0.65).length;
  const mediumCount = signals.filter((s) => !s.is_noise && !s.retrograded_at && (s.confidence_score ?? 0) >= 0.50 && (s.confidence_score ?? 0) < 0.65).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid rgba(0,180,255,0.18)",
        background: "linear-gradient(180deg, #020208 0%, #050810 100%)",
        boxShadow: "0 4px 24px rgba(0,180,255,0.06)",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: "1px solid rgba(0,180,255,0.12)",
          background: "rgba(0,180,255,0.03)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--font-orbitron)",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.22em",
              color: "rgba(0,180,255,0.75)",
              textTransform: "uppercase",
            }}
          >
            Telescope
          </span>
        </div>
        <span
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.04em",
            color: "rgba(255,255,255,0.35)",
          }}
        >
          {sorted.length} signal{sorted.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Confidence filter tabs ── */}
      <div
        style={{
          display: "flex",
          gap: "1px",
          padding: "8px 14px",
          background: "rgba(0,0,0,0.40)",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          flexShrink: 0,
        }}
      >
        {[
          { id: "high" as const, label: "High Confidence", count: highCount },
          { id: "medium" as const, label: "Medium", count: mediumCount },
          { id: "all" as const, label: "All", count: signals.filter((s) => !s.is_noise && !s.retrograded_at).length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            style={{
              flex: 1,
              padding: "6px 8px",
              fontSize: "9px",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: filter === tab.id ? "rgba(0,180,255,0.85)" : "rgba(255,255,255,0.30)",
              background: filter === tab.id ? "rgba(0,180,255,0.12)" : "transparent",
              border: filter === tab.id ? "1px solid rgba(0,180,255,0.30)" : "1px solid transparent",
              borderRadius: "4px",
              cursor: "pointer",
              transition: "all 0.15s ease-out",
            }}
          >
            {tab.label}
            <span style={{ marginLeft: "4px", opacity: 0.6 }}>({tab.count})</span>
          </button>
        ))}
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
        {sorted.length === 0 ? (
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
              gap: 10,
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                border: "2px solid rgba(0,180,255,0.20)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,180,255,0.04)",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="7" stroke="rgba(0,180,255,0.40)" strokeWidth="1.5" />
                <circle cx="9" cy="9" r="2.5" fill="rgba(0,180,255,0.60)" />
              </svg>
            </div>
            <div
              style={{
                fontFamily: "var(--font-orbitron)",
                fontSize: "9px",
                letterSpacing: "0.16em",
                color: "rgba(0,180,255,0.45)",
                textTransform: "uppercase",
              }}
            >
              {filter === "high" && highCount === 0
                ? "No High-Confidence Signals"
                : filter === "medium" && mediumCount === 0
                ? "No Medium-Confidence Signals"
                : "Detection Active"}
            </div>
            {filter !== "all" && (
              <button
                onClick={() => setFilter("all")}
                style={{
                  fontSize: "10px",
                  color: "rgba(0,180,255,0.60)",
                  textDecoration: "underline",
                  cursor: "pointer",
                  background: "none",
                  border: "none",
                }}
              >
                View all signals
              </button>
            )}
          </motion.div>
        ) : (
          <AnimatePresence mode="sync">
            {sorted.map((s, i) => (
              <SignalCard key={s.id} signal={s} index={i} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
