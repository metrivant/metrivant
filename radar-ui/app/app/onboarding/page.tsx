import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import Link from "next/link";
import { SECTOR_CONFIGS, SECTORS } from "../../../lib/sectors";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Pre-load existing sector preference if org already exists
  const { data: org } = await supabase
    .from("organizations")
    .select("sector")
    .eq("owner_id", user.id)
    .maybeSingle();

  const currentSector = org?.sector ?? "saas";

  return (
    <div className="min-h-screen bg-[#000200] text-white">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.85) 0.5px, transparent 0.5px)",
          backgroundSize: "6px 6px",
          opacity: 0.018,
        }}
      />

      {/* Mini header */}
      <header className="relative z-10 flex h-14 items-center justify-between border-b border-[#0e2210] bg-[rgba(0,2,0,0.97)] px-6">
        <div className="flex items-center gap-3">
          <svg width="24" height="24" viewBox="0 0 46 46" fill="none" aria-hidden="true">
            <circle cx="23" cy="23" r="21.5" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.50" />
            <circle cx="23" cy="23" r="13"   stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.28" />
            <circle cx="23" cy="23" r="5.5"  stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.42" />
            <path d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z" fill="#2EE6A6" fillOpacity="0.10" />
            <line x1="23" y1="23" x2="38.2" y2="9.8" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.80" />
            <circle cx="23" cy="23" r="2.5" fill="#2EE6A6" />
          </svg>
          <span className="text-[14px] font-bold tracking-[0.08em] text-white">METRIVANT</span>
        </div>
        <Link href="/app" className="text-[12px] text-slate-500 hover:text-slate-300 transition-colors">
          Skip to radar →
        </Link>
      </header>

      <main className="relative mx-auto max-w-lg px-6 py-16">
        <div className="mb-10">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2EE6A6]/60">
            Setup
          </div>
          <h1 className="text-3xl font-bold text-white">Add your first competitor</h1>
          <p className="mt-2 text-[14px] text-slate-500">
            Tell Metrivant which sector you operate in, then add the first competitor to monitor.
          </p>
        </div>

        <form action="/api/onboard-competitor" method="POST" className="flex flex-col gap-4">

          {/* ── Sector selector ─────────────────────────────────────────── */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium uppercase tracking-[0.15em] text-slate-500">
              Your sector
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {SECTORS.map((s) => {
                const cfg = SECTOR_CONFIGS[s];
                const isActive = s === currentSector;
                return (
                  <label
                    key={s}
                    className="relative cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="sector"
                      value={s}
                      defaultChecked={isActive}
                      className="peer sr-only"
                    />
                    <div
                      className="rounded-[10px] border px-3 py-3 transition-all peer-checked:border-[#2EE6A6]/35 peer-checked:bg-[#2EE6A6]/6"
                      style={{
                        borderColor: isActive ? "rgba(46,230,166,0.35)" : "#0d2010",
                        background: isActive ? "rgba(46,230,166,0.06)" : "#030c03",
                      }}
                    >
                      <div className="text-[13px] font-semibold text-white">{cfg.label}</div>
                      <div className="mt-0.5 text-[11px] leading-snug text-slate-600">
                        {cfg.description}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* ── Competitor URL ──────────────────────────────────────────── */}
          <div className="flex flex-col gap-1.5 mt-2">
            <label className="text-[12px] font-medium uppercase tracking-[0.15em] text-slate-500">
              Competitor website
            </label>
            <input
              type="url"
              name="url"
              required
              placeholder="https://competitor.com"
              className="rounded-[10px] border border-[#0d2010] bg-[#030c03] px-4 py-3 text-[14px] text-white placeholder-slate-700 outline-none transition-colors focus:border-[#2EE6A6]/30 focus:ring-1 focus:ring-[#2EE6A6]/20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium uppercase tracking-[0.15em] text-slate-500">
              Competitor name
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="Acme Corp"
              className="rounded-[10px] border border-[#0d2010] bg-[#030c03] px-4 py-3 text-[14px] text-white placeholder-slate-700 outline-none transition-colors focus:border-[#2EE6A6]/30 focus:ring-1 focus:ring-[#2EE6A6]/20"
            />
          </div>

          <button
            type="submit"
            className="mt-2 rounded-full bg-[#2EE6A6] py-3 text-[14px] font-semibold text-black transition-opacity hover:opacity-90"
          >
            Start monitoring
          </button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-2">
          <div className="flex items-center gap-3 text-[12px] text-slate-700">
            <span className="h-px w-10 bg-[#0d2010]" />
            <span>or</span>
            <span className="h-px w-10 bg-[#0d2010]" />
          </div>
          <Link
            href="/app/discover"
            className="mt-1 text-[13px] font-medium text-[#2EE6A6] transition-opacity hover:opacity-80"
          >
            Browse competitors by category →
          </Link>
        </div>
      </main>
    </div>
  );
}
