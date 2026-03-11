import Radar from "../components/Radar";
import { getRadarFeed } from "../lib/api";
import { formatRelative } from "../lib/format";

export default async function Page() {
  const competitors = await getRadarFeed(24);

  const activeCount = competitors.filter(
    (c) => Number(c.momentum_score ?? 0) > 0
  ).length;

  const topMomentum = Math.max(
    ...competitors.map((c) => Number(c.momentum_score ?? 0)),
    0
  );

  const totalSignals7d = competitors.reduce(
    (sum, c) => sum + (c.signals_7d ?? 0),
    0
  );

  const lastSignalAt = competitors.reduce<string | null>((latest, c) => {
    if (!c.last_signal_at) return latest;
    if (!latest) return c.last_signal_at;
    return c.last_signal_at > latest ? c.last_signal_at : latest;
  }, null);

  const isQuiet = totalSignals7d === 0;
  const isFresh =
    lastSignalAt !== null &&
    Date.now() - new Date(lastSignalAt).getTime() < 12 * 60 * 60 * 1000;

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
              Moving:{" "}
              <span className="text-green-400">{activeCount}</span>
            </div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Peak activity:{" "}
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
            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Automated competitor monitoring — detects meaningful changes
              across rival websites and surfaces them as actionable
              intelligence.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 md:min-w-[360px]">
            <div className="rounded-2xl border border-[#0d1e0d] bg-[#060d06] p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Monitored
              </div>
              <div className="mt-2 text-xl font-semibold text-slate-100">
                {competitors.length}
              </div>
            </div>
            <div className="rounded-2xl border border-[#0d1e0d] bg-[#060d06] p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Moving
              </div>
              <div className="mt-2 text-xl font-semibold text-slate-100">
                {activeCount}
              </div>
            </div>
            <div className="rounded-2xl border border-[#0d1e0d] bg-[#060d06] p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Changes 7d
              </div>
              <div className="mt-2 text-xl font-semibold text-slate-100">
                {totalSignals7d}
              </div>
            </div>
          </div>
        </div>

        {/* ─── System status strip ──────────────────────────────────── */}
        <div className="mb-6 flex items-center gap-2.5 border-b border-[#0a1a0a] pb-5 text-[10px] uppercase tracking-[0.18em]">
          {/* Freshness indicator dot */}
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            {!isQuiet && isFresh && (
              <span className="absolute inset-0 animate-ping rounded-full bg-green-400 opacity-60" />
            )}
            <span
              className={`relative h-1.5 w-1.5 rounded-full ${
                isQuiet
                  ? "bg-slate-700"
                  : isFresh
                    ? "bg-green-400"
                    : "bg-amber-500"
              }`}
            />
          </span>

          {/* Status label */}
          <span className="text-slate-500">
            {isQuiet
              ? `Watching ${competitors.length} rival${competitors.length !== 1 ? "s" : ""} · no changes this week`
              : `${activeCount} rival${activeCount !== 1 ? "s" : ""} moving · ${totalSignals7d} signal${totalSignals7d !== 1 ? "s" : ""} this week`}
          </span>

          {/* Last signal timestamp */}
          {lastSignalAt !== null && (
            <>
              <span className="text-slate-800">·</span>
              <span className={isFresh ? "text-slate-600" : "text-amber-600/70"}>
                Last signal {formatRelative(lastSignalAt)}
              </span>
            </>
          )}

          {/* Stale warning */}
          {!isFresh && lastSignalAt !== null && (
            <>
              <span className="text-slate-800">·</span>
              <span className="text-amber-600/60">Data may be out of date</span>
            </>
          )}
        </div>

        <Radar competitors={competitors} />
      </section>
    </main>
  );
}
