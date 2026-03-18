import { NextResponse } from "next/server";
import { createServiceClient } from "../../../lib/supabase/service";
import { captureException, flush } from "../../../lib/sentry";
import { writeCronHeartbeat } from "../../../lib/cronHeartbeat";

export const maxDuration = 60;

// ── Types ──────────────────────────────────────────────────────────────────────

type ActionItem = {
  action_type:      string;  // defensive | offensive | monitoring
  urgency:          string;  // high | medium | low
  title:            string;
  description:      string;
  rationale:        string;
  competitor_names: string[];
};

type ContextInput = {
  competitor_name:  string;
  hypothesis:       string;
  confidence_level: string;
  strategic_arc:    string | null;
};

type MovementInput = {
  competitor_name:       string;
  movement_type:         string;
  confidence:            number;
  movement_summary:      string;
  strategic_implication: string | null;
};

// ── Auth ───────────────────────────────────────────────────────────────────────

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

// ── Prompt ─────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `\
You are a senior competitive strategist. Your job: synthesize competitor intelligence
into a ranked list of specific, concrete actions for a company to take.

Return valid JSON only — this exact schema:
{
  "actions": [
    {
      "action_type": "defensive | offensive | monitoring",
      "urgency": "high | medium | low",
      "title": "Imperative verb phrase, max 8 words, no hedging",
      "description": "One sentence: the exact thing to build, change, launch, accelerate, or stop.",
      "rationale": "One sentence: the specific competitor evidence that drives this recommendation.",
      "competitor_names": ["array of competitor names this responds to"]
    }
  ]
}

Rules:
- Return 5–8 actions, ranked by urgency × impact (highest-leverage first)
- defensive = respond to a confirmed competitor threat
- offensive = exploit a gap or weakness visible in competitor intelligence
- monitoring = a specific uncertainty to resolve before making a decision (only use for genuine unknowns)
- high urgency = act this week, medium = this month, low = this quarter
- Title must be a directive: "Launch X", "Accelerate Y", "Drop Z", "Publish A" — not "Consider" or "Evaluate"
- Description must name the specific feature, market, or asset — no generic statements
- Rationale must cite specific competitor names and the evidence type (e.g. "pricing change", "hiring spike", "product expansion")
- De-duplicate: if multiple competitors point to the same action, use one action with multiple competitor_names
- If competitor intelligence is thin (only low-confidence contexts), return monitoring-type actions only
- Never use: "leverage", "synergy", "holistic", "deep dive", "it's worth noting"
- Never recommend vague actions like "monitor competitors" or "improve your product"`;

function buildPrompt(contexts: ContextInput[], movements: MovementInput[]): string {
  const lines: string[] = [];

  if (contexts.length > 0) {
    lines.push("Competitor Intelligence Profiles:");
    lines.push("");
    for (const c of contexts) {
      lines.push(`${c.competitor_name} [${c.confidence_level.toUpperCase()} confidence]`);
      lines.push(`  Hypothesis: ${c.hypothesis}`);
      if (c.strategic_arc) {
        const arc = c.strategic_arc.length > 220 ? c.strategic_arc.slice(0, 220) + "…" : c.strategic_arc;
        lines.push(`  Arc: ${arc}`);
      }
      lines.push("");
    }
  }

  if (movements.length > 0) {
    lines.push("Active Movements (14-day window):");
    lines.push("");
    for (const m of movements) {
      const pct = Math.round(m.confidence * 100);
      lines.push(`- ${m.competitor_name}: ${m.movement_type.replace(/_/g, " ")} [${pct}% confidence]`);
      lines.push(`  ${m.movement_summary}`);
      if (m.strategic_implication) {
        lines.push(`  Implication: ${m.strategic_implication}`);
      }
    }
    lines.push("");
  }

  lines.push("Generate 5–8 specific, ranked strategic actions in response to the above intelligence.");
  return lines.join("\n");
}

// ── OpenAI call ────────────────────────────────────────────────────────────────

async function callOpenAI(
  apiKey:     string,
  prompt:     string
): Promise<ActionItem[]> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:           "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature:     0.20,
      max_tokens:      1200,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${body}`);
  }

  const json = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const parsed = JSON.parse(json.choices[0].message.content) as { actions?: ActionItem[] };
  return (parsed.actions ?? []).slice(0, 10);
}

// ── Core generation ────────────────────────────────────────────────────────────

function captureCheckIn(
  status:     "in_progress" | "ok" | "error",
  checkInId?: string
): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (require("@sentry/nextjs") as any).captureCheckIn?.({
      monitorSlug: "generate-actions",
      status,
      ...(checkInId ? { checkInId } : {}),
    }) as string | undefined;
  } catch { return undefined; }
}

async function runGeneration(): Promise<NextResponse> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  const checkInId = captureCheckIn("in_progress");
  const startedAt = Date.now();
  const supabase  = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb        = supabase as any;

  let orgsProcessed   = 0;
  let actionsInserted = 0;

  try {
    const { data: orgs, error: orgsError } = await sb
      .from("organizations")
      .select("id");

    if (orgsError) throw orgsError;

    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    for (const org of (orgs ?? []) as { id: string }[]) {
      try {
        // 1 — Intelligence contexts for this org
        const { data: ctxRows } = await sb
          .from("competitor_contexts")
          .select("competitor_name, hypothesis, confidence_level, strategic_arc")
          .eq("org_id", org.id)
          .not("hypothesis", "is", null)
          .order("signal_count", { ascending: false })
          .limit(15);

        const contexts: ContextInput[] = (ctxRows ?? []) as ContextInput[];

        // 2 — Active movements for this org's tracked competitors
        const { data: trackedRows } = await sb
          .from("tracked_competitors")
          .select("competitor_id")
          .eq("org_id", org.id);

        const trackedIds = ((trackedRows ?? []) as { competitor_id: string }[])
          .map((r) => r.competitor_id);

        const movements: MovementInput[] = [];
        if (trackedIds.length > 0) {
          const { data: compRows } = await supabase
            .from("competitors")
            .select("id, name")
            .in("id", trackedIds);
          const nameById = new Map(
            ((compRows ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name])
          );

          const { data: mvRows } = await sb
            .from("strategic_movements")
            .select("competitor_id, movement_type, confidence, movement_summary, strategic_implication")
            .in("competitor_id", trackedIds)
            .not("movement_summary", "is", null)
            .gte("last_seen_at", fourteenDaysAgo)
            .order("confidence", { ascending: false })
            .limit(10);

          for (const r of (mvRows ?? []) as {
            competitor_id:        string;
            movement_type:        string;
            confidence:           number;
            movement_summary:     string | null;
            strategic_implication: string | null;
          }[]) {
            if (!r.movement_summary) continue;
            movements.push({
              competitor_name:       nameById.get(r.competitor_id) ?? "Unknown",
              movement_type:         r.movement_type,
              confidence:            r.confidence,
              movement_summary:      r.movement_summary,
              strategic_implication: r.strategic_implication,
            });
          }
        }

        // Skip if no intelligence to synthesize
        if (contexts.length === 0 && movements.length === 0) continue;

        // 3 — Generate actions via GPT-4o
        const prompt  = buildPrompt(contexts, movements);
        const actions = await callOpenAI(openaiKey, prompt);

        if (actions.length === 0) continue;

        // 4 — Replace open actions for this org
        await sb
          .from("strategic_actions")
          .delete()
          .eq("org_id", org.id)
          .eq("status", "open");

        const now = new Date().toISOString();
        const rows = actions.map((a, i) => ({
          org_id:           org.id,
          action_type:      a.action_type ?? "monitoring",
          urgency:          a.urgency     ?? "low",
          priority:         i + 1,
          title:            a.title       ?? "",
          description:      a.description ?? "",
          rationale:        a.rationale   ?? null,
          competitor_names: Array.isArray(a.competitor_names) ? a.competitor_names : [],
          status:           "open",
          generated_at:     now,
        }));

        const { error: insertError } = await sb
          .from("strategic_actions")
          .insert(rows);

        if (insertError) {
          captureException(insertError, { route: "generate-actions", org_id: org.id });
        } else {
          actionsInserted += rows.length;
          orgsProcessed++;
        }
      } catch (orgErr) {
        captureException(
          orgErr instanceof Error ? orgErr : new Error(String(orgErr)),
          { route: "generate-actions", org_id: org.id }
        );
      }
    }

    const durationMs = Date.now() - startedAt;
    await writeCronHeartbeat(supabase, "/api/generate-actions", "ok", durationMs, actionsInserted);
    captureCheckIn("ok", checkInId);
    await flush();

    return NextResponse.json({
      ok:               true,
      orgs_processed:   orgsProcessed,
      actions_inserted: actionsInserted,
      durationMs,
    });
  } catch (error) {
    captureException(error instanceof Error ? error : new Error(String(error)));
    captureCheckIn("error", checkInId);
    await flush();
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

// ── Route handlers ─────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runGeneration();
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runGeneration();
}
