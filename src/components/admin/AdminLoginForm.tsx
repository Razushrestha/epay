"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { accountApi, apiBase, getToken, setToken } from "@/lib/account-api";

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
      {off ? <path d="M4 4l16 16" /> : null}
    </svg>
  );
}

type LoginUser = { isStaff?: boolean };

export function AdminLoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"password" | "challenge">("password");
  const [challengeToken, setChallengeToken] = useState("");
  const [code, setCode] = useState("");
  const [canClaim, setCanClaim] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    accountApi<{ youAreStaff: boolean }>("/api/v1/admin/status")
      .then((status) => {
        if (status.youAreStaff) router.replace("/admin");
      })
      .catch(() => undefined);
  }, [router]);

  async function enterAdmin(user?: LoginUser) {
    const status = await accountApi<{ youAreStaff: boolean; staffExists: boolean }>("/api/v1/admin/status");
    if (user?.isStaff || status.youAreStaff) {
      router.push("/admin");
      router.refresh();
      return;
    }
    if (!status.staffExists) {
      setCanClaim(true);
      setNotice("No staff account exists yet. Claim Super Admin with this login to open the dashboard.");
      return;
    }
    setCanClaim(false);
    setError("Only authorized staff can access this area.");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    setCanClaim(false);
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password, remember, adminPortal: true }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "We could not sign you in. Check your admin credentials.");
        return;
      }
      if (body.step === "challenge") {
        setStep("challenge");
        setChallengeToken(body.challengeToken);
        setNotice(body.devCode ? `Enter the 6-digit code, or use ${body.devCode}.` : "Enter the 6-digit code from your authenticator.");
        return;
      }
      if (body.step === "enroll") {
        setError("This account is not staff. Use an authorized admin login.");
        return;
      }
      if (!body.token) {
        setError("Sign-in did not complete. Try again.");
        return;
      }
      setToken(body.token);
      await enterAdmin(body.user);
    } catch {
      setError("We could not reach the server. Please try again in a moment.");
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
      setToken(body.token);
      await enterAdmin(body.user);
    } catch {
      setError("We could not reach the server. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  const fieldWrap =
    "flex h-[48px] items-center gap-3 rounded-full border border-[#e4ebf4] bg-[#f7faff] px-4 text-[#9aa6b8] transition focus-within:border-[#2f6bff] focus-within:bg-white focus-within:text-[#2f6bff] focus-within:shadow-[0_0_0_4px_rgba(47,107,255,0.1)]";

  return (
    <div className="w-full">
      <div className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-transparent.png" alt="Nexlo" className="h-11 w-auto" />
      </div>
      <h1 className="mt-5 text-center text-[32px] font-extrabold tracking-tight text-[#0f1c3f]">
        Admin <span className="text-[#12c2b0]">Login</span>
      </h1>
      <p className="mt-1.5 text-center text-[13.5px] text-[#8a94a6]">Enter your credentials to access the admin panel.</p>

      {step === "challenge" ? (
        <form onSubmit={confirmCode} className="mt-7 space-y-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            className="h-[48px] w-full rounded-full border border-[#e4ebf4] bg-[#f7faff] px-4 text-[14.5px] outline-none focus:border-[#2f6bff] focus:bg-white"
          />
          <button type="submit" disabled={loading} className="flex h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#2f6bff] text-[15px] font-semibold text-white disabled:opacity-60">
            {loading ? "Checking…" : "Confirm"}
          </button>
        </form>
      ) : (
        <form onSubmit={onSubmit} className="mt-7 space-y-3.5">
          <label className="sr-only" htmlFor="admin-identifier">Email or username</label>
          <div className={fieldWrap}>
            <MailIcon />
            <input
              id="admin-identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="username"
              placeholder="Email or username"
              className="h-full min-w-0 flex-1 bg-transparent text-[14.5px] text-[#0f1c3f] outline-none placeholder:text-[#9aa6b8]"
            />
          </div>
          <label className="sr-only" htmlFor="admin-password">Password</label>
          <div className={fieldWrap}>
            <LockIcon />
            <input
              id="admin-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Password"
              className="h-full min-w-0 flex-1 bg-transparent text-[14.5px] text-[#0f1c3f] outline-none placeholder:text-[#9aa6b8]"
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} className="text-[#9aa6b8] hover:text-[#2f6bff]">
              <EyeIcon off={showPassword} />
            </button>
          </div>
          <div className="flex items-center justify-between px-0.5 pt-0.5">
            <label className="flex cursor-pointer select-none items-center gap-2 text-[13.5px] text-[#3a4458]">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="peer sr-only" />
              <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border border-[#c9d2e0] bg-white text-transparent transition peer-checked:border-[#2f6bff] peer-checked:bg-[#2f6bff] peer-checked:text-white">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
              </span>
              Remember me
            </label>
            <Link href="/forgot" className="text-[13.5px] font-medium text-[#2f6bff] hover:underline">
              Forgot password?
            </Link>
          </div>

          <div aria-live="polite">
            {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{error}</p> : null}
            {notice && !error ? <p className="rounded-xl border border-[#cfe0ff] bg-[#f2f7ff] px-3 py-2 text-[12.5px] text-[#2a4fa8]">{notice}</p> : null}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#2f6bff] text-[15px] font-semibold text-white shadow-[0_10px_22px_-8px_rgba(47,107,255,0.85)] transition hover:bg-[#2459e0] disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign In"}
            {!loading ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            ) : null}
          </button>
        </form>
      )}

      {canClaim ? (
        <button
          type="button"
          className="mt-3 h-[48px] w-full rounded-full border border-[#2f6bff] text-[14px] font-semibold text-[#2f6bff]"
          onClick={async () => {
            try {
              await accountApi("/api/v1/admin/claim", { method: "POST", body: "{}" });
              router.push("/admin");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not claim staff access");
            }
          }}
        >
          Claim Super Admin
        </button>
      ) : null}

      <div className="my-5 flex items-center gap-4 text-[12px] font-medium uppercase tracking-[0.14em] text-[#b0b8c6]">
        <span className="h-px flex-1 bg-[#e8eef5]" />
        or
        <span className="h-px flex-1 bg-[#e8eef5]" />
      </div>

      <div className="flex items-center gap-3 rounded-[18px] border border-[#eef2f7] bg-[#f7faff] px-4 py-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#2f6bff] shadow-sm">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M12 3 5 6.2v5.3c0 4.2 2.7 8 7 9.5 4.3-1.5 7-5.3 7-9.5V6.2L12 3Z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </span>
        <div>
          <p className="text-[13.5px] font-bold text-[#0f1c3f]">Protected Admin Access</p>
          <p className="text-[12px] leading-snug text-[#8a94a6]">Only authorized users can access this area.</p>
        </div>
      </div>
    </div>
  );
}
