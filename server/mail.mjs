import { sendSms } from "./sms.mjs";

const SUBJECTS = {
  verify: "Your MeroAuction verification code",
  login_2fa: "Your MeroAuction sign-in code",
  reset: "Your MeroAuction password reset code",
  enroll_2fa: "Your MeroAuction security code",
  change_phone: "Confirm your MeroAuction phone-number change",
};

const SEND_TIMEOUT_MS = 10000;
const RESEND_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "MeroAuction <support@meroauction.com>";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

export function resendConfigured() {
  return Boolean(String(process.env.RESEND_API_KEY || "").trim());
}

function fromAddress() {
  const from = String(process.env.EMAIL_FROM || "").trim();
  if (from) return from;
  console.warn("[mail] EMAIL_FROM is not set; defaulting to", DEFAULT_FROM);
  return DEFAULT_FROM;
}

export function classifyResendError(err) {
  const message = String(err?.message || err || "");
  const status = Number(err?.status || 0);
  const lower = message.toLowerCase();
  if (err?.name === "AbortError" || lower.includes("abort") || lower.includes("timeout")) {
    return { retryable: true, userMessage: "The email provider timed out. Tap Resend." };
  }
  if (status === 401) {
    return { retryable: false, userMessage: "Email delivery is not set up correctly. Please contact support." };
  }
  if (status === 403 || lower.includes("domain is not verified") || lower.includes("testing emails")) {
    return {
      retryable: false,
      userMessage: "We could not deliver to this email right now. Please try again later or contact support.",
    };
  }
  if (status === 400 || status === 422) {
    return { retryable: false, userMessage: "That email address could not be used. Check it, then tap Resend." };
  }
  if (status === 429 || status >= 500) {
    return { retryable: true, userMessage: "The email provider is busy. Tap Resend." };
  }
  return { retryable: !status || status >= 500, userMessage: "We could not send the code. Tap Resend." };
}

async function postResend({ from, to, subject, text, html, tag }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${String(process.env.RESEND_API_KEY).trim()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        ...(html ? { html } : {}),
        ...(tag ? { tags: [{ name: "purpose", value: tag }] } : {}),
      }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || `Resend ${res.status}`);
      err.status = res.status;
      err.payload = data;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function codeEmailHtml(code, purpose, resetUrl) {
  const label = SUBJECTS[purpose] ?? "Your MeroAuction code";
  const link = resetUrl
    ? `<p style="margin:0 0 16px"><a href="${resetUrl}" style="display:inline-block;background:#3665f3;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700">Reset your password</a></p>
  <p style="font-size:12px;color:#6b7587;margin:0 0 16px">Or paste this link: ${resetUrl}</p>`
    : "";
  return `<div style="font-family:Arial,sans-serif;max-width:480px;color:#0f1c3f">
  <p style="font-size:16px;font-weight:700;margin:0 0 12px">${label}</p>
  <p style="font-size:13px;color:#6b7587;margin:0 0 16px">${resetUrl ? "Open the button below to choose a new password. The link expires in 30 minutes." : "Use this code within 10 minutes. If you requested another code, use the latest one."}</p>
  ${link}
  <p style="font-size:28px;letter-spacing:8px;font-weight:800;margin:0 0 16px">${code}</p>
  <p style="font-size:12px;color:#8a94a6">If you did not request this, you can ignore the email.</p>
</div>`;
}

export async function sendCodeEmail({ to, code, purpose = "verify", resetUrl }) {
  const destination = String(to || "").trim().toLowerCase();
  const masked = maskDestination(destination, "email");
  if (!resendConfigured() || !destination) {
    console.warn(
      "[mail] Resend is not configured; skipping email to",
      destination || to,
      resendConfigured() ? "" : "(missing RESEND_API_KEY)",
    );
    return {
      sent: false,
      skipped: true,
      masked,
      userMessage: "Email delivery is not configured. Tap Resend, or use the on-screen code if one is shown.",
    };
  }

  const fields = {
    from: fromAddress(),
    to: destination,
    subject: SUBJECTS[purpose] ?? "Your MeroAuction code",
    text: resetUrl
      ? `Reset your MeroAuction password: ${resetUrl}\nThis link expires in 30 minutes. You can also use code ${code}.`
      : `Your MeroAuction code is ${code}. It expires in 10 minutes. If you requested another code, use the latest one.`,
    html: codeEmailHtml(code, purpose, resetUrl),
    tag: String(purpose).replace(/[^A-Za-z0-9_-]/g, "_"),
  };

  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const data = await postResend(fields);
      console.log("[mail] sent", purpose, "to", destination, "via resend", data?.id ?? "");
      return { sent: true, skipped: false, id: data?.id, masked };
    } catch (err) {
      lastError = err;
      const classified = classifyResendError(err);
      console.error("[mail] resend failed", purpose, destination, err?.status, err?.message || err);
      if (!classified.retryable) return { sent: false, skipped: false, masked, ...classified };
      if (attempt === 0) await wait(600);
    }
  }
  return { sent: false, skipped: false, masked, ...classifyResendError(lastError) };
}

export async function sendTransactional({ to, subject, text }) {
  const destination = String(to || "").trim();
  if (!resendConfigured() || !destination) {
    console.warn("[mail] skip transactional to", destination || to, subject);
    return { skipped: true, sent: false };
  }
  try {
    const data = await postResend({ from: fromAddress(), to: destination, subject, text, tag: "transactional" });
    return { skipped: false, sent: true, id: data?.id };
  } catch (err) {
    console.error("[mail] transactional failed", err?.message || err);
    return { skipped: true, sent: false, error: err?.message };
  }
}

export async function deliverCode(channel, destination, code, purpose, extras = {}) {
  const dest = String(destination || "").trim();
  if (!dest) {
    return { sent: false, skipped: true, userMessage: "No email or phone to send a code to." };
  }
  if (channel === "phone") {
    const text = `Your MeroAuction code is ${code}. It expires in 10 minutes.`;
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
  return sendCodeEmail({ to: dest, code, purpose, resetUrl: extras.resetUrl });
}
