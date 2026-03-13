"use client";

import Link from "next/link";
import { motion } from "framer-motion";

// SVG graphic for Analyst plan card
function RadarGraphic() {
  return (
    <svg
      width="100"
      height="100"
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden="true"
      className="opacity-70"
    >
      <circle cx="100" cy="100" r="88"  stroke="#2EE6A6" strokeWidth="0.6" strokeOpacity="0.18"/>
      <circle cx="100" cy="100" r="64"  stroke="#2EE6A6" strokeWidth="0.5" strokeOpacity="0.14"/>
      <circle cx="100" cy="100" r="40"  stroke="#2EE6A6" strokeWidth="0.5" strokeOpacity="0.20"/>
      <circle cx="100" cy="100" r="18"  stroke="#2EE6A6" strokeWidth="0.5" strokeOpacity="0.25"/>
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

// SVG graphic for Pro plan card
function MapGraphic() {
  return (
    <svg
      width="100"
      height="100"
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden="true"
      className="opacity-70"
    >
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

const PLANS = [
  {
    name: "Analyst",
    price: "$9",
    period: "/mo",
    features: [
      "5 competitors monitored",
      "Weekly signal digest",
      "Radar dashboard",
      "30-day signal history",
    ],
    cta: "Start with Analyst",
    href: "/signup?plan=analyst",
    highlight: false,
    graphic: <RadarGraphic />,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/mo",
    features: [
      "25 competitors monitored",
      "Real-time signal alerts",
      "Full intelligence drawer",
      "90-day signal history",
      "Strategic movement analysis",
    ],
    cta: "Upgrade to Pro",
    href: "/signup?plan=pro",
    highlight: true,
    graphic: <MapGraphic />,
  },
];

export default function TrialLockScreen() {
  return (
    <motion.div
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center overflow-y-auto bg-[#000200] px-6 py-16"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Atmosphere */}
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
            "radial-gradient(ellipse 80% 50% at 50% -5%, rgba(46,230,166,0.07) 0%, transparent 70%)",
        }}
      />

      {/* Decorative radar background */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center" style={{ opacity: 0.035 }}>
        <svg width="700" height="700" viewBox="0 0 700 700" fill="none" aria-hidden="true">
          <circle cx="350" cy="350" r="330" stroke="#2EE6A6" strokeWidth="0.8"/>
          <circle cx="350" cy="350" r="240" stroke="#2EE6A6" strokeWidth="0.6"/>
          <circle cx="350" cy="350" r="155" stroke="#2EE6A6" strokeWidth="0.5"/>
          <circle cx="350" cy="350" r="78"  stroke="#2EE6A6" strokeWidth="0.5"/>
          <line x1="350" y1="20"  x2="350" y2="680" stroke="#2EE6A6" strokeWidth="0.4" strokeDasharray="4 8"/>
          <line x1="20"  y1="350" x2="680" y2="350" stroke="#2EE6A6" strokeWidth="0.4" strokeDasharray="4 8"/>
          <path d="M350 350 L668 108 A330 330 0 0 1 680 350 Z" fill="#2EE6A6" fillOpacity="0.08"/>
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-3xl">

        {/* Header */}
        <div className="mb-12 text-center">
          <svg
            width="36"
            height="36"
            viewBox="0 0 46 46"
            fill="none"
            aria-hidden="true"
            className="mx-auto mb-5"
          >
            <circle cx="23" cy="23" r="21.5" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.55"/>
            <circle cx="23" cy="23" r="13"   stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.30"/>
            <circle cx="23" cy="23" r="5.5"  stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.45"/>
            <path d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z" fill="#2EE6A6" fillOpacity="0.12"/>
            <line x1="23" y1="23" x2="38.2" y2="9.8" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.85"/>
            <circle cx="23" cy="23" r="2.5" fill="#2EE6A6"/>
          </svg>

          <div
            className="mb-3 text-[9px] font-bold uppercase tracking-[0.32em]"
            style={{ color: "rgba(46,230,166,0.50)" }}
          >
            Trial Period Ended
          </div>
          <h1 className="text-[36px] font-bold leading-[1.08] tracking-tight text-white md:text-[48px]">
            Unlock Competitive Intelligence
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-slate-500">
            Metrivant monitors markets so you don&apos;t have to.
          </p>
        </div>

        {/* Price comparison */}
        <div className="mb-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <div className="rounded-[14px] border border-[#151515] bg-[#020802] px-7 py-4 text-center">
            <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.24em] text-slate-600">
              Typical intelligence platforms
            </div>
            <div className="text-[24px] font-bold text-slate-500 line-through decoration-slate-700/60">
              $200–$1,000
              <span className="text-[13px] font-normal text-slate-700">/mo</span>
            </div>
          </div>

          <div className="text-[13px] font-light text-slate-700">vs</div>

          <div
            className="rounded-[14px] border border-[#2EE6A6]/20 px-7 py-4 text-center"
            style={{ background: "#030c03" }}
          >
            <div
              className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.24em]"
              style={{ color: "rgba(46,230,166,0.55)" }}
            >
              Metrivant
            </div>
            <div className="text-[24px] font-bold text-white">
              $19
              <span className="text-[13px] font-normal text-slate-500">/mo</span>
            </div>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid gap-4 md:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-[16px] border p-6 ${
                plan.highlight
                  ? "border-[#2EE6A6]/28 bg-[#030c03]"
                  : "border-[#0d2010] bg-[#020802]"
              }`}
              style={
                plan.highlight
                  ? { boxShadow: "0 0 40px rgba(46,230,166,0.05)" }
                  : undefined
              }
            >
              {plan.highlight && (
                <div
                  className="absolute -top-px inset-x-0 h-[1px] rounded-t-[16px]"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(46,230,166,0.50), transparent)",
                  }}
                />
              )}

              {/* Header row: text + graphic */}
              <div className="mb-5 flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      {plan.name}
                    </div>
                    {plan.highlight && (
                      <span className="rounded-full bg-[#2EE6A6]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#2EE6A6]">
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-[34px] font-bold leading-none text-white">
                      {plan.price}
                    </span>
                    <span className="text-[13px] text-slate-500">
                      {plan.period}
                    </span>
                  </div>
                </div>
                <div className="shrink-0">{plan.graphic}</div>
              </div>

              {/* Features */}
              <ul className="mb-5 flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span
                      className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: "#2EE6A6", opacity: 0.60 }}
                    />
                    <span className="text-[12px] text-slate-400">{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href={plan.href}
                className={`block rounded-full py-2.5 text-center text-[13px] font-bold transition-opacity hover:opacity-90 ${
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

        <p className="mt-6 text-center text-[11px] text-slate-700">
          Questions?{" "}
          <a
            href="mailto:billing@metrivant.com"
            className="text-slate-500 transition-colors hover:text-slate-300"
          >
            billing@metrivant.com
          </a>
        </p>
      </div>
    </motion.div>
  );
}
