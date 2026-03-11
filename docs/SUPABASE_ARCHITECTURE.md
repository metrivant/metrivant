
METRIVANT — FULL SYSTEM & SUPABASE HANDOFF

PROJECT PURPOSE
Metrivant monitors competitor websites and converts meaningful changes into structured intelligence signals.

Pipeline:
fetch → snapshot → extract → validate → baseline → diff → signal → interpret → brief

Detection is deterministic.
Interpretation is probabilistic.

INFRASTRUCTURE
GitHub Free
Vercel Pro (runtime + cron)
Supabase Pro (state + backups)
OpenAI API (analysis)
Sentry (monitoring)

PIPELINE FUNCTIONS (cron, every 6h staggered)
fetch-snapshots        — :00 every 6h
extract-sections       — :10 every 6h
build-baselines        — :15 every 6h
detect-diffs           — :20 every 6h
detect-signals         — :25 every 6h
interpret-signals      — :30 every 6h
update-signal-velocity — :35 every 6h
detect-movements       — :40 every 6h
generate-brief         — weekly Monday 09:00 UTC (not yet implemented)

SUPABASE ROLE
Supabase stores snapshots, sections, baselines, diffs, signals, interpretations, briefs.
Queue state is stored in database rows.

VALIDATION MODEL
validation_status:
valid
suspect
failed

Only valid extractions enter the pipeline.

BASELINE MODEL
Baselines exist per monitored_page_id + section_type.

Diff states:
no_diff
unconfirmed
confirmed
unstable

Only confirmed diffs generate signals.

SIGNAL MODEL
Signals represent strategic competitor events such as:
price_point_change
feature_launch
feature_deprecation
tier_change
positioning_shift

SUPABASE SCHEMA

TABLE monitored_pages
id
url
active

TABLE extraction_rules
id
monitored_page_id
section_type
selector
extract_method
active
created_at
updated_at
min_length
max_length
required_pattern
structure_type

TABLE snapshots
id
monitored_page_id
fetched_at
raw_html
extracted_text
content_hash
status
sections_extracted_at
sections_extracted
extraction_errors
is_duplicate
retry_count
last_error
failed_at
retention_tier
sections_expected
sections_completed
response_headers

TABLE page_sections
id
snapshot_id
monitored_page_id
section_type
section_text
section_hash
extraction_status
created_at
selector_status
consecutive_empty
content_length
word_count
validation_status
validation_failure
parser_version
structured_content

TABLE section_baselines
monitored_page_id
section_type
section_hash
section_text
source_section_id
established_at
last_confirmed_at

TABLE section_diffs
id
monitored_page_id
section_type
previous_section_id
current_section_id
diff_text
detected_at
signal_detected
retry_count
last_error
is_noise
noise_reason
status
structured_diff

TABLE signals
id
section_diff_id
monitored_page_id
signal_type
signal_data
severity
detected_at
interpreted
status
interpreted_at
retry_count
last_error
is_duplicate
related_signal_id

TABLE interpretations
id
diff_id
model_used
prompt_version
change_type
summary
strategic_implication
recommended_action
urgency
confidence
created_at
prompt_hash
signal_id
old_content
new_content

TABLE briefs
id
week_start
week_end
content
signals_included
signals_excluded
created_at

TABLE brief_signals
brief_id
signal_id

ENVIRONMENT VARIABLES
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
CRON_SECRET
SENTRY_DSN

NEXT STEP
Implement generate-brief using OpenAI to produce weekly movement summaries.