"use client";

import { motion } from "framer-motion";

export default function SocialProof() {
  return (
    <section className="relative border-t border-[#0d1020] px-6 py-8">
      <motion.div
        className="mx-auto max-w-3xl text-center"
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        {/* Main stat */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <div
            className="text-[11px] font-light tracking-[0.02em]"
            style={{ color: "rgba(148,163,184,0.55)" }}
          >
            Monitoring competitors across
          </div>
          <div className="flex items-center gap-3">
            {["SaaS", "Fintech", "Cybersecurity", "Defense", "Energy"].map((sector, i) => (
              <motion.div
                key={sector}
                className="text-[10px] font-medium uppercase tracking-[0.12em]"
                style={{ color: "rgba(0,180,255,0.50)" }}
                initial={{ opacity: 0, y: 5 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 + i * 0.05 }}
              >
                {sector}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Separator */}
        <motion.div
          className="mx-auto mt-6 h-px w-24"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(0,180,255,0.15) 50%, transparent 100%)",
          }}
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
        />
      </motion.div>
    </section>
  );
}
