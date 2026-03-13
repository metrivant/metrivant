"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

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

      // M/B/S are handled by AppOverlays (overlay shortcuts)
      if (e.key.toLowerCase() === "d") {
        router.push("/app/discover");
      }
    }

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [router]);

  // Keyboard handler only — legend is rendered in SidebarNav
  return null;
}
