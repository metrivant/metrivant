"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RadarCompetitor } from "../lib/api";

const BRIEF_KEY = "mv_daily_brief_shown";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DailyBriefOverlay({
  competitors,
}: {
  competitors: RadarCompetitor[];
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (competitors.length === 0) return;
    if (localStorage.getItem(BRIEF_KEY) === todayKey()) return;
    // Small delay so the radar loads first — brief feels like a briefing, not a blocker
    const t = setTimeout(() => setVisible(true), 900);
    return () => clearTimeout(t);
  // Run once on mount
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

  // Derive summary from radar feed data already loaded — no extra fetch
  const activeCount = competitors.filter(
    (c) => Number(c.momentum_score ?? 0) > 0
  ).length;

  const newToday = competitors.filter((c) => {
    if (!c.last_signal_at) return false;
    return Date.now() - new Date(c.last_signal_at).getTime() < 24 * 60 * 60 * 1000;
  }).length;

  const topCompetitor = competitors.reduce<RadarCompetitor | null>((best, c) => {
    if (!best) return c;
    return Number(c.momentum_score ?? 0) > Number(best.momentum_score ?? 0) ? c : best;
  }, null);

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month:   "long",
    day:     "numeric",
    year:    "numeric",
  });

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[350] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          onClick={dismiss}
          style={{ background: "rgba(0,2,0,0.88)", backdropFilter: "blur(6px)" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.36, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="relative mx-6 w-full max-w-[400px]"
          >
            {/* Decorative radar behind the card */}
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              style={{ opacity: 0.055 }}
            >
              <svg width="500" height="500" viewBox="0 0 500 500" fill="none" aria-hidden="true">
                <circle cx="250" cy="250" r="230" stroke="#2EE6A6" strokeWidth="0.8" />
                <circle cx="250" cy="250" r="168" stroke="#2EE6A6" strokeWidth="0.6" />
                <circle cx="250" cy="250" r="106" stroke="#2EE6A6" strokeWidth="0.5" />
                <circle cx="250" cy="250" r="52"  stroke="#2EE6A6" strokeWidth="0.5" />
                <line x1="250" y1="20"  x2="250" y2="480" stroke="#2EE6A6" strokeWidth="0.3" strokeDasharray="3 6" />
                <line x1="20"  y1="250" x2="480" y2="250" stroke="#2EE6A6" strokeWidth="0.3" strokeDasharray="3 6" />
                <path d="M250 250 L454 80 A230 230 0 0 1 480 250 Z" fill="#2EE6A6" fillOpacity="0.18" />
              </svg>
            </div>

            {/* Card */}
            <div
              className="relative overflow-hidden rounded-[20px] border border-[#162816] p-8"
              style={{
                background:  "#010901",
                boxShadow:   "0 32px 96px rgba(0,0,0,0.92), 0 0 0 1px rgba(46,230,166,0.07)",
              }}
            >
              {/* Top accent line */}
              <div
                className="absolute inset-x-0 top-0 h-[1px] rounded-t-[20px]"
                style={{
                  background: "linear-gradient(90deg, transparent, rgba(46,230,166,0.55), transparent)",
                }}
              />

              {/* Classification + date */}
              <div className="mb-7 flex items-center justify-between">
                <div
                  className="font-mono text-[9px] font-bold uppercase tracking-[0.32em]"
                  style={{ color: "rgba(46,230,166,0.52)" }}
                >
                  Daily Scan Brief
                </div>
                <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-700">
                  {dateStr}
                </div>
              </div>

              {/* Primary headline */}
              <div className="mb-7">
                <h2 className="text-[24px] font-bold leading-tight tracking-tight text-white">
                  {newToday > 0
                    ? `${newToday} rival${newToday !== 1 ? "s" : ""} moved in the last 24 hours.`
                    : activeCount > 0
                      ? `${activeCount} rival${activeCount !== 1 ? "s" : ""} showing active movement.`
                      : `${competitors.length} rivals under surveillance.`}
                </h2>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
                  Your competitive radar is live. Open it to see what moved.
                </p>
              </div>

              {/* Stats row */}
              <div className="mb-6 grid grid-cols-3 gap-2">
                {[
                  { label: "Rivals",  value: competitors.length, color: "#e2e8f0" },
                  { label: "Active",  value: activeCount, color: activeCount > 0 ? "#2EE6A6" : "#475569" },
                  { label: "New 24h", value: newToday,    color: newToday > 0    ? "#f59e0b" : "#475569" },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="rounded-[12px] border border-[#0f1f0f] bg-[#030a03] px-3 py-3 text-center"
                  >
                    <div
                      className="text-[22px] font-semibold tabular-nums"
                      style={{ color }}
                    >
                      {value}
                    </div>
                    <div className="mt-0.5 text-[9px] uppercase tracking-[0.2em] text-slate-700">
                      {label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Highest-activity competitor */}
              {topCompetitor && Number(topCompetitor.momentum_score ?? 0) > 0 && (
                <div className="mb-6 rounded-[12px] border border-[#162416] bg-[#040e04] px-4 py-3">
                  <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.24em] text-slate-600">
                    Highest activity
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[14px] font-semibold text-white">
                      {topCompetitor.competitor_name}
                    </span>
                    {topCompetitor.latest_movement_type && (
                      <span className="shrink-0 text-[11px] text-slate-500">
                        {topCompetitor.latest_movement_type.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* CTA */}
              <button
                onClick={dismiss}
                className="w-full rounded-full border border-[#1a3020] py-2.5 text-center text-[12px] font-semibold text-slate-400 transition-colors hover:border-[rgba(46,230,166,0.3)] hover:text-slate-200"
              >
                Open radar →
              </button>

              <p className="mt-3 text-center text-[10px] text-slate-800">
                Esc to dismiss · shown once daily
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
