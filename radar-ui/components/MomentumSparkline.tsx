"use client";

import { useEffect, useState } from "react";
import { getMomentumConfig } from "../lib/momentum";

type HistoryPoint = {
  score:      number;
  state:      string;
  recordedAt: string;
};

type Props = {
  competitorId: string;
};

// ── Pure SVG sparkline — no external charting lib ─────────────────────────────

export default function MomentumSparkline({ competitorId }: Props) {
  const [points, setPoints]   = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setPoints([]);
    fetch(`/api/momentum/history?competitor_id=${encodeURIComponent(competitorId)}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data: { points: HistoryPoint[] }) => {
        setPoints(data.points ?? []);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [competitorId]);

  if (loading) {
    return (
      <div className="h-12 animate-pulse rounded-lg bg-[#0c1e0c]" />
    );
  }

  if (points.length < 2) {
    return (
      <div className="flex h-12 items-center justify-center">
        <span className="text-[11px] text-slate-700">Gathering trend data…</span>
      </div>
    );
  }

  // Build SVG polyline
  const W = 320;
  const H = 48;
  const PAD_X = 4;
  const PAD_Y = 6;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;

  const maxScore = Math.max(...points.map((p) => p.score), 0.1);

  const coords = points.map((p, i) => {
    const x = PAD_X + (i / (points.length - 1)) * innerW;
    const y = PAD_Y + (1 - p.score / maxScore) * innerH;
    return { x, y, p };
  });

  const polyline = coords.map((c) => `${c.x},${c.y}`).join(" ");

  // Determine fill gradient color from latest state
  const lastScore = points[points.length - 1].score;
  const cfg = getMomentumConfig(lastScore);

  // Area fill: polyline closed to bottom
  const areaPoints = [
    `${coords[0].x},${H}`,
    ...coords.map((c) => `${c.x},${c.y}`),
    `${coords[coords.length - 1].x},${H}`,
  ].join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      aria-label="Momentum trend sparkline"
      className="overflow-visible"
    >
      {/* Gradient fill under line */}
      <defs>
        <linearGradient id={`sparkGrad-${competitorId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={cfg.color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={cfg.color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      <polygon
        points={areaPoints}
        fill={`url(#sparkGrad-${competitorId})`}
      />

      <polyline
        points={polyline}
        fill="none"
        stroke={cfg.color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.85"
      />

      {/* Terminal dot — latest value */}
      <circle
        cx={coords[coords.length - 1].x}
        cy={coords[coords.length - 1].y}
        r="3"
        fill={cfg.color}
        style={{ filter: `drop-shadow(0 0 3px ${cfg.color}99)` }}
      />
    </svg>
  );
}
