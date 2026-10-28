import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { accountApi, apiBase, getToken } from "@/lib/account-api";

export function passkeysSupported() {
  return typeof window !== "undefined" && browserSupportsWebAuthn();
}

async function post<T>(path: string, body: object, authed = false): Promise<T> {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (authed) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${apiBase}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Passkey request failed");
  return data as T;
}

export async function registerPasskey(name?: string) {
  if (!passkeysSupported()) throw new Error("This browser does not support passkeys.");
  const started = await post<{ options: Parameters<typeof startRegistration>[0]["optionsJSON"]; challengeToken: string }>(
    "/api/v1/account/passkeys/options",
    {},
    true,
  );
  const response = await startRegistration({ optionsJSON: started.options });
  await accountApi("/api/v1/account/passkeys", {
    method: "POST",
    body: JSON.stringify({ response, challengeToken: started.challengeToken, name }),
  });
}

export async function authenticatePasskey(identifier?: string) {
  if (!passkeysSupported()) throw new Error("This browser does not support passkeys.");
  const started = await post<{ options: Parameters<typeof startAuthentication>[0]["optionsJSON"]; challengeToken: string }>(
    "/api/v1/auth/passkeys/options",
    { identifier: identifier || undefined },
  );
  const response = await startAuthentication({ optionsJSON: started.options });
  return post<{ token: string }>("/api/v1/auth/passkeys", {
    response,
    challengeToken: started.challengeToken,
  });
}
