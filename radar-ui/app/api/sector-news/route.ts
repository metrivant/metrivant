import { captureException } from "../../../lib/sentry";

export const dynamic = "force-dynamic";

const SECTOR_QUERIES: Record<string, string> = {
  saas:               "B2B SaaS software competitive market",
  defense:            "defense aerospace government contract",
  energy:             "energy oil gas renewables market",
  cybersecurity:      "cybersecurity threat intelligence breach",
  fintech:            "fintech financial technology market",
  "ai-infrastructure": "artificial intelligence AI infrastructure market",
  devtools:           "developer tools software platform",
  healthcare:         "healthcare technology digital health",
  "consumer-tech":    "consumer technology product launch",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sector = searchParams.get("sector") ?? "saas";
  const q = SECTOR_QUERIES[sector] ?? "technology market intelligence";
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en&gl=US&ceid=US:en`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      captureException(new Error(`sector-news: RSS fetch failed (${res.status})`), {
        route: "sector-news", sector, status: res.status,
      });
      return Response.json({ items: [] });
    }
    const xml = await res.text();
    const matches = [...xml.matchAll(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/g)];
    const items = matches.slice(1, 7).map((m) => m[1]);
    return Response.json({ items });
  } catch (err) {
    captureException(err, { route: "sector-news", sector });
    return Response.json({ items: [] });
  }
}
