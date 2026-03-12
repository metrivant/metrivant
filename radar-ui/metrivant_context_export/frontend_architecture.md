# Metrivant — Frontend Architecture

## Stack

- **Next.js 16.1.6** — App Router, Turbopack, React Server Components
- **React 19.2.3** — concurrent rendering
- **TypeScript** — strict mode, no `any` unless unavoidable
- **Tailwind CSS v4** — utility-first styling via PostCSS
- **Framer Motion 12.x** — animation (radar sweep, blip pulse, drawer transitions)
- **D3 Scale** — radar blip positioning math
- **PostHog JS** — client-side analytics
- **Supabase SSR** — cookie-based session management

## Directory Structure

```
radar-ui/
├── app/
│   ├── layout.tsx                  # Root layout: fonts, PostHogProvider
│   ├── page.tsx                    # Landing page (public)
│   ├── login/page.tsx              # Auth: email/password login
│   ├── signup/page.tsx             # Auth: new account registration
│   ├── pricing/page.tsx            # Pricing page (public)
│   ├── globals.css                 # Global styles
│   ├── error.tsx                   # Next.js error boundary
│   ├── loading.tsx                 # Root loading state
│   ├── manifest.ts                 # Web app manifest
│   ├── robots.ts                   # robots.txt
│   ├── sitemap.ts                  # sitemap.xml
│   │
│   ├── app/                        # Protected app (auth-gated)
│   │   ├── layout.tsx              # Auth guard + PostHogIdentify
│   │   ├── page.tsx                # Radar page (MAIN)
│   │   ├── onboarding/page.tsx     # Add first competitor
│   │   ├── settings/page.tsx       # Account settings
│   │   ├── billing/page.tsx        # Subscription management
│   │   ├── alerts/
│   │   │   ├── page.tsx            # Alert feed
│   │   │   └── MarkReadButton.tsx  # Mark alerts as read
│   │   ├── briefs/
│   │   │   ├── page.tsx            # Weekly intelligence briefs
│   │   │   ├── BriefViewer.tsx     # Detailed brief renderer
│   │   │   └── BriefViewedTracker.tsx  # Analytics: brief_viewed
│   │   ├── discover/
│   │   │   ├── page.tsx            # Competitor discovery
│   │   │   └── DiscoverClient.tsx  # Discovery UI client component
│   │   ├── strategy/
│   │   │   ├── page.tsx            # Strategic insights
│   │   │   ├── StrategyTracker.tsx # Analytics: strategy_viewed
│   │   │   └── StrategyActionButton.tsx  # Analytics: strategy_action_clicked
│   │   ├── market-map/
│   │   │   ├── page.tsx            # Market positioning map
│   │   │   └── MarketMap.tsx       # 2D scatter plot component
│   │   └── lemonade/               # (experimental testing feature)
│   │
│   └── api/
│       ├── auth/
│       │   ├── callback/route.ts   # Supabase OAuth callback
│       │   └── signout/route.ts    # Signout handler
│       ├── competitor-detail/route.ts   # Proxy to backend competitor-detail
│       ├── check-signals/route.ts  # Hourly: check new signals, send alerts
│       ├── generate-brief/route.ts # Weekly: AI brief generation + email
│       ├── events/signup/route.ts  # Track signup event + welcome email
│       ├── onboard-competitor/route.ts  # Add competitor + confirmation email
│       ├── discover/track/route.ts # Add competitor from discovery
│       ├── alerts/route.ts         # GET alerts for user
│       ├── alerts/read/route.ts    # POST mark alerts as read
│       ├── update-momentum/route.ts     # Cron: update momentum scores
│       ├── momentum/history/route.ts    # GET momentum history
│       ├── strategic-analysis/route.ts  # Cron: cross-competitor analysis
│       └── update-positioning/route.ts  # Cron: market map positioning
│
├── components/
│   ├── Radar.tsx                   # Main radar visualization (1500+ lines)
│   ├── MomentumSparkline.tsx       # Velocity trend chart
│   ├── NotificationBell.tsx        # Alert count badge
│   ├── PostHogProvider.tsx         # PostHog SDK init wrapper
│   ├── PostHogIdentify.tsx         # Identify user on login
│   ├── PublicNav.tsx               # Navigation for public pages
│   └── RadarViewedTracker.tsx      # Analytics: radar_viewed
│
└── lib/
    ├── supabase/
    │   ├── client.ts               # Browser client (createBrowserClient)
    │   ├── server.ts               # Server client (createServerClient + cookies)
    │   └── service.ts              # Service role client (RLS bypass)
    ├── api.ts                      # Types + fetchers: radar feed, competitor detail
    ├── posthog.ts                  # Canonical PostHog wrapper (capture, identify, reset)
    ├── email.ts                    # Canonical Resend client + email templates
    ├── alert.ts                    # Alert email template builder
    ├── brief.ts                    # Brief generation + email template
    ├── catalog.ts                  # Competitor catalog utilities
    ├── format.ts                   # Date/number formatters (formatRelative, etc.)
    ├── momentum.ts                 # Momentum score utilities
    ├── positioning.ts              # Market map positioning utilities
    └── strategy.ts                 # Strategic analysis utilities
```

## Auth Flow

### Login
1. User submits email/password at `/login`
2. `supabase.auth.signInWithPassword()` — Supabase sets auth cookies
3. Redirect to `/app`
4. `app/app/layout.tsx` reads cookies, verifies session
5. `PostHogIdentify` fires `posthog.identify(userId, { email })`

### Signup
1. User submits form at `/signup`
2. `supabase.auth.signUp()` — Supabase sends confirmation email
3. POST to `/api/events/signup` — fires PostHog `signup` event + welcome email
4. User confirms email → Supabase OAuth callback at `/api/auth/callback`
5. Redirect to `/app/onboarding`

### Auth Guard
`app/app/layout.tsx` — server component that checks `supabase.auth.getUser()`. Redirects to `/login` if no valid session. Wraps all `/app/*` routes.

### Signout
`/api/auth/signout` — calls `supabase.auth.signOut()`, calls `posthog.reset()`, redirects to `/`.

## Radar Component (`components/Radar.tsx`)

The core UI component. ~1500 lines.

**Geometry:**
- SVG canvas: 1000×1000 viewBox, center (500, 500), outer radius 420
- 4 concentric rings at radii: 420, 360, 240, 120 (ring factors: 1, 0.857, 0.571, 0.286)
- Blips positioned radially: momentum_score → radial distance via D3 scaleLinear

**Sweep beam:**
- Two-layer SVG sector: wide dim trail (45°, phosphor memory effect) + narrow hot zone (12°, near leading edge)
- Duration: 12 seconds per revolution (slow, heavy, military radar feel)
- Clockwise rotation via Framer Motion

**Blip visuals:**
- Color: by movement_type (pricing=amber, positioning=blue, feature=green, etc.)
- Size: by signal_count (scaled radius)
- Glow: by recency (more recent = stronger pulse)

**Interactive state:**
- Click blip → `handleBlipClick(id)` → fetches `/api/competitor-detail`
- Selected blip enlarges, others dim
- Right-side drawer renders: signals, movements, evidence chain
- Keyboard: Escape to deselect

**Data flow:**
- Props: `competitors: RadarCompetitor[]` — from server-side `getRadarFeed()` on page load
- Detail: fetched client-side on selection (no SSR for detail to keep initial load fast)

## Server Components vs Client Components

**Server components** (no `"use client"`):
- `app/app/page.tsx` — radar page shell, initial data fetch
- `app/app/layout.tsx` — auth guard
- `app/app/briefs/page.tsx` — brief list fetch
- `app/app/strategy/page.tsx` — insights fetch
- `app/app/market-map/page.tsx` — positioning data fetch

**Client components** (`"use client"`):
- `components/Radar.tsx` — interactive, animated
- `components/RadarViewedTracker.tsx` — PostHog event on mount
- `app/app/briefs/BriefViewedTracker.tsx` — PostHog event on mount
- `app/app/strategy/StrategyTracker.tsx` — PostHog event on mount
- `app/app/strategy/StrategyActionButton.tsx` — interactive button with analytics
- `app/app/market-map/MarketMap.tsx` — interactive map
- `app/app/lemonade/LemonadeStreet.tsx` — experimental
- `app/app/discover/DiscoverClient.tsx` — search + add competitors
- `components/PostHogProvider.tsx` — PostHog SDK init
- `components/PostHogIdentify.tsx` — identify user
- `components/NotificationBell.tsx` — live alert count

## Tracker Component Pattern

Used to fire PostHog events from server-rendered pages without converting them to client components:

```typescript
// components/RadarViewedTracker.tsx
"use client";
import { useEffect } from "react";
import { capture } from "../lib/posthog";
export default function RadarViewedTracker() {
  useEffect(() => { capture("radar_viewed"); }, []);
  return null;
}
```

Same pattern for `BriefViewedTracker` and `StrategyTracker`.

## UI Design Language

- **Background**: `#000200` (near-black with green cast)
- **Accent**: `#2EE6A6` (teal/mint green)
- **Sweep**: phosphor green `rgba(46, 230, 166, 0.x)` at varying opacity
- **Font**: Inter (Google Fonts, preloaded)
- **Motion**: slow (12s sweep), subtle (glow pulse), premium (ease-in-out)
- **Layout**: full viewport (`h-screen w-screen overflow-hidden`), no scroll on radar page
- **Hierarchy**: radar is primary, drawer is secondary, evidence chain is tertiary

## Metadata and SEO

Configured in `app/layout.tsx`:
- `metadataBase`: `https://metrivant.com`
- Title template: `%s — Metrivant`
- OpenGraph: website type, full description
- Twitter card: summary
- Robots: index + follow
