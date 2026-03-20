"use client";
import { useEffect, useState } from "react";

export default function KnowledgePanelToggle() {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    const v = localStorage.getItem("mv_knowledge_panel");
    if (v === "false") setEnabled(false);
  }, []);
  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem("mv_knowledge_panel", next ? "true" : "false");
  };
  return (
    <button
      onClick={toggle}
      style={{
        width: "44px", height: "24px", borderRadius: "12px", border: "none",
        background: enabled ? "#00B4FF" : "#1a2a1a",
        position: "relative", cursor: "pointer", transition: "background 0.2s ease",
        flexShrink: 0,
      }}
      aria-label={enabled ? "Disable knowledge panel" : "Enable knowledge panel"}
    >
      <span style={{
        position: "absolute", top: "3px",
        left: enabled ? "23px" : "3px",
        width: "18px", height: "18px", borderRadius: "50%",
        background: "#ffffff",
        transition: "left 0.2s ease",
        display: "block",
      }} />
    </button>
  );
}
