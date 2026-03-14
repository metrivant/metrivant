import Link from "next/link";
import PublicNav from "../../components/PublicNav";

export const metadata = {
  title: "About — Metrivant",
  description:
    "Metrivant is a competitive intelligence radar. Strategic movement, made visible.",
};

// ── Plan data ─────────────────────────────────────────────────────────────────

const PLANS = [
  {
    name: "Analyst",
    price: "$9",
    period: "/mo",
    description: "Monitor your competitive landscape with weekly intelligence.",
    features: [
      "10 competitors monitored",
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#000200] text-white">
      <PublicNav />

      {/* Fixed atmosphere */}
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
            "radial-gradient(ellipse 80% 55% at 50% -5%, rgba(46,230,166,0.07) 0%, transparent 70%)",
        }}
      />

      {/* ── 1. HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pb-20 pt-24 text-center">

        {/* Atmospheric radar — decorative, aria-hidden */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <svg
            width="820"
            height="820"
            viewBox="0 0 820 820"
            fill="none"
            aria-hidden="true"
            className="max-w-full"
          >
            {/* Rings */}
            <circle cx="410" cy="410" r="390" stroke="#2EE6A6" strokeWidth="0.5" strokeOpacity="0.08" />
            <circle cx="410" cy="410" r="285" stroke="#2EE6A6" strokeWidth="0.5" strokeOpacity="0.07" />
            <circle cx="410" cy="410" r="185" stroke="#2EE6A6" strokeWidth="0.5" strokeOpacity="0.10" />
            <circle cx="410" cy="410" r="95"  stroke="#2EE6A6" strokeWidth="0.5" strokeOpacity="0.14" />
            {/* Crosshairs */}
            <line x1="410" y1="15"  x2="410" y2="805" stroke="#2EE6A6" strokeWidth="0.4" strokeOpacity="0.06" strokeDasharray="3 6" />
            <line x1="15"  y1="410" x2="805" y2="410" stroke="#2EE6A6" strokeWidth="0.4" strokeOpacity="0.06" strokeDasharray="3 6" />
            {/* Sweep */}
            <line x1="410" y1="410" x2="760" y2="95" stroke="#2EE6A6" strokeWidth="1" strokeOpacity="0.14" />
            {/* Sector arc gradient suggestion */}
            <path d="M410 410 L760 95 A390 390 0 0 1 790 410 Z" fill="#2EE6A6" fillOpacity="0.012" />
            {/* Nodes */}
            <circle cx="650" cy="200" r="5"   fill="#2EE6A6" fillOpacity="0.40" />
            <circle cx="650" cy="200" r="12"  stroke="#2EE6A6" strokeWidth="0.6" strokeOpacity="0.14" />
            <circle cx="650" cy="200" r="22"  stroke="#2EE6A6" strokeWidth="0.4" strokeOpacity="0.07" />
            <circle cx="265" cy="300" r="3.5" fill="#2EE6A6" fillOpacity="0.28" />
            <circle cx="570" cy="510" r="4"   fill="#2EE6A6" fillOpacity="0.35" />
            <circle cx="570" cy="510" r="10"  stroke="#2EE6A6" strokeWidth="0.5" strokeOpacity="0.11" />
            <circle cx="315" cy="530" r="3"   fill="#2EE6A6" fillOpacity="0.22" />
            <circle cx="470" cy="165" r="2.5" fill="#2EE6A6" fillOpacity="0.18" />
            <circle cx="175" cy="445" r="3"   fill="#2EE6A6" fillOpacity="0.20" />
            <circle cx="590" cy="360" r="2"   fill="#2EE6A6" fillOpacity="0.15" />
            {/* Signal arcs */}
            <path d="M265 300 Q350 280 410 410" stroke="#2EE6A6" strokeWidth="0.5" strokeOpacity="0.09" fill="none" strokeDasharray="4 6" />
            <path d="M570 510 Q500 470 410 410" stroke="#2EE6A6" strokeWidth="0.5" strokeOpacity="0.09" fill="none" strokeDasharray="4 6" />
          </svg>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-2xl">
          {/* Logo */}
          <svg
            width="52"
            height="52"
            viewBox="0 0 46 46"
            fill="none"
            aria-hidden="true"
            className="mx-auto mb-8"
          >
            <circle cx="23" cy="23" r="21.5" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.50" />
            <circle cx="23" cy="23" r="13"   stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.28" />
            <circle cx="23" cy="23" r="5.5"  stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.42" />
            <path d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z" fill="#2EE6A6" fillOpacity="0.10" />
            <line x1="23" y1="23" x2="38.2" y2="9.8" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.80" />
            <circle cx="23" cy="23" r="2.5" fill="#2EE6A6" />
          </svg>

          <div
            className="mb-3 text-[11px] font-medium uppercase tracking-[0.34em]"
            style={{ color: "rgba(46,230,166,0.55)" }}
          >
            Competitive Intelligence Radar
          </div>

          <h1 className="text-[44px] font-bold leading-[1.08] tracking-tight text-white md:text-[58px]">
            Strategic movement,<br />made visible.
          </h1>

          <p className="mx-auto mt-6 max-w-sm text-[15px] leading-relaxed text-slate-500">
            Metrivant is a competitive intelligence radar. It continuously watches competitor movement and surfaces signals that matter.
          </p>
          <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-slate-500">
            See strategic shifts before they happen.
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className="rounded-full bg-[#2EE6A6] px-9 py-3 text-[14px] font-semibold text-black transition-opacity hover:opacity-90"
            >
              Start tracking
            </Link>
            <Link
              href="#pricing"
              className="rounded-full border border-[#1a3a20] px-9 py-3 text-[14px] font-medium text-slate-400 transition-colors hover:border-[#2EE6A6]/30 hover:text-white"
            >
              View pricing
            </Link>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
          <div
            className="h-9 w-px"
            style={{ background: "linear-gradient(to bottom, transparent, rgba(46,230,166,0.22))" }}
          />
          <div className="h-1.5 w-1.5 rounded-full bg-[#2EE6A6]" style={{ opacity: 0.35 }} />
        </div>
      </section>

      {/* ── 2. WHAT IT DOES ─────────────────────────────────────────────────── */}
      <section className="border-t border-[#0e2210] px-6 py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-600">
              Capabilities
            </div>
            <h2 className="text-[26px] font-bold tracking-tight text-white md:text-[34px]">
              Four intelligence surfaces.
            </h2>
            <p className="mt-3 text-[14px] text-slate-500">
              Every type of competitor movement — monitored and surfaced.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

            {/* Pricing Intelligence */}
            <div className="rounded-[14px] border border-[#0d2010] bg-[#020802] p-6">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#0e2210] bg-[#030c03]">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-[#2EE6A6]">
                  <rect x="1.5" y="9"   width="3" height="5.5" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
                  <rect x="6.5" y="5.5" width="3" height="9"   rx="0.5" stroke="currentColor" strokeWidth="1.1" />
                  <rect x="11.5" y="2"  width="3" height="12.5" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
                </svg>
              </div>
              <div className="mb-2 text-[13px] font-semibold text-white">Pricing Intelligence</div>
              <p className="text-[12px] leading-relaxed text-slate-500">
                Detect strategy shifts before they impact your pipeline.
              </p>
            </div>

            {/* Product Expansion */}
            <div className="rounded-[14px] border border-[#0d2010] bg-[#020802] p-6">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#0e2210] bg-[#030c03]">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-[#2EE6A6]">
                  <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.1" />
                  <circle cx="2"  cy="8" r="1.5" stroke="currentColor" strokeWidth="1" />
                  <circle cx="14" cy="8" r="1.5" stroke="currentColor" strokeWidth="1" />
                  <circle cx="8"  cy="2" r="1.5" stroke="currentColor" strokeWidth="1" />
                  <circle cx="8" cy="14" r="1.5" stroke="currentColor" strokeWidth="1" />
                  <line x1="4.2" y1="8" x2="5.4" y2="8" stroke="currentColor" strokeWidth="1" />
                  <line x1="10.6" y1="8" x2="11.8" y2="8" stroke="currentColor" strokeWidth="1" />
                  <line x1="8" y1="4.2" x2="8" y2="5.4" stroke="currentColor" strokeWidth="1" />
                  <line x1="8" y1="10.6" x2="8" y2="11.8" stroke="currentColor" strokeWidth="1" />
                </svg>
              </div>
              <div className="mb-2 text-[13px] font-semibold text-white">Product Expansion</div>
              <p className="text-[12px] leading-relaxed text-slate-500">
                See new features as rivals build them — not when they announce them.
              </p>
            </div>

            {/* Market Repositioning */}
            <div className="rounded-[14px] border border-[#0d2010] bg-[#020802] p-6">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#0e2210] bg-[#030c03]">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-[#2EE6A6]">
                  <rect x="1" y="1" width="14" height="14" rx="1" stroke="currentColor" strokeWidth="1.1" />
                  <line x1="8" y1="1"  x2="8" y2="15" stroke="currentColor" strokeWidth="0.7" strokeDasharray="1.5 1.5" />
                  <line x1="1" y1="8" x2="15" y2="8"  stroke="currentColor" strokeWidth="0.7" strokeDasharray="1.5 1.5" />
                  <circle cx="11.5" cy="4.5" r="1.5" fill="currentColor" fillOpacity="0.75" />
                  <circle cx="4.5" cy="11.5" r="1"   fill="currentColor" fillOpacity="0.40" />
                </svg>
              </div>
              <div className="mb-2 text-[13px] font-semibold text-white">Market Repositioning</div>
              <p className="text-[12px] leading-relaxed text-slate-500">
                Track positioning shifts, messaging pivots, and audience targeting as they happen.
              </p>
            </div>

            {/* Momentum */}
            <div className="rounded-[14px] border border-[#0d2010] bg-[#020802] p-6">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#0e2210] bg-[#030c03]">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-[#2EE6A6]">
                  <path d="M2 13.5 Q8 3 14 13.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                  <circle cx="14" cy="13.5" r="1.8" fill="currentColor" fillOpacity="0.75" />
                  <circle cx="8"  cy="7"    r="1"   fill="currentColor" fillOpacity="0.35" />
                </svg>
              </div>
              <div className="mb-2 text-[13px] font-semibold text-white">Momentum Tracking</div>
              <p className="text-[12px] leading-relaxed text-slate-500">
                Know which rivals are accelerating — and measure exactly how fast.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── 3. HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="border-t border-[#0e2210] px-6 py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-600">
              Pipeline
            </div>
            <h2 className="text-[26px] font-bold tracking-tight text-white md:text-[34px]">
              From page change to strategic insight.
            </h2>
          </div>

          <div className="relative grid gap-10 lg:grid-cols-4 lg:gap-0">
            {/* Connector (desktop only) */}
            <div
              className="pointer-events-none absolute inset-x-0 top-[27px] hidden h-px lg:block"
              style={{
                background:
                  "linear-gradient(90deg, transparent 4%, rgba(46,230,166,0.18) 12%, rgba(46,230,166,0.18) 88%, transparent 96%)",
              }}
            />

            {(
              [
                {
                  num: "01",
                  label: "Observe",
                  desc: "Competitor pages crawled continuously — pricing, features, changelog, and positioning.",
                },
                {
                  num: "02",
                  label: "Detect",
                  desc: "Changes isolated section-by-section. Each diff scored for signal type, urgency, and confidence.",
                },
                {
                  num: "03",
                  label: "Classify",
                  desc: "Signal clusters interpreted into confirmed strategic movements with type and confidence scoring.",
                },
                {
                  num: "04",
                  label: "Respond",
                  desc: "Movements surface on the radar. Alerts fire. Strategy page identifies cross-competitor patterns.",
                },
              ] as { num: string; label: string; desc: string }[]
            ).map((step) => (
              <div key={step.num} className="relative flex flex-col lg:px-6">
                <div className="relative z-10 mb-5 flex h-[54px] w-[54px] items-center justify-center rounded-full border border-[#0e2210] bg-[#020802]">
                  <span className="font-mono text-[11px] font-bold tracking-[0.14em] text-[#2EE6A6]">
                    {step.num}
                  </span>
                </div>
                <div className="mb-2 text-[14px] font-bold text-white">{step.label}</div>
                <p className="text-[12px] leading-relaxed text-slate-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. WHY IT MATTERS ───────────────────────────────────────────────── */}
      <section className="border-t border-[#0e2210] px-6 py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-600">
              Strategic value
            </div>
            <h2 className="text-[26px] font-bold tracking-tight text-white md:text-[34px]">
              Three questions. Always answered.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {(
              [
                {
                  q: "What changed?",
                  a: "The exact page, section, signal, and timestamp. No ambiguity.",
                },
                {
                  q: "What does it mean?",
                  a: "Movement type, confidence score, and strategic context — grounded in observed evidence.",
                },
                {
                  q: "What should you do?",
                  a: "One concrete, evidence-based recommended action per signal. Not a list. A decision.",
                },
              ] as { q: string; a: string }[]
            ).map((item) => (
              <div
                key={item.q}
                className="rounded-[14px] border border-[#0d2010] bg-[#020802] p-7"
              >
                <div className="mb-3 text-[16px] font-bold text-white">{item.q}</div>
                <p className="text-[13px] leading-relaxed text-slate-500">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. INTELLIGENCE SURFACES ────────────────────────────────────────── */}
      <section className="border-t border-[#0e2210] px-6 py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-600">
              Intelligence lenses
            </div>
            <h2 className="text-[26px] font-bold tracking-tight text-white md:text-[34px]">
              Multiple ways to read the market.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">

            {/* Radar */}
            <div className="relative overflow-hidden rounded-[14px] border border-[#0e2210] bg-[#020802] p-7">
              <div className="pointer-events-none absolute -right-5 -top-5 opacity-[0.06]">
                <svg width="130" height="130" viewBox="0 0 130 130" fill="none" aria-hidden="true">
                  <circle cx="65" cy="65" r="60" stroke="#2EE6A6" strokeWidth="1" />
                  <circle cx="65" cy="65" r="42" stroke="#2EE6A6" strokeWidth="0.8" />
                  <circle cx="65" cy="65" r="24" stroke="#2EE6A6" strokeWidth="0.8" />
                  <line x1="65" y1="5"   x2="65" y2="125" stroke="#2EE6A6" strokeWidth="0.5" />
                  <line x1="5"  y1="65"  x2="125" y2="65" stroke="#2EE6A6" strokeWidth="0.5" />
                  <line x1="65" y1="65" x2="115" y2="20"  stroke="#2EE6A6" strokeWidth="0.8" />
                  <circle cx="105" cy="30" r="4" fill="#2EE6A6" />
                </svg>
              </div>
              <div className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2EE6A6]">
                Radar
              </div>
              <div className="mb-2 text-[14px] font-semibold text-white">The primary instrument.</div>
              <p className="text-[12px] leading-relaxed text-slate-500">
                Competitors plotted by momentum. See who is accelerating, who is quiet,
                and who is repositioning — at a glance.
              </p>
            </div>

            {/* Market Map */}
            <div className="relative overflow-hidden rounded-[14px] border border-[#0e2210] bg-[#020802] p-7">
              <div className="pointer-events-none absolute -right-4 -top-4 opacity-[0.06]">
                <svg width="110" height="110" viewBox="0 0 110 110" fill="none" aria-hidden="true">
                  <rect x="5" y="5" width="100" height="100" rx="2" stroke="#2EE6A6" strokeWidth="1" />
                  <line x1="55" y1="5"  x2="55" y2="105" stroke="#2EE6A6" strokeWidth="0.6" strokeDasharray="3 4" />
                  <line x1="5"  y1="55" x2="105" y2="55" stroke="#2EE6A6" strokeWidth="0.6" strokeDasharray="3 4" />
                  <circle cx="75" cy="28" r="5.5" fill="#2EE6A6" fillOpacity="0.7" />
                  <circle cx="30" cy="70" r="4"   fill="#2EE6A6" fillOpacity="0.4" />
                  <circle cx="78" cy="72" r="3.5" fill="#2EE6A6" fillOpacity="0.3" />
                </svg>
              </div>
              <div className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2EE6A6]">
                Market Map
              </div>
              <div className="mb-2 text-[14px] font-semibold text-white">Positioning in two dimensions.</div>
              <p className="text-[12px] leading-relaxed text-slate-500">
                Where rivals sit on the specialist-to-platform and SMB-to-enterprise axes —
                and how those positions are shifting.
              </p>
            </div>

            {/* Strategy */}
            <div className="relative overflow-hidden rounded-[14px] border border-[#0e2210] bg-[#020802] p-7">
              <div className="pointer-events-none absolute -right-4 -top-4 opacity-[0.06]">
                <svg width="110" height="110" viewBox="0 0 110 110" fill="none" aria-hidden="true">
                  <circle cx="55" cy="55" r="48" stroke="#2EE6A6" strokeWidth="1" />
                  <circle cx="55" cy="55" r="28" stroke="#2EE6A6" strokeWidth="0.8" />
                  <line x1="55" y1="7"   x2="55" y2="27"  stroke="#2EE6A6" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="55" y1="83"  x2="55" y2="103" stroke="#2EE6A6" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="7"  y1="55"  x2="27" y2="55"  stroke="#2EE6A6" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="83" y1="55"  x2="103" y2="55" stroke="#2EE6A6" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2EE6A6]">
                Strategy
              </div>
              <div className="mb-2 text-[14px] font-semibold text-white">Cross-competitor patterns.</div>
              <p className="text-[12px] leading-relaxed text-slate-500">
                When multiple rivals move in the same direction simultaneously,
                Metrivant names the pattern and recommends a response.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── 6. TRUST ────────────────────────────────────────────────────────── */}
      <section className="border-t border-[#0e2210] px-6 py-24 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-600">
            Infrastructure
          </div>
          <h2 className="mb-10 text-[22px] font-bold text-white md:text-[28px]">
            Always on. Evidence-based. No noise.
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                {
                  label: "24/7 monitoring",
                  desc: "Pages crawled continuously across pricing, features, positioning, and changelog.",
                },
                {
                  label: "Signal integrity",
                  desc: "Every alert is grounded in a real page change. No inferences without evidence.",
                },
                {
                  label: "Sector-aware",
                  desc: "Interpretation adapts to your market — SaaS, Defense, Energy, and more.",
                },
              ] as { label: string; desc: string }[]
            ).map((item) => (
              <div
                key={item.label}
                className="rounded-[12px] border border-[#0d2010] bg-[#020802] px-5 py-5"
              >
                <div className="mb-2 text-[12px] font-semibold text-slate-200">{item.label}</div>
                <p className="text-[11px] leading-relaxed text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing accent line */}
      <div
        className="h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(46,230,166,0.22) 35%, rgba(46,230,166,0.38) 50%, rgba(46,230,166,0.22) 65%, transparent 100%)",
        }}
      />

      {/* ── 7. PRICING ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="px-6 pb-28 pt-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-600">
              Pricing
            </div>
            <h2 className="text-[26px] font-bold tracking-tight text-white md:text-[34px]">
              Simple plans.
            </h2>
            <p className="mt-3 text-[14px] text-slate-500">
              All signals. One subscription. Every plan includes a free trial.
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
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, rgba(46,230,166,0.5), transparent)",
                    }}
                  />
                )}

                <div className="mb-6">
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
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-[38px] font-bold leading-none text-white">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-[13px] text-slate-500">{plan.period}</span>
                    )}
                  </div>
                  <p className="mt-2 text-[12px] text-slate-600">{plan.description}</p>
                </div>

                <ul className="mb-8 flex-1 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <span
                        className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: "#2EE6A6", opacity: 0.65 }}
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

          <p className="mt-8 text-center text-[11px] text-slate-700">
            All plans include a free trial ·{" "}
            <Link
              href="/pricing"
              className="text-slate-500 transition-colors hover:text-white"
            >
              Full plan comparison →
            </Link>
          </p>
        </div>
      </section>

      {/* Footer strip */}
      <div className="border-t border-[#0e2210] px-6 py-8 text-center">
        <p className="text-[11px] text-slate-700">
          Metrivant · Competitive Intelligence Radar ·{" "}
          <a
            href="mailto:hello@metrivant.com"
            className="text-slate-600 transition-colors hover:text-slate-400"
          >
            hello@metrivant.com
          </a>
        </p>
      </div>
    </div>
  );
}
