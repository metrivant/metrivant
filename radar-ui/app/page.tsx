import Radar from "../components/Radar";
import { getRadarFeed } from "../lib/api";

export default async function Page() {
  const competitors = await getRadarFeed(24);

  const activeCount = competitors.filter(
    (c) => Number(c.momentum_score ?? 0) > 0
  ).length;

  const topMomentum = Math.max(
    ...competitors.map((c) => Number(c.momentum_score ?? 0)),
    0
  );

  return (
    <main className="min-h-screen bg-[#000200] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-[0.018] [background-image:radial-gradient(rgba(255,255,255,0.9)_0.5px,transparent_0.5px)] [background-size:6px_6px]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_bottom,transparent_0%,rgba(20,83,45,0.05)_50%,transparent_100%)]" />

      <header className="sticky top-0 z-20 border-b border-[#0d1e0d] bg-[rgba(1,2,2,0.92)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full border border-green-600/30 bg-[#040b04]">
              <div className="absolute h-6 w-6 rounded-full border border-green-500/20" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-400 shadow-[0_0_18px_rgba(74,222,128,0.6)]" />
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                Competitive Intelligence
              </div>
              <div className="text-sm font-semibold tracking-tight text-slate-100">
                Metrivant
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-6 md:flex">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Active contacts:{" "}
              <span className="text-green-400">{activeCount}</span>
            </div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Max momentum:{" "}
              <span className="text-green-400">{topMomentum.toFixed(1)}</span>
            </div>
            <div className="rounded-full border border-green-500/20 bg-green-500/5 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-green-400">
              Live radar
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[1600px] px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 text-[11px] uppercase tracking-[0.28em] text-slate-500">
              Command Center
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">
              Market movement radar
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Watch competitor momentum, strategic movement type, and signal
              density in one clean surface.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 md:min-w-[360px]">
            <div className="rounded-2xl border border-[#0d1e0d] bg-[#060d06] p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Rivals
              </div>
              <div className="mt-2 text-xl font-semibold text-slate-100">
                {competitors.length}
              </div>
            </div>
            <div className="rounded-2xl border border-[#0d1e0d] bg-[#060d06] p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Active
              </div>
              <div className="mt-2 text-xl font-semibold text-slate-100">
                {activeCount}
              </div>
            </div>
            <div className="rounded-2xl border border-[#0d1e0d] bg-[#060d06] p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Highest
              </div>
              <div className="mt-2 text-xl font-semibold text-slate-100">
                {topMomentum.toFixed(1)}
              </div>
            </div>
          </div>
        </div>

        <Radar competitors={competitors} />
      </section>
    </main>
  );
}
