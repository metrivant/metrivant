# Metrivant — Brand Aesthetics

---

## Identity

- The product is a **precision instrument**, not a dashboard.
- Two perception modes: **Classic** (passive radar instrument) and **HUD** (active pilot interface).
- Classic = observer. HUD = operator. Same data, different relationship to it.
- Every visual element encodes data. Nothing is decorative.
- The tone is: composed, evidence-grounded, high signal, low noise.

---

## Colour

### Foundation
- **Background** — `#000002` — near-black with an imperceptible blue tint. Not pure black. The tint is intentional: it grounds the accent colour in the canvas itself.
- **Surface (cards, panels)** — `#070707` / `#060606` — lifted 1–2 points from background, no hue shift.
- **Surface hover** — `#0c0c0c` — subtle lift on interaction.

### Accent
- **Electric blue** — `#00B4FF` — the single accent colour. Used for: active state, selected state, signal confirmation, the logo, the radar sweep arm, scrollbar, text selection highlight, CTA buttons, data labels.
- Never used for decoration. Always tied to a live data signal or a confirmed state.
- At reduced opacity (`rgba(0,180,255,0.55)`) for secondary labels, taglines, and icon states.

### Signal / momentum palette (data-semantic, not decorative)
- **Stable** — `#00B4FF` (blue) — baseline active state
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
- Selected / active — `rgba(0,180,255,0.40)`
- Subtle separator — `rgba(255,255,255,0.05)`
- Green-tinted border (dark panels) — `rgba(26,42,26,0.9)`

---

## Typography

### Typefaces
- **Orbitron** — heading / display typeface. Used for: wordmark (METRIVANT), section headings, feature tags, pricing headlines, pipeline headings, HUD labels. Weights: 400–900. Sci-fi geometric aesthetic.
- **Share Tech Mono** — site-wide default body typeface. Used for: all body text, navigation, pricing cards, CTAs, data readouts, labels, differentiation row. Weight: 400. Monospace terminal aesthetic.
- **Inter** — long-form readability typeface. Used selectively for: About overlay feature descriptions, brief content, settings text — any surface where paragraph-length text needs optimal legibility at small sizes. Weights: 400–700.
- CSS variable system: `--font-orbitron`, `--font-share-tech-mono`, `--font-inter` (set in `layout.tsx`).
- Default body: `font-family: var(--font-share-tech-mono), var(--font-inter), Inter, system-ui, -apple-system, sans-serif`
- Font smoothing: `-webkit-font-smoothing: antialiased`

### Wordmark
- **METRIVANT** — all-caps, Orbitron bold (700), `letter-spacing: 0.09em`, `28–34px` (hero), `14–15px` (nav).
- The wordmark is always uppercase. Never sentence case. Never lowercase.
- Orbitron is applied to both the nav brand and the hero H1 — they must always match.

### Tagline
- "Competitive Intelligence" — uppercase, Share Tech Mono, `tracking-[0.34em]`, `10–11px`, `font-weight: 500`, rendered at `rgba(0,180,255,0.55)`.
- "Radar" was removed from the tagline (2026-03-20). The product identity is "Competitive Intelligence", not "Radar".
- Always appears directly below the wordmark at reduced accent opacity.
- Animated with `tagline-sheen`: electric flicker (text-shadow pulses at 75-79% of 6s cycle) + gradient sweep.

### Label style (throughout the UI)
- Short labels: Orbitron uppercase, `letter-spacing: 0.12–0.22em`, `9–11px`, `font-weight: 500–700`.
- Category badges, section headers, status tags all follow this rule.
- Accent label colour: `rgba(0,180,255,0.55)` for data labels; `rgba(255,255,255,0.20–0.35)` for structural labels.

### Body text
- `12–13px`, Share Tech Mono 400, `leading-relaxed`. Never decorative. Every sentence carries information.
- For long-form paragraphs (About overlay, briefs): Inter 400 at `leading-[1.7]` for improved readability.

### Numeric / data readouts
- Share Tech Mono stack. Values displayed at `font-weight: 600` to distinguish from prose.

---

## Logo

### Mark
- **SVG radar instrument.** Concentric rings (4) with a rotating sweep arm and a pulsing centre dot.
- Viewbox: `46×46`, origin at `(23, 23)`.
- Ring radii: `r=21.5` (outer), `r=15`, `r=9`, `r=4` (inner).
- All rings and arm in `#00B4FF`. No other colours appear in the mark.
- Cardinal ticks at N / E / S / W (22% opacity) — instrument reference marks.

### Sweep arm
- Rotates 360° continuously at `9s linear` — steady, never accelerating.
- Arm: `stroke #00B4FF`, `strokeWidth 1.2`, `70% opacity`.
- Sweep wedge: filled at `8% opacity` — a trailing luminance behind the arm.
- Blip at the arm tip: pulses between `40–100%` opacity on an `0.8s` loop.

### Centre dot
- `r=2`, solid `#00B4FF`, pulses `70–100%` opacity on a `2s` loop — the "alive" indicator.

### Ring pulse (concentric, staggered)
- All 4 rings breathe independently, staggered by `0.6s` intervals on a `3.5s easeInOut` cycle.
- Creates the impression of continuous outward propagation without literal animation of radius.

### Signal nodes (landing logo)
- 4 small blips (r=0.9–1.2) on the rings, appearing/disappearing on staggered 3.5–5s cycles.
- Represent intermittent signal detection on the radar.

### Interactive behaviour (landing logo)
- Click triggers: futuristic crystalline ding (1046 Hz C6 sine + 3138 Hz shimmer + 523 Hz triangle warmth, 80ms metallic echo, 0.5s total) + expanding ring animation.
- The sound was updated from submarine sonar to a futuristic ding (2026-03-20).

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

### Electricity background (landing page)
- `ElectricityBackground.tsx` — client component rendering randomized SVG lightning bolts.
- Fixed overlay, `pointer-events: none`, `z-index: 1`.
- Bolt generation: 6–11 jagged segments, random horizontal drift, 400–1000px height.
- Flash timing: erratic 2–5 second intervals. 1–2 bolts per flash.
- Double-flash pattern: 50% chance of a second flash 80–120ms after the first.
- Flash duration: 80–150ms (appears and vanishes quickly).
- Bolt opacity: `0.04–0.10` — atmospheric, not distracting.
- Glow layer: duplicate path at `strokeWidth: 6`, `opacity: 0.3`, `filter: blur(4px)`.
- Colour: `#00B4FF` — same accent as all other elements.

### Atmospheric glow
- `radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,180,255,0.07–0.09) 0%, transparent 70%)`.
- Positioned above the viewport — light bleeds down from the top.
- Animates with `glow-breathe` (8s easeInOut loop, `opacity: 1 → 0.50 → 1`) on the landing page.
- Static at lower opacity in the app surfaces (onboarding, panels).

### Card surfaces
- No box shadows for depth — depth is communicated through border opacity and background luminance lift.
- Selected states: `box-shadow: 0 0 0 1px rgba(0,180,255,0.08), inset 0 1px 0 rgba(0,180,255,0.05)` — inset highlight, not a drop shadow.

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
- Thumb: `rgba(0,180,255,0.15)` at rest, `0.28` on hover. `border-radius: 2px`.

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
| `tagline-sheen` | `6s` | `ease-in-out` | Electric flicker + gradient sweep on tagline |
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
- Precision language: "Confidence-gated", "Evidence-grounded", "Early detection".
- Error messages are direct and suggest recovery: "Adjust your search or clear filters."
- Empty states are informational, not reassuring: "No targets found."
- Loading states reflect actual system activity: "Adding rivals to your radar…", "Setting up monitoring pages…"
- Never uses exclamation marks. Never uses emoji in UI chrome.

---

## Hero Copy — Line-by-Line Glow Escalation

Three lines, each progressively more intense:
1. "Changes become signals." — `slate-400 @ 80%`, `font-weight: 500`
2. "Signals become movements." — `slate-200 @ 90%`, `font-weight: 600`, `text-shadow: 0 0 8px rgba(0,180,255,0.15)`
3. "Movements become strategy." — `cyan @ 95%`, `font-weight: 700`, `text-shadow: 0 0 12px rgba(0,180,255,0.35), 0 0 24px rgba(0,180,255,0.12)`

The escalation communicates increasing strategic value as raw changes become actionable strategy.

---

## 45-Second Engagement Feature (IntelligencePulse)

A circular radar-shaped panel that appears 45 seconds after landing. Session-gated (sessionStorage).

### Phase progression
- **Phase 0** (0s): Small circular radar (120px) appears bottom-right with animated pulsing rings + sweep arm.
- **Phase 1** (2.2s): Signal card + movement detection info appears inside the expanded circle.
- **Phase 2** (5.5s): Circle expands to 480px centered on screen with backdrop blur.
- **Phase 3** (7s): Radar logo becomes interactive — hover reveals "Enter Metrivant" CTA.

### Interaction
- Hover the radar → "Enter Metrivant" button appears (Orbitron, cyan, neon glow).
- Click → electrical pulse sound (white noise zap through bandpass + sine tail) + rapid flicker sequence (10 steps, 60ms each) → redirect to `/signup`.
- Dismissible via close button or backdrop click.

### Visual
- Circular panel: `border-radius: 50%`, `#020208` background, `rgba(0,180,255,0.15–0.25)` border.
- Concentric ring decorations inside the circle (85%, 65% of diameter).
- Box shadow: `0 0 80px rgba(0,180,255,0.10)` when expanded.
- Electrical pulse overlay on click: radial cyan gradient flash.

---

## What This Brand Is Not

- Not a consumer product. No pastels, no rounded-everything, no micro-animations on every element.
- Not a data visualisation tool. The radar is a specific instrument — not a generic chart surface.
- Not enterprise grey. The black-and-blue identity is intentional and distinctive. Not green, not navy, not purple.
- Not loud. The single accent colour is used sparingly. When it appears, it means something.

---

## Dual-Theme System

### Architecture

```
styles/themes/
  base.css              ← shared tokens (canvas, accent, text, signal)
  metrivant-classic.css ← classic overrides (default — blue instrument)
  metrivant-hud.css     ← HUD layer (cyan interface scaffolding)
lib/theme.ts            ← setTheme() / getTheme() / toggleTheme()
```

Toggle: `<html data-theme="classic">` or `<html data-theme="hud">`.
Persisted to `localStorage('metrivant-theme')`. Flash-prevention script runs before hydration.

### Colour rule (strict)

- **Blue (#00B4FF) = data truth. Signals, confirmation, evidence. Present in both themes.
- **Cyan** (`#00E5FF` / `#7AF7FF`) = interface structure. Borders, scaffolding, UI chrome. HUD theme only.
- These meanings are never mixed. A cyan element never carries data semantics. A green element never represents UI scaffolding.

### Classic theme (default)

The existing aesthetic. Green is the only accent. Borders are white at low opacity. No overlays. Passive observation.

### HUD theme

Adds a control layer over the same instrument:

**Global effects (immediate, no DOM changes):**
- Scanline overlay — `1px` horizontal lines at `1.5%` opacity, full viewport
- Horizontal scan line — single cyan line sweeping top→bottom on `7s` linear loop
- Emission glow — radial green gradient centered on viewport
- Scrollbar — shifts from green to cyan
- Text selection — shifts from green to cyan

**Opt-in component classes (no-ops in classic):**
- `.hud-panel` — dual-line border (inner + outer glow) on containers
- `.hud-framed` — chamfered/clipped corners (`8px` cuts)
- `.hud-numeric` — glowing data readout (`text-shadow: 0 0 6px rgba(122,247,255,0.4)`)
- `.hud-label` — cyan chrome label (`letter-spacing: 0.14em`, uppercase)
- `.hud-connector` — thin cyan separator line

**Signal encoding classes:**
- `.signal-weak` — dotted border (unconfirmed signals)
- `.signal-confirmed` — solid border (confirmed)
- `.signal-active` — pulsing opacity (active change)

**Motion (HUD-specific):**
- `hud-scan` — horizontal scan line sweep (`7s linear`)
- `hud-pulse` — signal activity pulse (`2s ease-in-out`)
- `hud-flicker` — micro-flicker for ambient elements (random-feel opacity variance)
- All HUD motion: linear or exponential decay. No easing bounce.

### Token layer

| Token | Classic | HUD |
|---|---|---|
| `--m-ui-accent` | `#00B4FF` | `#00E5FF` |
| `--m-ui-highlight` | `#00B4FF` | `#7AF7FF` |
| `--m-ui-glow` | `none` | `0 0 6px rgba(0,229,255,0.5)` |
| `--m-ui-border` | `rgba(255,255,255,0.08)` | `rgba(0,229,255,0.12)` |
| `--m-ui-border-active` | `rgba(0,180,255,0.40)` | `rgba(0,229,255,0.35)` |

Signal tokens (`--m-signal-*`) are permanent and never themed.

### Safety constraints

The theme system only changes:
- Colours
- Borders
- Overlays (pseudo-elements)
- Animation layers

It does not change:
- DOM structure
- Spacing
- Layout grid
- Component hierarchy
- Any functional behaviour
