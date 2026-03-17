// url-guard.test.ts — self-contained guard tests
// Run with: npx tsx lib/url-guard.test.ts

import assert from "node:assert/strict";
import { rejectPageUrl } from "./url-guard";

let passed = 0;
let failed = 0;

function test(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓  ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${label}`);
    console.error(`     ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

function assertReject(url: string, category: string, reason?: string) {
  const result = rejectPageUrl(url, category);
  assert.equal(result.reject, true, `expected rejection for ${url}`);
  if (reason) {
    assert.ok(
      "reason" in result && result.reason === reason,
      `expected reason "${reason}", got "${"reason" in result ? result.reason : "n/a"}" for ${url}`
    );
  }
}

function assertAllow(url: string, category: string) {
  const result = rejectPageUrl(url, category);
  assert.equal(result.reject, false, `expected allow for ${url}, got reject: ${"reason" in result ? result.reason : ""}`);
}

// ── REJECT cases ──────────────────────────────────────────────────────────────

console.log("\nREJECT — file extensions");
test("sitemap.xml → file_extension", () =>
  assertReject("https://www.klarna.com/sitemaps/careers/sitemap.xml", "careers", "file_extension"));
test("atom.xml → file_extension", () =>
  assertReject("https://example.com/news/atom.xml", "newsroom", "file_extension"));
test("data.json → file_extension", () =>
  assertReject("https://example.com/data.json", "newsroom", "file_extension"));

console.log("\nREJECT — locale-only paths");
test("/us/ → locale_only (newsroom)", () =>
  assertReject("https://www.klarna.com/us/", "newsroom", "locale_only"));
test("/uk/ → locale_only (newsroom)", () =>
  assertReject("https://example.com/uk/", "newsroom", "locale_only"));
test("/en-us/ → locale_only (newsroom)", () =>
  assertReject("https://example.com/en-us/", "newsroom", "locale_only"));

console.log("\nREJECT — non-content slugs");
test("/free-tools → non_content_slug (blog)", () =>
  assertReject("https://ramp.com/free-tools", "blog_or_articles", "non_content_slug"));
test("/vc-database → non_content_slug (newsroom)", () =>
  assertReject("https://ramp.com/vc-database", "newsroom", "non_content_slug"));
test("/demo → non_content_slug (newsroom)", () =>
  assertReject("https://example.com/demo", "newsroom", "non_content_slug"));
test("/pricing → non_content_slug (newsroom)", () =>
  assertReject("https://example.com/pricing", "newsroom", "non_content_slug"));

console.log("\nREJECT — legal pages");
test("/privacy-policy → legal_page (blog)", () =>
  assertReject("https://robinhood.com/us/en/support/articles/privacy-policy/", "blog_or_articles", "legal_page"));
test("/terms → legal_page (newsroom)", () =>
  assertReject("https://example.com/terms", "newsroom", "legal_page"));
test("/legal/notices → legal_page", () =>
  assertReject("https://example.com/legal/notices", "newsroom", "legal_page"));

console.log("\nREJECT — single posts / date paths");
test("/2025/blog-post → single_post", () =>
  assertReject("https://example.com/blog/2025/my-post", "blog_or_articles", "single_post"));
test("/2024/ year segment → single_post", () =>
  assertReject("https://example.com/news/2024/announcement", "newsroom", "single_post"));
test("slug with >5 hyphens → single_post", () =>
  assertReject("https://example.com/blog/this-is-a-very-long-article-slug-here", "blog_or_articles", "single_post"));

console.log("\nREJECT — deep blog links");
test("/business/blog/post-title → deep_link", () =>
  assertReject("https://www.affirm.com/business/blog/rush-order-tees-affirm", "blog_or_articles", "deep_link"));

console.log("\nREJECT — query strings");
test("URL with ? → query_url", () =>
  assertReject("https://example.com/newsroom?page=2", "newsroom", "query_url"));

console.log("\nREJECT — API / data endpoints");
test("/api/v1 → api_or_data", () =>
  assertReject("https://example.com/api/v1/posts", "newsroom", "api_or_data"));
test("/graphql → api_or_data", () =>
  assertReject("https://example.com/graphql", "newsroom", "api_or_data"));

console.log("\nREJECT — subdomain mismatch");
test("support.* subdomain → subdomain_mismatch (newsroom)", () =>
  assertReject("https://support.example.com/articles", "newsroom", "subdomain_mismatch"));
test("docs.* subdomain → subdomain_mismatch (newsroom)", () =>
  assertReject("https://docs.example.com/", "newsroom", "subdomain_mismatch"));

console.log("\nREJECT — invalid/shortener URLs");
test("bit.ly → invalid_url", () =>
  assertReject("https://bit.ly/3abc", "newsroom", "invalid_url"));
test("malformed URL → invalid_url", () =>
  assertReject("not-a-url", "newsroom", "invalid_url"));

// ── ALLOW cases ───────────────────────────────────────────────────────────────

console.log("\nALLOW — press / newsroom");
test("klarna international press", () =>
  assertAllow("https://www.klarna.com/international/press/", "newsroom"));
test("ramp press", () =>
  assertAllow("https://ramp.com/press", "newsroom"));
test("stripe newsroom", () =>
  assertAllow("https://stripe.com/newsroom", "newsroom"));
test("plaid press/", () =>
  assertAllow("https://plaid.com/press/", "newsroom"));
test("brex journal/press", () =>
  assertAllow("https://brex.com/journal/press", "newsroom"));

console.log("\nALLOW — blog index");
test("ramp blog", () =>
  assertAllow("https://ramp.com/blog", "blog_or_articles"));
test("stripe blog", () =>
  assertAllow("https://stripe.com/blog", "blog_or_articles"));
test("affirm blog index (2 segments)", () =>
  assertAllow("https://www.affirm.com/business/blog", "blog_or_articles"));

console.log("\nALLOW — careers");
test("klarna careers", () =>
  assertAllow("https://www.klarna.com/careers/", "careers"));
test("greenhouse ATS domain", () =>
  assertAllow("https://boards.greenhouse.io/stripe", "careers"));
test("lever ATS domain", () =>
  assertAllow("https://jobs.lever.co/brex", "careers"));
test("jobs.* subdomain", () =>
  assertAllow("https://jobs.example.com/openings", "careers"));
test("careers.* subdomain", () =>
  assertAllow("https://careers.example.com/", "careers"));

console.log("\nALLOW — changelog");
test("stripe changelog", () =>
  assertAllow("https://stripe.com/changelog", "changelog"));
test("brex changelog", () =>
  assertAllow("https://brex.com/changelog", "changelog"));

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`  ${passed} passed  |  ${failed} failed`);
console.log(`${"─".repeat(50)}\n`);

if (failed > 0) process.exit(1);
