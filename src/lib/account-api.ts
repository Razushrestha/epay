const remoteApi = (process.env.API_PROXY_TARGET || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(
  /\/$/,
  "",
);

// Browser calls same-origin /api/v1 so Next can rewrite to the API. That avoids
// CORS failures when the app is opened on a LAN host like http://192.168.x.x:3000
// while NEXT_PUBLIC_API_URL still points at localhost:4000.
export const apiBase = typeof window === "undefined" ? remoteApi : "";

export const tokenKey = "nexlo_token";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(tokenKey);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(tokenKey, token);
  else {
    localStorage.removeItem(tokenKey);
    cacheProfile(null);
  }
}

export const profileCacheKey = "nexlo_profile";
export const PROFILE_EVENT = "nexlo-profile";

export type CachedProfile = {
  avatarUrl: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  username: string | null;
};

export function cacheProfile(user: CachedProfile | null) {
  if (typeof window === "undefined") return;
  if (!user) localStorage.removeItem(profileCacheKey);
  else {
    localStorage.setItem(
      profileCacheKey,
      JSON.stringify({
        avatarUrl: user.avatarUrl ?? null,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        displayName: user.displayName ?? null,
        username: user.username ?? null,
      }),
    );
  }
  window.dispatchEvent(new Event(PROFILE_EVENT));
}

export function readCachedProfile(): CachedProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(profileCacheKey);
    return raw ? (JSON.parse(raw) as CachedProfile) : null;
  } catch {
    return null;
  }
}

export function apiUnreachableMessage(err: unknown) {
  if (err instanceof Error && err.name === "AbortError") {
    return "The request timed out. Make sure the API is running (`npm run dev:api`), then try again.";
  }
  return "Cannot reach the Nexlo API. On this computer run `npm run dev` and `npm run dev:api` together.";
}

export function digitsCode(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 6);
  return digits.length === 6 ? digits : "";
}

export const VERIFY_OTP_TTL_SECONDS = 30;
export const VERIFY_RESEND_COOLDOWN_SECONDS = 30;

export const localOtpNotice =
  "Email is not sending from this computer yet. The code is filled in. Tap Verify.";

export const localSmsOtpNotice =
  "SMS is not sending from this computer yet. The code is filled in. Tap Verify.";

export async function accountApi<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (typeof window !== "undefined") {
    let session = localStorage.getItem("nexlo_session");
    if (!session) {
      session = crypto.randomUUID().replaceAll("-", "");
      localStorage.setItem("nexlo_session", session);
    }
    headers.set("x-session-id", session);
  }
  let res: Response;
  try {
    res = await fetch(`${apiBase}${path}`, { ...options, headers });
  } catch (err) {
    throw new Error(apiUnreachableMessage(err));
  }
  const text = await res.text();
  let body: { error?: string } = {};
  try {
    body = text ? (JSON.parse(text) as { error?: string }) : {};
  } catch {
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
  }
  if (res.status === 401) {
    setToken(null);
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/account")) {
      window.location.replace("/login");
    }
  }
  if (!res.ok) throw new Error(body.error ?? "Request failed");
  return body as T;
}

// Attach helper methods to accountApi
accountApi.getToken = getToken;
accountApi.setToken = setToken;
