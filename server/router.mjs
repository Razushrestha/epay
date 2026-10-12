import { pool, checkDb, initDb } from "./db.mjs";
import { handleIdentity } from "./identity.mjs";
import { handleCatalog } from "./catalog.mjs";
import { handleListings } from "./listings.mjs";
import { handleCart } from "./cart.mjs";
import { handlePayments } from "./payments.mjs";
import { handlePhase3, isPhase3Path } from "./phase3.mjs";
import { handlePhase4, isPhase4Path } from "./phase4.mjs";
import { attachAuctionStream } from "./auctions.mjs";

async function db() {
  if (!pool) await initDb();
  return pool;
}

const API_PREFIX = "/api/v1";

function isLocalDevOrigin(origin) {
  try {
    const { hostname } = new URL(origin);
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    if (/^10(?:\.\d{1,3}){3}$/.test(hostname)) return true;
    if (/^192\.168(?:\.\d{1,3}){2}$/.test(hostname)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/.test(hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

function corsAllowed(origin) {
  if (!origin) return false;
  const configured = String(process.env.CORS_ORIGIN || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (configured.includes("*") || configured.includes(origin)) return true;
  if (process.env.NODE_ENV !== "production" && isLocalDevOrigin(origin)) return true;
  if (!configured.length && isLocalDevOrigin(origin)) return true;
  return false;
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (corsAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-session-id");
}

function json(req, res, status, body) {
  setCors(req, res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function isMultipart(req) {
  return String(req.headers["content-type"] || "").toLowerCase().includes("multipart/form-data");
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const err = new Error("Invalid JSON body");
    err.status = 400;
    throw err;
  }
}

function readJsonIfNeeded(req, method) {
  if (!["POST", "PATCH", "PUT"].includes(method)) return null;
  if (isMultipart(req)) return null;
  return readJson(req);
}

function parseUrl(req) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  return { pathname: url.pathname, searchParams: url.searchParams };
}

export async function handleRequest(req, res) {
  const { pathname, searchParams } = parseUrl(req);
  const method = req.method ?? "GET";

  if (method === "OPTIONS") {
    setCors(req, res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === "/health" && method === "GET") {
    let db = false;
    try {
      db = await checkDb();
    } catch {
      db = false;
    }
    return json(req, res, 200, {
      status: "ok",
      service: "nexlo",
      runtime: "node",
      database: db ? "connected" : "unavailable",
    });
  }

  if (method === "GET" && (pathname === `${API_PREFIX}/categories` || pathname.startsWith(`${API_PREFIX}/categories/`))) {
    const suffix = pathname.slice(`${API_PREFIX}/categories`.length);
    const queryString = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    const result = await handleCatalog(
      req,
      method,
      `${API_PREFIX}/catalog/categories${suffix}${queryString}`,
      req.headers,
      null,
      req.socket.remoteAddress || req.headers["x-forwarded-for"],
      req.headers["user-agent"],
    );
    return json(req, res, result.status, result.body);
  }

  // Catalog API (categories, brands, conditions, item specifics)
  if (pathname.startsWith(`${API_PREFIX}/catalog`)) {
    const ipAddress = req.socket.remoteAddress || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    const body = await readJsonIfNeeded(req, method);
    
    const result = await handleCatalog(req, method, req.url || pathname, req.headers, body, ipAddress, userAgent);
    return json(req, res, result.status, result.body);
  }

  // Listings API (create, manage, search listings)
  if (pathname.startsWith(`${API_PREFIX}/listings`)) {
    const ipAddress = req.socket.remoteAddress || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    const body = await readJsonIfNeeded(req, method);
    
    const result = await handleListings(req, method, req.url || pathname, req.headers, body, ipAddress, userAgent);
    return json(req, res, result.status, result.body);
  }

  // Cart & Checkout API (cart management, checkout flow, orders)
  if (pathname.startsWith(`${API_PREFIX}/cart`)) {
    const ipAddress = req.socket.remoteAddress || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    const body = await readJsonIfNeeded(req, method);
    
    const result = await handleCart(req, method, req.url || pathname, req.headers, body, ipAddress, userAgent);
    return json(req, res, result.status, result.body);
  }

  const streamMatch = pathname.match(/^\/api\/v1\/auctions\/([^/]+)\/stream$/);
  if (method === "GET" && streamMatch) {
    setCors(req, res);
    attachAuctionStream(req, res, streamMatch[1]);
    return;
  }

  if (pathname.startsWith(`${API_PREFIX}/`)) {
    const pathParts = pathname.replace(`${API_PREFIX}/`, "").split("/").filter(Boolean);
    if (isPhase4Path(pathParts)) {
      const body = ["POST", "PATCH", "PUT", "DELETE"].includes(method) && !isMultipart(req) ? await readJson(req) : {};
      const result = await handlePhase4(req, method, pathParts, body);
      if (result) return json(req, res, result.status, result.body);
    }
    if (isPhase3Path(pathParts)) {
      const body = ["POST", "PATCH", "PUT", "DELETE"].includes(method) && !isMultipart(req) ? await readJson(req) : {};
      const result = await handlePhase3(req, method, pathParts, body);
      if (result) return json(req, res, result.status, result.body);
    }
  }

  // Payments API (eSewa, Khalti integration, callbacks, webhooks)
  if (pathname.startsWith(`${API_PREFIX}/payments`)) {
    const ipAddress = req.socket.remoteAddress || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    const body = await readJsonIfNeeded(req, method);
    
    const result = await handlePayments(req, method, req.url || pathname, req.headers, body, ipAddress, userAgent);
    
    // Handle redirects
    if (result.status === 302 && result.headers?.Location) {
      res.writeHead(302, result.headers);
      res.end();
      return;
    }
    
    return json(req, res, result.status, result.body);
  }

  // Static file serving for uploads - NO LONGER NEEDED
  // Images are now served directly from Neon Object Storage (S3)
  // URLs in database point directly to S3 endpoints with public_read access
  /* 
  if (pathname.startsWith('/uploads/') && method === 'GET') {
    // This code is kept for reference but is no longer active
    // Images are served from: ${AWS_ENDPOINT_URL_S3}/uploads/listings/...
  }
  */

  await handleIdentity(req, res, { json, readJson, pathname, method, searchParams });
  if (res.headersSent) return;

  return json(req, res, 404, { error: "Not found" });
}
