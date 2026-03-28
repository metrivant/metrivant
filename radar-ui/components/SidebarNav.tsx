"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import TelescopePanel, { type TelescopeSignal } from "./TelescopePanel";

const NAV_ITEMS: {
  href: string;
  label: string;
  icon: ReactNode;
  overlayKey?: string;
  keyBadge?: string;
}[] = [
  {
    href: "/app/discover",
    label: "Discover",
    keyBadge: "D",
    icon: (
      <svg width="13" height="13" viewBox="0 0 11 11" fill="none" aria-hidden="true">
        <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M7.5 7.5L10 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/app/sector",
    label: "Sector",
    keyBadge: "E",
    icon: (
      <svg width="13" height="13" viewBox="0 0 11 11" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M1 4h9M4 1v9" stroke="currentColor" strokeWidth="1.1" />
        <circle cx="2.5" cy="2.5" r="0.6" fill="currentColor" />
        <circle cx="6.5" cy="2.5" r="0.6" fill="currentColor" />
        <circle cx="2.5" cy="6.5" r="0.6" fill="currentColor" />
        <circle cx="6.5" cy="6.5" r="0.6" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/app/briefs",
    label: "Briefs",
    overlayKey: "briefs",
    keyBadge: "B",
    icon: (
      <svg width="13" height="13" viewBox="0 0 11 11" fill="none" aria-hidden="true">
        <rect x="1.5" y="1" width="8" height="9" rx="1.3" stroke="currentColor" strokeWidth="1.3" />
        <path d="M3.5 3.5h4M3.5 5.5h4M3.5 7.5h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/app/gravity-map",
    label: "Gravity Field",
    overlayKey: "map",
    keyBadge: "M",
    icon: (
      <svg width="13" height="13" viewBox="0 0 11 11" fill="none" aria-hidden="true">
        <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="5.5" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1" />
        <circle cx="5.5" cy="5.5" r="0.6" fill="currentColor" />
        <line x1="5.5" y1="1.5" x2="5.5" y2="3" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.5" />
        <line x1="5.5" y1="8" x2="5.5" y2="9.5" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.5" />
        <line x1="1.5" y1="5.5" x2="3" y2="5.5" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.5" />
        <line x1="8" y1="5.5" x2="9.5" y2="5.5" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.5" />
      </svg>
    ),
  },
  {
    href: "/app/strategy",
    label: "Strategy",
    overlayKey: "strategy",
    keyBadge: "S",
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
  {
    href: "/about",
    label: "About",
    icon: (
      <svg width="13" height="13" viewBox="0 0 11 11" fill="none" aria-hidden="true">
        <circle cx="5.5" cy="5.5" r="4.2" stroke="currentColor" strokeWidth="1.2" />
        <line x1="5.5" y1="5" x2="5.5" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="5.5" cy="3.2" r="0.7" fill="currentColor" />
      </svg>
    ),
  },
];

const ACTIVE_STYLE: React.CSSProperties = {
  color: "#00B4FF",
  background: "rgba(0,180,255,0.07)",
  boxShadow: "inset 2px 0 0 rgba(0,180,255,0.5)",
  textShadow: "0 0 10px rgba(0,180,255,0.5), 0 0 22px rgba(0,180,255,0.18)",
};

const HOVER_STYLE: React.CSSProperties = {
  color: "rgba(0,180,255,0.80)",
  background: "rgba(0,180,255,0.05)",
  textShadow: "0 0 10px rgba(0,180,255,0.50), 0 0 24px rgba(0,180,255,0.18)",
  boxShadow: "inset 2px 0 0 rgba(0,180,255,0.20)",
};

const DEFAULT_STYLE: React.CSSProperties = {
  color: "#64748b",
};

function NavLink({
  href,
  label,
  icon,
  isActive,
  overlayKey,
  keyBadge,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  isActive: boolean;
  overlayKey?: string;
  keyBadge?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const style = isActive ? ACTIVE_STYLE : hovered ? HOVER_STYLE : DEFAULT_STYLE;

  function handleClick(e: React.MouseEvent) {
    if (overlayKey) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("mv:overlay", { detail: overlayKey }));
    }
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] transition-all duration-150"
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {icon}
      {label}
      {keyBadge && (
        <span
          className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded px-1 font-mono text-[9px] font-bold"
          style={{
            background: "#0a0a1a",
            border: "1px solid rgba(0,180,255,0.14)",
            color: "rgba(0,180,255,0.45)",
          }}
        >
          {keyBadge}
        </span>
      )}
    </Link>
  );
}

export default function SidebarNav({
  telescopeSignals,
  sector,
}: {
  telescopeSignals?: TelescopeSignal[];
  sector?: string | null;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-1 p-3 pt-5">
        {NAV_ITEMS.map(({ href, label, icon, overlayKey, keyBadge }) => (
          <NavLink
            key={href}
            href={href}
            label={label}
            icon={icon}
            isActive={pathname.startsWith(href)}
            overlayKey={overlayKey}
            keyBadge={keyBadge}
          />
        ))}

        <div className="my-2 h-px bg-[#0e1022]" />
      </div>

      {/* Telescope — signal review instrument */}
      <div className="min-h-0 flex-1 px-3 pb-3">
        <TelescopePanel signals={telescopeSignals ?? []} sector={sector} />
      </div>

    </div>
  );
}
