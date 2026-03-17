export const RETENTION_DAYS = {
  RAW_HTML:              7,
  EXTRACTED_SECTIONS:    90,
  DIFFS:                 180,
  PIPELINE_EVENTS:       90,
  MEDIA_OBSERVATIONS:    30,
  STALE_PENDING_REVIEW:  30,  // pending_review signals older than 30d are expired
} as const;
