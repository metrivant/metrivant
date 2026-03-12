import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import SectorSelectClient from "./SectorSelectClient";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <SectorSelectClient />;
}
