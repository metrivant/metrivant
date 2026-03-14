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

// ── Achievement icons ──────────────────────────────────────────────────────────

function AchievIcon({ id, color }: { id: string; color: string }) {
  switch (id) {
    case "signal_first":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="8.5" stroke={color} strokeWidth="1" strokeOpacity="0.38" />
          <circle cx="10" cy="10" r="5"   stroke={color} strokeWidth="1" strokeOpacity="0.55" />
          <circle cx="10" cy="10" r="2"   fill={color} />
          <circle cx="15" cy="6"  r="1.5" fill={color} fillOpacity="0.85" />
        </svg>
      );
    case "rival_tracked":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="8.5" stroke={color} strokeWidth="1" strokeOpacity="0.4" />
          <line x1="10" y1="1.5" x2="10" y2="4.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="10" y1="15.5" x2="10" y2="18.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="1.5" y1="10" x2="4.5" y2="10" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="15.5" y1="10" x2="18.5" y2="10" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="10" cy="10" r="2.8" stroke={color} strokeWidth="1.4" />
        </svg>
      );
    case "brief_viewed":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect x="3" y="2" width="14" height="16" rx="2" stroke={color} strokeWidth="1.2" strokeOpacity="0.55" />
          <line x1="6" y1="6.5"  x2="14" y2="6.5"  stroke={color} strokeWidth="1.2" strokeLinecap="round" />
          <line x1="6" y1="10"   x2="14" y2="10"   stroke={color} strokeWidth="1.2" strokeLinecap="round" />
          <line x1="6" y1="13.5" x2="10" y2="13.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "movement_detected":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <polyline points="2,16 7,9 11,12 18,4" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="14,4 18,4 18,8"       stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "critical_alert":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M10 2L18.5 17H1.5L10 2Z" stroke={color} strokeWidth="1.3" strokeOpacity="0.6" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="10" y1="8"    x2="10" y2="12.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="10" cy="14.8" r="1" fill={color} />
        </svg>
      );
    case "signals_10":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect x="2"  y="13" width="4" height="5"    rx="0.8" fill={color} fillOpacity="0.42" />
          <rect x="8"  y="8"  width="4" height="10"   rx="0.8" fill={color} fillOpacity="0.62" />
          <rect x="14" y="3"  width="4" height="15"   rx="0.8" fill={color} fillOpacity="0.88" />
        </svg>
      );
    case "strategy_reviewed":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect x="2"  y="2"  width="7" height="7" rx="1.2" stroke={color} strokeWidth="1.2" strokeOpacity="0.48" />
          <rect x="11" y="2"  width="7" height="7" rx="1.2" stroke={color} strokeWidth="1.2" strokeOpacity="0.72" />
          <rect x="2"  y="11" width="7" height="7" rx="1.2" stroke={color} strokeWidth="1.2" strokeOpacity="0.72" />
          <rect x="11" y="11" width="7" height="7" rx="1.2" stroke={color} strokeWidth="1.2" strokeOpacity="0.48" />
        </svg>
      );
    case "rivals_5":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          {/* Five nodes arranged like a pentagon — "five eyes" */}
          <circle cx="10" cy="3.5" r="1.6" fill={color} fillOpacity="0.85" />
          <circle cx="17" cy="8"   r="1.4" fill={color} fillOpacity="0.65" />
          <circle cx="14" cy="16"  r="1.4" fill={color} fillOpacity="0.65" />
          <circle cx="6"  cy="16"  r="1.4" fill={color} fillOpacity="0.65" />
          <circle cx="3"  cy="8"   r="1.4" fill={color} fillOpacity="0.65" />
          <path d="M10 3.5L17 8L14 16L6 16L3 8Z" stroke={color} strokeWidth="0.7" strokeOpacity="0.28" />
          <circle cx="10" cy="10"  r="1"   fill={color} fillOpacity="0.40" />
        </svg>
      );
    case "map_viewed":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="16" height="16" rx="1.5" stroke={color} strokeWidth="0.9" strokeOpacity="0.30" />
          <line x1="10" y1="2"  x2="10" y2="18" stroke={color} strokeWidth="0.6" strokeDasharray="1.5 2" strokeOpacity="0.25" />
          <line x1="2"  y1="10" x2="18" y2="10" stroke={color} strokeWidth="0.6" strokeDasharray="1.5 2" strokeOpacity="0.25" />
          <circle cx="6"  cy="6"  r="2"   fill={color} fillOpacity="0.30" />
          <circle cx="15" cy="6"  r="1.6" fill={color} fillOpacity="0.55" />
          <circle cx="5"  cy="14" r="1.4" fill={color} fillOpacity="0.25" />
          <circle cx="14" cy="14" r="2.4" fill={color} fillOpacity="0.70" />
          <circle cx="10" cy="9"  r="1.5" fill={color} fillOpacity="0.42" />
        </svg>
      );
    case "pressure_detected":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="8.5" stroke={color} strokeWidth="0.8" strokeOpacity="0.22" />
          <circle cx="10" cy="10" r="5.5" stroke={color} strokeWidth="0.8" strokeOpacity="0.38" strokeDasharray="2 2" />
          <circle cx="10" cy="10" r="2.8" fill={color} fillOpacity="0.55" />
          <circle cx="10" cy="10" r="1.4" fill={color} fillOpacity="0.90" />
          {/* Pressure wave indicator */}
          <path d="M10 1.5L10.8 4.5L13.5 3L11.5 5.5L14.5 6.5L11.5 7L13 9.5" stroke={color} strokeWidth="0.8" strokeOpacity="0.45" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return <span style={{ color }} className="text-sm font-bold">◈</span>;
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
      {/* Top accent */}
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

// ── Overlay panel ──────────────────────────────────────────────────────────────

function AchievementsPanel({
  onClose,
  unlockedIds,
  completedActionIds,
  intelScore,
  loading,
  onCompleteAction,
}: {
  onClose: () => void;
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
      className="fixed inset-0 z-[100] flex flex-col border-[#0e2210] bg-[#000200] md:inset-y-0 md:left-auto md:right-0 md:w-[500px] md:border-l"
      style={{ boxShadow: "-20px 0 60px rgba(0,0,0,0.78)" }}
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Atmospheric glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 70% 40% at 50% -5%, rgba(46,230,166,0.04) 0%, transparent 70%)",
        }}
      />

      {/* Header */}
      <div className="relative z-10 shrink-0 border-b border-[#0e2210] bg-[rgba(0,0,0,0.92)]">
        {/* Accent line */}
        <div
          className="absolute inset-x-0 top-0 h-[1px]"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(46,230,166,0.28) 40%, rgba(46,230,166,0.42) 50%, rgba(46,230,166,0.28) 60%, transparent 100%)",
          }}
        />

        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.32em]" style={{ color: "rgba(46,230,166,0.50)" }}>
              Intel Score
            </div>
            <motion.div
              key={intelScore}
              initial={{ opacity: 0.6, y: -4 }}
              animate={{ opacity: 1,   y: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-0.5 text-[34px] font-bold leading-none tabular-nums text-white"
            >
              {intelScore}
            </motion.div>
            <div className="mt-1 text-[10px] text-slate-600">
              {unlockedCount} of {ACHIEVEMENTS.length} achievements
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[#1a3020] bg-[#070d07] transition-colors hover:border-[#2a4a30] hover:text-[#2EE6A6]"
            style={{ color: "rgba(46,230,166,0.55)" }}
            aria-label="Close achievements"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        <div className="mx-5 mb-4 h-[3px] overflow-hidden rounded-full bg-[#0a1a0a]">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #2EE6A6, #1abf88)" }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Body */}
      <div className="relative z-10 flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-600">Loading…</div>
          </div>
        ) : (
          <div className="space-y-6">

            {/* ── Achievement grid ────────────────────────────────────────── */}
            <div>
              <div className="mb-3 text-[9px] font-bold uppercase tracking-[0.26em] text-slate-600">
                Milestones
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {ACHIEVEMENTS.map((a) => {
                  const unlocked = unlockedIds.has(a.id);
                  return (
                    <div
                      key={a.id}
                      className="relative overflow-hidden rounded-[12px] border p-3 transition-all duration-300"
                      style={{
                        borderColor: unlocked ? "rgba(46,230,166,0.28)" : "rgba(255,255,255,0.04)",
                        background:  unlocked ? "rgba(46,230,166,0.04)" : "rgba(255,255,255,0.015)",
                        opacity:     unlocked ? 1 : 0.38,
                      }}
                    >
                      {/* Unlocked glow top */}
                      {unlocked && (
                        <div
                          className="pointer-events-none absolute inset-x-0 top-0 h-[1px]"
                          style={{ background: "linear-gradient(90deg, transparent, rgba(46,230,166,0.5), transparent)" }}
                        />
                      )}

                      <div className="mb-2 flex items-start justify-between gap-1">
                        <div style={{ color: unlocked ? "#2EE6A6" : "#475569" }}>
                          <AchievIcon id={a.id} color={unlocked ? "#2EE6A6" : "#475569"} />
                        </div>
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums"
                          style={{
                            background: unlocked ? "rgba(46,230,166,0.12)" : "rgba(255,255,255,0.04)",
                            color:      unlocked ? "#2EE6A6" : "#475569",
                          }}
                        >
                          +{a.points}
                        </span>
                      </div>

                      <div
                        className="text-[11px] font-semibold leading-tight"
                        style={{ color: unlocked ? "rgba(255,255,255,0.9)" : "#64748b" }}
                      >
                        {a.name}
                      </div>
                      <div className="mt-0.5 text-[10px] leading-snug text-slate-600">
                        {a.description}
                      </div>

                      {unlocked && (
                        <div
                          className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.18em]"
                          style={{ color: "rgba(46,230,166,0.55)" }}
                        >
                          Unlocked
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Strategy checklist ──────────────────────────────────────── */}
            <div>
              <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.26em] text-slate-600">
                Strategic Actions
              </div>
              <div className="mb-3 text-[10px] text-slate-700">
                Complete actions to earn Intel Score.
              </div>
              <div className="space-y-2">
                {STRATEGY_ACTIONS.map((action) => {
                  const done = completedActionIds.has(action.id);
                  return (
                    <div
                      key={action.id}
                      className="flex items-center gap-3 rounded-[10px] border px-3.5 py-3 transition-all duration-200"
                      style={{
                        borderColor: done ? "rgba(46,230,166,0.18)" : "rgba(255,255,255,0.05)",
                        background:  done ? "rgba(46,230,166,0.03)" : "rgba(255,255,255,0.012)",
                      }}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => !done && onCompleteAction(action.id as StrategyActionId)}
                        disabled={done}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all duration-150"
                        style={{
                          borderColor: done ? "#2EE6A6"             : "rgba(46,230,166,0.25)",
                          background:  done ? "rgba(46,230,166,0.18)" : "transparent",
                          cursor:      done ? "default"               : "pointer",
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
                          className="text-[12px] font-medium leading-snug"
                          style={{
                            color: done ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.82)",
                            textDecoration: done ? "line-through" : "none",
                          }}
                        >
                          {action.name}
                        </div>
                      </div>

                      {/* Difficulty + reward */}
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                          style={{
                            color:      done ? "#475569" : DIFFICULTY_COLOR[action.difficulty],
                            background: done ? "rgba(255,255,255,0.04)" : `${DIFFICULTY_COLOR[action.difficulty]}18`,
                          }}
                        >
                          {action.difficulty}
                        </span>
                        <span
                          className="text-[10px] tabular-nums font-semibold"
                          style={{ color: done ? "#475569" : "#2EE6A6" }}
                        >
                          +{action.points}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom spacer */}
            <div className="h-4" />
          </div>
        )}
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
  const [open, setOpen]                         = useState(false);
  const [userId, setUserId]                     = useState<string | null>(null);
  const [unlockedIds, setUnlockedIds]           = useState<Set<string>>(new Set());
  const [completedActionIds, setCompletedActionIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded]                     = useState(false);
  const [toasts, setToasts]                     = useState<Toast[]>([]);
  const [hasNew, setHasNew]                     = useState(false);

  // Tracks which IDs we've already attempted to unlock this session (prevents double-fire)
  const attemptedRef = useRef(new Set<string>());
  const openRef      = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);

  const intelScore = computeIntelScore(unlockedIds, completedActionIds);

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

        // Pre-populate attemptedRef so we don't re-fire already-unlocked
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

      // Unique violation (23505) means already unlocked — treat as success
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
    setHasNew((prev) => prev || !openRef.current); // only mark "new" if panel is closed
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

  function openPanel() {
    setOpen(true);
    setHasNew(false);
  }

  function dismissToast(key: string) {
    setToasts((prev) => prev.filter((t) => t.key !== key));
  }

  return (
    <>
      {/* ── Header button ──────────────────────────────────────────────────── */}
      <button
        onClick={openPanel}
        className="relative flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition-all duration-200 hover:opacity-90"
        style={{
          borderColor: hasNew ? "rgba(46,230,166,0.45)" : "rgba(46,230,166,0.15)",
          background:  hasNew ? "rgba(46,230,166,0.08)"  : "rgba(46,230,166,0.04)",
          color:       "rgba(46,230,166,0.70)",
          boxShadow:   hasNew ? "0 0 12px rgba(46,230,166,0.20), inset 0 0 8px rgba(46,230,166,0.04)" : "none",
        }}
        aria-label="Intel Score — Achievements"
      >
        {/* New achievement pulse dot */}
        {hasNew && (
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

        {/* Score — label hidden on mobile */}
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

      {/* ── Achievements overlay ───────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop (mobile only — panel is side-mounted on md+) */}
            <motion.div
              className="fixed inset-0 z-[99] md:hidden"
              style={{ background: "rgba(0,0,0,0.6)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
            />
            <AchievementsPanel
              key="achievements"
              onClose={() => setOpen(false)}
              unlockedIds={unlockedIds}
              completedActionIds={completedActionIds}
              intelScore={intelScore}
              loading={!loaded}
              onCompleteAction={completeAction}
            />
          </>
        )}
      </AnimatePresence>

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
