import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import PostHogIdentify from "../../components/PostHogIdentify";
import KeybindingHint from "../../components/KeybindingHint";
import MobileAppGate from "../../components/MobileAppGate";

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
  const { data: orgRows } = await supabase
    .from("organizations")
    .select("sector")
    .eq("owner_id", user.id)
    .limit(1);

  const sector = (orgRows?.[0]?.sector as string | null) ?? null;
  const planRaw = user.user_metadata?.plan as string | undefined;
  const plan = planRaw === "pro" ? "pro" : "analyst";

  return (
    <>
      <PostHogIdentify userId={user.id} email={user.email ?? null} plan={plan} sector={sector} />
      <KeybindingHint />
      <MobileAppGate>{children}</MobileAppGate>
    </>
  );
}
