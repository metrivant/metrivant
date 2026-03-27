"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import AboutOverlay from "./AboutOverlay";

export default function PublicNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b border-[#0e1022] bg-[rgba(0,2,0,0.94)] px-4 backdrop-blur-xl md:h-16 md:px-6">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setMenuOpen(false)}>
          <svg width="24" height="24" viewBox="0 0 46 46" fill="none" aria-hidden="true" className="shrink-0 md:w-[28px] md:h-[28px]">
            <circle cx="23" cy="23" r="21.5" stroke="#00B4FF" strokeWidth="1.5" strokeOpacity="0.50" />
            <circle cx="23" cy="23" r="13"   stroke="#00B4FF" strokeWidth="1"   strokeOpacity="0.28" />
            <circle cx="23" cy="23" r="5.5"  stroke="#00B4FF" strokeWidth="1"   strokeOpacity="0.42" />
            <path d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z" fill="#00B4FF" fillOpacity="0.10" />
            <line x1="23" y1="23" x2="38.2" y2="9.8" stroke="#00B4FF" strokeWidth="1.5" strokeOpacity="0.80" />
            <circle cx="23" cy="23" r="2.5" fill="#00B4FF" />
          </svg>
          <span className="text-[14px] font-bold tracking-[0.08em] text-white md:text-[15px]" style={{ fontFamily: "var(--font-orbitron)" }}>METRIVANT</span>
        </Link>

        {/* Desktop nav — hidden on mobile */}
        <div className="hidden items-center gap-6 md:flex">
          <button
            onClick={() => setAboutOpen(true)}
            className="text-[13px] font-medium text-[#00B4FF]/70 transition-colors hover:text-[#00B4FF]"
          >
            About
          </button>
          <Link
            href="/pipeline"
            className={`text-[13px] font-medium transition-colors ${
              pathname === "/pipeline" ? "text-[#00B4FF]" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            How it works
          </Link>
          <Link
            href="/pricing"
            className={`text-[13px] font-medium transition-colors ${
              pathname === "/pricing" ? "text-[#00B4FF]" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="text-[13px] font-medium text-slate-400 transition-colors hover:text-slate-200"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full px-4 py-1.5 text-[13px] font-semibold transition-all duration-200"
            style={{
              border:  "1px solid rgba(0,180,255,0.35)",
              background: "rgba(0,180,255,0.07)",
              color: "#00B4FF",
            }}
          >
            Get started
          </Link>
        </div>

        {/* Mobile nav — right side: CTA + menu trigger */}
        <div className="flex items-center gap-2 md:hidden">
          <Link
            href="/signup"
            className="rounded-full bg-[#00B4FF] px-3.5 py-1.5 text-[12px] font-semibold text-black transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg border border-[#0e1022] transition-colors active:bg-[#0a1c0a]"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <path d="M1 1l11 11M12 1L1 12" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true">
                <path d="M1 1h12M1 5h12M1 9h12" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      <AboutOverlay open={aboutOpen} onClose={() => setAboutOpen(false)} />

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div
          className="fixed inset-x-0 top-14 z-40 border-b border-[#0e1022] bg-[rgba(0,2,0,0.97)] px-5 py-4 backdrop-blur-xl md:hidden"
          style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.7)" }}
        >
          <div className="flex flex-col gap-1">
            <button
              onClick={() => { setMenuOpen(false); setAboutOpen(true); }}
              className="rounded-lg px-3 py-3 text-left text-[14px] font-medium text-slate-300 transition-colors"
            >
              About
            </button>
            <Link
              href="/pipeline"
              onClick={() => setMenuOpen(false)}
              className={`rounded-lg px-3 py-3 text-[14px] font-medium transition-colors ${
                pathname === "/pipeline" ? "text-[#00B4FF]" : "text-slate-300"
              }`}
            >
              How it works
            </Link>
            <Link
              href="/pricing"
              onClick={() => setMenuOpen(false)}
              className={`rounded-lg px-3 py-3 text-[14px] font-medium transition-colors ${
                pathname === "/pricing" ? "text-[#00B4FF]" : "text-slate-300"
              }`}
            >
              Pricing
            </Link>
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-3 py-3 text-[14px] font-medium text-slate-500 transition-colors hover:text-slate-300"
            >
              Log in
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
