export default function Loading() {
  return (
    <main className="min-h-screen bg-[#000002] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-[0.018] [background-image:radial-gradient(rgba(255,255,255,0.9)_0.5px,transparent_0.5px)] [background-size:6px_6px]" />

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
          <div className="h-4 w-24 animate-pulse rounded bg-[#0d1e0d]" />
        </div>
      </header>

      <section className="mx-auto w-full max-w-[1600px] px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 h-3 w-32 animate-pulse rounded bg-[#0d1e0d]" />
            <div className="h-9 w-72 animate-pulse rounded-lg bg-[#0d1e0d]" />
            <div className="mt-3 h-4 w-96 animate-pulse rounded bg-[#0a170a]" />
          </div>
          <div className="grid grid-cols-3 gap-3 md:min-w-[360px]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl border border-[#0d1e0d] bg-[#06060d] p-3">
                <div className="h-2.5 w-16 animate-pulse rounded bg-[#0d1e0d]" />
                <div className="mt-3 h-6 w-10 animate-pulse rounded bg-[#0d1e0d]" />
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6 border-b border-[#0a0a1a] pb-5">
          <div className="h-3 w-64 animate-pulse rounded bg-[#0a170a]" />
        </div>

        <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] border border-[#0a0a1a] bg-[#030803] p-4">
            <div className="rounded-[24px] border border-[#0a170a] bg-[#040a04] p-3">
              <div className="mb-3 flex items-center justify-between px-2">
                <div className="h-2.5 w-20 animate-pulse rounded bg-[#0d1e0d]" />
                <div className="h-2.5 w-24 animate-pulse rounded bg-[#0d1e0d]" />
              </div>
              <div className="flex justify-center">
                <div className="aspect-square w-full max-w-[720px] animate-pulse rounded-[22px] bg-[#020502]" />
              </div>
            </div>
          </div>
          <div className="rounded-[28px] border border-[#0d1e0d] bg-[#050c05] p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="h-2.5 w-20 animate-pulse rounded bg-[#0d1e0d]" />
                <div className="mt-3 h-7 w-28 animate-pulse rounded-lg bg-[#0d1e0d]" />
              </div>
              <div className="h-6 w-12 animate-pulse rounded-full bg-[#0d1e0d]" />
            </div>
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-[#06060d]" />
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
