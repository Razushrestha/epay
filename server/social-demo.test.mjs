import assert from "node:assert/strict";
import test from "node:test";
import {
  isVerifiedFlag,
  socialClientId,
  socialDemoAllowed,
  socialMode,
  socialProviderConfigured,
} from "./social-config.mjs";

test("demo social is allowed outside production when provider apps are not configured", () => {
  assert.equal(socialDemoAllowed("google", {}), true);
  assert.equal(socialDemoAllowed("apple", { NODE_ENV: "development" }), true);
  assert.equal(socialDemoAllowed("facebook", {}), true);
});

test("demo social is never on in production unless ALLOW_DEMO_SOCIAL=1", () => {
  const prod = { NODE_ENV: "production" };
  assert.equal(socialDemoAllowed("google", prod), false);
  assert.equal(socialDemoAllowed("apple", prod), false);
  assert.equal(socialDemoAllowed("facebook", prod), false);
  assert.equal(socialDemoAllowed("google", { ...prod, ALLOW_DEMO_SOCIAL: "1" }), true);
  assert.equal(socialDemoAllowed("google", { ...prod, ALLOW_DEMO_SOCIAL: "0" }), false);
});

test("demo social turns off when live credentials exist unless forced on", () => {
  assert.equal(socialDemoAllowed("google", { GOOGLE_CLIENT_ID: "abc" }), false);
  assert.equal(socialDemoAllowed("google", { GOOGLE_CLIENT_ID: "abc", ALLOW_DEMO_SOCIAL: "1" }), true);
  assert.equal(socialDemoAllowed("apple", { ALLOW_DEMO_SOCIAL: "0" }), false);
});

test("facebook is only live with both the app id and the app secret", () => {
  assert.equal(socialProviderConfigured("facebook", { FACEBOOK_APP_ID: "1" }), false);
  assert.equal(socialProviderConfigured("facebook", { FACEBOOK_APP_SECRET: "s" }), false);
  assert.equal(socialProviderConfigured("facebook", { FACEBOOK_APP_ID: "1", FACEBOOK_APP_SECRET: "s" }), true);
  assert.equal(socialProviderConfigured("google", { GOOGLE_CLIENT_ID: "g" }), true);
  assert.equal(socialProviderConfigured("apple", { NEXT_PUBLIC_APPLE_CLIENT_ID: "a" }), true);
  assert.equal(socialProviderConfigured("twitter", {}), false);
});

test("socialMode reports live, demo or off for the buttons", () => {
  assert.equal(socialMode("google", { GOOGLE_CLIENT_ID: "g", NODE_ENV: "production" }), "live");
  assert.equal(socialMode("google", { NODE_ENV: "production" }), "off");
  assert.equal(socialMode("google", {}), "demo");
  assert.equal(socialMode("facebook", { FACEBOOK_APP_ID: "1", NODE_ENV: "production" }), "off");
});

test("client ids prefer the server variable and fall back to NEXT_PUBLIC_", () => {
  assert.equal(socialClientId("google", { GOOGLE_CLIENT_ID: "a", NEXT_PUBLIC_GOOGLE_CLIENT_ID: "b" }), "a");
  assert.equal(socialClientId("google", { NEXT_PUBLIC_GOOGLE_CLIENT_ID: "b" }), "b");
  assert.equal(socialClientId("facebook", {}), "");
});

test("verified flags accept boolean true and the string true only", () => {
  assert.equal(isVerifiedFlag(true), true);
  assert.equal(isVerifiedFlag("true"), true);
  assert.equal(isVerifiedFlag("false"), false);
  assert.equal(isVerifiedFlag(false), false);
  assert.equal(isVerifiedFlag(undefined), false);
});
