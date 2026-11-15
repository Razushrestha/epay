/**
 * Fail fast on insecure production configuration instead of silently using dev defaults.
 * (identity.mjs falls back to a hard-coded JWT secret when JWT_SECRET is unset, which would let
 * anyone forge session tokens.)
 */
const KNOWN_WEAK_SECRETS = new Set([
  "nexlo-dev-jwt",
  "nexlo-kyc-dev",
  "your-super-secret-jwt-key-change-this-in-production",
  "your-super-secret-production-key-min-32-chars",
  "your-secret-key",
  "secret",
  "changeme",
]);

export function productionConfigProblems(env = process.env) {
  const problems = [];
  const jwt = String(env.JWT_SECRET || env.SESSION_SECRET || "");
  if (jwt.length < 32 || KNOWN_WEAK_SECRETS.has(jwt)) {
    problems.push("JWT_SECRET must be set to a random value of at least 32 characters");
  }
  const kyc = env.KYC_URL_SECRET;
  if (kyc && (kyc.length < 32 || KNOWN_WEAK_SECRETS.has(kyc))) {
    problems.push("KYC_URL_SECRET, if set, must be at least 32 random characters");
  }
  const cors = String(env.CORS_ORIGIN || "").split(",").map((s) => s.trim());
  if (cors.includes("*")) problems.push("CORS_ORIGIN must not be '*' in production");
  if (!String(env.CORS_ORIGIN || "").trim()) problems.push("CORS_ORIGIN must list your frontend origin(s)");
  if (env.ALLOW_DEMO_SOCIAL === "1") problems.push("ALLOW_DEMO_SOCIAL=1 lets anyone sign in with a made-up email");
  if (env.ALLOW_STATIC_OTP === "1") problems.push("ALLOW_STATIC_OTP=1 accepts a fixed, publicly known verification code");
  return problems;
}

export function assertSecureConfig(env = process.env) {
  const problems = productionConfigProblems(env);
  if (env.NODE_ENV === "production") {
    if (problems.length) {
      console.error("[security] Refusing to start with insecure production configuration:");
      for (const p of problems) console.error(`  - ${p}`);
      process.exit(1);
    }
  } else if (problems.length) {
    console.warn("[security] Development config would be rejected in production:");
    for (const p of problems) console.warn(`  - ${p}`);
  }
}
