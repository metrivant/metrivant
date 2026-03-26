"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";

/**
 * Un-quarantine a monitored page (restore to active monitoring)
 * Resets: active=true, health_state='healthy', consecutive_failures=0, quarantined_at=null
 */
export async function unquarantineMonitoredPage(pageId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "Unauthorized" };
    }

    // Service client for write
    const serviceClient = createServiceClient();

    const { error: updateError } = await serviceClient
      .from("monitored_pages")
      .update({
        active: true,
        health_state: "healthy",
        consecutive_failures: 0,
        quarantined_at: null,
      })
      .eq("id", pageId);

    if (updateError) {
      console.error("unquarantineMonitoredPage error:", updateError);
      return { ok: false, error: updateError.message };
    }

    revalidatePath("/app/ops");
    return { ok: true };
  } catch (err) {
    console.error("unquarantineMonitoredPage exception:", err);
    return { ok: false, error: String(err) };
  }
}
