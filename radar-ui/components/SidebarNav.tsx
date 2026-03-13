"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { RadarCompetitor } from "../lib/api";
import SignalConstellation from "./SignalConstellation";

const NAV_ITEMS: { href: string; label: string; icon: ReactNode }[] = [
  {
    href: "/app/discover",
    label: "Discover",
    icon: (
      <svg width="13" height="13" viewBox="0 0 11 11" fill="none" aria-hidden="true">
        <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M7.5 7.5L10 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/app/briefs",
    label: "Briefs",
    icon: (
      <svg width="13" height="13" viewBox="0 0 11 11" fill="none" aria-hidden="true">
        <rect x="1.5" y="1" width="8" height="9" rx="1.3" stroke="currentColor" strokeWidth="1.3" />
        <path d="M3.5 3.5h4M3.5 5.5h4M3.5 7.5h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/app/market-map",
    label: "Market Map",
    icon: (
      <svg width="13" height="13" viewBox="0 0 11 11" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <line x1="5.5" y1="1" x2="5.5" y2="10" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 1.5" />
        <line x1="1" y1="5.5" x2="10" y2="5.5" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 1.5" />
      </svg>
    ),
  },
  {
    href: "/app/strategy",
    label: "Strategy",
    icon: (
      <svg width="13" height="13" viewBox="0 0 11 11" fill="none" aria-hidden="true">
        <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="5.5" cy="5.5" r="1.8" stroke="currentColor" strokeWidth="1.2" />
        <line x1="5.5" y1="1.5" x2="5.5" y2="3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="5.5" y1="8" x2="5.5" y2="9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="1.5" y1="5.5" x2="3" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="8" y1="5.5" x2="9.5" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/app/settings",
    label: "Settings",
    icon: (
      <svg width="13" height="13" viewBox="0 0 11 11" fill="none" aria-hidden="true">
        <circle cx="5.5" cy="5.5" r="1.6" stroke="currentColor" strokeWidth="1.2" />
        <path d="M5.5 1v1.1M5.5 8.9V10M1 5.5h1.1M8.9 5.5H10M2.3 2.3l.78.78M7.92 7.92l.78.78M2.3 8.7l.78-.78M7.92 3.08l.78-.78" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    ),
  },
];

const ACTIVE_STYLE: React.CSSProperties = {
  color: "#2EE6A6",
  background: "rgba(46,230,166,0.07)",
  boxShadow: "inset 2px 0 0 rgba(46,230,166,0.5)",
  textShadow: "0 0 10px rgba(46,230,166,0.5), 0 0 22px rgba(46,230,166,0.18)",
};

const HOVER_STYLE: React.CSSProperties = {
  color: "rgba(46,230,166,0.6)",
  background: "#0a1a0a",
  textShadow: "0 0 8px rgba(46,230,166,0.22)",
};

const DEFAULT_STYLE: React.CSSProperties = {
  color: "#64748b",
};

function NavLink({
  href,
  label,
  icon,
  isActive,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  isActive: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const style = isActive ? ACTIVE_STYLE : hovered ? HOVER_STYLE : DEFAULT_STYLE;

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-medium transition-all duration-150"
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {icon}
      {label}
    </Link>
  );
}

export default function SidebarNav({
  plan,
  competitors = [],
}: {
  plan: string;
  competitors?: RadarCompetitor[];
}) {
  const pathname = usePathname();

  return (
    <>
      <div className="flex flex-col gap-1 p-3 pt-5">
        {NAV_ITEMS.map(({ href, label, icon }) => (
          <NavLink
            key={href}
            href={href}
            label={label}
            icon={icon}
            isActive={pathname.startsWith(href)}
          />
        ))}

        <div className="my-2 h-px bg-[#0e2210]" />

        {/* Lemonade Mode — hidden, reserved for future use */}
        {/* <Link
          href="/app/lemonade"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-medium transition-colors hover:bg-[#0a1a0a] hover:text-slate-300"
          style={{ color: "#64748b" }}
          title="Lemonade Mode"
        >
          <span className="text-base leading-none">🍋</span>
          Lemonade Mode
        </Link> */}
      </div>

      {/* Signal Constellation */}
      <SignalConstellation competitors={competitors} />

      {/* Plan / billing */}
      <div className="mt-auto border-t border-[#0e2210] p-3">
        <Link
          href="/app/billing"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-medium text-slate-600 transition-colors hover:bg-[#0a1a0a] hover:text-slate-300"
        >
          <svg width="13" height="13" viewBox="0 0 11 11" fill="none" aria-hidden="true">
            <rect x="1" y="3" width="9" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M3.5 3V2.5a2 2 0 0 1 4 0V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          {plan === "analyst" || plan === "starter" ? "Upgrade plan" : "Billing"}
        </Link>
      </div>
    </>
  );
}
