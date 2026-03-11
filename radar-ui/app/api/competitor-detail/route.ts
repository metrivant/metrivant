export const dynamic = "force-dynamic";

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

  const upstream = await fetch(
    `${baseUrl}/api/competitor-detail?id=${encodeURIComponent(id)}`,
    { cache: "no-store", headers }
  );

  const data = await upstream.json();
  return Response.json(data, { status: upstream.status });
}
