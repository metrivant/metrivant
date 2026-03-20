import Link from "next/link";
import PublicNav from "../components/PublicNav";
import LandingLogo from "../components/LandingLogo";
import LandingFeaturePrompt from "../components/LandingFeaturePrompt";
import LandingCTAButtons from "../components/LandingCTAButtons";
import PipelineSection from "../components/PipelineSection";
import IntelligencePulse from "../components/IntelligencePulse";
import ElectricityBackground from "../components/ElectricityBackground";

const LABEL_COLOR_STYLE = { color: "rgba(0,180,255,0.55)" } as const;

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
    <div className="flex min-h-screen w-full flex-col bg-[#000002] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicNav />
      <LandingFeaturePrompt />
      <IntelligencePulse />
      <ElectricityBackground />

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
          background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,180,255,0.09) 0%, transparent 70%)",
          animation: "glow-breathe 8s ease-in-out infinite",
        }}
      />

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative flex flex-1 flex-col items-center justify-center px-6 pb-16 pt-28 text-center">
        {/* Animated radar logo */}
        <div className="hero-fade-up" style={{ animationDelay: "0ms" }}>
          <LandingLogo />
        </div>

        <h1
          className="hero-fade-up mt-1 text-[34px] font-bold leading-none text-white"
          style={{ fontFamily: "var(--font-orbitron)", letterSpacing: "0.09em", animationDelay: "120ms" }}
        >
          METRIVANT
        </h1>
        <h2
          className="hero-fade-up mt-1 text-[11px] font-medium uppercase tracking-[0.34em] tagline-sheen"
          style={{ fontFamily: "var(--font-share-tech-mono)", ...LABEL_COLOR_STYLE, animationDelay: "220ms" }}
        >
          Competitive Intelligence
        </h2>

        <div
          className="hero-fade-up mt-5 flex flex-col items-center gap-1.5 text-[13px]"
          style={{ fontFamily: "var(--font-share-tech-mono)", animationDelay: "320ms" }}
        >
          <span className="hero-line hero-line-2">Changes become signals.</span>
          <span className="hero-line hero-line-3">Signals become movements.</span>
          <span className="hero-line hero-line-4">Movements become strategy.</span>
        </div>

        <div className="hero-fade-up" style={{ animationDelay: "440ms" }}>
          <LandingCTAButtons />
        </div>

        {/* Pricing teaser */}
        <div
          className="hero-fade-up mt-5 flex items-center gap-2 text-[11px]"
          style={{ animationDelay: "560ms" }}
        >
          <span className="text-slate-600">From $9/mo</span>
          <span className="h-0.5 w-0.5 rounded-full bg-slate-700" />
          <Link href="/pricing" className="text-slate-500 transition-colors hover:text-white">
            Plans →
          </Link>
        </div>
      </section>

      {/* ── Differentiation row ──────────────────────────────────────── */}
      <section className="relative border-t border-[#0d1020] px-6 py-10">
        <div className="mx-auto grid max-w-2xl gap-8 sm:grid-cols-3 text-center">
          {[
            {
              label: "Evidence-grounded",
              body:  "Every signal traces to a real change. No inference without observation.",
            },
            {
              label: "Confidence-gated",
              body:  "Four-factor scoring separates strategic moves from cosmetic noise.",
            },
            {
              label: "Early detection",
              body:  "Detects operational shifts before they reach press releases or filings.",
            },
          ].map(({ label, body }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <div className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ fontFamily: "var(--font-orbitron)", ...LABEL_COLOR_STYLE }}>
                {label}
              </div>
              <p className="text-[12px] leading-relaxed text-slate-500" style={{ fontFamily: "var(--font-share-tech-mono)" }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pipeline Experience — scroll-triggered SVG narrative ──── */}
      <section className="relative border-t border-[#0d1020]">
        <PipelineSection />
      </section>

      {/* ── Pricing snapshot ─────────────────────────────────────────── */}
      <section className="relative border-t border-[#0d1020] px-6 pb-16">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 pt-12 text-center">
            <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-600">
              Pricing
            </div>
            <h2 className="mt-1.5 text-[18px] font-semibold text-white" style={{ fontFamily: "var(--font-orbitron)" }}>
              Enterprise intelligence. Startup price.
            </h2>
          </div>

          <div className="mx-auto grid max-w-xl gap-3 sm:grid-cols-2">
            {/* Analyst */}
            <div className="rounded-[14px] border border-[#0d1020] bg-[#020208] px-5 py-5 transition-transform duration-300 hover:-translate-y-0.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Analyst</div>
              <div className="mt-2 text-[26px] font-bold text-white leading-none">
                $9<span className="text-[13px] font-normal text-slate-500">/mo</span>
              </div>
              <ul className="mt-3 space-y-1.5">
                {["10 competitors", "Weekly brief", "Live radar", "AI interpretation"].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "rgba(0,180,255,0.55)" }} />
                    <span className="text-[11px] text-slate-500">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup?plan=analyst"
                className="mt-4 block rounded-full border border-[#1a2030] py-2 text-center text-[12px] font-medium text-slate-400 transition-colors hover:border-[#00B4FF]/25 hover:text-white"
              >
                Start free trial
              </Link>
            </div>

            {/* Pro — highlighted */}
            <div
              className="relative rounded-[14px] border border-[#00B4FF]/22 bg-[#03030c] px-5 py-5 transition-all duration-300 hover:-translate-y-0.5"
              style={{ boxShadow: "0 0 30px rgba(0,180,255,0.04)" }}
            >
              <div
                className="absolute -top-px inset-x-0 h-[1px] rounded-t-[14px]"
                style={{ background: "linear-gradient(90deg, transparent, rgba(0,180,255,0.45), transparent)" }}
              />
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Pro</div>
                <span className="rounded-full bg-[#00B4FF]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#00B4FF]">
                  Popular
                </span>
              </div>
              <div className="mt-2 text-[26px] font-bold text-white leading-none">
                $19<span className="text-[13px] font-normal text-slate-500">/mo</span>
              </div>
              <ul className="mt-3 space-y-1.5">
                {[
                  "25 competitors",
                  "Real-time alerts",
                  "Movement synthesis",
                  "Cross-competitor patterns",
                  "ORBIT gravity field",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "#00B4FF", opacity: 0.85 }} />
                    <span className="text-[11px] text-slate-400">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup?plan=pro"
                className="mt-4 block rounded-full bg-[#00B4FF] py-2 text-center text-[12px] font-semibold text-black transition-opacity hover:opacity-90"
              >
                Start free trial
              </Link>
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] text-slate-700">
            Free trial on all plans ·{" "}
            <Link href="/pricing" className="text-slate-500 hover:text-white transition-colors">
              Compare →
            </Link>
          </p>
        </div>
      </section>

    </div>
  );
}
