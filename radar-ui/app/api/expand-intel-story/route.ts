import { NextResponse } from "next/server";
import OpenAI from "openai";

// ── Types ──────────────────────────────────────────────────────────────────────

export type TimelineEvent = {
  year: string;
  event: string;
  type: "warning" | "missed" | "collapse" | "lesson";
};

export type ExpandedContent = {
  overview: string;
  timeline: TimelineEvent[];
  missed_signals: string[];
  metrivant_would_detect: string;
  takeaway: string;
};

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  let storyId: string | undefined;
  let prompt: string | undefined;
  try {
    ({ storyId, prompt } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!storyId || !prompt) {
    return NextResponse.json({ error: "storyId and prompt are required" }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey });

  const systemPrompt = `You are a competitive intelligence historian and educator inside Metrivant, a real-time competitor monitoring platform.

Your role is to produce structured, visually-organized educational content about historical competitive intelligence failures.

Always return a JSON object with exactly these fields:
{
  "overview": "2–3 sentence summary of what happened and why it matters for competitive intelligence",
  "timeline": [
    { "year": "YYYY", "event": "brief description", "type": "warning|missed|collapse|lesson" }
  ],
  "missed_signals": ["signal 1", "signal 2", "signal 3", "signal 4", "signal 5"],
  "metrivant_would_detect": "2–3 sentences describing which specific signals Metrivant's monitoring system would have flagged — be concrete about page types (pricing pages, changelog, hiring pages, press releases) and signal types (pricing_strategy_shift, product_expansion, market_reposition)",
  "takeaway": "One punchy sentence connecting this story to why early signal detection matters today"
}

Rules:
- timeline must have 5–8 events, ordered chronologically
- timeline type values: "warning" (early signal), "missed" (ignored signal), "collapse" (consequence), "lesson" (key learning)
- missed_signals must be exactly 5 items, each a concrete specific signal (not vague)
- metrivant_would_detect must reference real Metrivant signal types: pricing_strategy_shift, product_expansion, market_reposition, feature_launch, positioning_shift, hiring_surge
- Keep all text concise — this renders inside a UI panel, not a document
- Return ONLY valid JSON, no markdown fences, no explanation text`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.25,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed: ExpandedContent = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[expand-intel-story] OpenAI error:", err);
    return NextResponse.json({ error: "Failed to generate expansion" }, { status: 500 });
  }
}
