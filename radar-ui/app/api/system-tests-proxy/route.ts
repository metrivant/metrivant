import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * System Tests Proxy
 *
 * Secure server-side proxy for running system tests from the ops page.
 * Authenticates via Supabase session (not exposed secrets) and forwards
 * requests to the runtime with the server-side CRON_SECRET.
 *
 * Security: Only authenticated users with valid Supabase sessions can call this.
 * The CRON_SECRET never reaches the client.
 */
export async function POST(request: Request) {
  // Verify Supabase authentication
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized - authentication required" },
      { status: 401 }
    );
  }

  // Forward to runtime system-tests endpoint with server-side secret
  const runtimeUrl = process.env.RUNTIME_URL ?? "https://metrivant-runtime.vercel.app";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(`${runtimeUrl}/api/system-tests`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: `Runtime returned ${response.status}`, details: data },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to reach runtime", details: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
