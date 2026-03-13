export const dynamic = "force-dynamic";

import { captureException } from "../../../lib/sentry";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ ok: false, error: "id required" }, { status: 400 });
  }

  const baseUrl =
    process.env.RADAR_API_BASE_URL ?? "https://metrivant-runtime.vercel.app";

  const secret = process.env.CRON_SECRET;
  const headers: Record<string, string> = {};
  if (secret) {
    headers["Authorization"] = `Bearer ${secret}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const upstream = await fetch(
      `${baseUrl}/api/competitor-detail?id=${encodeURIComponent(id)}`,
      { cache: "no-store", headers, signal: controller.signal }
    ).finally(() => clearTimeout(timeoutId));

    // Guard: upstream may return an HTML error page (502/503) — not valid JSON.
    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      captureException(
        new Error(`competitor-detail upstream non-JSON response: ${upstream.status}`),
        { id, status: upstream.status }
      );
      return Response.json(
        { ok: false, error: "upstream unavailable" },
        { status: 502 }
      );
    }

    const data = await upstream.json() as unknown;
    return Response.json(data, { status: upstream.status });
  } catch (err) {
    captureException(err, { route: "competitor-detail", id });
    return Response.json(
      { ok: false, error: "upstream unavailable" },
      { status: 502 }
    );
  }
}
