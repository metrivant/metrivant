# Signal Review Workflow

Internal operator guide for the 30-day observation period.

## Purpose

Label detected signals to measure pipeline noise rate and calibrate confidence thresholds.
Reviews are stored in `signal_feedback` and never reach the frontend or public APIs.

## Steps

1. **When to review** — During weekly brief prep, or any time you have 10 minutes.
   Target: review at least 80% of signals from the past 7 days.

2. **Find signals to review** — Use Supabase dashboard:
   - Table: `signals`
   - Filter: `created_at > now() - interval '7 days'`
   - Optionally join with `signal_feedback` to find unreviewed rows (no matching `signal_id`)

3. **Record your verdict** — Insert or update a row in `signal_feedback`:
   ```sql
   INSERT INTO signal_feedback (signal_id, verdict, noise_category, notes)
   VALUES ('<uuid>', 'noise', 'cookie_banner', 'extracted consent banner text')
   ON CONFLICT (signal_id) DO UPDATE
     SET verdict = EXCLUDED.verdict,
         noise_category = EXCLUDED.noise_category,
         notes = EXCLUDED.notes,
         updated_at = now();
   ```

4. **Verdict values**
   - `valid` — genuine competitor change with competitive intelligence
   - `noise` — spurious change with no intelligence value (add `noise_category`)
   - `uncertain` — ambiguous; requires more context or a second look

5. **noise_category** — Free-text. Common values:
   - `formatting` — whitespace or HTML structure only
   - `cookie_banner` — consent/GDPR notice text
   - `tracking_params` — UTM params, pixels, analytics tokens
   - `marketing_copy` — A/B test variants, seasonal copy rotation
   - `legal_boilerplate` — terms, privacy policy, disclaimer text
   - `script_injection` — third-party script tags or inline JS
   - `cdn_artifacts` — cache busting hashes, versioned asset paths
   - `false_structure` — section rule matched the wrong DOM element
   - `other` — anything else; add a note

## Diagnostics

Run queries from `sql/observability-queries.sql` (Signal feedback section) in the
Supabase SQL editor to track:

- **Feedback coverage** — what % of signals have been reviewed
- **Verdict distribution** — ratio of valid vs noise vs uncertain
- **Noise categories** — which categories are most common
- **Noise rate by section type** — which extraction rules produce the most noise
- **Noise rate by page** — which competitor pages are most noisy
- **Noise rate over time** — is the pipeline getting cleaner?

## Using results

After the 30-day period:
- High noise rates on a section_type → raise confidence threshold or tighten the extraction rule
- Recurring noise_category → consider adding it to the noise detection layer in `detect-signals.ts`
- Low feedback coverage → expand review cadence before drawing conclusions
