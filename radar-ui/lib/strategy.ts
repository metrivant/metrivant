import type { RadarCompetitor } from "./api";

// ── Pattern types ─────────────────────────────────────────────────────────────

export type PatternType =
  | "feature_convergence"
  | "pricing_competition"
  | "category_expansion"
  | "enterprise_shift"
  | "product_bundling"
  | "market_repositioning";

export type StrategicInsight = {
  pattern_type:         PatternType;
  strategic_signal:     string;   // 1-sentence cross-competitor headline
  description:          string;   // 2-3 sentence grounded context
  recommended_response: string;   // one concrete action
  confidence:           number;   // 0.0–1.0
  competitor_count:     number;
  competitors_involved: string[];
  is_major:             boolean;  // 3+ competitors OR confidence ≥ 0.82
};

export type StrategicAnalysisResult = {
  insights:          StrategicInsight[];
  model?:            string;
  prompt_tokens?:    number;
  completion_tokens?: number;
};

// ── Pattern display config ────────────────────────────────────────────────────

export type PatternConfig = {
  label:       string;
  color:       string;
  bg:          string;
  border:      string;
  description: string;
};

export const PATTERN_CONFIG: Record<PatternType, PatternConfig> = {
  feature_convergence:  {
    label: "Feature Convergence",
    color: "#57a6ff",
    bg:    "rgba(87,166,255,0.08)",
    border:"rgba(87,166,255,0.20)",
    description: "Multiple rivals shipping similar capabilities",
  },
  pricing_competition:  {
    label: "Pricing Pressure",
    color: "#ff6b6b",
    bg:    "rgba(255,107,107,0.08)",
    border:"rgba(255,107,107,0.20)",
    description: "Rivals adjusting pricing tiers or positioning",
  },
  category_expansion:   {
    label: "Category Expansion",
    color: "#34d399",
    bg:    "rgba(52,211,153,0.08)",
    border:"rgba(52,211,153,0.20)",
    description: "Rivals moving into adjacent market territory",
  },
  enterprise_shift:     {
    label: "Enterprise Shift",
    color: "#c084fc",
    bg:    "rgba(192,132,252,0.08)",
    border:"rgba(192,132,252,0.20)",
    description: "Rivals pivoting upmarket toward enterprise buyers",
  },
  product_bundling:     {
    label: "Product Bundling",
    color: "#facc15",
    bg:    "rgba(250,204,21,0.08)",
    border:"rgba(250,204,21,0.20)",
    description: "Rivals combining features to increase stickiness",
  },
  market_repositioning: {
    label: "Market Repositioning",
    color: "#f97316",
    bg:    "rgba(249,115,22,0.08)",
    border:"rgba(249,115,22,0.20)",
    description: "Rivals changing their core narrative or ICP",
  },
};

export function getPatternConfig(type: string): PatternConfig {
  return (
    PATTERN_CONFIG[type as PatternType] ?? {
      label:       type.replace(/_/g, " "),
      color:       "#94a3b8",
      bg:          "rgba(148,163,184,0.08)",
      border:      "rgba(148,163,184,0.18)",
      description: "",
    }
  );
}

export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return "High confidence";
  if (confidence >= 0.6) return "Moderate confidence";
  return "Tentative";
}

export function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "#00B4FF";
  if (confidence >= 0.6) return "#f59e0b";
  return "#64748b";
}

// ── Strategic Horizon ─────────────────────────────────────────────────────────

export type HorizonTier = "Immediate" | "Near-Term" | "Emerging";

export function getHorizon(createdAt: string, confidence: number): HorizonTier {
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  if (ageHours < 48 && confidence >= 0.70) return "Immediate";
  if (ageHours < 168 || confidence >= 0.60) return "Near-Term";
  return "Emerging";
}

export const HORIZON_STYLES: Record<HorizonTier, { color: string; bg: string; border: string }> = {
  "Immediate": { color: "#ef4444", bg: "rgba(239,68,68,0.07)",   border: "rgba(239,68,68,0.22)"   },
  "Near-Term": { color: "#f59e0b", bg: "rgba(245,158,11,0.07)",  border: "rgba(245,158,11,0.20)"  },
  "Emerging":  { color: "#64748b", bg: "rgba(100,116,139,0.06)", border: "rgba(100,116,139,0.16)" },
};

// ── OpenAI prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `\
You are a senior competitive strategist.
Your task: identify strategic patterns across competitor movements and generate specific, actionable insights.

Return ONLY valid JSON matching this exact schema — no markdown, no prose:
{
  "insights": [
    {
      "pattern_type": "feature_convergence | pricing_competition | category_expansion | enterprise_shift | product_bundling | market_repositioning",
      "strategic_signal": "One sentence naming the pattern and which specific competitors are involved",
      "description": "2-3 sentences of grounded context: what competitors did, what it signals about market direction, and why it matters to your company",
      "recommended_response": "One concrete, specific action sentence for your company — not generic advice",
      "confidence": 0.0-1.0,
      "competitor_count": 2,
      "competitors_involved": ["CompetitorA", "CompetitorB"],
      "is_major": true
    }
  ]
}

HARD RULES — violating these will cause the response to be rejected:
- Base all analysis strictly on the provided signal data — do not apply general knowledge about these companies' histories, backgrounds, or prior strategies
- Only include patterns involving 2 or more competitors showing similar behavior
- Every strategic_signal must name the specific competitors by name
- Every recommended_response must be concrete — never say "consider monitoring" or "keep an eye on"
- is_major = true only when competitor_count >= 3 OR confidence >= 0.82
- Max 5 insights total
- If no cross-competitor patterns exist, return {"insights": []}
- confidence reflects how clearly the provided signal evidence supports the pattern claim`;

export function buildStrategyUserPrompt(
  competitors: RadarCompetitor[],
  analysisDate: string,
  sector?: string
): string {
  // Only include competitors with real movement signals
  const active = competitors.filter(
    (c) => c.latest_movement_type || Number(c.signals_7d) > 0
  );

  if (active.length === 0) {
    return "No competitor movement detected in the analysis window.";
  }

  const lines: string[] = [
    `Strategic analysis as of ${analysisDate}`,
    ...(sector ? [`Sector context: ${sector}`] : []),
    `${active.length} competitors with movement activity in the last 30 days`,
    "",
    "COMPETITOR MOVEMENTS (sorted by momentum)",
    "",
  ];

  // Sort highest momentum first
  const sorted = [...active].sort(
    (a, b) => Number(b.momentum_score ?? 0) - Number(a.momentum_score ?? 0)
  );

  sorted.forEach((c, i) => {
    lines.push(`${i + 1}. ${c.competitor_name} (momentum: ${Number(c.momentum_score ?? 0).toFixed(1)})`);
    if (c.latest_movement_type) {
      lines.push(`   Movement type: ${c.latest_movement_type.replace(/_/g, " ")}`);
    }
    if (c.latest_movement_confidence != null) {
      lines.push(`   Movement confidence: ${(c.latest_movement_confidence * 100).toFixed(0)}%`);
    }
    lines.push(`   Signals detected: ${c.signals_7d} in 7d`);
    if (c.latest_movement_summary) {
      lines.push(`   Intelligence: ${c.latest_movement_summary}`);
    }
    lines.push("");
  });

  // Signal clusters: group by movement_type
  const clusters = new Map<string, string[]>();
  for (const c of sorted) {
    if (!c.latest_movement_type) continue;
    const list = clusters.get(c.latest_movement_type) ?? [];
    list.push(c.competitor_name);
    clusters.set(c.latest_movement_type, list);
  }

  if (clusters.size > 0) {
    lines.push("CROSS-COMPETITOR SIGNAL CLUSTERS");
    lines.push("");
    for (const [type, names] of clusters.entries()) {
      const label = type.replace(/_/g, " ");
      lines.push(`• ${label}: ${names.join(", ")} (${names.length} rival${names.length !== 1 ? "s" : ""})`);
    }
    lines.push("");
  }

  lines.push("Identify cross-competitor strategic patterns from the above data.");
  lines.push("Generate only patterns supported by at least 2 competitors.");

  return lines.join("\n");
}

// ── OpenAI call ───────────────────────────────────────────────────────────────

export async function generateStrategicAnalysis(
  apiKey: string,
  competitors: RadarCompetitor[],
  analysisDate: string,
  sector?: string
): Promise<StrategicAnalysisResult> {
  const userPrompt = buildStrategyUserPrompt(competitors, analysisDate, sector);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,   // low temperature — deterministic pattern detection
      max_tokens: 1800,
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

  let parsed: { insights?: unknown[] };
  try {
    parsed = JSON.parse(json.choices[0].message.content) as { insights?: unknown[] };
  } catch {
    throw new Error("OpenAI returned non-JSON content");
  }

  const rawInsights = Array.isArray(parsed.insights) ? parsed.insights : [];

  const insights: StrategicInsight[] = rawInsights
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      pattern_type:         (item.pattern_type as PatternType) ?? "feature_convergence",
      strategic_signal:     String(item.strategic_signal ?? ""),
      description:          String(item.description ?? ""),
      recommended_response: String(item.recommended_response ?? ""),
      confidence:           Math.max(0, Math.min(1, Number(item.confidence ?? 0))),
      competitor_count:     Number(item.competitor_count ?? 0),
      competitors_involved: Array.isArray(item.competitors_involved)
        ? (item.competitors_involved as unknown[]).map(String)
        : [],
      is_major:             Boolean(item.is_major),
    }))
    .filter((i) => i.strategic_signal && i.description && i.recommended_response);

  return {
    insights,
    model:             "gpt-4o",
    prompt_tokens:     json.usage?.prompt_tokens,
    completion_tokens: json.usage?.completion_tokens,
  };
}

// ── Email template ────────────────────────────────────────────────────────────

export function buildStrategyAlertEmailHtml(
  insights: StrategicInsight[],
  siteUrl: string
): string {
  const majorInsights = insights.filter((i) => i.is_major);
  const displayInsights = majorInsights.length > 0 ? majorInsights : insights.slice(0, 2);

  const insightCards = displayInsights
    .map((insight) => {
      const cfg = getPatternConfig(insight.pattern_type);
      return `
        <tr>
          <td style="padding:0 0 16px;">
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#03030c;border:1px solid #152415;border-left:3px solid ${cfg.color};border-radius:10px;overflow:hidden;">
              <tr>
                <td style="padding:16px 18px;">
                  <div style="margin-bottom:6px;">
                    <span style="display:inline-block;background:${cfg.bg};color:${cfg.color};font-size:10px;font-weight:700;letter-spacing:0.10em;text-transform:uppercase;padding:2px 8px;border-radius:99px;">
                      ${cfg.label}
                    </span>
                  </div>
                  <div style="font-size:14px;font-weight:600;color:#e2e8f0;line-height:1.45;margin-bottom:8px;">
                    ${insight.strategic_signal}
                  </div>
                  <div style="font-size:13px;color:#64748b;line-height:1.6;margin-bottom:10px;">
                    ${insight.description}
                  </div>
                  <div style="background:#071507;border:1px solid #152415;border-radius:8px;padding:10px 14px;">
                    <div style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(0,180,255,0.50);margin-bottom:4px;">
                      Recommended Response
                    </div>
                    <div style="font-size:13px;color:#c1e8d0;line-height:1.55;">
                      ${insight.recommended_response}
                    </div>
                  </div>
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
      <table width="580" cellpadding="0" cellspacing="0"
        style="background:#020208;border:1px solid #152415;border-radius:16px;overflow:hidden;">

        <tr>
          <td style="padding:28px 32px 24px;border-bottom:1px solid #0d1020;">
            <div style="margin-bottom:4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.22em;color:rgba(0,180,255,0.50);">
              Metrivant · Strategic Intelligence
            </div>
            <h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;line-height:1.25;">
              Market pattern${displayInsights.length > 1 ? "s" : ""} detected
            </h1>
            <p style="margin:8px 0 0;font-size:13px;color:#64748b;line-height:1.5;">
              ${displayInsights.length} strategic pattern${displayInsights.length !== 1 ? "s" : ""} identified across your monitored competitors.
              Review and respond before the window closes.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${insightCards}
            </table>

            <a href="${siteUrl}/app/strategy"
              style="display:inline-block;margin-top:8px;padding:12px 24px;background:#00B4FF;color:#000002;font-size:13px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.02em;">
              View Full Strategy Analysis →
            </a>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 32px;border-top:1px solid #0d1020;">
            <p style="margin:0;font-size:11px;color:#334155;">
              Metrivant · competitive intelligence radar · updated daily
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
