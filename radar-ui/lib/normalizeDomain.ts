/**
 * Extracts the canonical domain (hostname only, lowercase) from any URL input.
 *
 * This is the single source of truth for domain normalization across the UI.
 * All competitor identity operations must use this function so that
 * https://linear.app, http://linear.app, and https://linear.app/pricing
 * all resolve to the same canonical key: "linear.app".
 *
 * Usage:
 *   normalizeDomain("https://linear.app/pricing") → "linear.app"
 *   normalizeDomain("http://linear.app")           → "linear.app"
 *   normalizeDomain("linear.app")                  → "linear.app"
 */
export function normalizeDomain(input: string): string {
  const withProto = input.startsWith("http") ? input : `https://${input}`;
  return new URL(withProto).hostname.toLowerCase();
}
