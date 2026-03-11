"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function PublicNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-[#0e2210] bg-[rgba(0,2,0,0.92)] px-6 backdrop-blur-xl">
      {/* Brand */}
      <Link href="/" className="flex items-center gap-3">
        <svg width="28" height="28" viewBox="0 0 46 46" fill="none" aria-hidden="true">
          <circle cx="23" cy="23" r="21.5" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.50" />
          <circle cx="23" cy="23" r="13"   stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.28" />
          <circle cx="23" cy="23" r="5.5"  stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.42" />
          <path d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z" fill="#2EE6A6" fillOpacity="0.10" />
          <line x1="23" y1="23" x2="38.2" y2="9.8" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.80" />
          <circle cx="23" cy="23" r="2.5" fill="#2EE6A6" />
        </svg>
        <span className="text-[15px] font-bold tracking-[0.08em] text-white">METRIVANT</span>
      </Link>

      {/* Links */}
      <div className="flex items-center gap-6">
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
    </nav>
  );
}
