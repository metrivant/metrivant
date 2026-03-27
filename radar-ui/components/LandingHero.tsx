"use client";

import { useRef } from "react";
import LandingLogo from "./LandingLogo";
import LandingCTAButtons from "./LandingCTAButtons";
import ElectricityBackground, { type ElectricityBackgroundRef } from "./ElectricityBackground";

const LABEL_COLOR_STYLE = { color: "rgba(0,180,255,0.55)" } as const;

export default function LandingHero() {
  const electricityRef = useRef<ElectricityBackgroundRef>(null);

  return (
    <>
      <ElectricityBackground ref={electricityRef} />

      <section className="relative flex flex-1 flex-col items-center justify-center px-6 pb-16 pt-28 text-center">
        {/* Animated radar logo */}
        <div className="hero-fade-up" style={{ animationDelay: "0ms" }}>
          <LandingLogo onLogoClick={() => electricityRef.current?.triggerFlash()} />
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
          style={{ animationDelay: "320ms" }}
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
          <a href="/pricing" className="text-slate-500 transition-colors hover:text-white">
            Plans →
          </a>
        </div>
      </section>
    </>
  );
}
