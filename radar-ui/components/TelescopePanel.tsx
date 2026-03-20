"use client";

/**
 * TelescopePanel — Signal Review Instrument
 *
 * Scrollable feed of recent signals across all tracked competitors.
 * Each card: competitor name, signal type, summary, confidence, time.
 * Fills the full remaining sidebar height — no dead space.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type TelescopeSignal = {
  id: string;
  signal_type: string;
  summary: string | null;
  confidence_score: number | null;
  detected_at: string;
  competitor_name: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSignalType(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function confColor(conf: number | null): string {
  if (conf == null) return "rgba(100,116,139,0.60)";
  if (conf >= 0.65) return "rgba(46,230,166,0.80)";
  if (conf >= 0.40) return "rgba(245,158,11,0.70)";
  return "rgba(100,116,139,0.60)";
}

function confLabel(conf: number | null): string {
  if (conf == null) return "—";
  return (conf * 100).toFixed(0) + "%";
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TelescopePanel({ signals }: { signals: TelescopeSignal[] }) {
  const count = signals.length;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.06)",
        background: "#040404",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "7px 10px 6px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: "rgba(46,230,166,0.55)",
            textTransform: "uppercase",
          }}
        >
          Telescope
        </span>
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 8,
            letterSpacing: "0.08em",
            color: "rgba(255,255,255,0.22)",
          }}
        >
          {count} signal{count !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Signal feed — scrollable, fills remaining space ── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {count === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              fontFamily: "monospace",
              fontSize: 8,
              letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.14)",
              textTransform: "uppercase",
              padding: "0 12px",
              textAlign: "center",
            }}
          >
            No signals detected
          </div>
        ) : (
          signals.map((s, i) => (
            <div
              key={s.id}
              style={{
                padding: "8px 10px 7px",
                borderBottom:
                  i < count - 1
                    ? "1px solid rgba(255,255,255,0.04)"
                    : "none",
              }}
            >
              {/* Row 1: competitor + time */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 4,
                  marginBottom: 3,
                }}
              >
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 8.5,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.72)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                  }}
                >
                  {s.competitor_name}
                </span>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 7,
                    color: "rgba(255,255,255,0.18)",
                    flexShrink: 0,
                  }}
                >
                  {timeAgo(s.detected_at)}
                </span>
              </div>

              {/* Row 2: signal type badge + confidence */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  marginBottom: s.summary ? 3 : 0,
                }}
              >
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 7,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    color: "rgba(46,230,166,0.65)",
                    textTransform: "uppercase",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                  }}
                >
                  {formatSignalType(s.signal_type)}
                </span>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 7,
                    fontWeight: 600,
                    color: confColor(s.confidence_score),
                    flexShrink: 0,
                  }}
                >
                  {confLabel(s.confidence_score)}
                </span>
              </div>

              {/* Row 3: summary (if present) */}
              {s.summary && (
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 7.5,
                    lineHeight: "1.4",
                    color: "rgba(255,255,255,0.30)",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {s.summary}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
