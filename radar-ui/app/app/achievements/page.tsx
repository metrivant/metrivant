import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";

export default async function AchievementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-[#000200] text-white pb-[80px]">
      {/* Atmospheric depth */}
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

      {/* Header */}
      <div className="relative mx-auto max-w-2xl px-5 pt-10 pb-2">
        <div
          className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em]"
          style={{ color: "rgba(46,230,166,0.50)" }}
        >
          Achievements
        </div>
        <h1 className="text-[22px] font-bold tracking-tight text-white">
          Milestones
        </h1>
      </div>

      {/* Placeholder content */}
      <div className="relative mx-auto flex max-w-2xl flex-col items-center px-5 pt-24 text-center">
        {/* Shield / trophy icon */}
        <div
          className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[#0d2010]"
          style={{ background: "rgba(46,230,166,0.04)" }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M14 3L5 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-4z"
              stroke="rgba(46,230,166,0.30)"
              strokeWidth="1.5"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M10 14l2.5 2.5L18 11"
              stroke="rgba(46,230,166,0.30)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h2 className="text-[15px] font-semibold text-white">Coming soon</h2>
        <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-slate-400">
          Track your intelligence milestones — first signal, first movement,
          first brief, coverage depth.
        </p>
        <p className="mt-3 max-w-xs text-[12px] leading-relaxed text-slate-600">
          Achievement tracking will appear here as the system detects your
          progress.
        </p>
      </div>
    </div>
  );
}
