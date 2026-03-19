"use client";

import { useState, useEffect, lazy, Suspense } from "react";

const PipelineSchematic = lazy(() => import("./PipelineSchematic"));

// ── Orchestrator: trigger button + lazy-loaded schematic overlay ──────────────

export default function PipelineTrigger() {
  const [isOpen, setIsOpen] = useState(false);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  return (
    <>
      <TriggerButton onClick={() => setIsOpen(!isOpen)} isOpen={isOpen} />

      {isOpen && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,2,0,0.97)]">
              <div className="flex items-center gap-3">
                <div
                  className="h-2 w-2 animate-pulse rounded-full"
                  style={{ backgroundColor: "#2EE6A6", boxShadow: "0 0 8px #2EE6A6" }}
                />
                <span className="font-mono text-[11px] text-slate-600">
                  Loading schematic...
                </span>
              </div>
            </div>
          }
        >
          <PipelineSchematic onClose={() => setIsOpen(false)} />
        </Suspense>
      )}
    </>
  );
}

// ── Trigger button with CSS 3D valve symbol ──────────────────────────────────

function TriggerButton({ onClick, isOpen }: { onClick: () => void; isOpen: boolean }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative flex items-center gap-3 rounded-[12px] border px-4 py-2.5 transition-all duration-300"
      style={{
        borderColor: isOpen ? "rgba(46,230,166,0.35)" : "#0e1e0e",
        background: isOpen
          ? "linear-gradient(135deg, rgba(46,230,166,0.08) 0%, rgba(2,8,2,0.95) 60%)"
          : "rgba(2,8,2,0.80)",
        boxShadow: isOpen
          ? "0 0 20px rgba(46,230,166,0.12), inset 0 0 15px rgba(46,230,166,0.04)"
          : hovered
            ? "0 0 12px rgba(46,230,166,0.06)"
            : "none",
      }}
    >
      {/* 3D valve symbol */}
      <div
        className="relative flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-300"
        style={{
          borderColor: isOpen ? "rgba(46,230,166,0.40)" : "rgba(46,230,166,0.15)",
          background: "rgba(2,8,2,0.95)",
          transform: `perspective(600px) rotateX(${hovered || isOpen ? 12 : 0}deg) rotateY(${hovered || isOpen ? -8 : 0}deg)`,
          boxShadow: isOpen ? "0 0 10px rgba(46,230,166,0.15)" : "none",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle
            cx="8" cy="8" r="5.5"
            stroke="#2EE6A6" strokeWidth="1"
            strokeOpacity={isOpen ? 0.6 : 0.25}
          />
          <line
            x1="8" y1="4" x2="8" y2="12"
            stroke="#2EE6A6" strokeWidth="1.2"
            strokeOpacity={isOpen ? 0.7 : 0.35}
          />
          <line
            x1="4" y1="8" x2="12" y2="8"
            stroke="#2EE6A6" strokeWidth="1.2"
            strokeOpacity={isOpen ? 0.7 : 0.35}
          />
        </svg>
      </div>

      {/* Label */}
      <div className="flex flex-col text-left">
        <span
          className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] transition-colors duration-200"
          style={{ color: isOpen ? "#2EE6A6" : "rgba(148,163,184,0.6)" }}
        >
          {isOpen ? "Close Schematic" : "Pipeline Schematic"}
        </span>
        <span className="text-[9px] text-slate-700">
          {isOpen ? "ESC to dismiss" : "Interactive system diagram"}
        </span>
      </div>

      {/* Chevron */}
      <svg
        width="10" height="10" viewBox="0 0 10 10" fill="none"
        className="ml-1 transition-transform duration-300"
        style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)" }}
        aria-hidden
      >
        <path
          d="M2 3.5L5 6.5L8 3.5"
          stroke="rgba(148,163,184,0.4)"
          strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
