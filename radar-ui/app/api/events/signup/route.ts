import { NextResponse } from "next/server";
import { sendEmail, buildWelcomeEmailHtml } from "../../../../lib/email";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { email?: string; plan?: string };
  const { email, plan } = body;

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
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
          event:       "signup",
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
