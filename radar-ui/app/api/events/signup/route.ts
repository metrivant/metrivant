import { NextResponse } from "next/server";

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
      fetch("https://app.posthog.com/capture/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: posthogKey,
          event: "signup",
          distinct_id: email,
          properties: { plan, source: "web" },
        }),
      })
    );
  }

  // Resend welcome email
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    tasks.push(
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: "Metrivant <hello@metrivant.com>",
          to: email,
          subject: "Welcome to Metrivant",
          text: [
            `Welcome to Metrivant.`,
            ``,
            `Your competitive intelligence radar is ready. Start by adding competitors to monitor at:`,
            `${siteUrl}/app/onboarding`,
            ``,
            `— The Metrivant team`,
          ].join("\n"),
        }),
      })
    );
  }

  await Promise.allSettled(tasks);

  return NextResponse.json({ ok: true });
}
