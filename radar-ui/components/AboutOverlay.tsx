"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

// ── Mini SVG icons ─────────────────────────────────────────────────────────────

function IconRadar() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="12.5" stroke="#2EE6A6" strokeWidth="0.8" strokeOpacity="0.30" />
      <circle cx="14" cy="14" r="8.5"  stroke="#2EE6A6" strokeWidth="0.7" strokeOpacity="0.20" />
      <circle cx="14" cy="14" r="4.5"  stroke="#2EE6A6" strokeWidth="0.7" strokeOpacity="0.28" />
      <path d="M14 14 L10.5 2.2 A12.5 12.5 0 0 1 22 5.8 Z" fill="#2EE6A6" fillOpacity="0.12" />
      <line x1="14" y1="14" x2="22" y2="5.8" stroke="#2EE6A6" strokeWidth="1" strokeOpacity="0.70" />
      <circle cx="14" cy="14" r="1.6" fill="#2EE6A6" fillOpacity="0.9" />
      <circle cx="20" cy="9"  r="1.4" fill="#2EE6A6" fillOpacity="0.55" />
      <circle cx="8"  cy="18" r="1"   fill="#2EE6A6" fillOpacity="0.30" />
    </svg>
  );
}

function IconSignal() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="4"  y="16" width="4" height="8"  rx="1" fill="#2EE6A6" fillOpacity="0.25" />
      <rect x="12" y="11" width="4" height="13" rx="1" fill="#2EE6A6" fillOpacity="0.45" />
      <rect x="20" y="5"  width="4" height="19" rx="1" fill="#2EE6A6" fillOpacity="0.70" />
      <circle cx="22" cy="4" r="2" fill="#2EE6A6" fillOpacity="0.85" />
    </svg>
  );
}

function IconAI() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="6" stroke="#2EE6A6" strokeWidth="0.8" strokeOpacity="0.35" />
      <circle cx="14" cy="14" r="2.2" fill="#2EE6A6" fillOpacity="0.60" />
      <line x1="14" y1="2"  x2="14" y2="7"  stroke="#2EE6A6" strokeWidth="1" strokeOpacity="0.28" />
      <line x1="14" y1="21" x2="14" y2="26" stroke="#2EE6A6" strokeWidth="1" strokeOpacity="0.28" />
      <line x1="2"  y1="14" x2="7"  y2="14" stroke="#2EE6A6" strokeWidth="1" strokeOpacity="0.28" />
      <line x1="21" y1="14" x2="26" y2="14" stroke="#2EE6A6" strokeWidth="1" strokeOpacity="0.28" />
      <line x1="5.5"  y1="5.5"  x2="9.3"  y2="9.3"  stroke="#2EE6A6" strokeWidth="1" strokeOpacity="0.18" />
      <line x1="18.7" y1="18.7" x2="22.5" y2="22.5" stroke="#2EE6A6" strokeWidth="1" strokeOpacity="0.18" />
      <line x1="22.5" y1="5.5"  x2="18.7" y2="9.3"  stroke="#2EE6A6" strokeWidth="1" strokeOpacity="0.18" />
      <line x1="9.3"  y1="18.7" x2="5.5"  y2="22.5" stroke="#2EE6A6" strokeWidth="1" strokeOpacity="0.18" />
    </svg>
  );
}

function IconMovement() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M4 20 L10 14 L16 17 L24 7" stroke="#2EE6A6" strokeWidth="1.2" strokeOpacity="0.55" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="7"  r="2"   fill="#2EE6A6" fillOpacity="0.85" />
      <circle cx="16" cy="17" r="1.4" fill="#2EE6A6" fillOpacity="0.40" />
      <circle cx="10" cy="14" r="1.2" fill="#2EE6A6" fillOpacity="0.28" />
      <path d="M20 7 L24 7 L24 11" stroke="#2EE6A6" strokeWidth="1" strokeOpacity="0.55" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBrief() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="5" y="4" width="18" height="20" rx="2.5" stroke="#2EE6A6" strokeWidth="0.8" strokeOpacity="0.28" />
      <line x1="9" y1="10" x2="19" y2="10" stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.55" strokeLinecap="round" />
      <line x1="9" y1="14" x2="19" y2="14" stroke="#2EE6A6" strokeWidth="0.8" strokeOpacity="0.35" strokeLinecap="round" />
      <line x1="9" y1="18" x2="15" y2="18" stroke="#2EE6A6" strokeWidth="0.8" strokeOpacity="0.25" strokeLinecap="round" />
      <circle cx="20" cy="6" r="4" fill="#000200" />
      <circle cx="20" cy="6" r="3.5" stroke="#2EE6A6" strokeWidth="0.8" strokeOpacity="0.55" />
      <path d="M18.5 6l1 1 2-2" stroke="#2EE6A6" strokeWidth="1" strokeOpacity="0.80" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconMap() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="22" height="22" rx="2" stroke="#2EE6A6" strokeWidth="0.7" strokeOpacity="0.22" />
      <line x1="14" y1="3"  x2="14" y2="25" stroke="#2EE6A6" strokeWidth="0.5" strokeOpacity="0.18" strokeDasharray="2 3" />
      <line x1="3"  y1="14" x2="25" y2="14" stroke="#2EE6A6" strokeWidth="0.5" strokeOpacity="0.18" strokeDasharray="2 3" />
      <circle cx="9"  cy="9"  r="2.2" fill="#2EE6A6" fillOpacity="0.28" />
      <circle cx="19" cy="8"  r="1.6" fill="#2EE6A6" fillOpacity="0.40" />
      <circle cx="8"  cy="18" r="1.4" fill="#2EE6A6" fillOpacity="0.22" />
      <circle cx="20" cy="20" r="2.8" fill="#2EE6A6" fillOpacity="0.55" />
      <circle cx="14" cy="12" r="1.8" fill="#2EE6A6" fillOpacity="0.35" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="11.5" stroke="#f59e0b" strokeWidth="0.8" strokeOpacity="0.22" />
      <circle cx="14" cy="14" r="7.5"  stroke="#f59e0b" strokeWidth="0.8" strokeOpacity="0.35" strokeDasharray="2 2" />
      <circle cx="14" cy="14" r="3.5"  fill="#f59e0b" fillOpacity="0.55" />
      <circle cx="14" cy="14" r="1.5"  fill="#f59e0b" fillOpacity="0.90" />
    </svg>
  );
}

function IconEvidence() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="4"  y="6"  width="10" height="7" rx="1.5" stroke="#2EE6A6" strokeWidth="0.8" strokeOpacity="0.25" />
      <rect x="14" y="15" width="10" height="7" rx="1.5" stroke="#2EE6A6" strokeWidth="0.8" strokeOpacity="0.55" />
      <line x1="9"  y1="13" x2="9"  y2="22" stroke="#2EE6A6" strokeWidth="0.6" strokeOpacity="0.20" strokeDasharray="1.5 2" />
      <line x1="9"  y1="22" x2="14" y2="18" stroke="#2EE6A6" strokeWidth="0.6" strokeOpacity="0.20" />
      <line x1="6"  y1="9"  x2="10" y2="9"  stroke="#2EE6A6" strokeWidth="0.8" strokeOpacity="0.40" strokeLinecap="round" />
      <line x1="6"  y1="11" x2="8"  y2="11" stroke="#2EE6A6" strokeWidth="0.8" strokeOpacity="0.28" strokeLinecap="round" />
      <line x1="16" y1="18" x2="21" y2="18" stroke="#2EE6A6" strokeWidth="0.8" strokeOpacity="0.60" strokeLinecap="round" />
      <line x1="16" y1="20" x2="19" y2="20" stroke="#2EE6A6" strokeWidth="0.8" strokeOpacity="0.40" strokeLinecap="round" />
    </svg>
  );
}

function IconStrategy() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="3"  fill="#2EE6A6" fillOpacity="0.55" />
      <circle cx="6"  cy="8"  r="2"  fill="#2EE6A6" fillOpacity="0.28" />
      <circle cx="22" cy="8"  r="2"  fill="#2EE6A6" fillOpacity="0.28" />
      <circle cx="6"  cy="20" r="2"  fill="#2EE6A6" fillOpacity="0.28" />
      <circle cx="22" cy="20" r="2"  fill="#2EE6A6" fillOpacity="0.28" />
      <line x1="8"  y1="9"  x2="12" y2="12" stroke="#2EE6A6" strokeWidth="0.7" strokeOpacity="0.30" />
      <line x1="20" y1="9"  x2="16" y2="12" stroke="#2EE6A6" strokeWidth="0.7" strokeOpacity="0.30" />
      <line x1="8"  y1="19" x2="12" y2="16" stroke="#2EE6A6" strokeWidth="0.7" strokeOpacity="0.30" />
      <line x1="20" y1="19" x2="16" y2="16" stroke="#2EE6A6" strokeWidth="0.7" strokeOpacity="0.30" />
      <line x1="6"  y1="10" x2="6"  y2="18" stroke="#2EE6A6" strokeWidth="0.5" strokeOpacity="0.18" />
      <line x1="22" y1="10" x2="22" y2="18" stroke="#2EE6A6" strokeWidth="0.5" strokeOpacity="0.18" />
    </svg>
  );
}

function IconDiscover() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" stroke="#2EE6A6" strokeWidth="0.8" strokeOpacity="0.35" />
      <line x1="17.5" y1="17.5" x2="24" y2="24" stroke="#2EE6A6" strokeWidth="1.2" strokeOpacity="0.55" strokeLinecap="round" />
      <line x1="9"  y1="12" x2="15" y2="12" stroke="#2EE6A6" strokeWidth="0.9" strokeOpacity="0.50" strokeLinecap="round" />
      <line x1="12" y1="9"  x2="12" y2="15" stroke="#2EE6A6" strokeWidth="0.9" strokeOpacity="0.50" strokeLinecap="round" />
    </svg>
  );
}

// ── Feature data ───────────────────────────────────────────────────────────────

const FEATURES = [
  {
    Icon: IconRadar,
    tag: "Live Radar",
    headline: "Your market, rendered as a precision instrument.",
    body: "Up to 50 competitors plotted in real time by momentum score. The nodes closest to the boundary are accelerating. At a glance, you know exactly who demands your attention — before the rest of the market does.",
  },
  {
    Icon: IconSignal,
    tag: "Signal Detection",
    headline: "Every change on every competitor page. Automatically.",
    body: "Pricing tables, feature announcements, product positioning, hiring patterns — Metrivant watches it all. When something shifts, it surfaces as a signal, not a raw notification. You get intelligence, not noise.",
  },
  {
    Icon: IconAI,
    tag: "AI Interpretation",
    headline: "Pattern recognition at the speed of the market.",
    body: "Each signal is analyzed by GPT-4o to determine strategic intent. Is this a real pricing move or a cosmetic tweak? A feature launch or a UI refresh? Confidence scores tell you how certain to be. Calibrated language tells you how to act.",
  },
  {
    Icon: IconMovement,
    tag: "Strategic Movements",
    headline: "See the trajectory. Not just the snapshot.",
    body: "Individual signals combine into confirmed movement events — with velocity, signal count, and timing. You don't just know what changed. You know where your rival is going and how fast they're moving.",
  },
  {
    Icon: IconAlert,
    tag: "Real-time Alerts",
    headline: "Critical acceleration, surfaced the moment it happens.",
    body: "When a competitor hits the accelerating threshold — high momentum, fresh signals, confirmed movement — Metrivant fires a critical alert. Not a daily digest. Not a weekly report. Right now, before anyone else knows.",
  },
  {
    Icon: IconBrief,
    tag: "Intelligence Briefs",
    headline: "A weekly briefing that reads like it was written by your analyst.",
    body: "Every week, GPT-4o synthesizes detected movements into a strategic digest: what moved, what it implies, and what you should do about it. Clear. Actionable. Evidence-backed.",
  },
  {
    Icon: IconMap,
    tag: "Market Positioning Map",
    headline: "The competitive landscape, mapped in two dimensions.",
    body: "A live 2×2 positioning chart scoring every competitor on Market Focus and Customer Segment. Watch rivals drift upmarket. Spot the platform play before it's announced. Know the field before you compete on it.",
  },
  {
    Icon: IconStrategy,
    tag: "Strategy Panel",
    headline: "When the whole market moves, you'll see it first.",
    body: "Cross-competitor pattern analysis detects feature convergence, pricing wars, enterprise shifts, and category expansions — across all rivals simultaneously. Patterns that no single-competitor view could surface.",
  },
  {
    Icon: IconEvidence,
    tag: "Evidence Chain",
    headline: "Every signal traceable to its source. Zero hallucinations.",
    body: "Click any signal and see the raw page diff that triggered it. Previous text versus current text. Exactly which page. Exactly when. Metrivant doesn't guess — it shows its work. Trust is built into the architecture.",
  },
  {
    Icon: IconDiscover,
    tag: "Competitor Discovery",
    headline: "Your sector, catalogued. Ready to track instantly.",
    body: "Browse a curated catalog of competitors across SaaS, Defense, Energy, and more. Add rivals to your radar in one click. Sector-aware terminology means every movement type is expressed in the language your market actually uses.",
  },
] as const;

// ── Component ──────────────────────────────────────────────────────────────────

export default function AboutOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // Keyboard close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[200]"
            style={{ background: "rgba(0,2,0,0.72)", backdropFilter: "blur(4px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="fixed inset-y-0 right-0 z-[201] flex w-full flex-col bg-[#000200] md:w-[520px]"
            style={{
              borderLeft: "1px solid #0e2210",
              boxShadow: "-24px 0 80px rgba(0,0,0,0.85)",
            }}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.30, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Atmospheric depth */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 80% 40% at 50% -8%, rgba(46,230,166,0.055) 0%, transparent 65%)",
              }}
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: "radial-gradient(rgba(255,255,255,0.85) 0.5px, transparent 0.5px)",
                backgroundSize: "6px 6px",
                opacity: 0.013,
              }}
            />

            {/* Header */}
            <div
              className="relative z-10 flex h-12 shrink-0 items-center justify-between border-b border-[#0e2210] px-5"
              style={{ background: "rgba(0,0,0,0.60)" }}
            >
              {/* Top accent line */}
              <div
                className="absolute inset-x-0 top-0 h-[1px]"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(46,230,166,0.28) 40%, rgba(46,230,166,0.45) 50%, rgba(46,230,166,0.28) 60%, transparent 100%)",
                }}
              />

              <div className="flex items-center gap-3">
                <span
                  className="font-mono text-[9px] font-bold uppercase tracking-[0.30em]"
                  style={{ color: "rgba(46,230,166,0.55)" }}
                >
                  METRIVANT
                </span>
                <span style={{ color: "rgba(46,230,166,0.20)" }}>·</span>
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">
                  Intelligence Platform
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="hidden text-[10px] text-slate-700 md:inline">ESC to close</span>
                <button
                  onClick={onClose}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[#1a3020] bg-[#070d07] transition-colors hover:border-[#2a4a30]"
                  style={{ color: "rgba(46,230,166,0.55)" }}
                  aria-label="Close"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Intro block */}
            <div className="relative z-10 border-b border-[#0a1a0a] px-6 py-6">
              <p className="text-[13px] font-medium leading-relaxed text-slate-300">
                Metrivant is a competitive intelligence radar — built for operators who need to know what their rivals are doing before the rest of the market does.
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-slate-600">
                Every output is grounded in real evidence. Every signal traceable to a real page change. No speculation. No noise. Pure intelligence.
              </p>
            </div>

            {/* Feature list */}
            <div className="relative z-10 flex-1 overflow-y-auto px-5 py-5">
              <div
                className="mb-4 text-[9px] font-semibold uppercase tracking-[0.28em]"
                style={{ color: "rgba(46,230,166,0.40)" }}
              >
                Platform Features
              </div>

              <div className="space-y-2">
                {FEATURES.map(({ Icon, tag, headline, body }) => (
                  <div
                    key={tag}
                    className="group rounded-[14px] border border-[#0d1e0d] px-4 py-4 transition-colors hover:border-[#1a3020]"
                    style={{ background: "#020802" }}
                  >
                    <div className="flex items-start gap-3.5">
                      {/* Icon */}
                      <div className="mt-0.5 shrink-0 opacity-80 transition-opacity group-hover:opacity-100">
                        <Icon />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div
                          className="mb-1 text-[9px] font-bold uppercase tracking-[0.22em]"
                          style={{ color: "rgba(46,230,166,0.55)" }}
                        >
                          {tag}
                        </div>
                        <div className="mb-1.5 text-[12px] font-semibold leading-snug text-white">
                          {headline}
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-500">
                          {body}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer CTA */}
            <div
              className="relative z-10 border-t border-[#0d1e0d] px-5 py-4"
              style={{ background: "rgba(0,0,0,0.40)" }}
            >
              <div
                className="absolute inset-x-0 bottom-0 h-[1px]"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(46,230,166,0.12), transparent)",
                }}
              />
              <div className="flex items-center gap-3">
                <Link
                  href="/signup"
                  onClick={onClose}
                  className="flex-1 rounded-full bg-[#2EE6A6] py-2.5 text-center text-[12px] font-semibold text-black transition-opacity hover:opacity-90"
                >
                  Start free trial
                </Link>
                <Link
                  href="/pricing"
                  onClick={onClose}
                  className="flex-1 rounded-full border border-[#1a3020] py-2.5 text-center text-[12px] font-medium text-slate-400 transition-colors hover:border-[rgba(46,230,166,0.25)] hover:text-slate-200"
                >
                  See pricing →
                </Link>
              </div>
              <p className="mt-2.5 text-center text-[10px] text-slate-700">
                Free trial included · From $9/mo · No card required
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
