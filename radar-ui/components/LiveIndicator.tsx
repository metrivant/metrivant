"use client";

import { motion } from "framer-motion";

/**
 * Live status indicator with a constant slow echo pulse.
 *
 * The echo ring expands and fades continuously at low frequency —
 * radar energy, not a notification badge.
 * The existing fast ping remains for active/fresh state.
 */
export default function LiveIndicator({
  isQuiet,
  isFresh,
  statusText,
  showStaleWarning,
}: {
  isQuiet: boolean;
  isFresh: boolean;
  statusText: string;
  showStaleWarning: boolean;
}) {
  const dotColor = isQuiet
    ? "#475569"
    : isFresh
    ? "#2EE6A6"
    : "#f59e0b";

  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-[6px] w-[6px] shrink-0">
        {/* Constant slow echo pulse — low-frequency radar energy */}
        <motion.span
          className="absolute rounded-full"
          style={{ inset: "-5px", background: dotColor }}
          animate={{
            scale: [1, 3.2, 4.0],
            opacity: [0.28, 0.08, 0],
          }}
          transition={{
            duration: 3.2,
            repeat: Infinity,
            ease: "easeOut",
            repeatDelay: 0.8,
          }}
        />

        {/* Fast ping — only when actively fresh */}
        {!isQuiet && isFresh && (
          <span className="absolute inset-0 animate-ping rounded-full bg-[#2EE6A6] opacity-55" />
        )}

        {/* Core dot */}
        <span
          className="relative h-[6px] w-[6px] rounded-full"
          style={{
            backgroundColor: dotColor,
            boxShadow:
              !isQuiet && isFresh
                ? "0 0 6px rgba(46,230,166,0.7)"
                : undefined,
          }}
        />
      </span>

      <span className="text-[11px] leading-none text-slate-400">
        {statusText}
        {showStaleWarning && (
          <span className="ml-2 text-amber-500/80">· data may be out of date</span>
        )}
      </span>
    </div>
  );
}
