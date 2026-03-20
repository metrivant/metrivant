"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

// ── Mobile-only bottom navigation bar ────────────────────────────────────────
// 4 primary tabs + More drawer. Shown below md breakpoint only.

type NavItem = { href: string; label: string; icon: ReactNode };

const PRIMARY: NavItem[] = [
  {
    href: "/app",
    label: "Feed",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="2" y="3" width="16" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="2" y="9" width="16" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="2" y="15" width="10" height="2" rx="1" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.5" />
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
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/app/strategy",
    label: "Strategy",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.3" />
        <line x1="10" y1="2" x2="10" y2="6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="10" y1="14" x2="10" y2="18" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="2" y1="10" x2="6" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="14" y1="10" x2="18" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
];

const MORE_ITEMS: NavItem[] = [
  {
    href: "/app/pipeline",
    label: "Pipeline",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M3 4h12M3 9h12M3 14h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="6" cy="4" r="1.5" fill="currentColor" />
        <circle cx="12" cy="9" r="1.5" fill="currentColor" />
        <circle cx="9" cy="14" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/app/achievements",
    label: "Achievements",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M9 2l2 4 4.5.7-3.25 3.2.75 4.6L9 12.4l-4 2.1.75-4.6L2.5 6.7 7 6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/app/settings",
    label: "Settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.4" />
        <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.3 3.3l1.4 1.4M13.3 13.3l1.4 1.4M3.3 14.7l1.4-1.4M13.3 4.7l1.4-1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/about",
    label: "About",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.4" />
        <path d="M9 8v4M9 6v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const toggleMore = useCallback(() => setMoreOpen((o) => !o), []);
  const closeMore = useCallback(() => setMoreOpen(false), []);

  const isActive = (href: string) =>
    href === "/app" ? pathname === "/app" : pathname.startsWith(href);

  // Check if current path is in MORE_ITEMS
  const moreActive = MORE_ITEMS.some((item) => isActive(item.href));

  return (
    <>
      {/* More drawer overlay */}
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              key="more-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={closeMore}
            />
            <motion.div
              key="more-drawer"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-x-0 bottom-[60px] z-50 mx-3 rounded-xl border border-[#0e1022] bg-[rgba(4,8,4,0.98)] backdrop-blur-xl md:hidden"
              style={{
                marginBottom: "env(safe-area-inset-bottom)",
                boxShadow: "0 -8px 40px rgba(0,0,0,0.7)",
              }}
            >
              <div className="p-3">
                <div
                  className="mb-2 px-2 font-mono text-[9px] font-bold uppercase tracking-[0.2em]"
                  style={{ color: "rgba(0,180,255,0.4)" }}
                >
                  More
                </div>
                {MORE_ITEMS.map(({ href, label, icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={closeMore}
                    className="flex items-center gap-3 rounded-lg px-3 py-3 transition-colors active:bg-white/5"
                    style={{ color: isActive(href) ? "#00B4FF" : "rgba(148,163,184,0.6)" }}
                  >
                    {icon}
                    <span className="text-[13px] font-medium">{label}</span>
                  </Link>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom nav bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-[#0e1022] bg-[rgba(0,0,0,0.98)] backdrop-blur-xl md:hidden"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          boxShadow: "0 -1px 0 rgba(0,180,255,0.06), 0 -8px 32px rgba(0,0,0,0.6)",
        }}
        aria-label="Mobile navigation"
      >
        {/* Top accent line */}
        <div
          className="absolute inset-x-0 top-0 h-[1px]"
          style={{ background: "linear-gradient(90deg, transparent 0%, rgba(0,180,255,0.18) 30%, rgba(0,180,255,0.28) 50%, rgba(0,180,255,0.18) 70%, transparent 100%)" }}
        />

        {PRIMARY.map(({ href, label, icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5 transition-colors active:opacity-60"
              style={{ color: active ? "#00B4FF" : "rgba(100,116,139,0.55)" }}
            >
              {icon}
              <span
                className="text-[9px] font-medium uppercase tracking-[0.12em]"
                style={{ color: active ? "rgba(0,180,255,0.75)" : "rgba(100,116,139,0.38)" }}
              >
                {label}
              </span>
            </Link>
          );
        })}

        {/* More button */}
        <button
          onClick={toggleMore}
          className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5 transition-colors active:opacity-60"
          style={{ color: moreOpen || moreActive ? "#00B4FF" : "rgba(100,116,139,0.55)" }}
          aria-label="More navigation options"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="4" cy="10" r="1.8" fill="currentColor" />
            <circle cx="10" cy="10" r="1.8" fill="currentColor" />
            <circle cx="16" cy="10" r="1.8" fill="currentColor" />
          </svg>
          <span
            className="text-[9px] font-medium uppercase tracking-[0.12em]"
            style={{ color: moreOpen || moreActive ? "rgba(0,180,255,0.75)" : "rgba(100,116,139,0.38)" }}
          >
            More
          </span>
        </button>
      </nav>
    </>
  );
}
