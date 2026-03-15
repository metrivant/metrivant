"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const SECTOR_OPTIONS = [
  {
    value: "saas",
    label: "SaaS",
    desc: "Software, analytics, CRM, developer tools",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <rect x="2" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" />
        <line x1="2" y1="7.5" x2="16" y2="7.5" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.55" />
        <circle cx="4.5" cy="6" r="0.8" fill="currentColor" fillOpacity="0.55" />
        <circle cx="7"   cy="6" r="0.8" fill="currentColor" fillOpacity="0.38" />
      </svg>
    ),
  },
  {
    value: "ai-infrastructure",
    label: "AI Infrastructure",
    desc: "AI platforms, compute, model providers",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="9"  cy="9"  r="2"   stroke="currentColor" strokeWidth="1.2" />
        <circle cx="3"  cy="9"  r="1.2" fill="currentColor" fillOpacity="0.55" />
        <circle cx="15" cy="9"  r="1.2" fill="currentColor" fillOpacity="0.55" />
        <circle cx="9"  cy="3"  r="1.2" fill="currentColor" fillOpacity="0.55" />
        <circle cx="9"  cy="15" r="1.2" fill="currentColor" fillOpacity="0.55" />
        <line x1="4.2" y1="9" x2="7"   y2="9" stroke="currentColor" strokeWidth="0.9" />
        <line x1="11"  y1="9" x2="13.8" y2="9" stroke="currentColor" strokeWidth="0.9" />
        <line x1="9"   y1="4.2" x2="9" y2="7"   stroke="currentColor" strokeWidth="0.9" />
        <line x1="9"   y1="11"  x2="9" y2="13.8" stroke="currentColor" strokeWidth="0.9" />
      </svg>
    ),
  },
  {
    value: "cybersecurity",
    label: "Cybersecurity",
    desc: "Security platforms and threat intelligence",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M9 2L15 4.5V9C15 12.5 12 15.5 9 16.5C6 15.5 3 12.5 3 9V4.5L9 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M6.5 9l2 2 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: "fintech",
    label: "Fintech",
    desc: "Payments, banking, financial services",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <polyline points="2,14 6,9 9,11 13,6 16,4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="13,4 16,4 16,7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: "energy",
    label: "Energy",
    desc: "Oil, gas, renewables, energy services",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M10.5 2L6 10h5l-3.5 6L14 7H9l1.5-5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: "defense",
    label: "Defense",
    desc: "Defense contractors and aerospace",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.2" />
        <line x1="9" y1="2"  x2="9"  y2="4.5"  stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="9" y1="13.5" x2="9" y2="16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="2" y1="9"  x2="4.5" y2="9"  stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="13.5" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="9" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.1" />
      </svg>
    ),
  },
  {
    value: "devtools",
    label: "DevTools",
    desc: "Developer tooling, CI/CD, IDE platforms",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <polyline points="5,6 2,9 5,12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="13,6 16,9 13,12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="11" y1="4" x2="7" y2="14" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeOpacity="0.70" />
      </svg>
    ),
  },
  {
    value: "healthcare",
    label: "Healthcare",
    desc: "Health tech and digital health platforms",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <rect x="2" y="2" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.2" />
        <line x1="9" y1="5.5" x2="9"   y2="12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="5.5" y1="9" x2="12.5" y2="9"   stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "consumer-tech",
    label: "Consumer Tech",
    desc: "Consumer electronics and digital products",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <rect x="3" y="2.5" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <line x1="6" y1="15.5" x2="12" y2="15.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="9" y1="12.5" x2="9"  y2="15.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "custom",
    label: "Custom",
    desc: "Start empty — add rivals manually",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2.5 2" />
        <line x1="9" y1="5.5" x2="9"   y2="12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="5.5" y1="9" x2="12.5" y2="9"   stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
] as const;

type SectorValue = typeof SECTOR_OPTIONS[number]["value"];

const LOADING_PHASES = [
  "Adding rivals to your radar…",
  "Setting up monitoring pages…",
  "Finalizing your radar…",
];

export default function SectorSelectClient() {
  const router = useRouter();
  const [sector, setSector]             = useState<SectorValue | "">("");
  const [loading, setLoading]           = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [error, setError]               = useState<string | null>(null);

  // Cycle loading message every 5s to signal real progress
  useEffect(() => {
    if (!loading) {
      setLoadingPhase(0);
      return;
    }
    const timer = setInterval(() => {
      setLoadingPhase((p) => (p < LOADING_PHASES.length - 1 ? p + 1 : p));
    }, 5000);
    return () => clearInterval(timer);
  }, [loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sector) return;

    setLoading(true);
    setError(null);

    const res = await fetch("/api/initialize-sector", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sector }),
    });

    if (!res.ok) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    let body: { seeded?: number; attempted?: number; failed?: number; partial?: boolean; custom?: boolean } = {};
    try {
      body = await res.json();
    } catch { /* non-fatal */ }

    try {
      sessionStorage.setItem("radar_init", JSON.stringify({
        seeded:    body.seeded    ?? 0,
        attempted: body.attempted ?? 0,
        failed:    body.failed    ?? 0,
        sector,
        custom:    body.custom    ?? sector === "custom",
      }));
    } catch { /* sessionStorage unavailable */ }

    router.push("/app");
  }

  const isCustom = sector === "custom";

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-[#000000] px-4 text-white">

      {/* Dot grid */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.85) 0.5px, transparent 0.5px)",
          backgroundSize: "6px 6px",
          opacity: 0.018,
        }}
      />
      {/* Green atmospheric glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(46,230,166,0.07) 0%, transparent 70%)",
        }}
      />

      {/* Wordmark */}
      <div className="relative mb-10 flex flex-col items-center gap-1">
        <svg width="40" height="40" viewBox="0 0 46 46" fill="none" aria-hidden="true" className="mb-3">
          <circle cx="23" cy="23" r="21.5" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.50" />
          <circle cx="23" cy="23" r="13"   stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.28" />
          <circle cx="23" cy="23" r="5.5"  stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.42" />
          <path d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z" fill="#2EE6A6" fillOpacity="0.10" />
          <line x1="23" y1="23" x2="38.2" y2="9.8" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.80" />
          <circle cx="23" cy="23" r="2.5" fill="#2EE6A6" />
        </svg>
        <div className="text-[10px] font-medium uppercase tracking-[0.34em]" style={{ color: "rgba(46,230,166,0.55)" }}>
          Competitive Intelligence Radar
        </div>
        <div className="text-[28px] font-bold leading-none text-white" style={{ letterSpacing: "0.09em" }}>
          METRIVANT
        </div>
      </div>

      {/* Sector selection */}
      <form onSubmit={handleSubmit} className="relative w-full max-w-lg">
        <div className="flex flex-col gap-5">

          <div className="text-center">
            <p className="text-[15px] font-medium text-slate-300">
              Which market are you monitoring?
            </p>
            <p className="mt-1 text-[12px] text-slate-600">
              We&apos;ll pre-populate your radar with relevant rivals.
            </p>
          </div>

          {/* Sector card grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
            {SECTOR_OPTIONS.map((s) => {
              const selected = sector === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSector(s.value)}
                  disabled={loading}
                  className="flex flex-col items-start rounded-[12px] border px-3 py-2.5 text-left transition-all duration-150 disabled:pointer-events-none disabled:opacity-40"
                  style={{
                    borderColor: selected ? "rgba(46,230,166,0.40)" : "rgba(26,42,26,0.9)",
                    background:  selected ? "rgba(3,12,3,0.95)" : "rgba(5,10,5,0.80)",
                    boxShadow:   selected ? "0 0 0 1px rgba(46,230,166,0.08), inset 0 1px 0 rgba(46,230,166,0.05)" : "none",
                    color:       selected ? "#2EE6A6" : "rgba(100,116,139,0.80)",
                  }}
                >
                  <div className="mb-1.5" style={{ color: selected ? "#2EE6A6" : "rgba(71,85,105,0.80)" }}>
                    {s.icon}
                  </div>
                  <div
                    className="text-[12px] font-semibold leading-snug"
                    style={{ color: selected ? "rgba(255,255,255,0.92)" : "rgba(148,163,184,0.80)" }}
                  >
                    {s.label}
                  </div>
                  <div className="mt-0.5 text-[10px] leading-relaxed" style={{ color: selected ? "rgba(46,230,166,0.50)" : "rgba(71,85,105,0.70)" }}>
                    {s.desc}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom sector note */}
          {isCustom && !loading && (
            <p className="text-center text-[12px] text-slate-500">
              No rivals will be pre-added. You&apos;ll build your watchlist manually from Discover.
            </p>
          )}

          {/* Error */}
          {error && (
            <p className="text-center text-[12px] text-red-400">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!sector || loading}
            className="rounded-full bg-[#2EE6A6] py-3 text-[14px] font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {loading ? LOADING_PHASES[loadingPhase] : "Start monitoring"}
          </button>

          {/* Loading sub-label */}
          {loading && (
            <p className="text-center text-[11px] text-slate-600">
              This takes 15–30 seconds — setting up monitoring across all rivals.
            </p>
          )}

        </div>
      </form>

      {/* Skip */}
      {!loading && (
        <button
          type="button"
          onClick={() => router.push("/app")}
          className="mt-8 text-[12px] text-slate-700 transition-colors hover:text-slate-500"
        >
          Skip for now →
        </button>
      )}

    </div>
  );
}
