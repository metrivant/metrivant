METRIVANT — SYSTEM ARCHITECTURE
Version: v1.1

------------------------------------------------
1. System Topology
------------------------------------------------

GitHub
→ code

Vercel
→ cron runtime

Supabase
→ system state engine

OpenAI
→ signal interpretation (strategic implication, recommended action, urgency, confidence)

Sentry
→ monitoring and alerting

------------------------------------------------
2. Pipeline
------------------------------------------------

fetch
→ extract
→ baseline
→ diff
→ detect-signals
→ interpret
→ update-velocity
→ detect-movements
→ radar feed (view)
→ weekly brief (not yet implemented)

------------------------------------------------
3. Design Principles
------------------------------------------------

- deterministic detection
- AI used only for interpretation
- Supabase stores all durable state
- runtime remains stateless
- system must remain solo-operator maintainable
- avoid unnecessary infrastructure