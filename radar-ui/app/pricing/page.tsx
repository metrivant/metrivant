import Link from "next/link";
import PublicNav from "../../components/PublicNav";
import PricingTracker from "../../components/PricingTracker";

// Support tiers removed — plans focus on intelligence value only.
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
    ],
    cta: "Start free trial",
    href: "/signup?plan=pro",
    highlight: true,
  },
];

// ── Inline SVG plan graphics ──────────────────────────────────────────────────

function RadarGraphic() {
  return (
    <svg width="88" height="88" viewBox="0 0 200 200" fill="none" aria-hidden="true" className="shrink-0 opacity-65">
      <circle cx="100" cy="100" r="88"  stroke="#2EE6A6" strokeWidth="0.6" strokeOpacity="0.18"/>
      <circle cx="100" cy="100" r="64"  stroke="#2EE6A6" strokeWidth="0.5" strokeOpacity="0.14"/>
      <circle cx="100" cy="100" r="40"  stroke="#2EE6A6" strokeWidth="0.5" strokeOpacity="0.20"/>
      <circle cx="100" cy="100" r="18"  stroke="#2EE6A6" strokeWidth="0.5" strokeOpacity="0.26"/>
      <line x1="100" y1="10" x2="100" y2="190" stroke="#2EE6A6" strokeWidth="0.3" strokeOpacity="0.08" strokeDasharray="3 6"/>
      <line x1="10"  y1="100" x2="190" y2="100" stroke="#2EE6A6" strokeWidth="0.3" strokeOpacity="0.08" strokeDasharray="3 6"/>
      <path d="M100 100 L183 28 A88 88 0 0 1 188 100 Z" fill="#2EE6A6" fillOpacity="0.05"/>
      <line x1="100" y1="100" x2="183" y2="28" stroke="#2EE6A6" strokeWidth="0.9" strokeOpacity="0.22"/>
      <circle cx="143" cy="52"  r="3.5" fill="#2EE6A6" fillOpacity="0.60"/>
      <circle cx="143" cy="52"  r="9"   stroke="#2EE6A6" strokeWidth="0.5" strokeOpacity="0.18"/>
      <circle cx="66"  cy="70"  r="2.5" fill="#2EE6A6" fillOpacity="0.35"/>
      <circle cx="150" cy="122" r="3"   fill="#2EE6A6" fillOpacity="0.42"/>
      <circle cx="72"  cy="148" r="2"   fill="#2EE6A6" fillOpacity="0.25"/>
      <circle cx="100" cy="100" r="2"   fill="#2EE6A6" fillOpacity="0.70"/>
    </svg>
  );
}

function MapGraphic() {
  return (
    <svg width="88" height="88" viewBox="0 0 200 200" fill="none" aria-hidden="true" className="shrink-0 opacity-65">
      <rect x="15" y="15" width="170" height="170" rx="2" stroke="#2EE6A6" strokeWidth="0.5" strokeOpacity="0.14"/>
      <line x1="100" y1="15"  x2="100" y2="185" stroke="#2EE6A6" strokeWidth="0.3" strokeOpacity="0.09" strokeDasharray="3 5"/>
      <line x1="15"  y1="100" x2="185" y2="100" stroke="#2EE6A6" strokeWidth="0.3" strokeOpacity="0.09" strokeDasharray="3 5"/>
      <line x1="65"  y1="138" x2="80"  y2="66"  stroke="#2EE6A6" strokeWidth="0.5" strokeOpacity="0.18" strokeDasharray="2 4"/>
      <line x1="122" y1="152" x2="144" y2="70"  stroke="#2EE6A6" strokeWidth="0.5" strokeOpacity="0.14" strokeDasharray="2 4"/>
      <circle cx="80"  cy="66"  r="5.5" fill="#2EE6A6" fillOpacity="0.65"/>
      <circle cx="80"  cy="66"  r="13"  stroke="#2EE6A6" strokeWidth="0.5" strokeOpacity="0.16"/>
      <circle cx="144" cy="70"  r="4.5" fill="#2EE6A6" fillOpacity="0.52"/>
      <circle cx="144" cy="70"  r="11"  stroke="#2EE6A6" strokeWidth="0.5" strokeOpacity="0.13"/>
      <circle cx="38"  cy="52"  r="3"   fill="#2EE6A6" fillOpacity="0.32"/>
      <circle cx="160" cy="132" r="3.5" fill="#2EE6A6" fillOpacity="0.28"/>
      <circle cx="65"  cy="138" r="3"   stroke="#2EE6A6" strokeWidth="0.5" strokeOpacity="0.22" fill="none"/>
      <circle cx="122" cy="152" r="2.5" stroke="#2EE6A6" strokeWidth="0.5" strokeOpacity="0.18" fill="none"/>
      <path d="M80 66 Q112 58 144 70" stroke="#2EE6A6" strokeWidth="0.5" strokeOpacity="0.14" fill="none" strokeDasharray="2 4"/>
    </svg>
  );
}

const GRAPHICS = { Analyst: <RadarGraphic />, Pro: <MapGraphic /> } as const;

// ── Page ──────────────────────────────────────────────────────────────────────

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
          {/* Task 8: psychologically compelling messaging */}
          <p className="mt-4 text-[15px] text-slate-500">
            All signals. One subscription.
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
                <div
                  className="absolute -top-px inset-x-0 h-[1px] rounded-t-[16px]"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(46,230,166,0.5), transparent)" }}
                />
              )}

              {/* Header row: text (left) + graphic (right) */}
              <div className="mb-6 flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      {plan.name}
                    </div>
                    {plan.highlight && (
                      <span className="rounded-full bg-[#2EE6A6]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#2EE6A6]">
                        Popular
                      </span>
                    )}
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

                {/* Intelligence-style plan graphic */}
                {GRAPHICS[plan.name as keyof typeof GRAPHICS]}
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
