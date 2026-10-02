"use client";

import Link from "next/link";
import { useState } from "react";

const apiBase =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Registration failed");
        return;
      }
      setMessage(`Account created for ${body.data.email}`);
    } catch {
      setError("Could not reach API. Is npm run dev:api running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-[24px] font-bold text-[#191919]">Create account</h1>
      <p className="mt-1 text-[13px] text-[#707070]">One account to buy and sell.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-2xl border border-[#e7e7e7] bg-white p-6">
        <label className="block text-[13px] font-medium text-[#191919]">
          Display name
          <input
            className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#3665f3]"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
          />
        </label>
        <label className="block text-[13px] font-medium text-[#191919]">
          Email
          <input
            type="email"
            required
            className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#3665f3]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label className="block text-[13px] font-medium text-[#191919]">
          Password
          <input
            type="password"
            required
            minLength={8}
            className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#3665f3]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {message && (
          <p className="text-sm text-green-700 dark:text-green-400">
            {message}{" "}
            <Link href="/login" className="underline">
              Sign in
            </Link>
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-[#3665f3] py-2.5 text-[14px] font-semibold text-white hover:bg-[#2953c6] disabled:opacity-50"
        >
          {loading ? "Creating…" : "Register"}
        </button>
      </form>
      <p className="mt-6 text-center text-[13px] text-[#707070]">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[#3665f3] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
