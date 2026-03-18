import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";
import {
  detectClusteredSuspects,
  fetchHtmlContext,
  proposeSelector,
  validateProposedSelector,
} from "../lib/selector-repair";

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt  = Date.now();
  const openaiKey  = process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    res.status(500).json({ error: "OPENAI_API_KEY not configured" });
    return;
  }

  const checkInId = Sentry.captureCheckIn({ monitorSlug: "suggest-selector-repairs", status: "in_progress" });

  let candidatesDetected               = 0;
  let repairProposalsCreated           = 0;
  let repairProposalsValidated         = 0;
  let repairProposalsRejectedByValidation = 0;
  let autoAccepted                     = 0;

  try {
    const candidates = await detectClusteredSuspects();
    candidatesDetected = candidates.length;

    for (const candidate of candidates) {
      try {
        // 1 — Re-fetch live page and extract HTML neighborhood
        const htmlContext = await fetchHtmlContext(
          candidate.page_url,
          candidate.previous_selector,
          candidate.section_type
        );

        if (!htmlContext || !htmlContext.snippet) {
          Sentry.addBreadcrumb({
            message: "selector_repair_fetch_failed",
            level:   "warning",
            data:    { monitored_page_id: candidate.monitored_page_id, section_type: candidate.section_type },
          });
          continue;
        }

        // 2 — LLM selector proposal (gpt-4o-mini, temperature 0)
        const proposal = await proposeSelector(candidate, htmlContext.snippet, openaiKey);

        if (!proposal) {
          Sentry.addBreadcrumb({
            message: "selector_repair_llm_failed",
            level:   "warning",
            data:    { monitored_page_id: candidate.monitored_page_id, section_type: candidate.section_type },
          });
          continue;
        }

        repairProposalsCreated++;

        // 3 — Deterministic validation against full live HTML
        const validation = validateProposedSelector(
          htmlContext.fullHtml,
          proposal.proposed_selector,
          candidate.last_valid_content
        );

        repairProposalsValidated++;

        if (!validation.valid) {
          repairProposalsRejectedByValidation++;
          Sentry.addBreadcrumb({
            message: "selector_repair_validation_rejected",
            level:   "info",
            data: {
              monitored_page_id: candidate.monitored_page_id,
              section_type:      candidate.section_type,
              proposed_selector: proposal.proposed_selector,
              rejection_reason:  validation.rejection_reason,
            },
          });
          continue;
        }

        // 4 — Store validated proposal for operator review
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertError } = await (supabase as any)
          .from("selector_repair_suggestions")
          .insert({
            monitored_page_id:       candidate.monitored_page_id,
            section_type:            candidate.section_type,
            previous_selector:       candidate.previous_selector,
            proposed_selector:       proposal.proposed_selector,
            test_extraction_content: validation.test_extraction_content,
            confidence:              proposal.confidence,
            rationale:               proposal.rationale,
            snapshot_id:             candidate.snapshot_id,
            status:                  "pending",
          });

        if (insertError) {
          Sentry.captureException(insertError);
        }
      } catch (candidateErr) {
        Sentry.captureException(
          candidateErr instanceof Error ? candidateErr : new Error(String(candidateErr))
        );
        // Non-fatal — continue to next candidate
      }
    }

    // ── Auto-accept tier ────────────────────────────────────────────────────────
    // Proposals that are: confidence >= 0.85 AND age > 72h AND still pending.
    // These have sat long enough without operator action — apply automatically.
    const autoAcceptCutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: autoAcceptRows } = await (supabase as any)
      .from("selector_repair_suggestions")
      .select("id, monitored_page_id, section_type, proposed_selector")
      .eq("status", "pending")
      .gte("confidence", 0.85)
      .lte("created_at", autoAcceptCutoff);

    for (const row of (autoAcceptRows ?? []) as {
      id: string;
      monitored_page_id: string;
      section_type: string;
      proposed_selector: string;
    }[]) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: ruleError } = await (supabase as any)
          .from("extraction_rules")
          .update({ selector: row.proposed_selector, updated_at: new Date().toISOString() })
          .eq("monitored_page_id", row.monitored_page_id)
          .eq("section_type", row.section_type)
          .eq("active", true);

        if (ruleError) {
          Sentry.captureException(ruleError);
          continue;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("selector_repair_suggestions")
          .update({ status: "accepted" })
          .eq("id", row.id);

        autoAccepted++;
      } catch (autoErr) {
        Sentry.captureException(
          autoErr instanceof Error ? autoErr : new Error(String(autoErr))
        );
      }
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name:                              "suggest-selector-repairs",
      candidates_detected:                     candidatesDetected,
      repair_proposals_created:                repairProposalsCreated,
      repair_proposals_validated:              repairProposalsValidated,
      repair_proposals_rejected_by_validation: repairProposalsRejectedByValidation,
      auto_accepted:                           autoAccepted,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({ monitorSlug: "suggest-selector-repairs", status: "ok", checkInId });
    await Sentry.flush(2000);

    res.status(200).json({
      ok:                                      true,
      job:                                     "suggest-selector-repairs",
      candidates_detected:                     candidatesDetected,
      repair_proposals_created:                repairProposalsCreated,
      repair_proposals_validated:              repairProposalsValidated,
      repair_proposals_rejected_by_validation: repairProposalsRejectedByValidation,
      auto_accepted:                           autoAccepted,
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "suggest-selector-repairs", status: "error", checkInId });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("suggest-selector-repairs", handler);
