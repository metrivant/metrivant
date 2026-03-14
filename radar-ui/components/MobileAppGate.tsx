"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "../lib/supabase/client";

// Routes inside /app/* that remain accessible on mobile
const MOBILE_ALLOWED = ["/app/billing", "/app/settings"];

export default function MobileAppGate({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px) and (pointer: coarse)");
    setIsMobile(mq.matches);
    setReady(true);
    const h = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // Only gate on mobile and when on a gated route
  const isGated = isMobile && !MOBILE_ALLOWED.some((p) => pathname.startsWith(p));

  if (!ready) return null; // Avoid flash — wait for client detection
  if (!isGated) return <>{children}</>;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function handleCopy() {
    navigator.clipboard.writeText("https://metrivant.com/app").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#000200] px-8 text-white">
      {/* Dot grid background */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.85) 0.5px, transparent 0.5px)",
          backgroundSize: "6px 6px",
          opacity: 0.015,
        }}
      />
      {/* Atmospheric glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: "radial-gradient(ellipse 70% 50% at 50% 40%, rgba(46,230,166,0.05) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex max-w-xs flex-col items-center text-center">
        {/* Radar SVG illustration */}
        <svg width="72" height="72" viewBox="0 0 46 46" fill="none" aria-hidden="true" className="mb-6">
          <circle cx="23" cy="23" r="21.5" stroke="#2EE6A6" strokeWidth="1" strokeOpacity="0.22" />
          <circle cx="23" cy="23" r="15"   stroke="#2EE6A6" strokeWidth="0.8" strokeOpacity="0.14" />
          <circle cx="23" cy="23" r="9"    stroke="#2EE6A6" strokeWidth="0.7" strokeOpacity="0.18" />
          <circle cx="23" cy="23" r="4"    stroke="#2EE6A6" strokeWidth="0.7" strokeOpacity="0.28" />
          {/* Sweep line */}
          <path d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z" fill="#2EE6A6" fillOpacity="0.06" />
          <line x1="23" y1="23" x2="38.2" y2="9.8" stroke="#2EE6A6" strokeWidth="1.2" strokeOpacity="0.55" />
          {/* Cardinal ticks */}
          <line x1="23" y1="1.5" x2="23" y2="4.5" stroke="#2EE6A6" strokeWidth="0.8" strokeOpacity="0.25" />
          <line x1="44.5" y1="23" x2="41.5" y2="23" stroke="#2EE6A6" strokeWidth="0.8" strokeOpacity="0.25" />
          <line x1="23" y1="44.5" x2="23" y2="41.5" stroke="#2EE6A6" strokeWidth="0.8" strokeOpacity="0.25" />
          <line x1="1.5" y1="23" x2="4.5" y2="23" stroke="#2EE6A6" strokeWidth="0.8" strokeOpacity="0.25" />
          <circle cx="23" cy="23" r="1.8" fill="#2EE6A6" fillOpacity="0.9" />
        </svg>

        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.32em]" style={{ color: "rgba(46,230,166,0.5)" }}>
          METRIVANT
        </div>

        <h1 className="mb-3 text-[22px] font-bold leading-tight text-white">
          Desktop experience
        </h1>

        <p className="mb-1 text-[13px] leading-relaxed text-slate-400">
          The competitive intelligence radar is built for desktop.
        </p>
        <p className="mb-8 text-[13px] leading-relaxed text-slate-600">
          Open Metrivant on a laptop or desktop for the full radar console.
        </p>

        {/* Actions */}
        <div className="flex w-full flex-col gap-3">
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 rounded-full border border-[#1a3a20] py-3 text-[13px] font-medium text-slate-300 transition-colors active:bg-[#0a1c0a]"
          >
            {copied ? (
              <>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <path d="M2 6.5l3.5 3.5 5.5-6" stroke="#2EE6A6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ color: "#2EE6A6" }}>Link copied</span>
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M9 4V2.5A1.5 1.5 0 0 0 7.5 1h-5A1.5 1.5 0 0 0 1 2.5v5A1.5 1.5 0 0 0 2.5 9H4" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                Copy desktop link
              </>
            )}
          </button>

          <Link
            href="/app/billing"
            className="flex items-center justify-center rounded-full border border-[#0e2210] py-3 text-[13px] font-medium text-slate-500 transition-colors active:bg-[#050f05]"
          >
            Billing & account
          </Link>

          <button
            onClick={handleSignOut}
            className="text-[12px] text-slate-700 transition-colors hover:text-slate-500"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
