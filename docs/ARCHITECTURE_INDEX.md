SUPERSEDED — see docs/METRIVANT_MASTER_REFERENCE.md

METRIVANT — ARCHITECTURE INDEX
Version: v1.1

Purpose

This document is the entry point for understanding the Metrivant system.

The repository contains both runtime code and architectural documentation.
The documentation explains the system design, state machine, runtime flow, and operational procedures.

Anyone modifying the runtime should read these documents in the order listed below.

------------------------------------------------
DOCUMENT ORDER
------------------------------------------------

1. MASTER_ARCHITECTURE_PLAN.md

Purpose:
High-level architecture and design philosophy.

Explains:
- system purpose
- infrastructure layout
- data model roles
- pipeline design
- scaling philosophy

This document answers:
"Why the system is designed this way."

------------------------------------------------

2. SYSTEM_ARCHITECTURE.md

Purpose:
High-level system topology.

Explains:
- infrastructure stack
- pipeline shape
- design principles
- component responsibilities

This document answers:
"What are the major moving parts of the system?"

------------------------------------------------

3. SUPABASE_ARCHITECTURE.md

Purpose:
Database schema reference.

Explains:
- table roles
- column definitions
- unique constraints
- runtime gotchas

This document answers:
"What the database actually looks like."

------------------------------------------------

4. PIPELINE_STATE_MACHINE.md

Purpose:
Define state transitions for each table.

Explains:
- how rows move through the pipeline
- queue semantics
- retry behavior
- dead-letter states

This document answers:
"How data progresses through the system."

------------------------------------------------

5. SYSTEM_RUNTIME_FLOW.md

Purpose:
Explain how runtime functions interact with the database.

Explains:
- each cron job
- tables read and written
- runtime sequence
- failure recovery

This document answers:
"How the machine runs."

------------------------------------------------

6. OPERATIONS.md

Purpose:
Operational playbook for running the system.

Explains:
- daily health checks
- weekly reviews
- SQL diagnostics
- recovery procedures
- maintenance guidelines

This document answers:
"How the system is maintained."

------------------------------------------------
SYSTEM PRINCIPLES
------------------------------------------------

1. Deterministic detection

Code determines whether changes occurred.

2. AI interpretation only

AI explains the strategic meaning of changes.

3. Database state machine

Supabase stores all queue state.

4. Stateless runtime

Serverless functions contain no durable state.

5. Observable system

Monitoring and diagnostics exist for every stage.

------------------------------------------------
DEBUGGING ENTRY POINT
------------------------------------------------

If the pipeline appears broken, inspect tables in this order:

snapshots
page_sections
section_baselines
section_diffs
signals
interpretations
strategic_movements

The first stage missing expected rows indicates the failure point.

------------------------------------------------
DEVELOPMENT RULE
------------------------------------------------

Architecture changes must update documentation.

Code and documentation must remain synchronized.

The documentation in this directory is the canonical system specification.
