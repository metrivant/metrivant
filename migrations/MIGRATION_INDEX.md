# Migration Index

This document tracks the canonical migration sequence and clarifies duplicate migration numbers that occurred during development.

## Canonical Migration Sequence

| Number | File | Applied | Description |
|--------|------|---------|-------------|
| 060 | fix_all_issues_APPLY_THIS.sql | 2026-03 | Complete system repair (pool signals, ancient signals, pressure index) |
| 061 | sector_baselines.sql | 2026-03 | Sector baseline calculations |
| 062 | sector_validation.sql | 2026-03-28 | Sector validation CHECK constraint |
| 063 | noise_suppression_rules.sql | 2026-03 | Noise pattern learning system |
| 064 | competitor_suggestions.sql | 2026-03 | Automated competitor discovery from media |
| 065 | interpretation_validation.sql | 2026-03 | GPT-4o-mini interpretation validation |
| 066 | confidence_calibration.sql | 2026-03 | Statistical confidence calibration |
| 067 | movement_validation.sql | 2026-03 | GPT-4o-mini movement validation |
| 068 | autonomous_noise_detection.sql | 2026-03 | Autonomous noise detection system |
| 069 | signals_novelty_scoring.sql | **2026-03-28** | Novelty scoring (first-time vs recurring signals) |
| 070 | signal_relationships.sql | **2026-03-28** | Signal causality graph |
| 071 | weekly_briefs_validation.sql | **2026-03-28** | Weekly brief AI validation |

## Obsolete/Superseded Migrations

**Status:** Moved to `migrations/deprecated/` on 2026-03-28

These files represent earlier iterations and were superseded:

### Deprecated Files (moved 2026-03-28):
- `060_fix_stale_signal_constraints.sql` — superseded by 060_fix_all_issues.sql
- `060_fix_stale_signal_constraints_CORRECTED.sql` — superseded by 060_fix_all_issues.sql
- `069_noise_baselines.sql` — superseded by 069_signals_novelty_scoring.sql
- `070_signal_retrograde.sql` — superseded by 070_signal_relationships.sql

### Still Present (need verification):
- `061_sector_narratives_summary.sql` — superseded by sector_baselines.sql
- `062_feed_health_state.sql` — superseded by sector_validation.sql

## Migration Application Status

**All canonical migrations (060-071) are applied to production as of 2026-03-28.**

## Future Migrations

Next migration number: **072**

When creating new migrations:
1. Use the next sequential number (072, 073, etc.)
2. Add entry to this index immediately
3. Mark as `Applied: [pending]` in SQL file header
4. Update to `Applied: YYYY-MM-DD` after Supabase application
5. Update this index with applied date

## Cleanup Recommendation

Obsolete migration files can be moved to `migrations/deprecated/` to reduce clutter while preserving git history.
