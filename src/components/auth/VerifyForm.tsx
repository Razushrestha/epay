"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiBase, setToken } from "@/lib/account-api";

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  );
}

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

export function VerifyForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    setIdentifier(sessionStorage.getItem("nexlo_verify_id") ?? "");
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
      setResent(true);
    } catch {
      setError("We could not reach the server.");
    } finally {
      setResending(false);
    }
  }

  const fieldWrap =
    "flex h-12 items-center gap-3 rounded-full border border-[#dfe5ee] bg-white px-4 text-[#8a94a6] transition focus-within:border-[#2f6bff] focus-within:text-[#2f6bff] focus-within:shadow-[0_0_0_3px_rgba(47,107,255,0.12)]";

  return (
    <div className="w-full max-w-[440px] rounded-[28px] bg-white p-7 shadow-[0_24px_60px_-28px_rgba(15,40,80,0.35)] sm:p-9">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#e8fbf7] text-[#12c4b0]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.4 7.5 9.5 4.4-1.1 7.5-4.9 7.5-9.5V6L12 3Z" />
          <path d="m9.2 12.2 2 2 3.7-4" />
        </svg>
      </div>
      <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-[#12c4b0]">
        Confirm it&apos;s you
      </h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-[#6b7587]">
        Enter the code sent to your email or phone. This is the same check eBay uses before a new account can buy or sell.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-3.5">
        <label className="sr-only" htmlFor="verify-identifier">
          Email or phone
        </label>
        <div className={fieldWrap}>
          <MailIcon />
          <input
            id="verify-identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Email or phone"
            autoComplete="username"
            className="h-full min-w-0 flex-1 bg-transparent text-[14.5px] text-[#0f1c3f] outline-none placeholder:text-[#8a94a6]"
          />
        </div>

        <label className="sr-only" htmlFor="verify-code">
          6-digit code
        </label>
        <div className={fieldWrap}>
          <LockIcon />
          <input
            id="verify-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            type={showCode ? "text" : "password"}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            className="h-full min-w-0 flex-1 bg-transparent text-[14.5px] tracking-[0.18em] text-[#0f1c3f] outline-none placeholder:tracking-normal placeholder:text-[#8a94a6]"
          />
          <button
            type="button"
            onClick={() => setShowCode((v) => !v)}
            aria-label={showCode ? "Hide code" : "Show code"}
            className="shrink-0 text-[#8a94a6] hover:text-[#2f6bff]"
          >
            <EyeIcon off={showCode} />
          </button>
        </div>

        {error ? (
          <p role="alert" className="flex items-start gap-1.5 text-[13px] text-red-600">
            <span aria-hidden>⚠</span>
            {error}
          </p>
        ) : null}
        {resent && !error ? (
          <p className="text-[13px] text-green-700">A new code was sent. Check inbox and spam.</p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#2f6bff] text-[15px] font-semibold text-white shadow-[0_8px_18px_-8px_rgba(47,107,255,0.75)] transition hover:bg-[#2459e0] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Checking…" : "Verify and continue"}
          {!loading && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          )}
        </button>
      </form>

      <button
        type="button"
        onClick={onResend}
        disabled={resending || !identifier}
        className="mt-4 w-full text-center text-[14px] font-medium text-[#6b7587] underline-offset-2 hover:text-[#12c4b0] hover:underline disabled:opacity-50"
      >
        {resending ? "Sending…" : "Resend code"}
      </button>
    </div>
  );
}
