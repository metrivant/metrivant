import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";
import BillingTracker from "./BillingTracker";
import UpgradeClickTracker from "./UpgradeClickTracker";

// ── Plan data ──────────────────────────────────────────────────────────────────

// "analyst" is the current base plan key. "starter" is a legacy alias from
// earlier signups — both resolve to the same plan display.
type PlanKey = "analyst" | "pro";

const PLAN_FEATURES: Record<PlanKey, string[]> = {
  analyst: [
    "5 competitors monitored",
    "Weekly signal digest",
    "Radar dashboard",
    "30-day signal history",
    "Email support",
  ],
  pro: [
    "25 competitors monitored",
    "Real-time signal alerts",
    "Full intelligence drawer",
    "90-day signal history",
    "Strategic movement analysis",
    "Priority support",
  ],
};

const PLAN_PRICE: Record<PlanKey, string> = {
  analyst: "$9/mo",
  pro:     "$19/mo",
};

const PLAN_LABEL: Record<PlanKey, string> = {
  analyst: "Analyst",
  pro:     "Pro",
};

const PRO_UPGRADE_FEATURES = [
  "25 competitors (5× more coverage)",
  "Real-time signal alerts",
  "90-day signal history",
  "Strategic movement analysis",
  "Priority support",
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const rawPlan = (user.user_metadata?.plan as string | undefined) ?? "analyst";
  // Normalise legacy "starter" key from earlier signups to the current "analyst" key.
  const normPlan = rawPlan === "starter" ? "analyst" : rawPlan;
  const validPlan: PlanKey = (["analyst", "pro"] as PlanKey[]).includes(normPlan as PlanKey)
    ? (normPlan as PlanKey)
    : "analyst";

  const isUpgradable = validPlan === "analyst";
  const isPro        = validPlan === "pro";

  return (
    <div className="min-h-screen bg-[#000200] text-white">
      <BillingTracker />

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
          <Link href="/app/settings" className="text-[12px] text-slate-600 transition-colors hover:text-slate-400">
            Settings
          </Link>
          <Link href="/app" className="flex items-center gap-1.5 text-[12px] text-slate-500 transition-colors hover:text-slate-300">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M7.5 2L3.5 6L7.5 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Radar
          </Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-2xl px-6 py-16">

        {/* Title */}
        <div className="mb-10">
          <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-slate-600">
            Account
          </div>
          <h1 className="text-[22px] font-bold leading-tight tracking-tight text-white">
            Billing &amp; Plan
          </h1>
        </div>

        {/* ── Current plan ──────────────────────────────────────────── */}
        <section className="mb-4 rounded-[16px] border border-[#0d2010] bg-[#020802] p-6">
          <div className="mb-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Current plan
          </div>

          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-[22px] font-bold text-white">{PLAN_LABEL[validPlan]}</span>
                <span className="text-[14px] text-slate-500">{PLAN_PRICE[validPlan]}</span>
              </div>
              <ul className="mt-4 space-y-2">
                {PLAN_FEATURES[validPlan].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span
                      className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: "#2EE6A6", opacity: 0.65 }}
                    />
                    <span className="text-[13px] text-slate-400">{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {isUpgradable && (
              <UpgradeClickTracker source="billing_current_plan">
                <Link
                  href="/pricing"
                  className="shrink-0 rounded-full bg-[#2EE6A6] px-5 py-2 text-[12px] font-bold text-black transition-opacity hover:opacity-90"
                >
                  Upgrade
                </Link>
              </UpgradeClickTracker>
            )}
          </div>
        </section>

        {/* ── Upgrade card (Analyst → Pro) ───────────────────────────── */}
        {isUpgradable && (
          <section
            className="relative mb-4 overflow-hidden rounded-[16px] border border-[#2EE6A6]/18 bg-[#030c03] p-6"
            style={{ boxShadow: "0 0 30px rgba(46,230,166,0.03)" }}
          >
            <div
              className="absolute inset-x-0 top-0 h-[1px]"
              style={{ background: "linear-gradient(90deg, transparent, rgba(46,230,166,0.40), transparent)" }}
            />

            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Unlock Pro
            </div>
            <div className="mb-4 flex items-baseline gap-2">
              <span className="text-[18px] font-bold text-white">$19</span>
              <span className="text-[13px] text-slate-500">/mo</span>
            </div>

            <ul className="mb-6 space-y-2">
              {PRO_UPGRADE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span
                    className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2EE6A6]"
                    style={{ boxShadow: "0 0 4px rgba(46,230,166,0.6)" }}
                  />
                  <span className="text-[13px] text-slate-300">{f}</span>
                </li>
              ))}
            </ul>

            <UpgradeClickTracker source="billing_upgrade_card">
              <Link
                href="/pricing"
                className="block rounded-full bg-[#2EE6A6] py-2.5 text-center text-[13px] font-bold text-black transition-opacity hover:opacity-90"
              >
                See all plans →
              </Link>
            </UpgradeClickTracker>
          </section>
        )}

        {/* ── Billing contact ───────────────────────────────────────── */}
        <section className="rounded-[16px] border border-[#0d2010] bg-[#020802] p-6">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Billing inquiries
          </div>
          <p className="text-[13px] text-slate-500">
            For subscription changes, invoices, or billing questions, contact{" "}
            <a href="mailto:billing@metrivant.com" className="text-[#2EE6A6] transition-opacity hover:opacity-80">
              billing@metrivant.com
            </a>
          </p>
        </section>

      </main>
    </div>
  );
}
