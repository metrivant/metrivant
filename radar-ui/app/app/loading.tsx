// Shown by Next.js while the /app server component fetches radar data.
// Must match the shell geometry of app/page.tsx exactly to prevent layout shift.

function Shimmer({ className }: { className: string }) {
  return <div className={`skeleton-shimmer rounded ${className}`} />;
}

export default function AppLoading() {
  return (
    <main className="flex h-screen w-full flex-col overflow-hidden bg-black text-white">
      {/* Dot grid */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.85) 0.5px, transparent 0.5px)",
          backgroundSize: "6px 6px",
          opacity: 0.022,
        }}
      />

      {/* Header skeleton */}
      <header className="relative z-20 flex h-[68px] shrink-0 items-center border-b border-[#0e2210] bg-[rgba(0,0,0,0.98)]">
        <div
          className="absolute inset-x-0 top-0 h-[1px]"
          style={{ background: "linear-gradient(90deg, transparent 0%, rgba(46,230,166,0.20) 50%, transparent 100%)" }}
        />
        <div className="flex w-full items-center justify-between px-5">
          {/* Brand */}
          <div className="flex items-center gap-3.5">
            <div className="h-9 w-9 rounded-full" style={{ background: "rgba(46,230,166,0.04)", border: "1px solid rgba(46,230,166,0.12)" }} />
            <div className="flex flex-col gap-1">
              <Shimmer className="h-3.5 w-28" />
              <Shimmer className="h-2 w-20" />
            </div>
          </div>
          {/* Right stats skeleton */}
          <div className="hidden items-center gap-5 md:flex">
            {[56, 40, 52, 48].map((w, i) => (
              <div key={i} className="flex flex-col items-end gap-1">
                <Shimmer className="h-2 w-10" />
                <Shimmer className={`h-5 w-${w > 48 ? "8" : "6"}`} />
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Intelligence strip placeholder */}
      <div className="h-7 shrink-0 border-b border-[#0a1a0a]" style={{ background: "rgba(0,0,0,0.95)" }}>
        <Shimmer className="mx-6 mt-2 h-2.5 w-80" />
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-row overflow-hidden">
        {/* Sidebar skeleton */}
        <nav className="hidden w-[190px] shrink-0 flex-col gap-1 border-r border-[#0e2210] bg-[rgba(0,0,0,0.98)] p-3 pt-5 md:flex xl:w-[240px]">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
              <div className="h-3 w-3 rounded skeleton-shimmer" />
              <Shimmer className="h-2.5 w-16" />
            </div>
          ))}
        </nav>

        {/* Radar area skeleton */}
        <div className="relative flex flex-1 flex-col overflow-hidden p-3 pb-[76px] md:pb-3">
          <div className="flex h-full w-full items-center justify-center">
            {/* Concentric rings — radar silhouette */}
            <div className="relative flex items-center justify-center" style={{ width: "min(100%, 600px)", aspectRatio: "1" }}>
              {[1, 0.72, 0.50, 0.28].map((scale, i) => (
                <div
                  key={i}
                  className="absolute rounded-full border"
                  style={{
                    width: `${scale * 100}%`,
                    height: `${scale * 100}%`,
                    borderColor: `rgba(46,230,166,${0.04 + i * 0.015})`,
                    animation: `skeleton-pulse 2s ease-in-out ${i * 0.3}s infinite`,
                  }}
                />
              ))}
              {/* Centre dot */}
              <div
                className="h-2 w-2 rounded-full"
                style={{
                  background: "rgba(46,230,166,0.35)",
                  boxShadow: "0 0 8px rgba(46,230,166,0.2)",
                  animation: "skeleton-pulse 2s ease-in-out infinite",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
