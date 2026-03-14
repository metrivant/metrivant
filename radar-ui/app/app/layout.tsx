import { redirect } from "next/navigation";
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

  // Fetch org sector for PostHog segmentation — non-blocking, best-effort.
  // Wrapped in try/catch: Supabase can throw "schema cache" errors on cold starts
  // which would crash the layout without this guard.
  let sector: string | null = null;
  try {
    const { data: orgRows } = await supabase
      .from("organizations")
      .select("sector")
      .eq("owner_id", user.id)
      .limit(1);
    sector = (orgRows?.[0]?.sector as string | null) ?? null;
  } catch {
    // Non-fatal — PostHog segmentation degrades gracefully with sector=null
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
