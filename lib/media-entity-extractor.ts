// Extract company names from media article titles using GPT-4o-mini.
//
// Batch processes up to 50 titles in a single API call.
// Returns deduplicated company names with the titles they appeared in.

import { openai } from "./openai";

const SYSTEM_PROMPT = `You are a named entity recognition system specializing in company names.

Given a list of news article titles, extract all company/organization names mentioned.

Rules:
- Only extract company names, not people, products, or technologies
- Normalize names: "Apple Inc." → "Apple", "Amazon.com" → "Amazon"
- Include both public and private companies
- Exclude government agencies, universities, and non-profits
- Exclude generic terms that aren't specific companies
- Return a JSON object: { "entities": [{ "name": "CompanyName", "indices": [0, 3, 7] }] }
  where indices are the 0-based positions of the titles where this company appeared
- If no companies found, return { "entities": [] }`;

export interface ExtractedEntity {
  name: string;
  titleIndices: number[];
}

/**
 * Extract company names from a batch of article titles.
 */
export async function extractCompanyEntities(
  titles: string[],
): Promise<ExtractedEntity[]> {
  if (titles.length === 0) return [];

  const numberedTitles = titles.map((t, i) => `${i}. ${t}`).join("\n");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.05,
      max_tokens: 1000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Extract company names from these ${titles.length} article titles:\n\n${numberedTitles}` },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim() ?? "{}";
    const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();

    const parsed = JSON.parse(cleaned) as { entities?: { name: string; indices: number[] }[] };
    if (!parsed.entities || !Array.isArray(parsed.entities)) return [];

    return parsed.entities.map((e) => ({
      name: e.name,
      titleIndices: Array.isArray(e.indices) ? e.indices : [],
    }));
  } catch {
    return [];
  }
}
