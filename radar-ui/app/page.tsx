import Link from "next/link";
import PublicNav from "../components/PublicNav";
import LandingHero from "../components/LandingHero";
import FlowSection from "../components/FlowSection";
import CoreConceptSection from "../components/CoreConceptSection";
import EquationPanel from "../components/EquationPanel";


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
      "Monitors competitors across market sectors, detecting high-confidence signals of strategic change to inform critical business decisions.",
    offers: { "@type": "Offer", price: "9", priceCurrency: "USD" },
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Metrivant",
    url: "https://www.metrivant.com",
    logo: "https://www.metrivant.com/icon-512.png",
    description: "Detects high-confidence signals of competitor change across B2B SaaS, Defense, Energy, and other market sectors.",
    contactPoint: { "@type": "ContactPoint", email: "hello@metrivant.com", contactType: "customer support" },
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Metrivant",
    url: "https://www.metrivant.com",
    description: "Monitor competitors across markets. Detect high-confidence signals of change. Inform strategic decisions with evidence-grounded intelligence.",
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
      <LandingHero />

      {/* ── Flow Section — user journey visualization ──────────────── */}
      {/* <FlowSection /> */}

      {/* ── Core Concept ─────────────────────────────────────────────── */}
      <CoreConceptSection />

      {/* ── Equation Panel ───────────────────────────────────────────── */}
      <EquationPanel />

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
                  "ORBIT mode",
                  "Gravity field",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "#00B4FF", opacity: 0.85 }} />
                    <span className="text-[11px] text-slate-400">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup?plan=pro"
                className="group relative mt-4 block overflow-hidden rounded-full py-2 text-center text-[12px] font-semibold"
              >
                {/* Animated background with breathing effect */}
                <div
                  className="absolute inset-0 bg-[#00B4FF]"
                  style={{
                    animation: "pricing-breathe 3s ease-in-out infinite",
                  }}
                />

                {/* Sheen overlay that sweeps across */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
                    backgroundSize: "200% 100%",
                    animation: "pricing-sheen 3s linear infinite",
                  }}
                />

                {/* Pulse ring on hover */}
                <div
                  className="absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    boxShadow: "0 0 25px rgba(0,180,255,0.8), inset 0 0 20px rgba(255,255,255,0.15)",
                    animation: "pricing-pulse 2s ease-in-out infinite",
                  }}
                />

                {/* Text */}
                <span className="relative z-10 text-black transition-all duration-300 group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]">
                  Start free trial
                </span>
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
