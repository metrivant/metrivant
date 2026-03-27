"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PipelineExperience from "./PipelineExperience";

export default function PipelineOverlay({
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

          {/* Panel — full width for pipeline visualization */}
          <motion.div
            className="fixed inset-0 z-[201] flex flex-col overflow-auto bg-[#000002]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            {/* Header */}
            <div
              className="sticky top-0 z-10 flex items-center justify-between border-b border-[#0e1022] bg-[rgba(0,2,0,0.96)] px-6 py-5 backdrop-blur-xl md:px-8"
            >
              <div>
                <h2
                  className="text-[15px] font-bold uppercase tracking-[0.16em] text-white md:text-[16px]"
                  style={{ fontFamily: "var(--font-orbitron)" }}
                >
                  Pipeline
                </h2>
                <p
                  className="mt-0.5 text-[11px] tracking-[0.02em]"
                  style={{ color: "rgba(148,163,184,0.60)" }}
                >
                  Technical architecture and data flow
                </p>
              </div>

              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#0e1022] transition-colors hover:bg-[#0a1c0a]"
                aria-label="Close pipeline overlay"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <path d="M1 1l11 11M12 1L1 12" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Content — Pipeline visualization */}
            <div className="flex-1">
              <PipelineExperience />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
