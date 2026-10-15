import { sendSms } from "./sms.mjs";

const SUBJECTS = {
  verify: "Your Nexlo verification code",
  login_2fa: "Your Nexlo sign-in code",
  reset: "Your Nexlo password reset code",
  enroll_2fa: "Your Nexlo security code",
  change_phone: "Confirm your Nexlo phone-number change",
};

const SEND_TIMEOUT_MS = 10000;
const US_BASE = "https://api.mailgun.net";
const EU_BASE = "https://api.eu.mailgun.net";

let preferredBase = "";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function strip(value) {
  return String(value || "").replace(/\/$/, "");
}

export function maskDestination(value, channel = "email") {
  const v = String(value || "").trim();
  if (!v) return channel === "phone" ? "your phone" : "your email";
  if (channel === "phone") {
    const digits = v.replace(/\D/g, "");
    if (digits.length < 4) return "your phone";
    return `${digits.slice(0, 2)}••••${digits.slice(-2)}`;
  }
  const at = v.indexOf("@");
  if (at < 1) return "your email";
  return `${v.slice(0, 1)}•••@${v.slice(at + 1)}`;
}

export function mailgunWrongRegion(err) {
  const status = Number(err?.status || 0);
  const message = String(err?.message || err?.payload?.message || "").toLowerCase();
  return (
    status === 401 ||
    status === 404 ||
    message.includes("domain not found") ||
    message.includes("unknown domain") ||
    message.includes("forbidden")
  );
}

export function mailgunBases() {
  const primary = strip(process.env.MAILGUN_API_URL);
  const region = String(process.env.MAILGUN_REGION || "").toLowerCase();
  const ordered = [];
  if (preferredBase) ordered.push(preferredBase);
  if (primary) ordered.push(primary);
  if (region === "eu") ordered.push(EU_BASE, US_BASE);
  else ordered.push(US_BASE, EU_BASE);
  return [...new Set(ordered.filter(Boolean))];
}

export function classifyMailError(err) {
  const message = String(err?.message || err || "");
  const status = Number(err?.status || 0);
  const lower = message.toLowerCase();
  if (status === 403 || lower.includes("authorized recipient") || lower.includes("sandbox")) {
    return {
      retryable: false,
      userMessage:
        "We could not deliver to this email. Check the address, then tap Resend. Mailgun sandbox only delivers to authorized recipients.",
    };
  }
  if (mailgunWrongRegion(err)) {
    return { retryable: true, userMessage: "Email delivery could not reach Mailgun. Tap Resend." };
  }
  if (err?.name === "AbortError" || lower.includes("abort") || lower.includes("timeout")) {
    return { retryable: true, userMessage: "The email provider timed out. Tap Resend." };
  }
  if (status === 429 || status >= 500) {
    return { retryable: true, userMessage: "The email provider is busy. Tap Resend." };
  }
  return { retryable: !status || status >= 500, userMessage: "We could not send the code. Tap Resend." };
}

function fromAddress(domain) {
  const fallback = `Nexlo <postmaster@${domain}>`;
  const from = String(process.env.MAILGUN_FROM || fallback).trim() || fallback;
  const host = from.match(/@([^>]+)/)?.[1]?.toLowerCase();
  const expected = String(domain).toLowerCase();
  if (host && host !== expected && !host.endsWith(`.${expected}`)) {
    console.warn("[mail] MAILGUN_FROM host", host, "does not match domain", expected, "- using postmaster");
    return fallback;
  }
  return from;
}

async function postMailgun(base, domain, key, fields) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) {
    if (v != null && v !== "") body.set(k, String(v));
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/v3/${domain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${key}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || `Mailgun ${res.status}`);
      err.status = res.status;
      err.payload = data;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function codeEmailHtml(code, purpose) {
  const label = SUBJECTS[purpose] ?? "Your Nexlo code";
  return `<div style="font-family:Arial,sans-serif;max-width:480px;color:#0f1c3f">
  <p style="font-size:16px;font-weight:700;margin:0 0 12px">${label}</p>
  <p style="font-size:13px;color:#6b7587;margin:0 0 16px">Use this code within 10 minutes. If you requested another code, use the latest one.</p>
  <p style="font-size:28px;letter-spacing:8px;font-weight:800;margin:0 0 16px">${code}</p>
  <p style="font-size:12px;color:#8a94a6">If you did not request this, you can ignore the email.</p>
</div>`;
}

export async function sendCodeEmail({ to, code, purpose = "verify" }) {
  const key = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const destination = String(to || "").trim().toLowerCase();
  if (!key || !domain || !destination) {
    const missing = [!key && "MAILGUN_API_KEY", !domain && "MAILGUN_DOMAIN"].filter(Boolean);
    console.warn(
      "[mail] Mailgun is not configured; skipping email to",
      destination || to,
      missing.length ? `(missing ${missing.join(", ")})` : "",
    );
    return {
      sent: false,
      skipped: true,
      masked: maskDestination(destination, "email"),
      userMessage: "Email delivery is not configured. Tap Resend, or use the on-screen code if one is shown.",
    };
  }

  const from = fromAddress(domain);
  const subject = SUBJECTS[purpose] ?? "Your Nexlo code";
  const text = `Your Nexlo code is ${code}. It expires in 10 minutes. If you requested another code, use the latest one.`;
  const html = codeEmailHtml(code, purpose);
  const fields = {
    from,
    to: destination,
    subject,
    text,
    html,
    "o:tracking": "no",
    "o:tag": `nexlo-otp-${purpose}`,
  };

  let lastError;
  for (const base of mailgunBases()) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const data = await postMailgun(base, domain, key, fields);
        preferredBase = base;
        console.log("[mail] sent", purpose, "to", destination, "via", base, data?.id ?? "");
        return { sent: true, skipped: false, id: data?.id, masked: maskDestination(destination, "email") };
      } catch (err) {
        lastError = err;
        const classified = classifyMailError(err);
        console.error("[mail] failed", purpose, destination, base, err?.status, err?.message || err);
        if (mailgunWrongRegion(err)) break;
        if (!classified.retryable) {
          return { sent: false, skipped: false, masked: maskDestination(destination, "email"), ...classified };
        }
        if (attempt === 0) await wait(600);
      }
    }
  }
  const classified = classifyMailError(lastError);
  return { sent: false, skipped: false, masked: maskDestination(destination, "email"), ...classified };
}

export async function sendTransactional({ to, subject, text }) {
  const key = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const destination = String(to || "").trim();
  if (!key || !domain || !destination) {
    console.warn("[mail] skip transactional to", destination || to, subject);
    return { skipped: true, sent: false };
  }
  const from = fromAddress(domain);
  const bases = mailgunBases();
  let lastError;
  for (const base of bases) {
    try {
      const data = await postMailgun(base, domain, key, { from, to: destination, subject, text, "o:tracking": "no" });
      preferredBase = base;
      return { skipped: false, sent: true, id: data?.id };
    } catch (err) {
      lastError = err;
      console.error("[mail] transactional failed", base, err?.message || err);
      if (!mailgunWrongRegion(err) && !classifyMailError(err).retryable) break;
    }
  }
  return { skipped: true, sent: false, error: lastError?.message };
}

export async function deliverCode(channel, destination, code, purpose) {
  const dest = String(destination || "").trim();
  if (!dest) {
    return { sent: false, skipped: true, userMessage: "No email or phone to send a code to." };
  }
  if (channel === "phone") {
    const text = `Your Nexlo code is ${code}. It expires in 10 minutes.`;
    const sms = await sendSms(dest, text);
    if (sms.skipped) {
      console.warn("[mail] SMS skipped for", maskDestination(dest, "phone"));
      return {
        sent: false,
        skipped: true,
        masked: maskDestination(dest, "phone"),
        userMessage: "We could not send an SMS right now. Tap Resend, or register with email.",
      };
    }
    if (sms.status && Number(sms.status) >= 400) {
      return {
        sent: false,
        skipped: false,
        masked: maskDestination(dest, "phone"),
        userMessage: "SMS delivery failed. Tap Resend.",
      };
    }
    return { sent: true, skipped: false, masked: maskDestination(dest, "phone") };
  }
  return sendCodeEmail({ to: dest, code, purpose });
}
