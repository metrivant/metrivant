import { NextResponse } from "next/server";
import { buildBriefEmailHtml, getDailyQuote, type BriefContent } from "../../../lib/brief";
import { sendEmail, FROM_BRIEFS } from "../../../lib/email";
import { createServiceClient } from "../../../lib/supabase/service";
import { captureException, flush } from "../../../lib/sentry";

export const maxDuration = 60;

// captureCheckIn is server-only in @sentry/nextjs
function captureCheckIn(status: "in_progress" | "ok" | "error", checkInId?: string): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (require("@sentry/nextjs") as any).captureCheckIn?.({
      monitorSlug: "send-validated-briefs",
      status,
      ...(checkInId ? { checkInId } : {}),
    }) as string | undefined;
  } catch { return undefined; }
}

function weekLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day:   "numeric",
    year:  "numeric",
  });
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Send Validated Briefs
 *
 * Runs Monday 10:20 UTC (5min after validate-briefs at 10:15).
 * Sends emails for briefs with validation_status='validated' from the last 24h.
 * Hallucinated/weak briefs are skipped.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const checkInId = captureCheckIn("in_progress");
  const sb = createServiceClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://metrivant.com";

  try {
    // Load validated briefs from last 24h that haven't been emailed yet
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: briefRows, error: briefErr } = await (sb as any)
      .from("weekly_briefs")
      .select("id, org_id, content, generated_at, organizations(owner_id)")
      .eq("validation_status", "validated")
      .gte("validated_at", since)
      .is("emailed_at", null); // Only send once

    if (briefErr) throw briefErr;

    const briefs = (briefRows ?? []) as Array<{
      id: string;
      org_id: string;
      content: BriefContent;
      generated_at: string;
      organizations: { owner_id: string } | null;
    }>;

    if (briefs.length === 0) {
      captureCheckIn("ok", checkInId);
      await flush(2000);
      return NextResponse.json({ ok: true, job: "send-validated-briefs", sent: 0 });
    }

    // Load owner emails and subscription status
    const ownerIds = Array.from(
      new Set(briefs.map((b) => b.organizations?.owner_id).filter((id): id is string => !!id))
    );

    if (ownerIds.length === 0) {
      captureCheckIn("ok", checkInId);
      await flush(2000);
      return NextResponse.json({ ok: true, job: "send-validated-briefs", sent: 0 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: authUsers } = await (sb.auth as any).admin.listUsers();
    const userEmailById = new Map<string, string>();
    const userMetadataById = new Map<string, Record<string, unknown>>();

    for (const u of authUsers?.users ?? []) {
      if (u.id && u.email) {
        userEmailById.set(u.id, u.email);
        userMetadataById.set(u.id, u.user_metadata ?? {});
      }
    }

    let emailsSent = 0;
    const now = new Date();

    for (const brief of briefs) {
      const ownerId = brief.organizations?.owner_id;
      if (!ownerId) continue;

      const ownerEmail = userEmailById.get(ownerId);
      if (!ownerEmail) continue;

      // Check subscription status
      let hasActiveSub = false;
      const userMeta = userMetadataById.get(ownerId);
      const metaPlan = userMeta?.plan as string | undefined;

      if (metaPlan === "analyst" || metaPlan === "pro") {
        hasActiveSub = true;
      } else {
        // Fallback: check subscriptions table
        try {
          const { data: subRows } = await sb
            .from("subscriptions")
            .select("status")
            .eq("org_id", brief.org_id)
            .order("created_at", { ascending: false })
            .limit(1);

          const subStatus = subRows?.[0]?.status as string | undefined;
          if (
            subStatus === "active" ||
            subStatus === "canceled_active" ||
            subStatus === "past_due"
          ) {
            hasActiveSub = true;
          }
        } catch {
          // Non-fatal
        }
      }

      // Only send if active subscription
      if (hasActiveSub) {
        const week = weekLabel(new Date(brief.generated_at));
        const emailHtml = buildBriefEmailHtml(brief.content, week, siteUrl, now);
        const result = await sendEmail({
          to: ownerEmail,
          subject: `Your weekly competitor intelligence brief — ${week}`,
          html: emailHtml,
          from: FROM_BRIEFS,
        });

        if (result.ok) {
          emailsSent++;
          // Mark as emailed
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (sb as any)
            .from("weekly_briefs")
            .update({ emailed_at: new Date().toISOString() })
            .eq("id", brief.id);
        }
      }
    }

    captureCheckIn("ok", checkInId);
    await flush(2000);

    return NextResponse.json({
      ok: true,
      job: "send-validated-briefs",
      briefs_validated: briefs.length,
      emails_sent: emailsSent,
    });
  } catch (error) {
    captureException(error instanceof Error ? error : new Error(String(error)), {
      route: "send-validated-briefs",
    });
    captureCheckIn("error", checkInId);
    await flush(2000);

    return NextResponse.json(
      {
        ok: false,
        job: "send-validated-briefs",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 }
    );
  }
}
