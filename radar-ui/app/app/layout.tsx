import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "../../lib/supabase/server";
import PostHogIdentify from "../../components/PostHogIdentify";
import KeybindingHint from "../../components/KeybindingHint";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch org — drives both the onboarding gate and PostHog segmentation.
  // Wrapped in try/catch: Supabase can throw "schema cache" errors on cold starts.
  let sector: string | null = null;
  let hasOrg = false;
  try {
    const { data: orgRows } = await supabase
      .from("organizations")
      .select("id, sector")
      .eq("owner_id", user.id)
      .limit(1);
    const org = orgRows?.[0] ?? null;
    hasOrg = org !== null;
    sector = (org?.sector as string | null) ?? null;
  } catch {
    // Non-fatal — gate defaults to allowing through; PostHog degrades gracefully
  }

  // Onboarding gate — users with no org are redirected to sector selection.
  // Exempt /app/onboarding itself to prevent a redirect loop.
  // Also exempt /app/billing and /app/settings (accessible before org exists).
  if (!hasOrg) {
    const ONBOARDING_EXEMPT = ["/app/onboarding", "/app/billing", "/app/settings"];
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") ?? "";
    const isExempt = ONBOARDING_EXEMPT.some((p) => pathname.startsWith(p));
    if (!isExempt) {
      redirect("/app/onboarding");
    }
  }
  const planRaw = user.user_metadata?.plan as string | undefined;
  const plan = planRaw === "pro" ? "pro" : "analyst";

  return (
    <>
      <PostHogIdentify userId={user.id} email={user.email ?? null} plan={plan} sector={sector} />
      <KeybindingHint />
      {children}
    </>
  );
}
