"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSectorLabel } from "../lib/sectors";

const SECTOR_OPTIONS = [
  { value: "ai-infrastructure",  label: "AI Infrastructure" },
  { value: "consumer-tech",      label: "Consumer Tech" },
  { value: "cybersecurity",      label: "Cybersecurity" },
  { value: "defense",            label: "Defense & Aerospace" },
  { value: "devtools",           label: "DevTools" },
  { value: "energy",             label: "Energy & Resources" },
  { value: "fintech",            label: "Fintech" },
  { value: "healthcare",         label: "Healthcare" },
  { value: "saas",               label: "Software" },
] as const;

export default function SectorSwitcher({ sector }: { sector: string }) {
  const router = useRouter();
  const [open, setOpen]                     = useState(false);
  const [switching, setSwitching]           = useState(false);
  const [activeSector, setActiveSector]     = useState(sector);
  const [toast, setToast]                   = useState<"ok" | "error" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Sync if server re-renders with a different sector
  useEffect(() => { setActiveSector(sector); }, [sector]);

  // Close dropdown on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  async function handleSelect(value: string) {
    if (value === activeSector) { setOpen(false); return; }
    const prev = activeSector;
    setActiveSector(value); // optimistic
    setOpen(false);
    setSwitching(true);
    setToast(null);
    try {
      const res = await fetch("/api/initialize-sector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sector: value }),
      });
      if (res.ok) {
        setToast("ok");
        router.refresh();
      } else {
        setActiveSector(prev);
        setToast("error");
      }
    } catch {
      setActiveSector(prev);
      setToast("error");
    } finally {
      setSwitching(false);
      setTimeout(() => setToast(null), 2500);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={switching}
        className="flex items-center gap-1.5 rounded-full border border-[#1a3020] bg-[#070d07] px-3 py-1.5 text-[11px] font-medium transition-colors hover:border-[#2a4a30] hover:bg-[#0a1a0a] disabled:opacity-50"
        style={{ color: toast === "error" ? "#ef4444" : "rgba(46,230,166,0.75)" }}
      >
        <span className="uppercase tracking-[0.18em] text-slate-500">Sector</span>
        <span className="text-[#2EE6A6]/80">·</span>
        <span>
          {switching
            ? "Switching…"
            : toast === "ok"
            ? "Updated ✓"
            : toast === "error"
            ? "Failed"
            : getSectorLabel(activeSector)}
        </span>
        <svg
          width="9"
          height="9"
          viewBox="0 0 9 9"
          fill="none"
          aria-hidden="true"
          className="ml-0.5 opacity-50"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
        >
          <path d="M1.5 3L4.5 6.5L7.5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1.5 w-48 overflow-hidden rounded-[12px] border border-[#1a3020] bg-[#060d06] py-1"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.8)" }}
        >
          {SECTOR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
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
          ))}
        </div>
      )}
    </div>
  );
}
