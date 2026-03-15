"use client";

import { motion } from "framer-motion";
import { ACHIEVEMENTS } from "../lib/achievements";

// ── Types ──────────────────────────────────────────────────────────────────────

type PlanKey = "analyst" | "pro";

interface Props {
  plan:              PlanKey;
  status:            "active" | "canceled_active" | "past_due";
  currentPeriodEnd:  string | null;
  canManageBilling:  boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

const PLAN_LABEL: Record<PlanKey, string> = {
  analyst: "Analyst",
  pro:     "Pro",
};

const PLAN_TAGLINE: Record<PlanKey, string> = {
  analyst: "Full signal intelligence. Active.",
  pro:     "Maximum intelligence. Active.",
};

const PLAN_PRICE: Record<PlanKey, string> = {
  analyst: "$9 / mo",
  pro:     "$19 / mo",
};

// Achievement IDs tied to each plan
const PLAN_ACHIEVEMENT_ID: Record<PlanKey, "subscribed_analyst" | "subscribed_pro"> = {
  analyst: "subscribed_analyst",
  pro:     "subscribed_pro",
};

// ── Achievement badge icon (inline, matches AchievementsButton.tsx palette) ───

function AchievIcon({ id, color }: { id: string; color: string }) {
  if (id === "subscribed_analyst") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
  }
  // subscribed_pro
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10"  stroke={color} strokeWidth="0.9" strokeOpacity="0.28" />
      <circle cx="12" cy="12" r="6.5" stroke={color} strokeWidth="0.9" strokeOpacity="0.48" />
      <circle cx="12" cy="12" r="3.2" stroke={color} strokeWidth="0.9" strokeOpacity="0.68" />
      <circle cx="12" cy="12" r="1.4" fill={color} />
      <path d="M12 12 L12 2 A10 10 0 0 1 21.66 17 Z" fill={color} fillOpacity="0.10" />
      <line x1="12" y1="12" x2="12" y2="2" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.80" />
      <circle cx="18.5" cy="6.5" r="1.6" fill={color} fillOpacity="0.82" />
      <circle cx="18.5" cy="6.5" r="3"   stroke={color} strokeWidth="0.7" strokeOpacity="0.28" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SubscribedStatusSurface({
  plan,
  status,
  currentPeriodEnd,
  canManageBilling,
}: Props) {
  const achievementId = PLAN_ACHIEVEMENT_ID[plan];
  const achievementDef = ACHIEVEMENTS.find((a) => a.id === achievementId);

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative mb-4 overflow-hidden rounded-[16px] border"
      style={{
        background:   "radial-gradient(ellipse 120% 80% at 50% 0%, rgba(46,230,166,0.06) 0%, rgba(0,8,2,0.98) 65%)",
        borderColor:  "rgba(46,230,166,0.18)",
        boxShadow:    "0 0 48px rgba(46,230,166,0.04), inset 0 0 32px rgba(46,230,166,0.02)",
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute inset-x-0 top-0 h-[1px]"
        style={{ background: "linear-gradient(90deg, transparent, rgba(46,230,166,0.55), transparent)" }}
      />

      <div className="p-6 sm:p-8">

        {/* Plan badge + tagline */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.28em]" style={{ color: "rgba(46,230,166,0.45)" }}>
              Active subscription
            </div>

            {/* Plan name with subtle glow pulse */}
            <div className="flex items-baseline gap-3">
              <motion.span
                animate={{ textShadow: ["0 0 0px rgba(46,230,166,0)", "0 0 16px rgba(46,230,166,0.40)", "0 0 0px rgba(46,230,166,0)"] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 2 }}
                className="text-[26px] font-bold text-white leading-none tracking-tight"
              >
                {PLAN_LABEL[plan]}
              </motion.span>
              <span className="text-[13px] text-slate-500 font-medium">{PLAN_PRICE[plan]}</span>
            </div>

            <div className="mt-2 text-[12px] font-medium" style={{ color: "#2EE6A6" }}>
              {PLAN_TAGLINE[plan]}
            </div>
          </div>

          {/* Active indicator orb */}
          <div className="shrink-0 flex items-center gap-2 mt-1">
            <motion.span
              className="block h-2 w-2 rounded-full"
              style={{ background: "#2EE6A6", boxShadow: "0 0 8px rgba(46,230,166,0.70)" }}
              animate={{ opacity: [1, 0.45, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "rgba(46,230,166,0.55)" }}>
              Live
            </span>
          </div>
        </div>

        {/* Renewal / cancellation line */}
        <div className="mb-6">
          {status === "active" && currentPeriodEnd && (
            <div className="flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <circle cx="6" cy="6" r="5" stroke="rgba(46,230,166,0.35)" strokeWidth="1" />
                <path d="M6 3V6.5L8.5 7.8" stroke="rgba(46,230,166,0.55)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[11px] text-slate-500">
                Renews <span className="text-slate-400">{fmtDate(currentPeriodEnd)}</span>
              </span>
            </div>
          )}
          {status === "canceled_active" && currentPeriodEnd && (
            <div className="flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <circle cx="6" cy="6" r="5" stroke="rgba(245,158,11,0.40)" strokeWidth="1" />
                <line x1="4" y1="4" x2="8" y2="8" stroke="#f59e0b" strokeWidth="1" strokeLinecap="round" />
                <line x1="8" y1="4" x2="4" y2="8" stroke="#f59e0b" strokeWidth="1" strokeLinecap="round" />
              </svg>
              <span className="text-[11px] text-amber-500/80">
                Canceled — access until <span className="text-amber-400/90">{fmtDate(currentPeriodEnd)}</span>
              </span>
            </div>
          )}
          {status === "past_due" && (
            <div className="flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M6 1L11 10H1L6 1Z" stroke="rgba(239,68,68,0.55)" strokeWidth="1" strokeLinejoin="round" fill="none" />
                <line x1="6" y1="4.5" x2="6" y2="7.2" stroke="#ef4444" strokeWidth="1" strokeLinecap="round" />
                <circle cx="6" cy="9" r="0.6" fill="#ef4444" />
              </svg>
              <span className="text-[11px] text-red-400/80">Payment issue — update required</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mb-5 h-[1px]" style={{ background: "rgba(46,230,166,0.07)" }} />

        {/* Achievement reward moment */}
        {achievementDef && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.40, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
            className="mb-5 flex items-center gap-3 rounded-[10px] px-3.5 py-3"
            style={{
              background:  "rgba(46,230,166,0.04)",
              border:      "1px solid rgba(46,230,166,0.10)",
            }}
          >
            <div className="shrink-0">
              <AchievIcon id={achievementId} color="#2EE6A6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-white/88 leading-snug">
                {achievementDef.name}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                {achievementDef.description}
              </div>
            </div>
            <div
              className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold tabular-nums"
              style={{ background: "rgba(46,230,166,0.12)", color: "#2EE6A6" }}
            >
              +{achievementDef.points}
            </div>
          </motion.div>
        )}

        {/* Manage subscription link */}
        {canManageBilling && (
          <form action="/api/stripe/portal" method="POST">
            <button
              type="submit"
              className="text-[11px] font-medium transition-opacity hover:opacity-75"
              style={{ color: "rgba(46,230,166,0.50)" }}
            >
              Manage subscription →
            </button>
          </form>
        )}
        {!canManageBilling && (
          <a
            href="mailto:billing@metrivant.com"
            className="text-[11px] font-medium transition-opacity hover:opacity-75"
            style={{ color: "rgba(46,230,166,0.50)" }}
          >
            Billing inquiries →
          </a>
        )}
      </div>
    </motion.section>
  );
}
