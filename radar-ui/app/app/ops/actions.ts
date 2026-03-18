"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "../../../lib/supabase/server";
import { createServiceClient } from "../../../lib/supabase/service";

// ── Accept a selector repair proposal ─────────────────────────────────────────
//
// 1. Updates extraction_rules.selector for the matching (page, section_type, active) row.
// 2. Marks the proposal as accepted.
// Idempotent — safe to call twice on the same id.

export async function acceptRepair(
  id:               string,
  monitoredPageId:  string,
  sectionType:      string,
  proposedSelector: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const { error: ruleError } = await service
    .from("extraction_rules")
    .update({ selector: proposedSelector, updated_at: new Date().toISOString() })
    .eq("monitored_page_id", monitoredPageId)
    .eq("section_type", sectionType)
    .eq("active", true);

  if (ruleError) return { error: ruleError.message };

  const { error: statusError } = await service
    .from("selector_repair_suggestions")
    .update({ status: "accepted" })
    .eq("id", id);

  if (statusError) return { error: statusError.message };

  revalidatePath("/app/ops");
  return {};
}

// ── Reject a selector repair proposal ─────────────────────────────────────────

export async function rejectRepair(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const { error } = await service
    .from("selector_repair_suggestions")
    .update({ status: "rejected" })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/app/ops");
  return {};
}
