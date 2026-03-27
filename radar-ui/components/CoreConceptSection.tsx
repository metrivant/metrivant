"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function CoreConceptSection() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    const section = document.getElementById("core-concept");
    if (section) observer.observe(section);

    return () => observer.disconnect();
  }, []);

  const concepts = [
    {
      statement: "Continuous monitoring across pricing, product, and market positioning.",
      emphasis: "Detection",
      detail: "Evidence-grounded signals. Real-time change classification.",
    },
    {
      statement: "Every signal validated against source evidence. Strategic analysis explains significance.",
      emphasis: "Analysis",
      detail: "What changed. Why it matters. How to respond.",
    },
    {
      statement: "Early detection creates decisive advantage.",
      emphasis: "Intelligence",
      detail: "Act before competitors announce publicly.",
    },
  ];

  return (
    <section
      id="core-concept"
      className="relative border-t border-[#0d1020] px-6 py-12"
    >
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col gap-8">
          {concepts.map((concept, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.6,
                delay: index * 0.2,
                ease: "easeOut",
              }}
              className="relative"
            >
              {/* Emphasis label — minimal */}
              <div
                className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.24em]"
                style={{
                  color: "rgba(0,180,255,0.45)",
                  fontFamily: "var(--font-orbitron)",
                }}
              >
                {concept.emphasis}
              </div>

              {/* Statement */}
              <p
                className="text-center text-[15px] font-light leading-relaxed text-white md:text-[16px]"
                style={{ letterSpacing: "0.01em" }}
              >
                {concept.statement}
              </p>

              {/* Detail text */}
              <motion.p
                className="mt-2.5 text-center text-[12px] font-light leading-relaxed md:text-[13px]"
                style={{
                  letterSpacing: "0.01em",
                  color: "rgba(148,163,184,0.65)"
                }}
                initial={{ opacity: 0 }}
                animate={isVisible ? { opacity: 1 } : {}}
                transition={{
                  duration: 0.6,
                  delay: index * 0.2 + 0.3,
                }}
              >
                {concept.detail}
              </motion.p>

              {/* Divider line (not on last item) */}
              {index < concepts.length - 1 && (
                <motion.div
                  className="mx-auto mt-8 h-px w-32"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent 0%, rgba(0,180,255,0.15) 50%, transparent 100%)",
                  }}
                  initial={{ scaleX: 0 }}
                  animate={isVisible ? { scaleX: 1 } : {}}
                  transition={{
                    duration: 0.8,
                    delay: index * 0.2 + 0.5,
                  }}
                />
              )}
            </motion.div>
          ))}
        </div>

        {/* Bottom accent — subtle shimmer line */}
        <motion.div
          className="relative mx-auto mt-10 h-px w-48 overflow-hidden"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(0,180,255,0.15) 50%, transparent 100%)",
          }}
          initial={{ opacity: 0 }}
          animate={isVisible ? { opacity: 1 } : {}}
          transition={{ duration: 1, delay: 0.8 }}
        >
          {/* Scanning shimmer effect */}
          <motion.div
            className="absolute inset-y-0 w-12"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(0,180,255,0.6) 50%, transparent 100%)",
              filter: "blur(4px)",
            }}
            animate={{
              x: ["-100%", "300%"],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear",
              repeatDelay: 2,
            }}
          />
        </motion.div>
      </div>
    </section>
  );
}
