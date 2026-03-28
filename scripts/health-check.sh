#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# Metrivant System Health Check
# Quick diagnostic script for system health monitoring
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Load credentials
if [ ! -f ".env.local" ]; then
    echo -e "${RED}Error: .env.local not found${NC}"
    exit 1
fi

source .env.local

# Helper function for count queries
count_query() {
    local table="$1"
    local filters="${2:-}"

    curl -s "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}?select=id${filters}&limit=1" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Prefer: count=exact" \
        -H "Range: 0-0" \
        -I | grep -i content-range | sed 's/.*\/\([0-9]*\).*/\1/'
}

echo "════════════════════════════════════════════════════════════════════════════════"
echo "METRIVANT SYSTEM HEALTH CHECK"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# 1. Pipeline Backlog
echo "1. PIPELINE BACKLOG"
echo "────────────────────────────────────────────────────────────────────────────────"

signals_pending=$(count_query "signals" "&status=eq.pending" || echo "0")
signals_pending_review=$(count_query "signals" "&status=eq.pending_review" || echo "0")
interps_unvalidated=$(count_query "interpretations" "&validation_status=is.null" || echo "0")
snapshots_pending=$(count_query "snapshots" "&sections_extracted=eq.false&fetch_quality=eq.full" || echo "0")

echo "Signals pending interpretation: $signals_pending"
echo "Signals in pending_review: $signals_pending_review"
echo "Interpretations unvalidated: $interps_unvalidated"
echo "Snapshots pending extraction: $snapshots_pending"

# 2. Signal Quality
echo ""
echo "2. SIGNAL QUALITY"
echo "────────────────────────────────────────────────────────────────────────────────"

signals_total=$(count_query "signals" "" || echo "0")
signals_interpreted=$(count_query "signals" "&status=eq.interpreted" || echo "0")
signals_failed=$(count_query "signals" "&status=eq.failed" || echo "0")

echo "Total signals: $signals_total"
echo "Interpreted: $signals_interpreted"
echo "Failed: $signals_failed"

if [ "$signals_failed" -gt 0 ]; then
    echo -e "${YELLOW}⚠ $signals_failed failed signals detected${NC}"
else
    echo -e "${GREEN}✓ No failed signals${NC}"
fi

# 3. Data Integrity
echo ""
echo "3. DATA INTEGRITY"
echo "────────────────────────────────────────────────────────────────────────────────"

interpretations_total=$(count_query "interpretations" "" || echo "0")
movements_total=$(count_query "strategic_movements" "" || echo "0")

echo "Signals interpreted: $signals_interpreted"
echo "Interpretations: $interpretations_total"
echo "Strategic movements: $movements_total"

if [ "$signals_interpreted" -gt 0 ] && [ "$interpretations_total" -gt 0 ]; then
    ratio=$(python3 -c "print(f'{$interpretations_total / $signals_interpreted:.2f}')")
    echo "Interpretation ratio: $ratio"

    if (( $(python3 -c "print($ratio < 0.90)") )); then
        echo -e "${YELLOW}⚠ Low interpretation ratio${NC}"
    else
        echo -e "${GREEN}✓ Interpretation ratio healthy${NC}"
    fi
fi

# 4. Competitor Coverage
echo ""
echo "4. COMPETITOR COVERAGE"
echo "────────────────────────────────────────────────────────────────────────────────"

competitors=$(count_query "competitors" "" || echo "0")
monitored_pages=$(count_query "monitored_pages" "" || echo "0")

echo "Competitors: $competitors"
echo "Monitored pages: $monitored_pages"

if [ "$competitors" -gt 0 ]; then
    avg_pages=$(python3 -c "print(f'{$monitored_pages / $competitors:.1f}')")
    echo "Avg pages/competitor: $avg_pages"
fi

# 5. Pool System
echo ""
echo "5. POOL SYSTEM"
echo "────────────────────────────────────────────────────────────────────────────────"

pool_events=$(count_query "pool_events" "" || echo "0")
competitor_feeds=$(count_query "competitor_feeds" "" || echo "0")

echo "Pool events: $pool_events"
echo "Competitor feeds: $competitor_feeds"

if [ "$pool_events" -gt 0 ]; then
    echo -e "${GREEN}✓ Pool system active${NC}"
else
    echo -e "${YELLOW}⚠ No pool events yet${NC}"
fi

# Summary
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "SUMMARY"
echo "════════════════════════════════════════════════════════════════════════════════"

issues=()

if [ "$signals_failed" -gt 0 ]; then
    issues+=("$signals_failed failed signals")
fi

if [ "$snapshots_pending" -gt 1000 ]; then
    issues+=("large snapshot backlog ($snapshots_pending)")
fi

if [ ${#issues[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠ Issues detected:${NC}"
    for issue in "${issues[@]}"; do
        echo "  - $issue"
    done
else
    echo -e "${GREEN}✓ System healthy - no critical issues detected${NC}"
fi

echo ""
