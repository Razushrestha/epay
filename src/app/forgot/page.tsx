"use client";

import Link from "next/link";
import { useState } from "react";
import { apiBase } from "@/lib/account-api";

export default function ForgotPage() {
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [hint, setHint] = useState("");
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not send a code.");
        return;
      }
      setSent(true);
      if (body.data?.devCode) setHint(body.data.devCode);
    } catch {
      setError("We could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, code, password }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not reset the password.");
        return;
      }
      setDone(true);
    } catch {
      setError("We could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-[440px] flex-col justify-center px-4 py-10">
      <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Reset your password</h1>
      <p className="mt-2 text-[14px] text-[#667085]">We&apos;ll send a one-time code to your email or phone, then you can choose a new password. Other signed-in devices are signed out.</p>
      {hint ? <p className="mt-3 rounded-lg bg-[#f2f7ff] px-3 py-2 text-[13px] text-[#2a4fa8]">Your code is <strong>{hint}</strong>.</p> : null}
      {done ? (
        <p className="mt-5 text-[14px]">
          Password updated. <Link href="/login" className="font-semibold text-[#2f6bff]">Sign in</Link>
        </p>
      ) : (
        <form onSubmit={sent ? resetPassword : requestCode} className="mt-5 space-y-3">
          <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Email or phone" className="h-11 w-full rounded-full border border-[#dfe5ee] px-4 outline-none focus:border-[#2f6bff]" />
          {sent ? (
            <>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" className="h-11 w-full rounded-full border border-[#dfe5ee] px-4 outline-none focus:border-[#2f6bff]" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" className="h-11 w-full rounded-full border border-[#dfe5ee] px-4 outline-none focus:border-[#2f6bff]" />
            </>
          ) : null}
          {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
          <button type="submit" disabled={loading} className="h-11 w-full rounded-full bg-[#2f6bff] font-semibold text-white disabled:opacity-60">
            {loading ? "Working…" : sent ? "Save new password" : "Send code"}
          </button>
        </form>
      )}
    </main>
  );
}
