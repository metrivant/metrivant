// ── URL safety guard ──────────────────────────────────────────────────────────
//
// Blocks HTTP requests to private, loopback, link-local, and cloud metadata
// IP addresses. Called before every outbound fetch in the runtime pipeline.
//
// Pure string matching on the parsed hostname — no DNS resolution.
// Matches the protection already present in radar-ui/app/api/onboard-competitor/route.ts.

export function isPrivateUrl(rawUrl: string): boolean {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return true; // unparseable → block
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return true;
  }

  const h = u.hostname.toLowerCase();

  // Loopback
  if (h === "localhost" || h === "0.0.0.0" || h === "::1" || h === "[::1]") {
    return true;
  }

  // .local suffix (mDNS)
  if (h.endsWith(".local")) return true;

  // 127.0.0.0/8
  if (h.startsWith("127.")) return true;

  // 10.0.0.0/8
  if (h.startsWith("10.")) return true;

  // 192.168.0.0/16
  if (h.startsWith("192.168.")) return true;

  // 172.16.0.0/12 (172.16.* through 172.31.*)
  if (h.startsWith("172.")) {
    const second = parseInt(h.split(".")[1], 10);
    if (!isNaN(second) && second >= 16 && second <= 31) return true;
  }

  // AWS/GCP/Azure metadata endpoint
  if (h === "169.254.169.254") return true;

  return false;
}
