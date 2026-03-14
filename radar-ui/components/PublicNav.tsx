"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function PublicNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b border-[#0e2210] bg-[rgba(0,2,0,0.94)] px-4 backdrop-blur-xl md:h-16 md:px-6">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setMenuOpen(false)}>
          <svg width="24" height="24" viewBox="0 0 46 46" fill="none" aria-hidden="true" className="shrink-0 md:w-[28px] md:h-[28px]">
            <circle cx="23" cy="23" r="21.5" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.50" />
            <circle cx="23" cy="23" r="13"   stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.28" />
            <circle cx="23" cy="23" r="5.5"  stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.42" />
            <path d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z" fill="#2EE6A6" fillOpacity="0.10" />
            <line x1="23" y1="23" x2="38.2" y2="9.8" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.80" />
            <circle cx="23" cy="23" r="2.5" fill="#2EE6A6" />
          </svg>
          <span className="text-[14px] font-bold tracking-[0.08em] text-white md:text-[15px]">METRIVANT</span>
        </Link>

        {/* Desktop nav — hidden on mobile */}
        <div className="hidden items-center gap-6 md:flex">
          <Link
            href="/about"
            className={`text-[13px] font-medium transition-colors ${
              pathname === "/about" ? "text-[#2EE6A6]" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            About
          </Link>
          <Link
            href="/pricing"
            className={`text-[13px] font-medium transition-colors ${
              pathname === "/pricing" ? "text-[#2EE6A6]" : "text-slate-400 hover:text-slate-200"
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
            className="rounded-full bg-[#2EE6A6] px-4 py-1.5 text-[13px] font-semibold text-black transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
        </div>

        {/* Mobile nav — right side: Log in + CTA + menu trigger */}
        <div className="flex items-center gap-2 md:hidden">
          <Link
            href="/login"
            className="rounded-full px-3 py-1.5 text-[12px] font-medium text-slate-400 transition-colors hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-[#2EE6A6] px-3.5 py-1.5 text-[12px] font-semibold text-black transition-opacity active:opacity-75"
          >
            Get started
          </Link>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg border border-[#0e2210] transition-colors active:bg-[#0a1c0a]"
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

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div
          className="fixed inset-x-0 top-14 z-40 border-b border-[#0e2210] bg-[rgba(0,2,0,0.97)] px-5 py-4 backdrop-blur-xl md:hidden"
          style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.7)" }}
        >
          <div className="flex flex-col gap-1">
            <Link
              href="/about"
              onClick={() => setMenuOpen(false)}
              className={`rounded-lg px-3 py-3 text-[14px] font-medium transition-colors ${
                pathname === "/about" ? "text-[#2EE6A6]" : "text-slate-300"
              }`}
            >
              About
            </Link>
            <Link
              href="/pricing"
              onClick={() => setMenuOpen(false)}
              className={`rounded-lg px-3 py-3 text-[14px] font-medium transition-colors ${
                pathname === "/pricing" ? "text-[#2EE6A6]" : "text-slate-300"
              }`}
            >
              Pricing
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
