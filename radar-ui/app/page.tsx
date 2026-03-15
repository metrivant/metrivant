import Link from "next/link";
import PublicNav from "../components/PublicNav";
import LandingLogo from "../components/LandingLogo";
import LandingFeaturePrompt from "../components/LandingFeaturePrompt";

const LABEL_COLOR_STYLE = { color: "rgba(46,230,166,0.55)" } as const;

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Metrivant",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://www.metrivant.com",
    logo: "https://www.metrivant.com/icon-512.png",
    description:
      "Competitive intelligence radar detecting pricing, product, and strategy signals across competitors.",
    offers: { "@type": "Offer", price: "9", priceCurrency: "USD" },
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Metrivant",
    url: "https://www.metrivant.com",
    logo: "https://www.metrivant.com/icon-512.png",
    description: "Competitive intelligence radar for B2B SaaS, Defense, Energy, and other sectors.",
    contactPoint: { "@type": "ContactPoint", email: "hello@metrivant.com", contactType: "customer support" },
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Metrivant",
    url: "https://www.metrivant.com",
    description: "Detect competitor moves before they matter. Real-time radar intelligence for competitive strategy.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-[#000200] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicNav />
      <LandingFeaturePrompt />

      {/* Dot grid */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.85) 0.5px, transparent 0.5px)",
          backgroundSize: "6px 6px",
          opacity: 0.018,
        }}
      />
      {/* Green atmospheric glow — breathing */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(46,230,166,0.09) 0%, transparent 70%)",
          animation: "glow-breathe 8s ease-in-out infinite",
        }}
      />

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative flex flex-1 flex-col items-center justify-center px-6 pb-24 pt-32 text-center">
        {/* Animated radar logo */}
        <div className="hero-fade-up" style={{ animationDelay: "0ms" }}>
          <LandingLogo />
        </div>

        <h1
          className="hero-fade-up mt-1 text-[34px] font-bold leading-none text-white"
          style={{ letterSpacing: "0.09em", animationDelay: "120ms" }}
        >
          METRIVANT
        </h1>
        <h2
          className="hero-fade-up mt-1 text-[11px] font-medium uppercase tracking-[0.34em]"
          style={{ ...LABEL_COLOR_STYLE, animationDelay: "220ms" }}
        >
          Competitive Intelligence Radar
        </h2>

        <p
          className="hero-fade-up mt-4 max-w-sm text-[14px] leading-relaxed text-slate-400"
          style={{ animationDelay: "320ms" }}
        >
          Automated monitoring across every rival. Pricing shifts, product launches, and strategy pivots — surfaced as signals, not noise.
        </p>

        <div
          className="hero-fade-up mt-8 flex items-center gap-3"
          style={{ animationDelay: "440ms" }}
        >
          <Link
            href="/signup"
            className="cta-pulse rounded-full bg-[#2EE6A6] px-8 py-2.5 text-[14px] font-semibold text-black transition-opacity hover:opacity-90"
          >
            Start free trial
          </Link>
          <Link
            href="/login"
            className="px-4 py-2.5 text-[14px] font-medium text-slate-600 transition-colors hover:text-slate-300"
          >
            Sign in
          </Link>
        </div>

        {/* Pricing teaser */}
        <div
          className="hero-fade-up mt-6 flex items-center gap-2.5 text-[12px]"
          style={{ animationDelay: "560ms" }}
        >
          <Link href="/pricing" className="text-slate-600 transition-colors hover:text-slate-400">
            From $9/mo
          </Link>
          <span className="h-0.5 w-0.5 rounded-full bg-slate-700" />
          <span className="text-slate-700">Free trial included</span>
          <span className="h-0.5 w-0.5 rounded-full bg-slate-700" />
          <Link href="/pricing" className="text-slate-500 transition-colors hover:text-white">
            See all plans →
          </Link>
        </div>
      </section>

      {/* ── Differentiation row ──────────────────────────────────────── */}
      <section className="relative border-t border-[#0d2010] px-6 py-16">
        <div className="mx-auto grid max-w-2xl gap-10 sm:grid-cols-3">
          {[
            {
              label: "Evidence-backed",
              body:  "Every signal is grounded in real page changes — not AI guesswork.",
            },
            {
              label: "Zero noise",
              body:  "Confidence scoring filters cosmetic page changes from real strategic moves. Signals, not notifications.",
            },
            {
              label: "Early signal",
              body:  "Detects competitor intent before it surfaces in press or public filings.",
            },
          ].map(({ label, body }) => (
            <div key={label} className="flex flex-col gap-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em]" style={LABEL_COLOR_STYLE}>
                {label}
              </div>
              <p className="text-[13px] leading-relaxed text-slate-500">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing snapshot ─────────────────────────────────────────── */}
      <section className="relative border-t border-[#0d2010] px-6 pb-24">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 pt-16 text-center">
            <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-600">
              Pricing
            </div>
            <h2 className="mt-1.5 text-[20px] font-semibold text-white">
              Full intelligence stack. Start now.
            </h2>
          </div>

          <div className="mx-auto grid max-w-xl gap-3 sm:grid-cols-2">
            {/* Analyst */}
            <div className="rounded-[14px] border border-[#0d2010] bg-[#020802] px-5 py-5 transition-transform duration-300 hover:-translate-y-0.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Analyst</div>
              <div className="mt-2 text-[26px] font-bold text-white leading-none">
                $9<span className="text-[13px] font-normal text-slate-500">/mo</span>
              </div>
              <ul className="mt-3 space-y-1.5">
                {["10 competitors monitored", "Weekly intelligence digest", "Live radar dashboard"].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "rgba(46,230,166,0.55)" }} />
                    <span className="text-[11px] text-slate-500">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup?plan=analyst"
                className="mt-4 block rounded-full border border-[#1a3020] py-2 text-center text-[12px] font-medium text-slate-400 transition-colors hover:border-[#2EE6A6]/25 hover:text-white"
              >
                Start free trial
              </Link>
            </div>

            {/* Pro — highlighted */}
            <div
              className="relative rounded-[14px] border border-[#2EE6A6]/22 bg-[#030c03] px-5 py-5 transition-all duration-300 hover:-translate-y-0.5"
              style={{ boxShadow: "0 0 30px rgba(46,230,166,0.04)" }}
            >
              <div
                className="absolute -top-px inset-x-0 h-[1px] rounded-t-[14px]"
                style={{ background: "linear-gradient(90deg, transparent, rgba(46,230,166,0.45), transparent)" }}
              />
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Pro</div>
                <span className="rounded-full bg-[#2EE6A6]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#2EE6A6]">
                  Popular
                </span>
              </div>
              <div className="mt-2 text-[26px] font-bold text-white leading-none">
                $19<span className="text-[13px] font-normal text-slate-500">/mo</span>
              </div>
              <ul className="mt-3 space-y-1.5">
                {[
                  "Up to 25 rivals monitored",
                  "Instant alerts on critical moves",
                  "Deep-dive per-competitor profiles",
                  "90-day signal history",
                  "Cross-competitor pattern detection",
                  "Live market positioning map",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "#2EE6A6", opacity: 0.85 }} />
                    <span className="text-[11px] text-slate-400">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup?plan=pro"
                className="mt-4 block rounded-full bg-[#2EE6A6] py-2 text-center text-[12px] font-semibold text-black transition-opacity hover:opacity-90"
              >
                Start free trial
              </Link>
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] text-slate-700">
            All plans include a free trial ·{" "}
            <Link href="/pricing" className="text-slate-500 hover:text-white transition-colors">
              Full plan comparison →
            </Link>
          </p>
        </div>
      </section>

    </div>
  );
}
