"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { apiBase, apiUnreachableMessage } from "@/lib/account-api";
import { passwordPolicyError } from "@/lib/password";

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

const fieldWrap =
  "flex h-12 items-center gap-3 rounded-full border border-[#dfe5ee] bg-white px-4 text-[#8a94a6] transition focus-within:border-[#3665f3] focus-within:text-[#3665f3] focus-within:shadow-[0_0_0_3px_rgba(54,101,243,0.12)]";

export function ResetForm() {
  const search = useSearchParams();
  const token = search.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : "This reset link is missing or invalid.");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("This reset link is missing or invalid.");
      return;
    }
    const passwordError = passwordPolicyError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not reset the password.");
        return;
      }
      setDone(true);
    } catch (err) {
      setError(apiUnreachableMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[460px] rounded-[28px] bg-white p-7 shadow-[0_28px_70px_-32px_rgba(54,101,243,0.35)] sm:p-9">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf1ff] text-[#3665f3]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
          <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
        </svg>
      </div>

      <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-[#0f1c3f] sm:text-[32px]">
        Choose a <span className="text-[#12c4b0]">new password</span>
      </h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-[#6b7587]">
        {done
          ? "Your password has been updated. Previous sessions were signed out. You can sign in with the new password."
          : "Enter a new password for this account. Other signed-in devices will be signed out."}
      </p>

      {done ? (
        <Link
          href="/login"
          className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#3665f3] text-[15px] font-semibold text-white shadow-[0_8px_18px_-8px_rgba(54,101,243,0.75)] transition hover:bg-[#2953c6]"
        >
          Back to sign in
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-3.5">
          <label className="sr-only" htmlFor="reset-password">
            New password
          </label>
          <div className={fieldWrap}>
            <LockIcon />
            <input
              id="reset-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="New password"
              minLength={8}
              required
              className="h-full min-w-0 flex-1 bg-transparent text-[14.5px] text-[#0f1c3f] outline-none placeholder:text-[#8a94a6]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="shrink-0 text-[#8a94a6] hover:text-[#3665f3]"
            >
              <EyeIcon off={showPassword} />
            </button>
          </div>
          {error ? (
            <p role="alert" className="text-[13px] text-red-600">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading || !token}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#3665f3] text-[15px] font-semibold text-white shadow-[0_8px_18px_-8px_rgba(54,101,243,0.75)] transition hover:bg-[#2953c6] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Saving…" : "Save new password"}
            {!loading && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
