"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiBase, apiUnreachableMessage, digitsCode, setToken } from "@/lib/account-api";
import { SocialSignIn } from "@/components/auth/SocialSignIn";

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

export function LoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"password" | "challenge" | "enroll">("password");
  const [challengeToken, setChallengeToken] = useState("");
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState("");
  const [enrollMethod, setEnrollMethod] = useState<"" | "authenticator" | "otp">("");

  function finish(token: string) {
    setToken(token);
    router.push("/account");
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password, remember }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "We could not sign you in. Check your details and try again.");
        return;
      }
      if (body.step === "challenge") {
        setStep("challenge");
        setChallengeToken(body.challengeToken);
        const filled = digitsCode(body.devCode);
        if (filled) setCode(filled);
        setNotice(
          filled
            ? "Email is not sending from this computer yet. The code is filled in."
            : body.sent === false
              ? body.deliveryError ?? "We could not send the sign-in code. Sign in again to resend it."
              : "Enter the code from your authenticator or the message we sent.",
        );
        return;
      }
      if (body.step === "enroll") {
        setStep("enroll");
        setChallengeToken(body.challengeToken);
        setEnrollMethod("");
        setSecret("");
        setCode("");
        setNotice("Sellers must turn on two-factor before signing in. Choose a method below.");
        return;
      }
      finish(body.token);
    } catch (err) {
      setError(apiUnreachableMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function confirmCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/2fa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeToken, code }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "That code was not accepted.");
        return;
      }
      finish(body.token);
    } catch (err) {
      setError(apiUnreachableMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function startEnroll(method: "authenticator" | "otp") {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/2fa/enroll/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeToken, method }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not start two-factor setup.");
        return;
      }
      setEnrollMethod(body.data.method);
      setSecret(body.data.secret ?? "");
      const filled = digitsCode(body.data.devCode);
      setCode(filled);
      setNotice(
        body.data.secret
          ? "Add this key to an authenticator app, then enter the 6-digit code."
          : filled
            ? "Email is not sending from this computer yet. The code is filled in."
            : body.data.sent === false
              ? body.data.deliveryError ?? "We could not send the code. Try email/phone again."
              : "Enter the code we sent.",
      );
    } catch (err) {
      setError(apiUnreachableMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/2fa/enroll/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeToken, code, remember }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "That code was not accepted.");
        return;
      }
      finish(body.token);
    } catch (err) {
      setError(apiUnreachableMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const fieldWrap =
    "flex h-11 items-center gap-3 rounded-full border border-[#dfe5ee] bg-white px-4 text-[#8a94a6] transition focus-within:border-[#3665f3] focus-within:text-[#3665f3] focus-within:shadow-[0_0_0_3px_rgba(54,101,243,0.12)]";

  return (
    <div className="w-full max-w-[420px]">
      <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-[#0f1c3f]">
        Sign in to{" "}
        <span className="bg-gradient-to-r from-[#08c4a6] to-[#3665f3] bg-clip-text text-transparent">
          Nexlo
        </span>
      </h1>
      <p className="mt-1.5 text-[13.5px] text-[#6b7587]">
        {step === "enroll"
          ? "Turn on two-factor to finish signing in as a seller."
          : "Welcome back! Please enter your details to continue."}
      </p>

      <div className="mt-4" aria-live="polite">
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
            {error}
          </p>
        )}
        {notice && !error && (
          <p className="rounded-lg border border-[#cfe0ff] bg-[#f2f7ff] px-3 py-2 text-[12.5px] text-[#2a4fa8]">
            {notice}
          </p>
        )}
      </div>

      {step === "challenge" ? (
        <form onSubmit={confirmCode} className="mt-6 space-y-3">
          <p className="text-[13.5px] text-[#3a4458]">Two-factor check. Enter the 6-digit code.</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className="h-11 w-full rounded-full border border-[#dfe5ee] px-4 text-[15px] outline-none focus:border-[#3665f3]"
          />
          <button type="submit" disabled={loading} className="h-11 w-full rounded-full bg-[#3665f3] text-[15px] font-semibold text-white disabled:opacity-60">
            {loading ? "Checking…" : "Confirm"}
          </button>
        </form>
      ) : null}

      {step === "enroll" ? (
        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void startEnroll("authenticator")}
              className="h-10 rounded-full border border-[#dfe5ee] px-4 text-[13.5px] font-medium text-[#1a2338] disabled:opacity-60"
            >
              Use authenticator app
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void startEnroll("otp")}
              className="h-10 rounded-full border border-[#dfe5ee] px-4 text-[13.5px] font-medium text-[#1a2338] disabled:opacity-60"
            >
              Use email or phone code
            </button>
          </div>
          {secret ? <p className="break-all rounded-lg bg-[#f6f8fb] px-3 py-2 font-mono text-[13px]">{secret}</p> : null}
          {enrollMethod ? (
            <form onSubmit={confirmEnroll} className="space-y-3">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                className="h-11 w-full rounded-full border border-[#dfe5ee] px-4 text-[15px] outline-none focus:border-[#3665f3]"
              />
              <button type="submit" disabled={loading} className="h-11 w-full rounded-full bg-[#3665f3] text-[15px] font-semibold text-white disabled:opacity-60">
                {loading ? "Checking…" : "Confirm and sign in"}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className={`mt-6 space-y-3 ${step === "password" ? "" : "hidden"}`}>
        <div>
          <label htmlFor="identifier" className="sr-only">
            Email or username
          </label>
          <div className={fieldWrap}>
            <MailIcon />
            <input
              id="identifier"
              name="identifier"
              type="text"
              required
              autoComplete="username"
              placeholder="Email or phone"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-[14.5px] text-[#0f1c3f] outline-none placeholder:text-[#8a94a6]"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="sr-only">
            Password
          </label>
          <div className={fieldWrap}>
            <LockIcon />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-[14.5px] text-[#0f1c3f] outline-none placeholder:text-[#8a94a6]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="shrink-0 text-[#8a94a6] hover:text-[#3665f3]"
            >
              <EyeIcon off={showPassword} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <label className="flex cursor-pointer select-none items-center gap-2 text-[13.5px] text-[#3a4458]">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border border-[#c9d2e0] bg-white text-transparent transition peer-checked:border-[#3665f3] peer-checked:bg-[#3665f3] peer-checked:text-white"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            </span>
            Remember me
          </label>
          <Link href="/forgot" className="text-[13.5px] font-medium text-[#3665f3] hover:underline">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#3665f3] text-[15px] font-semibold text-white shadow-[0_8px_18px_-8px_rgba(54,101,243,0.75)] transition hover:bg-[#2953c6] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Continue"}
          {!loading && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          )}
        </button>
      </form>

      <div className={`my-4 flex items-center gap-4 text-[13px] text-[#8a94a6] ${step === "password" ? "" : "hidden"}`}>
        <span className="h-px flex-1 bg-[#e5eaf2]" />
        or
        <span className="h-px flex-1 bg-[#e5eaf2]" />
      </div>

      <div className={step === "password" ? "" : "hidden"}>
        <SocialSignIn
          onError={(message) => {
            setNotice(null);
            setError(message);
          }}
          onEnroll={(token) => {
            setStep("enroll");
            setChallengeToken(token);
            setEnrollMethod("");
            setSecret("");
            setCode("");
            setNotice("Sellers must turn on two-factor before signing in. Choose a method below.");
          }}
          onSignedIn={(token) => finish(token)}
        />
      </div>
    </div>
  );
}
