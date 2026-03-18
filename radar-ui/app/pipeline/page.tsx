// ── /pipeline — Public engineering schematic of the Metrivant detection pipeline
// No authentication required. Accessible from the app header and public nav.
// Shows per-stage operational status (green/amber/red) with click-to-expand panels.

import Link from "next/link";
import { createServiceClient } from "../../lib/supabase/service";
import PipelineDiagram from "../../components/PipelineDiagram";
import type { StageStatus } from "../api/pipeline-status/route";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "How Metrivant Works — Pipeline",
  description:
    "The Metrivant detection pipeline: 8 stages from page capture to radar intelligence. Live operational status.",
};

// ── Server-side status fetch (same logic as /api/pipeline-status, avoids self-fetch) ─

const STAGE_MAP: Record<string, string> = {
  capture:      "fetch-snapshots",
  parse:        "extract-sections",
  baseline:     "build-baselines",
  diff:         "detect-diffs",
  signal:       "detect-signals",
  intelligence: "interpret-signals",
};

const WARN_MINS  = 70;
const STALE_MINS = 150;

async function getInitialStages(): Promise<{ id: string; status: StageStatus }[]> {
  const fallback = ["capture","parse","baseline","diff","signal","intelligence","movement","radar"]
    .map((id) => ({ id, status: "unknown" as StageStatus }));

  try {
    const service = createServiceClient();
    const ago3h = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (service as any)
      .from("pipeline_events")
      .select("stage, status, created_at")
      .gte("created_at", ago3h)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error || !rows) return fallback;

    const lastSuccessAt = new Map<string, number>();
    for (const row of rows as { stage: string; status: string; created_at: string }[]) {
      if (row.status === "success" && !lastSuccessAt.has(row.stage)) {
        lastSuccessAt.set(row.stage, new Date(row.created_at).getTime());
      }
    }

    function ageStatus(key: string): StageStatus {
      const ts = lastSuccessAt.get(key);
      if (!ts) return "unknown";
      const ageMins = (Date.now() - ts) / 60_000;
      if (ageMins < WARN_MINS)  return "ok";
      if (ageMins < STALE_MINS) return "warn";
      return "stale";
    }

    const stages = Object.entries(STAGE_MAP).map(([id, key]) => ({
      id,
      status: ageStatus(key),
    }));

    const movementStatus =
      ageStatus("detect-movements") !== "unknown"
        ? ageStatus("detect-movements")
        : ageStatus("synthesize-movement-narratives");
    stages.push({ id: "movement", status: movementStatus });

    const intelStatus = stages.find((s) => s.id === "intelligence")?.status ?? "unknown";
    stages.push({ id: "radar", status: intelStatus });

    return stages;
  } catch {
    return fallback;
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PipelinePage() {
  const initialStages = await getInitialStages();

  return (
    <div
      className="min-h-screen bg-[#000200] text-white"
      style={{ fontFamily: "var(--font-inter, ui-sans-serif, system-ui, sans-serif)" }}
    >
      {/* ── Blueprint dot grid ────────────────────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(46,230,166,0.45) 0.5px, transparent 0.5px)",
          backgroundSize: "28px 28px",
          opacity: 0.055,
        }}
      />

      {/* ── Green atmospheric vignette ─────────────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 50% -5%, rgba(46,230,166,0.06) 0%, transparent 70%)",
        }}
      />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-[#0e2210] bg-[rgba(0,2,0,0.97)] px-6">
        <div
          className="absolute inset-x-0 top-0 h-[1px]"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(46,230,166,0.30) 40%, rgba(46,230,166,0.55) 50%, rgba(46,230,166,0.30) 60%, transparent 100%)",
          }}
        />

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <svg width="22" height="22" viewBox="0 0 46 46" fill="none" aria-hidden="true">
            <circle cx="23" cy="23" r="21.5" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.50" />
            <circle cx="23" cy="23" r="13"   stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.28" />
            <circle cx="23" cy="23" r="5.5"  stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.42" />
            <path d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z" fill="#2EE6A6" fillOpacity="0.10" />
            <line x1="23" y1="23" x2="38.2" y2="9.8" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.80" />
            <circle cx="23" cy="23" r="2.5" fill="#2EE6A6" />
          </svg>
          <span className="text-[13px] font-bold tracking-[0.08em] text-white">METRIVANT</span>
        </Link>

        {/* Nav */}
        <div className="flex items-center gap-5">
          <Link href="/pricing" className="text-[12px] text-slate-600 transition-colors hover:text-slate-400">
            Pricing
          </Link>
          <Link href="/about" className="text-[12px] text-slate-600 transition-colors hover:text-slate-400">
            About
          </Link>
          <Link
            href="/app"
            className="flex items-center gap-1.5 rounded-full border border-[#1a3a1a] bg-[#0a1a0a] px-3 py-1.5 text-[12px] font-medium text-[#2EE6A6] transition-colors hover:border-[#2EE6A6]/40"
          >
            Open Radar
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
              <path d="M2 5h6M5.5 2l2.5 3-2.5 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </header>

      {/* ── Page content ──────────────────────────────────────────────────── */}
      <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-12">

        {/* ── Title ─────────────────────────────────────────────────────── */}
        <div className="mb-12">
          <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-slate-600">
            Engineering Reference · Live Status
          </div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-white sm:text-[32px]">
            The Detection Pipeline
          </h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-slate-500">
            Metrivant operates a deterministic 8-stage pipeline that runs continuously.
            Every radar signal you see is produced by this engine — no speculation,
            no inference. Click any stage to see exactly how it works.
          </p>

          {/* Design callout */}
          <div
            className="mt-6 inline-flex items-center gap-2.5 rounded-full border border-[#0e2210] bg-[#020802] px-4 py-2"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="5.5" stroke="rgba(46,230,166,0.45)" strokeWidth="1.2" />
              <circle cx="7" cy="7" r="2.5" stroke="rgba(46,230,166,0.60)" strokeWidth="1" />
              <line x1="7" y1="1.5" x2="7" y2="3" stroke="rgba(46,230,166,0.45)" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span className="font-mono text-[11px] text-slate-500">
              Status indicators reflect live pipeline health — updated every 60 seconds
            </span>
          </div>
        </div>

        {/* ── Interactive pipeline diagram ───────────────────────────────── */}
        <PipelineDiagram initialStages={initialStages} />

        {/* ── Footer philosophy ──────────────────────────────────────────── */}
        <div
          className="mt-16 rounded-[18px] border border-[#0e1e0e] bg-[#020802] px-8 py-8"
        >
          <div className="grid gap-8 sm:grid-cols-3">
            <PhilosophyPillar
              title="Deterministic"
              body="Every signal traces to an observed page change. No AI hallucination, no pattern-matching on text alone — only verified diffs advance through the pipeline."
            />
            <PhilosophyPillar
              title="Evidence-grounded"
              body="The full evidence chain is preserved at every stage. When a movement appears on your radar, you can inspect the exact diff that generated it."
            />
            <PhilosophyPillar
              title="Continuous"
              body="The pipeline runs 24/7 without human intervention. Pricing pages are captured every 30 minutes. You never have to remember to check."
            />
          </div>
        </div>

      </div>
    </div>
  );
}

function PhilosophyPillar({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div
        className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em]"
        style={{ color: "rgba(46,230,166,0.50)" }}
      >
        {title}
      </div>
      <p className="text-[13px] leading-relaxed text-slate-500">{body}</p>
    </div>
  );
}
