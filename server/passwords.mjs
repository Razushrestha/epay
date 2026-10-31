import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

async function argon2idHash(password, salt) {
  try {
    const { argon2id } = await import("hash-wasm");
    return argon2id({
      password,
      salt,
      parallelism: 1,
      iterations: 3,
      memorySize: 4096,
      hashLength: 32,
      outputType: "encoded",
    });
  } catch {
    return null;
  }
}

async function argon2idVerify(encoded, password) {
  try {
    const { argon2Verify } = await import("hash-wasm");
    return argon2Verify({ password, hash: encoded });
  } catch {
    return false;
  }
}

export function passwordPolicyError(password) {
  const value = String(password ?? "");
  if (value.length < 8) return "Password must be at least 8 characters";
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
    return "Use 8+ characters with mixed case, a number, and a symbol";
  }
  return "";
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const encoded = await argon2idHash(password, salt);
  if (encoded) return encoded;
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  if (!stored) return false;
  if (stored.startsWith("$argon2")) return argon2idVerify(stored, password);
  const [algo, saltHex, hashHex] = stored.split(":");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const hash = scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}
