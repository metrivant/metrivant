"use client";

import Link from "next/link";
import NotificationBell from "./NotificationBell";
import SectorSwitcher from "./SectorSwitcher";

interface MobileHeaderProps {
  sector: string;
  isQuiet: boolean;
  isFresh: boolean;
  lastSignalAt: string | null;
}

export default function MobileHeader({
  sector,
  isQuiet,
  isFresh,
  lastSignalAt,
}: MobileHeaderProps) {
  return (
    <header
      className="relative z-20 flex shrink-0 items-center justify-between border-b border-[#0e2210] bg-[rgba(0,0,0,0.98)] px-4 md:hidden"
      style={{
        height: "56px",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute inset-x-0 top-0 h-[1px]"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(46,230,166,0.25) 30%, rgba(46,230,166,0.45) 50%, rgba(46,230,166,0.25) 70%, transparent 100%)",
        }}
      />

      {/* Brand */}
      <Link href="/app" className="flex items-center gap-2.5" aria-label="Metrivant home">
        <svg width="28" height="28" viewBox="0 0 46 46" fill="none" aria-hidden="true">
          <circle cx="23" cy="23" r="21.5" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.50" />
          <circle cx="23" cy="23" r="13"   stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.28" />
          <circle cx="23" cy="23" r="5.5"  stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.42" />
          <path d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z" fill="#2EE6A6" fillOpacity="0.10" />
          <line x1="23" y1="23" x2="38.2" y2="9.8" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.80" />
          <circle cx="23" cy="23" r="2.5" fill="#2EE6A6" />
        </svg>
        <div className="flex flex-col gap-[2px]">
          <span
            className="text-[14px] font-bold leading-none text-white"
            style={{ letterSpacing: "0.08em" }}
          >
            METRIVANT
          </span>
          <span
            className="text-[9px] font-medium uppercase leading-none"
            style={{ letterSpacing: "0.22em", color: "rgba(46,230,166,0.50)" }}
          >
            Intel Radar
          </span>
        </div>
      </Link>

      {/* Right controls */}
      <div className="flex items-center gap-2.5">
        {/* Live status dot */}
        <span className="relative flex h-[6px] w-[6px] shrink-0">
          {!isQuiet && isFresh && lastSignalAt !== null && (
            <span className="absolute inset-0 animate-ping rounded-full bg-[#2EE6A6] opacity-55" />
          )}
          <span
            className={`relative h-[6px] w-[6px] rounded-full ${
              isQuiet
                ? "bg-slate-600"
                : isFresh
                  ? "bg-[#2EE6A6] shadow-[0_0_6px_rgba(46,230,166,0.7)]"
                  : "bg-amber-500"
            }`}
          />
        </span>

        {/* Sector switcher — compact pill */}
        <SectorSwitcher sector={sector} />

        {/* Notification bell */}
        <NotificationBell />
      </div>
    </header>
  );
}
