"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { capture } from "../../../lib/posthog";
import { translateToLemon, standColor, type LemonSignal } from "../../../lib/lemonade";
import { formatRelative } from "../../../lib/format";
import type { RadarCompetitor } from "../../../lib/api";

// ─── Your stand illustration ──────────────────────────────────────────────────
// Pure CSS/div cartoon. No external images or SVGs needed.

function YourStand() {
  return (
    <motion.div
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 26, delay: 0.15 }}
      style={{ position: "relative", width: 260, userSelect: "none" }}
    >
      {/* Hanging sign */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
        {/* Strings */}
        <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
          <div
            style={{
              position: "absolute",
              top: -14,
              display: "flex",
              gap: 108,
              pointerEvents: "none",
            }}
          >
            <div style={{ width: 2, height: 16, background: "#92400e", borderRadius: 1 }} />
            <div style={{ width: 2, height: 16, background: "#92400e", borderRadius: 1 }} />
          </div>
          <div
            style={{
              background: "white",
              border: "3px solid #111827",
              borderRadius: 10,
              padding: "5px 20px",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.06em",
              color: "#111827",
              boxShadow: "3px 3px 0 #111827",
              marginTop: 2,
            }}
          >
            🍋 YOUR STAND
          </div>
        </div>
      </div>

      {/* Awning — red + white stripes */}
      <div
        style={{
          height: 40,
          marginTop: 12,
          background:
            "repeating-linear-gradient(90deg, #dc2626 0, #dc2626 22px, white 22px, white 44px)",
          border: "3px solid #111827",
          borderRadius: "10px 10px 0 0",
        }}
      />

      {/* Body */}
      <div
        style={{
          background: "#fde68a",
          border: "3px solid #111827",
          borderTop: "none",
          borderRadius: "0 0 6px 6px",
          padding: "18px 28px 24px",
        }}
      >
        {/* Items on display */}
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            fontSize: 30,
            marginBottom: 12,
          }}
        >
          <span>🥤</span>
          <span>🍋</span>
          <span>🍋</span>
          <span>🥤</span>
        </div>
        {/* Counter shelf */}
        <div
          style={{
            height: 6,
            background: "#92400e",
            borderRadius: 3,
            boxShadow: "0 3px 0 #78350f",
          }}
        />
        <div style={{ height: 18 }} />
      </div>

      {/* Legs */}
      <div
        style={{ display: "flex", justifyContent: "space-between", padding: "0 42px" }}
      >
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              width: 12,
              height: 42,
              background: "#92400e",
              borderRadius: "0 0 4px 4px",
              boxShadow: "2px 0 0 #78350f",
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ─── Speech bubble ────────────────────────────────────────────────────────────
// Floats above the stand. Auto-cycles through active competitor signals.
// Re-animates whenever the bubble text changes.

function SpeechBubble({ signal }: { signal: LemonSignal | null }) {
  const isActive = signal !== null && signal.heat !== "cold";

  return (
    <div
      style={{
        height: 88,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        paddingBottom: 4,
      }}
    >
      <AnimatePresence mode="wait">
        {isActive ? (
          <motion.div
            key={signal.bubble}
            initial={{ scale: 0.6, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.75, opacity: 0, y: -4 }}
            transition={{ type: "spring", stiffness: 480, damping: 26 }}
            style={{ position: "relative", maxWidth: 300 }}
          >
            {/* Bubble body */}
            <div
              style={{
                background: "white",
                border: `3px solid ${signal.color}`,
                borderRadius: 18,
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 700,
                color: "#111827",
                lineHeight: 1.4,
                textAlign: "center",
                boxShadow: `4px 4px 0 ${signal.color}`,
              }}
            >
              {signal.bubble}
            </div>
            {/* Tail — points downward */}
            <div
              style={{
                position: "absolute",
                bottom: -14,
                left: "50%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "11px solid transparent",
                borderRight: "11px solid transparent",
                borderTop: `14px solid ${signal.color}`,
              }}
            />
          </motion.div>
        ) : (
          <motion.p
            key="quiet"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#d97706",
              textAlign: "center",
            }}
          >
            ☀️ The street is quiet today
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Competitor card ──────────────────────────────────────────────────────────

type CardProps = {
  competitor: RadarCompetitor;
  index: number;
  isExpanded: boolean;
  isHighlighted: boolean;
  onClick: () => void;
};

function CompetitorCard({
  competitor,
  index,
  isExpanded,
  isHighlighted,
  onClick,
}: CardProps) {
  const signal = translateToLemon(competitor);
  const color = standColor(index);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07, type: "spring", stiffness: 300, damping: 28 }}
      onClick={onClick}
      style={{
        cursor: "pointer",
        marginBottom: 10,
        borderRadius: 14,
        border: `2.5px solid ${isExpanded || isHighlighted ? color : "#e5e7eb"}`,
        background: isExpanded
          ? `${color}1a`
          : isHighlighted
            ? `${color}0d`
            : "white",
        padding: "12px 14px",
        transition: "border-color 0.18s ease, background 0.18s ease",
        boxShadow: isExpanded ? `3px 3px 0 ${color}55` : "1px 1px 0 #e5e7eb",
      }}
    >
      {/* Card row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Stand icon */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: color,
            border: "2.5px solid #111827",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            flexShrink: 0,
            boxShadow: "2px 2px 0 #111827",
          }}
        >
          🍋
        </div>

        {/* Name + signal */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: 14,
              color: "#111827",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {competitor.competitor_name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
            <span style={{ fontSize: 13 }}>{signal.emoji}</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: signal.heat === "cold" ? "#9ca3af" : signal.color,
              }}
            >
              {signal.short}
            </span>
          </div>
        </div>

        {/* Heat indicator */}
        <span
          style={{ fontSize: 18, flexShrink: 0 }}
          title={
            signal.heat === "hot"
              ? "Very active"
              : signal.heat === "warm"
                ? "Active"
                : "Quiet"
          }
        >
          {signal.heat === "hot" ? "🔥" : signal.heat === "warm" ? "✨" : "💤"}
        </span>
      </div>

      {/* Expanded detail — slides open */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: `1.5px solid ${color}40`,
              }}
            >
              <p
                style={{
                  fontSize: 14,
                  color: "#374151",
                  fontWeight: 700,
                  lineHeight: 1.5,
                  marginBottom: 6,
                }}
              >
                {signal.bubble}
              </p>
              <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>
                {formatRelative(
                  competitor.latest_movement_last_seen_at ?? competitor.last_signal_at
                )}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export default function LemonadeView({
  competitors,
}: {
  competitors: RadarCompetitor[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cycleIdx, setCycleIdx] = useState(0);

  // Competitors with meaningful signal to show in bubble
  const active = competitors.filter(
    (c) => c.latest_movement_type !== null && Number(c.momentum_score ?? 0) >= 2
  );

  // Auto-cycle speech bubble through active competitors every 3.5s
  useEffect(() => {
    if (active.length === 0) return;
    const t = setInterval(() => {
      if (!expandedId) setCycleIdx((p) => (p + 1) % active.length);
    }, 3500);
    return () => clearInterval(t);
  }, [active.length, expandedId]);

  // Analytics on mount
  useEffect(() => {
    capture("lemonade_mode_opened", { competitor_count: competitors.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Which competitor owns the current speech bubble
  const speechCompetitor = expandedId
    ? (competitors.find((c) => c.competitor_id === expandedId) ?? null)
    : (active[cycleIdx] ?? null);

  const activeSpeech = speechCompetitor ? translateToLemon(speechCompetitor) : null;

  const handleCardClick = useCallback(
    (id: string) => {
      capture("lemonade_stand_clicked", { competitor_id: id });
      setExpandedId((prev) => (prev === id ? null : id));
    },
    []
  );

  const empty = competitors.length === 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #fffbeb 0%, #fef3c7 55%, #fde68a44 100%)",
        fontFamily: "-apple-system, Inter, system-ui, sans-serif",
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header
        style={{
          height: 56,
          background: "white",
          borderBottom: "2.5px solid #fde68a",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <motion.span
            animate={{ rotate: [0, -8, 8, -4, 0] }}
            transition={{ delay: 0.4, duration: 0.5, ease: "easeInOut" }}
            style={{ fontSize: 24, display: "inline-block" }}
          >
            🍋
          </motion.span>
          <span
            style={{
              fontWeight: 800,
              fontSize: 15,
              letterSpacing: "0.05em",
              color: "#111827",
            }}
          >
            Lemonade Mode
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              background: "#fde68a",
              color: "#92400e",
              borderRadius: 20,
              padding: "2px 9px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              border: "1.5px solid #f59e0b",
            }}
          >
            Fun Mode
          </span>
        </div>
        <Link
          href="/app"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#92400e",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 5,
            opacity: 0.8,
          }}
        >
          ← Back to Radar
        </Link>
      </header>

      {/* ── Main layout ─────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          height: "calc(100vh - 56px)",
          overflow: "hidden",
        }}
      >
        {/* ── Left — Your stand ─────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px 40px 40px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Subtle ground gradient at bottom */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "30%",
              background:
                "linear-gradient(to top, rgba(253,230,138,0.5) 0%, transparent 100%)",
              pointerEvents: "none",
            }}
          />

          {/* Speech bubble */}
          <SpeechBubble signal={activeSpeech} />

          {/* Gap between bubble tail and stand sign */}
          <div style={{ height: 28 }} />

          {/* The stand */}
          <YourStand />

          {/* Caption */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{
              marginTop: 14,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "#92400e",
              textTransform: "uppercase",
            }}
          >
            {empty
              ? "Add competitors to see what's happening"
              : "Watch what the other kids are doing"}
          </motion.p>
        </div>

        {/* ── Divider ───────────────────────────────────────────────── */}
        <div
          style={{
            width: 3,
            background:
              "linear-gradient(to bottom, transparent 0%, #fcd34d 20%, #fcd34d 80%, transparent 100%)",
            flexShrink: 0,
          }}
        />

        {/* ── Right — The Street ────────────────────────────────────── */}
        <div
          style={{
            width: 300,
            background: "rgba(255, 251, 235, 0.7)",
            overflowY: "auto",
            padding: "20px 16px 32px",
            flexShrink: 0,
          }}
        >
          {/* Street label */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            style={{
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <span style={{ fontSize: 18 }}>🏘️</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.16em",
                color: "#92400e",
                textTransform: "uppercase",
              }}
            >
              The Street
            </span>
          </motion.div>

          {/* Empty state */}
          {empty && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ textAlign: "center", padding: "28px 8px" }}
            >
              <p style={{ fontSize: 36, marginBottom: 8 }}>👀</p>
              <p
                style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}
              >
                No other stands yet
              </p>
              <p style={{ fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
                Add competitors in Discover to see what they are up to
              </p>
              <Link
                href="/app/discover"
                style={{
                  display: "inline-block",
                  marginTop: 12,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#d97706",
                  textDecoration: "underline",
                }}
              >
                Go to Discover →
              </Link>
            </motion.div>
          )}

          {/* Competitor cards */}
          {competitors.map((c, i) => (
            <CompetitorCard
              key={c.competitor_id}
              competitor={c}
              index={i}
              isExpanded={expandedId === c.competitor_id}
              isHighlighted={
                !expandedId &&
                speechCompetitor?.competitor_id === c.competitor_id
              }
              onClick={() => handleCardClick(c.competitor_id)}
            />
          ))}

          {/* Street footer */}
          {!empty && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              style={{
                marginTop: 16,
                fontSize: 11,
                color: "#d97706",
                textAlign: "center",
                fontWeight: 500,
              }}
            >
              Top {competitors.length} rival
              {competitors.length !== 1 ? "s" : ""} by activity
            </motion.p>
          )}
        </div>
      </div>
    </div>
  );
}
