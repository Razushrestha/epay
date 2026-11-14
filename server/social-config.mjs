/**
 * Social sign-in configuration rules, shared by the API and its tests.
 * Pure functions: pass `env` explicitly in tests.
 */

const PROVIDERS = ["google", "apple", "facebook"];

export function isSocialProvider(provider) {
  return PROVIDERS.includes(provider);
}

/** Public OAuth client id for a provider (safe to send to the browser). */
export function socialClientId(provider, env = process.env) {
  if (provider === "google") return env.GOOGLE_CLIENT_ID || env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  if (provider === "apple") return env.APPLE_CLIENT_ID || env.NEXT_PUBLIC_APPLE_CLIENT_ID || "";
  if (provider === "facebook") return env.FACEBOOK_APP_ID || env.NEXT_PUBLIC_FACEBOOK_APP_ID || "";
  return "";
}

/**
 * A provider is "live" only when everything needed to verify its tokens on the server is set.
 * Facebook also needs its app secret, otherwise tokens from any Facebook app would be accepted.
 */
export function socialProviderConfigured(provider, env = process.env) {
  if (!socialClientId(provider, env)) return false;
  if (provider === "facebook") return Boolean(env.FACEBOOK_APP_SECRET);
  return true;
}

/**
 * Demo social sign-in signs anyone in as any email, so it must never run in production by accident.
 * - ALLOW_DEMO_SOCIAL=1 forces it on (explicit opt-in, any environment).
 * - ALLOW_DEMO_SOCIAL=0 forces it off.
 * - Otherwise it is only available outside production, and only while the provider is not configured.
 */
export function socialDemoAllowed(provider, env = process.env) {
  if (env.ALLOW_DEMO_SOCIAL === "1") return true;
  if (env.ALLOW_DEMO_SOCIAL === "0") return false;
  if (env.NODE_ENV === "production") return false;
  return !socialProviderConfigured(provider, env);
}

/** "live" | "demo" | "off" for the sign-in buttons. */
export function socialMode(provider, env = process.env) {
  if (socialProviderConfigured(provider, env)) return "live";
  return socialDemoAllowed(provider, env) ? "demo" : "off";
}

/** Providers say an email is verified as boolean true or the string "true". */
export function isVerifiedFlag(value) {
  return value === true || value === "true";
}
