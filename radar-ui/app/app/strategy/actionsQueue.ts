"use server";

import { createClient }        from "../../../lib/supabase/server";
import { createServiceClient } from "../../../lib/supabase/service";
import { revalidatePath }      from "next/cache";

async function getAuthenticatedOrgId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  return orgRow?.id ?? null;
}

export async function markActionDone(
  actionId: string
): Promise<{ error?: string }> {
  const orgId = await getAuthenticatedOrgId();
  if (!orgId) return { error: "Unauthorized" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (createServiceClient() as any)
    .from("strategic_actions")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", actionId)
    .eq("org_id", orgId)
    .eq("status", "open");

  if (error) return { error: error.message };

  revalidatePath("/app/strategy");
  return {};
}

export async function dismissAction(
  actionId: string
): Promise<{ error?: string }> {
  const orgId = await getAuthenticatedOrgId();
  if (!orgId) return { error: "Unauthorized" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (createServiceClient() as any)
    .from("strategic_actions")
    .update({ status: "dismissed", completed_at: new Date().toISOString() })
    .eq("id", actionId)
    .eq("org_id", orgId)
    .eq("status", "open");

  if (error) return { error: error.message };

  revalidatePath("/app/strategy");
  return {};
}
