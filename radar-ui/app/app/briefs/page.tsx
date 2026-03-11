import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";
import BriefViewer from "./BriefViewer";
import type { BriefContent } from "../../../lib/brief";

type WeeklyBrief = {
  id: string;
  generated_at: string;
  content: BriefContent;
  signal_count: number;
};

export default async function BriefsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let briefs: WeeklyBrief[] = [];
  let fetchError = false;

  try {
    const { data, error } = await supabase
      .from("weekly_briefs")
      .select("id, generated_at, content, signal_count")
      .order("generated_at", { ascending: false })
      .limit(12);

    if (error) {
      fetchError = true;
    } else {
      briefs = (data ?? []) as WeeklyBrief[];
    }
  } catch {
    fetchError = true;
  }

  const [latest, ...older] = briefs;

  return (
    <div className="min-h-screen bg-[#000200] text-white">

      {/* ── Atmospheric depth ───────────────────────────────────────── */}
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
            "radial-gradient(ellipse 70% 40% at 50% -5%, rgba(46,230,166,0.05) 0%, transparent 70%)",
        }}
      />

      {/* ── Mini header ─────────────────────────────────────────────── */}
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
          <Link
            href="/app/discover"
            className="text-[12px] text-slate-600 transition-colors hover:text-slate-400"
          >
            Discover
          </Link>
          <Link
            href="/app/settings"
            className="text-[12px] text-slate-600 transition-colors hover:text-slate-400"
          >
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

      {/* ── Page title ──────────────────────────────────────────────── */}
      <div className="relative mx-auto max-w-3xl px-6 pb-2 pt-10">
        <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-slate-600">
          Intelligence Briefs
        </div>
        <h1 className="text-[22px] font-bold tracking-tight text-white">
          Weekly reports
        </h1>
        <p className="mt-1 text-[13px] text-slate-500">
          Synthesized intelligence from your monitored signal feed.
          Delivered every Monday.
        </p>
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div className="relative mx-auto max-w-3xl px-6 pb-20 pt-8">

        {/* Error state */}
        {fetchError && (
          <div className="rounded-[14px] border border-[#1a2a1a] bg-[#0a140a] p-8 text-center">
            <p className="text-[13px] text-slate-600">
              Could not load briefs. This feature may not be enabled for your account yet.
            </p>
          </div>
        )}

        {/* Empty state */}
        {!fetchError && briefs.length === 0 && (
          <div
            className="flex flex-col items-center rounded-[18px] border border-[#0d2010] px-8 py-16 text-center"
            style={{ background: "rgba(2,8,2,0.5)" }}
          >
            {/* Brief icon */}
            <div
              className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#0d2010]"
              style={{ background: "rgba(46,230,166,0.04)" }}
            >
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                <rect x="3" y="2" width="16" height="18" rx="2.5" stroke="rgba(46,230,166,0.30)" strokeWidth="1.5" />
                <path d="M7 7h8M7 11h8M7 15h5" stroke="rgba(46,230,166,0.30)" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="text-[15px] font-semibold text-white">
              No briefs generated yet
            </h2>
            <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-slate-500">
              Your first intelligence brief will be generated automatically
              every Monday. Briefs require at least one week of signal data to produce.
            </p>
          </div>
        )}

        {/* Latest brief */}
        {latest && (
          <BriefViewer
            id={latest.id}
            brief={latest.content}
            generatedAt={latest.generated_at}
            signalCount={latest.signal_count}
            isLatest
          />
        )}

        {/* Older briefs */}
        {older.length > 0 && (
          <div className="mt-12">
            <div className="mb-5 flex items-center gap-3">
              <span
                className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ color: "rgba(46,230,166,0.35)" }}
              >
                Previous
              </span>
              <div
                className="h-px flex-1"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(46,230,166,0.10) 0%, transparent 100%)",
                }}
              />
            </div>
            <div className="flex flex-col gap-6">
              {older.map((brief) => (
                <BriefViewer
                  key={brief.id}
                  id={brief.id}
                  brief={brief.content}
                  generatedAt={brief.generated_at}
                  signalCount={brief.signal_count}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
