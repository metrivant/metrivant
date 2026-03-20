import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import BriefViewer from "./BriefViewer";
import BriefViewedTracker from "./BriefViewedTracker";
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

  // Resolve org so we can scope briefs to this org only
  let orgId: string | null = null;
  try {
    const { data: orgRows } = await supabase
      .from("organizations")
      .select("id")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);
    orgId = (orgRows?.[0]?.id as string | undefined) ?? null;
  } catch { /* non-fatal */ }

  let briefs: WeeklyBrief[] = [];
  let fetchError = false;

  try {
    // Show this org's briefs + legacy system-wide briefs (org_id IS NULL)
    // that predate the per-org migration. The IS NULL clause is backward-compat
    // only and will be vacuous once all briefs are org-scoped.
    let query = supabase
      .from("weekly_briefs")
      .select("id, generated_at, content, signal_count")
      .order("generated_at", { ascending: false })
      .limit(12);

    if (orgId) {
      query = query.or(`org_id.is.null,org_id.eq.${orgId}`);
    }

    const { data, error } = await query;

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
    <div className="min-h-screen bg-[#000002] text-white">
      <BriefViewedTracker />

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
            "radial-gradient(ellipse 70% 40% at 50% -5%, rgba(0,180,255,0.05) 0%, transparent 70%)",
        }}
      />

      {/* ── Page title ──────────────────────────────────────────────── */}
      <div className="relative mx-auto max-w-4xl px-6 pb-2 pt-10">
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
      <div className="relative mx-auto max-w-4xl px-6 pb-20 pt-8">

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
            className="flex flex-col items-center rounded-[18px] border border-[#0d1020] px-8 py-16 text-center"
            style={{ background: "rgba(2,8,2,0.5)" }}
          >
            {/* Brief icon */}
            <div
              className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#0d1020]"
              style={{ background: "rgba(0,180,255,0.04)" }}
            >
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                <rect x="3" y="2" width="16" height="18" rx="2.5" stroke="rgba(0,180,255,0.30)" strokeWidth="1.5" />
                <path d="M7 7h8M7 11h8M7 15h5" stroke="rgba(0,180,255,0.30)" strokeWidth="1.4" strokeLinecap="round" />
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
                style={{ color: "rgba(0,180,255,0.35)" }}
              >
                Previous
              </span>
              <div
                className="h-px flex-1"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(0,180,255,0.10) 0%, transparent 100%)",
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
