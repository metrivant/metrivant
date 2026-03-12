import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-[#000000] text-white">

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

      {/* Logo */}
      <svg width="52" height="52" viewBox="0 0 46 46" fill="none" aria-hidden="true" className="mb-5">
        <circle cx="23" cy="23" r="21.5" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.50" />
        <circle cx="23" cy="23" r="13"   stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.28" />
        <circle cx="23" cy="23" r="5.5"  stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.42" />
        <path d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z" fill="#2EE6A6" fillOpacity="0.10" />
        <line x1="23" y1="23" x2="38.2" y2="9.8" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.80" />
        <circle cx="23" cy="23" r="2.5" fill="#2EE6A6" />
      </svg>

      <div
        className="text-[11px] font-medium uppercase tracking-[0.34em]"
        style={{ color: "rgba(46,230,166,0.55)" }}
      >
        Competitive Intelligence Radar
      </div>
      <div
        className="mt-1 text-[34px] font-bold leading-none text-white"
        style={{ letterSpacing: "0.09em" }}
      >
        METRIVANT
      </div>

      <div className="mt-10 flex items-center gap-3">
        <Link
          href="/signup"
          className="rounded-full bg-[#2EE6A6] px-8 py-2.5 text-[14px] font-semibold text-black transition-opacity hover:opacity-90"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-[#1a3a20] px-8 py-2.5 text-[14px] font-medium text-slate-400 transition-colors hover:border-[#2EE6A6]/30 hover:text-white"
        >
          Sign in
        </Link>
      </div>

    </div>
  );
}
