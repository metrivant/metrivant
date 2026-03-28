import type { RadarCompetitor } from "./api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PositioningScore = {
  competitor_id:         string;
  competitor_name:       string;
  market_focus_score:    number; // 0-100
  customer_segment_score: number; // 0-100
  confidence:            number; // 0-1
  rationale:             string;
};

export type PositioningResult = {
  positioning:       PositioningScore[];
  model?:            string;
  prompt_tokens?:    number;
  completion_tokens?: number;
};

// A meaningful shift is >15 points on either axis vs. previous position.
export const SIGNIFICANT_SHIFT_THRESHOLD = 15;

export function detectSignificantShift(
  current:  { market_focus_score: number; customer_segment_score: number },
  previous: { market_focus_score: number; customer_segment_score: number }
): boolean {
  return (
    Math.abs(current.market_focus_score   - previous.market_focus_score)   > SIGNIFICANT_SHIFT_THRESHOLD ||
    Math.abs(current.customer_segment_score - previous.customer_segment_score) > SIGNIFICANT_SHIFT_THRESHOLD
  );
}

// Axis descriptions used in both prompt and UI tooltips (default/SaaS)
export const MARKET_FOCUS_AXIS = {
  low:  "Niche / Specialist",
  high: "Broad Platform",
  label: "Market Focus",
};

export const CUSTOMER_SEGMENT_AXIS = {
  low:  "SMB / Teams",
  high: "Enterprise",
  label: "Customer Segment",
};

// Sector-specific axis interpretations for positioning analysis
type AxisInterpretation = {
  xAxis: { low: string; high: string; label: string };
  yAxis: { low: string; high: string; label: string };
  scoring: string; // Sector-specific scoring guidance
};

const SECTOR_AXIS_INTERPRETATIONS: Record<string, AxisInterpretation> = {
  saas: {
    xAxis: { low: "Single workflow", high: "Horizontal platform", label: "Product Scope" },
    yAxis: { low: "SMB / Teams", high: "Enterprise", label: "Customer Segment" },
    scoring: `Product Scope: single-workflow specialist (0-20) → focused category tool (20-40) → multi-feature platform (40-60) → broad work OS (60-80) → horizontal platform (80-100)
Customer Segment: individuals/freelancers (0-20) → small teams (20-40) → SMB/growing companies (40-60) → mid-market (60-80) → enterprise/Fortune 500 (80-100)`,
  },
  fintech: {
    xAxis: { low: "Single service", high: "Financial platform", label: "Service Scope" },
    yAxis: { low: "Consumer", high: "Institutional", label: "Customer Segment" },
    scoring: `Service Scope: single financial product (0-20) → focused service category (20-40) → multi-product suite (40-60) → financial platform (60-80) → full-stack fintech (80-100)
Customer Segment: individual consumers (0-20) → mass market retail (20-40) → affluent/SMB (40-60) → commercial/wealth (60-80) → institutional/enterprise (80-100)`,
  },
  cybersecurity: {
    xAxis: { low: "Point solution", high: "Security platform", label: "Solution Scope" },
    yAxis: { low: "SMB", high: "Enterprise", label: "Customer Segment" },
    scoring: `Solution Scope: single security control (0-20) → focused security category (20-40) → integrated solution (40-60) → security platform (60-80) → enterprise security suite (80-100)
Customer Segment: small businesses (0-20) → SMB/mid-market (20-40) → growing enterprises (40-60) → large enterprises (60-80) → Fortune 500/critical infrastructure (80-100)`,
  },
  defense: {
    xAxis: { low: "Single platform", high: "System of systems", label: "Capability Scope" },
    yAxis: { low: "Commercial", high: "Government / DoD", label: "Customer Focus" },
    scoring: `Capability Scope: specialized defense system (0-20) → focused capability (20-40) → integrated platform (40-60) → multi-domain system (60-80) → system of systems integrator (80-100)
Customer Focus: commercial/export (0-20) → allied nations (20-40) → US federal civilian (40-60) → DoD/defense agencies (60-80) → classified/national security (80-100)`,
  },
  energy: {
    xAxis: { low: "Single asset", high: "Integrated operations", label: "Operations Scope" },
    yAxis: { low: "Regional", high: "Global", label: "Geographic Scale" },
    scoring: `Operations Scope: single asset/project (0-20) → regional operator (20-40) → multi-asset portfolio (40-60) → integrated energy company (60-80) → global diversified energy (80-100)
Geographic Scale: local/municipal (0-20) → regional (20-40) → national (40-60) → multi-national (60-80) → global operations (80-100)`,
  },
  custom: {
    xAxis: { low: "Niche", high: "Broad", label: "Market Focus" },
    yAxis: { low: "Small", high: "Large", label: "Customer Size" },
    scoring: `Market Focus: 0 = narrow specialist, 100 = broad horizontal platform
Customer Size: 0 = individual/small, 100 = enterprise/large organizations`,
  },
};

export function quadrantLabel(focus: number, segment: number): string {
  const f = focus   >= 50 ? "Platform"   : "Specialist";
  const s = segment >= 50 ? "Enterprise" : "SMB";
  return `${f} · ${s}`;
}

/**
 * Get sector-specific axis labels for UI display.
 * Returns axis interpretations for the given sector.
 */
export function getSectorAxisLabels(sector: string | null | undefined): AxisInterpretation {
  const sectorKey = (sector && sector !== "custom") ? sector : "saas";
  return SECTOR_AXIS_INTERPRETATIONS[sectorKey] || SECTOR_AXIS_INTERPRETATIONS.saas;
}

// ── OpenAI prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(sector: string | null | undefined): string {
  const sectorKey = (sector && sector !== "custom") ? sector : "saas";
  const axes = SECTOR_AXIS_INTERPRETATIONS[sectorKey] || SECTOR_AXIS_INTERPRETATIONS.saas;

  return `You are a strategic market analyst estimating competitor positioning on a 2×2 market map.

Score each competitor on two axes (sector-specific interpretation):

X-axis: ${axes.xAxis.label} (0–100)
  Low (0): ${axes.xAxis.low}
  High (100): ${axes.xAxis.high}

Y-axis: ${axes.yAxis.label} (0–100)
  Low (0): ${axes.yAxis.low}
  High (100): ${axes.yAxis.high}

Scoring guidance:
${axes.scoring}

Return ONLY valid JSON — no markdown, no explanation outside the JSON:
{
  "positioning": [
    {
      "competitor_id": "the exact uuid from input",
      "competitor_name": "exact name from input",
      "market_focus_score": 65,
      "customer_segment_score": 72,
      "confidence": 0.75,
      "rationale": "2-sentence explanation grounded in the specific signals provided — cite evidence"
    }
  ]
}

HARD RULES:
- Every entry must use the exact competitor_id and competitor_name from the input
- rationale must cite specific signals — never say "appears to be" or "likely"
- confidence 0.5 = minimal signal, 0.9 = strong clear signal
- Base all scoring strictly on the provided signal data — do not apply general knowledge about these companies' histories, backgrounds, or prior market positions
- Return a score for every competitor in the input, even if confidence is low`;
}

export function buildPositioningPrompt(
  competitors: RadarCompetitor[],
  analysisDate: string,
  sector?: string
): string {
  const active = competitors.filter(
    (c) => c.latest_movement_type || Number(c.signals_7d) > 0 || Number(c.momentum_score) > 0
  );

  const candidates = active.length > 0 ? active : competitors;
  const sorted = [...candidates].sort(
    (a, b) => Number(b.momentum_score ?? 0) - Number(a.momentum_score ?? 0)
  );

  const lines: string[] = [
    `Market positioning analysis — ${analysisDate}`,
    ...(sector ? [`Sector context: ${sector}`] : []),
    `${sorted.length} competitors to score`,
    "",
    "COMPETITOR SIGNAL DATA",
    "",
  ];

  sorted.forEach((c, i) => {
    lines.push(`[${i + 1}]`);
    lines.push(`competitor_id: ${c.competitor_id}`);
    lines.push(`competitor_name: ${c.competitor_name}`);
    if (c.latest_movement_type) {
      lines.push(`movement_type: ${c.latest_movement_type.replace(/_/g, " ")}`);
    }
    if (c.latest_movement_confidence != null) {
      lines.push(`movement_confidence: ${(c.latest_movement_confidence * 100).toFixed(0)}%`);
    }
    lines.push(`signals_7d: ${c.signals_7d}`);
    lines.push(`momentum_score: ${Number(c.momentum_score ?? 0).toFixed(1)}`);
    if (c.latest_movement_summary) {
      lines.push(`signal_intelligence: ${c.latest_movement_summary}`);
    }
    lines.push("");
  });

  lines.push("Score all competitors above on both axes.");
  return lines.join("\n");
}

// ── OpenAI call ───────────────────────────────────────────────────────────────

export async function generatePositioning(
  apiKey: string,
  competitors: RadarCompetitor[],
  analysisDate: string,
  sector?: string
): Promise<PositioningResult> {
  if (competitors.length === 0) return { positioning: [] };

  const systemPrompt = buildSystemPrompt(sector);
  const userPrompt = buildPositioningPrompt(competitors, analysisDate, sector);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.15, // very low — deterministic positional scoring
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${body}`);
  }

  const json = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };

  let parsed: { positioning?: unknown[] };
  try {
    parsed = JSON.parse(json.choices[0].message.content) as { positioning?: unknown[] };
  } catch {
    throw new Error("OpenAI returned non-JSON content");
  }

  const raw = Array.isArray(parsed.positioning) ? parsed.positioning : [];

  const positioning: PositioningScore[] = raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      competitor_id:          String(item.competitor_id ?? ""),
      competitor_name:        String(item.competitor_name ?? ""),
      market_focus_score:     Math.max(0, Math.min(100, Number(item.market_focus_score ?? 50))),
      customer_segment_score: Math.max(0, Math.min(100, Number(item.customer_segment_score ?? 50))),
      confidence:             Math.max(0, Math.min(1,   Number(item.confidence ?? 0.5))),
      rationale:              String(item.rationale ?? ""),
    }))
    .filter((p) => p.competitor_id);

  return {
    positioning,
    model:             "gpt-4o",
    prompt_tokens:     json.usage?.prompt_tokens,
    completion_tokens: json.usage?.completion_tokens,
  };
}

// ── Email template ────────────────────────────────────────────────────────────

export type PositionShift = {
  competitor_name:       string;
  old_focus:             number;
  new_focus:             number;
  old_segment:           number;
  new_segment:           number;
  rationale:             string;
};

export function buildRepositioningEmailHtml(
  shifts: PositionShift[],
  siteUrl: string
): string {
  function dirArrow(delta: number): string {
    return delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
  }

  function shiftColor(delta: number): string {
    const abs = Math.abs(delta);
    if (abs >= 25) return "#ef4444";
    if (abs >= 15) return "#f59e0b";
    return "#00B4FF";
  }

  const cards = shifts
    .map((shift) => {
      const focusDelta   = Math.round(shift.new_focus   - shift.old_focus);
      const segmentDelta = Math.round(shift.new_segment - shift.old_segment);
      const maxDelta     = Math.max(Math.abs(focusDelta), Math.abs(segmentDelta));
      const color        = shiftColor(maxDelta);

      return `
        <tr>
          <td style="padding:0 0 14px;">
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#03030c;border:1px solid #152415;border-left:3px solid ${color};border-radius:10px;">
              <tr>
                <td style="padding:14px 16px;">
                  <div style="font-size:14px;font-weight:600;color:#e2e8f0;margin-bottom:8px;">
                    ${shift.competitor_name}
                  </div>
                  <table cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
                    <tr>
                      <td style="padding:2px 12px 2px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#475569;">
                        Market Focus
                      </td>
                      <td style="padding:2px 0;font-size:12px;color:${shiftColor(focusDelta)};">
                        ${Math.round(shift.old_focus)} → ${Math.round(shift.new_focus)}
                        <span style="font-weight:700;">&thinsp;${dirArrow(focusDelta)}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:2px 12px 2px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#475569;">
                        Customer Segment
                      </td>
                      <td style="padding:2px 0;font-size:12px;color:${shiftColor(segmentDelta)};">
                        ${Math.round(shift.old_segment)} → ${Math.round(shift.new_segment)}
                        <span style="font-weight:700;">&thinsp;${dirArrow(segmentDelta)}</span>
                      </td>
                    </tr>
                  </table>
                  ${shift.rationale ? `<div style="font-size:12px;color:#64748b;line-height:1.6;">${shift.rationale}</div>` : ""}
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#000002;font-family:Inter,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:48px 24px;">
      <table width="560" cellpadding="0" cellspacing="0"
        style="background:#020208;border:1px solid #152415;border-radius:16px;overflow:hidden;">

        <tr>
          <td style="padding:28px 32px 24px;border-bottom:1px solid #0d1020;">
            <div style="margin-bottom:4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.22em;color:rgba(0,180,255,0.50);">
              Metrivant · Market Map
            </div>
            <h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;">
              Competitor repositioning detected
            </h1>
            <p style="margin:8px 0 0;font-size:13px;color:#64748b;line-height:1.5;">
              ${shifts.length} competitor${shifts.length !== 1 ? "s have" : " has"} shifted
              position on the market map by more than ${15} points.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${cards}
            </table>
            <a href="${siteUrl}/app/market-map"
              style="display:inline-block;margin-top:8px;padding:12px 24px;background:#00B4FF;color:#000002;font-size:13px;font-weight:700;text-decoration:none;border-radius:8px;">
              View Market Map →
            </a>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 32px;border-top:1px solid #0d1020;">
            <p style="margin:0;font-size:11px;color:#334155;">
              Metrivant · competitive intelligence radar · positioning updated daily
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
