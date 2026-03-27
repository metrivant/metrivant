"use client";

import { motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";

export default function FlowSection() {
  const [activeStep, setActiveStep] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute("data-step") || "0");
            setActiveStep(index);
          }
        });
      },
      { threshold: 0.6, rootMargin: "-20% 0px -20% 0px" }
    );

    const steps = sectionRef.current?.querySelectorAll("[data-step]");
    steps?.forEach((step) => observer.observe(step));

    return () => observer.disconnect();
  }, []);

  const steps = [
    {
      label: "Track",
      title: "Add Competitor",
      description: "Monitor any competitor in your market sector.",
      example: "Acme Corp",
      icon: (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="18" stroke="#00B4FF" strokeWidth="1.2" strokeOpacity="0.30" />
          <circle cx="24" cy="24" r="12" stroke="#00B4FF" strokeWidth="1" strokeOpacity="0.45" />
          <circle cx="24" cy="24" r="6" fill="#00B4FF" fillOpacity="0.60" />
          <circle cx="24" cy="24" r="3" fill="#00B4FF" fillOpacity="0.90" />
        </svg>
      ),
    },
    {
      label: "Monitor",
      title: "Continuous Surveillance",
      description: "Automated tracking across pricing, product, and positioning.",
      example: "24/7 monitoring",
      icon: (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="18" stroke="#00B4FF" strokeWidth="1.2" strokeOpacity="0.25" />
          <path d="M24 24 L16 8 A18 18 0 0 1 36 12 Z" fill="#00B4FF" fillOpacity="0.15" />
          <line x1="24" y1="24" x2="36" y2="12" stroke="#00B4FF" strokeWidth="1.5" strokeOpacity="0.70" />
          <circle cx="24" cy="24" r="2.5" fill="#00B4FF" fillOpacity="0.90" />
          <motion.circle
            cx="32"
            cy="15"
            r="2"
            fill="#00B4FF"
            animate={{ fillOpacity: [0.3, 0.9, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </svg>
      ),
    },
    {
      label: "Detect",
      title: "Signal Detected",
      description: "Evidence-backed change classification with confidence scoring.",
      example: "Pricing change · 0.85 confidence",
      icon: (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="16" stroke="#00B4FF" strokeWidth="1" strokeOpacity="0.20" />
          <circle cx="24" cy="24" r="10" stroke="#00B4FF" strokeWidth="1.2" strokeOpacity="0.40" />
          <circle cx="24" cy="24" r="4" fill="#00B4FF" fillOpacity="0.70" />
          <motion.circle
            cx="24"
            cy="24"
            r="16"
            stroke="#00B4FF"
            strokeWidth="2"
            fill="none"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          />
        </svg>
      ),
    },
    {
      label: "Respond",
      title: "Strategic Intelligence",
      description: "Analysis explains what changed, why it matters, how to act.",
      example: "Enterprise repositioning → Recommended response",
      icon: (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="10" y="18" width="28" height="16" rx="3" stroke="#00B4FF" strokeWidth="1" strokeOpacity="0.35" />
          <line x1="16" y1="24" x2="32" y2="24" stroke="#00B4FF" strokeWidth="1.2" strokeOpacity="0.60" />
          <line x1="16" y1="28" x2="28" y2="28" stroke="#00B4FF" strokeWidth="1" strokeOpacity="0.40" />
          <circle cx="36" cy="14" r="6" fill="#00B4FF" fillOpacity="0.15" />
          <circle cx="36" cy="14" r="4" stroke="#00B4FF" strokeWidth="1.2" strokeOpacity="0.70" />
          <path d="M34.5 14l1.5 1.5 3-3" stroke="#00B4FF" strokeWidth="1.5" strokeOpacity="0.85" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  return (
    <section ref={sectionRef} className="relative border-t border-[#0d1020] px-6 py-20 md:py-28">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-16 text-center md:mb-20">
          <div
            className="mb-3 text-[10px] font-bold uppercase tracking-[0.24em]"
            style={{
              color: "rgba(0,180,255,0.50)",
              fontFamily: "var(--font-orbitron)",
            }}
          >
            How it works
          </div>
          <h2
            className="text-[20px] font-bold uppercase tracking-[0.12em] text-white md:text-[22px]"
            style={{ fontFamily: "var(--font-orbitron)" }}
          >
            From Tracking to Intelligence
          </h2>
        </div>

        {/* Steps */}
        <div className="space-y-32 md:space-y-40">
          {steps.map((step, index) => (
            <div
              key={index}
              data-step={index}
              className="relative"
            >
              <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
                {/* Icon side */}
                <motion.div
                  className="flex justify-center md:justify-end"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                >
                  <div className="relative">
                    {/* Glow backdrop */}
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "radial-gradient(circle, rgba(0,180,255,0.15) 0%, transparent 70%)",
                        filter: "blur(30px)",
                        transform: "scale(1.5)",
                      }}
                    />
                    {/* Icon */}
                    <div className="relative">{step.icon}</div>
                  </div>
                </motion.div>

                {/* Content side */}
                <motion.div
                  className="text-center md:text-left"
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  {/* Step label */}
                  <div
                    className="mb-2 text-[11px] font-bold uppercase tracking-[0.20em]"
                    style={{
                      color: activeStep === index ? "rgba(0,180,255,0.80)" : "rgba(148,163,184,0.50)",
                      fontFamily: "var(--font-orbitron)",
                      transition: "color 0.3s",
                    }}
                  >
                    {index + 1}. {step.label}
                  </div>

                  {/* Title */}
                  <h3
                    className="mb-3 text-[18px] font-bold text-white md:text-[20px]"
                    style={{ fontFamily: "var(--font-orbitron)", letterSpacing: "0.04em" }}
                  >
                    {step.title}
                  </h3>

                  {/* Description */}
                  <p
                    className="mb-3 text-[14px] font-light leading-relaxed md:text-[15px]"
                    style={{ color: "rgba(255,255,255,0.65)", letterSpacing: "0.01em" }}
                  >
                    {step.description}
                  </p>

                  {/* Example */}
                  <div
                    className="inline-block rounded-lg border px-4 py-2"
                    style={{
                      borderColor: "rgba(0,180,255,0.20)",
                      background: "rgba(0,180,255,0.04)",
                    }}
                  >
                    <div
                      className="text-[12px] font-medium"
                      style={{ color: "rgba(0,180,255,0.70)", fontFamily: "var(--font-geist-mono)" }}
                    >
                      {step.example}
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Connection line to next step */}
              {index < steps.length - 1 && (
                <motion.div
                  className="mx-auto mt-16 h-16 w-px md:mt-20"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(0,180,255,0.30) 0%, rgba(0,180,255,0.05) 100%)",
                  }}
                  initial={{ scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
