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
      description: "Monitor any competitor in your market sector — SaaS, Fintech, Cybersecurity, Defense, or Energy.",
      example: "(company)",
      icon: (
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          {/* Card background */}
          <rect x="10" y="20" width="60" height="40" rx="4" fill="rgba(0,180,255,0.03)" stroke="#00B4FF" strokeWidth="0.8" opacity="0.35" />
          {/* Company icon placeholder */}
          <circle cx="25" cy="35" r="6" fill="rgba(0,180,255,0.15)" />
          {/* Text lines */}
          <line x1="35" y1="32" x2="60" y2="32" stroke="#00B4FF" strokeWidth="1" opacity="0.40" />
          <line x1="35" y1="38" x2="55" y2="38" stroke="#00B4FF" strokeWidth="0.8" opacity="0.25" />
          {/* Add button */}
          <motion.g
            animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <circle cx="60" cy="50" r="8" fill="#00B4FF" opacity="0.20" />
            <line x1="60" y1="46" x2="60" y2="54" stroke="#00B4FF" strokeWidth="1.5" />
            <line x1="56" y1="50" x2="64" y2="50" stroke="#00B4FF" strokeWidth="1.5" />
          </motion.g>
          {/* Sector tags floating */}
          <motion.text
            x="20" y="12"
            fontSize="5" fill="#00B4FF" opacity="0.50"
            animate={{ y: [12, 10, 12] }}
            transition={{ duration: 3, repeat: Infinity }}
          >SaaS</motion.text>
          <motion.text
            x="55" y="15"
            fontSize="5" fill="#00B4FF" opacity="0.40"
            animate={{ y: [15, 13, 15] }}
            transition={{ duration: 3.5, repeat: Infinity, delay: 0.5 }}
          >Fintech</motion.text>
        </svg>
      ),
    },
    {
      label: "Monitor",
      title: "Continuous Surveillance",
      description: "Automated tracking across pricing, product, and positioning.",
      example: "24/7 monitoring",
      icon: (
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          {/* Browser windows stack */}
          <rect x="12" y="18" width="50" height="35" rx="2" fill="rgba(0,180,255,0.04)" stroke="#00B4FF" strokeWidth="0.8" opacity="0.25" />
          <rect x="15" y="22" width="50" height="35" rx="2" fill="rgba(0,180,255,0.05)" stroke="#00B4FF" strokeWidth="0.8" opacity="0.35" />
          <rect x="18" y="26" width="50" height="35" rx="2" fill="rgba(0,180,255,0.06)" stroke="#00B4FF" strokeWidth="1" opacity="0.45" />
          {/* Content lines in front window */}
          <line x1="24" y1="35" x2="60" y2="35" stroke="#00B4FF" strokeWidth="0.8" opacity="0.30" />
          <line x1="24" y1="40" x2="55" y2="40" stroke="#00B4FF" strokeWidth="0.8" opacity="0.25" />
          <line x1="24" y1="45" x2="58" y2="45" stroke="#00B4FF" strokeWidth="0.8" opacity="0.25" />
          {/* Scanning beam */}
          <motion.line
            x1="18" y1="30" x2="68" y2="30"
            stroke="#00B4FF" strokeWidth="1.5"
            animate={{ y1: [30, 58, 30], y2: [30, 58, 30] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            opacity="0.60"
          />
          {/* Clock/24-7 indicator */}
          <circle cx="62" cy="50" r="6" stroke="#00B4FF" strokeWidth="0.8" opacity="0.40" />
          <motion.line
            x1="62" y1="50" x2="62" y2="46"
            stroke="#00B4FF" strokeWidth="1"
            style={{ transformOrigin: "62px 50px" }}
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
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
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          {/* Alert card */}
          <rect x="15" y="22" width="50" height="36" rx="3" fill="rgba(0,180,255,0.05)" stroke="#00B4FF" strokeWidth="1" opacity="0.40" />
          {/* Signal type badge */}
          <rect x="20" y="28" width="25" height="8" rx="2" fill="rgba(0,180,255,0.15)" />
          <text x="22" y="34" fontSize="5" fill="#00B4FF" opacity="0.80">PRICING</text>
          {/* Confidence meter */}
          <rect x="20" y="42" width="40" height="4" rx="2" fill="rgba(0,180,255,0.08)" />
          <motion.rect
            x="20" y="42" width="34" height="4" rx="2"
            fill="#00B4FF"
            animate={{ opacity: [0.5, 0.9, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <text x="22" y="52" fontSize="6" fill="#00B4FF" opacity="0.60">0.85 confidence</text>
          {/* Pulse rings */}
          <motion.circle
            cx="55" cy="33" r="8"
            stroke="#00B4FF" strokeWidth="1.5"
            fill="none"
            animate={{ r: [8, 14, 8], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          />
          <circle cx="55" cy="33" r="4" fill="#00B4FF" opacity="0.80" />
        </svg>
      ),
    },
    {
      label: "Respond",
      title: "Strategic Intelligence",
      description: "Analysis explains what changed, why it matters, how to act.",
      example: "Enterprise repositioning → Recommended response",
      icon: (
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          {/* Intelligence panel */}
          <rect x="15" y="18" width="50" height="44" rx="3" fill="rgba(0,180,255,0.04)" stroke="#00B4FF" strokeWidth="1" opacity="0.35" />
          {/* Movement label */}
          <text x="20" y="28" fontSize="5" fill="#00B4FF" opacity="0.70">MOVEMENT DETECTED</text>
          {/* Analysis sections */}
          <text x="20" y="36" fontSize="4" fill="#00B4FF" opacity="0.50">What changed:</text>
          <line x1="20" y1="38" x2="58" y2="38" stroke="#00B4FF" strokeWidth="0.6" opacity="0.30" />
          <text x="20" y="44" fontSize="4" fill="#00B4FF" opacity="0.50">Why it matters:</text>
          <line x1="20" y1="46" x2="55" y2="46" stroke="#00B4FF" strokeWidth="0.6" opacity="0.30" />
          <text x="20" y="52" fontSize="4" fill="#00B4FF" opacity="0.50">Recommended action:</text>
          <line x1="20" y1="54" x2="60" y2="54" stroke="#00B4FF" strokeWidth="0.6" opacity="0.30" />
          {/* Action indicator */}
          <motion.g
            animate={{ x: [0, 3, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <rect x="48" y="50" width="12" height="6" rx="1" fill="rgba(0,180,255,0.20)" stroke="#00B4FF" strokeWidth="0.8" />
            <path d="M56 53 L58 53" stroke="#00B4FF" strokeWidth="1" opacity="0.70" />
            <path d="M58 53 L57 52 M58 53 L57 54" stroke="#00B4FF" strokeWidth="0.8" opacity="0.70" />
          </motion.g>
        </svg>
      ),
    },
  ];

  return (
    <section ref={sectionRef} className="relative border-t border-[#0d1020] px-6 py-12 md:py-16">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-12 text-center md:mb-16">
          <div
            className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em]"
            style={{
              color: "rgba(0,180,255,0.50)",
              fontFamily: "var(--font-orbitron)",
            }}
          >
            How it works
          </div>
          <h2
            className="text-[18px] font-bold uppercase tracking-[0.12em] text-white md:text-[20px]"
            style={{ fontFamily: "var(--font-orbitron)" }}
          >
            From Tracking to Intelligence
          </h2>
        </div>

        {/* Steps */}
        <div className="space-y-16 md:space-y-20">
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
                  className="mx-auto mt-10 h-12 w-px md:mt-12"
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
