"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function EquationPanel() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    const section = document.getElementById("equation-panel");
    if (section) observer.observe(section);

    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="equation-panel"
      className="relative border-t border-[#0d1020] px-6 py-16"
    >
      {/* Scanning line background effect */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute inset-x-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(0,180,255,0.4) 50%, transparent 100%)",
            filter: "blur(2px)",
          }}
          animate={{
            top: ["-2px", "100%"],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </div>

      <div className="relative mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-3 text-center md:gap-x-6">
        {/* Term 1: Detection */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={isVisible ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex flex-col items-center"
        >
          <div
            className="text-[13px] font-bold uppercase tracking-[0.20em] md:text-[15px]"
            style={{
              fontFamily: "var(--font-orbitron)",
              color: "rgba(255,255,255,0.90)",
            }}
          >
            Detection
          </div>
          <div
            className="mt-1 text-[9px] uppercase tracking-[0.16em]"
            style={{ color: "rgba(148,163,184,0.50)" }}
          >
            Real signals
          </div>
        </motion.div>

        {/* Operator: + */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={isVisible ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <motion.div
            className="text-[20px] font-light md:text-[24px]"
            style={{ color: "rgba(0,180,255,0.60)" }}
            animate={{
              textShadow: [
                "0 0 10px rgba(0,180,255,0.3)",
                "0 0 20px rgba(0,180,255,0.6)",
                "0 0 10px rgba(0,180,255,0.3)",
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            +
          </motion.div>
        </motion.div>

        {/* Term 2: Analysis */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={isVisible ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col items-center"
        >
          <div
            className="text-[13px] font-bold uppercase tracking-[0.20em] md:text-[15px]"
            style={{
              fontFamily: "var(--font-orbitron)",
              color: "rgba(255,255,255,0.90)",
            }}
          >
            Analysis
          </div>
          <div
            className="mt-1 text-[9px] uppercase tracking-[0.16em]"
            style={{ color: "rgba(148,163,184,0.50)" }}
          >
            Evidence-backed
          </div>
        </motion.div>

        {/* Operator: + */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={isVisible ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.4, delay: 0.6 }}
        >
          <motion.div
            className="text-[20px] font-light md:text-[24px]"
            style={{ color: "rgba(0,180,255,0.60)" }}
            animate={{
              textShadow: [
                "0 0 10px rgba(0,180,255,0.3)",
                "0 0 20px rgba(0,180,255,0.6)",
                "0 0 10px rgba(0,180,255,0.3)",
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.5,
            }}
          >
            +
          </motion.div>
        </motion.div>

        {/* Term 3: Intelligence */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={isVisible ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="flex flex-col items-center"
        >
          <div
            className="text-[13px] font-bold uppercase tracking-[0.20em] md:text-[15px]"
            style={{
              fontFamily: "var(--font-orbitron)",
              color: "rgba(255,255,255,0.90)",
            }}
          >
            Intelligence
          </div>
          <div
            className="mt-1 text-[9px] uppercase tracking-[0.16em]"
            style={{ color: "rgba(148,163,184,0.50)" }}
          >
            Strategic context
          </div>
        </motion.div>

        {/* Operator: = with energy flow */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={isVisible ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.4, delay: 0.9 }}
          className="relative"
        >
          <motion.div
            className="text-[20px] font-light md:text-[24px]"
            style={{ color: "rgba(0,180,255,0.80)" }}
            animate={{
              textShadow: [
                "0 0 15px rgba(0,180,255,0.4)",
                "0 0 30px rgba(0,180,255,0.8)",
                "0 0 15px rgba(0,180,255,0.4)",
              ],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
          >
            =
          </motion.div>

          {/* Energy particles flowing through = */}
          <motion.div
            className="absolute left-0 top-1/2 h-1 w-1 rounded-full bg-[#00B4FF]"
            animate={{
              x: [0, 30],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1.5,
            }}
          />
        </motion.div>

        {/* Result: Competitive Edge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 10 }}
          animate={isVisible ? { opacity: 1, scale: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 1.1 }}
          className="relative"
        >
          {/* Glow backdrop */}
          <div
            className="absolute inset-0 rounded-lg"
            style={{
              background:
                "radial-gradient(ellipse 140% 100% at 50% 50%, rgba(0,180,255,0.12) 0%, transparent 70%)",
              filter: "blur(20px)",
            }}
          />

          {/* Result box */}
          <div
            className="relative rounded-lg border px-6 py-3 md:px-8 md:py-4"
            style={{
              borderColor: "rgba(0,180,255,0.35)",
              background:
                "linear-gradient(135deg, rgba(0,180,255,0.10) 0%, rgba(0,180,255,0.05) 100%)",
              boxShadow:
                "0 0 25px rgba(0,180,255,0.12), inset 0 0 20px rgba(0,180,255,0.06)",
            }}
          >
            <motion.div
              className="text-[15px] font-bold uppercase tracking-[0.22em] md:text-[17px]"
              style={{
                fontFamily: "var(--font-orbitron)",
                color: "rgba(0,180,255,0.95)",
              }}
              animate={{
                textShadow: [
                  "0 0 20px rgba(0,180,255,0.5)",
                  "0 0 35px rgba(0,180,255,0.8)",
                  "0 0 20px rgba(0,180,255,0.5)",
                ],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              Competitive Edge
            </motion.div>
            <div
              className="mt-1 text-[9px] uppercase tracking-[0.16em]"
              style={{ color: "rgba(0,180,255,0.50)" }}
            >
              Strategic advantage
            </div>
          </div>

          {/* Pulse rings */}
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-lg border"
            style={{ borderColor: "rgba(0,180,255,0.40)" }}
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.6, 0, 0.6],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
        </motion.div>
      </div>

      {/* Bottom shimmer accent */}
      <motion.div
        className="relative mx-auto mt-12 h-px w-64 overflow-hidden"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(0,180,255,0.20) 50%, transparent 100%)",
        }}
        initial={{ opacity: 0 }}
        animate={isVisible ? { opacity: 1 } : {}}
        transition={{ duration: 1, delay: 1.3 }}
      >
        <motion.div
          className="absolute inset-y-0 w-16"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(0,180,255,0.8) 50%, transparent 100%)",
            filter: "blur(6px)",
          }}
          animate={{
            x: ["-100%", "400%"],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "linear",
            repeatDelay: 1,
          }}
        />
      </motion.div>
    </section>
  );
}
