"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiBase, apiUnreachableMessage, digitsCode, localOtpNotice, setToken } from "@/lib/account-api";

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
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setIdentifier(sessionStorage.getItem("nexlo_verify_id") ?? "");
    const dest = sessionStorage.getItem("nexlo_verify_dest");
    const sendError = sessionStorage.getItem("nexlo_code_error");
    const filled = digitsCode(sessionStorage.getItem("nexlo_dev_code"));
    if (filled) {
      setCode(filled);
      setShowCode(true);
      setNotice(localOtpNotice);
      return;
    }
    if (sendError) setError(sendError);
    else if (dest) setNotice(`We sent a code to ${dest}. Check inbox and spam.`);
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
    } catch (err) {
      setError(apiUnreachableMessage(err));
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
      const filled = digitsCode(body.data?.devCode);
      if (filled) {
        sessionStorage.setItem("nexlo_dev_code", filled);
        setCode(filled);
        setShowCode(true);
      }
      if (body.data?.destinationMasked) sessionStorage.setItem("nexlo_verify_dest", body.data.destinationMasked);
      if (filled) {
        setError(null);
        setNotice(localOtpNotice);
        setResent(false);
        return;
      }
      if (body.data?.sent === false) {
        setError(body.data.deliveryError ?? "We could not send the code. Tap Resend again.");
        setResent(false);
        return;
      }
      setNotice(body.data?.destinationMasked ? `A new code was sent to ${body.data.destinationMasked}.` : null);
      setResent(true);
    } catch (err) {
      setError(apiUnreachableMessage(err));
    } finally {
      setResending(false);
    }
  }

  const fieldWrap =
    "flex h-11 items-center gap-3 rounded-full border border-[#dfe5ee] bg-white px-4 text-[#8a94a6] transition focus-within:border-[#3665f3] focus-within:text-[#3665f3] focus-within:shadow-[0_0_0_3px_rgba(54,101,243,0.12)]";

  return (
    <div className="w-full max-w-[420px]">
      <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-[#0f1c3f]">
        Confirm it&apos;s{" "}
        <span className="bg-gradient-to-r from-[#08c4a6] to-[#3665f3] bg-clip-text text-transparent">
          you
        </span>
      </h1>
      <p className="mt-1.5 text-[13.5px] text-[#6b7587]">
        Enter the latest 6-digit code we emailed. Check spam. If it is delayed, wait a few seconds before Resend.
      </p>

      <div className="mt-4" aria-live="polite">
        {error ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
            {error}
          </p>
        ) : null}
        {notice && !error ? (
          <p className="rounded-lg border border-[#cfe0ff] bg-[#f2f7ff] px-3 py-2 text-[12.5px] text-[#2a4fa8]">
            {notice}
          </p>
        ) : null}
        {resent && !error ? (
          <p className="rounded-lg border border-[#b7eadc] bg-[#f1fbf7] px-3 py-2 text-[12.5px] text-[#0f7a63]">
            A new code was sent. Check inbox and spam.
          </p>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
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
            className="shrink-0 text-[#8a94a6] hover:text-[#3665f3]"
          >
            <EyeIcon off={showCode} />
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#3665f3] text-[15px] font-semibold text-white shadow-[0_8px_18px_-8px_rgba(54,101,243,0.75)] transition hover:bg-[#2953c6] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Checking…" : "Verify and continue"}
          {!loading && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          )}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-[13.5px] text-[#6b7587]">Didn&apos;t get it?</p>
        <button
          type="button"
          onClick={onResend}
          disabled={resending || !identifier}
          className="text-[13.5px] font-medium text-[#3665f3] hover:underline disabled:opacity-50"
        >
          {resending ? "Sending…" : "Resend code"}
        </button>
      </div>
    </div>
  );
}
