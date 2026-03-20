"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "../lib/supabase/client";
import {
  ACHIEVEMENTS,
  STRATEGY_ACTIONS,
  computeIntelScore,
  MAX_INTEL_SCORE,
  type AchievementId,
  type StrategyActionId,
} from "../lib/achievements";
import { getAudioManager } from "../lib/audio";
import MilestoneOverlay from "./MilestoneOverlay";

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
  /** Active subscription plan — used to unlock subscription achievements */
  planType?: "analyst" | "pro" | null;
  /** Whether the user has an active (paid) subscription */
  hasActiveSub?: boolean;
  /** Whether the Strategy page has real cross-competitor insights to act on */
  hasStrategyContent?: boolean;
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
    case "subscribed_analyst":
      // Circuit / signal activation — node grid + pulse line
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="5"  cy="12" r="1.8" fill={color} fillOpacity="0.70" />
          <circle cx="12" cy="12" r="1.8" fill={color} fillOpacity="0.90" />
          <circle cx="19" cy="12" r="1.8" fill={color} fillOpacity="0.70" />
          <line x1="6.8" y1="12" x2="10.2" y2="12" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
          <line x1="13.8" y1="12" x2="17.2" y2="12" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="12" cy="6"  r="1.4" fill={color} fillOpacity="0.50" />
          <circle cx="12" cy="18" r="1.4" fill={color} fillOpacity="0.50" />
          <line x1="12" y1="7.4"  x2="12" y2="10.2" stroke={color} strokeWidth="1" strokeLinecap="round" strokeOpacity="0.55" />
          <line x1="12" y1="13.8" x2="12" y2="16.6" stroke={color} strokeWidth="1" strokeLinecap="round" strokeOpacity="0.55" />
          <path d="M2 12 Q4 9 5 12 Q6 15 8 12" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.45" fill="none" />
        </svg>
      );
    case "subscribed_pro":
      // Full radar sweep — complete arcs + center dot + sweep line
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10"  stroke={color} strokeWidth="0.9" strokeOpacity="0.28" />
          <circle cx="12" cy="12" r="6.5" stroke={color} strokeWidth="0.9" strokeOpacity="0.48" />
          <circle cx="12" cy="12" r="3.2" stroke={color} strokeWidth="0.9" strokeOpacity="0.68" />
          <circle cx="12" cy="12" r="1.4" fill={color} />
          {/* Sweep wedge */}
          <path d="M12 12 L12 2 A10 10 0 0 1 21.66 17 Z" fill={color} fillOpacity="0.10" />
          <line x1="12" y1="12" x2="12" y2="2" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.80" />
          {/* Active blip */}
          <circle cx="18.5" cy="6.5" r="1.6" fill={color} fillOpacity="0.82" />
          <circle cx="18.5" cy="6.5" r="3"   stroke={color} strokeWidth="0.7" strokeOpacity="0.28" />
        </svg>
      );
    case "gravity_shift":
      // Warped grid converging on a central mass
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M2 8 Q12 10 22 8" stroke={color} strokeWidth="0.7" strokeOpacity="0.38" fill="none" />
          <path d="M2 12 Q12 14.5 22 12" stroke={color} strokeWidth="0.7" strokeOpacity="0.55" fill="none" />
          <path d="M2 16 Q12 13.5 22 16" stroke={color} strokeWidth="0.7" strokeOpacity="0.38" fill="none" />
          <path d="M8 2 Q10 12 8 22" stroke={color} strokeWidth="0.7" strokeOpacity="0.38" fill="none" />
          <path d="M12 2 Q14.5 12 12 22" stroke={color} strokeWidth="0.7" strokeOpacity="0.55" fill="none" />
          <path d="M16 2 Q13.5 12 16 22" stroke={color} strokeWidth="0.7" strokeOpacity="0.38" fill="none" />
          <circle cx="12" cy="12" r="3.2" stroke={color} strokeWidth="0.8" strokeOpacity="0.45" fill="none" />
          <circle cx="12" cy="12" r="1.8" fill={color} fillOpacity="0.85" />
          <circle cx="12" cy="12" r="0.7" fill={color} />
        </svg>
      );
    case "singularity":
      // Black hole — concentric rings collapsing to a point
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="0.6" strokeOpacity="0.18" />
          <circle cx="12" cy="12" r="7.5" stroke={color} strokeWidth="0.8" strokeOpacity="0.28" />
          <circle cx="12" cy="12" r="5"   stroke={color} strokeWidth="0.9" strokeOpacity="0.42" />
          <circle cx="12" cy="12" r="3"   stroke={color} strokeWidth="1.0" strokeOpacity="0.62" />
          <circle cx="12" cy="12" r="1.5" fill={color} fillOpacity="0.90" />
          <circle cx="12" cy="12" r="0.6" fill={color} />
        </svg>
      );
    case "deep_field":
      // Dense field of competitor dots — scattered across view
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="4"  cy="5"  r="1.2" fill={color} fillOpacity="0.55" />
          <circle cx="10" cy="3"  r="1.0" fill={color} fillOpacity="0.40" />
          <circle cx="17" cy="5"  r="1.3" fill={color} fillOpacity="0.65" />
          <circle cx="21" cy="11" r="1.0" fill={color} fillOpacity="0.45" />
          <circle cx="19" cy="18" r="1.2" fill={color} fillOpacity="0.60" />
          <circle cx="13" cy="21" r="1.0" fill={color} fillOpacity="0.40" />
          <circle cx="6"  cy="20" r="1.1" fill={color} fillOpacity="0.50" />
          <circle cx="2"  cy="15" r="1.0" fill={color} fillOpacity="0.38" />
          <circle cx="7"  cy="11" r="1.4" fill={color} fillOpacity="0.80" />
          <circle cx="14" cy="13" r="1.2" fill={color} fillOpacity="0.72" />
          <circle cx="12" cy="8"  r="0.9" fill={color} fillOpacity="0.48" />
          <circle cx="17" cy="9"  r="1.0" fill={color} fillOpacity="0.55" />
        </svg>
      );
    case "pattern_emergence":
      // Constellation — nodes connected with lines forming a cluster
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <line x1="12" y1="4"  x2="20" y2="10" stroke={color} strokeWidth="0.7" strokeOpacity="0.32" />
          <line x1="12" y1="4"  x2="4"  y2="10" stroke={color} strokeWidth="0.7" strokeOpacity="0.32" />
          <line x1="20" y1="10" x2="17" y2="20" stroke={color} strokeWidth="0.7" strokeOpacity="0.32" />
          <line x1="4"  y1="10" x2="7"  y2="20" stroke={color} strokeWidth="0.7" strokeOpacity="0.32" />
          <line x1="7"  y1="20" x2="17" y2="20" stroke={color} strokeWidth="0.7" strokeOpacity="0.32" />
          <line x1="12" y1="4"  x2="12" y2="14" stroke={color} strokeWidth="0.6" strokeOpacity="0.22" strokeDasharray="1.5 2" />
          <circle cx="12" cy="4"  r="2"   fill={color} fillOpacity="0.88" />
          <circle cx="20" cy="10" r="1.6" fill={color} fillOpacity="0.65" />
          <circle cx="4"  cy="10" r="1.6" fill={color} fillOpacity="0.65" />
          <circle cx="17" cy="20" r="1.6" fill={color} fillOpacity="0.65" />
          <circle cx="7"  cy="20" r="1.6" fill={color} fillOpacity="0.65" />
          <circle cx="12" cy="14" r="1.2" fill={color} fillOpacity="0.42" />
        </svg>
      );
    case "the_long_game":
      // Three-day timeline — ascending marks on a horizon line
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <line x1="2" y1="18" x2="22" y2="18" stroke={color} strokeWidth="0.8" strokeOpacity="0.28" />
          <line x1="6"  y1="18" x2="6"  y2="13" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.50" />
          <line x1="12" y1="18" x2="12" y2="9"  stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.72" />
          <line x1="18" y1="18" x2="18" y2="5"  stroke={color} strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="6"  cy="12" r="1.8" fill={color} fillOpacity="0.50" />
          <circle cx="12" cy="8"  r="2.0" fill={color} fillOpacity="0.72" />
          <circle cx="18" cy="4"  r="2.2" fill={color} />
          <path d="M6 12 L12 8 L18 4" stroke={color} strokeWidth="0.6" strokeOpacity="0.22" strokeDasharray="2 2.5" />
        </svg>
      );
    case "sentinel":
      // Eye with radar rings — vigilant watchfulness
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M2 12 Q12 4 22 12 Q12 20 2 12Z" stroke={color} strokeWidth="1.2" strokeOpacity="0.55" fill="none" />
          <circle cx="12" cy="12" r="4"   stroke={color} strokeWidth="1.0" strokeOpacity="0.70" fill="none" />
          <circle cx="12" cy="12" r="2.2" fill={color} fillOpacity="0.85" />
          <circle cx="12" cy="12" r="0.9" fill={color} />
          <circle cx="13.6" cy="10.4" r="0.7" fill={color} fillOpacity="0.70" />
          <circle cx="12" cy="12" r="6"   stroke={color} strokeWidth="0.6" strokeOpacity="0.22" strokeDasharray="2 3" fill="none" />
        </svg>
      );
    case "temporal_lens":
      // Hourglass — time flowing through all scales
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 2 H19 L12 11 L5 2Z"  fill={color} fillOpacity="0.30" stroke={color} strokeWidth="1.0" strokeOpacity="0.60" strokeLinejoin="round" />
          <path d="M5 22 H19 L12 13 L5 22Z" fill={color} fillOpacity="0.55" stroke={color} strokeWidth="1.0" strokeOpacity="0.60" strokeLinejoin="round" />
          <line x1="5"  y1="2"  x2="19" y2="2"  stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.80" />
          <line x1="5"  y1="22" x2="19" y2="22" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.80" />
          <circle cx="12" cy="12" r="1.2" fill={color} fillOpacity="0.88" />
        </svg>
      );
    case "ancient_instinct":
      // Branching evolutionary tree — natural selection encoded in structure
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <line x1="12" y1="22" x2="12" y2="13" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.75" />
          <line x1="12" y1="16" x2="7"  y2="11" stroke={color} strokeWidth="1.1" strokeLinecap="round" strokeOpacity="0.60" />
          <line x1="12" y1="16" x2="17" y2="11" stroke={color} strokeWidth="1.1" strokeLinecap="round" strokeOpacity="0.60" />
          <line x1="7"  y1="11" x2="4"  y2="6"  stroke={color} strokeWidth="0.9" strokeLinecap="round" strokeOpacity="0.48" />
          <line x1="7"  y1="11" x2="10" y2="6"  stroke={color} strokeWidth="0.9" strokeLinecap="round" strokeOpacity="0.48" />
          <line x1="17" y1="11" x2="14" y2="6"  stroke={color} strokeWidth="0.9" strokeLinecap="round" strokeOpacity="0.48" />
          <line x1="17" y1="11" x2="20" y2="6"  stroke={color} strokeWidth="0.9" strokeLinecap="round" strokeOpacity="0.48" />
          <circle cx="12" cy="22" r="1.4" fill={color} fillOpacity="0.60" />
          <circle cx="4"  cy="5"  r="1.6" fill={color} fillOpacity="0.88" />
          <circle cx="10" cy="5"  r="1.6" fill={color} fillOpacity="0.88" />
          <circle cx="14" cy="5"  r="1.6" fill={color} fillOpacity="0.88" />
          <circle cx="20" cy="5"  r="1.6" fill={color} fillOpacity="0.88" />
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
        background:   "radial-gradient(ellipse 120% 80% at 50% 0%, rgba(0,180,255,0.08) 0%, rgba(0,3,1,0.97) 65%)",
        borderColor:  "rgba(0,180,255,0.30)",
        boxShadow:    "0 0 0 1px rgba(0,180,255,0.08), 0 12px 40px rgba(0,0,0,0.9)",
        minWidth:     "220px",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-[1px]"
        style={{ background: "linear-gradient(90deg, transparent, rgba(0,180,255,0.7), transparent)" }}
      />
      <div className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.28em]" style={{ color: "rgba(0,180,255,0.55)" }}>
        Achievement Unlocked
      </div>
      <div className="text-[13px] font-semibold text-white">{name}</div>
      <div className="mt-0.5 text-[11px] tabular-nums" style={{ color: "#00B4FF" }}>
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
  hasStrategyContent,
}: {
  unlockedIds: Set<string>;
  completedActionIds: Set<string>;
  intelScore: number;
  loading: boolean;
  onCompleteAction: (id: StrategyActionId) => void;
  hasStrategyContent: boolean;
}) {
  const unlockedCount = ACHIEVEMENTS.filter((a) => unlockedIds.has(a.id)).length;
  const progressPct   = MAX_INTEL_SCORE > 0 ? Math.round((intelScore / MAX_INTEL_SCORE) * 100) : 0;
  const isApex        = unlockedCount === ACHIEVEMENTS.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0,   scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.20, ease: [0.22, 1, 0.36, 1] }}
      className="absolute right-0 top-full z-[200] mt-2 w-[340px] overflow-hidden rounded-[14px] border"
      style={{
        background:   "rgba(8,10,14,0.97)",
        borderColor:  "rgba(0,180,255,0.15)",
        boxShadow:    "0 20px 60px rgba(0,0,0,0.85), 0 0 0 1px rgba(0,180,255,0.06), inset 0 1px 0 rgba(0,180,255,0.06)",
        backdropFilter: "blur(16px)",
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute inset-x-0 top-0 h-[1px]"
        style={{ background: "linear-gradient(90deg, transparent, rgba(0,180,255,0.42), transparent)" }}
      />

      {/* Header row */}
      <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: "rgba(0,180,255,0.08)" }}>
        <div className="flex items-end justify-between mb-2.5">
          <div>
            <div className="text-[8px] font-bold uppercase tracking-[0.30em]" style={{ color: "rgba(0,180,255,0.45)" }}>
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
            <div className="text-[10px] tabular-nums" style={{ color: "rgba(0,180,255,0.60)" }}>
              {unlockedCount} / {ACHIEVEMENTS.length}
            </div>
            <div className="text-[9px] text-slate-600 mt-0.5">milestones</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-[2px] overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #00B4FF, #1abf88)" }}
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
          scrollbarColor: "rgba(0,180,255,0.15) transparent",
        }}
      >
        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-600">Loading…</div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {/* ── Apex Strategist completion reward ───────────────────── */}
            {isApex && (
              <div
                className="relative mb-2 overflow-hidden rounded-[10px] px-3.5 py-3"
                style={{
                  background: "linear-gradient(135deg, rgba(234,179,8,0.08) 0%, rgba(234,179,8,0.04) 100%)",
                  border: "1px solid rgba(234,179,8,0.28)",
                  boxShadow: "0 0 24px rgba(234,179,8,0.08), inset 0 1px 0 rgba(234,179,8,0.12)",
                }}
              >
                <div
                  className="absolute inset-x-0 top-0 h-[1px]"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(234,179,8,0.60), transparent)" }}
                />
                <div className="flex items-center gap-2.5">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path d="M9 2L11.2 6.5L16 7.2L12.5 10.6L13.4 15.5L9 13.1L4.6 15.5L5.5 10.6L2 7.2L6.8 6.5Z" fill="rgba(234,179,8,0.85)" stroke="rgba(234,179,8,0.50)" strokeWidth="0.6" />
                  </svg>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-[0.26em]" style={{ color: "rgba(234,179,8,0.60)" }}>
                      Title Unlocked
                    </div>
                    <div className="text-[13px] font-bold leading-tight" style={{ color: "rgba(234,179,8,0.92)" }}>
                      APEX STRATEGIST
                    </div>
                  </div>
                </div>
                <div className="mt-1.5 text-[10px] leading-relaxed" style={{ color: "rgba(234,179,8,0.45)" }}>
                  All intelligence milestones achieved. The field belongs to those who watch it longest.
                </div>
              </div>
            )}
            {ACHIEVEMENTS.map((a) => {
              const unlocked = unlockedIds.has(a.id);
              return (
                <div
                  key={a.id}
                  className="relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 transition-all duration-200"
                  style={{
                    background:  unlocked ? "rgba(0,180,255,0.04)" : "transparent",
                    opacity:     unlocked ? 1 : 0.42,
                  }}
                >
                  {/* Unlocked left accent */}
                  {unlocked && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] rounded-full"
                      style={{
                        height: "60%",
                        background: "rgba(0,180,255,0.55)",
                        boxShadow: "0 0 6px rgba(0,180,255,0.35)",
                      }}
                    />
                  )}

                  {/* Icon */}
                  <div className="shrink-0">
                    <AchievIcon id={a.id} color={unlocked ? "#00B4FF" : "#475569"} />
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
                      background: unlocked ? "rgba(0,180,255,0.12)" : "rgba(255,255,255,0.04)",
                      color:      unlocked ? "#00B4FF" : "#334155",
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
              style={{ borderColor: "rgba(0,180,255,0.07)" }}
            />
            <div className="px-3 pb-1">
              <div className="text-[8px] font-bold uppercase tracking-[0.28em] text-slate-600">
                Strategic Actions
              </div>
            </div>

            {hasStrategyContent ? (
              <a
                href="/app/strategy"
                className="flex items-center justify-between rounded-[10px] px-3 py-2.5 transition-all duration-150 group"
                style={{ background: "rgba(0,180,255,0.03)" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium leading-snug" style={{ color: "rgba(255,255,255,0.78)" }}>
                    View strategic patterns
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: "#475569" }}>
                    Cross-competitor analysis is ready
                  </div>
                </div>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0 ml-2 opacity-40 group-hover:opacity-70 transition-opacity">
                  <path d="M2.5 6H9.5M6.5 3L9.5 6L6.5 9" stroke="#00B4FF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            ) : (
              <div className="px-3 py-2.5">
                <div className="text-[10px] leading-relaxed" style={{ color: "#334155" }}>
                  Pattern analysis runs after your rivals generate enough signals. Check back after more activity is detected.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2.5 border-t"
        style={{ borderColor: "rgba(0,180,255,0.07)", background: "rgba(0,0,0,0.30)" }}
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
  planType = null,
  hasActiveSub = false,
  hasStrategyContent = false,
}: Props) {
  const [open, setOpen]                             = useState(false);
  const [userId, setUserId]                         = useState<string | null>(null);
  const [unlockedIds, setUnlockedIds]               = useState<Set<string>>(new Set());
  const [completedActionIds, setCompletedActionIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded]                         = useState(false);
  const [toasts, setToasts]                         = useState<Toast[]>([]);
  const [hasNew, setHasNew]                         = useState(false);

  const [milestoneOverlay, setMilestoneOverlay] = useState<0 | 10 | 20>(0);

  const attemptedRef      = useRef(new Set<string>());
  const openRef           = useRef(open);
  const containerRef      = useRef<HTMLDivElement>(null);
  // Tracks unlockedIds.size across renders so we only fire overlays on transitions
  const prevAchCountRef   = useRef<number | null>(null);

  useEffect(() => { openRef.current = open; }, [open]);

  const intelScore = computeIntelScore(unlockedIds, completedActionIds);
  const isApex     = loaded && unlockedIds.size === ACHIEVEMENTS.length;

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
    if (competitorCount >= 10)  void unlock("deep_field");
    if (hasMovement)            void unlock("movement_detected");
    if (hasAccelerating)        void unlock("pressure_detected");
    if (hasCriticalAlert)       void unlock("critical_alert");
    if (hasCriticalAlert)       void unlock("singularity");
    if (totalSignals7d >= 10)   void unlock("signals_10");
    if (competitorCount >= 15 && hasMovement) void unlock("ancient_instinct");

    // Subscription achievements — fired when user holds an active paid plan
    if (hasActiveSub && planType === "analyst") void unlock("subscribed_analyst");
    if (hasActiveSub && planType === "pro") {
      void unlock("subscribed_analyst"); // pro implies analyst tier was reached
      void unlock("subscribed_pro");
    }
  }, [loaded, userId, totalSignals7d, competitorCount, hasMovement, hasCriticalAlert, hasAccelerating, hasActiveSub, planType, unlock]);

  // ── Sentinel: 5 continuous minutes on the radar ───────────────────────────────
  useEffect(() => {
    if (!loaded || !userId) return;
    const t = setTimeout(() => void unlock("sentinel"), 5 * 60 * 1000);
    return () => clearTimeout(t);
  }, [loaded, userId, unlock]);

  // ── The Long Game: track distinct calendar days ───────────────────────────────
  useEffect(() => {
    if (!loaded || !userId) return;
    try {
      const key = "mv_visit_dates";
      const today = new Date().toISOString().slice(0, 10);
      const stored = JSON.parse(localStorage.getItem(key) ?? "[]") as string[];
      const updated = [...new Set([...stored, today])];
      localStorage.setItem(key, JSON.stringify(updated));
      if (updated.length >= 3) void unlock("the_long_game");
    } catch { /* non-fatal */ }
  }, [loaded, userId, unlock]);

  // ── Listen for overlay-based unlock events ────────────────────────────────────
  useEffect(() => {
    function handler(e: Event) {
      const id = (e as CustomEvent<string>).detail as AchievementId;
      void unlock(id);
    }
    window.addEventListener("mv:achieve", handler);
    return () => window.removeEventListener("mv:achieve", handler);
  }, [unlock]);

  // ── Milestone overlay detection — fires only on threshold crossings ───────────
  // On initial load we record the current count without showing any overlay,
  // so pre-existing achievements never re-trigger the celebration.
  useEffect(() => {
    if (!loaded) return;
    const count = ACHIEVEMENTS.filter((a) => unlockedIds.has(a.id)).length;

    if (prevAchCountRef.current === null) {
      // First render after load — record baseline, do not show overlay
      prevAchCountRef.current = count;
      return;
    }

    const prev = prevAchCountRef.current;
    if (count >= 20 && prev < 20 && !localStorage.getItem("mv_milestone_20")) {
      localStorage.setItem("mv_milestone_20", "1");
      setMilestoneOverlay(20);
    } else if (count >= 10 && prev < 10 && !localStorage.getItem("mv_milestone_10")) {
      localStorage.setItem("mv_milestone_10", "1");
      setMilestoneOverlay(10);
    }
    prevAchCountRef.current = count;
  }, [loaded, unlockedIds]);

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
            borderColor: isApex ? "rgba(234,179,8,0.45)" : open || hasNew ? "rgba(0,180,255,0.45)" : "rgba(0,180,255,0.15)",
            background:  isApex ? "rgba(234,179,8,0.06)"  : open || hasNew ? "rgba(0,180,255,0.08)"  : "rgba(0,180,255,0.04)",
            color:       isApex ? "rgba(234,179,8,0.80)" : "rgba(0,180,255,0.70)",
            boxShadow:   isApex ? "0 0 14px rgba(234,179,8,0.14), inset 0 0 8px rgba(234,179,8,0.04)" : open || hasNew ? "0 0 12px rgba(0,180,255,0.20), inset 0 0 8px rgba(0,180,255,0.04)" : "none",
          }}
          aria-label="Intel Score — Achievements"
          aria-expanded={open}
        >
          {/* New achievement pulse dot */}
          {hasNew && !open && (
            <motion.span
              className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full"
              style={{ background: "#00B4FF", boxShadow: "0 0 6px #00B4FF" }}
              animate={{ scale: [1, 1.4, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            />
          )}

          {/* Icon: crown when apex, otherwise radar rings */}
          {isApex ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M1 9L3 4L6 7L9 2L11 4L11 9Z" fill="rgba(234,179,8,0.80)" stroke="rgba(234,179,8,0.50)" strokeWidth="0.6" strokeLinejoin="round" />
              <line x1="1" y1="10" x2="11" y2="10" stroke="rgba(234,179,8,0.60)" strokeWidth="1" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <circle cx="6" cy="6" r="5"   stroke="currentColor" strokeWidth="1"   strokeOpacity="0.5" />
              <circle cx="6" cy="6" r="2.8" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.7" />
              <circle cx="6" cy="6" r="1.2" fill="currentColor" />
            </svg>
          )}

          <span
            className="hidden sm:inline text-[10px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: isApex ? "rgba(234,179,8,0.55)" : "#64748b" }}
          >
            {isApex ? "Apex" : "Intel"}
          </span>
          <motion.span
            key={intelScore}
            initial={{ y: -6, opacity: 0 }}
            animate={{ y: 0,  opacity: 1 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="tabular-nums font-bold"
            style={{ color: "rgba(0,180,255,0.88)" }}
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
              hasStrategyContent={hasStrategyContent}
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

      {/* ── Milestone celebration overlay ───────────────────────────────────── */}
      <AnimatePresence>
        {milestoneOverlay !== 0 && (
          <MilestoneOverlay
            tier={milestoneOverlay as 10 | 20}
            onDismiss={() => setMilestoneOverlay(0)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
