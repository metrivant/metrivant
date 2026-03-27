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
      statement: "Metrivant detects competitor changes across your market.",
      emphasis: "Real Signals",
      detail: "Every signal traces to real evidence. No speculation.",
    },
    {
      statement: "Evidence-grounded intelligence validated by AI analysis.",
      emphasis: "Strategic Context",
      detail: "Understand what changed, why it matters, what to do.",
    },
    {
      statement: "Anticipate moves. Act decisively. Maintain advantage.",
      emphasis: "Competitive Edge",
      detail: "Early detection enables strategic response.",
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
              {/* Statement */}
              <p
                className="text-center text-[15px] font-light leading-relaxed text-white md:text-[16px]"
                style={{ letterSpacing: "0.02em" }}
              >
                {concept.statement}
              </p>

              {/* Animated arrow + line */}
              <div className="relative my-4 flex flex-col items-center">
                {/* Vertical connection line with pulse */}
                <motion.div
                  className="h-6 w-px"
                  style={{
                    background:
                      "linear-gradient(180deg, transparent 0%, rgba(0,180,255,0.4) 50%, transparent 100%)",
                  }}
                  animate={{
                    opacity: [0.3, 0.8, 0.3],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: index * 0.3,
                  }}
                />

                {/* Arrow with bounce */}
                <motion.svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="-mt-1"
                  animate={{
                    y: [0, 3, 0],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: index * 0.3,
                  }}
                >
                  <path
                    d="M8 2L8 14M8 14L4 10M8 14L12 10"
                    stroke="rgba(0,180,255,0.60)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </motion.svg>
              </div>

              {/* Emphasis label with breathing glow */}
              <motion.div
                className="relative mx-auto w-fit"
                animate={{
                  scale: [1, 1.02, 1],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: index * 0.4,
                }}
              >
                {/* Glow effect background */}
                <div
                  className="absolute inset-0 rounded-lg"
                  style={{
                    background:
                      "radial-gradient(ellipse 120% 80% at 50% 50%, rgba(0,180,255,0.15) 0%, transparent 70%)",
                    filter: "blur(12px)",
                  }}
                />

                {/* Text */}
                <div
                  className="relative rounded-lg border px-6 py-3 text-center"
                  style={{
                    borderColor: "rgba(0,180,255,0.30)",
                    background:
                      "linear-gradient(135deg, rgba(0,180,255,0.08) 0%, rgba(0,180,255,0.04) 100%)",
                    boxShadow:
                      "0 0 20px rgba(0,180,255,0.10), inset 0 0 15px rgba(0,180,255,0.05)",
                  }}
                >
                  <motion.div
                    className="text-[13px] font-bold uppercase tracking-[0.18em] md:text-[14px]"
                    style={{
                      color: "rgba(0,180,255,0.95)",
                      fontFamily: "var(--font-orbitron)",
                      textShadow: "0 0 20px rgba(0,180,255,0.4)",
                    }}
                    animate={{
                      textShadow: [
                        "0 0 20px rgba(0,180,255,0.4)",
                        "0 0 30px rgba(0,180,255,0.6)",
                        "0 0 20px rgba(0,180,255,0.4)",
                      ],
                    }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: index * 0.4,
                    }}
                  >
                    {concept.emphasis}
                  </motion.div>
                </div>
              </motion.div>

              {/* Detail text */}
              <motion.p
                className="mt-3 text-center text-[13px] font-light leading-relaxed text-slate-400 md:text-[14px]"
                style={{ letterSpacing: "0.02em" }}
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
                  className="mx-auto mt-8 h-px w-24"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent 0%, rgba(0,180,255,0.20) 50%, transparent 100%)",
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
