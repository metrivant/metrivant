import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";
import { signalTypeLabel, signalTypeColor, type AlertRow } from "../../../lib/alert";
import MarkReadButton from "./MarkReadButton";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function timeOfDay(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

const URGENCY_CONFIG: Record<number, { label: string; color: string; border: string }> = {
  5: { label: "Critical", color: "#ef4444", border: "rgba(239,68,68,0.25)" },
  4: { label: "High",     color: "#f59e0b", border: "rgba(245,158,11,0.25)" },
  3: { label: "Medium",   color: "#60A5FA", border: "rgba(96,165,250,0.20)" },
};

function urgencyBadge(urgency: number) {
  const config = URGENCY_CONFIG[urgency] ?? {
    label: `U${urgency}`,
    color: "#6b7280",
    border: "rgba(107,114,128,0.20)",
  };
  return config;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AlertsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let alerts: AlertRow[] = [];
  let fetchError = false;
  let unreadCount = 0;

  try {
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (org) {
      const { data, error } = await supabase
        .from("alerts")
        .select(
          "id, signal_id, competitor_name, signal_type, summary, urgency, severity, created_at, read"
        )
        .eq("org_id", org.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        fetchError = true;
      } else {
        alerts = (data ?? []) as AlertRow[];
        unreadCount = alerts.filter((a) => !a.read).length;
      }
    }
  } catch {
    fetchError = true;
  }

  // Group by day
  const groups = new Map<string, AlertRow[]>();
  for (const alert of alerts) {
    const day = formatDate(alert.created_at);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(alert);
  }

  return (
    <div className="min-h-screen bg-[#000200] text-white">

      {/* ── Atmospheric depth ─────────────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.85) 0.5px, transparent 0.5px)",
          backgroundSize: "6px 6px",
          opacity: 0.018,
        }}
      />
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 35% at 50% -5%, rgba(46,230,166,0.05) 0%, transparent 70%)",
        }}
      />

      {/* ── Mini header ───────────────────────────────────────────── */}
      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-[#0e2210] bg-[rgba(0,2,0,0.97)] px-6">
        <div
          className="absolute inset-x-0 top-0 h-[1px]"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(46,230,166,0.20) 40%, rgba(46,230,166,0.35) 50%, rgba(46,230,166,0.20) 60%, transparent 100%)",
          }}
        />
        <Link href="/app" className="flex items-center gap-3">
          <svg width="22" height="22" viewBox="0 0 46 46" fill="none" aria-hidden="true">
            <circle cx="23" cy="23" r="21.5" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.50" />
            <circle cx="23" cy="23" r="13"   stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.28" />
            <circle cx="23" cy="23" r="5.5"  stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.42" />
            <path d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z" fill="#2EE6A6" fillOpacity="0.10" />
            <line x1="23" y1="23" x2="38.2" y2="9.8" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.80" />
            <circle cx="23" cy="23" r="2.5" fill="#2EE6A6" />
          </svg>
          <span className="text-[13px] font-bold tracking-[0.08em] text-white">METRIVANT</span>
        </Link>

        <div className="flex items-center gap-5">
          <Link href="/app/briefs" className="text-[12px] text-slate-600 transition-colors hover:text-slate-400">
            Briefs
          </Link>
          <Link href="/app/settings" className="text-[12px] text-slate-600 transition-colors hover:text-slate-400">
            Settings
          </Link>
          <Link
            href="/app"
            className="flex items-center gap-1.5 text-[12px] text-slate-500 transition-colors hover:text-slate-300"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M7.5 2L3.5 6L7.5 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Radar
          </Link>
        </div>
      </header>

      {/* ── Page ──────────────────────────────────────────────────── */}
      <div className="relative mx-auto max-w-2xl px-6 pb-20 pt-10">

        {/* Title row */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-slate-600">
              Signal Alerts
            </div>
            <h1 className="text-[22px] font-bold tracking-tight text-white">
              Competitor movements
            </h1>
            <p className="mt-1 text-[13px] text-slate-500">
              High-priority signals · checked every hour
            </p>
          </div>
          <div className="mt-1 flex items-center gap-3">
            {unreadCount > 0 && (
              <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-400">
                {unreadCount} unread
              </span>
            )}
            <MarkReadButton disabled={unreadCount === 0} />
          </div>
        </div>

        {/* Error state */}
        {fetchError && (
          <div className="rounded-[14px] border border-[#1a2a1a] bg-[#0a140a] p-8 text-center">
            <p className="text-[13px] text-slate-600">
              Could not load alerts. The alerts feature may not be enabled for your account yet.
            </p>
          </div>
        )}

        {/* Empty state */}
        {!fetchError && alerts.length === 0 && (
          <div className="flex flex-col items-center rounded-[18px] border border-[#0d2010] px-8 py-16 text-center"
            style={{ background: "rgba(2,8,2,0.5)" }}>
            <div
              className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#0d2010]"
              style={{ background: "rgba(46,230,166,0.04)" }}
            >
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                <path d="M11 2.5C7.96 2.5 5.5 4.96 5.5 8v5.5l-1.5 1.5v.5h14v-.5L16.5 13.5V8C16.5 4.96 14.04 2.5 11 2.5Z"
                  stroke="rgba(46,230,166,0.30)" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M9 17a2 2 0 0 0 4 0" stroke="rgba(46,230,166,0.30)" strokeWidth="1.5" />
              </svg>
            </div>
            <h2 className="text-[15px] font-semibold text-white">No alerts yet</h2>
            <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-slate-500">
              Competitor signals with urgency ≥ 3 will appear here automatically,
              checked every hour.
            </p>
          </div>
        )}

        {/* Grouped alert list */}
        {!fetchError && groups.size > 0 && (
          <div className="flex flex-col gap-8">
            {Array.from(groups.entries()).map(([day, dayAlerts]) => (
              <div key={day}>
                {/* Day header */}
                <div className="mb-3 flex items-center gap-3">
                  <span
                    className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]"
                    style={{ color: "rgba(46,230,166,0.35)" }}
                  >
                    {day}
                  </span>
                  <div
                    className="h-px flex-1"
                    style={{
                      background:
                        "linear-gradient(90deg, rgba(46,230,166,0.10) 0%, transparent 100%)",
                    }}
                  />
                  <span className="text-[10px] tabular-nums text-slate-700">
                    {dayAlerts.length}
                  </span>
                </div>

                {/* Alert cards */}
                <div className="flex flex-col gap-2">
                  {dayAlerts.map((alert) => {
                    const typeColor = signalTypeColor(alert.signal_type);
                    const urg = urgencyBadge(alert.urgency);

                    return (
                      <div
                        key={alert.id}
                        className={`relative rounded-[12px] border bg-[#020802] p-4 transition-colors ${
                          !alert.read
                            ? "border-[#152a15]"
                            : "border-[#0a140a]"
                        }`}
                        style={
                          !alert.read
                            ? { borderLeft: `2px solid ${typeColor.text}40` }
                            : undefined
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="text-[14px] font-semibold text-white">
                                {alert.competitor_name}
                              </span>
                              <span
                                className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.10em]"
                                style={{ background: typeColor.bg, color: typeColor.text }}
                              >
                                {signalTypeLabel(alert.signal_type)}
                              </span>
                            </div>
                            {alert.summary && (
                              <p className="text-[13px] leading-relaxed text-slate-400">
                                {alert.summary}
                              </p>
                            )}
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-2">
                            {/* Urgency */}
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]"
                              style={{
                                background: `${urg.color}14`,
                                color: urg.color,
                                border: `1px solid ${urg.border}`,
                              }}
                            >
                              {urg.label}
                            </span>
                            <span className="text-[11px] text-slate-700">
                              {timeOfDay(alert.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
