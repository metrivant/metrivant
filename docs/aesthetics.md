# METRIVANT AESTHETIC GUIDELINES

This document defines the visual identity and design system for Metrivant.

---

## CORE PRINCIPLE

Metrivant is a precision instrument for competitive intelligence. The aesthetic communicates: calm, authoritative, trustworthy. Not gamified. Not noisy. Not desperate for attention. The user opens it and feels like they're looking at the truth.

---

## COLOR PALETTE

### Monochrome Foundation

**Backgrounds:**
- Primary: `#000000` (pure black) or `#000002` (near-black)
- Surfaces: `rgba(0,0,0,0.50)` to `rgba(0,0,0,0.98)` (layered blacks)
- Cards/panels: `#020208`, `#03030c`, `#060906`, `#070707` (very dark grays)

**Borders:**
- Primary: `rgba(255,255,255,0.06)` to `rgba(255,255,255,0.12)` (subtle white, 6-12% opacity)
- Secondary: `rgba(255,255,255,0.04)` to `rgba(255,255,255,0.08)` (very subtle, 4-8% opacity)

**Text:**
- Primary (headings): `#ffffff` or `rgba(255,255,255,0.92)` (white, 92-100% opacity)
- Secondary (body): `rgba(255,255,255,0.45)` to `rgba(255,255,255,0.65)` (white, 45-65% opacity)
- Tertiary (labels): `rgba(255,255,255,0.20)` to `rgba(255,255,255,0.35)` (white, 20-35% opacity)
- Muted (hints): `rgba(255,255,255,0.12)` to `rgba(255,255,255,0.18)` (white, 12-18% opacity)

**Slate tones (for non-critical text):**
- `#64748b` (slate-500)
- `rgba(100,116,139,...)` with varying opacity

### Accent Colors

**Electric Blue (primary accent) — #00B4FF**
- Use ONLY for:
  - Active/selected states
  - Interactive elements (buttons, links)
  - Brand identity (logo, wordmark)
  - CTAs and primary actions
- Common opacities:
  - Solid: `#00B4FF`
  - rgba: `rgba(0,180,255,0.85)` (strong), `rgba(0,180,255,0.50)` (medium), `rgba(0,180,255,0.25)` (subtle)
  - Borders: `rgba(0,180,255,0.12)` to `rgba(0,180,255,0.40)`
  - Backgrounds: `rgba(0,180,255,0.02)` to `rgba(0,180,255,0.08)` (very subtle tints)
  - Glows: `0 0 8px rgba(0,180,255,0.40)` (active state), `0 0 30px rgba(0,180,255,0.04)` (ambient)

**Data Signal Green (data only) — rgba(46,230,166,...) or #2EE6A6**
- Use ONLY for:
  - Data visualization (signal freshness, momentum states)
  - Status indicators representing "active" or "healthy" system state
  - NEVER use for UI chrome, buttons, or navigation

**Amber (warnings) — rgba(245,158,11,...) or #f59e0b**
- Plan limit warnings
- Emerging/rising indicators
- Time-sensitive notices

**Red (errors/destructive) — rgba(239,68,68,...) or #ef4444**
- Error states
- Destructive actions (delete, remove)
- Critical alerts

---

## TYPOGRAPHY

### Primary Fonts

**Headings & Brand:**
- Orbitron (bold, 600-900 weight)
- All-caps for brand name: `METRIVANT`
- Letter-spacing: `0.08em` to `0.14em`

**Body & Interface:**
- Inter (300-700 weight)
- Letter-spacing: `0.01em` to `0.04em`

**Monospace/Technical:**
- Share Tech Mono (400 weight)
- For labels, metadata, technical readouts
- Letter-spacing: `0.22em` to `0.34em` (very wide)

**Alternative (Discover page):**
- Space Grotesk (300-600 weight)
- Modern, geometric, clean
- Letter-spacing: `0.01em` to `0.03em`

### Type Scale

- Hero/Display: `28px` to `34px`
- Headings: `18px` to `28px`
- Body: `13px` to `15px`
- UI Elements: `11px` to `14px`
- Labels/Metadata: `9px` to `12px`
- Micro: `8px` to `10px`

---

## VISUAL ELEMENTS

### Dot Grid Background

```css
background-image: radial-gradient(rgba(255,255,255,0.85) 0.5px, transparent 0.5px);
background-size: 6px 6px;
opacity: 0.016 to 0.018;
```

Used on: landing page, onboarding, login/signup, discover

### Atmospheric Glow

```css
background: radial-gradient(
  ellipse 80% 50% at 50% -10%,
  rgba(0,180,255,0.06) 0%,
  transparent 70%
);
```

Subtle top-center gradient for depth. May animate with `glow-breathe` 8s ease-in-out infinite.

### Top Edge Line (Brand Accent)

```css
background: linear-gradient(
  90deg,
  transparent 0%,
  rgba(0,180,255,0.18) 40%,
  rgba(0,180,255,0.30) 50%,
  rgba(0,180,255,0.18) 60%,
  transparent 100%
);
```

1px height, positioned at top of header. Electric blue gradient fading to edges.

### Borders & Dividers

- Border radius: `3px`, `4px`, `6px`, `8px`, `10px`, `12px` (rounded corners, never sharp)
- Button radius: `rounded-full` (pill shape for CTAs)
- Card radius: `12px` to `18px`

### Shadows

- Dropdown/Modal: `0 8px 32px rgba(0,0,0,0.85)` or `0 16px 48px rgba(0,0,0,0.95)`
- Card hover: `0 0 30px rgba(0,180,255,0.04)`
- Active glow: `0 0 8px rgba(0,180,255,0.40)`

---

## ANIMATION PRINCIPLES

### Timing

- Standard transitions: `150ms` to `300ms`
- Smooth easing: `ease-in-out`, `cubic-bezier(...)`
- Sonar/radar pulse: `12s` to `24s` (very slow, ambient)

### Motion Quality

- **Smooth** — no jarring transitions
- **Slow** — deliberate, measured
- **Subtle** — premium, not flashy
- **Purposeful** — every animation has a reason

### Common Patterns

- Fade-in on mount: `opacity: 0 → 1`
- Scale on mount: `scale: 0.85 → 1`
- Stagger delay: `index * 0.012s` (subtle cascade)

---

## COMPONENT PATTERNS

### Buttons

**Primary CTA:**
```css
background: #00B4FF;
color: #000000 (black text on blue);
border-radius: rounded-full;
font-weight: 600-700;
hover: opacity 90%;
```

**Secondary:**
```css
border: 1px solid rgba(0,180,255,0.35);
background: rgba(0,180,255,0.07);
color: #00B4FF;
border-radius: rounded-full;
```

**Tertiary/Ghost:**
```css
border: 1px solid rgba(255,255,255,0.08);
background: transparent;
color: rgba(255,255,255,0.35);
hover: border rgba(255,255,255,0.22), color rgba(255,255,255,0.75);
```

### Input Fields

```css
border: 1px solid rgba(255,255,255,0.08);
background: rgba(0,0,0,0.50) or #03030c;
color: #ffffff;
placeholder: rgba(255,255,255,0.18) to rgba(255,255,255,0.25);
focus: border rgba(0,180,255,0.30), ring 1px rgba(0,180,255,0.20);
```

### Cards

```css
border: 1px solid rgba(255,255,255,0.06) to rgba(255,255,255,0.10);
background: #020208, #03030c, or rgba(0,0,0,0.80);
border-radius: 10px to 16px;
```

### Pills/Badges

```css
border: 1px solid rgba(0,180,255,0.12);
background: rgba(0,180,255,0.02);
color: rgba(0,180,255,0.50);
border-radius: rounded-full;
font-size: 9px to 11px;
letter-spacing: 0.04em to 0.14em;
text-transform: uppercase;
```

---

## WHAT TO AVOID

❌ **Green UI chrome** — green is for data signals only, never navigation or buttons
❌ **Bright neon overload** — keep electric blue usage restrained and purposeful
❌ **Decorative complexity** — prefer data-driven visuals over abstract metaphors
❌ **Sharp corners** — always use subtle border-radius
❌ **High-contrast borders** — keep borders subtle (6-12% white opacity)
❌ **Rainbow color palette** — stick to monochrome + electric blue + signal colors
❌ **Busy animations** — motion should be slow, smooth, and subtle
❌ **Emojis** — unless explicitly requested by user

---

## RESPONSIVE BREAKPOINTS

- Mobile: `< 768px` (md breakpoint)
- Tablet: `768px - 1024px`
- Desktop: `> 1024px`

Mobile-first approach for public pages. Desktop-first for app (with mobile gate on radar).

---

## ACCESSIBILITY

- Maintain 4.5:1 contrast ratio minimum for body text
- Active/selected states must be unmistakable (not subtle)
- Focus states visible on keyboard navigation
- Interactive elements min 44×44px touch target on mobile

---

## SUMMARY

The aesthetic is: **monochrome minimal with electric blue precision accents**.

- Calm, dark, authoritative
- Data-driven, not decorative
- Trustworthy, not flashy
- Premium, not cheap
- Precision instrument, not consumer dashboard

Every visual choice reinforces: "This is a serious tool for serious operators."
