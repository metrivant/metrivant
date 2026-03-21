"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RadarCompetitor } from "../lib/api";

// ── Daily quote catalog ────────────────────────────────────────────────────────

const QUOTES: { text: string; author: string }[] = [
  { text: "Know your enemy and know yourself; in a hundred battles, you will never be defeated.", author: "Sun Tzu" },
  { text: "Speed is the essence of war. Take advantage of the enemy's unpreparedness.", author: "Sun Tzu" },
  { text: "Let your plans be dark and impenetrable as night, and when you move, fall like a thunderbolt.", author: "Sun Tzu" },
  { text: "Strategy without tactics is the slowest route to victory. Tactics without strategy is the noise before defeat.", author: "Sun Tzu" },
  { text: "The most dangerous moment comes with victory.", author: "Napoleon Bonaparte" },
  { text: "It is not the strongest of the species that survives, but the one most responsive to change.", author: "Charles Darwin" },
  { text: "The greatest danger in times of turbulence is not the turbulence — it is to act with yesterday's logic.", author: "Peter Drucker" },
  { text: "I skate to where the puck is going to be, not where it has been.", author: "Wayne Gretzky" },
  { text: "Risk comes from not knowing what you are doing.", author: "Warren Buffett" },
  { text: "The only way to win is to learn faster than anyone else.", author: "Eric Ries" },
  { text: "Without data you're just another person with an opinion.", author: "W. Edwards Deming" },
  { text: "In the middle of every difficulty lies opportunity.", author: "Albert Einstein" },
  { text: "Luck is what happens when preparation meets opportunity.", author: "Seneca" },
  { text: "The impediment to action advances action. What stands in the way becomes the way.", author: "Marcus Aurelius" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "Intelligence is the mother of good fortune.", author: "Miguel de Cervantes" },
  { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
  { text: "A ship in harbour is safe, but that is not what ships are for.", author: "John A. Shedd" },
  { text: "The greatest victory is that which requires no battle.", author: "Sun Tzu" },
  { text: "However beautiful the strategy, you should occasionally look at the results.", author: "Winston Churchill" },
  { text: "Move swift as the Wind and closely-formed as the Wood. Attack like the Fire and be still as the Mountain.", author: "Sun Tzu" },
  { text: "Plans are worthless, but planning is everything.", author: "Dwight D. Eisenhower" },
  { text: "To improve is to change; to be perfect is to have changed often.", author: "Winston Churchill" },
  { text: "Real knowledge is to know the extent of one's ignorance.", author: "Confucius" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "By failing to prepare, you are preparing to fail.", author: "Benjamin Franklin" },
  { text: "He who has a why to live for can bear almost any how.", author: "Friedrich Nietzsche" },
  { text: "If you know the enemy and know yourself, you need not fear the result of a hundred battles.", author: "Sun Tzu" },
  { text: "Victorious warriors win first and then go to war, while defeated warriors go to war first and then seek to win.", author: "Sun Tzu" },
  { text: "Not everything that can be counted counts, and not everything that counts can be counted.", author: "Albert Einstein" },
];

function getDailyQuote(): { text: string; author: string } {
  const startOfYear = new Date(new Date().getFullYear(), 0, 0).getTime();
  const dayOfYear = Math.floor((Date.now() - startOfYear) / 86_400_000);
  return QUOTES[dayOfYear % QUOTES.length];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function momentumColor(score: number): string {
  if (score >= 5) return "#ef4444";
  if (score >= 3) return "#f59e0b";
  if (score >= 1.5) return "#00B4FF";
  return "#64748b";
}

function momentumLabel(score: number): string {
  if (score >= 5) return "ACCEL";
  if (score >= 3) return "RISING";
  if (score >= 1.5) return "STABLE";
  return "COOL";
}

function formatMovement(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Session key ────────────────────────────────────────────────────────────────

const BRIEF_KEY = "mv_daily_brief_shown";
function todayKey(): string { return new Date().toISOString().slice(0, 10); }

// ── Component ──────────────────────────────────────────────────────────────────

export default function DailyBriefOverlay({
  competitors,
}: {
  competitors: RadarCompetitor[];
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (competitors.length === 0) return;
    if (localStorage.getItem(BRIEF_KEY) === todayKey()) return;
    const t = setTimeout(() => setVisible(true), 900);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    localStorage.setItem(BRIEF_KEY, todayKey());
    setVisible(false);
  }

  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ── Derived intelligence ────────────────────────────────────────────────────

  const total = competitors.length;
  const activeCount = competitors.filter((c) => Number(c.momentum_score ?? 0) > 0).length;
  const acceleratingCount = competitors.filter((c) => Number(c.momentum_score ?? 0) >= 5).length;
  const risingCount = competitors.filter((c) => { const m = Number(c.momentum_score ?? 0); return m >= 3 && m < 5; }).length;
  const signals7d = competitors.reduce((sum, c) => sum + (c.signals_7d ?? 0), 0);

  const newToday = competitors.filter((c) => {
    if (!c.last_signal_at) return false;
    return Date.now() - new Date(c.last_signal_at).getTime() < 86_400_000;
  }).length;

  const criticalCount = competitors.filter((c) => {
    const m = Number(c.momentum_score ?? 0);
    const s = c.signals_7d ?? 0;
    const conf = Number(c.latest_movement_confidence ?? 0);
    const age = c.latest_movement_last_seen_at
      ? Date.now() - new Date(c.latest_movement_last_seen_at).getTime()
      : Infinity;
    return m >= 7 && s >= 3 && conf >= 0.7 && c.latest_movement_type != null && age < 172_800_000;
  }).length;

  const topMovers = [...competitors]
    .filter((c) => Number(c.momentum_score ?? 0) > 0 && c.latest_movement_type)
    .sort((a, b) => Number(b.momentum_score ?? 0) - Number(a.momentum_score ?? 0))
    .slice(0, 5);

  const quote = getDailyQuote();
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  // ── Headline ────────────────────────────────────────────────────────────────

  let headline: string;
  let headlineColor: string;
  if (criticalCount > 0) {
    headline = criticalCount === 1
      ? "Critical activity confirmed."
      : `${criticalCount} critical alerts active.`;
    headlineColor = "#ef4444";
  } else if (acceleratingCount > 0) {
    headline = acceleratingCount === 1
      ? "One rival accelerating."
      : `${acceleratingCount} rivals accelerating.`;
    headlineColor = "#f59e0b";
  } else if (newToday > 0) {
    headline = `${newToday} rival${newToday !== 1 ? "s" : ""} moved in the last 24 hours.`;
    headlineColor = "rgba(255,255,255,0.90)";
  } else if (activeCount > 0) {
    headline = `${activeCount} rival${activeCount !== 1 ? "s" : ""} showing movement.`;
    headlineColor = "rgba(255,255,255,0.80)";
  } else {
    headline = `${total} rivals under surveillance.`;
    headlineColor = "rgba(255,255,255,0.65)";
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[350] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={dismiss}
          style={{ background: "rgba(0,2,0,0.88)", backdropFilter: "blur(6px)" }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.18 } }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative mx-4 w-full max-w-[440px] overflow-hidden rounded-[16px]"
            style={{
              background: "#020208",
              border: "1px solid rgba(0,180,255,0.12)",
              boxShadow: "0 0 80px rgba(0,180,255,0.04), 0 32px 100px rgba(0,0,0,0.8)",
            }}
          >
            {/* Accent line */}
            <div
              className="absolute inset-x-0 top-0 h-[1px]"
              style={{ background: "linear-gradient(90deg, transparent, rgba(0,180,255,0.50), transparent)" }}
            />

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5">
              <div className="mv-label" style={{ fontSize: 9, letterSpacing: "0.30em" }}>
                Morning Brief
              </div>
              <div className="mv-micro text-slate-700">{dateStr}</div>
            </div>

            {/* Headline */}
            <div className="px-6 pt-4">
              <h2
                className="mv-title text-[20px] leading-snug"
                style={{ color: headlineColor }}
              >
                {headline}
              </h2>
            </div>

            {/* Stats strip */}
            <div className="mt-4 grid grid-cols-4 gap-px mx-6 overflow-hidden rounded-[10px] border border-[#0d1020]">
              {[
                { label: "Rivals", value: total, color: "rgba(226,232,240,0.8)" },
                { label: "Active", value: activeCount, color: activeCount > 0 ? "#00B4FF" : "#64748b" },
                { label: "Rising", value: risingCount, color: risingCount > 0 ? "#f59e0b" : "#64748b" },
                { label: "Signals", value: signals7d, color: signals7d > 0 ? "rgba(226,232,240,0.7)" : "#64748b" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-[#03030c] px-2 py-3 text-center">
                  <div className="text-[18px] font-semibold tabular-nums leading-none" style={{ color }}>{value}</div>
                  <div className="mv-micro mt-1.5" style={{ fontSize: 8 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Top movers */}
            {topMovers.length > 0 && (
              <div className="mt-4 px-6">
                <div className="mv-label mb-2" style={{ fontSize: 9, color: "rgba(0,180,255,0.35)" }}>
                  Top Movers
                </div>
                <div className="space-y-1">
                  {topMovers.map((c) => {
                    const score = Number(c.momentum_score ?? 0);
                    const col = momentumColor(score);
                    return (
                      <div
                        key={c.competitor_id}
                        className="flex items-center justify-between rounded-[8px] px-3 py-2"
                        style={{ background: `${col}08`, border: `1px solid ${col}15` }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: col }} />
                          <span className="mv-body truncate text-[12px] text-white">{c.competitor_name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {c.latest_movement_type && (
                            <span className="mv-micro text-slate-600">{formatMovement(c.latest_movement_type)}</span>
                          )}
                          <span className="mv-micro font-bold" style={{ color: col }}>{momentumLabel(score)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quote */}
            <div className="mx-6 mt-4 rounded-[10px] border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.012)] px-4 py-3">
              <p className="mv-body text-[12px]" style={{ color: "rgba(226,232,240,0.65)" }}>
                &ldquo;{quote.text}&rdquo;
              </p>
              <p className="mv-micro mt-2 uppercase tracking-[0.18em]" style={{ color: "rgba(100,116,139,0.45)" }}>
                — {quote.author}
              </p>
            </div>

            {/* CTA */}
            <div className="px-6 pt-4 pb-5">
              <button
                onClick={dismiss}
                className="w-full rounded-full py-2.5 text-center text-[12px] font-semibold transition-colors"
                style={{
                  fontFamily: "var(--font-orbitron)",
                  background: "rgba(0,180,255,0.08)",
                  border: "1px solid rgba(0,180,255,0.20)",
                  color: "rgba(0,180,255,0.85)",
                }}
              >
                Open Radar
              </button>
              <p className="mv-micro mt-2 text-center text-slate-800">
                ESC to dismiss
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
