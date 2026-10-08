"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiBase, setToken } from "@/lib/account-api";

export default function VerifyPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [hint, setHint] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    setIdentifier(sessionStorage.getItem("nexlo_verify_id") ?? "");
    setHint(sessionStorage.getItem("nexlo_dev_code") ?? "");
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, code }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "That code was not accepted.");
        return;
      }
      setToken(body.token);
      sessionStorage.removeItem("nexlo_dev_code");
      router.push("/account");
    } catch {
      setError("We could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    if (!identifier || resending) return;
    setResending(true);
    setError(null);
    setResent(false);
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not resend the code.");
        return;
      }
      if (body.data?.devCode) sessionStorage.setItem("nexlo_dev_code", body.data.devCode);
      setHint(body.data?.devCode ?? "");
      setResent(true);
    } catch {
      setError("We could not reach the server.");
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-[440px] flex-col justify-center px-4 py-10">
      <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Confirm it&apos;s you</h1>
      <p className="mt-2 text-[14px] text-[#667085]">
        Enter the code sent to your email or phone. This is the same check eBay uses before a new account can buy or sell.
      </p>
      {hint ? (
        <p className="mt-3 rounded-lg bg-[#f2f7ff] px-3 py-2 text-[13px] text-[#2a4fa8]">
          Your code is <strong>{hint}</strong>. Email delivery is not connected in this local setup, so it is shown here.
        </p>
      ) : null}
      <form onSubmit={onSubmit} className="mt-5 space-y-3">
        <input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Email or phone"
          className="h-11 w-full rounded-full border border-[#dfe5ee] px-4 outline-none focus:border-[#2f6bff]"
        />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          placeholder="6-digit code"
          className="h-11 w-full rounded-full border border-[#dfe5ee] px-4 outline-none focus:border-[#2f6bff]"
        />
        {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
        {resent ? <p className="text-[13px] text-green-700">A new code was sent. Check your inbox and spam folder.</p> : null}
        <button type="submit" disabled={loading} className="h-11 w-full rounded-full bg-[#2f6bff] font-semibold text-white disabled:opacity-60">
          {loading ? "Checking…" : "Verify and continue"}
        </button>
        <button
          type="button"
          onClick={onResend}
          disabled={resending || !identifier}
          className="h-11 w-full rounded-full border border-[#dfe5ee] font-semibold text-[#0f1c3f] disabled:opacity-60"
        >
          {resending ? "Sending…" : "Resend code"}
        </button>
      </form>
    </main>
  );
}
