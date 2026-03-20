# Metrivant — Brand Aesthetics

---

## Identity

- The product is a **precision instrument**, not a dashboard.
- The metaphor is a **ship radar / sonar station** — military-grade, calm, purpose-built.
- Every visual element encodes data. Nothing is decorative.
- The tone is: composed, evidence-grounded, high signal, low noise.

---

## Colour

### Foundation
- **Background** — `#000200` — near-black with an imperceptible green tint. Not pure black. The tint is intentional: it grounds the accent colour in the canvas itself.
- **Surface (cards, panels)** — `#070707` / `#060606` — lifted 1–2 points from background, no hue shift.
- **Surface hover** — `#0c0c0c` — subtle lift on interaction.

### Accent
- **Mint green** — `#2EE6A6` — the single accent colour. Used for: active state, selected state, signal confirmation, the logo, the radar sweep arm, scrollbar, text selection highlight, CTA buttons, data labels.
- Never used for decoration. Always tied to a live data signal or a confirmed state.
- At reduced opacity (`rgba(46,230,166,0.55)`) for secondary labels, taglines, and icon states.

### Signal / momentum palette (data-semantic, not decorative)
- **Stable** — `#2EE6A6` (mint) — baseline active state
- **Rising** — `#f59e0b` (amber) — elevated activity, emerging signals
- **Accelerating** — `#ef4444` (red) — critical threshold crossed
- **Cooling** — `#64748b` (slate) — dormant, no recent activity

### Text hierarchy
- Primary — `#ffffff`
- Secondary — `rgba(148,163,184,0.80)` (slate-400)
- Muted — `rgba(100,116,139,0.80)` (slate-500)
- Dim — `rgba(71,85,105,0.70)` (slate-600)
- Dead / placeholder — `rgba(255,255,255,0.14–0.18)`

### Borders
- Standard — `rgba(255,255,255,0.08)` / `rgba(255,255,255,0.10)`
- Selected / active — `rgba(46,230,166,0.40)`
- Subtle separator — `rgba(255,255,255,0.05)`
- Green-tinted border (dark panels) — `rgba(26,42,26,0.9)`

---

## Typography

### Typefaces
- **Inter** — primary typeface. Used for all body text, labels, data readouts, and navigation. Weights: 400, 500, 600, 700.
- **Space Grotesk** — secondary typeface. Used selectively in data-dense surfaces (Discover page) where a geometric monospace-adjacent rhythm is preferred. Not a global replacement for Inter.
- System fallback stack: `Inter, system-ui, -apple-system, sans-serif`
- Font smoothing: `-webkit-font-smoothing: antialiased`

### Wordmark
- **METRIVANT** — all-caps, bold (700), `letter-spacing: 0.09em`, `28–34px`.
- The wordmark is always uppercase. Never sentence case. Never lowercase.

### Tagline
- "Competitive Intelligence Radar" — uppercase, `tracking-[0.34em]`, `10–11px`, `font-weight: 500`, rendered at `rgba(46,230,166,0.55)`.
- Always appears directly below the wordmark at reduced accent opacity.

### Label style (throughout the UI)
- Short labels: uppercase, `letter-spacing: 0.12–0.22em`, `9–10px`, `font-weight: 500–600`.
- Category badges, section headers, status tags all follow this rule.
- Green label colour: `rgba(46,230,166,0.55)` for data labels; `rgba(255,255,255,0.20–0.35)` for structural labels.

### Body text
- `12–13px`, `Inter 400`, `leading-relaxed`. Never decorative. Every sentence carries information.

### Numeric / data readouts
- Same Inter stack. Tabular spacing not enforced but values are displayed at `font-weight: 600` to distinguish from prose.

---

## Logo

### Mark
- **SVG radar instrument.** Concentric rings (4) with a rotating sweep arm and a pulsing centre dot.
- Viewbox: `46×46`, origin at `(23, 23)`.
- Ring radii: `r=21.5` (outer), `r=15`, `r=9`, `r=4` (inner).
- All rings and arm in `#2EE6A6`. No other colours appear in the mark.
- Cardinal ticks at N / E / S / W (22% opacity) — instrument reference marks.

### Sweep arm
- Rotates 360° continuously at `9s linear` — steady, never accelerating.
- Arm: `stroke #2EE6A6`, `strokeWidth 1.2`, `70% opacity`.
- Sweep wedge: filled at `8% opacity` — a trailing luminance behind the arm.
- Blip at the arm tip: pulses between `40–100%` opacity on an `0.8s` loop.

### Centre dot
- `r=2`, solid `#2EE6A6`, pulses `70–100%` opacity on a `2s` loop — the "alive" indicator.

### Ring pulse (concentric, staggered)
- All 4 rings breathe independently, staggered by `0.6s` intervals on a `3.5s easeInOut` cycle.
- Creates the impression of continuous outward propagation without literal animation of radius.

### Interactive behaviour (landing logo)
- Click triggers: sonar ping audio (260 Hz sine, 2.4s resonant decay, harmonic overtone at 390 Hz) + a single expanding ring animation from centre outward.
- The sound is a deliberate design choice — submarine sonar register.

### Usage sizes
- Landing hero: `72px` rendered (46×46 viewbox, scaled up)
- In-app wordmark / onboarding: `40px`
- Static (non-animated) version: same SVG mark, rings drawn at fixed opacity

---

## Texture and Depth

### Dot grid
- `radial-gradient(rgba(255,255,255,0.85) 0.5px, transparent 0.5px)` at `6×6px`, `opacity: 0.018`.
- Applied as a `pointer-events-none fixed` layer behind all content.
- Gives the canvas a subtle instrument-panel texture without visual noise.

### Atmospheric glow
- `radial-gradient(ellipse 80% 50% at 50% -10%, rgba(46,230,166,0.07–0.09) 0%, transparent 70%)`.
- Positioned above the viewport — light bleeds down from the top.
- Animates with `glow-breathe` (8s easeInOut loop, `opacity: 1 → 0.50 → 1`) on the landing page.
- Static at lower opacity in the app surfaces (onboarding, panels).

### Card surfaces
- No box shadows for depth — depth is communicated through border opacity and background luminance lift.
- Selected states: `box-shadow: 0 0 0 1px rgba(46,230,166,0.08), inset 0 1px 0 rgba(46,230,166,0.05)` — inset highlight, not a drop shadow.

---

## Geometry and Spacing

### Border radius
- Primary CTA buttons: `rounded-full`
- Secondary buttons, input fields, inline tags: `4px`
- Cards (sector picker, competitor cards): `12px`
- Grid containers (catalog grids): `8px`
- Status badges / category pills: `3px`

### Grid
- Standard content width: `max-w-6xl` with `px-6`
- Narrow content (onboarding, forms): `max-w-lg`
- Catalog grids: `grid-cols-2` mobile → `grid-cols-3` desktop, `gap-px` (1px separator lines from the container background bleed).

### Scrollbar
- Width: `4px`.
- Track: transparent.
- Thumb: `rgba(46,230,166,0.15)` at rest, `0.28` on hover. `border-radius: 2px`.

---

## Motion

Animations are slow, smooth, and purposeful. No snap, no bounce, no easing that suggests consumer playfulness.

### Principles
- All motion is either **breathing** (looping opacity/scale on a long cycle) or **entrancing** (one-time fade/translate on mount).
- Nothing accelerates on hover — hover states are colour shifts only.
- Duration range: `0.15s` (instant feedback) → `24s` (ambient radar pulse).

### Named animations
| Name | Duration | Curve | Purpose |
|---|---|---|---|
| `page-enter` | `0.22s` | `ease-out` | Route transition |
| `content-reveal` | `0.18s` | `ease-out` | Panel / overlay open |
| `hero-fade-up` | `0.60s` | `cubic-bezier(0.22,1,0.36,1)` | Landing stagger entrance |
| `glow-breathe` | `8s` | `ease-in-out` | Atmospheric glow loop |
| `skeleton-pulse` | `1.8s` | `ease-in-out` | Loading skeleton |
| `cta-pulse` | `3s` | `ease-in-out` | Primary CTA glow |
| `upgrade-glow` | `16s` | `ease-in-out` | Intermittent upgrade prompt |
| Radar sweep | `9s` | `linear` | Logo arm rotation |
| Ring breathe | `3.5s` | `ease-in-out` | Logo ring stagger |
| Radar echo (nodes) | `24s` | — | Competitor blip echo rings |
| Radar echo (accelerating) | `1.5s` | — | High-momentum blip pulse |

### Stagger pattern (hero entrance)
`0ms → 120ms → 220ms → 320ms → 440ms → 560ms` — each element enters on this sequence.

---

## Voice and Microcopy

- Functional. One sentence does one job.
- Never "dashboard" — always "radar", "instrument", "signal", "movement".
- Precision language: "Confidence-gated", "Evidence-grounded", "Pre-public detection".
- Error messages are direct and suggest recovery: "Adjust your search or clear filters."
- Empty states are informational, not reassuring: "No targets found."
- Loading states reflect actual system activity: "Adding rivals to your radar…", "Setting up monitoring pages…"
- Never uses exclamation marks. Never uses emoji in UI chrome.

---

## What This Brand Is Not

- Not a consumer product. No pastels, no rounded-everything, no micro-animations on every element.
- Not a data visualisation tool. The radar is a specific instrument — not a generic chart surface.
- Not enterprise grey. The black-and-green identity is intentional and distinctive. Not blue, not navy, not purple.
- Not loud. The single accent colour is used sparingly. When it appears, it means something.
