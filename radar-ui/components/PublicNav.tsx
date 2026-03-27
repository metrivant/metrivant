"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import AboutOverlay from "./AboutOverlay";
import PipelineOverlay from "./PipelineOverlay";

export default function PublicNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-[#0e1022] bg-[rgba(0,2,0,0.96)] px-6 backdrop-blur-xl md:h-[68px] md:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3" onClick={() => setMenuOpen(false)}>
          <svg width="28" height="28" viewBox="0 0 46 46" fill="none" aria-hidden="true" className="shrink-0 md:w-[32px] md:h-[32px]">
            <circle cx="23" cy="23" r="21.5" stroke="#00B4FF" strokeWidth="1.5" strokeOpacity="0.50" />
            <circle cx="23" cy="23" r="13"   stroke="#00B4FF" strokeWidth="1"   strokeOpacity="0.28" />
            <circle cx="23" cy="23" r="5.5"  stroke="#00B4FF" strokeWidth="1"   strokeOpacity="0.42" />
            <path d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z" fill="#00B4FF" fillOpacity="0.10" />
            <line x1="23" y1="23" x2="38.2" y2="9.8" stroke="#00B4FF" strokeWidth="1.5" strokeOpacity="0.80" />
            <circle cx="23" cy="23" r="2.5" fill="#00B4FF" />
          </svg>
          <span
            className="text-[15px] font-bold tracking-[0.10em] text-white md:text-[16px]"
            style={{ fontFamily: "var(--font-orbitron)" }}
          >
            METRIVANT
          </span>
        </Link>

        {/* Desktop nav — hidden on mobile */}
        <div className="hidden items-center gap-8 md:flex">
          <button
            onClick={() => setAboutOpen(true)}
            className="cursor-pointer text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400 transition-all duration-200 hover:text-white"
            style={{ fontFamily: "var(--font-orbitron)" }}
          >
            Features
          </button>
          <button
            onClick={() => setPipelineOpen(true)}
            className="cursor-pointer text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400 transition-all duration-200 hover:text-white"
            style={{ fontFamily: "var(--font-orbitron)" }}
          >
            Pipeline
          </button>
          <Link
            href="/pricing"
            className={`text-[12px] font-semibold uppercase tracking-[0.12em] transition-all duration-200 ${
              pathname === "/pricing" ? "text-[#00B4FF]" : "text-slate-400 hover:text-white"
            }`}
            style={{ fontFamily: "var(--font-orbitron)" }}
          >
            Pricing
          </Link>

          {/* ENTER button — alive animation */}
          <Link
            href="/signup"
            className="group relative overflow-hidden rounded-lg px-6 py-2.5 text-[12px] font-bold uppercase tracking-[0.16em] transition-all duration-300"
            style={{ fontFamily: "var(--font-orbitron)" }}
          >
            {/* Breathing glow background */}
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(135deg, rgba(0,180,255,0.15) 0%, rgba(0,180,255,0.08) 100%)",
                animation: "nav-breathe 3s ease-in-out infinite",
              }}
            />

            {/* Border with shimmer effect */}
            <div
              className="absolute inset-0 rounded-lg"
              style={{
                border: "1px solid rgba(0,180,255,0.40)",
                boxShadow: "0 0 20px rgba(0,180,255,0.15), inset 0 0 15px rgba(0,180,255,0.08)",
              }}
            />

            {/* Scanning line */}
            <div
              className="absolute inset-0 overflow-hidden rounded-lg"
              style={{ mixBlendMode: "screen" }}
            >
              <div
                className="absolute inset-x-0 h-[2px]"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(0,180,255,0.8) 50%, transparent 100%)",
                  animation: "nav-scan 2.5s linear infinite",
                  filter: "blur(1px)",
                }}
              />
            </div>

            {/* Pulse on hover */}
            <div
              className="absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background: "radial-gradient(circle at center, rgba(0,180,255,0.20) 0%, transparent 70%)",
              }}
            />

            {/* Text */}
            <span className="relative z-10 text-[#00B4FF] transition-all duration-300 group-hover:text-white group-hover:drop-shadow-[0_0_8px_rgba(0,180,255,0.8)]">
              ENTER
            </span>
          </Link>
        </div>

        {/* Mobile nav — right side: ENTER button + menu trigger */}
        <div className="flex items-center gap-3 md:hidden">
          <Link
            href="/signup"
            className="group relative overflow-hidden rounded-lg px-5 py-2 text-[11px] font-bold uppercase tracking-[0.14em]"
            style={{ fontFamily: "var(--font-orbitron)" }}
          >
            {/* Mobile breathing background */}
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(135deg, rgba(0,180,255,0.15) 0%, rgba(0,180,255,0.08) 100%)",
                animation: "nav-breathe 3s ease-in-out infinite",
              }}
            />
            <div
              className="absolute inset-0 rounded-lg"
              style={{
                border: "1px solid rgba(0,180,255,0.40)",
                boxShadow: "0 0 15px rgba(0,180,255,0.12)",
              }}
            />
            <span className="relative z-10 text-[#00B4FF]">ENTER</span>
          </Link>

          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg border border-[#0e1022] transition-colors active:bg-[#0a1c0a]"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <svg width="14" height="14" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <path d="M1 1l11 11M12 1L1 12" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="15" height="11" viewBox="0 0 14 10" fill="none" aria-hidden="true">
                <path d="M1 1h12M1 5h12M1 9h12" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      <AboutOverlay open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <PipelineOverlay open={pipelineOpen} onClose={() => setPipelineOpen(false)} />

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div
          className="fixed inset-x-0 top-16 z-40 border-b border-[#0e1022] bg-[rgba(0,2,0,0.97)] px-6 py-5 backdrop-blur-xl md:hidden"
          style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.7)" }}
        >
          <div className="flex flex-col gap-2">
            <button
              onClick={() => { setMenuOpen(false); setAboutOpen(true); }}
              className="cursor-pointer rounded-lg px-4 py-3 text-left text-[13px] font-semibold uppercase tracking-[0.10em] text-slate-300 transition-colors hover:bg-[#0a1c0a] hover:text-white"
              style={{ fontFamily: "var(--font-orbitron)" }}
            >
              Features
            </button>
            <button
              onClick={() => { setMenuOpen(false); setPipelineOpen(true); }}
              className="cursor-pointer rounded-lg px-4 py-3 text-left text-[13px] font-semibold uppercase tracking-[0.10em] text-slate-300 transition-colors hover:bg-[#0a1c0a] hover:text-white"
              style={{ fontFamily: "var(--font-orbitron)" }}
            >
              Pipeline
            </button>
            <Link
              href="/pricing"
              onClick={() => setMenuOpen(false)}
              className={`rounded-lg px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.10em] transition-colors hover:bg-[#0a1c0a] ${
                pathname === "/pricing" ? "text-[#00B4FF]" : "text-slate-300 hover:text-white"
              }`}
              style={{ fontFamily: "var(--font-orbitron)" }}
            >
              Pricing
            </Link>
          </div>
        </div>
      )}

      {/* Animation keyframes — injected as inline style tag */}
      <style jsx global>{`
        @keyframes nav-breathe {
          0%, 100% {
            opacity: 0.7;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.02);
          }
        }

        @keyframes nav-scan {
          0% {
            top: -2px;
          }
          100% {
            top: calc(100% + 2px);
          }
        }
      `}</style>
    </>
  );
}
