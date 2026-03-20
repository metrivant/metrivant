"use client";

import { useRouter } from "next/navigation";

export default function StrategyCompetitorPills({ names }: { names: string[] }) {
  const router = useRouter();

  function focusOnRadar(name: string) {
    if (typeof window !== "undefined") {
      localStorage.setItem("mv_radar_focus", name);
    }
    router.push("/app");
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {names.map((name) => (
        <button
          key={name}
          onClick={() => focusOnRadar(name)}
          className="rounded-full border border-[#152415] bg-[#071507] px-2 py-0.5 text-[10px] text-slate-500 transition-colors hover:border-[#00B4FF]/25 hover:text-[#00B4FF]/70"
          title={`Focus ${name} on Radar`}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
