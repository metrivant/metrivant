"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { createClient } from "../../lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { capture } from "../../lib/posthog";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") ?? "analyst";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    capture("signup_started", { plan });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/api/auth/callback`,
        data: { plan },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    capture("signup_completed", { plan });
    void fetch("/api/events/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, plan }),
    });

    setDone(true);
    setLoading(false);
  }

  async function handleResend() {
    setResending(true);
    try {
      const supabase = createClient();
      await supabase.auth.resend({ type: "signup", email });
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch { /* non-fatal */ }
    setResending(false);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full border border-[#00B4FF]/20"
          style={{ background: "rgba(0,180,255,0.06)" }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M4 10.5l4.5 4.5 7.5-9" stroke="#00B4FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <p className="text-[15px] font-semibold text-white">Check your email</p>
          <p className="mt-1 text-[13px] text-slate-500">
            We sent a confirmation link to{" "}
            <span className="text-slate-300">{email}</span>
          </p>
        </div>
        <button
          onClick={handleResend}
          disabled={resending || resent}
          className="mt-1 text-[12px] transition-colors disabled:opacity-50"
          style={{ color: resent ? "rgba(0,180,255,0.70)" : "#64748b" }}
        >
          {resent ? "Email sent ✓" : resending ? "Sending…" : "Didn't receive it? Resend"}
        </button>
        <Link href="/login" className="mt-1 text-[13px] text-[#00B4FF] hover:underline">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {plan === "pro" && (
        <div
          className="flex items-center gap-2 rounded-[10px] border border-[#00B4FF]/18 px-3.5 py-2.5"
          style={{ background: "rgba(0,180,255,0.04)" }}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#00B4FF]" />
          <span className="text-[12px] text-[#00B4FF]/80">Pro plan selected</span>
        </div>
      )}

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
          autoFocus
          autoComplete="email"
          className="rounded-[10px] border border-[#0d1020] bg-[#03030c] px-4 py-2.5 text-[14px] text-white placeholder-slate-700 outline-none transition-colors focus:border-[#00B4FF]/30 focus:ring-1 focus:ring-[#00B4FF]/20"
          placeholder="you@company.com"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] font-medium uppercase tracking-[0.15em] text-slate-500">
          Password
        </label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-[10px] border border-[#0d1020] bg-[#03030c] px-4 py-2.5 pr-10 text-[14px] text-white placeholder-slate-700 outline-none transition-colors focus:border-[#00B4FF]/30 focus:ring-1 focus:ring-[#00B4FF]/20"
            placeholder="Min. 8 characters"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-3 flex items-center text-slate-600 transition-colors hover:text-slate-400"
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {showPassword ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 2l12 12M6.5 6.7A2 2 0 0 0 9.3 9.5M4.3 4.5C2.8 5.5 1.6 6.8 1 8c1.2 2.4 3.8 4 7 4 1.2 0 2.3-.3 3.3-.7M6.5 3.1C7 3 7.5 3 8 3c3.2 0 5.8 1.6 7 4-.5 1-1.3 1.9-2.3 2.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <ellipse cx="8" cy="8" rx="3" ry="2" stroke="currentColor" strokeWidth="1.3" />
                <path d="M1 8c1.2-2.4 3.8-4 7-4s5.8 1.6 7 4c-1.2 2.4-3.8 4-7 4S2.2 10.4 1 8Z" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-full bg-[#00B4FF] py-2.5 text-[14px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Creating account…" : "Start free trial"}
      </button>

    </form>
  );
}

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#000002] px-4">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.85) 0.5px, transparent 0.5px)",
          backgroundSize: "6px 6px",
          opacity: 0.018,
        }}
      />

      <div className="page-enter relative w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <Link href="/" className="flex items-center gap-3">
            <svg width="32" height="32" viewBox="0 0 46 46" fill="none">
              <circle cx="23" cy="23" r="21.5" stroke="#00B4FF" strokeWidth="1.5" strokeOpacity="0.50" />
              <circle cx="23" cy="23" r="13"   stroke="#00B4FF" strokeWidth="1"   strokeOpacity="0.28" />
              <circle cx="23" cy="23" r="5.5"  stroke="#00B4FF" strokeWidth="1"   strokeOpacity="0.42" />
              <path d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z" fill="#00B4FF" fillOpacity="0.10" />
              <line x1="23" y1="23" x2="38.2" y2="9.8" stroke="#00B4FF" strokeWidth="1.5" strokeOpacity="0.80" />
              <circle cx="23" cy="23" r="2.5" fill="#00B4FF" />
            </svg>
            <span className="text-[17px] font-bold tracking-[0.08em] text-white">METRIVANT</span>
          </Link>
          <p className="mt-3 text-[13px] text-slate-500">
            Your radar is ready. Create an account to activate it.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-[16px] border border-[#0d1020] bg-[#020208] p-7">
          <Suspense fallback={<div className="h-40" />}>
            <SignupForm />
          </Suspense>
        </div>

        <p className="mt-5 text-center text-[13px] text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="text-[#00B4FF] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
