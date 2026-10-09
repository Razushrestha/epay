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

function setCors(req, res) {
  const configured = process.env.CORS_ORIGIN;
  const origin = req.headers.origin;
  if (configured) {
    res.setHeader("Access-Control-Allow-Origin", configured);
  } else if (
    origin &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-session-id");
}

function json(req, res, status, body) {
  setCors(req, res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
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

  // Catalog API (categories, brands, conditions, item specifics)
  if (pathname.startsWith(`${API_PREFIX}/catalog`)) {
    const ipAddress = req.socket.remoteAddress || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    const body = ['POST', 'PATCH', 'PUT'].includes(method) ? await readJson(req) : null;
    
    const result = await handleCatalog(req, method, pathname, req.headers, body, ipAddress, userAgent);
    return json(req, res, result.status, result.body);
  }

  // Listings API (create, manage, search listings)
  if (pathname.startsWith(`${API_PREFIX}/listings`)) {
    const ipAddress = req.socket.remoteAddress || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    const body = ['POST', 'PATCH', 'PUT'].includes(method) ? await readJson(req) : null;
    
    const result = await handleListings(req, method, pathname, req.headers, body, ipAddress, userAgent);
    return json(req, res, result.status, result.body);
  }

  // Cart & Checkout API (cart management, checkout flow, orders)
  if (pathname.startsWith(`${API_PREFIX}/cart`)) {
    const ipAddress = req.socket.remoteAddress || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    const body = ['POST', 'PATCH', 'PUT'].includes(method) ? await readJson(req) : null;
    
    const result = await handleCart(req, method, pathname, req.headers, body, ipAddress, userAgent);
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
      const body = ["POST", "PATCH", "PUT", "DELETE"].includes(method) ? await readJson(req) : {};
      const result = await handlePhase4(req, method, pathParts, body);
      if (result) return json(req, res, result.status, result.body);
    }
    if (isPhase3Path(pathParts)) {
      const body = ["POST", "PATCH", "PUT", "DELETE"].includes(method) ? await readJson(req) : {};
      const result = await handlePhase3(req, method, pathParts, body);
      if (result) return json(req, res, result.status, result.body);
    }
  }

  // Payments API (eSewa, Khalti integration, callbacks, webhooks)
  if (pathname.startsWith(`${API_PREFIX}/payments`)) {
    const ipAddress = req.socket.remoteAddress || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    const body = ['POST', 'PATCH', 'PUT'].includes(method) ? await readJson(req) : null;
    
    const result = await handlePayments(req, method, pathname, req.headers, body, ipAddress, userAgent);
    
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
