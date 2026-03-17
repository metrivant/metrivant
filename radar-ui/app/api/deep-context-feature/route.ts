import { NextResponse } from "next/server";
import OpenAI from "openai";

// ── Types ──────────────────────────────────────────────────────────────────────

export type HistoricalEra = {
  era: string;    // e.g. "1500s — Venetian Merchants"
  title: string;  // e.g. "The Spice Route Intelligence Network"
  story: string;  // 1–2 sentences: what they did, what the signal was
  signal: string; // the specific "signal" or intelligence act in that era (short phrase)
};

export type DeepContextContent = {
  hook: string;                       // 1 sentence — the timeless pattern
  historical_thread: HistoricalEra[]; // 3–4 eras, oldest to newest
  pattern: string;                    // 1–2 sentences: what connects all examples
  metrivant_connection: string;       // 1–2 sentences: how Metrivant operationalizes this today
};

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  let panelId: string | undefined;
  let prompt: string | undefined;
  let featureName: string | undefined;
  try {
    ({ panelId, prompt, featureName } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!panelId || !prompt) {
    return NextResponse.json({ error: "panelId and prompt are required" }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey });

  const systemPrompt = `You are an intelligence historian inside Metrivant, a competitive intelligence radar.

Your role is to reveal the deep historical roots of competitive intelligence concepts — showing users that the pattern behind a modern software feature has existed for centuries.

You write for a thoughtful, curious reader. Not academic. Not game-like. Think: field intelligence brief, annotated map, historian's notebook.

Always return a JSON object with exactly these fields:
{
  "hook": "One sentence that names the timeless pattern. E.g.: 'Competitive advantage has always belonged to those who detected movement before it became visible.'",
  "historical_thread": [
    {
      "era": "Short era label — period + actor. E.g.: '13th century — Mongol Empire'",
      "title": "Short evocative title for this example. E.g.: 'The Yam Postal Network'",
      "story": "1–2 sentences: what they did and what strategic advantage it produced. Be specific and grounded.",
      "signal": "The specific intelligence act or signal in that era — a short phrase. E.g.: 'position reports every 25 miles'"
    }
  ],
  "pattern": "1–2 sentences: the structural logic that connects all eras. What is the underlying truth about information, timing, and competitive advantage?",
  "metrivant_connection": "1–2 sentences: how Metrivant operationalizes this exact pattern today, referencing the specific feature."
}

Rules:
- historical_thread must contain exactly 3 entries, ordered from oldest to most recent
- Eras must span at least 500 years of history — do not cluster in one period
- Each entry must be specific: name real actors, places, or systems — not generic abstractions
- The 'signal' field must be a concrete, short phrase — what the actual intelligence act was
- metrivant_connection must name the specific Metrivant feature being explained
- Tone: calm authority — like an analyst who has read too much military history
- Return ONLY valid JSON, no markdown fences, no explanation text`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.25,
      max_tokens: 800,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: `Feature: ${featureName ?? panelId}\n\n${prompt}` },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed: DeepContextContent = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[deep-context-feature] OpenAI error:", err);
    return NextResponse.json({ error: "Failed to generate deep context" }, { status: 500 });
  }
}
