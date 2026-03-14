import { NextResponse } from "next/server";
import { sendEmail, buildWelcomeEmailHtml } from "../../../../lib/email";
import { createServiceClient } from "../../../../lib/supabase/service";
import { captureException } from "../../../../lib/sentry";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { email?: string; plan?: string };
  const { email, plan } = body;

  // Strict email validation — reject newlines (header injection) and malformed addresses.
  const emailOk = typeof email === "string" &&
    email.length <= 254 &&
    !email.includes("\n") &&
    !email.includes("\r") &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!emailOk) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  // Guard: only send the welcome email if the address belongs to a user who
  // signed up in the last 10 minutes.  This prevents unauthenticated callers
  // from using this endpoint to send emails to arbitrary addresses.
  // On failure (e.g. service client unavailable) we allow through — avoiding
  // broken onboarding is more important than perfect abuse prevention here.
  try {
    const service = createServiceClient();
    const cutoff  = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: { users } } = await service.auth.admin.listUsers({ perPage: 500 });
    const isRecentSignup = users.some(
      (u) => u.email === email && u.created_at >= cutoff
    );
    if (!isRecentSignup) {
      // Silently succeed — don't reveal whether the email exists.
      return NextResponse.json({ ok: true });
    }
  } catch (err) {
    // Non-fatal: allow through on service errors so onboarding never breaks.
    captureException(err, { route: "events/signup", step: "recent_signup_check" });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://metrivant.com";
  const tasks: Promise<unknown>[] = [];

  // PostHog event
  const posthogKey = process.env.POSTHOG_API_KEY;
  if (posthogKey) {
    tasks.push(
      fetch("https://app.posthog.com/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key:     posthogKey,
          event:       "signup_completed",
          distinct_id: email,
          properties:  { plan, source: "web" },
        }),
      })
    );
  }

  // Welcome email
  tasks.push(
    sendEmail({
      to:      email,
      subject: "Welcome to Metrivant",
      html:    buildWelcomeEmailHtml(siteUrl),
    })
  );

  await Promise.allSettled(tasks);

  return NextResponse.json({ ok: true });
}
