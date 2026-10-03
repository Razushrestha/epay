"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function AppleLogo() {
  return (
    <svg width="17" height="18" viewBox="0 0 24 24" fill="#111" aria-hidden>
      <path d="M16.37 12.6c-.03-2.5 2.04-3.7 2.13-3.76-1.16-1.7-2.97-1.93-3.61-1.96-1.54-.16-3 .9-3.78.9-.78 0-1.98-.88-3.26-.86-1.68.03-3.22.98-4.09 2.48-1.74 3.02-.45 7.5 1.25 9.95.83 1.2 1.82 2.55 3.12 2.5 1.25-.05 1.72-.81 3.24-.81 1.51 0 1.94.81 3.26.78 1.35-.03 2.2-1.22 3.02-2.43.95-1.39 1.34-2.74 1.37-2.81-.03-.01-2.62-1-2.65-3.98ZM13.9 5.3c.69-.84 1.16-2 1.03-3.16-1 .04-2.2.66-2.92 1.5-.64.74-1.2 1.92-1.05 3.05 1.11.09 2.24-.56 2.94-1.39Z" />
    </svg>
  );
}

function FacebookLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path fill="#fff" d="M16.67 15.47 17.2 12h-3.33v-2.25c0-.95.47-1.88 1.96-1.88h1.52V4.92s-1.38-.24-2.7-.24c-2.75 0-4.55 1.67-4.55 4.68V12H6.05v3.47h3.05V24h3.77v-8.53h2.8Z" />
    </svg>
  );
}

const socials = [
  { name: "Google", logo: <GoogleLogo /> },
  { name: "Apple", logo: <AppleLogo /> },
  { name: "Facebook", logo: <FacebookLogo /> },
];

export function LoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identifier.trim(), password }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "We could not sign you in. Check your details and try again.");
        return;
      }
      router.push("/");
    } catch {
      setError("We could not reach the server. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  const fieldWrap =
    "flex h-11 items-center gap-3 rounded-full border border-[#dfe5ee] bg-white px-4 text-[#8a94a6] transition focus-within:border-[#2f6bff] focus-within:text-[#2f6bff] focus-within:shadow-[0_0_0_3px_rgba(47,107,255,0.12)]";

  return (
    <div className="w-full max-w-[420px]">
      <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-[#0f1c3f]">
        Sign in to{" "}
        <span className="bg-gradient-to-r from-[#08c4a6] to-[#2f6bff] bg-clip-text text-transparent">
          Nexlo
        </span>
      </h1>
      <p className="mt-1.5 text-[13.5px] text-[#6b7587]">
        Welcome back! Please enter your details to continue.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
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
              placeholder="Email or username"
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
              className="shrink-0 text-[#8a94a6] hover:text-[#2f6bff]"
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
              className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border border-[#c9d2e0] bg-white text-transparent transition peer-checked:border-[#2f6bff] peer-checked:bg-[#2f6bff] peer-checked:text-white"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            </span>
            Remember me
          </label>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setNotice("Password reset by email is coming soon. Contact support if you are locked out.");
            }}
            className="text-[13.5px] font-medium text-[#2f6bff] hover:underline"
          >
            Forgot password?
          </button>
        </div>

        <div aria-live="polite">
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

        <button
          type="submit"
          disabled={loading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#2f6bff] text-[15px] font-semibold text-white shadow-[0_8px_18px_-8px_rgba(47,107,255,0.75)] transition hover:bg-[#2459e0] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Continue"}
          {!loading && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          )}
        </button>
      </form>

      <div className="my-4 flex items-center gap-4 text-[13px] text-[#8a94a6]">
        <span className="h-px flex-1 bg-[#e5eaf2]" />
        or
        <span className="h-px flex-1 bg-[#e5eaf2]" />
      </div>

      <div className="space-y-2.5">
        {socials.map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => {
              setError(null);
              setNotice(`${s.name} sign-in will be available soon. Please use your email for now.`);
            }}
            className="relative flex h-11 w-full items-center justify-center rounded-full border border-[#dfe5ee] bg-white text-[14.5px] font-medium text-[#1a2338] transition hover:border-[#c3cddd] hover:bg-[#f8fafd]"
          >
            <span className="absolute left-4 flex items-center">{s.logo}</span>
            Continue with {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
