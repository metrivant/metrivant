// Validates a URL before committing it to active monitoring.
// Uses HEAD first (cheap), falls back to GET on 405.

const TIMEOUT_MS           = 4000;
const MIN_CONTENT_LENGTH   = 200; // skip near-empty 200 responses

export type ValidationResult = {
  ok:     boolean;
  status: number;
  reason: string;
};

export async function validateUrl(url: string): Promise<ValidationResult> {
  const headers = {
    "User-Agent": "Mozilla/5.0 (compatible; Metrivant/1.0; +https://metrivant.com)",
  };

  async function attempt(method: "HEAD" | "GET"): Promise<Response> {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), TIMEOUT_MS);
    return fetch(url, { method, signal: controller.signal, headers, redirect: "follow" });
  }

  try {
    let res = await attempt("HEAD");

    // Some servers reject HEAD — fall back to GET
    if (res.status === 405) {
      res = await attempt("GET");
    }

    if (res.status === 200) {
      // Check content-length for near-empty responses (e.g., soft 404s)
      const contentLength = parseInt(res.headers.get("content-length") ?? "0", 10);
      if (contentLength > 0 && contentLength < MIN_CONTENT_LENGTH) {
        return { ok: false, status: res.status, reason: "content_too_short" };
      }
      return { ok: true, status: 200, reason: "ok" };
    }

    return { ok: false, status: res.status, reason: `http_${res.status}` };
  } catch (err) {
    const reason = err instanceof Error && err.name === "AbortError"
      ? "timeout"
      : "network_error";
    return { ok: false, status: 0, reason };
  }
}
