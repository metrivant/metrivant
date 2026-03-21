// AI-powered URL resolution for stuck coverage health issues.
//
// When heal-coverage's heuristic approach fails (template URLs + link discovery),
// this module uses GPT-4o-mini to suggest alternative URLs based on:
//   - Competitor name and domain
//   - Page type (pricing, blog, careers, etc.)
//   - The broken URL that was being monitored
//
// GPT suggests 3-5 candidate URLs. Each is validated before use.
// Temperature 0.10 — we want deterministic URL guessing, not creativity.

import { openai } from "./openai";

const SYSTEM_PROMPT = `You are a web analyst specializing in competitor website structures.

Given a competitor's domain and a page type that is no longer accessible at its current URL, suggest 3-5 alternative URLs where this content likely lives now.

Rules:
- All URLs must use the same domain as provided
- Use HTTPS
- Suggest the most common URL patterns for this page type across modern SaaS/enterprise websites
- Include variations: /pricing, /pricing/plans, /plans-and-pricing, etc.
- For careers: include /careers, /jobs, /join, /about/careers
- For blogs: include /blog, /insights, /resources, /news
- For changelogs: include /changelog, /updates, /releases, /whats-new
- Return ONLY a JSON array of URL strings, nothing else
- Do not include query parameters or anchors`;

export interface AiUrlSuggestion {
  urls: string[];
}

/**
 * Use GPT-4o-mini to suggest alternative URLs for a broken page.
 */
export async function suggestAlternativeUrls(
  domain: string,
  pageType: string,
  brokenUrl: string,
): Promise<AiUrlSuggestion> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.10,
      max_tokens: 300,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Domain: ${domain}\nPage type: ${pageType}\nBroken URL: ${brokenUrl}\n\nSuggest 3-5 alternative URLs as a JSON array.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim() ?? "[]";

    // Parse JSON array from response (handle markdown code blocks)
    const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const urls = JSON.parse(cleaned) as string[];

    if (!Array.isArray(urls)) return { urls: [] };

    // Validate: must be same domain, must be valid URLs
    const domainHost = new URL(domain).hostname;
    const valid = urls.filter((u) => {
      try {
        const parsed = new URL(u);
        return parsed.hostname === domainHost && parsed.protocol === "https:";
      } catch {
        return false;
      }
    });

    return { urls: valid.slice(0, 5) };
  } catch {
    return { urls: [] };
  }
}

/**
 * Analyze a degraded page and decide whether to reset its baseline or repair its URL.
 *
 * Returns "reset_baseline" if the page structure legitimately changed (redesign),
 * or "needs_repair" if the content is too thin to be useful.
 */
export async function analyzeDegradedPage(
  domain: string,
  pageType: string,
  currentUrl: string,
  sectionCount: number,
  avgContentLength: number,
): Promise<"reset_baseline" | "needs_repair"> {
  // Simple heuristic: if sections exist and have content, it's a legitimate redesign.
  // If sections are nearly empty, the page structure broke.
  if (sectionCount >= 3 && avgContentLength >= 100) {
    return "reset_baseline";
  }
  return "needs_repair";
}
