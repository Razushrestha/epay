import { createServer } from "node:http";
import "dotenv/config";
import { initDb } from "./db.mjs";
import { handleRequest } from "./router.mjs";
import { startJobs } from "./jobs.mjs";

import { assertSecureConfig } from "./security/config-check.mjs";

assertSecureConfig();

const PORT = Number(process.env.PORT || process.env.API_PORT) || 4000;

await initDb();

const server = createServer(async (req, res) => {
  try {
    await handleRequest(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      const status = Number(err?.status || err?.statusCode);
      const code = status >= 400 && status < 600 ? status : 500;
      res.writeHead(code, { "Content-Type": "application/json" });
      const exposeMessage = code === 400 || code === 413;
      res.end(JSON.stringify({ error: exposeMessage ? err.message : "Internal server error" }));
    }
  }
});

server.listen(PORT, () => {
  const mode =
    process.env.USE_PGLITE === "1" ? "PGLite (local)" : "PostgreSQL";
  console.log(`MeroAuction API listening on http://localhost:${PORT} [${mode}]`);
  console.log(`  GET  /health`);
  console.log(`  GET  /api/v1/categories`);
  console.log(`  POST /api/v1/auth/register`);
  console.log(`  POST /api/v1/auth/login`);
  if (process.env.WORKER_SEPARATE === "1") {
    console.log("  worker: external (WORKER_SEPARATE=1)");
  } else {
    startJobs();
  }
});
