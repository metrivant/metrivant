import Link from "next/link";
import PublicNav from "../../components/PublicNav";
import PricingTracker from "../../components/PricingTracker";

const PLANS = [
  {
    name: "Analyst",
    price: "$9",
    period: "/mo",
    description: "Monitor your competitive landscape with weekly intelligence.",
    features: [
      "5 competitors monitored",
      "Weekly signal digest",
      "Radar dashboard",
      "30-day signal history",
      "Email support",
    ],
    cta: "Start free trial",
    href: "/signup?plan=analyst",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/mo",
    description: "Real-time intelligence for active competitive strategy.",
    features: [
      "25 competitors monitored",
      "Real-time signal alerts",
      "Full intelligence drawer",
      "90-day signal history",
      "Strategic movement analysis",
      "Priority support",
    ],
    cta: "Start free trial",
    href: "/signup?plan=pro",
    highlight: true,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#000200] text-white">
      <PricingTracker />
      <PublicNav />

      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.85) 0.5px, transparent 0.5px)",
          backgroundSize: "6px 6px",
          opacity: 0.018,
        }}
      />

      <section className="mx-auto max-w-5xl px-6 pb-24 pt-36">
        <div className="mb-14 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
            Simple pricing
          </h1>
          <p className="mt-4 text-[15px] text-slate-500">
            No seat fees. No usage limits. Pay for what you monitor.
          </p>
        </div>

        <div className="mx-auto grid max-w-2xl gap-4 md:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-[16px] border p-7 ${
                plan.highlight
                  ? "border-[#2EE6A6]/30 bg-[#030c03]"
                  : "border-[#0d2010] bg-[#020802]"
              }`}
              style={
                plan.highlight
                  ? { boxShadow: "0 0 40px rgba(46,230,166,0.04)" }
                  : undefined
              }
            >
              {plan.highlight && (
                <div className="absolute -top-px inset-x-0 h-[1px] rounded-t-[16px]"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(46,230,166,0.5), transparent)" }}
                />
              )}

              <div className="mb-6">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  {plan.name}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  {plan.period && (
                    <span className="text-[13px] text-slate-500">{plan.period}</span>
                  )}
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
                  {plan.description}
                </p>
              </div>

              <ul className="mb-8 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <span
                      className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: "#2EE6A6", opacity: 0.7 }}
                    />
                    <span className="text-[13px] text-slate-400">{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`block rounded-full py-2.5 text-center text-[13px] font-semibold transition-opacity hover:opacity-90 ${
                  plan.highlight
                    ? "bg-[#2EE6A6] text-black"
                    : "border border-[#1a3a20] text-slate-300 hover:border-[#2EE6A6]/30 hover:text-white"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
