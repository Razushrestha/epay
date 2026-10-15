"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiBase, apiUnreachableMessage, setToken } from "@/lib/account-api";
import { SocialSignIn } from "@/components/auth/SocialSignIn";

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<"individual" | "business">("individual");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [country, setCountry] = useState("");
  const [buyerOnly, setBuyerOnly] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const field =
    "flex h-10 items-center gap-2.5 rounded-xl border border-[#e3e8f0] bg-white px-3.5 text-[#8a94a6] focus-within:border-[#3665f3] focus-within:text-[#3665f3]";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (accountType === "individual" && !agreed) {
      setError("Please agree to the Terms of Service and Privacy Policy.");
      return;
    }
    if (accountType === "business" && !country) {
      setError("Select where your business is registered.");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError("Enter an email or a phone number.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      // Add 30-second timeout for cold start
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      
      const res = await fetch(`${apiBase}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          phone: phone.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          password,
          displayName:
            accountType === "business"
              ? businessName.trim()
              : `${firstName.trim()} ${lastName.trim()}`.trim(),
          accountType,
          country: accountType === "business" ? country : undefined,
          buyerOnly: accountType === "business" ? buyerOnly : false,
          acceptedPrivacy: true,
          acceptedTerms: true,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeout);

      const text = await res.text();
      let body: { error?: string; data?: { devCode?: string; sent?: boolean; destinationMasked?: string; deliveryError?: string } } = {};
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        setError(`The API returned an unexpected response (${res.status}).`);
        return;
      }
      if (!res.ok) {
        if (res.status === 409) {
          sessionStorage.setItem("nexlo_verify_id", email.trim() || phone.trim());
          setError(
            `${body.error ?? "That email or phone is already registered."} If you just signed up, open Confirm it is you and tap Resend.`,
          );
          return;
        }
        setError(body.error ?? "We could not create your account.");
        return;
      }
      if (body.data?.devCode) sessionStorage.setItem("nexlo_dev_code", body.data.devCode);
      sessionStorage.setItem("nexlo_verify_id", email.trim() || phone.trim());
      sessionStorage.setItem("nexlo_code_sent", body.data?.sent === false ? "0" : "1");
      if (body.data?.destinationMasked) sessionStorage.setItem("nexlo_verify_dest", body.data.destinationMasked);
      if (body.data?.deliveryError) sessionStorage.setItem("nexlo_code_error", body.data.deliveryError);
      else sessionStorage.removeItem("nexlo_code_error");
      router.push("/verify");
    } catch (err) {
      setError(apiUnreachableMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[460px] rounded-[22px] bg-white px-6 py-5 shadow-[0_18px_50px_-24px_rgba(20,48,110,0.35)] sm:px-7">
      <h1 className="text-[24px] font-extrabold tracking-tight text-[#0f1c3f]">Create your account</h1>
      <p className="mt-1 text-[13px] text-[#6b7587]">
        Join Nexlo and start exploring a world of endless possibilities.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => setAccountType("individual")}
          className={`flex h-10 items-center justify-center gap-2 rounded-full text-[13.5px] font-semibold ${
            accountType === "individual"
              ? "bg-gradient-to-r from-[#12c4b0] to-[#3665f3] text-white"
              : "border border-[#c5cedb] bg-white text-[#1a2338]"
          }`}
        >
          <Icon>
            <circle cx="12" cy="8" r="3.2" />
            <path d="M5 19c.6-3 3.2-4.6 7-4.6s6.4 1.6 7 4.6" />
          </Icon>
          Personal
        </button>
        <button
          type="button"
          onClick={() => setAccountType("business")}
          className={`flex h-10 items-center justify-center gap-2 rounded-full text-[13.5px] font-semibold ${
            accountType === "business"
              ? "bg-gradient-to-r from-[#12c4b0] to-[#3665f3] text-white"
              : "border border-[#c5cedb] bg-white text-[#1a2338]"
          }`}
        >
          <Icon>
            <rect x="3" y="8" width="18" height="12" rx="2" />
            <path d="M8 8V6.5A2.5 2.5 0 0 1 10.5 4h3A2.5 2.5 0 0 1 16 6.5V8" />
          </Icon>
          Business
        </button>
      </div>

      {accountType === "business" && (
        <p className="mt-3 text-[12.5px] leading-snug text-[#3a4458]">
          Continue to register as a <span className="font-semibold">business or nonprofit</span>, or if you
          plan to sell a large number of goods.
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-3.5 space-y-2.5">
        {accountType === "individual" && (
        <div className="grid grid-cols-2 gap-2.5">
          <label className={field}>
            <Icon>
              <circle cx="12" cy="8" r="3" />
              <path d="M6 19c.5-2.6 2.8-4 6-4s5.5 1.4 6 4" />
            </Icon>
            <input
              required
              autoComplete="given-name"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] text-[#0f1c3f] outline-none placeholder:text-[#8a94a6]"
            />
          </label>
          <label className={field}>
            <Icon>
              <circle cx="12" cy="8" r="3" />
              <path d="M6 19c.5-2.6 2.8-4 6-4s5.5 1.4 6 4" />
            </Icon>
            <input
              required
              autoComplete="family-name"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] text-[#0f1c3f] outline-none placeholder:text-[#8a94a6]"
          />
          </label>
        </div>
        )}

        {accountType === "business" && (
          <input
            required
            autoComplete="organization"
            placeholder="Business name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="h-10 w-full rounded-xl border border-[#e3e8f0] bg-[#f7f8fa] px-3.5 text-[13.5px] text-[#0f1c3f] outline-none placeholder:text-[#8a94a6] focus:border-[#3665f3] focus:bg-white"
          />
        )}

        <label className={field}>
          <Icon>
            <rect x="3" y="5" width="18" height="14" rx="2.5" />
            <path d="m3.5 7 8.5 6 8.5-6" />
          </Icon>
          <input
            type="email"
            autoComplete="email"
            placeholder={accountType === "business" ? "Business email" : "Email or leave blank and use phone"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] text-[#0f1c3f] outline-none placeholder:text-[#8a94a6]"
          />
        </label>

        <label className={field}>
          <Icon>
            <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
            <path d="M11 18h2" />
          </Icon>
          <input
            type="tel"
            autoComplete="tel"
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] text-[#0f1c3f] outline-none placeholder:text-[#8a94a6]"
          />
        </label>

        <label className={field}>
          <Icon>
            <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
            <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
          </Icon>
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] text-[#0f1c3f] outline-none placeholder:text-[#8a94a6]"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="shrink-0 text-[#8a94a6]"
          >
            <Icon>
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {showPassword && <path d="M4 4l16 16" />}
            </Icon>
          </button>
        </label>

        {accountType === "business" && (
          <>
            <label className="block">
              <span className="sr-only">Where is your business registered?</span>
              <select
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="h-10 w-full appearance-none rounded-xl border border-[#e3e8f0] bg-[#f7f8fa] bg-[length:12px] bg-[right_14px_center] bg-no-repeat px-3.5 text-[13.5px] text-[#0f1c3f] outline-none focus:border-[#3665f3] focus:bg-white"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7587' stroke-width='2.4'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                }}
              >
                <option value="">Where is your business registered?</option>
                {["Nepal", "India", "China", "United States", "United Kingdom", "Australia", "Japan", "Singapore", "United Arab Emirates", "Germany", "Canada"].map(
                  (name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ),
                )}
              </select>
            </label>
            <p className="text-[12px] leading-snug text-[#6b7587]">
              If your business isn&apos;t registered, select your country of residence.
            </p>
            <label className="flex items-start gap-2 text-[13px] text-[#1a2338]">
              <input
                type="checkbox"
                checked={buyerOnly}
                onChange={(e) => setBuyerOnly(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#c9d2e0] accent-[#3665f3]"
              />
              I&apos;m only interested in buying on Nexlo for now
            </label>
            <p className="text-[12.5px] leading-snug text-[#3a4458]">
              By selecting <span className="font-semibold">Create business account</span>, you agree to our{" "}
              <span className="font-semibold text-[#3665f3]">User Agreement</span> and acknowledge reading our{" "}
              <span className="font-semibold text-[#3665f3]">User Privacy Notice</span>.
            </p>
          </>
        )}

        {accountType === "individual" && (
        <label className="flex items-start gap-2 pt-0.5 text-[12.5px] leading-snug text-[#3a4458]">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="mt-0.5 flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-[4px] border border-[#c9d2e0] text-transparent peer-checked:border-[#3665f3] peer-checked:bg-[#3665f3] peer-checked:text-white"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          </span>
          <span>
            I agree to Nexlo&apos;s <span className="font-semibold text-[#3665f3]">Terms of Service</span> and{" "}
            <span className="font-semibold text-[#3665f3]">Privacy Policy</span>.
          </span>
        </label>
        )}

        <div aria-live="polite">
          {error && <p className="rounded-lg bg-red-50 px-3 py-1.5 text-[12.5px] text-red-700">{error}</p>}
          {notice && !error && <p className="rounded-lg bg-[#f2f7ff] px-3 py-1.5 text-[12.5px] text-[#2a4fa8]">{notice}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#3665f3] to-[#12c4b0] text-[15px] font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Creating…" : accountType === "business" ? "Create business account" : "Create account"}
          {!loading && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          )}
        </button>
      </form>

      {accountType === "individual" && (
      <>
      <div className="my-3 flex items-center gap-3 text-[12.5px] text-[#8a94a6]">
        <span className="h-px flex-1 bg-[#e5eaf2]" />
        or
        <span className="h-px flex-1 bg-[#e5eaf2]" />
      </div>

      <SocialSignIn
        layout="row"
        onError={(message) => {
          setNotice(null);
          setError(message);
        }}
        onEnroll={() => router.push("/login")}
        onSignedIn={(token) => {
          setToken(token);
          router.push("/account");
        }}
      />

      <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-[#e8eef6] bg-[#f7fafc] px-3 py-2.5 text-[12px] leading-snug text-[#6b7587]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3665f3" strokeWidth="1.7" className="mt-0.5 shrink-0" aria-hidden>
          <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.4 7.5 9.5 4.4-1.1 7.5-4.9 7.5-9.5V6L12 3Z" />
          <path d="m9 12 2.2 2.2L15.2 10" />
        </svg>
        <p>
          <span className="font-semibold text-[#0f1c3f]">Your data is safe with us.</span>
          <br />
          We never share your information with third parties.
        </p>
      </div>
      </>
      )}
    </div>
  );
}
