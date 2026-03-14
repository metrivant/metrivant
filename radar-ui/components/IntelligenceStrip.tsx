"use client";

import { useState, useEffect, useRef } from "react";
import type { RadarCompetitor } from "../lib/api";

// ── Timezone options ──────────────────────────────────────────────────────────

const TIMEZONE_OPTIONS = [
  { label: "UTC",   value: "UTC" },
  { label: "ET",    value: "America/New_York" },
  { label: "CT",    value: "America/Chicago" },
  { label: "MT",    value: "America/Denver" },
  { label: "PT",    value: "America/Los_Angeles" },
  { label: "GMT",   value: "Europe/London" },
  { label: "CET",   value: "Europe/Paris" },
  { label: "IST",   value: "Asia/Kolkata" },
  { label: "SGT",   value: "Asia/Singapore" },
  { label: "JST",   value: "Asia/Tokyo" },
  { label: "AEST",  value: "Australia/Sydney" },
];

const STORAGE_KEY = "mv_tz";

// ── Movement type → terminal display label ────────────────────────────────────

const MOVEMENT_LABEL: Record<string, string> = {
  pricing_strategy_shift: "PRICING",
  product_expansion:      "PRODUCT",
  market_reposition:      "REPOSITION",
  enterprise_push:        "ENTERPRISE",
  ecosystem_expansion:    "ECOSYSTEM",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTzAbbr(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return tz;
  }
}

function formatClock(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function formatDate(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value?.toUpperCase() ?? "";
  const day     = parts.find((p) => p.type === "day")?.value ?? "";
  const month   = parts.find((p) => p.type === "month")?.value?.toUpperCase() ?? "";
  return `${weekday} ${day} ${month}`;
}

function buildTickerText(competitors: RadarCompetitor[], newsItems: string[]): string {
  const segments: string[] = [];

  for (const c of competitors) {
    if (!c.latest_movement_type) continue;
    const label   = MOVEMENT_LABEL[c.latest_movement_type] ?? c.latest_movement_type.replace(/_/g, " ").toUpperCase();
    const summary = c.latest_movement_summary?.slice(0, 90) ?? null;
    segments.push(
      summary
        ? `${c.competitor_name.toUpperCase()}  ${label} — ${summary}`
        : `${c.competitor_name.toUpperCase()}  ${label}`
    );
  }

  // Interleave sector news headlines
  for (const headline of newsItems) {
    segments.push(`MARKET INTEL  ${headline.slice(0, 100)}`);
  }

  if (segments.length === 0) segments.push("MONITORING ACTIVE — AWAITING FIRST SIGNAL");

  // Separator between items; doubled for seamless infinite scroll
  const joined = segments.join("   ·   ");
  return joined + "   ·   ";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function IntelligenceStrip({
  competitors,
  newsItems: initialNewsItems = [],
  sector = "saas",
}: {
  competitors: RadarCompetitor[];
  newsItems?: string[];
  sector?: string;
}) {
  const [tz, setTz]                 = useState("UTC");
  const [now, setNow]               = useState<Date | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [liveNewsItems, setLiveNewsItems] = useState<string[]>(initialNewsItems);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Hydrate timezone from localStorage after mount.
  // If no saved preference, auto-detect from browser locale.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setTz(saved);
      } else {
        const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const match = TIMEZONE_OPTIONS.find((o) => o.value === browserTz);
        if (match) {
          setTz(match.value);
          localStorage.setItem(STORAGE_KEY, match.value);
        }
        // If no match, leave UTC as default — all IANA tz values still work
        // in formatClock/formatDate via Intl.DateTimeFormat
      }
    } catch {}
  }, []);

  // Live clock — 1-second interval
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Sector news refresh — poll every 5 minutes, non-blocking
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch(`/api/sector-news?sector=${encodeURIComponent(sector)}`);
        if (!res.ok || cancelled) return;
        const json = await res.json() as { items?: string[] };
        if (Array.isArray(json.items) && json.items.length > 0 && !cancelled) {
          setLiveNewsItems(json.items);
        }
      } catch { /* non-fatal */ }
    }
    // Refresh once immediately (after initial SSR items), then every 5 minutes
    const delay = setTimeout(refresh, 5 * 60 * 1000);
    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => { cancelled = true; clearTimeout(delay); clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sector]);

  // Close settings popover on outside click
  useEffect(() => {
    if (!showSettings) return;
    function handle(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showSettings]);

  function selectTz(value: string) {
    setTz(value);
    try { localStorage.setItem(STORAGE_KEY, value); } catch {}
    setShowSettings(false);
  }

  const clock   = now ? formatClock(now, tz) : "--:--:--";
  const dateStr = now ? formatDate(now, tz)  : "--- -- ---";
  const tzAbbr  = getTzAbbr(tz);

  const tickerText = buildTickerText(competitors, liveNewsItems);
  // Scale duration: faster for fewer items (feels more active), slower for many
  const tickerDuration = `${Math.max(22, competitors.filter((c) => c.latest_movement_type).length * 7)}s`;

  return (
    <div
      className="relative z-10 flex h-[26px] shrink-0 items-stretch border-b border-[#0a1a0a] bg-[#000100]"
      style={{ fontFamily: "'Courier New', Monaco, 'Lucida Console', monospace" }}
    >

      {/* ── Clock | Date | TZ ───────────────────────────────────────────── */}
      <div className="relative flex shrink-0 items-center gap-2.5 border-r border-[#0d1f0d] px-4" ref={settingsRef}>
        <span
          className="text-[11px] tabular-nums tracking-[0.06em]"
          style={{ color: "#2EE6A6" }}
        >
          {clock}
        </span>
        <span className="hidden text-[10px] tracking-[0.04em] text-slate-700 md:inline">
          {dateStr}
        </span>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="rounded px-1 py-[1px] text-[9px] font-bold tracking-[0.12em] text-slate-700 transition-colors hover:text-slate-400"
          style={{ background: "#0a1a0a" }}
          aria-label="Change timezone"
        >
          {tzAbbr}
        </button>

        {showSettings && (
          <div
            className="absolute left-0 top-full z-50 mt-1 w-40 rounded-[10px] border border-[#1a3020] bg-[#060d06] py-1"
            style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.92), 0 0 0 1px rgba(46,230,166,0.04)" }}
          >
            <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-slate-700">
              Timezone
            </div>
            {TIMEZONE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => selectTz(opt.value)}
                className={`flex w-full items-center justify-between px-3 py-1 text-left text-[11px] transition-colors hover:bg-[#0a1a0a] ${
                  tz === opt.value ? "text-[#2EE6A6]" : "text-slate-600"
                }`}
              >
                <span>{opt.label}</span>
                {tz === opt.value && (
                  <span className="h-1 w-1 rounded-full bg-[#2EE6A6]" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Scrolling ticker ─────────────────────────────────────────────── */}
      <div className="relative min-w-0 flex-1 overflow-hidden">
        {/* Left fade */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8"
          style={{ background: "linear-gradient(to right, #000100, transparent)" }}
        />
        {/* Right fade */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8"
          style={{ background: "linear-gradient(to left, #000100, transparent)" }}
        />

        <div
          className="flex h-full items-center whitespace-nowrap"
          style={{
            animation: `intelligence-ticker ${tickerDuration} linear infinite`,
          }}
        >
          {/* Doubled for seamless loop */}
          <span className="text-[10px] tracking-[0.04em] text-slate-500 px-2">
            {tickerText}
          </span>
          <span className="text-[10px] tracking-[0.04em] text-slate-700 px-2" aria-hidden="true">
            {tickerText}
          </span>
        </div>
      </div>

    </div>
  );
}
