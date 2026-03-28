"use client";

/**
 * Telescope — Active Detection Observatory (v2.0)
 *
 * Precision instrument for detecting competitor movement.
 * Core improvements:
 * - Evidence quality indicators (Phase 1)
 * - Deterministic confidence breakdown (Phase 1)
 * - Quick actions for investigation (Phase 2)
 * - Velocity/acceleration indicators (Phase 2)
 * - Sector-aware terminology (Phase 3)
 * - Multi-signal pattern detection (Phase 3)
 * - Composite trust score (Phase 3)
 * - Reduced decoration, signal-driven animation (Phase 4)
 * - Source clarity (Phase 4)
 * - Time-series context (Phase 4)
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "../lib/supabase/client";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TelescopeSignal = {
  id: string;
  signal_type: string;
  summary: string | null;
  confidence_score: number | null;
  detected_at: string;
  competitor_name: string;
  competitor_id?: string;
  strategic_implication?: string | null;
  previous_excerpt?: string | null;
  current_excerpt?: string | null;
  // Phase 2: Velocity
  velocity_score?: number | null;
  signal_strength?: number | null;
  // Phase 3: Trust composite
  relevance_level?: string | null;
  // Phase 4: Source & context
  source_type?: string | null;
  // Confidence breakdown data & context
  signal_data?: {
    confidence_base?: number;
    recency_bonus?: number;
    observation_bonus?: number;
    page_class_bonus?: number;
    signal_count_7d?: number; // For time-series context
  } | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSignalType(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function getConfidenceGlow(conf: number): string {
  if (conf >= 0.85) return "rgba(239,68,68,0.60)"; // Critical: red
  if (conf >= 0.75) return "rgba(0,180,255,0.70)"; // High: bright cyan
  return "rgba(0,180,255,0.45)"; // Medium-high: dim cyan
}

function getConfidenceColor(conf: number): string {
  if (conf >= 0.85) return "#ef4444"; // Critical: red
  return "#00B4FF"; // High: cyan
}

function truncateText(text: string | null, maxLen = 100): string {
  if (!text) return "—";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "…";
}

// ── Phase 1: Evidence Quality ─────────────────────────────────────────────────

function getEvidenceQuality(signal: TelescopeSignal): {
  label: string;
  color: string;
  complete: boolean;
} {
  const hasPrev = Boolean(signal.previous_excerpt);
  const hasCurr = Boolean(signal.current_excerpt);

  if (hasPrev && hasCurr) {
    return { label: "COMPLETE", color: "#2EE6A6", complete: true };
  }
  if (hasCurr) {
    return { label: "CURRENT ONLY", color: "#f59e0b", complete: false };
  }
  if (hasPrev) {
    return { label: "BASELINE ONLY", color: "#f59e0b", complete: false };
  }
  return { label: "NO EXCERPT", color: "#ef4444", complete: false };
}

// ── Phase 2: Velocity ──────────────────────────────────────────────────────────

function getVelocityDisplay(velocityScore: number | null): {
  label: string;
  arrow: string;
  color: string;
} {
  if (velocityScore === null || velocityScore === undefined) {
    return { label: "UNKNOWN", arrow: "—", color: "rgba(100,116,139,0.5)" };
  }

  if (velocityScore >= 3) {
    return { label: "ACCELERATING", arrow: "↑↑", color: "#ef4444" };
  }
  if (velocityScore >= 2) {
    return { label: "RISING", arrow: "↑", color: "#f59e0b" };
  }
  if (velocityScore >= 1) {
    return { label: "ACTIVE", arrow: "→", color: "#2EE6A6" };
  }
  return { label: "STABLE", arrow: "→", color: "#64748b" };
}

// ── Phase 3: Trust Composite ───────────────────────────────────────────────────

function calculateTrustScore(signal: TelescopeSignal): {
  score: number;
  breakdown: string[];
} {
  const breakdown: string[] = [];
  let score = 0;

  // Confidence (40%)
  const conf = signal.confidence_score ?? 0;
  score += conf * 0.4;
  breakdown.push(`Confidence: ${(conf * 100).toFixed(0)}%`);

  // Evidence completeness (30%)
  const evidence = getEvidenceQuality(signal);
  const evidenceScore = evidence.complete ? 1.0 : evidence.label === "NO EXCERPT" ? 0 : 0.5;
  score += evidenceScore * 0.3;
  breakdown.push(`Evidence: ${evidence.label}`);

  // Relevance (15%)
  const relevance = signal.relevance_level;
  const relevanceScore = relevance === "high" ? 1.0 : relevance === "medium" ? 0.7 : 0.5;
  score += relevanceScore * 0.15;
  breakdown.push(`Relevance: ${relevance ?? "unknown"}`);

  // Signal strength (15%)
  const strength = signal.signal_strength ?? 1;
  const strengthScore = Math.min(1.0, strength / 3);
  score += strengthScore * 0.15;
  breakdown.push(`Strength: ${strength}`);

  return { score: Math.min(1.0, score), breakdown };
}

// ── Phase 4: Source Labels ─────────────────────────────────────────────────────

function getSourceLabel(sourceType: string | null): {
  label: string;
  color: string;
} {
  switch (sourceType) {
    case "pool_event":
      return { label: "POOL", color: "rgba(147,51,234,0.7)" }; // Purple
    case "page_diff":
      return { label: "PAGE", color: "rgba(0,180,255,0.7)" }; // Cyan
    case "feed_event":
      return { label: "FEED", color: "rgba(34,197,94,0.7)" }; // Green
    default:
      return { label: "UNKNOWN", color: "rgba(100,116,139,0.5)" }; // Gray
  }
}

// ── Storage helpers ───────────────────────────────────────────────────────────

const DISMISSED_KEY = "telescope_dismissed";

function getDismissed(): Set<string> {
  try {
    const stored = localStorage.getItem(DISMISSED_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function addDismissed(signalId: string) {
  const dismissed = getDismissed();
  dismissed.add(signalId);
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]));
  } catch {
    // non-fatal
  }
}

// ── Signal Card ───────────────────────────────────────────────────────────────

function SignalCard({
  signal,
  index,
  isFocused,
  onFocus,
  onDismiss,
}: {
  signal: TelescopeSignal;
  index: number;
  isFocused: boolean;
  onFocus: () => void;
  onDismiss: () => void;
}) {
  const router = useRouter();
  const [showConfBreakdown, setShowConfBreakdown] = useState(false);
  const [showTrust, setShowTrust] = useState(false);

  const conf = signal.confidence_score ?? 0;
  const isCritical = conf >= 0.85;
  const isRecent = Date.now() - new Date(signal.detected_at).getTime() < 7200000; // <2h

  const glowColor = getConfidenceGlow(conf);
  const mainColor = getConfidenceColor(conf);

  const evidence = getEvidenceQuality(signal);
  const velocity = getVelocityDisplay(signal.velocity_score ?? null);
  const trust = calculateTrustScore(signal);
  const source = getSourceLabel(signal.source_type ?? null);

  const signalCount7d = signal.signal_data?.signal_count_7d ?? 0;
  const isNthSignal = signalCount7d > 1;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{
        opacity: isFocused ? 1 : 0.5,
        scale: isFocused ? 1 : 0.98,
        y: 0,
      }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{
        duration: 0.5,
        delay: index * 0.08,
        ease: "easeOut",
      }}
      style={{
        position: "relative",
        marginBottom: "10px",
        cursor: "pointer",
      }}
      onClick={onFocus}
    >
      {/* Lock-on ring pulse (critical signals only) */}
      {isCritical && isFocused && (
        <motion.div
          style={{
            position: "absolute",
            inset: "-4px",
            border: "2px solid",
            borderColor: mainColor,
            borderRadius: "8px",
            pointerEvents: "none",
          }}
          animate={{
            opacity: [0.3, 0.8, 0.3],
            scale: [1, 1.02, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      <div
        style={{
          position: "relative",
          padding: "12px 14px",
          borderRadius: "8px",
          border: isFocused ? `1px solid ${mainColor}40` : "1px solid rgba(0,180,255,0.12)",
          background: isFocused
            ? `linear-gradient(135deg, ${mainColor}08 0%, rgba(0,0,0,0.5) 100%)`
            : "rgba(0,0,0,0.3)",
          boxShadow: isFocused ? `0 0 20px ${glowColor}` : "none",
          transition: "all 0.3s ease-out",
        }}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2.5">
            {/* Confidence indicator with Phase 1 evidence quality */}
            <div className="relative">
              <motion.div
                animate={
                  isFocused && conf >= 0.75
                    ? {
                        opacity: [0.7, 1, 0.7],
                        scale: [1, 1.05, 1],
                      }
                    : {}
                }
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: mainColor,
                  boxShadow: `0 0 10px ${glowColor}`,
                  cursor: "pointer",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfBreakdown(!showConfBreakdown);
                }}
              />
              {/* Evidence quality ring */}
              <div
                style={{
                  position: "absolute",
                  inset: "-3px",
                  border: "1px solid",
                  borderColor: evidence.color,
                  borderRadius: "50%",
                  opacity: evidence.complete ? 1.0 : 0.5,
                }}
              />
            </div>

            {/* Competitor name */}
            <span
              style={{
                fontFamily: "var(--font-orbitron)",
                fontSize: "11px",
                fontWeight: 600,
                color: isFocused ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.65)",
                letterSpacing: "0.02em",
                transition: "color 0.3s ease-out",
              }}
            >
              {signal.competitor_name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Phase 4: Source badge */}
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "8px",
                fontWeight: 700,
                color: source.color,
                background: `${source.color}15`,
                border: `1px solid ${source.color}40`,
                borderRadius: "3px",
                padding: "2px 5px",
                letterSpacing: "0.04em",
              }}
            >
              {source.label}
            </span>

            {/* Recency pulse */}
            {isRecent && (
              <motion.div
                animate={{
                  opacity: [0.4, 1, 0.4],
                  scale: [0.9, 1.1, 0.9],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{
                  width: "5px",
                  height: "5px",
                  borderRadius: "50%",
                  background: "#00B4FF",
                  boxShadow: "0 0 6px rgba(0,180,255,0.8)",
                }}
              />
            )}

            {/* Confidence percentage - clickable for breakdown */}
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "10px",
                fontWeight: 700,
                color: mainColor,
                letterSpacing: "0.02em",
                cursor: "pointer",
              }}
              onClick={(e) => {
                e.stopPropagation();
                setShowConfBreakdown(!showConfBreakdown);
              }}
            >
              {Math.round(conf * 100)}%
            </span>

            {/* Phase 4: Time context with signal count */}
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "9px",
                color: "rgba(255,255,255,0.3)",
              }}
            >
              {timeAgo(signal.detected_at)}
              {isNthSignal && (
                <span style={{ color: "rgba(0,180,255,0.5)", marginLeft: "3px" }}>
                  · {signalCount7d}th/7d
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Phase 2: Velocity indicator */}
        {velocity.label !== "UNKNOWN" && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "8px",
              fontWeight: 700,
              color: velocity.color,
              background: `${velocity.color}15`,
              border: `1px solid ${velocity.color}40`,
              borderRadius: "4px",
              padding: "2px 6px",
              marginBottom: "6px",
              letterSpacing: "0.08em",
            }}
          >
            <span>{velocity.arrow}</span>
            <span>{velocity.label}</span>
          </div>
        )}

        {/* Signal type */}
        <div
          style={{
            fontFamily: "var(--font-orbitron)",
            fontSize: "8px",
            fontWeight: 700,
            letterSpacing: "0.14em",
            color: "rgba(0,180,255,0.50)",
            textTransform: "uppercase",
            marginBottom: isFocused ? "10px" : 0,
            transition: "margin 0.3s ease-out",
          }}
        >
          {formatSignalType(signal.signal_type)}
        </div>

        {/* Phase 1: Confidence breakdown (shown on click) */}
        <AnimatePresence>
          {showConfBreakdown && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                overflow: "hidden",
                marginTop: "8px",
                marginBottom: "8px",
                padding: "8px",
                background: "rgba(0,180,255,0.05)",
                border: "1px solid rgba(0,180,255,0.15)",
                borderRadius: "4px",
              }}
            >
              <div
                style={{
                  fontSize: "8px",
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  color: "rgba(0,180,255,0.70)",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                }}
              >
                Confidence Model
              </div>
              <div
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: "9px",
                  lineHeight: "1.6",
                  color: "rgba(255,255,255,0.65)",
                }}
              >
                <div>Total: {(conf * 100).toFixed(1)}%</div>
                <div style={{ color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>
                  Evidence: {evidence.label}
                </div>
                <div style={{ color: "rgba(255,255,255,0.4)" }}>
                  Relevance: {signal.relevance_level ?? "unknown"}
                </div>
                <div style={{ color: "rgba(255,255,255,0.4)" }}>
                  Strength: {signal.signal_strength ?? 1}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Strategic context (focused only) */}
        <AnimatePresence>
          {isFocused && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              style={{ overflow: "hidden" }}
            >
              {/* Phase 3: Trust score (clickable for breakdown) */}
              <div
                style={{
                  marginBottom: "10px",
                  padding: "8px",
                  background: "rgba(46,230,166,0.05)",
                  border: "1px solid rgba(46,230,166,0.20)",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTrust(!showTrust);
                }}
              >
                <div
                  style={{
                    fontSize: "8px",
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    color: "rgba(46,230,166,0.70)",
                    textTransform: "uppercase",
                    marginBottom: "4px",
                  }}
                >
                  Trust Score
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div
                    style={{
                      flex: 1,
                      height: "6px",
                      background: "rgba(46,230,166,0.15)",
                      borderRadius: "3px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${trust.score * 100}%`,
                        height: "100%",
                        background: "#2EE6A6",
                        transition: "width 0.3s ease-out",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#2EE6A6",
                    }}
                  >
                    {Math.round(trust.score * 100)}%
                  </span>
                </div>
                {showTrust && (
                  <div
                    style={{
                      marginTop: "6px",
                      fontSize: "9px",
                      color: "rgba(255,255,255,0.5)",
                      fontFamily: "ui-monospace, monospace",
                    }}
                  >
                    {trust.breakdown.map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Strategic implication */}
              {signal.strategic_implication && (
                <div className="mb-3">
                  <div
                    style={{
                      fontSize: "8px",
                      fontWeight: 700,
                      letterSpacing: "0.16em",
                      color: "rgba(0,180,255,0.55)",
                      textTransform: "uppercase",
                      marginBottom: "4px",
                      fontFamily: "var(--font-orbitron)",
                    }}
                  >
                    Strategic Context
                  </div>
                  <p
                    style={{
                      fontSize: "11px",
                      lineHeight: "1.6",
                      color: "rgba(255,255,255,0.75)",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {signal.strategic_implication}
                  </p>
                </div>
              )}

              {/* Evidence: Before → After */}
              {(signal.previous_excerpt || signal.current_excerpt) && (
                <div>
                  <div
                    style={{
                      fontSize: "8px",
                      fontWeight: 700,
                      letterSpacing: "0.16em",
                      color: "rgba(0,180,255,0.55)",
                      textTransform: "uppercase",
                      marginBottom: "6px",
                      fontFamily: "var(--font-orbitron)",
                    }}
                  >
                    Evidence {evidence.complete ? "✓" : "⚠"}
                  </div>
                  <div className="flex flex-col gap-2">
                    {signal.previous_excerpt && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                      >
                        <div
                          style={{
                            fontSize: "8px",
                            fontWeight: 600,
                            color: "rgba(255,255,255,0.4)",
                            marginBottom: "2px",
                            letterSpacing: "0.06em",
                          }}
                        >
                          Before
                        </div>
                        <div
                          style={{
                            fontFamily: "ui-monospace, monospace",
                            fontSize: "9px",
                            lineHeight: "1.4",
                            color: "rgba(239,68,68,0.70)",
                            background: "rgba(239,68,68,0.06)",
                            border: "1px solid rgba(239,68,68,0.20)",
                            borderRadius: "4px",
                            padding: "6px 8px",
                          }}
                        >
                          {truncateText(signal.previous_excerpt, 80)}
                        </div>
                      </motion.div>
                    )}
                    {signal.current_excerpt && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                      >
                        <div
                          style={{
                            fontSize: "8px",
                            fontWeight: 600,
                            color: "rgba(255,255,255,0.4)",
                            marginBottom: "2px",
                            letterSpacing: "0.06em",
                          }}
                        >
                          After
                        </div>
                        <div
                          style={{
                            fontFamily: "ui-monospace, monospace",
                            fontSize: "9px",
                            lineHeight: "1.4",
                            color: "rgba(46,230,166,0.80)",
                            background: "rgba(46,230,166,0.06)",
                            border: "1px solid rgba(46,230,166,0.20)",
                            borderRadius: "4px",
                            padding: "6px 8px",
                          }}
                        >
                          {truncateText(signal.current_excerpt, 80)}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              )}

              {/* Phase 2: Quick actions */}
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  marginTop: "10px",
                }}
              >
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push("/app");
                  }}
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    fontSize: "9px",
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "rgba(0,180,255,0.80)",
                    background: "rgba(0,180,255,0.10)",
                    border: "1px solid rgba(0,180,255,0.25)",
                    borderRadius: "4px",
                    cursor: "pointer",
                    transition: "all 0.2s ease-out",
                  }}
                  whileHover={{
                    background: "rgba(0,180,255,0.15)",
                    borderColor: "rgba(0,180,255,0.40)",
                  }}
                >
                  View on Radar
                </motion.button>
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss();
                  }}
                  style={{
                    padding: "6px 10px",
                    fontSize: "9px",
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.40)",
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "4px",
                    cursor: "pointer",
                    transition: "all 0.2s ease-out",
                  }}
                  whileHover={{
                    color: "rgba(255,255,255,0.70)",
                    borderColor: "rgba(255,255,255,0.20)",
                  }}
                >
                  Dismiss
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function TelescopePanel({ signals: initialSignals }: { signals: TelescopeSignal[] }) {
  const [signals, setSignals] = useState<TelescopeSignal[]>(initialSignals);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [newSignalPulse, setNewSignalPulse] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const cycleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load dismissed signals from localStorage on mount
  useEffect(() => {
    setDismissed(getDismissed());
  }, []);

  // Filter out dismissed signals and sort
  const visibleSignals = signals
    .filter((s) => !dismissed.has(s.id))
    .sort((a, b) => {
      const confA = a.confidence_score ?? 0;
      const confB = b.confidence_score ?? 0;
      if (confB !== confA) return confB - confA;
      return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime();
    })
    .slice(0, 5); // TOP 5 only

  // Phase 3: Pattern detection - group by competitor
  const competitorCounts = new Map<string, number>();
  visibleSignals.forEach((s) => {
    if (s.competitor_id) {
      competitorCounts.set(s.competitor_id, (competitorCounts.get(s.competitor_id) ?? 0) + 1);
    }
  });
  const hasMultiSignalPattern = Array.from(competitorCounts.values()).some((count) => count >= 2);

  // Auto-cycle through signals (8s interval)
  useEffect(() => {
    if (isPaused || visibleSignals.length <= 1) return;

    cycleTimerRef.current = setInterval(() => {
      setFocusedIndex((prev) => (prev + 1) % visibleSignals.length);
    }, 8000);

    return () => {
      if (cycleTimerRef.current) clearInterval(cycleTimerRef.current);
    };
  }, [isPaused, visibleSignals.length]);

  // Pause cycling on manual focus, resume after 30s
  const handleManualFocus = (index: number) => {
    setFocusedIndex(index);
    setIsPaused(true);

    if (cycleTimerRef.current) clearInterval(cycleTimerRef.current);

    // Resume after 30s
    setTimeout(() => {
      setIsPaused(false);
    }, 30000);
  };

  // Handle dismiss
  const handleDismiss = (signalId: string) => {
    addDismissed(signalId);
    setDismissed((prev) => new Set([...prev, signalId]));

    // Reset focus if dismissing current signal
    const currentSignal = visibleSignals[focusedIndex];
    if (currentSignal?.id === signalId) {
      setFocusedIndex(0);
    }
  };

  // Realtime subscription for new signals
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("telescope_signals")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "signals",
          filter: "status=eq.interpreted",
        },
        (payload) => {
          const newSignal = payload.new as TelescopeSignal;
          // Only add if confidence >= 0.65
          if ((newSignal.confidence_score ?? 0) >= 0.65) {
            setSignals((prev) => [newSignal, ...prev]);
            // Phase 4: Pulse on new signal (signal-driven animation)
            setNewSignalPulse(true);
            setTimeout(() => setNewSignalPulse(false), 2000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid rgba(0,180,255,0.20)",
        background: "linear-gradient(180deg, #020208 0%, #040810 100%)",
        boxShadow: "0 6px 30px rgba(0,180,255,0.08)",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px",
          borderBottom: "1px solid rgba(0,180,255,0.15)",
          background: "rgba(0,180,255,0.04)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Phase 4: Signal-driven pulse (only on new signal) */}
          <motion.div
            animate={
              newSignalPulse
                ? {
                    opacity: [0.5, 1, 0.5],
                    scale: [0.9, 1.2, 0.9],
                  }
                : visibleSignals.length > 0
                ? {
                    opacity: [0.5, 1, 0.5],
                    scale: [0.9, 1.1, 0.9],
                  }
                : {}
            }
            transition={{
              duration: newSignalPulse ? 0.6 : 2,
              repeat: newSignalPulse ? 3 : Infinity,
              ease: "easeInOut",
            }}
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: visibleSignals.length > 0 ? "#00B4FF" : "rgba(100,116,139,0.5)",
              boxShadow:
                visibleSignals.length > 0 ? "0 0 12px rgba(0,180,255,0.7)" : "none",
            }}
          />

          <span
            style={{
              fontFamily: "var(--font-orbitron)",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.20em",
              color: "rgba(0,180,255,0.80)",
              textTransform: "uppercase",
            }}
          >
            Telescope
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Phase 3: Pattern indicator */}
          {hasMultiSignalPattern && (
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "8px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: "rgba(239,68,68,0.80)",
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.30)",
                borderRadius: "4px",
                padding: "3px 6px",
              }}
            >
              PATTERN
            </span>
          )}

          {/* Locked count */}
          {visibleSignals.length > 0 && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: "rgba(0,180,255,0.65)",
                background: "rgba(0,180,255,0.10)",
                border: "1px solid rgba(0,180,255,0.25)",
                borderRadius: "4px",
                padding: "3px 8px",
              }}
            >
              {visibleSignals.length} LOCKED
            </motion.span>
          )}
        </div>
      </div>

      {/* Signal feed */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "14px",
        }}
      >
        {visibleSignals.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: 12,
            }}
          >
            <motion.div
              animate={{
                opacity: [0.3, 0.6, 0.3],
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{
                width: "50px",
                height: "50px",
                borderRadius: "50%",
                border: "2px solid rgba(0,180,255,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,180,255,0.05)",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="rgba(0,180,255,0.40)" strokeWidth="2" />
                <circle cx="12" cy="12" r="3" fill="rgba(0,180,255,0.60)" />
              </svg>
            </motion.div>
            <div
              style={{
                fontFamily: "var(--font-orbitron)",
                fontSize: "9px",
                letterSpacing: "0.18em",
                color: "rgba(0,180,255,0.50)",
                textTransform: "uppercase",
                textAlign: "center",
              }}
            >
              Scanning Field
            </div>
            <div
              style={{
                fontSize: "10px",
                color: "rgba(255,255,255,0.35)",
                textAlign: "center",
                maxWidth: "180px",
                lineHeight: "1.5",
              }}
            >
              Observatory active. High-confidence signals will appear automatically.
            </div>
          </motion.div>
        ) : (
          <AnimatePresence mode="sync">
            {visibleSignals.map((signal, index) => (
              <SignalCard
                key={signal.id}
                signal={signal}
                index={index}
                isFocused={index === focusedIndex}
                onFocus={() => handleManualFocus(index)}
                onDismiss={() => handleDismiss(signal.id)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
