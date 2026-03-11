import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PageRow {
  id: string;
  page_type: string;
}

interface InterpretationRow {
  summary: string | null;
  strategic_implication: string | null;
  recommended_action: string | null;
  urgency: number | null;
  confidence: number | null;
  old_content: string | null;
  new_content: string | null;
}

interface SignalQueryRow {
  id: string;
  signal_type: string;
  severity: string;
  detected_at: string;
  monitored_page_id: string;
  interpretations: InterpretationRow | InterpretationRow[] | null;
}

interface SignalResponse {
  id: string;
  signal_type: string;
  severity: string;
  detected_at: string;
  page_type: string;
  summary: string | null;
  strategic_implication: string | null;
  recommended_action: string | null;
  urgency: number | null;
  confidence: number | null;
  previous_excerpt: string | null;
  current_excerpt: string | null;
}

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();

  const id = req.query?.id as string | undefined;

  if (!id || !UUID_RE.test(id)) {
    return res.status(400).json({ ok: false, error: "id required (uuid)" });
  }

  try {
    // 1. Competitor metadata
    const { data: comp, error: compError } = await supabase
      .from("competitors")
      .select("id, name, website_url")
      .eq("id", id)
      .eq("active", true)
      .maybeSingle();

    if (compError) throw compError;

    if (!comp) {
      return res.status(404).json({ ok: false, error: "competitor not found" });
    }

    // 2. All strategic movements, most recent first
    const { data: movementRows, error: movementsError } = await supabase
      .from("strategic_movements")
      .select(
        "movement_type, confidence, signal_count, velocity, first_seen_at, last_seen_at"
      )
      .eq("competitor_id", id)
      .order("last_seen_at", { ascending: false })
      .limit(5);

    if (movementsError) throw movementsError;

    // 3. Monitored page IDs — needed to scope the signals query
    const { data: pages, error: pagesError } = await supabase
      .from("monitored_pages")
      .select("id, page_type")
      .eq("competitor_id", id)
      .eq("active", true);

    if (pagesError) throw pagesError;

    const typedPages = (pages ?? []) as PageRow[];
    const pageIds = typedPages.map((p) => p.id);
    const pageTypeMap = new Map<string, string>(
      typedPages.map((p) => [p.id, p.page_type])
    );

    // 4. Recent interpreted signals with joined interpretations
    let signals: SignalResponse[] = [];

    if (pageIds.length > 0) {
      const { data: signalRows, error: signalsError } = await supabase
        .from("signals")
        .select(
          `id, signal_type, severity, detected_at, monitored_page_id,
           interpretations ( summary, strategic_implication, recommended_action, urgency, confidence, old_content, new_content )`
        )
        .in("monitored_page_id", pageIds)
        .eq("interpreted", true)
        .order("detected_at", { ascending: false })
        .limit(5);

      if (signalsError) throw signalsError;

      signals = ((signalRows ?? []) as SignalQueryRow[]).map((row) => {
        const interp: InterpretationRow | null = Array.isArray(row.interpretations)
          ? (row.interpretations[0] ?? null)
          : row.interpretations;
        return {
          id: row.id,
          signal_type: row.signal_type,
          severity: row.severity,
          detected_at: row.detected_at,
          page_type: pageTypeMap.get(row.monitored_page_id) ?? "unknown",
          summary: interp?.summary ?? null,
          strategic_implication: interp?.strategic_implication ?? null,
          recommended_action: interp?.recommended_action ?? null,
          urgency: interp?.urgency ?? null,
          confidence: interp?.confidence ?? null,
          previous_excerpt: interp?.old_content ?? null,
          current_excerpt: interp?.new_content ?? null,
        };
      });
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("competitor_detail", {
      competitorId: id,
      movementsReturned: movementRows?.length ?? 0,
      signalsReturned: signals.length,
      runtimeDurationMs,
    });

    return res.status(200).json({
      ok: true,
      competitor: {
        id: comp.id,
        name: comp.name,
        website_url: comp.website_url,
      },
      movements: movementRows ?? [],
      signals,
      monitoredPages: typedPages.map((p) => ({ page_type: p.page_type })),
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
}

export default withSentry("competitor-detail", handler);
