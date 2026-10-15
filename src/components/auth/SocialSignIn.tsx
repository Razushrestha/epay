"use client";

import { useEffect, useState } from "react";
import { apiBase, apiUnreachableMessage, setToken } from "@/lib/account-api";

type SocialStep = { step?: string; challengeToken?: string; token?: string };

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

type Props = {
  layout?: "stack" | "row";
  onError: (message: string) => void;
  onEnroll: (challengeToken: string) => void;
  onSignedIn: (token: string) => void;
};

export function SocialSignIn({ layout = "stack", onError, onEnroll, onSignedIn }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  const appleClientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || "";
  const facebookAppId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || "";

  useEffect(() => {
    if (googleClientId && !document.getElementById("nexlo-gis")) {
      const script = document.createElement("script");
      script.id = "nexlo-gis";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      document.body.appendChild(script);
    }
    if (appleClientId && !document.getElementById("nexlo-apple")) {
      const script = document.createElement("script");
      script.id = "nexlo-apple";
      script.src = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
      script.async = true;
      document.body.appendChild(script);
    }
    if (facebookAppId && !document.getElementById("nexlo-fb")) {
      const w = window as unknown as { fbAsyncInit?: () => void };
      w.fbAsyncInit = () => {
        const fb = (window as unknown as { FB?: { init: (o: object) => void } }).FB;
        fb?.init({ appId: facebookAppId, cookie: true, xfbml: false, version: "v21.0" });
      };
      const script = document.createElement("script");
      script.id = "nexlo-fb";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, [googleClientId, appleClientId, facebookAppId]);

  async function finish(path: string, payload: object) {
    const res = await fetch(`${apiBase}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json()) as SocialStep & { error?: string };
    if (!res.ok) throw new Error(body.error ?? "Social sign-in did not complete.");
    if (body.step === "enroll" && body.challengeToken) {
      onEnroll(body.challengeToken);
      return;
    }
    if (body.token) {
      setToken(body.token);
      onSignedIn(body.token);
    }
  }

  async function startGoogle() {
    if (!googleClientId) {
      onError("Google sign-in is not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID.");
      return;
    }
    const g = (window as unknown as { google?: { accounts: { id: { initialize: (o: object) => void; prompt: () => void } } } }).google;
    if (!g?.accounts?.id) {
      onError("Google is still loading. Try again in a moment.");
      return;
    }
    g.accounts.id.initialize({
      client_id: googleClientId,
      callback: (resp: { credential: string }) => {
        void run("Google", () => finish("/api/v1/auth/google", { idToken: resp.credential }));
      },
    });
    g.accounts.id.prompt();
  }

  async function startApple() {
    if (!appleClientId) {
      onError("Apple sign-in is not configured. Add NEXT_PUBLIC_APPLE_CLIENT_ID.");
      return;
    }
    const apple = (
      window as unknown as {
        AppleID?: {
          auth: {
            init: (o: object) => void;
            signIn: () => Promise<{ authorization?: { id_token?: string }; user?: { name?: { firstName?: string; lastName?: string } } }>;
          };
        };
      }
    ).AppleID;
    if (!apple?.auth) {
      onError("Apple is still loading. Try again in a moment.");
      return;
    }
    apple.auth.init({
      clientId: appleClientId,
      scope: "name email",
      redirectURI: process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI || window.location.origin,
      usePopup: true,
    });
    const resp = await apple.auth.signIn();
    const idToken = resp.authorization?.id_token;
    if (!idToken) throw new Error("Apple did not return a sign-in token.");
    const name = [resp.user?.name?.firstName, resp.user?.name?.lastName].filter(Boolean).join(" ");
    await finish("/api/v1/auth/apple", { idToken, name });
  }

  async function startFacebook() {
    if (!facebookAppId) {
      onError("Facebook sign-in is not configured. Add NEXT_PUBLIC_FACEBOOK_APP_ID.");
      return;
    }
    const fb = (
      window as unknown as {
        FB?: { login: (cb: (r: { authResponse?: { accessToken?: string } }) => void, opts: object) => void };
      }
    ).FB;
    if (!fb?.login) {
      onError("Facebook is still loading. Try again in a moment.");
      return;
    }
    await new Promise<void>((resolve, reject) => {
      fb.login(
        (r) => {
          const token = r.authResponse?.accessToken;
          if (!token) {
            reject(new Error("Facebook sign-in was cancelled."));
            return;
          }
          void finish("/api/v1/auth/facebook", { accessToken: token }).then(() => resolve()).catch(reject);
        },
        { scope: "email,public_profile" },
      );
    });
  }

  async function run(name: string, task: () => Promise<void>) {
    setBusy(name);
    try {
      await task();
    } catch (err) {
      onError(err instanceof Error ? err.message : apiUnreachableMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const buttons = [
    { name: "Google", logo: <GoogleLogo />, onClick: () => void run("Google", startGoogle) },
    { name: "Apple", logo: <AppleLogo />, onClick: () => void run("Apple", startApple) },
    { name: "Facebook", logo: <FacebookLogo />, onClick: () => void run("Facebook", startFacebook) },
  ];

  if (layout === "row") {
    return (
      <div className="grid grid-cols-3 gap-2">
        {buttons.map((s) => (
          <button
            key={s.name}
            type="button"
            disabled={Boolean(busy)}
            onClick={s.onClick}
            className="flex h-10 items-center justify-center gap-1.5 rounded-full border border-[#e3e8f0] text-[13px] font-medium text-[#1a2338] hover:bg-[#f8fafd] disabled:opacity-60"
          >
            {s.logo}
            {busy === s.name ? "…" : s.name}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {buttons.map((s) => (
        <button
          key={s.name}
          type="button"
          disabled={Boolean(busy)}
          onClick={s.onClick}
          className="relative flex h-11 w-full items-center justify-center rounded-full border border-[#dfe5ee] bg-white text-[14.5px] font-medium text-[#1a2338] transition hover:border-[#c3cddd] hover:bg-[#f8fafd] disabled:opacity-60"
        >
          <span className="absolute left-4 flex items-center">{s.logo}</span>
          {busy === s.name ? "Connecting…" : `Continue with ${s.name}`}
        </button>
      ))}
    </div>
  );
}
