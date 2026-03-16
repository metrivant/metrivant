import type { ClusterResult, SignalCluster } from "./cluster-signals";

// ── Enrichment ────────────────────────────────────────────────────────────────
// Calls gpt-4o-mini once per cluster to refine the generic theme_label into a
// specific 2–4 word label derived from the actual signal content.
// On any error the cluster keeps its default theme_label — never throws.

async function enrichOneCluster(
  cluster: SignalCluster,
  apiKey: string
): Promise<string> {
  const snippets = cluster.signals
    .filter((s) => s.interpretation)
    .slice(0, 3)
    .map((s) => `- ${s.interpretation!}`)
    .join("\n");

  if (!snippets) return cluster.theme_label;

  const prompt = `You are labelling a group of competitor intelligence signals for a weekly brief.
Competitor: ${cluster.competitor_name}
Default category: ${cluster.theme_label}

Signal summaries:
${snippets}

Return a specific 2–4 word label that precisely names what this competitor did.
Examples: "Pricing Restructure", "API Expansion", "Enterprise Pivot", "Hiring Surge"
Return ONLY the label — no punctuation, no quotes, nothing else.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.20,
      max_tokens: 16,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}`);

  const json = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const label = json.choices[0]?.message?.content?.trim();
  if (!label || label.length > 60) return cluster.theme_label;
  return label;
}

export async function enrichClusterThemes(
  result: ClusterResult,
  apiKey: string
): Promise<ClusterResult> {
  const enriched = await Promise.all(
    result.clusters.map(async (cluster) => {
      try {
        const theme_label = await enrichOneCluster(cluster, apiKey);
        return { ...cluster, theme_label };
      } catch {
        // Fallback silently — default label is always acceptable
        return cluster;
      }
    })
  );

  return { clusters: enriched, unclustered: result.unclustered };
}
