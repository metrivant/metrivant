"use client";

/**
 * Telescope — Active Detection Observatory
 *
 * Animation-focused signal scanner that surfaces TOP 5 high-confidence signals.
 * Core concept: Living instrument, not static list.
 *
 * Features:
 * - Vertical scanning beam animation
 * - Signal lock-on with ring pulse
 * - Auto-cycling through signals (8s intervals)
 * - Strategic context reveal on focus
 * - Confidence-based glow intensity
 * - Dismiss with persistence (localStorage)
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "../lib/supabase/client";

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

// ── Scanning Beam ─────────────────────────────────────────────────────────────

function ScanningBeam({ height }: { height: number }) {
  return (
    <motion.div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        height: "2px",
        pointerEvents: "none",
        zIndex: 1,
      }}
      animate={{
        top: [0, height - 2, 0],
      }}
      transition={{
        duration: 6,
        repeat: Infinity,
        ease: "linear",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "2px",
          background:
            "linear-gradient(90deg, transparent 0%, rgba(0,180,255,0.4) 30%, rgba(0,180,255,0.8) 50%, rgba(0,180,255,0.4) 70%, transparent 100%)",
          boxShadow: "0 0 12px rgba(0,180,255,0.6)",
        }}
      />
    </motion.div>
  );
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
  const conf = signal.confidence_score ?? 0;
  const isCritical = conf >= 0.85;
  const isRecent = Date.now() - new Date(signal.detected_at).getTime() < 7200000; // <2h

  const glowColor = getConfidenceGlow(conf);
  const mainColor = getConfidenceColor(conf);

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
            {/* Confidence indicator */}
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
              }}
            />

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

            {/* Confidence percentage */}
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "10px",
                fontWeight: 700,
                color: mainColor,
                letterSpacing: "0.02em",
              }}
            >
              {Math.round(conf * 100)}%
            </span>

            {/* Time ago */}
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "9px",
                color: "rgba(255,255,255,0.3)",
              }}
            >
              {timeAgo(signal.detected_at)}
            </span>
          </div>
        </div>

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
                    Evidence
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

              {/* Dismiss button */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss();
                }}
                style={{
                  marginTop: "10px",
                  width: "100%",
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
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "rgba(255,255,255,0.70)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.20)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "rgba(255,255,255,0.40)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                }}
              >
                Dismiss
              </motion.button>
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
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const containerHeight = containerRef.current?.clientHeight ?? 400;

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
      {/* Scanning beam overlay */}
      {visibleSignals.length > 0 && <ScanningBeam height={containerHeight} />}

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
          {/* Pulse indicator */}
          <motion.div
            animate={{
              opacity: [0.5, 1, 0.5],
              scale: [0.9, 1.1, 0.9],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: visibleSignals.length > 0 ? "#00B4FF" : "rgba(100,116,139,0.5)",
              boxShadow:
                visibleSignals.length > 0
                  ? "0 0 12px rgba(0,180,255,0.7)"
                  : "none",
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
