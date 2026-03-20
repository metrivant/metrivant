import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";

const PIPELINE_STAGES = [
  { name: "Competitors", description: "Tracked companies in your sector" },
  { name: "Monitored Pages", description: "URLs crawled every 1-3 hours" },
  { name: "Snapshots", description: "Point-in-time page captures" },
  { name: "Sections", description: "Extracted content blocks" },
  { name: "Baselines", description: "Stable reference state per section" },
  { name: "Diffs", description: "Changes detected against baseline" },
  { name: "Signals", description: "Classified changes with confidence scoring" },
  { name: "Interpretations", description: "AI analysis of signal meaning" },
  { name: "Movements", description: "Confirmed strategic actions" },
  { name: "Radar Feed", description: "Aggregated intelligence surface" },
] as const;

const POOLS = [
  "Newsroom",
  "Careers",
  "Investor",
  "Product",
  "Procurement",
  "Regulatory",
] as const;

const AI_LAYERS = [
  { name: "Relevance", model: "gpt-4o-mini" },
  { name: "Interpretation", model: "gpt-4o-mini" },
  { name: "Synthesis", model: "gpt-4o" },
  { name: "Narrative", model: "gpt-4o-mini" },
  { name: "Sector Analysis", model: "gpt-4o" },
  { name: "Weekly Brief", model: "gpt-4o" },
] as const;

export default async function PipelinePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-[#000002] text-white pb-[80px]">
      {/* Atmospheric depth */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.85) 0.5px, transparent 0.5px)",
          backgroundSize: "6px 6px",
          opacity: 0.018,
        }}
      />
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 50% -5%, rgba(0,180,255,0.05) 0%, transparent 70%)",
        }}
      />

      {/* Header */}
      <div className="relative mx-auto max-w-2xl px-5 pt-10 pb-2">
        <div
          className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em]"
          style={{ color: "rgba(0,180,255,0.50)" }}
        >
          Pipeline
        </div>
        <h1 className="text-[22px] font-bold tracking-tight text-white">
          System Status
        </h1>
      </div>

      {/* Pipeline stages */}
      <div className="relative mx-auto max-w-2xl px-5 pt-6">
        <div className="flex flex-col">
          {PIPELINE_STAGES.map((stage, i) => (
            <div key={stage.name} className="relative flex items-stretch">
              {/* Vertical connector line */}
              {i < PIPELINE_STAGES.length - 1 && (
                <div
                  className="absolute left-5 top-full w-px"
                  style={{
                    height: "8px",
                    background: "rgba(0,180,255,0.15)",
                  }}
                />
              )}

              {/* Stage card */}
              <div className="w-full rounded-lg border border-[#0d1020] bg-[#020208] p-4 mb-2">
                <div className="text-[13px] font-bold text-white">
                  {stage.name}
                </div>
                <div className="mt-0.5 text-[12px] text-slate-500">
                  {stage.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Additive pools */}
      <div className="relative mx-auto max-w-2xl px-5 pt-10">
        <div
          className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.22em]"
          style={{ color: "rgba(0,180,255,0.50)" }}
        >
          Additive Pools
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {POOLS.map((pool) => (
            <div
              key={pool}
              className="rounded-lg border border-[#0d1020] bg-[#020208] px-3 py-2.5 text-[13px] font-medium text-white"
            >
              {pool}
            </div>
          ))}
        </div>
        <div className="mt-2 text-[12px] text-slate-600">
          Parallel signal sources &middot; RSS, ATS, SEC EDGAR
        </div>
      </div>

      {/* AI stack */}
      <div className="relative mx-auto max-w-2xl px-5 pt-10">
        <div
          className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.22em]"
          style={{ color: "rgba(0,180,255,0.50)" }}
        >
          AI Stack
        </div>
        <div className="flex flex-col gap-2">
          {AI_LAYERS.map((layer) => (
            <div
              key={layer.name}
              className="flex items-center justify-between rounded-lg border border-[#0d1020] bg-[#020208] px-4 py-3"
            >
              <span className="text-[13px] font-medium text-white">
                {layer.name}
              </span>
              <span className="font-mono text-[11px] text-slate-600">
                {layer.model}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
