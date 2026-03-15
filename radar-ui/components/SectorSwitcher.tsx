"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSectorLabel } from "../lib/sectors";

const SECTOR_OPTIONS = [
  { value: "ai-infrastructure",  label: "AI Infrastructure" },
  { value: "consumer-tech",      label: "Consumer Tech" },
  { value: "cybersecurity",      label: "Cybersecurity" },
  { value: "defense",            label: "Defense" },
  { value: "devtools",           label: "DevTools" },
  { value: "energy",             label: "Energy" },
  { value: "fintech",            label: "Fintech" },
  { value: "healthcare",         label: "Healthcare" },
  { value: "saas",               label: "Software" },
  { value: "custom",             label: "Custom" },
] as const;

type ToastState =
  | { type: "ok"; seeded: number; attempted: number; custom: boolean }
  | { type: "error" }
  | null;

export default function SectorSwitcher({
  sector,
  competitorCount = 0,
}: {
  sector: string;
  competitorCount?: number;
}) {
  const router = useRouter();
  const [open, setOpen]                   = useState(false);
  const [switching, setSwitching]         = useState(false);
  const [activeSector, setActiveSector]   = useState(sector);
  const [toast, setToast]                 = useState<ToastState>(null);
  const [slateHover, setSlateHover]       = useState(false);
  const [slateConfirm, setSlateConfirm]   = useState(false);
  const [slateLoading, setSlateLoading]   = useState(false);
  // pendingSwitch: sector awaiting confirmation before firing initialize-sector
  const [pendingSwitch, setPendingSwitch] = useState<{ value: string; label: string } | null>(null);
  const ref      = useRef<HTMLDivElement>(null);
  const slateRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setActiveSector(sector); }, [sector]);

  // Close all panels on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSlateConfirm(false);
        setSlateHover(false);
        setPendingSwitch(null);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  async function executeSectorSwitch(value: string) {
    const prev = activeSector;
    setActiveSector(value);
    setSwitching(true);
    setToast(null);
    try {
      const res = await fetch("/api/initialize-sector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sector: value }),
      });

      if (res.ok) {
        let body: { seeded?: number; attempted?: number; custom?: boolean } = {};
        try { body = await res.json(); } catch { /* non-fatal */ }

        // Write banner data for the radar's InitBanner component
        try {
          sessionStorage.setItem("radar_init", JSON.stringify({
            seeded:    body.seeded    ?? 0,
            attempted: body.attempted ?? 0,
            failed:    (body.attempted ?? 0) - (body.seeded ?? 0),
            sector:    value,
            custom:    body.custom ?? value === "custom",
          }));
        } catch { /* non-fatal */ }

        setToast({
          type:     "ok",
          seeded:   body.seeded    ?? 0,
          attempted: body.attempted ?? 0,
          custom:   body.custom    ?? value === "custom",
        });
        router.refresh();
      } else {
        setActiveSector(prev);
        setToast({ type: "error" });
      }
    } catch {
      setActiveSector(prev);
      setToast({ type: "error" });
    } finally {
      setSwitching(false);
      setTimeout(() => setToast(null), 3500);
    }
  }

  function handleSelect(value: string) {
    if (value === activeSector) { setOpen(false); return; }
    setOpen(false);
    // Require confirmation when replacing an existing slate
    if (competitorCount > 0) {
      const opt = SECTOR_OPTIONS.find((o) => o.value === value);
      setPendingSwitch({ value, label: opt?.label ?? value });
    } else {
      void executeSectorSwitch(value);
    }
  }

  async function handleCleanSlate() {
    setSlateLoading(true);
    try {
      const res = await fetch("/api/clean-slate", { method: "POST" });
      if (res.ok) {
        setSlateConfirm(false);
        setSlateHover(false);
        router.refresh();
      }
    } catch {
      // Silently reset
    } finally {
      setSlateLoading(false);
    }
  }

  function toastLabel(): string {
    if (switching) return "Switching…";
    if (!toast) return getSectorLabel(activeSector);
    if (toast.type === "error") return "Failed";
    if (toast.custom) return "Clean slate ✓";
    if (toast.seeded < toast.attempted) return `${toast.seeded} of ${toast.attempted} added ✓`;
    return `${toast.seeded} added ✓`;
  }

  return (
    <div ref={ref} className="relative flex items-center gap-2">

      {/* ── Sector selector ─────────────────────────────────────────────── */}
      <button
        onClick={() => { setOpen((v) => !v); setSlateConfirm(false); setPendingSwitch(null); }}
        disabled={switching}
        className="group flex items-center gap-2 rounded-[8px] border bg-[#060d06] px-3 py-1.5 transition-all duration-150 hover:bg-[#0a140a] disabled:opacity-50"
        style={{
          borderColor: open ? "rgba(46,230,166,0.28)" : "rgba(46,230,166,0.12)",
          boxShadow: open ? "0 0 0 1px rgba(46,230,166,0.08)" : "none",
        }}
      >
        {/* Sector dot */}
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full transition-colors"
          style={{ background: toast?.type === "error" ? "#ef4444" : "rgba(46,230,166,0.60)" }}
        />
        <div className="flex flex-col items-start leading-none">
          <span
            className="text-[8px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: "rgba(46,230,166,0.35)" }}
          >
            Sector
          </span>
          <span
            className="mt-0.5 text-[11px] font-medium"
            style={{ color: toast?.type === "error" ? "#ef4444" : "rgba(46,230,166,0.80)" }}
          >
            {toastLabel()}
          </span>
        </div>
        <svg
          width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true"
          className="ml-0.5 shrink-0 opacity-40 transition-transform duration-150"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <path d="M1 2.5L4 5.5L7 2.5" stroke="rgba(46,230,166,0.7)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* ── Clean slate button ──────────────────────────────────────────── */}
      <div ref={slateRef} className="relative">
        <button
          onMouseEnter={() => setSlateHover(true)}
          onMouseLeave={() => { if (!slateConfirm) setSlateHover(false); }}
          onClick={() => setSlateConfirm((v) => !v)}
          className="flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1.5 transition-all duration-150"
          style={{
            borderColor: slateConfirm ? "rgba(239,68,68,0.35)" : slateHover ? "rgba(239,68,68,0.22)" : "rgba(100,116,139,0.14)",
            background: slateConfirm ? "rgba(239,68,68,0.06)" : slateHover ? "rgba(239,68,68,0.04)" : "rgba(6,13,6,0.80)",
            color: slateHover || slateConfirm ? "rgba(239,68,68,0.70)" : "rgba(100,116,139,0.40)",
          }}
          aria-label="Clean slate — remove all rivals"
          title="Clean slate"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
            <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <span className="text-[9px] font-medium uppercase tracking-[0.14em]">Reset</span>
        </button>

        {/* Hover / confirm popup */}
        {(slateHover || slateConfirm) && (
          <div
            className="absolute right-0 top-full z-50 mt-1.5 min-w-[180px] overflow-hidden rounded-[10px] border border-[#1a2a1a] bg-[#060906] px-3.5 py-3"
            style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.85)" }}
            onMouseEnter={() => setSlateHover(true)}
            onMouseLeave={() => { setSlateHover(false); if (!slateConfirm) setSlateConfirm(false); }}
          >
            <div className="mb-2 text-[10px] font-semibold text-slate-500">
              Remove {competitorCount > 0 ? `${competitorCount} rival${competitorCount !== 1 ? "s" : ""}` : "all rivals"}?
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCleanSlate}
                disabled={slateLoading}
                className="flex-1 rounded-full border border-red-900/60 bg-[#0d0505] py-1 text-[10px] font-medium text-red-500 transition-colors hover:border-red-800 hover:bg-[#150808] disabled:opacity-50"
              >
                {slateLoading ? "Clearing…" : "Confirm"}
              </button>
              <button
                onClick={() => { setSlateConfirm(false); setSlateHover(false); }}
                disabled={slateLoading}
                className="flex-1 rounded-full border border-[#1a2a1a] py-1 text-[10px] text-slate-600 transition-colors hover:text-slate-400 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Sector dropdown ─────────────────────────────────────────────── */}
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1.5 w-48 overflow-hidden rounded-[12px] border border-[#1a3020] bg-[#060d06] py-1"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.8)" }}
        >
          {SECTOR_OPTIONS.map((opt) => (
            <div key={opt.value}>
              {opt.value === "custom" && (
                <div className="mx-3 my-1 h-px bg-[#1a3020]" />
              )}
              <button
                onClick={() => handleSelect(opt.value)}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[12px] transition-colors hover:bg-[#0a1a0a]"
                style={{ color: opt.value === activeSector ? "#2EE6A6" : "#64748b" }}
              >
                <span
                  className="h-1 w-1 shrink-0 rounded-full"
                  style={{ background: opt.value === activeSector ? "#2EE6A6" : "transparent" }}
                />
                {opt.label}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Sector switch confirmation ───────────────────────────────────── */}
      {pendingSwitch && (
        <div
          className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-[12px] border border-[#1a3020] bg-[#060d06] px-4 py-3.5"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.85)" }}
        >
          <div className="mb-1 text-[11px] font-semibold text-white">
            Switch to {pendingSwitch.label}?
          </div>
          <div className="mb-3 text-[10px] leading-relaxed text-slate-500">
            Your current {competitorCount} rival{competitorCount !== 1 ? "s" : ""} will be replaced with {pendingSwitch.value === "custom" ? "an empty slate" : "defaults for this sector"}.
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { void executeSectorSwitch(pendingSwitch.value); setPendingSwitch(null); }}
              className="flex-1 rounded-full border border-[#1a4025] bg-[#040d06] py-1.5 text-[10px] font-medium text-[#2EE6A6] transition-colors hover:border-[#2a5030] hover:bg-[#061006]"
            >
              Switch
            </button>
            <button
              onClick={() => setPendingSwitch(null)}
              className="flex-1 rounded-full border border-[#1a2a1a] py-1.5 text-[10px] text-slate-600 transition-colors hover:text-slate-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
