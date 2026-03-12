"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SECTOR_OPTIONS = [
  { value: "saas",              label: "SaaS" },
  { value: "cybersecurity",     label: "Cybersecurity" },
  { value: "energy",            label: "Energy" },
  { value: "defense",           label: "Defense" },
  { value: "fintech",           label: "Fintech" },
  { value: "ai-infrastructure", label: "AI Infrastructure" },
  { value: "devtools",          label: "DevTools" },
  { value: "healthcare",        label: "Healthcare" },
  { value: "consumer-tech",     label: "Consumer Tech" },
  { value: "custom",            label: "Custom" },
] as const;

export default function SectorSelectClient() {
  const router = useRouter();
  const [sector, setSector] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    router.push("/app");
  }

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-[#000000] text-white">

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
      <div className="relative mb-12 flex flex-col items-center gap-1">
        <svg width="40" height="40" viewBox="0 0 46 46" fill="none" aria-hidden="true" className="mb-3">
          <circle cx="23" cy="23" r="21.5" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.50" />
          <circle cx="23" cy="23" r="13"   stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.28" />
          <circle cx="23" cy="23" r="5.5"  stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.42" />
          <path d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z" fill="#2EE6A6" fillOpacity="0.10" />
          <line x1="23" y1="23" x2="38.2" y2="9.8" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.80" />
          <circle cx="23" cy="23" r="2.5" fill="#2EE6A6" />
        </svg>
        <div
          className="text-[10px] font-medium uppercase tracking-[0.34em]"
          style={{ color: "rgba(46,230,166,0.55)" }}
        >
          Competitive Intelligence Radar
        </div>
        <div
          className="text-[28px] font-bold leading-none text-white"
          style={{ letterSpacing: "0.09em" }}
        >
          METRIVANT
        </div>
      </div>

      {/* Sector selection card */}
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm"
      >
        <div className="flex flex-col gap-5">

          <p className="text-center text-[15px] text-slate-300">
            Select the sector you want to monitor
          </p>

          {/* Dropdown */}
          <div className="relative">
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              required
              className="w-full appearance-none rounded-[12px] border border-[#1a3020] bg-[#070d07] px-4 py-3 text-[14px] text-white outline-none transition-colors focus:border-[#2EE6A6]/35 focus:ring-1 focus:ring-[#2EE6A6]/20"
              style={{
                colorScheme: "dark",
              }}
            >
              <option value="" disabled style={{ color: "#475569" }}>
                Choose a sector…
              </option>
              {SECTOR_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            {/* Chevron */}
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 4.5L6 8.5L10 4.5" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

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
            {loading ? "Setting up…" : "Start monitoring"}
          </button>

        </div>
      </form>

      {/* Skip */}
      <button
        type="button"
        onClick={() => router.push("/app")}
        className="mt-8 text-[12px] text-slate-700 transition-colors hover:text-slate-500"
      >
        Skip for now →
      </button>

    </div>
  );
}
