import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";
import { getSubscriptionState, TRIAL_DAYS } from "../../../lib/subscription";
import BillingTracker from "./BillingTracker";
import UpgradeClickTracker from "./UpgradeClickTracker";
import SyncOnSuccess from "./SyncOnSuccess";
import ManageSubscriptionPanel from "../../../components/ManageSubscriptionPanel";
import CheckoutButton from "../../../components/CheckoutButton";
import SubscribedStatusSurface from "../../../components/SubscribedStatusSurface";

// ── Constants ──────────────────────────────────────────────────────────────────

type PlanKey = "analyst" | "pro";

const PLAN_FEATURES: Record<PlanKey, string[]> = {
  analyst: [
    "10 competitors monitored",
    "Weekly signal digest",
    "Radar dashboard",
    "30-day signal history",
  ],
  pro: [
    "25 competitors monitored",
    "Real-time signal alerts",
    "Full intelligence drawer",
    "90-day signal history",
    "Strategic movement analysis",
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
  "25 competitors (2.5× more coverage)",
  "Real-time signal alerts",
  "90-day signal history",
  "Strategic movement analysis",
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const limitReached    = params["limit"] === "1";
  const checkoutSuccess = params["checkout"] === "success";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Resolve org for subscription lookup — guarded against schema cache errors
  let orgId: string | null = null;
  try {
    const { data: orgRows } = await supabase
      .from("organizations")
      .select("id")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);
    orgId = (orgRows?.[0]?.id as string | null) ?? null;
  } catch {
    // Non-fatal — billing page degrades to trial state when org can't be resolved
  }

  // ── Subscription state (authoritative from DB) ─────────────────────────────
  const subState = orgId
    ? await getSubscriptionState(supabase, orgId, user.created_at)
    : {
        plan:              "analyst" as PlanKey,
        status:            "trial"  as const,
        currentPeriodEnd:  null,
        cancelAtPeriodEnd: false,
        stripeCustomerId:  null,
      };

  const validPlan: PlanKey = subState.plan;

  // Trial end date — used in ManageSubscriptionPanel for non-paying users
  const trialExpiredAt = new Date(
    new Date(user.created_at).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  // Trial countdown — days remaining for active trial users
  const trialDaysRemaining = Math.max(0, Math.ceil(
    (new Date(trialExpiredAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  ));

  // user_metadata.plan fallback: Stripe webhook sets this on successful payment.
  // If the subscriptions table row is missing, this is the reliable signal.
  const metaPlan = user.user_metadata?.plan as string | undefined;
  const metaActiveSub = metaPlan === "analyst" || metaPlan === "pro";

  const hasActiveSub     = subState.status === "active"
                        || subState.status === "canceled_active"
                        || subState.status === "past_due"
                        || metaActiveSub;
  const canManageBilling = !!subState.stripeCustomerId;

  // Checkout success banner
  // (URL param checked client-side via searchParams — server receives it from request.url
  //  but for simplicity the banner is driven by the URL in BillingTracker which fires
  //  a client-side check.)

  return (
    <div className="min-h-screen bg-[#000200] text-white">
      <BillingTracker />

      {/* Sync fallback: webhook may not have fired yet when user returns from checkout */}
      {checkoutSuccess && !hasActiveSub && <SyncOnSuccess />}

      {limitReached && (
        <div
          className="relative z-20 flex items-center gap-3 border-b border-amber-500/20 bg-amber-500/[0.07] px-6 py-3"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="shrink-0">
            <path d="M7 1L13 12H1L7 1Z" stroke="#f59e0b" strokeWidth="1.2" strokeLinejoin="round" fill="none" />
            <line x1="7" y1="5.5" x2="7" y2="8.5" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="7" cy="10.5" r="0.7" fill="#f59e0b" />
          </svg>
          <span className="text-[12px] text-amber-400">
            You&apos;ve reached the 10-competitor limit on the Analyst plan. Upgrade to Pro for up to 25 competitors.
          </span>
        </div>
      )}

      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.85) 0.5px, transparent 0.5px)",
          backgroundSize: "6px 6px",
          opacity: 0.018,
        }}
      />

      {/* Header */}
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
            <path d="M23 23 L13.91 3.51 A21.5 21.5 0 0 1 23 1.5 Z" fill="#2EE6A6" fillOpacity="0.10" />
            <line x1="23" y1="23" x2="23" y2="1.5" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.80" />
            <circle cx="23" cy="23" r="2.5" fill="#2EE6A6" />
          </svg>
          <span className="text-[13px] font-bold tracking-[0.08em] text-white">METRIVANT</span>
        </Link>

        <div className="flex items-center gap-4">
          <ManageSubscriptionPanel
            subState={subState}
            trialExpiredAt={trialExpiredAt}
            createdAt={user.created_at}
          />
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

        {/* ── Subscribed: premium status surface ────────────────────── */}
        {hasActiveSub && (subState.status === "active" || subState.status === "canceled_active" || subState.status === "past_due") && (
          <SubscribedStatusSurface
            plan={validPlan}
            status={subState.status as "active" | "canceled_active" | "past_due"}
            currentPeriodEnd={subState.currentPeriodEnd}
            canManageBilling={canManageBilling}
          />
        )}

        {/* ── Not subscribed: current plan card + upgrade path ──────── */}
        {!hasActiveSub && (
          <>
            <section className="mb-4 rounded-[16px] border border-[#0d2010] bg-[#020802] p-6">
              <div className="mb-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Current plan
              </div>

              <div className="flex items-start justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[22px] font-bold text-white">{PLAN_LABEL[validPlan]}</span>
                    <span className="text-[14px] text-slate-500">{PLAN_PRICE[validPlan]}</span>
                  </div>

                  {/* Subscription status line */}
                  <div className="mt-2 mb-4">
                    {subState.status === "trial" && (
                      <span className="text-[12px] text-amber-400">
                        {trialDaysRemaining === 0
                          ? "Trial ends today — subscribe to keep access"
                          : trialDaysRemaining === 1
                            ? "Trial ends tomorrow"
                            : `Trial active — ${trialDaysRemaining} days remaining`}
                      </span>
                    )}
                    {subState.status === "expired" && (
                      <span className="text-[12px] text-red-400">
                        Trial expired — subscribe to continue
                      </span>
                    )}
                  </div>

                  <ul className="space-y-2">
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

                <div className="flex shrink-0 flex-col gap-2">
                  <UpgradeClickTracker source="billing_current_plan">
                    <CheckoutButton
                      plan="pro"
                      className="rounded-full bg-[#2EE6A6] px-5 py-2 text-[12px] font-bold text-black transition-opacity hover:opacity-90"
                    >
                      Upgrade
                    </CheckoutButton>
                  </UpgradeClickTracker>
                </div>
              </div>
            </section>

            {/* ── Upgrade card (trial / expired users) ──────────────── */}
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
                <CheckoutButton
                  plan="pro"
                  className="block w-full rounded-full bg-[#2EE6A6] py-2.5 text-center text-[13px] font-bold text-black transition-opacity hover:opacity-90"
                >
                  Upgrade →
                </CheckoutButton>
              </UpgradeClickTracker>
            </section>
          </>
        )}

        {/* ── Subscribed Analyst: upgrade to Pro path ───────────────── */}
        {hasActiveSub && validPlan === "analyst" && (
          <section
            className="relative mb-4 overflow-hidden rounded-[16px] border border-[#2EE6A6]/12 bg-[#030c03] p-6"
            style={{ boxShadow: "0 0 24px rgba(46,230,166,0.02)" }}
          >
            <div
              className="absolute inset-x-0 top-0 h-[1px]"
              style={{ background: "linear-gradient(90deg, transparent, rgba(46,230,166,0.28), transparent)" }}
            />
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">
              Upgrade to Pro
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
                    style={{ opacity: 0.55 }}
                  />
                  <span className="text-[13px] text-slate-400">{f}</span>
                </li>
              ))}
            </ul>
            <UpgradeClickTracker source="billing_upgrade_card">
              <form action="/api/stripe/upgrade" method="POST">
                <button
                  type="submit"
                  className="block w-full rounded-full bg-[#2EE6A6] py-2.5 text-center text-[13px] font-bold text-black transition-opacity hover:opacity-90"
                >
                  Upgrade to Pro →
                </button>
              </form>
            </UpgradeClickTracker>
          </section>
        )}

        {/* ── Billing contact ───────────────────────────────────────── */}
        <section className="rounded-[16px] border border-[#0d2010] bg-[#020802] p-6">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Billing inquiries
          </div>
          <p className="text-[13px] text-slate-500">
            For invoices or billing questions, contact{" "}
            <a href="mailto:billing@metrivant.com" className="text-[#2EE6A6] transition-opacity hover:opacity-80">
              billing@metrivant.com
            </a>
          </p>
        </section>

      </main>
    </div>
  );
}
