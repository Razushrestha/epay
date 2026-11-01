import assert from "node:assert/strict";
import test from "node:test";

/**
 * Mirrors server/identity.mjs socialDemoAllowed / socialProviderConfigured rules
 * so QA keeps demo social login when live provider apps are not configured.
 */
function socialProviderConfigured(provider, env) {
  if (provider === "google") return Boolean(env.GOOGLE_CLIENT_ID || env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
  if (provider === "apple") return Boolean(env.APPLE_CLIENT_ID || env.NEXT_PUBLIC_APPLE_CLIENT_ID);
  if (provider === "facebook") return Boolean(env.FACEBOOK_APP_ID || env.NEXT_PUBLIC_FACEBOOK_APP_ID);
  return false;
}

function socialDemoAllowed(provider, env) {
  if (env.ALLOW_DEMO_SOCIAL === "0") return false;
  if (env.ALLOW_DEMO_SOCIAL === "1") return true;
  return !socialProviderConfigured(provider, env);
}

test("demo social is allowed when provider apps are not configured", () => {
  assert.equal(socialDemoAllowed("google", {}), true);
  assert.equal(socialDemoAllowed("apple", {}), true);
  assert.equal(socialDemoAllowed("facebook", {}), true);
});

test("demo social turns off when live credentials exist unless forced on", () => {
  assert.equal(socialDemoAllowed("google", { NEXT_PUBLIC_GOOGLE_CLIENT_ID: "abc" }), false);
  assert.equal(socialDemoAllowed("google", { NEXT_PUBLIC_GOOGLE_CLIENT_ID: "abc", ALLOW_DEMO_SOCIAL: "1" }), true);
  assert.equal(socialDemoAllowed("apple", { ALLOW_DEMO_SOCIAL: "0" }), false);
});
