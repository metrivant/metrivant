import Link from "next/link";
import PublicNav from "../components/PublicNav";

const BADGE_STYLE       = { background: "rgba(46,230,166,0.02)" } as const;
const LABEL_COLOR_STYLE = { color: "rgba(46,230,166,0.55)" } as const;

const jsonLd = {
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
};

export default function LandingPage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-[#000200] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicNav />

      {/* Dot grid */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.85) 0.5px, transparent 0.5px)",
          backgroundSize: "6px 6px",
          opacity: 0.018,
        }}
      />
      {/* Green atmospheric glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(46,230,166,0.07) 0%, transparent 70%)",
        }}
      />

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative flex flex-1 flex-col items-center justify-center px-6 pb-24 pt-32 text-center">
        {/* Logo */}
        <svg width="52" height="52" viewBox="0 0 46 46" fill="none" aria-hidden="true" className="mb-5">
          <circle cx="23" cy="23" r="21.5" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.50" />
          <circle cx="23" cy="23" r="13"   stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.28" />
          <circle cx="23" cy="23" r="5.5"  stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.42" />
          <path d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z" fill="#2EE6A6" fillOpacity="0.10" />
          <line x1="23" y1="23" x2="38.2" y2="9.8" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.80" />
          <circle cx="23" cy="23" r="2.5" fill="#2EE6A6" />
        </svg>

        <h1
          className="mt-1 text-[34px] font-bold leading-none text-white"
          style={{ letterSpacing: "0.09em" }}
        >
          METRIVANT
        </h1>
        <h2
          className="mt-1 text-[11px] font-medium uppercase tracking-[0.34em]"
          style={LABEL_COLOR_STYLE}
        >
          Competitive Intelligence Radar
        </h2>

        <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-slate-500">
          Know when competitors change pricing, launch features, or shift strategy — before the market does.
        </p>

        <div className="mt-8 flex items-center gap-3">
          <Link
            href="/signup"
            className="rounded-full bg-[#2EE6A6] px-8 py-2.5 text-[14px] font-semibold text-black transition-opacity hover:opacity-90"
          >
            Start free trial
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-[#1a3a20] px-8 py-2.5 text-[14px] font-medium text-slate-400 transition-colors hover:border-[#2EE6A6]/30 hover:text-white"
          >
            Sign in
          </Link>
        </div>

        {/* Signal type proof points */}
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {[
            "Pricing changes",
            "Feature launches",
            "Positioning shifts",
            "Enterprise moves",
            "Market expansion",
            "Product pivots",
          ].map((label) => (
            <span
              key={label}
              className="rounded-full border border-[#0d2010] px-3 py-1 text-[11px] text-slate-600"
              style={BADGE_STYLE}
            >
              {label}
            </span>
          ))}
        </div>

        {/* Pricing teaser */}
        <div className="mt-6 flex items-center gap-2.5 text-[12px]">
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
      <section className="relative border-t border-[#0d2010] px-6 py-12">
        <div className="mx-auto grid max-w-2xl gap-6 sm:grid-cols-3">
          {[
            {
              label: "Evidence-backed",
              body:  "Every signal is grounded in real page changes — not AI guesswork.",
            },
            {
              label: "Sector-aware",
              body:  "Terminology and pattern detection tuned to your market vertical.",
            },
            {
              label: "Early signal",
              body:  "Detects competitor intent before it surfaces in press or public filings.",
            },
          ].map(({ label, body }) => (
            <div key={label} className="flex flex-col gap-2">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={LABEL_COLOR_STYLE}>
                {label}
              </div>
              <p className="text-[12px] leading-relaxed text-slate-600">{body}</p>
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
              Simple, transparent plans
            </h2>
          </div>

          <div className="mx-auto grid max-w-xl gap-3 sm:grid-cols-2">
            {/* Analyst */}
            <div className="rounded-[14px] border border-[#0d2010] bg-[#020802] px-5 py-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Analyst</div>
              <div className="mt-2 text-[26px] font-bold text-white leading-none">
                $9<span className="text-[13px] font-normal text-slate-500">/mo</span>
              </div>
              <p className="mt-2 text-[12px] text-slate-600">5 competitors · weekly signals</p>
              <Link
                href="/signup?plan=analyst"
                className="mt-4 block rounded-full border border-[#1a3020] py-2 text-center text-[12px] font-medium text-slate-400 transition-colors hover:border-[#2EE6A6]/25 hover:text-white"
              >
                Start free trial
              </Link>
            </div>

            {/* Pro — highlighted */}
            <div
              className="relative rounded-[14px] border border-[#2EE6A6]/22 bg-[#030c03] px-5 py-5"
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
              <p className="mt-2 text-[12px] text-slate-600">25 competitors · real-time alerts</p>
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
