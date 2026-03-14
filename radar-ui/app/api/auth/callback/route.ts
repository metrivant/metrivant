import { createClient } from "../../../../lib/supabase/server";
import { captureException } from "../../../../lib/sentry";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Guard against open-redirect: only allow same-origin relative paths.
  // "//evil.com" starts with "/" but is protocol-relative — reject those too.
  const rawNext = searchParams.get("next") ?? "/app/onboarding";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/app/onboarding";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    captureException(new Error("Auth callback: code exchange failed"), {
      route: "auth/callback",
      error_message: error.message,
      error_code: error.status ?? null,
    });
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
