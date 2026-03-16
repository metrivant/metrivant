// ── Types ─────────────────────────────────────────────────────────────────────

export type Signal = {
  id: string;
  competitor_id: string;
  competitor_name: string;
  section_type: string | null;
  signal_type: string | null;
  interpretation: string | null;
};

export type SignalCluster = {
  theme_key: string;
  theme_label: string;
  competitor_id: string;
  competitor_name: string;
  signals: Signal[];
};

export type ClusterResult = {
  clusters: SignalCluster[];
  unclustered: Signal[];
};

// ── Theme map ─────────────────────────────────────────────────────────────────
// Rules are checked in priority order:
//   1. exact (section_type + signal_type) match
//   2. section_type-only match
//   3. signal_type-only match
// First match wins. Signals that match nothing become unclustered.

type ThemeRule = {
  section_type?: string;
  signal_type?: string;
  theme_key: string;
  theme_label: string;
};

const THEME_MAP: ThemeRule[] = [
  // Pricing — most specific first
  { section_type: "pricing",   signal_type: "pricing_strategy_shift", theme_key: "pricing",     theme_label: "Pricing Strategy"     },
  { section_type: "pricing",                                           theme_key: "pricing",     theme_label: "Pricing Strategy"     },
  {                             signal_type: "pricing_strategy_shift", theme_key: "pricing",     theme_label: "Pricing Strategy"     },

  // Product / features
  { section_type: "features",  signal_type: "product_expansion",      theme_key: "product",     theme_label: "Product"              },
  { section_type: "changelog", signal_type: "product_expansion",      theme_key: "product",     theme_label: "Product"              },
  { section_type: "features",                                          theme_key: "product",     theme_label: "Product"              },
  { section_type: "changelog",                                         theme_key: "product",     theme_label: "Product"              },
  {                             signal_type: "product_expansion",      theme_key: "product",     theme_label: "Product"              },
  {                             signal_type: "feature_launch",         theme_key: "product",     theme_label: "Product"              },

  // Positioning / messaging
  { section_type: "homepage",  signal_type: "market_reposition",      theme_key: "positioning", theme_label: "Positioning"          },
  {                             signal_type: "market_reposition",      theme_key: "positioning", theme_label: "Positioning"          },

  // Enterprise motion
  {                             signal_type: "enterprise_push",        theme_key: "enterprise",  theme_label: "Enterprise"           },

  // Ecosystem / partnerships
  {                             signal_type: "ecosystem_expansion",    theme_key: "ecosystem",   theme_label: "Ecosystem"            },

  // Hiring signals
  { section_type: "careers",                                           theme_key: "hiring",      theme_label: "Hiring"               },

  // Comms / content
  { section_type: "newsroom",                                          theme_key: "comms",       theme_label: "Communications"       },
  { section_type: "blog",                                              theme_key: "comms",       theme_label: "Communications"       },
];

// ── Theme resolution ──────────────────────────────────────────────────────────

function resolveTheme(signal: Signal): { theme_key: string; theme_label: string } | null {
  // Pass 1: exact (section_type + signal_type) match
  for (const rule of THEME_MAP) {
    if (
      rule.section_type !== undefined &&
      rule.signal_type  !== undefined &&
      rule.section_type === signal.section_type &&
      rule.signal_type  === signal.signal_type
    ) {
      return { theme_key: rule.theme_key, theme_label: rule.theme_label };
    }
  }

  // Pass 2: section_type-only match
  for (const rule of THEME_MAP) {
    if (
      rule.section_type !== undefined &&
      rule.signal_type  === undefined &&
      rule.section_type === signal.section_type
    ) {
      return { theme_key: rule.theme_key, theme_label: rule.theme_label };
    }
  }

  // Pass 3: signal_type-only match
  for (const rule of THEME_MAP) {
    if (
      rule.section_type === undefined &&
      rule.signal_type  !== undefined &&
      rule.signal_type  === signal.signal_type
    ) {
      return { theme_key: rule.theme_key, theme_label: rule.theme_label };
    }
  }

  return null;
}

// ── Cluster function ──────────────────────────────────────────────────────────

export function clusterSignals(signals: Signal[]): ClusterResult {
  const clusterMap = new Map<string, SignalCluster>();
  const unclustered: Signal[] = [];

  for (const signal of signals) {
    const theme = resolveTheme(signal);

    if (!theme) {
      unclustered.push(signal);
      continue;
    }

    const key = `${signal.competitor_id}::${theme.theme_key}`;

    if (!clusterMap.has(key)) {
      clusterMap.set(key, {
        theme_key:       theme.theme_key,
        theme_label:     theme.theme_label,
        competitor_id:   signal.competitor_id,
        competitor_name: signal.competitor_name,
        signals:         [],
      });
    }

    clusterMap.get(key)!.signals.push(signal);
  }

  // Most-signal clusters first; ties broken alphabetically by competitor name
  const clusters = Array.from(clusterMap.values()).sort((a, b) => {
    if (b.signals.length !== a.signals.length) return b.signals.length - a.signals.length;
    return a.competitor_name.localeCompare(b.competitor_name);
  });

  return { clusters, unclustered };
}
