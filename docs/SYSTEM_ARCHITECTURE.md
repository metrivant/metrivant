# SYSTEM ARCHITECTURE

GitHub
↓
Vercel (cron runtime)
↓
Supabase (state engine)
↓
OpenAI (signal interpretation)
↓
Sentry (monitoring)

Pipeline:

fetch
→ snapshot
→ extract
→ validate
→ baseline
→ diff
→ signal
→ interpret
→ weekly brief

Design principles:

- deterministic detection
- probabilistic interpretation only
- Supabase holds pipeline state
- runtime remains stateless
- solo-operator maintainability