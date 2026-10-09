export async function sendSms(to, text) {
  const phone = String(to || "").trim();
  if (!phone) return { skipped: true };
  const url = process.env.SMS_WEBHOOK_URL;
  const token = process.env.SPARROW_TOKEN || process.env.SMS_TOKEN;
  if (!url && !token) {
    console.log("[sms] skip (no SMS_WEBHOOK_URL / SPARROW_TOKEN)", phone, text);
    return { skipped: true };
  }
  try {
    if (url) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ to: phone, text }),
      });
      return { skipped: false, status: res.status };
    }
    const res = await fetch("https://api.sparrowsms.com/v2/sms/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        from: process.env.SMS_FROM || "NEXLO",
        to: phone,
        text,
      }),
    });
    return { skipped: false, status: res.status };
  } catch (err) {
    console.warn("[sms] failed", err.message);
    return { skipped: true, error: err.message };
  }
}
