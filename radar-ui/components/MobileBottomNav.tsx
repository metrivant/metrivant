"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  {
    href: "/app",
    label: "Radar",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="9.5" stroke="currentColor" strokeWidth="1.2" strokeOpacity={active ? 1 : 0.45} />
        <circle cx="11" cy="11" r="5.5" stroke="currentColor" strokeWidth="1" strokeOpacity={active ? 0.7 : 0.3} />
        <circle cx="11" cy="11" r="2" stroke="currentColor" strokeWidth="1" strokeOpacity={active ? 0.9 : 0.45} />
        <circle cx="11" cy="11" r="1" fill="currentColor" fillOpacity={active ? 1 : 0.5} />
      </svg>
    ),
  },
  {
    href: "/app/discover",
    label: "Discover",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <circle cx="9.5" cy="9.5" r="6" stroke="currentColor" strokeWidth="1.3" strokeOpacity={active ? 1 : 0.45} />
        <path d="M14 14L19 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity={active ? 1 : 0.45} />
      </svg>
    ),
  },
  {
    href: "/app/strategy",
    label: "Strategy",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.2" strokeOpacity={active ? 1 : 0.45} />
        <circle cx="11" cy="11" r="3.5" stroke="currentColor" strokeWidth="1.1" strokeOpacity={active ? 0.8 : 0.35} />
        <line x1="11" y1="3" x2="11" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeOpacity={active ? 1 : 0.45} />
        <line x1="11" y1="16.5" x2="11" y2="19" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeOpacity={active ? 1 : 0.45} />
        <line x1="3" y1="11" x2="5.5" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeOpacity={active ? 1 : 0.45} />
        <line x1="16.5" y1="11" x2="19" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeOpacity={active ? 1 : 0.45} />
      </svg>
    ),
  },
  {
    href: "/app/market-map",
    label: "Map",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="16" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.2" strokeOpacity={active ? 1 : 0.45} />
        <line x1="11" y1="3" x2="11" y2="19" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity={active ? 0.65 : 0.3} />
        <line x1="3" y1="11" x2="19" y2="11" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity={active ? 0.65 : 0.3} />
      </svg>
    ),
  },
  {
    href: "/app/settings",
    label: "Settings",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="2.8" stroke="currentColor" strokeWidth="1.2" strokeOpacity={active ? 1 : 0.55} />
        <path
          d="M11 3.5v2M11 16.5v2M3.5 11h2M16.5 11h2M5.5 5.5l1.4 1.4M15.1 15.1l1.4 1.4M5.5 16.5l1.4-1.4M15.1 6.9l1.4-1.4"
          stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeOpacity={active ? 1 : 0.45}
        />
      </svg>
    ),
  },
] as const;

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 md:hidden"
      aria-label="Mobile navigation"
    >
      {/* Fade gradient above nav */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-10 h-10"
        style={{ background: "linear-gradient(to bottom, transparent, rgba(0,2,0,0.65))" }}
      />

      <div
        className="relative flex h-16 items-stretch justify-around border-t border-[#0e2210] bg-[rgba(0,0,0,0.97)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {/* Top accent line */}
        <div
          className="absolute inset-x-0 top-0 h-[1px]"
          style={{
            background:
              "linear-gradient(90deg, transparent 5%, rgba(46,230,166,0.10) 30%, rgba(46,230,166,0.18) 50%, rgba(46,230,166,0.10) 70%, transparent 95%)",
          }}
        />

        {NAV_ITEMS.map(({ href, label, icon }) => {
          const isActive = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-opacity active:opacity-60"
              style={{ color: isActive ? "#2EE6A6" : "#475569" }}
              aria-current={isActive ? "page" : undefined}
            >
              {icon(isActive)}
              <span className="text-[9px] font-medium uppercase tracking-[0.12em] leading-none">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
