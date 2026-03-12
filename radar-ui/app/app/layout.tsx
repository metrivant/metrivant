import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import PostHogIdentify from "../../components/PostHogIdentify";

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

  return (
    <>
      <PostHogIdentify userId={user.id} email={user.email ?? null} />
      {children}
    </>
  );
}
