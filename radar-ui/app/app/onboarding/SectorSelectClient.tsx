"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

const SECTOR_OPTIONS = [
  {
    value: "saas",
    label: "Software & AI",
    desc: "B2B software, AI models, developer tools",
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
    value: "defense",
    label: "Defense & Aerospace",
    desc: "Defense contractors and aerospace firms",
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
    value: "energy",
    label: "Energy & Resources",
    desc: "Oil, gas, renewables, energy services",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M10.5 2L6 10h5l-3.5 6L14 7H9l1.5-5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
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

type OnboardingStatus = {
  stage: "seeding" | "onboarding" | "monitoring" | "ready";
  tracked: number;
  onboarded: number;
  pages_created: number;
  snapshots_captured: number;
};

export default function SectorSelectClient() {
  const router = useRouter();
  const [sector, setSector]     = useState<SectorValue | "">("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [status, setStatus]     = useState<OnboardingStatus | null>(null);

  // Poll onboarding status every 2s when loading
  useEffect(() => {
    if (!loading) {
      setStatus(null);
      return;
    }

    let mounted = true;
    const pollInterval = 2000; // 2 seconds
    const maxWaitTime = 45000; // 45 seconds timeout
    const startTime = Date.now();

    async function poll() {
      try {
        const res = await fetch("/api/onboarding-status");
        if (!res.ok) return;
        const data = await res.json() as OnboardingStatus;
        if (mounted) {
          setStatus(data);
          // Auto-redirect when ready
          if (data.stage === "ready" && data.snapshots_captured > 0) {
            router.push("/app");
          }
          // Timeout fallback: if stuck for too long, redirect to radar
          // User can check status there or use Discover to add competitors manually
          if (Date.now() - startTime > maxWaitTime) {
            router.push("/app");
          }
        }
      } catch {
        // Silently continue polling on error
      }
    }

    // Initial poll
    void poll();

    // Set up interval
    const timer = setInterval(() => {
      void poll();
    }, pollInterval);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [loading, router]);

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

    // Don't redirect immediately — let polling detect "ready" stage and auto-redirect
    // Polling starts automatically because loading=true
  }

  const isCustom = sector === "custom";

  function getProgressMessage(): string {
    if (!loading) return "Start monitoring";
    if (!status) return "Initializing…";

    const { stage, tracked, onboarded, pages_created } = status;

    if (stage === "seeding") {
      return tracked > 0 ? `Adding rivals… ${tracked}` : "Adding rivals to your radar…";
    }
    if (stage === "onboarding") {
      return `Setting up monitoring… ${onboarded}/${tracked}`;
    }
    if (stage === "monitoring") {
      return pages_created > 0 ? `Capturing first snapshots… ${pages_created} pages` : "Setting up monitoring pages…";
    }
    if (stage === "ready") {
      return "Launching radar…";
    }
    return "Processing…";
  }

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
      {/* Atmospheric glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,180,255,0.07) 0%, transparent 70%)",
        }}
      />

      {/* Wordmark */}
      <div className="relative mb-10 flex flex-col items-center gap-1">
        <svg width="40" height="40" viewBox="0 0 46 46" fill="none" aria-hidden="true" className="mb-3">
          <circle cx="23" cy="23" r="21.5" stroke="#00B4FF" strokeWidth="1.5" strokeOpacity="0.50" />
          <circle cx="23" cy="23" r="13"   stroke="#00B4FF" strokeWidth="1"   strokeOpacity="0.28" />
          <circle cx="23" cy="23" r="5.5"  stroke="#00B4FF" strokeWidth="1"   strokeOpacity="0.42" />
          <path d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z" fill="#00B4FF" fillOpacity="0.10" />
          <line x1="23" y1="23" x2="38.2" y2="9.8" stroke="#00B4FF" strokeWidth="1.5" strokeOpacity="0.80" />
          <circle cx="23" cy="23" r="2.5" fill="#00B4FF" />
        </svg>
        <div
          className="text-[11px] font-medium uppercase tracking-[0.34em] tagline-sheen"
          style={{
            color: "rgba(0,180,255,0.55)",
            fontFamily: "var(--font-share-tech-mono)"
          }}
        >
          Competitive Intelligence
        </div>
        <div
          className="text-[34px] font-bold leading-none text-white"
          style={{
            letterSpacing: "0.09em",
            fontFamily: "var(--font-orbitron)"
          }}
        >
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
                    borderColor: selected ? "rgba(0,180,255,0.40)" : "rgba(255,255,255,0.08)",
                    background:  selected ? "rgba(0,0,0,0.80)" : "rgba(0,0,0,0.50)",
                    boxShadow:   selected ? "0 0 0 1px rgba(0,180,255,0.08), inset 0 1px 0 rgba(0,180,255,0.05)" : "none",
                    color:       selected ? "#00B4FF" : "rgba(100,116,139,0.80)",
                  }}
                >
                  <div className="mb-1.5" style={{ color: selected ? "#00B4FF" : "rgba(100,116,139,0.60)" }}>
                    {s.icon}
                  </div>
                  <div
                    className="text-[12px] font-semibold leading-snug"
                    style={{ color: selected ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.65)" }}
                  >
                    {s.label}
                  </div>
                  <div className="mt-0.5 text-[10px] leading-relaxed" style={{ color: selected ? "rgba(0,180,255,0.50)" : "rgba(100,116,139,0.55)" }}>
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
            className="relative overflow-hidden rounded-full bg-[#00B4FF] py-3 text-[14px] font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {/* Animated progress bar background when loading */}
            {loading && status?.stage === "monitoring" && (
              <motion.div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(90deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.08) 100%)",
                  backgroundSize: "200% 100%",
                }}
                animate={{
                  backgroundPosition: ["0% 50%", "200% 50%"],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
            )}
            <span className="relative z-10">{getProgressMessage()}</span>
          </button>

          {/* Progress indicator */}
          {loading && status && (
            <div className="flex flex-col gap-3">
              {/* Animated progress bar for monitoring stage */}
              {status.stage === "monitoring" && (
                <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: "rgba(0,180,255,0.12)" }}>
                  <motion.div
                    className="h-full"
                    style={{ background: "#00B4FF" }}
                    initial={{ width: "0%" }}
                    animate={{ width: "85%" }}
                    transition={{
                      duration: 20,
                      ease: "easeOut",
                    }}
                  />
                </div>
              )}

              {/* Step indicator */}
              <div className="flex items-center justify-center gap-2">
                {[
                  { id: "seeding", label: "Seeding" },
                  { id: "onboarding", label: "Onboarding" },
                  { id: "monitoring", label: "Monitoring" },
                  { id: "ready", label: "Ready" },
                ].map((step, index, arr) => {
                  const currentStageIndex = arr.findIndex((s) => s.id === status.stage);
                  const stepIndex = index;
                  const isActive = stepIndex === currentStageIndex;
                  const isComplete = stepIndex < currentStageIndex;

                  return (
                    <div key={step.id} className="flex items-center gap-2">
                      {/* Step dot */}
                      <div className="flex flex-col items-center gap-1">
                        <div
                          className="flex h-2 w-2 items-center justify-center rounded-full transition-all duration-300"
                          style={{
                            background: isComplete || isActive ? "#00B4FF" : "rgba(255,255,255,0.12)",
                            boxShadow: isActive ? "0 0 8px rgba(0,180,255,0.40)" : "none",
                          }}
                        />
                        <span
                          className="text-[9px] font-medium uppercase tracking-wider transition-colors duration-300"
                          style={{
                            color: isComplete || isActive ? "rgba(0,180,255,0.70)" : "rgba(255,255,255,0.25)",
                            letterSpacing: "0.08em",
                          }}
                        >
                          {step.label}
                        </span>
                      </div>
                      {/* Connector line */}
                      {index < arr.length - 1 && (
                        <div
                          className="h-[1px] w-8 transition-all duration-300"
                          style={{
                            background: isComplete ? "rgba(0,180,255,0.40)" : "rgba(255,255,255,0.08)",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Sub-label */}
              <p className="text-center text-[11px] text-slate-600">
                This takes 15–30 seconds — setting up monitoring across all rivals.
              </p>
            </div>
          )}

          {/* Loading sub-label (fallback when no status yet) */}
          {loading && !status && (
            <p className="text-center text-[11px] text-slate-600">
              Initializing…
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
