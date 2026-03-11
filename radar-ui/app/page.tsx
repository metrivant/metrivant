import Link from "next/link";
import PublicNav from "../components/PublicNav";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#000200] text-white">
      <PublicNav />

      {/* ── Atmospheric depth ─────────────────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.85) 0.5px, transparent 0.5px)",
          backgroundSize: "6px 6px",
          opacity: 0.018,
        }}
      />
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(46,230,166,0.07) 0%, transparent 70%)",
        }}
      />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center px-6 pb-24 pt-40 text-center">

        {/* Eyebrow */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#2EE6A6]/20 bg-[#2EE6A6]/6 px-4 py-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full bg-[#2EE6A6]"
            style={{ boxShadow: "0 0 6px rgba(46,230,166,0.8)" }}
          />
          <span className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#2EE6A6]">
            Competitive Intelligence Radar
          </span>
        </div>

        {/* Headline */}
        <h1 className="mx-auto max-w-3xl text-5xl font-bold leading-[1.08] tracking-tight text-white md:text-6xl lg:text-7xl">
          Know when rivals
          <br />
          <span style={{ color: "#2EE6A6" }}>move before</span> you do.
        </h1>

        {/* Subline */}
        <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-slate-400">
          Metrivant automatically monitors your competitors&apos; websites and
          surfaces meaningful changes as structured intelligence — so you can
          act, not just react.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex items-center gap-4">
          <Link
            href="/signup"
            className="rounded-full bg-[#2EE6A6] px-7 py-3 text-[15px] font-semibold text-black transition-opacity hover:opacity-90"
          >
            Start monitoring free
          </Link>
          <Link
            href="/pricing"
            className="rounded-full border border-[#1a3a20] px-7 py-3 text-[15px] font-medium text-slate-300 transition-colors hover:border-[#2EE6A6]/30 hover:text-white"
          >
            See pricing
          </Link>
        </div>

        {/* Trust line */}
        <p className="mt-6 text-[12px] text-slate-600">
          No credit card required · Setup in 2 minutes
        </p>
      </section>

      {/* ── Features ──────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-5xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Precision detection",
              body: "Monitors DOM-level changes across pricing, features, messaging, and positioning pages — not just new blog posts.",
            },
            {
              title: "Structured intelligence",
              body: "Every change is classified, scored, and surfaced with strategic implication and a recommended action.",
            },
            {
              title: "Radar interface",
              body: "A calm command-center view showing competitor momentum at a glance — so you can see who's moving and who's quiet.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-[14px] border border-[#0d2010] bg-[#030c03] p-6"
            >
              <div
                className="mb-1 h-1 w-6 rounded-full"
                style={{ background: "#2EE6A6", opacity: 0.7 }}
              />
              <h3 className="mt-4 text-[15px] font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#0e2210] px-6 py-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="text-[12px] text-slate-700">
            © {new Date().getFullYear()} Metrivant
          </span>
          <div className="flex gap-6">
            <Link href="/pricing" className="text-[12px] text-slate-700 hover:text-slate-500 transition-colors">
              Pricing
            </Link>
            <Link href="/login" className="text-[12px] text-slate-700 hover:text-slate-500 transition-colors">
              Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
