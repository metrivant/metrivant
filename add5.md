# add5 — Add 5 competitors to each sector in the catalog

## Objective

Add exactly 5 new entries to each sector in `radar-ui/lib/sector-catalog.ts`.

Each sector currently has 15 entries (priorities 1–15). Add 5 more at priorities 16–20.
No other files need to change. No schema migration. No new logic.

---

## File to edit

```
/home/arcmatrix93/metrivant/radar-ui/lib/sector-catalog.ts
```

---

## How the file is structured

Each sector has a `const SECTORNAME_DEFAULTS: SectorDefaultCompetitor[]` array.
Each entry must match this type exactly:

```ts
{
  name: string;
  domain: string;
  website_url: string;
  priority: number;       // 16, 17, 18, 19, 20 for the new entries
  default_pages: string[]; // use the sector's existing PAGE constant
}
```

Each sector already defines a `_PAGES` constant (e.g. `SAAS_PAGES`, `DEFENSE_PAGES`).
Use the same constant that the existing 15 entries in that sector use.

---

## Entries to add per sector

Append these entries to the end of each sector's array, before the closing `];`.

### `saas` — use `SAAS_PAGES`

```ts
{ name: "Loom",      domain: "loom.com",      website_url: "https://loom.com",      priority: 16, default_pages: SAAS_PAGES },
{ name: "Miro",      domain: "miro.com",      website_url: "https://miro.com",      priority: 17, default_pages: SAAS_PAGES },
{ name: "Zapier",    domain: "zapier.com",    website_url: "https://zapier.com",    priority: 18, default_pages: SAAS_PAGES },
{ name: "Intercom",  domain: "intercom.com",  website_url: "https://intercom.com",  priority: 19, default_pages: SAAS_PAGES },
{ name: "Segment",   domain: "segment.com",   website_url: "https://segment.com",   priority: 20, default_pages: SAAS_PAGES },
```

### `defense` — use `DEFENSE_PAGES`

```ts
{ name: "Leidos",             domain: "leidos.com",       website_url: "https://leidos.com",       priority: 16, default_pages: DEFENSE_PAGES },
{ name: "Parsons",            domain: "parsons.com",      website_url: "https://parsons.com",      priority: 17, default_pages: DEFENSE_PAGES },
{ name: "Joby Aviation",      domain: "jobyaviation.com", website_url: "https://jobyaviation.com", priority: 18, default_pages: DEFENSE_PAGES },
{ name: "Sierra Nevada Corp", domain: "sncorp.com",       website_url: "https://sncorp.com",       priority: 19, default_pages: DEFENSE_PAGES },
{ name: "Terran Orbital",     domain: "terranorbital.com",website_url: "https://terranorbital.com",priority: 20, default_pages: DEFENSE_PAGES },
```

### `energy` — use `ENERGY_PAGES`

```ts
{ name: "Arcadia",     domain: "arcadia.com",     website_url: "https://arcadia.com",     priority: 16, default_pages: ENERGY_PAGES },
{ name: "Palmetto",    domain: "palmetto.com",    website_url: "https://palmetto.com",    priority: 17, default_pages: ENERGY_PAGES },
{ name: "Aurora Solar",domain: "aurorasolar.com", website_url: "https://aurorasolar.com", priority: 18, default_pages: ENERGY_PAGES },
{ name: "Stem",        domain: "stem.com",        website_url: "https://stem.com",        priority: 19, default_pages: ENERGY_PAGES },
{ name: "PowerFlex",   domain: "powerflex.com",   website_url: "https://powerflex.com",   priority: 20, default_pages: ENERGY_PAGES },
```

### `cybersecurity` — use `CYBER_PAGES`

```ts
{ name: "Varonis",   domain: "varonis.com", website_url: "https://varonis.com", priority: 16, default_pages: CYBER_PAGES },
{ name: "Orca",      domain: "orca.security",website_url: "https://orca.security",priority: 17, default_pages: CYBER_PAGES },
{ name: "Qualys",    domain: "qualys.com",  website_url: "https://qualys.com",  priority: 18, default_pages: CYBER_PAGES },
{ name: "Vectra AI", domain: "vectra.ai",   website_url: "https://vectra.ai",   priority: 19, default_pages: CYBER_PAGES },
{ name: "Pentera",   domain: "pentera.io",  website_url: "https://pentera.io",  priority: 20, default_pages: CYBER_PAGES },
```

### `fintech` — use `FINTECH_PAGES`

```ts
{ name: "Moov",             domain: "moov.io",            website_url: "https://moov.io",            priority: 16, default_pages: FINTECH_PAGES },
{ name: "Increase",         domain: "increase.com",       website_url: "https://increase.com",       priority: 17, default_pages: FINTECH_PAGES },
{ name: "Modern Treasury",  domain: "moderntreasury.com", website_url: "https://moderntreasury.com", priority: 18, default_pages: FINTECH_PAGES },
{ name: "Unit",             domain: "unit.co",            website_url: "https://unit.co",            priority: 19, default_pages: FINTECH_PAGES },
{ name: "Column",           domain: "column.com",         website_url: "https://column.com",         priority: 20, default_pages: FINTECH_PAGES },
```

### `ai-infrastructure` — use `AI_PAGES`

```ts
{ name: "Fireworks AI", domain: "fireworks.ai",  website_url: "https://fireworks.ai",  priority: 16, default_pages: AI_PAGES },
{ name: "Cerebras",     domain: "cerebras.net",  website_url: "https://cerebras.net",  priority: 17, default_pages: AI_PAGES },
{ name: "LlamaIndex",   domain: "llamaindex.ai", website_url: "https://llamaindex.ai", priority: 18, default_pages: AI_PAGES },
{ name: "LangChain",    domain: "langchain.com", website_url: "https://langchain.com", priority: 19, default_pages: AI_PAGES },
{ name: "DeepInfra",    domain: "deepinfra.com", website_url: "https://deepinfra.com", priority: 20, default_pages: AI_PAGES },
```

### `devtools` — use `DEVTOOLS_PAGES`

```ts
{ name: "Doppler",    domain: "doppler.com",   website_url: "https://doppler.com",   priority: 16, default_pages: DEVTOOLS_PAGES },
{ name: "Infisical",  domain: "infisical.com", website_url: "https://infisical.com", priority: 17, default_pages: DEVTOOLS_PAGES },
{ name: "Depot",      domain: "depot.dev",     website_url: "https://depot.dev",     priority: 18, default_pages: DEVTOOLS_PAGES },
{ name: "Dagger",     domain: "dagger.io",     website_url: "https://dagger.io",     priority: 19, default_pages: DEVTOOLS_PAGES },
{ name: "Earthly",    domain: "earthly.dev",   website_url: "https://earthly.dev",   priority: 20, default_pages: DEVTOOLS_PAGES },
```

### `healthcare` — use `HEALTH_PAGES`

```ts
{ name: "Commure",         domain: "commure.com",        website_url: "https://commure.com",        priority: 16, default_pages: HEALTH_PAGES },
{ name: "Turquoise Health",domain: "turquoise.health",   website_url: "https://turquoise.health",   priority: 17, default_pages: HEALTH_PAGES },
{ name: "Abridge",         domain: "abridge.com",        website_url: "https://abridge.com",        priority: 18, default_pages: HEALTH_PAGES },
{ name: "Aidoc",           domain: "aidoc.com",          website_url: "https://aidoc.com",          priority: 19, default_pages: HEALTH_PAGES },
{ name: "Notable",         domain: "notablehealth.com",  website_url: "https://notablehealth.com",  priority: 20, default_pages: HEALTH_PAGES },
```

### `consumer-tech` — use `CONSUMER_PAGES`

```ts
{ name: "Roblox",    domain: "roblox.com",    website_url: "https://roblox.com",    priority: 16, default_pages: CONSUMER_PAGES },
{ name: "Duolingo",  domain: "duolingo.com",  website_url: "https://duolingo.com",  priority: 17, default_pages: CONSUMER_PAGES },
{ name: "Calm",      domain: "calm.com",      website_url: "https://calm.com",      priority: 18, default_pages: CONSUMER_PAGES },
{ name: "BeReal",    domain: "bereal.com",    website_url: "https://bereal.com",    priority: 19, default_pages: CONSUMER_PAGES },
{ name: "Headspace", domain: "headspace.com", website_url: "https://headspace.com", priority: 20, default_pages: CONSUMER_PAGES },
```

---

## Verification

After editing, confirm:

1. Each sector array now has exactly 20 entries.
2. Priorities run 1–20 with no gaps or duplicates within each sector.
3. All new entries use the correct `_PAGES` constant for their sector.
4. Run `npx tsc --noEmit` from `radar-ui/` — must pass with 0 errors.

No other files change. No migration. No API changes.
