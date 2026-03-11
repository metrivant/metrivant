import type { RadarCompetitor } from "./api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type BriefSeverity = "high" | "medium" | "low";

export type BriefMove = {
  competitor: string;
  move: string;
  severity: BriefSeverity;
};

export type BriefImplication = {
  theme: string;
  implication: string;
};

export type BriefAction = {
  action: string;
  priority: BriefSeverity;
};

export type BriefContent = {
  headline: string;
  competitors_analyzed: string[];
  major_moves: BriefMove[];
  strategic_implications: BriefImplication[];
  recommended_actions: BriefAction[];
  model?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
};

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `\
You are a senior competitive intelligence analyst for a B2B SaaS company.
Analyze competitor signals and produce a structured weekly intelligence brief.

Return valid JSON matching this exact schema — nothing else:
{
  "headline": "One concise sentence: the single most important competitive development this week",
  "competitors_analyzed": ["array of competitor names that had meaningful activity"],
  "major_moves": [
    {
      "competitor": "competitor name",
      "move": "one specific sentence describing the move",
      "severity": "high | medium | low"
    }
  ],
  "strategic_implications": [
    {
      "theme": "2–4 word theme label",
      "implication": "1–2 sentences explaining strategic significance"
    }
  ],
  "recommended_actions": [
    {
      "action": "one concrete, specific action sentence",
      "priority": "high | medium | low"
    }
  ]
}

Rules:
- Max 5 items in major_moves
- Max 3 items in strategic_implications
- Max 3 items in recommended_actions
- Be specific and actionable — never generic
- high = immediate attention required, medium = monitor closely, low = awareness only
- If no significant activity occurred, return empty arrays and a headline noting a quiet week`;

export function buildBriefUserPrompt(
  competitors: RadarCompetitor[],
  weekLabel: string
): string {
  const lines: string[] = [
    `Week of ${weekLabel}`,
    "",
    "Active competitor signals detected in the last 7 days:",
    "",
  ];

  competitors.forEach((c, i) => {
    lines.push(`${i + 1}. ${c.competitor_name}`);
    if (c.latest_movement_type) {
      lines.push(`   Movement: ${c.latest_movement_type}`);
    }
    if (c.latest_movement_confidence != null) {
      lines.push(
        `   Confidence: ${(c.latest_movement_confidence * 100).toFixed(0)}%`
      );
    }
    lines.push(`   Signals this week: ${c.signals_7d}`);
    lines.push(
      `   Momentum score: ${Number(c.momentum_score ?? 0).toFixed(1)}`
    );
    if (c.latest_movement_summary) {
      lines.push(`   Intelligence: ${c.latest_movement_summary}`);
    }
    lines.push("");
  });

  lines.push("Generate the weekly intelligence brief.");
  return lines.join("\n");
}

// ── OpenAI call ───────────────────────────────────────────────────────────────

export async function generateBrief(
  apiKey: string,
  competitors: RadarCompetitor[],
  weekLabel: string
): Promise<BriefContent> {
  const userPrompt = buildBriefUserPrompt(competitors, weekLabel);

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
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.25,
      max_tokens: 1400,
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

  let parsed: Partial<BriefContent>;
  try {
    parsed = JSON.parse(json.choices[0].message.content) as Partial<BriefContent>;
  } catch {
    throw new Error("OpenAI returned non-JSON content");
  }

  return {
    headline:
      parsed.headline ?? "No significant competitive activity detected this week.",
    competitors_analyzed: parsed.competitors_analyzed ?? [],
    major_moves: parsed.major_moves ?? [],
    strategic_implications: parsed.strategic_implications ?? [],
    recommended_actions: parsed.recommended_actions ?? [],
    model: "gpt-4o",
    prompt_tokens: json.usage?.prompt_tokens,
    completion_tokens: json.usage?.completion_tokens,
  };
}

// ── Email template ────────────────────────────────────────────────────────────

const SEVERITY_LABEL: Record<BriefSeverity, string> = {
  high: "HIGH",
  medium: "MED",
  low: "LOW",
};

const SEVERITY_COLOR: Record<BriefSeverity, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#6b7280",
};

export function buildBriefEmailHtml(
  brief: BriefContent,
  weekLabel: string,
  dashboardUrl: string
): string {
  const badge = (severity: BriefSeverity, suffix = "") =>
    `<span style="display:inline-block;background:${SEVERITY_COLOR[severity]}18;color:${SEVERITY_COLOR[severity]};font-size:10px;font-weight:700;letter-spacing:0.08em;padding:2px 7px;border-radius:99px;white-space:nowrap;">${SEVERITY_LABEL[severity]}${suffix}</span>`;

  const movesHtml = brief.major_moves
    .map(
      (m) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;vertical-align:top;">
          ${badge(m.severity)}
          <div style="margin-top:5px;font-weight:600;color:#111827;font-size:14px;">${m.competitor}</div>
          <div style="color:#4b5563;font-size:13px;line-height:1.55;margin-top:2px;">${m.move}</div>
        </td>
      </tr>`
    )
    .join("");

  const implicationsHtml = brief.strategic_implications
    .map(
      (imp) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;">
          <div style="font-weight:600;color:#111827;font-size:13px;margin-bottom:3px;">${imp.theme}</div>
          <div style="color:#4b5563;font-size:13px;line-height:1.55;">${imp.implication}</div>
        </td>
      </tr>`
    )
    .join("");

  const actionsHtml = brief.recommended_actions
    .map(
      (a) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;vertical-align:top;">
          ${badge(a.priority, " PRIORITY")}
          <div style="color:#374151;font-size:13px;line-height:1.55;margin-top:5px;">${a.action}</div>
        </td>
      </tr>`
    )
    .join("");

  const sectionHeader = (label: string) =>
    `<div style="font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#2EE6A6;margin-bottom:6px;">${label}</div>`;

  const maybeMoves =
    brief.major_moves.length > 0
      ? `<tr><td style="padding:24px 32px 0;">${sectionHeader("Major Moves")}<table width="100%" cellpadding="0" cellspacing="0">${movesHtml}</table></td></tr>`
      : "";

  const maybeImplications =
    brief.strategic_implications.length > 0
      ? `<tr><td style="padding:24px 32px 0;">${sectionHeader("Strategic Implications")}<table width="100%" cellpadding="0" cellspacing="0">${implicationsHtml}</table></td></tr>`
      : "";

  const maybeActions =
    brief.recommended_actions.length > 0
      ? `<tr><td style="padding:24px 32px 0;">${sectionHeader("Recommended Actions")}<table width="100%" cellpadding="0" cellspacing="0">${actionsHtml}</table></td></tr>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Metrivant · Intelligence Brief · ${weekLabel}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,'Inter',system-ui,sans-serif;color:#111827;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
      <!-- Header -->
      <tr>
        <td style="background:#020802;padding:22px 32px;border-bottom:1px solid #0d2010;">
          <div style="font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(46,230,166,0.65);margin-bottom:3px;">Competitive Intelligence</div>
          <div style="font-size:19px;font-weight:700;letter-spacing:0.07em;color:#ffffff;">METRIVANT</div>
          <div style="margin-top:6px;font-size:10px;color:rgba(255,255,255,0.32);letter-spacing:0.14em;text-transform:uppercase;">Intelligence Brief &middot; ${weekLabel}</div>
        </td>
      </tr>
      <!-- Headline -->
      <tr>
        <td style="padding:24px 32px;background:#fafafa;border-bottom:1px solid #e5e7eb;">
          ${sectionHeader("Summary")}
          <div style="font-size:15px;font-weight:500;color:#111827;line-height:1.6;">${brief.headline}</div>
          <div style="margin-top:10px;font-size:11px;color:#9ca3af;">
            ${brief.competitors_analyzed.length} competitor${brief.competitors_analyzed.length !== 1 ? "s" : ""} analyzed
          </div>
        </td>
      </tr>
      ${maybeMoves}
      ${maybeImplications}
      ${maybeActions}
      <!-- Footer -->
      <tr>
        <td style="padding:22px 32px;border-top:1px solid #f3f4f6;margin-top:8px;">
          <div style="font-size:11px;color:#9ca3af;line-height:1.7;">
            Generated automatically by Metrivant every Monday.<br/>
            <a href="${dashboardUrl}/app/briefs" style="color:#2EE6A6;text-decoration:none;">View all briefs in your dashboard &rarr;</a>
          </div>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
