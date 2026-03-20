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

// ── Movement type → neon color + tag label ────────────────────────────────────

const MOVEMENT_COLOR: Record<string, string> = {
  pricing_strategy_shift: "#f97316",  // orange
  product_expansion:      "#00e5ff",  // cyan
  market_reposition:      "#a855f7",  // violet
  enterprise_push:        "#f59e0b",  // amber
  ecosystem_expansion:    "#22d3ee",  // electric blue
};

const MOVEMENT_TAG: Record<string, string> = {
  pricing_strategy_shift: "PRICING",
  product_expansion:      "PRODUCT",
  market_reposition:      "REPOSITION",
  enterprise_push:        "ENTERPRISE",
  ecosystem_expansion:    "ECOSYSTEM",
};

// ── Ticker item type ──────────────────────────────────────────────────────────

type TickerItem = {
  text:     string;
  tag:      string;
  color:    string;
  tagColor: string;
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

function buildTickerItems(
  competitors: RadarCompetitor[],
  newsItems: string[]
): TickerItem[] {
  const items: TickerItem[] = [];

  for (const c of competitors) {
    if (c.latest_movement_type) {
      const color   = MOVEMENT_COLOR[c.latest_movement_type] ?? "#94a3b8";
      const tag     = MOVEMENT_TAG[c.latest_movement_type]
        ?? c.latest_movement_type.replace(/_/g, " ").toUpperCase();
      const summary = c.latest_movement_summary?.slice(0, 90) ?? null;
      items.push({
        text:     summary
          ? `${c.competitor_name.toUpperCase()} — ${summary}`
          : c.competitor_name.toUpperCase(),
        tag,
        color,
        tagColor: color,
      });
    } else if ((c.signals_7d ?? 0) > 0) {
      // Signals detected but pipeline hasn't yet classified a movement
      const n = c.signals_7d;
      items.push({
        text:     `${c.competitor_name.toUpperCase()} — ${n} signal${n !== 1 ? "s" : ""} detected · classifying`,
        tag:      "ACTIVE",
        color:    "rgba(0,180,255,0.65)",
        tagColor: "rgba(0,180,255,0.35)",
      });
    }
  }

  for (const headline of newsItems) {
    items.push({
      text:     headline.slice(0, 100),
      tag:      "SECTOR",
      color:    "rgba(0,180,255,0.80)",
      tagColor: "rgba(0,180,255,0.45)",
    });
  }

  if (items.length === 0) {
    const tracked = competitors.length;
    items.push({
      text:     tracked > 0
        ? `SYS MONITORING ${tracked} RIVAL${tracked !== 1 ? "S" : ""} — PIPELINE PROCESSING`
        : "SYS MONITORING ACTIVE — NO RIVALS TRACKED",
      tag:      "SYS",
      color:    "#475569",
      tagColor: "#334155",
    });
  }

  return items;
}

// ── Single ticker item renderer ───────────────────────────────────────────────

function TickerEntry({ item }: { item: TickerItem }) {
  return (
    <span
      className="inline-flex shrink-0 items-center"
      style={{ fontFamily: "'Courier New', Monaco, 'Lucida Console', monospace" }}
    >
      <span
        style={{
          color:         item.tagColor,
          fontSize:      "8px",
          fontWeight:    700,
          letterSpacing: "0.20em",
          marginRight:   "7px",
          opacity:       0.75,
        }}
      >
        {item.tag}
      </span>
      <span
        style={{
          color:         item.color,
          fontSize:      "10px",
          letterSpacing: "0.035em",
        }}
      >
        {item.text}
      </span>
      <span
        aria-hidden="true"
        style={{
          color:    "rgba(0,180,255,0.18)",
          margin:   "0 18px",
          fontSize: "10px",
        }}
      >
        ·
      </span>
    </span>
  );
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
  const [tz, setTz]                       = useState("UTC");
  const [now, setNow]                     = useState<Date | null>(null);
  const [showSettings, setShowSettings]   = useState(false);
  const [liveNewsItems, setLiveNewsItems] = useState<string[]>(initialNewsItems);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Hydrate timezone from localStorage; auto-detect from browser locale if absent.
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
    const delay    = setTimeout(refresh, 5 * 60 * 1000);
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

  const tickerItems    = buildTickerItems(competitors, liveNewsItems);
  // ~8s per item, min 35s for premium readable pacing
  const tickerDuration = `${Math.max(35, tickerItems.length * 8)}s`;

  return (
    <div
      className="relative z-10 flex h-[26px] shrink-0 items-stretch border-b border-[#0a0a1a] bg-[#000100]"
    >

      {/* ── Clock | Date | TZ ───────────────────────────────────────────── */}
      <div
        className="relative flex shrink-0 items-center gap-2.5 border-r border-[#0d1f0d] px-4"
        ref={settingsRef}
        style={{ fontFamily: "'Courier New', Monaco, 'Lucida Console', monospace" }}
      >
        <span
          className="text-[11px] tabular-nums tracking-[0.06em]"
          style={{ color: "#00B4FF" }}
        >
          {clock}
        </span>
        <span className="hidden text-[10px] tracking-[0.04em] text-slate-700 md:inline">
          {dateStr}
        </span>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="rounded px-1 py-[1px] text-[9px] font-bold tracking-[0.12em] text-slate-700 transition-colors hover:text-slate-400"
          style={{ background: "#0a0a1a" }}
          aria-label="Change timezone"
        >
          {tzAbbr}
        </button>

        {showSettings && (
          <div
            className="absolute left-0 top-full z-50 mt-1 w-40 rounded-[10px] border border-[#1a2030] bg-[#06060d] py-1"
            style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.92), 0 0 0 1px rgba(0,180,255,0.04)" }}
          >
            <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-slate-700">
              Timezone
            </div>
            {TIMEZONE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => selectTz(opt.value)}
                className={`flex w-full items-center justify-between px-3 py-1 text-left text-[11px] transition-colors hover:bg-[#0a0a1a] ${
                  tz === opt.value ? "text-[#00B4FF]" : "text-slate-600"
                }`}
              >
                <span>{opt.label}</span>
                {tz === opt.value && (
                  <span className="h-1 w-1 rounded-full bg-[#00B4FF]" />
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

        {/*
          Two identical sets of items.
          The CSS keyframe translates the container from 0 → -50%.
          When the first set scrolls fully off-left, the second set is
          at exactly 0 — creating a seamless infinite loop with no gap.
        */}
        <div
          className="flex h-full items-center whitespace-nowrap"
          style={{
            animation: `intelligence-ticker ${tickerDuration} linear infinite`,
            willChange: "transform",
            backfaceVisibility: "hidden",
          }}
        >
          {tickerItems.map((item, i) => (
            <TickerEntry key={`a-${i}`} item={item} />
          ))}
          {tickerItems.map((item, i) => (
            <TickerEntry key={`b-${i}`} item={item} />
          ))}
        </div>
      </div>

    </div>
  );
}
