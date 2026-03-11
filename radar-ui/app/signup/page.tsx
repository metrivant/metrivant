"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") ?? "starter";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        data: { plan },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Fire signup event (best-effort)
    void fetch("/api/events/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, plan }),
    });

    setDone(true);
    setLoading(false);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full border border-[#2EE6A6]/20"
          style={{ background: "rgba(46,230,166,0.06)" }}
        >
          <span className="text-[#2EE6A6] text-xl">✓</span>
        </div>
        <div>
          <p className="text-[15px] font-semibold text-white">Check your email</p>
          <p className="mt-1 text-[13px] text-slate-500">
            We sent a confirmation link to <span className="text-slate-300">{email}</span>
          </p>
        </div>
        <Link href="/login" className="mt-2 text-[13px] text-[#2EE6A6] hover:underline">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-[10px] border border-red-900/40 bg-red-950/30 px-4 py-3 text-[13px] text-red-400">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] font-medium uppercase tracking-[0.15em] text-slate-500">
          Work email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="rounded-[10px] border border-[#0d2010] bg-[#030c03] px-4 py-2.5 text-[14px] text-white placeholder-slate-700 outline-none transition-colors focus:border-[#2EE6A6]/30 focus:ring-1 focus:ring-[#2EE6A6]/20"
          placeholder="you@company.com"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] font-medium uppercase tracking-[0.15em] text-slate-500">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-[10px] border border-[#0d2010] bg-[#030c03] px-4 py-2.5 text-[14px] text-white placeholder-slate-700 outline-none transition-colors focus:border-[#2EE6A6]/30 focus:ring-1 focus:ring-[#2EE6A6]/20"
          placeholder="Min. 8 characters"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-full bg-[#2EE6A6] py-2.5 text-[14px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-[11px] text-slate-600">
        By signing up you agree to our terms of service.
      </p>
    </form>
  );
}

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#000200] px-4">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.85) 0.5px, transparent 0.5px)",
          backgroundSize: "6px 6px",
          opacity: 0.018,
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <Link href="/" className="flex items-center gap-3">
            <svg width="32" height="32" viewBox="0 0 46 46" fill="none">
              <circle cx="23" cy="23" r="21.5" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.50" />
              <circle cx="23" cy="23" r="13"   stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.28" />
              <circle cx="23" cy="23" r="5.5"  stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.42" />
              <path d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z" fill="#2EE6A6" fillOpacity="0.10" />
              <line x1="23" y1="23" x2="38.2" y2="9.8" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.80" />
              <circle cx="23" cy="23" r="2.5" fill="#2EE6A6" />
            </svg>
            <span className="text-[17px] font-bold tracking-[0.08em] text-white">METRIVANT</span>
          </Link>
          <p className="mt-3 text-[13px] text-slate-500">Create your account</p>
        </div>

        {/* Card */}
        <div className="rounded-[16px] border border-[#0d2010] bg-[#020802] p-7">
          <Suspense fallback={<div className="h-40" />}>
            <SignupForm />
          </Suspense>
        </div>

        <p className="mt-5 text-center text-[13px] text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="text-[#2EE6A6] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
