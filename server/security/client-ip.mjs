/**
 * Resolve the real client IP without trusting spoofable headers.
 *
 * X-Forwarded-For is client-controlled: a client can send "X-Forwarded-For: 1.2.3.4" and
 * proxies only APPEND their view of the peer address. So we count `TRUST_PROXY` hops from the
 * RIGHT of the list (the part added by infrastructure we control) and ignore everything to the left.
 *
 * TRUST_PROXY = number of reverse proxies in front of this server
 *   - unset: 1 in production (e.g. Render), 0 otherwise
 *   - 0: ignore forwarding headers, use the socket address
 */
export function trustedProxyHops() {
  const raw = process.env.TRUST_PROXY;
  if (raw === undefined || raw === "") return process.env.NODE_ENV === "production" ? 1 : 0;
  const hops = Number(raw);
  return Number.isInteger(hops) && hops >= 0 ? hops : 0;
}

export function clientIp(req) {
  const socketIp = req.socket?.remoteAddress || "unknown";
  const hops = trustedProxyHops();
  if (hops === 0) return socketIp;
  const forwarded = String(req.headers?.["x-forwarded-for"] || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (forwarded.length === 0) return socketIp;
  // Rightmost entry = peer seen by our closest proxy; step left one per additional trusted hop.
  const index = Math.max(0, forwarded.length - hops);
  return forwarded[index] || socketIp;
}
