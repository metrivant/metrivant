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
→ interpretation and brief generation

Sentry
→ monitoring and alerting

------------------------------------------------
2. Pipeline
------------------------------------------------

fetch
→ snapshot
→ extract
→ validate
→ baseline
→ diff
→ signal
→ interpret
→ weekly brief

------------------------------------------------
3. Design Principles
------------------------------------------------

- deterministic detection
- AI used only for interpretation
- Supabase stores all durable state
- runtime remains stateless
- system must remain solo-operator maintainable
- avoid unnecessary infrastructure