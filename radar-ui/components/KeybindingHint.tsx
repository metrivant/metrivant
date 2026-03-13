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

  // Keyboard handler only — legend is rendered in SidebarNav
  return null;
}
