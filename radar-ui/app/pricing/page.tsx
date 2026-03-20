import Link from "next/link";
import PublicNav from "../../components/PublicNav";
import PricingTracker from "../../components/PricingTracker";

const PLANS = [
  {
    name:        "Analyst",
    price:       "$9",
    period:      "/mo",
    description: "Live radar dashboard and weekly briefings on your top rivals. First signals within hours of setup.",
    features: [
      "10 competitors monitored",
      "Weekly intelligence digest",
      "Live radar dashboard",
    ],
    cta:       "Start free trial",
    href:      "/signup?plan=analyst",
    highlight: false,
  },
  {
    name:        "Pro",
    price:       "$19",
    period:      "/mo",
    description: "Live signals and alerts when rivals make their move.",
    features: [
      "Up to 25 rivals monitored",
      "Instant alerts on critical moves",
      "Deep-dive per-competitor profiles",
      "90-day signal history",
      "Cross-competitor pattern detection",
      "Live market positioning map",
    ],
    cta:       "Start free trial",
    href:      "/signup?plan=pro",
    highlight: true,
  },
];

// ── Inline SVG plan graphics ──────────────────────────────────────────────────

function RadarGraphic() {
  return (
    <svg width="88" height="88" viewBox="0 0 200 200" fill="none" aria-hidden="true" className="shrink-0 opacity-60">
      <circle cx="100" cy="100" r="88"  stroke="#00B4FF" strokeWidth="0.6" strokeOpacity="0.18"/>
      <circle cx="100" cy="100" r="64"  stroke="#00B4FF" strokeWidth="0.5" strokeOpacity="0.14"/>
      <circle cx="100" cy="100" r="40"  stroke="#00B4FF" strokeWidth="0.5" strokeOpacity="0.20"/>
      <circle cx="100" cy="100" r="18"  stroke="#00B4FF" strokeWidth="0.5" strokeOpacity="0.26"/>
      <line x1="100" y1="10" x2="100" y2="190" stroke="#00B4FF" strokeWidth="0.3" strokeOpacity="0.08" strokeDasharray="3 6"/>
      <line x1="10"  y1="100" x2="190" y2="100" stroke="#00B4FF" strokeWidth="0.3" strokeOpacity="0.08" strokeDasharray="3 6"/>
      <path d="M100 100 L183 28 A88 88 0 0 1 188 100 Z" fill="#00B4FF" fillOpacity="0.05"/>
      <line x1="100" y1="100" x2="183" y2="28" stroke="#00B4FF" strokeWidth="0.9" strokeOpacity="0.22"/>
      <circle cx="143" cy="52"  r="3.5" fill="#00B4FF" fillOpacity="0.60"/>
      <circle cx="143" cy="52"  r="9"   stroke="#00B4FF" strokeWidth="0.5" strokeOpacity="0.18"/>
      <circle cx="66"  cy="70"  r="2.5" fill="#00B4FF" fillOpacity="0.35"/>
      <circle cx="150" cy="122" r="3"   fill="#00B4FF" fillOpacity="0.42"/>
      <circle cx="72"  cy="148" r="2"   fill="#00B4FF" fillOpacity="0.25"/>
      <circle cx="100" cy="100" r="2"   fill="#00B4FF" fillOpacity="0.70"/>
    </svg>
  );
}

function MapGraphic() {
  return (
    <svg width="88" height="88" viewBox="0 0 200 200" fill="none" aria-hidden="true" className="shrink-0 opacity-60">
      <rect x="15" y="15" width="170" height="170" rx="2" stroke="#00B4FF" strokeWidth="0.5" strokeOpacity="0.14"/>
      <line x1="100" y1="15"  x2="100" y2="185" stroke="#00B4FF" strokeWidth="0.3" strokeOpacity="0.09" strokeDasharray="3 5"/>
      <line x1="15"  y1="100" x2="185" y2="100" stroke="#00B4FF" strokeWidth="0.3" strokeOpacity="0.09" strokeDasharray="3 5"/>
      <line x1="65"  y1="138" x2="80"  y2="66"  stroke="#00B4FF" strokeWidth="0.5" strokeOpacity="0.18" strokeDasharray="2 4"/>
      <line x1="122" y1="152" x2="144" y2="70"  stroke="#00B4FF" strokeWidth="0.5" strokeOpacity="0.14" strokeDasharray="2 4"/>
      <circle cx="80"  cy="66"  r="5.5" fill="#00B4FF" fillOpacity="0.65"/>
      <circle cx="80"  cy="66"  r="13"  stroke="#00B4FF" strokeWidth="0.5" strokeOpacity="0.16"/>
      <circle cx="144" cy="70"  r="4.5" fill="#00B4FF" fillOpacity="0.52"/>
      <circle cx="144" cy="70"  r="11"  stroke="#00B4FF" strokeWidth="0.5" strokeOpacity="0.13"/>
      <circle cx="38"  cy="52"  r="3"   fill="#00B4FF" fillOpacity="0.32"/>
      <circle cx="160" cy="132" r="3.5" fill="#00B4FF" fillOpacity="0.28"/>
      <circle cx="65"  cy="138" r="3"   stroke="#00B4FF" strokeWidth="0.5" strokeOpacity="0.22" fill="none"/>
      <circle cx="122" cy="152" r="2.5" stroke="#00B4FF" strokeWidth="0.5" strokeOpacity="0.18" fill="none"/>
      <path d="M80 66 Q112 58 144 70" stroke="#00B4FF" strokeWidth="0.5" strokeOpacity="0.14" fill="none" strokeDasharray="2 4"/>
    </svg>
  );
}

const GRAPHICS = { Analyst: <RadarGraphic />, Pro: <MapGraphic /> } as const;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#000002] text-white">
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
            All the intelligence.<br className="hidden md:block" /> None of the enterprise price.
          </h1>
          <p className="mt-4 text-[15px] text-slate-500">
            3-day free trial. No credit card required. Cancel anytime.
          </p>
        </div>

        <div className="mx-auto grid max-w-2xl gap-4 md:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-[16px] border p-7 ${
                plan.highlight
                  ? "border-[#00B4FF]/40 bg-[#03030c]"
                  : "border-[#0d1020] bg-[#020208]"
              }`}
              style={
                plan.highlight
                  ? { boxShadow: "0 0 48px rgba(0,180,255,0.07), 0 0 0 0 transparent" }
                  : undefined
              }
            >
              {plan.highlight && (
                <div
                  className="absolute -top-px inset-x-0 h-[1px] rounded-t-[16px]"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(0,180,255,0.65), transparent)" }}
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
                      <span
                        className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
                        style={{
                          background: "rgba(0,180,255,0.15)",
                          color:      "#00B4FF",
                          border:     "1px solid rgba(0,180,255,0.25)",
                        }}
                      >
                        Most popular
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

                {GRAPHICS[plan.name as keyof typeof GRAPHICS]}
              </div>

              <ul className="mb-8 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <span
                      className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: "#00B4FF", opacity: plan.highlight ? 0.85 : 0.65 }}
                    />
                    <span className="text-[13px] text-slate-400">{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`block rounded-full py-2.5 text-center text-[13px] font-semibold transition-opacity hover:opacity-90 ${
                  plan.highlight
                    ? "bg-[#00B4FF] text-black"
                    : "border border-[#1a3a20] text-slate-300 hover:border-[#00B4FF]/30 hover:text-white"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Price anchor */}
        <div className="mt-10 flex items-center justify-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-[#0d1e0d] bg-[#020208] px-4 py-2">
            <span className="text-[11px] text-slate-600">Typical intelligence platforms</span>
            <span className="text-[13px] font-semibold text-slate-600 line-through decoration-slate-700/60">$200–$1,000/mo</span>
          </div>
          <span className="text-[11px] text-slate-700">vs</span>
          <div
            className="flex items-center gap-2 rounded-full border border-[#00B4FF]/20 px-4 py-2"
            style={{ background: "rgba(0,180,255,0.04)" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#00B4FF]" />
            <span className="text-[13px] font-semibold text-[#00B4FF]">Metrivant from $9/mo</span>
          </div>
        </div>

        {/* Trust line */}
        <p className="mt-6 text-center text-[11px] text-slate-700">
          No contracts · No setup fees · Cancel anytime · First signals within hours of setup
        </p>
      </section>
    </div>
  );
}
