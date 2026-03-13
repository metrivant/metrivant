"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// ── Mobile-only bottom navigation bar ────────────────────────────────────────
// Shown only on screens below the md breakpoint (md:hidden on parent).
// Mirrors the SidebarNav items and uses the same mv:overlay event bridge
// for panels that open as overlays (Briefs, Map, Strategy).

type MobileNavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  overlayKey?: string;
};

const ITEMS: MobileNavItem[] = [
  {
    href: "/app",
    label: "Radar",
    icon: (
      <svg width="20" height="20" viewBox="0 0 46 46" fill="none" aria-hidden="true">
        <circle cx="23" cy="23" r="20"   stroke="currentColor" strokeWidth="2"   strokeOpacity="0.55" />
        <circle cx="23" cy="23" r="12"   stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.38" />
        <circle cx="23" cy="23" r="5"    stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.50" />
        <line   x1="23" y1="23" x2="37" y2="10" stroke="currentColor" strokeWidth="1.8" strokeOpacity="0.9" strokeLinecap="round" />
        <circle cx="23" cy="23" r="2.2" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/app/discover",
    label: "Discover",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
        <path d="M13.5 13.5L18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/app/briefs",
    label: "Briefs",
    overlayKey: "briefs",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/app/market-map",
    label: "Map",
    overlayKey: "map",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <line x1="10" y1="2"  x2="10" y2="18" stroke="currentColor" strokeWidth="1.1" strokeDasharray="2.5 2" />
        <line x1="2"  y1="10" x2="18" y2="10" stroke="currentColor" strokeWidth="1.1" strokeDasharray="2.5 2" />
      </svg>
    ),
  },
  {
    href: "/app/strategy",
    label: "Strategy",
    overlayKey: "strategy",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="8"   stroke="currentColor" strokeWidth="1.6" />
        <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.3" />
        <line x1="10" y1="2"  x2="10" y2="6"  stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="10" y1="14" x2="10" y2="18" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="2"  y1="10" x2="6"  y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="14" y1="10" x2="18" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function MobileNav() {
  const pathname = usePathname();

  function handleClick(e: React.MouseEvent, overlayKey?: string) {
    if (overlayKey) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("mv:overlay", { detail: overlayKey }));
    }
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-[#0e2210] bg-[rgba(0,0,0,0.98)] backdrop-blur-xl md:hidden"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        boxShadow: "0 -1px 0 rgba(46,230,166,0.06), 0 -8px 32px rgba(0,0,0,0.6)",
      }}
      aria-label="Mobile navigation"
    >
      {/* Top accent line */}
      <div
        className="absolute inset-x-0 top-0 h-[1px]"
        style={{ background: "linear-gradient(90deg, transparent 0%, rgba(46,230,166,0.18) 30%, rgba(46,230,166,0.28) 50%, rgba(46,230,166,0.18) 70%, transparent 100%)" }}
      />

      {ITEMS.map(({ href, label, icon, overlayKey }) => {
        const isActive = overlayKey
          ? false
          : href === "/app"
            ? pathname === "/app"
            : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            onClick={(e) => handleClick(e, overlayKey)}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5 transition-colors active:opacity-60"
            style={{ color: isActive ? "#2EE6A6" : "rgba(100,116,139,0.55)" }}
          >
            {icon}
            <span
              className="text-[9px] font-medium uppercase tracking-[0.12em]"
              style={{ color: isActive ? "rgba(46,230,166,0.75)" : "rgba(100,116,139,0.38)" }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
