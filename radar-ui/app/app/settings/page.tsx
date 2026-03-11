import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import Link from "next/link";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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
        <Link href="/app" className="flex items-center gap-3">
          <svg width="24" height="24" viewBox="0 0 46 46" fill="none" aria-hidden="true">
            <circle cx="23" cy="23" r="21.5" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.50" />
            <circle cx="23" cy="23" r="13"   stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.28" />
            <circle cx="23" cy="23" r="5.5"  stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.42" />
            <path d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z" fill="#2EE6A6" fillOpacity="0.10" />
            <line x1="23" y1="23" x2="38.2" y2="9.8" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.80" />
            <circle cx="23" cy="23" r="2.5" fill="#2EE6A6" />
          </svg>
          <span className="text-[14px] font-bold tracking-[0.08em] text-white">METRIVANT</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/app/billing" className="text-[12px] text-slate-500 hover:text-slate-300 transition-colors">
            Billing
          </Link>
          <Link href="/app" className="text-[12px] text-[#2EE6A6]">
            ← Radar
          </Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-2xl px-6 py-16">
        <h1 className="mb-8 text-2xl font-bold text-white">Settings</h1>

        {/* Account */}
        <section className="mb-6 rounded-[14px] border border-[#0d2010] bg-[#020802] p-6">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Account
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[14px] text-white">{user.email}</div>
              <div className="mt-0.5 text-[12px] text-slate-600">
                Member since {new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </div>
            </div>
          </div>
        </section>

        {/* Sign out */}
        <section className="rounded-[14px] border border-[#0d2010] bg-[#020802] p-6">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Session
          </h2>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="rounded-full border border-[#1a3a20] px-5 py-2 text-[13px] font-medium text-slate-400 transition-colors hover:border-red-900/40 hover:text-red-400"
            >
              Sign out
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
