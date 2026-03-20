-- Migration 059: Correct monitored_page URLs
-- Fixes: blocked (missing www.), unresolved (wrong paths), non-existent pages
-- Run in Supabase SQL Editor

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- CHIME — all blocked, domain needs www.
-- ═══════════════════════════════════════════════════════════════════

UPDATE monitored_pages SET url = 'https://www.chime.com/'
WHERE url IN ('https://chime.com', 'https://chime.com/');

UPDATE monitored_pages SET url = 'https://www.chime.com/blog/'
WHERE url IN ('https://chime.com/blog', 'https://chime.com/blog/');

UPDATE monitored_pages SET url = 'https://www.chime.com/newsroom/'
WHERE url IN ('https://chime.com/newsroom', 'https://chime.com/newsroom/');

UPDATE monitored_pages SET url = 'https://www.chime.com/careers/'
WHERE url IN ('https://chime.com/careers', 'https://chime.com/careers/');

-- Chime pricing: no traditional pricing page → closest equivalent
UPDATE monitored_pages SET url = 'https://www.chime.com/online-banking/no-fees/'
WHERE url IN ('https://chime.com/pricing', 'https://chime.com/pricing/');

-- Chime features: no /features page → closest equivalent
UPDATE monitored_pages SET url = 'https://www.chime.com/online-banking/'
WHERE url IN ('https://chime.com/features', 'https://chime.com/features/');

-- Chime changelog: does not exist (consumer banking, not dev-facing) → deactivate
UPDATE monitored_pages
SET active = false, health_state = 'blocked', auto_deactivated_reason = 'persistent_non_full_backfill'
WHERE url IN ('https://chime.com/changelog', 'https://chime.com/changelog/');

-- Reset health_state for corrected Chime pages
UPDATE monitored_pages SET health_state = 'unresolved', consecutive_fetch_failures = 0,
  consecutive_non_full_snapshots = 0, auto_deactivated_reason = NULL, active = true
WHERE url LIKE 'https://www.chime.com/%';


-- ═══════════════════════════════════════════════════════════════════
-- ADYEN — missing www. and wrong paths
-- ═══════════════════════════════════════════════════════════════════

UPDATE monitored_pages SET url = 'https://www.adyen.com/'
WHERE url IN ('https://adyen.com', 'https://adyen.com/');

UPDATE monitored_pages SET url = 'https://www.adyen.com/pricing'
WHERE url IN ('https://adyen.com/pricing', 'https://adyen.com/pricing/');

-- Adyen newsroom: /press → /press-and-media/newsroom
UPDATE monitored_pages SET url = 'https://www.adyen.com/press-and-media/newsroom'
WHERE url IN ('https://www.adyen.com/press', 'https://www.adyen.com/press-and-media');

-- Adyen careers: bare domain → careers subdomain
UPDATE monitored_pages SET url = 'https://careers.adyen.com/'
WHERE url IN ('https://adyen.com/careers', 'https://adyen.com/careers/');

-- Adyen features (bare domain variant): add www.
UPDATE monitored_pages SET url = 'https://www.adyen.com/accept-payments'
WHERE url IN ('https://adyen.com/accept-payments', 'https://adyen.com/accept-payments/');

-- Adyen changelog: old release-notes path → firmware release notes
UPDATE monitored_pages SET url = 'https://docs.adyen.com/point-of-sale/firmware-release-notes'
WHERE url = 'https://docs.adyen.com/release-notes';

-- Reset health_state for corrected Adyen pages
UPDATE monitored_pages SET health_state = 'unresolved', consecutive_fetch_failures = 0,
  consecutive_non_full_snapshots = 0, auto_deactivated_reason = NULL, active = true
WHERE url LIKE '%adyen.com%' AND health_state != 'healthy';


-- ═══════════════════════════════════════════════════════════════════
-- NUVEI — missing www. and wrong paths
-- ═══════════════════════════════════════════════════════════════════

UPDATE monitored_pages SET url = 'https://www.nuvei.com/careers'
WHERE url IN ('https://nuvei.com/careers', 'https://nuvei.com/careers/');

-- Nuvei pricing: does not exist (custom/quote-based) → deactivate
UPDATE monitored_pages
SET active = false, health_state = 'blocked', auto_deactivated_reason = 'persistent_non_full_backfill'
WHERE url IN ('https://nuvei.com/pricing', 'https://nuvei.com/pricing/');

-- Nuvei newsroom: /blog → /post-category/newsroom
UPDATE monitored_pages SET url = 'https://www.nuvei.com/post-category/newsroom'
WHERE url = 'https://www.nuvei.com/blog' AND page_type = 'newsroom';

-- Nuvei blog: bare domain → /post-category/blog
UPDATE monitored_pages SET url = 'https://www.nuvei.com/post-category/blog'
WHERE url IN ('https://nuvei.com/blog', 'https://nuvei.com/blog/') AND page_type = 'blog';

-- Reset health_state for corrected Nuvei pages
UPDATE monitored_pages SET health_state = 'unresolved', consecutive_fetch_failures = 0,
  consecutive_non_full_snapshots = 0, auto_deactivated_reason = NULL, active = true
WHERE url LIKE '%nuvei.com%' AND active = true AND health_state != 'healthy';


-- ═══════════════════════════════════════════════════════════════════
-- ROBINHOOD — wrong paths
-- ═══════════════════════════════════════════════════════════════════

UPDATE monitored_pages SET url = 'https://robinhood.com/us/en/careers/'
WHERE url IN ('https://robinhood.com/careers', 'https://robinhood.com/careers/');

-- Robinhood blog: merged into newsroom
UPDATE monitored_pages SET url = 'https://robinhood.com/us/en/newsroom/'
WHERE url IN ('https://robinhood.com/blog', 'https://robinhood.com/blog/');

-- Robinhood features: does not exist → deactivate
UPDATE monitored_pages
SET active = false, health_state = 'blocked', auto_deactivated_reason = 'persistent_non_full_backfill'
WHERE url IN ('https://robinhood.com/features', 'https://robinhood.com/features/');

-- Reset health_state for corrected Robinhood pages
UPDATE monitored_pages SET health_state = 'unresolved', consecutive_fetch_failures = 0,
  consecutive_non_full_snapshots = 0, auto_deactivated_reason = NULL, active = true
WHERE url LIKE 'https://robinhood.com/us/en/%' AND health_state != 'healthy';


-- ═══════════════════════════════════════════════════════════════════
-- STRIPE — changelog path correction
-- ═══════════════════════════════════════════════════════════════════

UPDATE monitored_pages SET url = 'https://docs.stripe.com/changelog'
WHERE url IN ('https://stripe.com/changelog', 'https://stripe.com/changelog/');

UPDATE monitored_pages SET health_state = 'unresolved', consecutive_fetch_failures = 0,
  consecutive_non_full_snapshots = 0, auto_deactivated_reason = NULL, active = true
WHERE url = 'https://docs.stripe.com/changelog';


-- ═══════════════════════════════════════════════════════════════════
-- MERCURY — changelog path correction
-- ═══════════════════════════════════════════════════════════════════

UPDATE monitored_pages SET url = 'https://mercury.com/blog/topics/product-updates'
WHERE url IN ('https://mercury.com/changelog', 'https://mercury.com/changelog/');

UPDATE monitored_pages SET health_state = 'unresolved', consecutive_fetch_failures = 0,
  consecutive_non_full_snapshots = 0, auto_deactivated_reason = NULL, active = true
WHERE url = 'https://mercury.com/blog/topics/product-updates';


-- ═══════════════════════════════════════════════════════════════════
-- AFFIRM — missing www. and wrong paths
-- ═══════════════════════════════════════════════════════════════════

UPDATE monitored_pages SET url = 'https://www.affirm.com/'
WHERE url IN ('https://affirm.com', 'https://affirm.com/');

-- Affirm pricing: /business is the merchant landing (closest to pricing)
UPDATE monitored_pages SET url = 'https://www.affirm.com/business'
WHERE url IN ('https://affirm.com/business', 'https://affirm.com/business/') AND page_type = 'pricing';

-- Affirm features: /business/solutions → same as pricing page → deactivate to avoid duplicate
UPDATE monitored_pages
SET active = false, health_state = 'blocked', auto_deactivated_reason = 'persistent_non_full_backfill'
WHERE url IN ('https://affirm.com/business/solutions', 'https://affirm.com/business/solutions/');

-- Affirm newsroom: en-ca/press → investors newsroom
UPDATE monitored_pages SET url = 'https://investors.affirm.com/news-events/newsroom/'
WHERE url IN ('https://www.affirm.com/en-ca/press', 'https://www.affirm.com/en-ca/press/');

-- Affirm careers: add www.
UPDATE monitored_pages SET url = 'https://www.affirm.com/careers'
WHERE url IN ('https://affirm.com/careers', 'https://affirm.com/careers/');

-- Reset health_state for corrected Affirm pages
UPDATE monitored_pages SET health_state = 'unresolved', consecutive_fetch_failures = 0,
  consecutive_non_full_snapshots = 0, auto_deactivated_reason = NULL, active = true
WHERE url LIKE '%affirm.com%' AND active = true AND health_state != 'healthy';


-- ═══════════════════════════════════════════════════════════════════
-- RIPPLING — missing www.
-- ═══════════════════════════════════════════════════════════════════

UPDATE monitored_pages SET url = 'https://www.rippling.com/'
WHERE url IN ('https://rippling.com', 'https://rippling.com/');

UPDATE monitored_pages SET url = 'https://www.rippling.com/pricing'
WHERE url IN ('https://rippling.com/pricing', 'https://rippling.com/pricing/');

-- Rippling features: /products#hcm → same as pricing page → deactivate to avoid duplicate
UPDATE monitored_pages
SET active = false, health_state = 'blocked', auto_deactivated_reason = 'persistent_non_full_backfill'
WHERE url IN ('https://rippling.com/products#hcm', 'https://rippling.com/products');

UPDATE monitored_pages SET url = 'https://www.rippling.com/press'
WHERE url IN ('https://rippling.com/press', 'https://rippling.com/press/');

-- Reset health_state for corrected Rippling pages
UPDATE monitored_pages SET health_state = 'unresolved', consecutive_fetch_failures = 0,
  consecutive_non_full_snapshots = 0, auto_deactivated_reason = NULL, active = true
WHERE url LIKE 'https://www.rippling.com/%' AND health_state != 'healthy';


-- ═══════════════════════════════════════════════════════════════════
-- MARQETA — pricing does not exist
-- ═══════════════════════════════════════════════════════════════════

UPDATE monitored_pages
SET active = false, health_state = 'blocked', auto_deactivated_reason = 'persistent_non_full_backfill'
WHERE url IN ('https://marqeta.com/pricing', 'https://marqeta.com/pricing/');


-- ═══════════════════════════════════════════════════════════════════
-- CHECKOUT.COM — changelog path correction
-- ═══════════════════════════════════════════════════════════════════

UPDATE monitored_pages SET url = 'https://www.checkout.com/docs/developer-resources/api/api-changes'
WHERE url IN ('https://checkout.com/changelog', 'https://checkout.com/changelog/');

UPDATE monitored_pages SET health_state = 'unresolved', consecutive_fetch_failures = 0,
  consecutive_non_full_snapshots = 0, auto_deactivated_reason = NULL, active = true
WHERE url = 'https://www.checkout.com/docs/developer-resources/api/api-changes';


-- ═══════════════════════════════════════════════════════════════════
-- BREX — changelog path correction
-- ═══════════════════════════════════════════════════════════════════

UPDATE monitored_pages SET url = 'https://www.brex.com/product-announcements'
WHERE url = 'https://www.brex.com/product-updates';

UPDATE monitored_pages SET health_state = 'unresolved', consecutive_fetch_failures = 0,
  consecutive_non_full_snapshots = 0, auto_deactivated_reason = NULL, active = true
WHERE url = 'https://www.brex.com/product-announcements';


COMMIT;
