# Metrivant — Brand Aesthetic System

This document defines the Metrivant visual identity as a reusable design system. Every page — landing, app, ops, pricing, signup, about — must conform to these rules. The landing page is the baseline. Any element on any page should look like it belongs on the landing page.

---

## 1. CANVAS

The canvas is near-black with an imperceptible blue tint. Never pure black. The tint grounds the accent colour in the background itself.

| Token | Value | Usage |
|---|---|---|
| `--m-bg` | `#000002` | Page background, all surfaces |
| `--m-surface` | `#020208` | Cards, panels, elevated containers |
| `--m-surface-hover` | `#03030c` | Interactive card hover state |
| `--m-surface-highlight` | `#070d07` | Buttons, close icons, interactive controls |

**Rule:** No surface should use pure `#000000`. No surface should be lighter than `#0c0c0c` unless it is a modal or overlay.

---

## 2. ACCENT

One colour. Electric blue. `#00B4FF`. This is the only accent colour in the entire system.

| Token | Value | Usage |
|---|---|---|
| `--m-accent` | `#00B4FF` | CTA buttons, selected states, active indicators, logo, data labels |
| `--m-accent-dim` | `rgba(0,180,255,0.55)` | Secondary labels, taglines, icon states, section headers |
| `--m-accent-ghost` | `rgba(0,180,255,0.08)` | Background tints on hover, subtle container fills |
| Glow | `rgba(0,180,255,0.04–0.10)` | Box shadows, atmospheric glows, card highlights |

**Rule:** The accent is never decorative. Every use of `#00B4FF` is tied to a live data state, a confirmed action, or a brand mark. If an element glows blue, it means something.

---

## 3. TEXT HIERARCHY

Five distinct tiers. Each tier has a specific font, size, weight, tracking, and colour. These are rules — not guidelines.

### Tier 1: BRAND MARK (wordmark + tagline)

| Property | Wordmark (METRIVANT) | Tagline (Competitive Intelligence) |
|---|---|---|
| Font | `var(--font-orbitron)` | `var(--font-share-tech-mono)` |
| Size | `28–34px` (hero), `14–15px` (nav) | `10–11px` |
| Weight | `700` (bold) | `500` (medium) |
| Transform | `uppercase` | `uppercase` |
| Tracking | `0.09em` | `0.34em` |
| Colour | `#ffffff` | `rgba(0,180,255,0.55)` |
| CSS class | — (inline style: `fontFamily: var(--font-orbitron)`) | `.tagline-sheen` |

**Rule:** METRIVANT is always uppercase, always Orbitron, always bold. The tagline always appears directly below the wordmark at reduced accent opacity. Never sentence case. Never lowercase.

### Tier 2: TITLES (section headings, page headlines)

| Property | Value |
|---|---|
| Font | `var(--font-orbitron)` |
| Size | `18–22px` |
| Weight | `600` (semibold) |
| Colour | `#ffffff` or `rgba(255,255,255,0.85)` |
| Tracking | `0.02em` |

**Usage:** Section headings ("Enterprise intelligence. Startup price."), page H1s, modal titles.

### Tier 3: MINI TITLES (labels, category headers, status tags)

| Property | Value |
|---|---|
| Font | `var(--font-orbitron)` |
| Size | `9–11px` |
| Weight | `600–700` (semibold to bold) |
| Transform | `uppercase` |
| Tracking | `0.18–0.28em` |
| Colour | `rgba(0,180,255,0.55)` (data labels) or `text-slate-600` (structural labels) |

**Usage:** "Evidence-grounded", "Pricing", "How it works", feature tags in overlays, badge text, section numbering on ops dashboard.

### Tier 4: BODY TEXT (descriptions, paragraphs, feature explanations)

| Property | Value |
|---|---|
| Font | `var(--font-share-tech-mono)` (default) or `var(--font-inter)` (long-form readability) |
| Size | `12–13px` |
| Weight | `400` (regular) |
| Line height | `leading-relaxed` (1.625) or `leading-[1.7]` (for Inter long-form) |
| Colour | `text-slate-500` (primary body) or `text-slate-400` (emphasis body) |
| Tracking | `0.01em` (Inter) or default (Share Tech Mono) |

**Usage:** Feature descriptions, plan descriptions, differentiation row body text, intelligence drawer content.

**Rule:** Use Share Tech Mono for short descriptions (1–2 sentences). Use Inter for paragraphs longer than 3 sentences (About overlay feature descriptions, brief content).

### Tier 5: MICRO TEXT (metadata, timestamps, tertiary info)

| Property | Value |
|---|---|
| Font | `var(--font-share-tech-mono)` |
| Size | `10–11px` |
| Weight | `400` |
| Colour | `text-slate-600` (secondary) or `text-slate-700` (tertiary) |

**Usage:** "From $9/mo", "Free trial on all plans", timestamps, confidence scores, "ESC to close", table cell data, footer lines.

---

## 4. ATMOSPHERE

Every page has three atmospheric layers stacked behind the content. These are global — they appear on every page, not just the landing page.

### Layer 1: Dot grid

```
position: fixed; inset: 0; pointer-events: none;
background-image: radial-gradient(rgba(255,255,255,0.85) 0.5px, transparent 0.5px);
background-size: 6px 6px;
opacity: 0.018;
```

Gives the canvas a subtle instrument-panel texture. Barely perceptible. Never distracting.

### Layer 2: Atmospheric glow

```
position: fixed; inset: 0; pointer-events: none;
background: radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,180,255,0.09) 0%, transparent 70%);
animation: glow-breathe 8s ease-in-out infinite;
```

A faint blue light bleeding down from the top of the viewport. Breathes slowly. Creates depth without weight.

### Layer 3: Electricity (landing page + public pages)

`ElectricityBackground.tsx` — client component rendering randomized SVG lightning bolts.

- Flash timing: erratic 2–5 second intervals
- 1–2 bolts per flash, 80–150ms duration
- Bolt opacity: `0.04–0.10`
- Glow layer: `strokeWidth: 6`, `opacity: 0.3`, `filter: blur(4px)`
- Colour: `#00B4FF`

**Rule:** Electricity appears on public-facing pages (landing, pricing, about, signup). It does NOT appear inside the authenticated app (radar, strategy, briefs) — the app interior is calm and operational, not atmospheric.

---

## 5. BORDERS AND DIVIDERS

| Type | Value | Usage |
|---|---|---|
| Section divider | `border-t border-[#0d1020]` | Between landing page sections |
| Card border | `border border-[#0d1020]` | Standard card containers |
| Highlighted card | `border border-[#00B4FF]/22` | Featured/selected cards |
| Accent line (top) | `linear-gradient(90deg, transparent, rgba(0,180,255,0.45), transparent)` | Top edge of panels, modals, overlays — 1px height |
| Panel border | `border-l` with `rgba(0,180,255,0.15)` | Side panels, drawers |
| Table row | `border-b border-[#0a0a1a]` | Table rows, list items |

**Rule:** Depth is communicated through border opacity and background luminance — never through box shadows. The only box shadow in the system is on highlighted cards: `0 0 30px rgba(0,180,255,0.04)`.

---

## 6. CARDS AND CONTAINERS

| Property | Value |
|---|---|
| Border radius | `rounded-[14px]` (cards), `rounded-full` (buttons, badges) |
| Background | `bg-[#020208]` (standard) or `bg-[#03030c]` (highlighted) |
| Padding | `px-5 py-5` (cards), `px-4 py-4` (compact cards) |
| Hover | `hover:-translate-y-0.5` with `transition-transform duration-300` |

**Accent line pattern for featured cards:**
```html
<div className="absolute -top-px inset-x-0 h-[1px] rounded-t-[14px]"
  style={{ background: "linear-gradient(90deg, transparent, rgba(0,180,255,0.45), transparent)" }}
/>
```

---

## 7. BUTTONS

| Type | Style |
|---|---|
| Primary CTA | `rounded-full bg-[#00B4FF] text-black font-semibold` + `.cta-pulse` animation |
| Secondary CTA | `rounded-full border border-[#1a2030] text-slate-400 hover:border-[#00B4FF]/25 hover:text-white` |
| Ghost link | `text-slate-500 hover:text-white transition-colors` (no border, no background) |
| Badge | `rounded-full bg-[#00B4FF]/10 px-2 py-0.5 text-[9px] font-bold uppercase text-[#00B4FF]` |

**Rule:** Primary CTAs are the only element with a solid `#00B4FF` background. Everything else uses the accent at reduced opacity.

---

## 8. DATA INDICATORS

| Indicator | Style |
|---|---|
| Bullet point | `h-1.5 w-1.5 rounded-full` with `background: rgba(0,180,255,0.55)` (standard) or `#00B4FF` (highlighted) |
| Status dot | `h-1.5 w-1.5 rounded-full` with `backgroundColor: {color}; boxShadow: 0 0 4px {color}99` |
| Confidence bar | `h-1 rounded-full bg-[#0d1020]` track + `bg-[#00B4FF]` fill |
| Price display | `text-[26px] font-bold text-white` with `/mo` suffix in `text-[13px] text-slate-500` |

---

## 9. SIGNAL COLOURS (data-semantic, never decorative)

| State | Colour | Hex | Usage |
|---|---|---|---|
| Stable / Active | Electric blue | `#00B4FF` | Baseline state, confirmed data |
| Rising / Warning | Amber | `#f59e0b` | Elevated activity, pending states |
| Accelerating / Error | Red | `#ef4444` | Critical threshold, errors, failures |
| Cooling / Inactive | Slate | `#64748b` | Dormant, no activity |

**Rule:** These colours carry data meaning. They are never used for decoration. A red element always means something is wrong or critical. An amber element always means something needs attention.

---

## 10. MOTION

All animation is slow, smooth, and purposeful. Nothing bounces. Nothing snaps. Nothing accelerates on hover.

| Animation | Duration | Curve | Purpose |
|---|---|---|---|
| `page-enter` | `0.22s` | `ease-out` | Route transitions |
| `content-reveal` | `0.18s` | `ease-out` | Panel/overlay open |
| `hero-fade-up` | `0.60s` | `cubic-bezier(0.22,1,0.36,1)` | Landing stagger entrance |
| `glow-breathe` | `8s` | `ease-in-out` | Atmospheric glow loop |
| `cta-pulse` | `3s` | `ease-in-out` | Primary CTA glow |
| `tagline-sheen` | `6s` | `ease-in-out` | Electric flicker + gradient sweep |
| `skeleton-pulse` | `1.8s` | `ease-in-out` | Loading skeleton |
| Hover | — | `transition-colors` | Colour shifts only — no scale, no bounce |
| Card hover | `0.3s` | `duration-300` | `-translate-y-0.5` (subtle lift) |

**Stagger pattern (hero):** `0ms → 120ms → 220ms → 320ms → 440ms → 560ms`

**Rule:** If an element moves, it moves slowly. If an element glows, it glows intermittently. Nothing demands attention — the user directs their own focus.

---

## 11. SCROLLBAR

```css
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(0,180,255,0.15); border-radius: 2px; }
::-webkit-scrollbar-thumb:hover { background: rgba(0,180,255,0.28); }
```

---

## 12. TEXT SELECTION

```css
::selection { background: rgba(0,180,255,0.18); color: #ffffff; }
```

---

## 13. LOGO

SVG radar instrument. Concentric rings (4) with rotating sweep arm and pulsing centre dot.

- Viewbox: `46×46`, origin `(23, 23)`
- Ring radii: `21.5`, `15`, `9`, `4`
- All elements in `#00B4FF` — no other colours
- Sweep arm: `9s linear` continuous rotation
- Ring pulse: `3.5s easeInOut` staggered by `0.6s`
- Centre dot: `r=2`, pulses `70–100%` opacity on `2s` loop
- Signal nodes: 4 small blips (`r=0.9–1.2`) appearing/disappearing on staggered cycles
- Click sound: futuristic crystalline ding (C6 + shimmer + metallic echo, 0.5s)

---

## 14. VOICE

- Functional. One sentence does one job.
- Never "dashboard" — always "radar", "instrument", "signal", "movement".
- Precision language: "Confidence-gated", "Evidence-grounded", "Early detection".
- Error messages are direct: "Adjust your search or clear filters."
- Empty states are informational: "No targets found."
- Loading states reflect system activity: "Adding rivals to your radar..."
- Never exclamation marks. Never emoji in UI chrome.

---

## 15. WHAT THIS AESTHETIC IS NOT

- Not a consumer product. No pastels, no rounded-everything, no playful micro-animations.
- Not a generic SaaS dashboard. No gradient backgrounds, no coloured sidebar, no card grids with icons.
- Not enterprise grey. The black-and-blue identity is intentional. Not navy. Not purple. Not green.
- Not loud. The single accent colour is used sparingly. When it appears, it means something.
- Not decorative. Every visual element encodes data or serves a structural purpose. Nothing exists for aesthetic-only reasons.

The product feels like a classified intelligence terminal. Calm. Authoritative. Precise.

---

## 16. APPLYING TO A NEW PAGE

To build any new page that conforms to the Metrivant aesthetic:

1. Set `bg-[#000002] text-white` on the root container
2. Add dot grid layer (Layer 1) and atmospheric glow layer (Layer 2)
3. Add electricity layer (Layer 3) if the page is public-facing
4. Use Tier 2 for the page heading (Orbitron, 18–22px, semibold, white)
5. Use Tier 3 for section labels (Orbitron, 9–11px, uppercase, accent-dim)
6. Use Tier 4 for body text (Share Tech Mono or Inter, 12–13px, slate-500)
7. Use Tier 5 for metadata (Share Tech Mono, 10–11px, slate-600/700)
8. Wrap cards in `rounded-[14px] border border-[#0d1020] bg-[#020208]`
9. Use accent line pattern on featured/highlighted cards
10. All CTAs are `rounded-full` — primary in `bg-[#00B4FF] text-black`, secondary in border-only
11. Separate sections with `border-t border-[#0d1020]`
12. All hover states are colour transitions only — no scale except subtle card lift

If it doesn't look like it belongs on the landing page, it doesn't belong in Metrivant.
