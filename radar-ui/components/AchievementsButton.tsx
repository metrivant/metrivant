"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "../lib/supabase/client";
import {
  ACHIEVEMENTS,
  STRATEGY_ACTIONS,
  DIFFICULTY_COLOR,
  computeIntelScore,
  MAX_INTEL_SCORE,
  type AchievementId,
  type StrategyActionId,
} from "../lib/achievements";
import { getAudioManager } from "../lib/audio";

// ── Types ─────────────────────────────────────────────────────────────────────

type Toast = {
  key: string;
  name: string;
  points: number;
};

type Props = {
  totalSignals7d: number;
  competitorCount: number;
  hasMovement: boolean;
  hasCriticalAlert: boolean;
  hasAccelerating: boolean;
};

// ── Achievement icons (24×24 inline SVG, brand-themed) ────────────────────────

function AchievIcon({ id, color }: { id: string; color: string }) {
  switch (id) {
    case "signal_first":
      // Radar blip — concentric rings + hot dot
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1" strokeOpacity="0.28" />
          <circle cx="12" cy="12" r="6.5" stroke={color} strokeWidth="1" strokeOpacity="0.48" />
          <circle cx="12" cy="12" r="3"   stroke={color} strokeWidth="1" strokeOpacity="0.70" />
          <circle cx="12" cy="12" r="1.4" fill={color} />
          <circle cx="18"  cy="7"  r="1.8" fill={color} fillOpacity="0.80" />
        </svg>
      );
    case "rival_tracked":
      // Crosshair / target
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9.5" stroke={color} strokeWidth="1" strokeOpacity="0.38" />
          <line x1="12" y1="2"  x2="12" y2="5.5"  stroke={color} strokeWidth="1.6" strokeLinecap="round" />
          <line x1="12" y1="18.5" x2="12" y2="22" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
          <line x1="2"  y1="12" x2="5.5" y2="12"  stroke={color} strokeWidth="1.6" strokeLinecap="round" />
          <line x1="18.5" y1="12" x2="22" y2="12" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.4" />
        </svg>
      );
    case "rivals_5":
      // Pentagon of nodes — Five Eyes
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12"  cy="3.5"  r="1.8" fill={color} fillOpacity="0.90" />
          <circle cx="20.5" cy="9.5"  r="1.6" fill={color} fillOpacity="0.68" />
          <circle cx="17.5" cy="19.5" r="1.6" fill={color} fillOpacity="0.68" />
          <circle cx="6.5"  cy="19.5" r="1.6" fill={color} fillOpacity="0.68" />
          <circle cx="3.5"  cy="9.5"  r="1.6" fill={color} fillOpacity="0.68" />
          <path d="M12 3.5L20.5 9.5L17.5 19.5L6.5 19.5L3.5 9.5Z" stroke={color} strokeWidth="0.7" strokeOpacity="0.24" />
          <circle cx="12" cy="12"  r="1.2" fill={color} fillOpacity="0.42" />
        </svg>
      );
    case "brief_viewed":
      // Document / book icon
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3.5" y="2" width="17" height="20" rx="2" stroke={color} strokeWidth="1.2" strokeOpacity="0.50" />
          <line x1="7" y1="7"    x2="17" y2="7"    stroke={color} strokeWidth="1.2" strokeLinecap="round" />
          <line x1="7" y1="10.5" x2="17" y2="10.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
          <line x1="7" y1="14"   x2="13" y2="14"   stroke={color} strokeWidth="1.2" strokeLinecap="round" />
          <line x1="7" y1="17.5" x2="11" y2="17.5" stroke={color} strokeWidth="0.9" strokeLinecap="round" strokeOpacity="0.55" />
        </svg>
      );
    case "strategy_reviewed":
      // Four-quadrant grid — pattern analysis
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="2.5"  y="2.5"  width="8.5" height="8.5" rx="1.4" stroke={color} strokeWidth="1.2" strokeOpacity="0.45" />
          <rect x="13"   y="2.5"  width="8.5" height="8.5" rx="1.4" stroke={color} strokeWidth="1.2" strokeOpacity="0.72" />
          <rect x="2.5"  y="13"   width="8.5" height="8.5" rx="1.4" stroke={color} strokeWidth="1.2" strokeOpacity="0.72" />
          <rect x="13"   y="13"   width="8.5" height="8.5" rx="1.4" stroke={color} strokeWidth="1.2" strokeOpacity="0.45" />
        </svg>
      );
    case "map_viewed":
      // Positioning map / scatter plot
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="2" stroke={color} strokeWidth="0.9" strokeOpacity="0.28" />
          <line x1="12" y1="2"  x2="12" y2="22" stroke={color} strokeWidth="0.6" strokeDasharray="2 2.5" strokeOpacity="0.22" />
          <line x1="2"  y1="12" x2="22" y2="12" stroke={color} strokeWidth="0.6" strokeDasharray="2 2.5" strokeOpacity="0.22" />
          <circle cx="7"  cy="7"  r="2.4" fill={color} fillOpacity="0.30" />
          <circle cx="17" cy="7"  r="1.8" fill={color} fillOpacity="0.58" />
          <circle cx="6"  cy="17" r="1.6" fill={color} fillOpacity="0.25" />
          <circle cx="17" cy="17" r="2.8" fill={color} fillOpacity="0.72" />
          <circle cx="12" cy="10" r="1.6" fill={color} fillOpacity="0.44" />
        </svg>
      );
    case "signals_10":
      // Signal density bar chart
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="2"   y="16" width="5" height="6"  rx="1" fill={color} fillOpacity="0.38" />
          <rect x="9.5" y="10" width="5" height="12" rx="1" fill={color} fillOpacity="0.60" />
          <rect x="17"  y="4"  width="5" height="18" rx="1" fill={color} fillOpacity="0.88" />
          <line x1="1" y1="22" x2="23" y2="22" stroke={color} strokeWidth="0.8" strokeOpacity="0.22" />
        </svg>
      );
    case "pressure_detected":
      // Pressure wave — concentric burst
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="0.8" strokeOpacity="0.20" />
          <circle cx="12" cy="12" r="6.5" stroke={color} strokeWidth="0.8" strokeOpacity="0.38" strokeDasharray="2.5 2" />
          <circle cx="12" cy="12" r="3.4" fill={color} fillOpacity="0.52" />
          <circle cx="12" cy="12" r="1.6" fill={color} fillOpacity="0.92" />
          <path d="M12 2L12.9 5.2L16 3.4L13.8 6.2L17.2 7.5L13.8 8.2L15.6 11" stroke={color} strokeWidth="0.9" strokeOpacity="0.44" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "movement_detected":
      // Rising trend / arrow
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <polyline points="2,20 7,12 12,15 22,4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="16,4 22,4 22,10" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "critical_alert":
      // Lightning / alert triangle
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2.5L21.5 20H2.5L12 2.5Z" stroke={color} strokeWidth="1.4" strokeOpacity="0.55" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="9"    x2="12" y2="14.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="17" r="1.1" fill={color} />
        </svg>
      );
    default:
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.2" strokeOpacity="0.48" />
          <circle cx="12" cy="12" r="2"  fill={color} />
        </svg>
      );
  }
}

// ── Toast notification ─────────────────────────────────────────────────────────

function ToastCard({ name, points, onDone }: Toast & { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 40, scale: 0.94 }}
      animate={{ opacity: 1, x: 0,  scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.92 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[12px] border px-4 py-3 shadow-2xl"
      style={{
        background:   "radial-gradient(ellipse 120% 80% at 50% 0%, rgba(46,230,166,0.08) 0%, rgba(0,3,1,0.97) 65%)",
        borderColor:  "rgba(46,230,166,0.30)",
        boxShadow:    "0 0 0 1px rgba(46,230,166,0.08), 0 12px 40px rgba(0,0,0,0.9)",
        minWidth:     "220px",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-[1px]"
        style={{ background: "linear-gradient(90deg, transparent, rgba(46,230,166,0.7), transparent)" }}
      />
      <div className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.28em]" style={{ color: "rgba(46,230,166,0.55)" }}>
        Achievement Unlocked
      </div>
      <div className="text-[13px] font-semibold text-white">{name}</div>
      <div className="mt-0.5 text-[11px] tabular-nums" style={{ color: "#2EE6A6" }}>
        +{points} Intel Score
      </div>
    </motion.div>
  );
}

// ── Compact dropdown panel ────────────────────────────────────────────────────

function AchievementsDropdown({
  unlockedIds,
  completedActionIds,
  intelScore,
  loading,
  onCompleteAction,
}: {
  unlockedIds: Set<string>;
  completedActionIds: Set<string>;
  intelScore: number;
  loading: boolean;
  onCompleteAction: (id: StrategyActionId) => void;
}) {
  const unlockedCount = ACHIEVEMENTS.filter((a) => unlockedIds.has(a.id)).length;
  const progressPct   = MAX_INTEL_SCORE > 0 ? Math.round((intelScore / MAX_INTEL_SCORE) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0,   scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.20, ease: [0.22, 1, 0.36, 1] }}
      className="absolute right-0 top-full z-[200] mt-2 w-[340px] overflow-hidden rounded-[14px] border"
      style={{
        background:   "rgba(8,10,14,0.97)",
        borderColor:  "rgba(46,230,166,0.15)",
        boxShadow:    "0 20px 60px rgba(0,0,0,0.85), 0 0 0 1px rgba(46,230,166,0.06), inset 0 1px 0 rgba(46,230,166,0.06)",
        backdropFilter: "blur(16px)",
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute inset-x-0 top-0 h-[1px]"
        style={{ background: "linear-gradient(90deg, transparent, rgba(46,230,166,0.42), transparent)" }}
      />

      {/* Header row */}
      <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: "rgba(46,230,166,0.08)" }}>
        <div className="flex items-end justify-between mb-2.5">
          <div>
            <div className="text-[8px] font-bold uppercase tracking-[0.30em]" style={{ color: "rgba(46,230,166,0.45)" }}>
              Intel Score
            </div>
            <motion.div
              key={intelScore}
              initial={{ opacity: 0.5, y: -4 }}
              animate={{ opacity: 1,   y: 0 }}
              transition={{ duration: 0.25 }}
              className="text-[28px] font-bold leading-none tabular-nums text-white mt-0.5"
            >
              {intelScore}
            </motion.div>
          </div>
          <div className="text-right pb-0.5">
            <div className="text-[10px] tabular-nums" style={{ color: "rgba(46,230,166,0.60)" }}>
              {unlockedCount} / {ACHIEVEMENTS.length}
            </div>
            <div className="text-[9px] text-slate-600 mt-0.5">milestones</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-[2px] overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #2EE6A6, #1abf88)" }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        </div>
        <div className="mt-1 text-[9px] text-slate-700 tabular-nums">{progressPct}% complete</div>
      </div>

      {/* Body — scrollable */}
      <div
        className="overflow-y-auto px-3 py-3"
        style={{
          maxHeight: "360px",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(46,230,166,0.15) transparent",
        }}
      >
        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-600">Loading…</div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {ACHIEVEMENTS.map((a) => {
              const unlocked = unlockedIds.has(a.id);
              return (
                <div
                  key={a.id}
                  className="relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 transition-all duration-200"
                  style={{
                    background:  unlocked ? "rgba(46,230,166,0.04)" : "transparent",
                    opacity:     unlocked ? 1 : 0.42,
                  }}
                >
                  {/* Unlocked left accent */}
                  {unlocked && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] rounded-full"
                      style={{
                        height: "60%",
                        background: "rgba(46,230,166,0.55)",
                        boxShadow: "0 0 6px rgba(46,230,166,0.35)",
                      }}
                    />
                  )}

                  {/* Icon */}
                  <div className="shrink-0">
                    <AchievIcon id={a.id} color={unlocked ? "#2EE6A6" : "#475569"} />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[12px] font-semibold leading-snug"
                      style={{ color: unlocked ? "rgba(255,255,255,0.90)" : "#64748b" }}
                    >
                      {a.name}
                    </div>
                    <div className="text-[10px] leading-snug mt-0.5" style={{ color: unlocked ? "#475569" : "#334155" }}>
                      {a.description}
                    </div>
                  </div>

                  {/* Points badge */}
                  <div
                    className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold tabular-nums"
                    style={{
                      background: unlocked ? "rgba(46,230,166,0.12)" : "rgba(255,255,255,0.04)",
                      color:      unlocked ? "#2EE6A6" : "#334155",
                    }}
                  >
                    +{a.points}
                  </div>
                </div>
              );
            })}

            {/* Strategy actions divider */}
            <div
              className="my-2 mx-1 border-t"
              style={{ borderColor: "rgba(46,230,166,0.07)" }}
            />
            <div className="px-3 pb-1">
              <div className="text-[8px] font-bold uppercase tracking-[0.28em] text-slate-600">
                Strategic Actions
              </div>
            </div>

            {STRATEGY_ACTIONS.map((action) => {
              const done = completedActionIds.has(action.id);
              return (
                <div
                  key={action.id}
                  className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 transition-all duration-150"
                  style={{
                    background: done ? "rgba(46,230,166,0.03)" : "transparent",
                    opacity:    done ? 0.55 : 1,
                  }}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => !done && onCompleteAction(action.id as StrategyActionId)}
                    disabled={done}
                    className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border transition-all duration-150"
                    style={{
                      width: "18px",
                      height: "18px",
                      borderColor: done ? "#2EE6A6" : "rgba(46,230,166,0.22)",
                      background:  done ? "rgba(46,230,166,0.16)" : "transparent",
                      cursor:      done ? "default" : "pointer",
                    }}
                    aria-label={done ? "Completed" : `Complete: ${action.name}`}
                  >
                    {done && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <path d="M2 5.5L4.2 7.8L8 3" stroke="#2EE6A6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[11px] font-medium leading-snug"
                      style={{
                        color: done ? "#475569" : "rgba(255,255,255,0.78)",
                        textDecoration: done ? "line-through" : "none",
                      }}
                    >
                      {action.name}
                    </div>
                  </div>

                  {/* Difficulty + points */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
                      style={{
                        color:      done ? "#475569" : DIFFICULTY_COLOR[action.difficulty],
                        background: done ? "rgba(255,255,255,0.04)" : `${DIFFICULTY_COLOR[action.difficulty]}18`,
                      }}
                    >
                      {action.difficulty}
                    </span>
                    <span
                      className="text-[10px] tabular-nums font-semibold"
                      style={{ color: done ? "#334155" : "#2EE6A6" }}
                    >
                      +{action.points}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2.5 border-t"
        style={{ borderColor: "rgba(46,230,166,0.07)", background: "rgba(0,0,0,0.30)" }}
      >
        <div className="text-[9px] text-slate-700 text-center">
          Press <kbd className="rounded px-1 py-0.5 text-[8px]" style={{ background: "rgba(255,255,255,0.06)", color: "#64748b" }}>I</kbd> to toggle
        </div>
      </div>
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AchievementsButton({
  totalSignals7d,
  competitorCount,
  hasMovement,
  hasCriticalAlert,
  hasAccelerating,
}: Props) {
  const [open, setOpen]                             = useState(false);
  const [userId, setUserId]                         = useState<string | null>(null);
  const [unlockedIds, setUnlockedIds]               = useState<Set<string>>(new Set());
  const [completedActionIds, setCompletedActionIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded]                         = useState(false);
  const [toasts, setToasts]                         = useState<Toast[]>([]);
  const [hasNew, setHasNew]                         = useState(false);

  const attemptedRef = useRef(new Set<string>());
  const openRef      = useRef(open);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { openRef.current = open; }, [open]);

  const intelScore = computeIntelScore(unlockedIds, completedActionIds);

  // ── Click-outside to close ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ── Load user + existing achievements on mount ───────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        setUserId(user.id);

        const [{ data: achRows }, { data: actionRows }] = await Promise.all([
          supabase.from("user_achievements").select("achievement_id").eq("user_id", user.id),
          supabase.from("user_strategy_actions").select("action_id").eq("user_id", user.id),
        ]);

        if (cancelled) return;

        const ids    = new Set((achRows    ?? []).map((r) => r.achievement_id as string));
        const actIds = new Set((actionRows ?? []).map((r) => r.action_id as string));

        ids.forEach((id)    => attemptedRef.current.add(id));
        actIds.forEach((id) => attemptedRef.current.add(`action:${id}`));

        setUnlockedIds(ids);
        setCompletedActionIds(actIds);
      } catch {
        // Non-fatal — achievements are best-effort
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  // ── Unlock helper ─────────────────────────────────────────────────────────────
  const unlock = useCallback(async (id: AchievementId) => {
    if (!userId) return;
    if (attemptedRef.current.has(id)) return;
    attemptedRef.current.add(id);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("user_achievements")
        .insert({ user_id: userId, achievement_id: id });

      if (error && !error.code?.includes("23505")) return;
    } catch {
      // Non-fatal
    }

    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) return;

    setUnlockedIds((prev) => new Set([...prev, id]));
    setToasts((prev) => [
      { key: `${id}-${Date.now()}`, name: def.name, points: def.points },
      ...prev.slice(0, 3),
    ]);
    setHasNew((prev) => prev || !openRef.current);
    getAudioManager().play("achieve");
  }, [userId]);

  // ── Complete strategy action ──────────────────────────────────────────────────
  const completeAction = useCallback(async (id: StrategyActionId) => {
    if (!userId) return;
    if (completedActionIds.has(id)) return;
    const key = `action:${id}`;
    if (attemptedRef.current.has(key)) return;
    attemptedRef.current.add(key);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("user_strategy_actions")
        .insert({ user_id: userId, action_id: id });

      if (error && !error.code?.includes("23505")) return;
    } catch {
      // Non-fatal
    }

    const def = STRATEGY_ACTIONS.find((a) => a.id === id);
    if (!def) return;

    setCompletedActionIds((prev) => new Set([...prev, id]));
    setToasts((prev) => [
      { key: `${id}-${Date.now()}`, name: def.name, points: def.points },
      ...prev.slice(0, 3),
    ]);
    getAudioManager().play("achieve");
  }, [userId, completedActionIds]);

  // ── Auto-unlock from radar data ───────────────────────────────────────────────
  useEffect(() => {
    if (!loaded || !userId) return;

    if (totalSignals7d > 0)     void unlock("signal_first");
    if (competitorCount > 0)    void unlock("rival_tracked");
    if (competitorCount >= 5)   void unlock("rivals_5");
    if (hasMovement)            void unlock("movement_detected");
    if (hasAccelerating)        void unlock("pressure_detected");
    if (hasCriticalAlert)       void unlock("critical_alert");
    if (totalSignals7d >= 10)   void unlock("signals_10");
  }, [loaded, userId, totalSignals7d, competitorCount, hasMovement, hasCriticalAlert, hasAccelerating, unlock]);

  // ── Listen for overlay-based unlock events ────────────────────────────────────
  useEffect(() => {
    function handler(e: Event) {
      const id = (e as CustomEvent<string>).detail as AchievementId;
      void unlock(id);
    }
    window.addEventListener("mv:achieve", handler);
    return () => window.removeEventListener("mv:achieve", handler);
  }, [unlock]);

  // ── Keyboard shortcut: I = Intel ─────────────────────────────────────────────
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === "i") {
        setOpen((v) => {
          if (!v) setHasNew(false);
          return !v;
        });
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  function togglePanel() {
    setOpen((v) => {
      if (!v) setHasNew(false);
      return !v;
    });
  }

  function dismissToast(key: string) {
    setToasts((prev) => prev.filter((t) => t.key !== key));
  }

  return (
    <>
      {/* ── Button + dropdown wrapper ───────────────────────────────────── */}
      <div ref={containerRef} className="relative">
        <button
          onClick={togglePanel}
          className="relative flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition-all duration-200 hover:opacity-90"
          style={{
            borderColor: open || hasNew ? "rgba(46,230,166,0.45)" : "rgba(46,230,166,0.15)",
            background:  open || hasNew ? "rgba(46,230,166,0.08)"  : "rgba(46,230,166,0.04)",
            color:       "rgba(46,230,166,0.70)",
            boxShadow:   open || hasNew ? "0 0 12px rgba(46,230,166,0.20), inset 0 0 8px rgba(46,230,166,0.04)" : "none",
          }}
          aria-label="Intel Score — Achievements"
          aria-expanded={open}
        >
          {/* New achievement pulse dot */}
          {hasNew && !open && (
            <motion.span
              className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full"
              style={{ background: "#2EE6A6", boxShadow: "0 0 6px #2EE6A6" }}
              animate={{ scale: [1, 1.4, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            />
          )}

          {/* Icon: radar rings */}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <circle cx="6" cy="6" r="5"   stroke="currentColor" strokeWidth="1"   strokeOpacity="0.5" />
            <circle cx="6" cy="6" r="2.8" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.7" />
            <circle cx="6" cy="6" r="1.2" fill="currentColor" />
          </svg>

          <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Intel
          </span>
          <motion.span
            key={intelScore}
            initial={{ y: -6, opacity: 0 }}
            animate={{ y: 0,  opacity: 1 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="tabular-nums font-bold"
            style={{ color: "rgba(46,230,166,0.88)" }}
          >
            {intelScore}
          </motion.span>
        </button>

        {/* ── Compact dropdown ───────────────────────────────────────────── */}
        <AnimatePresence>
          {open && (
            <AchievementsDropdown
              unlockedIds={unlockedIds}
              completedActionIds={completedActionIds}
              intelScore={intelScore}
              loading={!loaded}
              onCompleteAction={completeAction}
            />
          )}
        </AnimatePresence>
      </div>

      {/* ── Toast stack ────────────────────────────────────────────────────── */}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col-reverse gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <ToastCard
              key={t.key}
              name={t.name}
              points={t.points}
              onDone={() => dismissToast(t.key)}
            />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
