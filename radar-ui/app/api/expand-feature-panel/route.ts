import { NextResponse } from "next/server";
import OpenAI from "openai";

// ── Types ──────────────────────────────────────────────────────────────────────

export type FeatureStep = {
  step: string;
  detail: string;
};

export type FeatureExpandedContent = {
  overview: string;
  how_it_works: FeatureStep[];
  example: string;
  user_benefit: string;
};

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  let panelId: string | undefined;
  let prompt: string | undefined;
  try {
    ({ panelId, prompt } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!panelId || !prompt) {
    return NextResponse.json({ error: "panelId and prompt are required" }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey });

  const systemPrompt = `You are a product educator inside Metrivant, a real-time competitive intelligence radar.

Your role is to explain Metrivant's internal features clearly and engagingly to users.

Always return a JSON object with exactly these fields:
{
  "overview": "2–3 sentences explaining what this feature does and why it exists",
  "how_it_works": [
    { "step": "Step label (e.g. '1. Crawl')", "detail": "one clear sentence explaining this step" }
  ],
  "example": "A concrete, specific example using realistic company/signal data — trace a real scenario through this feature",
  "user_benefit": "One clear sentence explaining how understanding this feature helps the user get more value from Metrivant"
}

Rules:
- how_it_works must have 3–5 steps, each step label short (max 4 words)
- Keep all text concise — this renders inside a compact UI panel
- example must be specific and grounded — use realistic signal types like pricing_strategy_shift, product_expansion, market_reposition
- Return ONLY valid JSON, no markdown fences, no explanation text
- Tone: technically accurate but approachable — a smart user who is not an engineer`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.20,
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed: FeatureExpandedContent = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[expand-feature-panel] OpenAI error:", err);
    return NextResponse.json({ error: "Failed to generate expansion" }, { status: 500 });
  }
}
