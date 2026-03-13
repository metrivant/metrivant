"use client";

import { motion } from "framer-motion";

/**
 * Competitive Situation Indicator.
 *
 * Live dot + most active rival + market pressure summary.
 * Replaces plain status text with a high-value intelligence module.
 */
export default function LiveIndicator({
  isQuiet,
  isFresh,
  topRival,
  marketPressure,
  showStaleWarning,
}: {
  isQuiet:       boolean;
  isFresh:       boolean;
  topRival:      { name: string; movementType: string | null } | null;
  marketPressure: string;
  showStaleWarning: boolean;
}) {
  const dotColor = isQuiet
    ? "#475569"
    : isFresh
    ? "#2EE6A6"
    : "#f59e0b";

  return (
    <div className="flex items-center gap-3">
      {/* Live dot */}
      <span className="relative flex h-[6px] w-[6px] shrink-0">
        <motion.span
          className="absolute rounded-full"
          style={{ inset: "-5px", background: dotColor }}
          animate={{ scale: [1, 3.2, 4.0], opacity: [0.28, 0.08, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeOut", repeatDelay: 0.8 }}
        />
        {!isQuiet && isFresh && (
          <span className="absolute inset-0 animate-ping rounded-full bg-[#2EE6A6] opacity-55" />
        )}
        <span
          className="relative h-[6px] w-[6px] rounded-full"
          style={{
            backgroundColor: dotColor,
            boxShadow: !isQuiet && isFresh ? "0 0 6px rgba(46,230,166,0.7)" : undefined,
          }}
        />
      </span>

      {/* Competitive situation */}
      {topRival ? (
        <div className="flex items-center gap-4">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-600">
              Most Active
            </div>
            <div className="mt-0.5 text-[12px] font-semibold leading-none text-slate-200">
              {topRival.name}
            </div>
          </div>
          <div className="h-5 w-px bg-[#0f2010]" />
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-600">
              Market
            </div>
            <div className="mt-0.5 text-[11px] font-medium leading-none text-slate-400">
              {marketPressure}
            </div>
          </div>
          {showStaleWarning && (
            <>
              <div className="h-5 w-px bg-[#0f2010]" />
              <span className="text-[10px] text-amber-500/70">Data may be stale</span>
            </>
          )}
        </div>
      ) : (
        <span className="text-[11px] text-slate-600">
          {isQuiet ? "Watching for movement" : "Signals incoming"}
        </span>
      )}
    </div>
  );
}
