import net from "node:net";

let pub = null;
let sub = null;
const localHandlers = new Map();

function urlParts() {
  const raw = process.env.REDIS_URL;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return { host: u.hostname, port: Number(u.port || 6379), password: u.password || undefined };
  } catch {
    return { host: "127.0.0.1", port: Number(process.env.REDIS_PORT || 6379) };
  }
}

function encode(args) {
  return `*${args.length}\r\n${args.map((a) => {
    const s = String(a);
    return `$${Buffer.byteLength(s)}\r\n${s}\r\n`;
  }).join("")}`;
}

function connect(kind) {
  const parts = urlParts();
  if (!parts) return Promise.resolve(null);
  return new Promise((resolve) => {
    const sock = net.connect(parts.port, parts.host);
    let buf = "";
    const pending = [];
    sock.setEncoding("utf8");
    sock.on("error", (err) => {
      console.warn(`[redis] ${kind} error`, err.message);
      resolve(null);
    });
    sock.on("connect", async () => {
      const conn = {
        sock,
        cmd(...args) {
          return new Promise((res, rej) => {
            pending.push({ res, rej });
            sock.write(encode(args));
          });
        },
      };
      if (parts.password) await conn.cmd("AUTH", parts.password).catch(() => null);
      resolve(conn);
    });
    sock.on("data", (chunk) => {
      buf += chunk;
      while (buf.includes("\r\n")) {
        const nl = buf.indexOf("\r\n");
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 2);
        if (kind === "sub" && line.startsWith("*")) continue;
        if (line.startsWith("$")) {
          const size = Number(line.slice(1));
          if (size < 0) {
            pending.shift()?.res(null);
            continue;
          }
          const payload = buf.slice(0, size);
          buf = buf.slice(size + 2);
          if (kind === "sub") {
            // message body handled loosely via line tokens
            continue;
          }
          pending.shift()?.res(payload);
          continue;
        }
        if (line.startsWith(":")) {
          pending.shift()?.res(Number(line.slice(1)));
          continue;
        }
        if (line.startsWith("+")) {
          pending.shift()?.res(line.slice(1));
          continue;
        }
        if (line.startsWith("-")) {
          pending.shift()?.rej(new Error(line.slice(1)));
          continue;
        }
        if (kind === "sub" && !line.startsWith("*") && !line.startsWith("$")) {
          for (const [channel, fns] of localHandlers) {
            if (buf.includes(channel) || line === channel) {
              for (const fn of fns) fn(line);
            }
          }
        }
      }
    });
  });
}

async function getPub() {
  if (pub) return pub;
  pub = await connect("pub");
  return pub;
}

export async function redisPublish(channel, payload) {
  const c = await getPub();
  if (!c) return false;
  try {
    await c.cmd("PUBLISH", channel, typeof payload === "string" ? payload : JSON.stringify(payload));
    return true;
  } catch (err) {
    console.warn("[redis] publish failed", err.message);
    return false;
  }
}

export async function redisSet(key, value, ttlSeconds) {
  const c = await getPub();
  if (!c) return false;
  try {
    if (ttlSeconds) await c.cmd("SET", key, value, "EX", String(ttlSeconds));
    else await c.cmd("SET", key, value);
    return true;
  } catch {
    return false;
  }
}

export async function redisGet(key) {
  const c = await getPub();
  if (!c) return null;
  try {
    return await c.cmd("GET", key);
  } catch {
    return null;
  }
}

export function onRedisMessage(channel, handler) {
  if (!localHandlers.has(channel)) localHandlers.set(channel, new Set());
  localHandlers.get(channel).add(handler);
  if (sub || !urlParts()) return;
  connect("sub").then((c) => {
    if (!c) return;
    sub = c;
    c.cmd("SUBSCRIBE", channel).catch(() => {});
  });
}

export function redisEnabled() {
  return Boolean(process.env.REDIS_URL);
}
