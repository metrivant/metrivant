"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RadarCompetitor } from "../lib/api";

// ── Daily quote catalog ────────────────────────────────────────────────────────

const QUOTES: { text: string; author: string }[] = [
  { text: "Know your enemy and know yourself; in a hundred battles, you will never be defeated.", author: "Sun Tzu" },
  { text: "Speed is the essence of war. Take advantage of the enemy's unpreparedness.", author: "Sun Tzu" },
  { text: "Opportunities multiply as they are seized.", author: "Sun Tzu" },
  { text: "Let your plans be dark and impenetrable as night, and when you move, fall like a thunderbolt.", author: "Sun Tzu" },
  { text: "Victorious warriors win first and then go to war, while defeated warriors go to war first and then seek to win.", author: "Sun Tzu" },
  { text: "All men can see these tactics whereby I conquer, but what none can see is the strategy out of which victory is evolved.", author: "Sun Tzu" },
  { text: "Strategy without tactics is the slowest route to victory. Tactics without strategy is the noise before defeat.", author: "Sun Tzu" },
  { text: "In preparing for battle I have always found that plans are useless, but planning is indispensable.", author: "Dwight D. Eisenhower" },
  { text: "The most dangerous moment comes with victory.", author: "Napoleon Bonaparte" },
  { text: "In war, three-quarters turns on personal character and relations; the balance of manpower and materials counts only for the remaining quarter.", author: "Napoleon Bonaparte" },
  { text: "It is not the strongest of the species that survives, nor the most intelligent, but the one most responsive to change.", author: "Charles Darwin" },
  { text: "The greatest danger in times of turbulence is not the turbulence — it is to act with yesterday's logic.", author: "Peter Drucker" },
  { text: "I skate to where the puck is going to be, not where it has been.", author: "Wayne Gretzky" },
  { text: "Your most unhappy customers are your greatest source of learning.", author: "Bill Gates" },
  { text: "What is dangerous is not to evolve.", author: "Jeff Bezos" },
  { text: "The market is a voting machine in the short run, but a weighing machine in the long run.", author: "Benjamin Graham" },
  { text: "Risk comes from not knowing what you are doing.", author: "Warren Buffett" },
  { text: "It's far better to buy a wonderful company at a fair price than a fair company at a wonderful price.", author: "Warren Buffett" },
  { text: "The only way to win is to learn faster than anyone else.", author: "Eric Ries" },
  { text: "Without data you're just another person with an opinion.", author: "W. Edwards Deming" },
  { text: "The goal is to turn data into information, and information into insight.", author: "Carly Fiorina" },
  { text: "Information is the oil of the 21st century, and analytics is the combustion engine.", author: "Peter Sondergaard" },
  { text: "Not everything that can be counted counts, and not everything that counts can be counted.", author: "Albert Einstein" },
  { text: "In the middle of every difficulty lies opportunity.", author: "Albert Einstein" },
  { text: "It's not that I'm so smart, it's just that I stay with problems longer.", author: "Albert Einstein" },
  { text: "We cannot solve our problems with the same thinking we used when we created them.", author: "Albert Einstein" },
  { text: "Luck is what happens when preparation meets opportunity.", author: "Seneca" },
  { text: "Begin at once to live, and count each separate day as a separate life.", author: "Seneca" },
  { text: "You have power over your mind — not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius" },
  { text: "The impediment to action advances action. What stands in the way becomes the way.", author: "Marcus Aurelius" },
  { text: "Waste no more time arguing about what a good man should be. Be one.", author: "Marcus Aurelius" },
  { text: "Never let the future disturb you. You will meet it, if you have to, with the same weapons of reason which today arm you against the present.", author: "Marcus Aurelius" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "By failing to prepare, you are preparing to fail.", author: "Benjamin Franklin" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "To improve is to change; to be perfect is to have changed often.", author: "Winston Churchill" },
  { text: "Intelligence is the mother of good fortune.", author: "Miguel de Cervantes" },
  { text: "Forewarned, forearmed; to be prepared is half the victory.", author: "Miguel de Cervantes" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Twenty years from now you will be more disappointed by the things you didn't do than by the ones you did.", author: "Mark Twain" },
  { text: "Five percent of the people think; ten percent think they think; and the other eighty-five percent would rather die than think.", author: "Thomas Edison" },
  { text: "I have not failed. I've just found 10,000 ways that won't work.", author: "Thomas Edison" },
  { text: "The value of an idea lies in the using of it.", author: "Thomas Edison" },
  { text: "Nothing in life is to be feared, it is only to be understood.", author: "Marie Curie" },
  { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
  { text: "Your work is going to fill a large part of your life, and the only way to be truly satisfied is to do what you believe is great work.", author: "Steve Jobs" },
  { text: "It's not the consumers' job to know what they want.", author: "Steve Jobs" },
  { text: "A ship in harbour is safe, but that is not what ships are for.", author: "John A. Shedd" },
  { text: "Real knowledge is to know the extent of one's ignorance.", author: "Confucius" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "He who has a why to live for can bear almost any how.", author: "Friedrich Nietzsche" },
  { text: "Victorious in all his battles, his victories bring him no profit — for he fails to exploit them.", author: "Sun Tzu" },
  { text: "First, have a definite, clear practical ideal — a goal, an objective. Second, have the necessary means to achieve it.", author: "Aristotle" },
  { text: "Don't find customers for your products, find products for your customers.", author: "Seth Godin" },
  { text: "People don't want to buy a quarter-inch drill. They want a quarter-inch hole.", author: "Theodore Levitt" },
  { text: "Plans are worthless, but planning is everything.", author: "Dwight D. Eisenhower" },
  { text: "If you know the enemy and know yourself, you need not fear the result of a hundred battles.", author: "Sun Tzu" },
  { text: "Try not to become a man of success, but rather try to become a man of value.", author: "Albert Einstein" },
  { text: "The greatest victory is that which requires no battle.", author: "Sun Tzu" },
  { text: "If your enemy is secure at all points, be prepared for him. If he is in superior strength, evade him.", author: "Sun Tzu" },
  { text: "Move swift as the Wind and closely-formed as the Wood. Attack like the Fire and be still as the Mountain.", author: "Sun Tzu" },
  { text: "If you are far from the enemy, make him believe you are near.", author: "Sun Tzu" },
  { text: "We see our customers as invited guests to a party, and we are the hosts. It is our job every day to make every important aspect of the customer experience a little bit better.", author: "Jeff Bezos" },
  { text: "The big print giveth and the fine print taketh away.", author: "Tom Waits" },
  { text: "However beautiful the strategy, you should occasionally look at the results.", author: "Winston Churchill" },
];

function getDailyQuote(): { text: string; author: string } {
  const startOfYear = new Date(new Date().getFullYear(), 0, 0).getTime();
  const dayOfYear   = Math.floor((Date.now() - startOfYear) / 86_400_000);
  return QUOTES[dayOfYear % QUOTES.length];
}

// ── Momentum helpers ───────────────────────────────────────────────────────────

function momentumColor(score: number): string {
  if (score >= 5)   return "#ef4444";
  if (score >= 3)   return "#f59e0b";
  if (score >= 1.5) return "#00B4FF";
  return "#475569";
}

function momentumLabel(score: number): string {
  if (score >= 5)   return "Accelerating";
  if (score >= 3)   return "Rising";
  if (score >= 1.5) return "Stable";
  return "Cooling";
}

function momentumIcon(score: number): string {
  if (score >= 5)   return "⚡";
  if (score >= 3)   return "↑";
  if (score >= 1.5) return "→";
  return "↓";
}

function formatMovement(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Headline generator ─────────────────────────────────────────────────────────

function buildHeadline(
  criticalCount: number,
  acceleratingCount: number,
  newToday: number,
  activeCount: number,
  total: number,
): string {
  if (criticalCount > 0)
    return criticalCount === 1
      ? "Critical activity confirmed. One rival demands attention now."
      : `${criticalCount} critical alerts active. Immediate intelligence available.`;
  if (acceleratingCount > 0)
    return acceleratingCount === 1
      ? "One rival is accelerating. The signal pattern is confirmed."
      : `${acceleratingCount} rivals accelerating. The competitive field is moving.`;
  if (newToday > 0)
    return newToday === 1
      ? "One rival moved in the last 24 hours."
      : `${newToday} rivals moved in the last 24 hours.`;
  if (activeCount > 0)
    return activeCount === 1
      ? "One rival showing strategic movement."
      : `${activeCount} rivals showing active movement.`;
  return `${total} rivals under continuous surveillance.`;
}

// ── Mini field preview SVG ─────────────────────────────────────────────────────

function FieldPreview({ competitors }: { competitors: RadarCompetitor[] }) {
  const CX = 150, CY = 82, MAX_R = 70;
  const GOLDEN = 2.39996; // golden angle in radians

  const maxMomentum = competitors.reduce(
    (m, c) => Math.max(m, Number(c.momentum_score ?? 0)),
    0.1,
  );

  // Place up to 22 nodes by golden spiral, radius inversely proportional to momentum
  const nodes = competitors.slice(0, 22).map((c, i) => {
    const momentum     = Number(c.momentum_score ?? 0);
    const angle        = i * GOLDEN;
    const normalised   = momentum / Math.max(maxMomentum, 5);
    const distFraction = 1 - (normalised * 0.78 + 0.06);
    const r            = MAX_R * Math.max(0.12, Math.min(1, distFraction));
    return {
      x:         CX + r * Math.cos(angle),
      y:         CY + r * Math.sin(angle),
      momentum,
      name:      c.competitor_name,
      r:         momentum >= 5 ? 5.5 : momentum >= 3 ? 4.5 : momentum >= 1.5 ? 3.5 : 2.8,
    };
  });

  // Top 3 by momentum for labels
  const labelled = [...nodes]
    .sort((a, b) => b.momentum - a.momentum)
    .slice(0, 3)
    .filter((n) => n.momentum > 0);

  return (
    <svg
      viewBox="0 0 300 164"
      style={{ width: "100%", height: "164px", display: "block" }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="dbg-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#0a1f0a" stopOpacity="1" />
          <stop offset="100%" stopColor="#010601" stopOpacity="1" />
        </radialGradient>
        <radialGradient id="dbg-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#00B4FF" stopOpacity="0.08" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Background */}
      <rect width="300" height="164" fill="url(#dbg-bg)" />
      <rect width="300" height="164" fill="url(#dbg-glow)" />

      {/* Radar rings */}
      {[MAX_R * 0.28, MAX_R * 0.50, MAX_R * 0.72, MAX_R].map((r, i) => (
        <circle
          key={i}
          cx={CX} cy={CY} r={r}
          fill="none"
          stroke="#00B4FF"
          strokeWidth={i === 3 ? 0.7 : 0.5}
          strokeOpacity={0.07 + i * 0.03}
          strokeDasharray={i === 3 ? undefined : "2 4"}
        />
      ))}

      {/* Cross-hairs */}
      <line x1={CX} y1={CY - MAX_R - 4} x2={CX} y2={CY + MAX_R + 4} stroke="#00B4FF" strokeWidth="0.3" strokeOpacity="0.10" strokeDasharray="2 6" />
      <line x1={CX - MAX_R - 4} y1={CY} x2={CX + MAX_R + 4} y2={CY} stroke="#00B4FF" strokeWidth="0.3" strokeOpacity="0.10" strokeDasharray="2 6" />

      {/* Sonar sweep — animated */}
      <motion.g
        style={{ transformOrigin: `${CX}px ${CY}px` }}
        animate={{ rotate: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      >
        <path
          d={`M${CX},${CY} L${CX},${CY - MAX_R} A${MAX_R},${MAX_R} 0 0,1 ${CX + MAX_R * Math.sin(0.52)},${CY - MAX_R * Math.cos(0.52)} Z`}
          fill="#00B4FF"
          fillOpacity="0.06"
        />
        <line
          x1={CX} y1={CY}
          x2={CX} y2={CY - MAX_R}
          stroke="#00B4FF"
          strokeWidth="0.8"
          strokeOpacity="0.30"
        />
      </motion.g>

      {/* Competitor nodes */}
      {nodes.map((n, i) => {
        const col  = momentumColor(n.momentum);
        const isLit = n.momentum >= 1.5;
        return (
          <g key={i}>
            {isLit && (
              <circle cx={n.x} cy={n.y} r={n.r + 3} fill={col} fillOpacity="0.08" />
            )}
            <circle
              cx={n.x} cy={n.y} r={n.r}
              fill={col}
              fillOpacity={isLit ? 0.82 : 0.35}
            />
          </g>
        );
      })}

      {/* Labels for top 3 */}
      {labelled.map((n, i) => {
        const col    = momentumColor(n.momentum);
        const label  = n.name.length > 10 ? n.name.slice(0, 10) + "…" : n.name;
        const offset = n.y < CY ? -n.r - 5 : n.r + 10;
        return (
          <text
            key={i}
            x={n.x}
            y={n.y + offset}
            textAnchor="middle"
            fill={col}
            fontSize="6.5"
            fontFamily="monospace"
            fillOpacity="0.75"
          >
            {label}
          </text>
        );
      })}

      {/* Center dot */}
      <circle cx={CX} cy={CY} r="2" fill="#00B4FF" fillOpacity="0.45" />

      {/* Cardinal labels */}
      {[
        { x: CX,          y: CY - MAX_R - 8, label: "N" },
        { x: CX + MAX_R + 8, y: CY + 3,     label: "E" },
        { x: CX,          y: CY + MAX_R + 12, label: "S" },
        { x: CX - MAX_R - 8, y: CY + 3,     label: "W" },
      ].map(({ x, y, label }) => (
        <text key={label} x={x} y={y} textAnchor="middle" fill="#00B4FF" fontSize="7" fontFamily="monospace" fillOpacity="0.22">
          {label}
        </text>
      ))}

      {/* Field status label */}
      <text x="10" y="156" fill="#00B4FF" fontSize="7" fontFamily="monospace" fillOpacity="0.28" letterSpacing="0.1em">
        LIVE FIELD
      </text>
    </svg>
  );
}

// ── Session key ────────────────────────────────────────────────────────────────

const BRIEF_KEY = "mv_daily_brief_shown";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DailyBriefOverlay({
  competitors,
}: {
  competitors: RadarCompetitor[];
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (competitors.length === 0) return;
    if (localStorage.getItem(BRIEF_KEY) === todayKey()) return;
    const t = setTimeout(() => setVisible(true), 900);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    localStorage.setItem(BRIEF_KEY, todayKey());
    setVisible(false);
  }

  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ── Derived intelligence ───────────────────────────────────────────────────

  const total = competitors.length;

  const activeCount = competitors.filter(
    (c) => Number(c.momentum_score ?? 0) > 0,
  ).length;

  const acceleratingCount = competitors.filter(
    (c) => Number(c.momentum_score ?? 0) >= 5,
  ).length;

  const signals7d = competitors.reduce(
    (sum, c) => sum + (c.signals_7d ?? 0),
    0,
  );

  const newToday = competitors.filter((c) => {
    if (!c.last_signal_at) return false;
    return Date.now() - new Date(c.last_signal_at).getTime() < 86_400_000;
  }).length;

  const criticalCount = competitors.filter((c) => {
    const m    = Number(c.momentum_score ?? 0);
    const s    = c.signals_7d ?? 0;
    const conf = Number(c.latest_movement_confidence ?? 0);
    const age  = c.latest_movement_last_seen_at
      ? Date.now() - new Date(c.latest_movement_last_seen_at).getTime()
      : Infinity;
    return m >= 7 && s >= 3 && conf >= 0.7 && c.latest_movement_type != null && age < 172_800_000;
  }).length;

  const topMovers = [...competitors]
    .filter((c) => Number(c.momentum_score ?? 0) > 0 && c.latest_movement_type)
    .sort((a, b) => Number(b.momentum_score ?? 0) - Number(a.momentum_score ?? 0))
    .slice(0, 3);

  const headline = buildHeadline(criticalCount, acceleratingCount, newToday, activeCount, total);
  const quote    = getDailyQuote();

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month:   "long",
    day:     "numeric",
    year:    "numeric",
  });

  // ── Stats row ──────────────────────────────────────────────────────────────

  const stats = [
    {
      label: "Rivals",
      value: total,
      color: "rgba(226,232,240,0.9)",
      sub: "monitored",
    },
    {
      label: "Active",
      value: activeCount,
      color: activeCount > 0 ? "#00B4FF" : "#475569",
      sub: "in motion",
    },
    {
      label: "Signals",
      value: signals7d,
      color: signals7d > 0 ? "rgba(226,232,240,0.75)" : "#475569",
      sub: "last 7 days",
    },
    {
      label: "Accel.",
      value: acceleratingCount,
      color: acceleratingCount > 0 ? "#ef4444" : "#475569",
      sub: "score ≥ 5",
    },
  ];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[350] flex items-end justify-center pb-0 md:items-center md:pb-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32 }}
          onClick={dismiss}
          style={{ background: "rgba(0,2,0,0.90)", backdropFilter: "blur(8px)" }}
        >
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{    opacity: 0, y: 16,  scale: 0.98, transition: { duration: 0.18 } }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative mx-4 w-full max-w-[480px] rounded-b-none rounded-t-[22px] md:rounded-[22px]"
            style={{
              background:  "linear-gradient(160deg, #020d03 0%, #010701 100%)",
              border:      "1px solid rgba(0,180,255,0.10)",
              boxShadow:   "0 0 0 1px rgba(0,180,255,0.06), 0 40px 120px rgba(0,0,0,0.95), 0 0 80px rgba(0,180,255,0.04)",
            }}
          >
            {/* Top accent line */}
            <div
              className="absolute inset-x-0 top-0 h-[1px] rounded-t-[22px]"
              style={{
                background: "linear-gradient(90deg, transparent 0%, rgba(0,180,255,0.5) 35%, rgba(0,180,255,0.72) 50%, rgba(0,180,255,0.5) 65%, transparent 100%)",
              }}
            />

            {/* Header bar */}
            <div className="flex items-center justify-between px-5 pt-4 pb-0">
              <div
                className="font-mono text-[9px] font-bold uppercase tracking-[0.32em]"
                style={{ color: "rgba(0,180,255,0.50)" }}
              >
                Daily Scan Brief
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-700">
                {dateStr}
              </div>
            </div>

            {/* Live field SVG — full width, no padding */}
            <div className="mt-3 overflow-hidden rounded-[14px] mx-5" style={{ border: "1px solid rgba(0,180,255,0.07)" }}>
              <FieldPreview competitors={competitors} />
            </div>

            {/* Headline */}
            <div className="px-5 pt-4 pb-0">
              <h2
                className="text-[18px] font-bold leading-snug tracking-tight"
                style={{ color: criticalCount > 0 ? "#ef4444" : acceleratingCount > 0 ? "#f59e0b" : "rgba(255,255,255,0.92)" }}
              >
                {headline}
              </h2>
            </div>

            {/* Stats grid */}
            <div className="mt-4 grid grid-cols-4 gap-2 px-5">
              {stats.map(({ label, value, color, sub }) => (
                <div
                  key={label}
                  className="rounded-[10px] border border-[#0f1f0f] bg-[#020a02] px-2 py-2.5 text-center"
                >
                  <div
                    className="text-[20px] font-semibold tabular-nums leading-none"
                    style={{ color }}
                  >
                    {value}
                  </div>
                  <div className="mt-1 text-[8px] uppercase tracking-[0.16em] text-slate-700">
                    {label}
                  </div>
                  <div className="mt-0.5 text-[8px] text-slate-800">
                    {sub}
                  </div>
                </div>
              ))}
            </div>

            {/* Top movers */}
            {topMovers.length > 0 && (
              <div className="mt-4 px-5">
                <div
                  className="mb-2 text-[9px] font-bold uppercase tracking-[0.24em]"
                  style={{ color: "rgba(0,180,255,0.35)" }}
                >
                  Top movers
                </div>
                <div className="space-y-1.5">
                  {topMovers.map((c) => {
                    const score = Number(c.momentum_score ?? 0);
                    const col   = momentumColor(score);
                    const conf  = c.latest_movement_confidence
                      ? Math.round(Number(c.latest_movement_confidence) * 100)
                      : null;
                    return (
                      <div
                        key={c.competitor_id}
                        className="flex items-center justify-between gap-3 rounded-[10px] px-3 py-2"
                        style={{
                          background:  `${col}08`,
                          border:      `1px solid ${col}18`,
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[12px]" style={{ color: col }}>
                            {momentumIcon(score)}
                          </span>
                          <span className="text-[12px] font-semibold text-white truncate">
                            {c.competitor_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {c.latest_movement_type && (
                            <span
                              className="text-[9px] uppercase tracking-[0.1em]"
                              style={{ color: "rgba(148,163,184,0.55)" }}
                            >
                              {formatMovement(c.latest_movement_type)}
                            </span>
                          )}
                          {conf !== null && (
                            <span
                              className="font-mono text-[9px]"
                              style={{ color: col, opacity: 0.75 }}
                            >
                              {conf}%
                            </span>
                          )}
                          <span
                            className="font-mono text-[9px] font-bold"
                            style={{ color: col }}
                          >
                            {momentumLabel(score)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Daily quote */}
            <div
              className="mx-5 mt-4 rounded-[12px] px-4 py-3.5"
              style={{
                background: "rgba(255,255,255,0.016)",
                border:     "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div
                className="mb-1 font-serif text-[26px] leading-none"
                style={{ color: "rgba(0,180,255,0.12)" }}
                aria-hidden="true"
              >
                &ldquo;
              </div>
              <p
                className="text-[12px] font-medium leading-relaxed"
                style={{ color: "rgba(226,232,240,0.72)" }}
              >
                {quote.text}
              </p>
              <p
                className="mt-2 text-[10px] uppercase tracking-[0.18em]"
                style={{ color: "rgba(100,116,139,0.55)" }}
              >
                — {quote.author}
              </p>
            </div>

            {/* CTA */}
            <div className="px-5 pt-4 pb-5">
              <button
                onClick={dismiss}
                className="w-full rounded-full py-2.5 text-center text-[12px] font-semibold transition-all duration-200"
                style={{
                  background:   "rgba(0,180,255,0.07)",
                  border:       "1px solid rgba(0,180,255,0.22)",
                  color:        "rgba(0,180,255,0.85)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,180,255,0.12)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,180,255,0.38)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,180,255,0.07)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,180,255,0.22)";
                }}
              >
                Open Radar →
              </button>
              <p className="mt-2.5 text-center text-[9px] text-slate-800">
                ESC to dismiss · shown once daily
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
