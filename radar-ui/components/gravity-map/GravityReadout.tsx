"use client";

import { motion } from "framer-motion";
import type { GravityNode } from "./gravityMath";

type Props = {
  node:    GravityNode;
  onClose: () => void;
};

function MassBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="mb-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-700">{label}</span>
        <span className="font-mono text-[10px] tabular-nums text-slate-400">{pct}%</span>
      </div>
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-[#0a1a0a]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, rgba(40,80,140,0.9), rgba(180,120,60,0.9))",
          }}
        />
      </div>
    </div>
  );
}

export default function GravityReadout({ node, onClose }: Props) {
  const massRawPct   = Math.round(node.mass_score_raw * 100);
  const massVisualPct = Math.round(node.mass_score_visual * 100);
  const relativePct  = Math.round(node.relative_mass_pct);

  return (
    <motion.div
      key="gravity-readout"
      className="absolute right-0 top-0 bottom-0 z-20 w-[320px] overflow-y-auto"
      style={{
        background:         "rgba(0,1,0,0.95)",
        backdropFilter:     "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderLeft:         "1px solid rgba(40,80,140,0.30)",
        boxShadow:          "-12px 0 48px rgba(0,0,0,0.85)",
      }}
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      {/* Top accent */}
      <div
        className="absolute inset-x-0 top-0 h-[1px]"
        style={{ background: "linear-gradient(90deg, transparent, rgba(60,120,160,0.50), transparent)" }}
      />

      <div className="p-5">

        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 font-mono text-[9px] font-bold uppercase tracking-[0.28em] text-slate-700">
              Gravity Profile
            </div>
            <h2 className="truncate text-[19px] font-bold leading-tight tracking-tight text-white">
              {node.name}
            </h2>
            {node.website_url && (
              <a
                href={node.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 block font-mono text-[10px] text-slate-700 transition-colors hover:text-slate-400"
              >
                {node.website_url.replace(/^https?:\/\//, "")} ↗
              </a>
            )}
            <div className="mt-2 flex items-center gap-2">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Rank #{node.rank + 1}
              </span>
              <span className="text-slate-800">·</span>
              <span className="font-mono text-[9px] text-slate-600">
                {relativePct}% of peak mass
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border border-[#1a2a1a] text-slate-600 transition-colors hover:border-[#2a4a2a] hover:text-slate-300"
            aria-label="Close readout"
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
              <path d="M1 1l7 7M8 1L1 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Divider */}
        <div className="mb-4 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(40,80,140,0.25) 40%, rgba(40,80,140,0.25) 60%, transparent)" }} />

        {/* Mass score */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="rounded-[10px] border border-[#0a1a0a] bg-[#020602] p-3.5">
            <div className="font-mono text-[9px] uppercase tracking-[0.20em] text-slate-700">
              Mass (raw)
            </div>
            <div
              className="mt-1.5 text-[24px] font-bold tabular-nums"
              style={{ color: massRawPct > 50 ? "rgba(180,120,60,0.95)" : "rgba(60,120,160,0.85)" }}
            >
              {massRawPct}
            </div>
            <div className="font-mono text-[8px] text-slate-800">/ 100</div>
          </div>
          <div className="rounded-[10px] border border-[#0a1a0a] bg-[#020602] p-3.5">
            <div className="font-mono text-[9px] uppercase tracking-[0.20em] text-slate-700">
              Relative force
            </div>
            <div
              className="mt-1.5 text-[24px] font-bold tabular-nums"
              style={{ color: relativePct > 60 ? "rgba(200,60,40,0.90)" : relativePct > 20 ? "rgba(180,120,60,0.90)" : "rgba(60,120,160,0.75)" }}
            >
              {relativePct}%
            </div>
            <div className="font-mono text-[8px] text-slate-800">of leader</div>
          </div>
        </div>

        {/* Mass breakdown bars */}
        <div className="mb-4 rounded-[10px] border border-[#0a1a0a] bg-[#020602] px-4 py-3.5">
          <div className="mb-3 font-mono text-[9px] uppercase tracking-[0.20em] text-slate-700">
            Mass components
          </div>
          <MassBar value={Math.min(1, node.signal_count_7d / 10)}   label="Signals 7d"      />
          <MassBar value={node.avg_confidence}                        label="Avg confidence"  />
          <MassBar value={Math.min(1, node.movement_count / 5)}       label="Movements"       />
          <MassBar value={Math.min(1, node.pressure_index / 10)}      label="Pressure index"  />
          <MassBar value={Math.min(1, (node.avg_urgency ?? 0) / 5)}   label="Avg urgency"     />
        </div>

        {/* Pipeline metrics */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          {[
            { label: "Signals 7d",  value: node.signal_count_7d },
            { label: "Movements",   value: node.movement_count  },
            { label: "Pressure",    value: node.pressure_index.toFixed(1) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-[10px] border border-[#0a1a0a] bg-[#020602] p-2.5">
              <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-700">{label}</div>
              <div className="mt-1 text-[14px] font-bold tabular-nums text-slate-200">{value}</div>
            </div>
          ))}
        </div>

        {/* Top intelligence */}
        {node.top_interpretation_summary && (
          <div className="mb-4 rounded-[10px] border border-[#0a1a0a] bg-[#020602] px-4 py-3.5">
            <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.20em] text-slate-700">
              Latest signal
            </div>
            <p className="text-[12px] leading-relaxed text-slate-400">
              {node.top_interpretation_summary}
            </p>
          </div>
        )}

        {/* Visual mass (for operator transparency) */}
        <div className="mb-5 rounded-[10px] border border-[#0a1a0a] bg-[#020602] px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-700">
              Well depth (visual)
            </span>
            <span className="font-mono text-[10px] tabular-nums text-slate-500">
              {massVisualPct}
            </span>
          </div>
          <div className="mt-1.5 font-mono text-[8px] leading-relaxed text-slate-800">
            raw^0.4 — perceptual scaling applied
          </div>
        </div>

        {/* Radar link */}
        <a
          href="/app"
          className="flex items-center gap-1.5 font-mono text-[10px] transition-opacity"
          style={{ color: "rgba(46,230,166,0.45)" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(46,230,166,0.85)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(46,230,166,0.45)")}
        >
          <svg width="10" height="10" viewBox="0 0 46 46" fill="none" aria-hidden="true">
            <circle cx="23" cy="23" r="21.5" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.6" />
            <circle cx="23" cy="23" r="13"   stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
            <circle cx="23" cy="23" r="2.5"  fill="currentColor" />
          </svg>
          View in Radar →
        </a>
      </div>
    </motion.div>
  );
}
