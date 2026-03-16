import type { RadarCompetitor } from "./api";
import type { ClusterResult } from "./brief/cluster-signals";

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

export type PositioningDrift = {
  competitor_name: string;
  section_type:    "hero" | "headline";
  previous_text:   string;
  current_text:    string;
  detected_at:     string;
};

export type BriefContent = {
  headline:               string;
  competitors_analyzed:   string[];
  major_moves:            BriefMove[];
  strategic_implications: BriefImplication[];
  recommended_actions:    BriefAction[];
  closing_insight?:       string;
  sector_positioning_drift?: string;
  model?:                 string;
  prompt_tokens?:         number;
  completion_tokens?:     number;
};

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `\
You are a senior competitive intelligence analyst producing a precise, actionable weekly brief.
Your job: turn raw competitor signal data into grounded intelligence — not general commentary.

Return valid JSON matching this exact schema — nothing else:
{
  "headline": "One sentence naming the dominant competitive development this week — specific companies and actions, no hedging",
  "competitors_analyzed": ["array of competitor names that had meaningful activity"],
  "major_moves": [
    {
      "competitor": "competitor name",
      "move": "one sentence stating exactly what changed and why it matters — name the product, price, or market change specifically",
      "severity": "high | medium | low"
    }
  ],
  "strategic_implications": [
    {
      "theme": "2–4 word theme label",
      "implication": "1–2 sentences of precise causal reasoning — what this move signals about the competitor's intent and what it means for your position"
    }
  ],
  "recommended_actions": [
    {
      "action": "one concrete action sentence — name the specific thing to build, change, accelerate, or stop",
      "priority": "high | medium | low"
    }
  ]
}

Rules:
- Max 5 items in major_moves
- Max 3 items in strategic_implications
- Max 3 items in recommended_actions
- high = act this week, medium = act this month, low = awareness only
- Write only from the signal data provided — do not apply general knowledge about these companies' histories, backgrounds, or market positions
- Write like a practitioner, not a consultant — favor precise observation over hedged inference
- Never use: "it's worth noting", "it is important to", "in conclusion", "leverage", "synergy", "holistic"
- Never recommend "monitoring" as an action — recommend a decision or a build
- If no significant activity occurred, return empty arrays and a factual headline`;

export function buildBriefUserPrompt(
  competitors:      RadarCompetitor[],
  weekLabel:        string,
  clusters?:        ClusterResult,
  positioningDrift?: PositioningDrift[]
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

  // Append clustered signal detail when available — organises raw signal
  // evidence by strategic theme so the model can reason about intent rather
  // than listing diffs.
  if (clusters && clusters.clusters.length > 0) {
    lines.push("Signal themes (clustered by strategic area):", "");

    // Group clusters by theme_key so the same theme across competitors reads
    // together (e.g., all "Pricing Strategy" entries in one block).
    const byTheme = new Map<string, typeof clusters.clusters>();
    for (const cluster of clusters.clusters) {
      const existing = byTheme.get(cluster.theme_key) ?? [];
      existing.push(cluster);
      byTheme.set(cluster.theme_key, existing);
    }

    for (const [, themeClusters] of byTheme) {
      const label = themeClusters[0].theme_label;
      lines.push(`${label.toUpperCase()}`);

      for (const cluster of themeClusters) {
        const signalCount = cluster.signals.length;
        const interpretations = cluster.signals
          .filter((s) => s.interpretation)
          .slice(0, 2)
          .map((s) => `"${s.interpretation!}"`)
          .join("; ");
        const detail = interpretations ? ` — ${interpretations}` : "";
        lines.push(`  ${cluster.competitor_name}: ${signalCount} signal${signalCount !== 1 ? "s" : ""}${detail}`);
      }
      lines.push("");
    }

    if (clusters.unclustered.length > 0) {
      lines.push(`Other activity: ${clusters.unclustered.length} additional signal${clusters.unclustered.length !== 1 ? "s" : ""} (uncategorised)`, "");
    }
  }

  // Sector positioning drift — homepage messaging changes across competitors
  if (positioningDrift && positioningDrift.length > 0) {
    lines.push("Sector positioning drift (homepage messaging changes, last 30 days):", "");
    for (const d of positioningDrift.slice(0, 10)) {
      lines.push(`${d.competitor_name} [${d.section_type}]:`);
      lines.push(`  Was: ${d.previous_text.slice(0, 120)}`);
      lines.push(`  Now: ${d.current_text.slice(0, 120)}`);
      lines.push("");
    }
    lines.push(
      "If messaging trends are detectable across competitors, include a brief 'Sector Positioning Drift' observation.",
      ""
    );
  }

  lines.push("Generate the weekly intelligence brief.");
  return lines.join("\n");
}

// ── OpenAI call ───────────────────────────────────────────────────────────────

export async function generateBrief(
  apiKey:           string,
  competitors:      RadarCompetitor[],
  weekLabel:        string,
  clusters?:        ClusterResult,
  positioningDrift?: PositioningDrift[]
): Promise<BriefContent> {
  const userPrompt = buildBriefUserPrompt(competitors, weekLabel, clusters, positioningDrift);

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

// ── Daily quotes ──────────────────────────────────────────────────────────────
// Rotates by day-of-year. Same quote for all briefs sent on the same Monday.
// Sourced from strategists, leaders, scientists, and entrepreneurs.

type Quote = { text: string; attribution: string };

const DAILY_QUOTES: Quote[] = [
  { text: "If you know the enemy and know yourself, you need not fear the result of a hundred battles.", attribution: "Sun Tzu" },
  { text: "Strategy without tactics is the slowest route to victory. Tactics without strategy is the noise before defeat.", attribution: "Sun Tzu" },
  { text: "Opportunities multiply as they are seized.", attribution: "Sun Tzu" },
  { text: "In the midst of chaos, there is also opportunity.", attribution: "Sun Tzu" },
  { text: "However beautiful the strategy, you should occasionally look at the results.", attribution: "Winston Churchill" },
  { text: "The farther back you can look, the farther forward you are likely to see.", attribution: "Winston Churchill" },
  { text: "Success consists of going from failure to failure without loss of enthusiasm.", attribution: "Winston Churchill" },
  { text: "The impediment to action advances action. What stands in the way becomes the way.", attribution: "Marcus Aurelius" },
  { text: "You have power over your mind, not outside events. Realize this, and you will find strength.", attribution: "Marcus Aurelius" },
  { text: "Confine yourself to the present.", attribution: "Marcus Aurelius" },
  { text: "Waste no more time arguing what a good man should be. Be one.", attribution: "Marcus Aurelius" },
  { text: "It had long since come to my attention that people of accomplishment rarely sat back and let things happen to them.", attribution: "Leonardo da Vinci" },
  { text: "Simplicity is the ultimate sophistication.", attribution: "Leonardo da Vinci" },
  { text: "Innovation distinguishes between a leader and a follower.", attribution: "Steve Jobs" },
  { text: "Real artists ship.", attribution: "Steve Jobs" },
  { text: "The people who are crazy enough to think they can change the world are the ones who do.", attribution: "Steve Jobs" },
  { text: "The best way to predict the future is to create it.", attribution: "Peter Drucker" },
  { text: "What gets measured gets managed.", attribution: "Peter Drucker" },
  { text: "Efficiency is doing things right; effectiveness is doing the right things.", attribution: "Peter Drucker" },
  { text: "The purpose of a business is to create a customer.", attribution: "Peter Drucker" },
  { text: "An investment in knowledge pays the best interest.", attribution: "Benjamin Franklin" },
  { text: "Energy and persistence conquer all things.", attribution: "Benjamin Franklin" },
  { text: "Well done is better than well said.", attribution: "Benjamin Franklin" },
  { text: "The first method for estimating the intelligence of a ruler is to look at the men he has around him.", attribution: "Niccolò Machiavelli" },
  { text: "The wise man does at once what the fool does finally.", attribution: "Niccolò Machiavelli" },
  { text: "It is not titles that honor men, but men that honor titles.", attribution: "Niccolò Machiavelli" },
  { text: "He who has a why to live can bear almost any how.", attribution: "Friedrich Nietzsche" },
  { text: "The higher we soar, the smaller we appear to those who cannot fly.", attribution: "Friedrich Nietzsche" },
  { text: "A leader is a dealer in hope.", attribution: "Napoleon Bonaparte" },
  { text: "Take time to deliberate, but when the time for action comes, stop thinking and go in.", attribution: "Napoleon Bonaparte" },
  { text: "The battlefield is a scene of constant chaos. The winner will be the one who controls that chaos, both his own and the enemy's.", attribution: "Napoleon Bonaparte" },
  { text: "Only the paranoid survive.", attribution: "Andy Grove" },
  { text: "Success breeds complacency. Complacency breeds failure. Only the paranoid survive.", attribution: "Andy Grove" },
  { text: "Your margin is my opportunity.", attribution: "Jeff Bezos" },
  { text: "If you double the number of experiments you do per year, you're going to double your inventiveness.", attribution: "Jeff Bezos" },
  { text: "Price is what you pay. Value is what you get.", attribution: "Warren Buffett" },
  { text: "Risk comes from not knowing what you're doing.", attribution: "Warren Buffett" },
  { text: "Plans are worthless, but planning is everything.", attribution: "Dwight D. Eisenhower" },
  { text: "Change is the law of life. And those who look only to the past or present are certain to miss the future.", attribution: "John F. Kennedy" },
  { text: "The measure of intelligence is the ability to change.", attribution: "Albert Einstein" },
  { text: "Imagination is more important than knowledge.", attribution: "Albert Einstein" },
  { text: "The secret of getting ahead is getting started.", attribution: "Mark Twain" },
  { text: "Move fast. Speed is one of your main advantages over large competitors.", attribution: "Sam Altman" },
  { text: "Every battle is won before it is fought.", attribution: "Sun Tzu" },
  { text: "To know your enemy, you must become your enemy.", attribution: "Sun Tzu" },
  { text: "He who defends everything defends nothing.", attribution: "Frederick the Great" },
  { text: "Speed, surprise, and audacity are the essence of strategy.", attribution: "Carl von Clausewitz" },
  { text: "If you don't disrupt yourself, someone else will.", attribution: "Whitney Johnson" },
  { text: "The greatest victory is that which requires no battle.", attribution: "Sun Tzu" },
  { text: "Think twice before you speak, because your words and influence will plant the seed of either success or failure.", attribution: "Napoleon Hill" },
];

export function getDailyQuote(date: Date): Quote {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
}

// ── Email template ────────────────────────────────────────────────────────────

const SEVERITY_LABEL: Record<BriefSeverity, string> = {
  high:   "HIGH",
  medium: "MED",
  low:    "LOW",
};

const SEVERITY_COLOR: Record<BriefSeverity, string> = {
  high:   "#ef4444",
  medium: "#f59e0b",
  low:    "#64748b",
};

export function buildBriefEmailHtml(
  brief:       BriefContent,
  weekLabel:   string,
  dashboardUrl: string,
  date:        Date = new Date(),
): string {
  const quote = getDailyQuote(date);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const badge = (severity: BriefSeverity, suffix = "") =>
    `<span style="display:inline-block;background:${SEVERITY_COLOR[severity]}1a;color:${SEVERITY_COLOR[severity]};font-size:9px;font-weight:700;letter-spacing:0.10em;padding:2px 8px;border-radius:99px;white-space:nowrap;text-transform:uppercase;">${SEVERITY_LABEL[severity]}${suffix}</span>`;

  const sectionLabel = (text: string) =>
    `<div style="font-size:9px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#2EE6A6;margin-bottom:10px;">${text}</div>`;

  const divider = () =>
    `<tr><td style="padding:0 32px;"><div style="height:1px;background:linear-gradient(90deg,transparent,#e2e8f0 20%,#e2e8f0 80%,transparent);"></div></td></tr>`;

  // ── Major Moves ────────────────────────────────────────────────────────────
  const movesHtml = brief.major_moves.map((m) => `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #f1f5f9;vertical-align:top;">
        <table cellpadding="0" cellspacing="0" width="100%"><tr>
          <td style="vertical-align:top;padding-right:12px;width:4px;">
            <div style="width:3px;height:100%;min-height:40px;border-radius:2px;background:${SEVERITY_COLOR[m.severity]};opacity:0.7;"></div>
          </td>
          <td style="vertical-align:top;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              ${badge(m.severity)}
              <span style="font-weight:700;color:#0f172a;font-size:13px;">${m.competitor}</span>
            </div>
            <div style="color:#334155;font-size:13px;line-height:1.60;">${m.move}</div>
          </td>
        </tr></table>
      </td>
    </tr>`).join("");

  // ── Strategic Implications ─────────────────────────────────────────────────
  const implicationsHtml = brief.strategic_implications.map((imp) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
        <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#475569;margin-bottom:4px;">${imp.theme}</div>
        <div style="color:#334155;font-size:13px;line-height:1.60;">${imp.implication}</div>
      </td>
    </tr>`).join("");

  // ── Recommended Actions ────────────────────────────────────────────────────
  const actionsHtml = brief.recommended_actions.map((a) => `
    <tr>
      <td style="padding:11px 0;border-bottom:1px solid #f1f5f9;vertical-align:top;">
        ${badge(a.priority, " PRIORITY")}
        <div style="color:#334155;font-size:13px;line-height:1.60;margin-top:6px;">${a.action}</div>
      </td>
    </tr>`).join("");

  // ── Conditional sections ───────────────────────────────────────────────────
  const maybeMoves = brief.major_moves.length > 0 ? `
    ${divider()}
    <tr><td style="padding:24px 32px 0;">
      ${sectionLabel("Major Moves")}
      <table width="100%" cellpadding="0" cellspacing="0">${movesHtml}</table>
    </td></tr>` : "";

  const maybeImplications = brief.strategic_implications.length > 0 ? `
    ${divider()}
    <tr><td style="padding:24px 32px 0;">
      ${sectionLabel("Strategic Implications")}
      <table width="100%" cellpadding="0" cellspacing="0">${implicationsHtml}</table>
    </td></tr>` : "";

  const maybeActions = brief.recommended_actions.length > 0 ? `
    ${divider()}
    <tr><td style="padding:24px 32px 0;">
      ${sectionLabel("Recommended Actions")}
      <table width="100%" cellpadding="0" cellspacing="0">${actionsHtml}</table>
    </td></tr>` : "";

  const maybeClosingInsight = brief.closing_insight ? `
    ${divider()}
    <tr><td style="padding:20px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="border-left:3px solid #f59e0b;padding-left:14px;">
          <div style="font-size:9px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#d97706;margin-bottom:5px;">&#9888; Strategic Insight</div>
          <div style="color:#1e293b;font-size:13px;line-height:1.65;font-style:italic;">${brief.closing_insight}</div>
        </td>
      </tr></table>
    </td></tr>` : "";

  // ── Radar SVG decoration (header accent — degrades gracefully in Outlook) ──
  const radarSvg = `<svg width="64" height="64" viewBox="0 0 64 64" style="display:block;" aria-hidden="true">
    <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(46,230,166,0.15)" stroke-width="1"/>
    <circle cx="32" cy="32" r="20" fill="none" stroke="rgba(46,230,166,0.18)" stroke-width="1"/>
    <circle cx="32" cy="32" r="12" fill="none" stroke="rgba(46,230,166,0.22)" stroke-width="1"/>
    <line x1="32" y1="4"  x2="32" y2="60" stroke="rgba(46,230,166,0.10)" stroke-width="0.8"/>
    <line x1="4"  y1="32" x2="60" y2="32" stroke="rgba(46,230,166,0.10)" stroke-width="0.8"/>
    <circle cx="32" cy="32" r="2.5" fill="rgba(46,230,166,0.55)"/>
    <circle cx="44" cy="22" r="2" fill="#ef4444" fill-opacity="0.70"/>
    <circle cx="24" cy="38" r="1.5" fill="#f59e0b" fill-opacity="0.65"/>
    <circle cx="50" cy="36" r="1" fill="rgba(46,230,166,0.50)"/>
  </svg>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Metrivant &middot; Intelligence Brief &middot; ${weekLabel}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,'Inter',system-ui,sans-serif;color:#0f172a;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:36px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;border:1px solid #cbd5e1;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

      <!-- ── Dark header ──────────────────────────────────────────────── -->
      <tr>
        <td style="background:#030c06;padding:24px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;">
              <div style="font-size:9px;font-weight:700;letter-spacing:0.26em;text-transform:uppercase;color:rgba(46,230,166,0.60);margin-bottom:4px;">Competitive Intelligence</div>
              <div style="font-size:22px;font-weight:800;letter-spacing:0.08em;color:#ffffff;line-height:1;">METRIVANT</div>
              <div style="margin-top:7px;font-size:9px;color:rgba(255,255,255,0.28);letter-spacing:0.18em;text-transform:uppercase;">Intelligence Brief &middot; ${weekLabel}</div>
            </td>
            <td style="text-align:right;vertical-align:middle;padding-left:16px;">
              ${radarSvg}
            </td>
          </tr></table>
        </td>
      </tr>

      <!-- ── Quote of the Day ─────────────────────────────────────────── -->
      <tr>
        <td style="padding:0 32px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="border-left:3px solid rgba(46,230,166,0.55);padding:16px 0 16px 16px;margin:20px 0;">
              <div style="font-size:9px;font-weight:700;letter-spacing:0.20em;text-transform:uppercase;color:#2EE6A6;margin-bottom:7px;">Intelligence Quote</div>
              <div style="font-size:14px;color:#1e293b;line-height:1.65;font-style:italic;">&ldquo;${quote.text}&rdquo;</div>
              <div style="margin-top:7px;font-size:11px;color:#64748b;font-weight:500;">&mdash; ${quote.attribution}</div>
            </td>
          </tr></table>
        </td>
      </tr>

      <!-- ── Situation summary ────────────────────────────────────────── -->
      ${divider()}
      <tr>
        <td style="padding:22px 32px 20px;">
          ${sectionLabel("Situation")}
          <div style="font-size:16px;font-weight:600;color:#0f172a;line-height:1.55;">${brief.headline}</div>
          ${brief.competitors_analyzed.length > 0 ? `<div style="margin-top:10px;font-size:11px;color:#94a3b8;letter-spacing:0.04em;">${brief.competitors_analyzed.join(" &middot; ")}</div>` : ""}
        </td>
      </tr>

      ${maybeMoves}
      ${maybeImplications}
      ${maybeActions}
      ${maybeClosingInsight}

      <!-- ── Footer ──────────────────────────────────────────────────── -->
      <tr>
        <td style="padding:20px 32px 24px;border-top:1px solid #f1f5f9;margin-top:8px;">
          <div style="font-size:11px;color:#94a3b8;line-height:1.75;">
            Generated by Metrivant every Monday &mdash; your weekly competitive intelligence dispatch.<br/>
            <a href="${dashboardUrl}/app/briefs" style="color:#2EE6A6;text-decoration:none;font-weight:500;">View all briefs in your dashboard &rarr;</a>
          </div>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}
