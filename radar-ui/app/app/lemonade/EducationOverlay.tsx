"use client";

import { motion } from "framer-motion";

// ── Content ───────────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    n: "01",
    title: "The Street",
    body: "Each lemonade stand is a competitor in your market. The street is your competitive landscape — everyone is selling something, and Metrivant watches who's making moves.",
  },
  {
    n: "02",
    title: "Stand Size",
    body: "Bigger stands have more momentum. A larger stand means this competitor has been more active recently — more detected changes, more signals, more strategic movement.",
  },
  {
    n: "03",
    title: "Awning Color",
    body: "The awning color shows the type of strategic move detected. Red = pricing shift. Blue = new features. Green = repositioning. Purple = enterprise push. Yellow = ecosystem expansion.",
  },
  {
    n: "04",
    title: "Price Board",
    body: "Shows a representative pricing signal. If the board has a crossed-out price, Metrivant detected a pricing strategy shift on this competitor's monitored pages.",
  },
  {
    n: "05",
    title: "Signal Count",
    body: "The center panel shows how many signals were detected in the last 7 days. A signal is a meaningful detected change on a competitor's website — pricing, features, messaging.",
  },
  {
    n: "06",
    title: "The Poster",
    body: "The vertical poster shows their latest strategic movement type — determined by the interpretation engine, which clusters related signals into actionable strategic patterns.",
  },
  {
    n: "07",
    title: "The Drawer",
    body: "Click any stand to open the intelligence drawer. It shows momentum score, confidence level, recent signals with timestamps, and the strategic summary.",
  },
  {
    n: "08",
    title: "Same Data",
    body: "This view uses the exact same intelligence data as the Radar. No summaries, no fabrication — every stand, color, and number is derived from detected website changes.",
  },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export default function EducationOverlay({ onClose }: Props) {
  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-center justify-center bg-[rgba(0,2,0,0.88)] backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="relative mx-4 max-h-[82vh] w-full max-w-2xl overflow-y-auto rounded-[20px] border border-[#0e2210] bg-[#030803] p-8"
        initial={{ scale: 0.96, y: 14 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 10 }}
        transition={{ type: "spring", stiffness: 320, damping: 36 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent line */}
        <div
          className="absolute inset-x-0 top-0 h-[1px] rounded-t-[20px]"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(234,179,8,0.35) 40%, rgba(234,179,8,0.55) 50%, rgba(234,179,8,0.35) 60%, transparent)",
          }}
        />

        {/* Header */}
        <div className="mb-7 flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-[#d97706]/70">
              Metrivant
            </div>
            <h2 className="mt-0.5 text-[22px] font-bold tracking-wide text-white">
              How This Works
            </h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">
              The Lemonade Stand view is a plain-English metaphor for your competitive intelligence. Every visual element maps to real detected data.
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 mt-1 shrink-0 rounded-full p-2 text-slate-600 transition-colors hover:text-slate-300"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M2 2l10 10M12 2L2 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Sections */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <div
              key={s.n}
              className="rounded-[14px] border border-[#0e2210] bg-[#060d06] px-4 py-3.5"
            >
              <div className="mb-1.5 flex items-center gap-2.5">
                <span className="text-[10px] font-bold tabular-nums text-[#d97706]/45">
                  {s.n}
                </span>
                <span className="text-[13px] font-semibold text-slate-200">
                  {s.title}
                </span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-slate-500">
                {s.body}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-6 border-t border-[#0e2210] pt-5 text-center">
          <button
            onClick={onClose}
            className="rounded-full border border-[#1a3a1a] px-6 py-2.5 text-[12px] font-medium text-slate-400 transition-colors hover:border-[#2EE6A6]/30 hover:text-white"
          >
            Got it
          </button>
          <p className="mt-3 text-[10.5px] text-slate-700">
            Switch back to the radar view for full signal analysis and evidence chains.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
