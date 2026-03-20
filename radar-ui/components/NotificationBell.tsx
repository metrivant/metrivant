"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { signalTypeLabel, signalTypeColor, type AlertRow } from "../lib/alert";

// ── Relative time ─────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Single alert item ─────────────────────────────────────────────────────────

function AlertItem({ alert }: { alert: AlertRow }) {
  const color = signalTypeColor(alert.signal_type);
  return (
    <div
      className={`px-4 py-3.5 transition-colors hover:bg-[#030f03] ${
        !alert.read ? "border-l-2 border-[#00B4FF]/40" : "border-l-2 border-transparent"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-semibold text-white">
          {alert.competitor_name}
        </span>
        <span className="shrink-0 text-[10px] text-slate-600">
          {timeAgo(alert.created_at)}
        </span>
      </div>
      <div className="mb-1.5">
        <span
          className="inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.10em]"
          style={{ background: color.bg, color: color.text }}
        >
          {signalTypeLabel(alert.signal_type)}
        </span>
      </div>
      {alert.summary && (
        <p className="line-clamp-2 text-[12px] leading-relaxed text-slate-500">
          {alert.summary}
        </p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NotificationBell() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json() as { alerts: AlertRow[]; unreadCount: number };
      setAlerts(data.alerts);
      setUnreadCount(data.unreadCount);
    } catch {
      // silent fail — bell just shows 0
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function onOutsideClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [isOpen]);

  async function handleOpen() {
    const opening = !isOpen;
    setIsOpen(opening);

    if (opening && unreadCount > 0) {
      // Optimistically clear unread count
      setUnreadCount(0);
      setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));

      // Persist to server
      void fetch("/api/alerts/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    }
  }

  const recentAlerts = alerts.slice(0, 8);

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative flex h-8 w-8 items-center justify-center rounded-full border border-[#0d1020] bg-[#020208] text-slate-500 transition-colors hover:border-[#152a15] hover:text-slate-300"
        aria-label={`Notifications${unreadCount > 0 ? ` — ${unreadCount} unread` : ""}`}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 15 15"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M7.5 1.5C5.015 1.5 3 3.515 3 6v3.5l-1 1v.5h11v-.5l-1-1V6c0-2.485-2.015-4.5-4.5-4.5Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path
            d="M6 12a1.5 1.5 0 0 0 3 0"
            stroke="currentColor"
            strokeWidth="1.3"
          />
        </svg>

        {/* Unread badge */}
        {!loading && unreadCount > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white"
            style={{ boxShadow: "0 0 6px rgba(239,68,68,0.6)" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-[14px] border border-[#0d1020] bg-[#020208]"
          style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,180,255,0.04)" }}
        >
          {/* Dropdown header */}
          <div className="flex items-center justify-between border-b border-[#0d1020] px-4 py-3">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Alerts
            </span>
            <Link
              href="/app/alerts"
              onClick={() => setIsOpen(false)}
              className="text-[11px] text-[#00B4FF] transition-opacity hover:opacity-80"
            >
              View all
            </Link>
          </div>

          {/* Alert list */}
          <div className="max-h-[360px] overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-[12px] text-slate-700">
                Loading…
              </div>
            ) : recentAlerts.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-[12px] text-slate-600">No alerts yet</p>
                <p className="mt-1 text-[11px] text-slate-700">
                  Signals above urgency 3 will appear here
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#0a180a]">
                {recentAlerts.map((alert) => (
                  <AlertItem key={alert.id} alert={alert} />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {recentAlerts.length > 0 && (
            <div className="border-t border-[#0d1020] px-4 py-2.5">
              <Link
                href="/app/alerts"
                onClick={() => setIsOpen(false)}
                className="text-[11px] text-slate-600 transition-colors hover:text-slate-400"
              >
                {alerts.length} total alert{alerts.length !== 1 ? "s" : ""} →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
