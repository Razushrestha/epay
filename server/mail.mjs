import FormData from "form-data";
import Mailgun from "mailgun.js";

let cachedClient;

function mailgunClient() {
  const key = process.env.MAILGUN_API_KEY;
  if (!key) return null;
  if (!cachedClient) {
    const mailgun = new Mailgun(FormData);
    cachedClient = mailgun.client({
      username: "api",
      key,
      url: process.env.MAILGUN_API_URL || "https://api.mailgun.net",
    });
  }
  return cachedClient;
}

const SUBJECTS = {
  verify: "Your Nexlo verification code",
  login_2fa: "Your Nexlo sign-in code",
  reset: "Your Nexlo password reset code",
  enroll_2fa: "Your Nexlo security code",
};

export async function sendCodeEmail({ to, code, purpose = "verify" }) {
  const client = mailgunClient();
  const domain = process.env.MAILGUN_DOMAIN;
  if (!client || !domain || !to) {
    console.warn("[mail] Mailgun is not configured; skipping email to", to);
    return { skipped: true };
  }

  const from =
    process.env.MAILGUN_FROM ||
    `Mailgun Sandbox <postmaster@${domain}>`;
  const subject = SUBJECTS[purpose] ?? "Your Nexlo code";
  const text = `Your Nexlo code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`;

  try {
    const data = await client.messages.create(domain, {
      from,
      to: [to],
      subject,
      text,
    });
    console.log("[mail] sent", purpose, "to", to, data?.id ?? "");
    return { skipped: false, id: data?.id };
  } catch (err) {
    console.error("[mail] failed to send to", to, err?.message || err);
    throw err;
  }
}

export async function deliverCode(channel, destination, code, purpose) {
  if (channel !== "email" || !destination) return;
  try {
    await sendCodeEmail({ to: destination, code, purpose });
  } catch (err) {
    // Account creation should still succeed; the user can tap Resend.
    console.error("[mail] deliverCode failed:", err?.message || err);
  }
}
