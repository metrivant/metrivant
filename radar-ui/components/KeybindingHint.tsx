"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const SHORTCUTS: { key: string; label: string; href: string }[] = [
  { key: "M", label: "Map",      href: "/app/market-map" },
  { key: "B", label: "Briefs",   href: "/app/briefs"     },
  { key: "S", label: "Strategy", href: "/app/strategy"   },
  { key: "D", label: "Discover", href: "/app/discover"   },
];

export default function KeybindingHint() {
  const router = useRouter();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Do not fire while the user is typing in an input, textarea, or contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) return;
      // Do not fire with modifier keys
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case "m": router.push("/app/market-map"); break;
        case "b": router.push("/app/briefs");     break;
        case "s": router.push("/app/strategy");   break;
        case "d": router.push("/app/discover");   break;
      }
    }

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [router]);

  return (
    // Hidden on mobile, visible on md+ screens
    <div className="pointer-events-none fixed bottom-5 right-5 z-40 hidden items-center gap-3 md:flex">
      {SHORTCUTS.map(({ key, label }) => (
        <span key={key} className="flex items-center gap-1.5">
          <span
            className="flex h-5 min-w-[20px] items-center justify-center rounded px-1.5 font-mono text-[9px] font-bold uppercase"
            style={{
              background: "rgba(0,0,0,0.72)",
              border: "1px solid rgba(46,230,166,0.18)",
              color: "rgba(46,230,166,0.55)",
              boxShadow: "0 0 6px rgba(46,230,166,0.08)",
            }}
          >
            {key}
          </span>
          <span
            className="text-[9px] uppercase tracking-[0.16em]"
            style={{ color: "rgba(100,116,139,0.55)" }}
          >
            {label}
          </span>
        </span>
      ))}
    </div>
  );
}
