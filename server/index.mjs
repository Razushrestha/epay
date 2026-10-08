import { createServer } from "node:http";
import "dotenv/config";
import { initDb } from "./db.mjs";
import { handleRequest } from "./router.mjs";

const PORT = Number(process.env.PORT || process.env.API_PORT) || 4000;

await initDb();

const server = createServer(async (req, res) => {
  try {
    await handleRequest(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }
});

server.listen(PORT, () => {
  const mode =
    process.env.USE_PGLITE === "1" ? "PGLite (local)" : "PostgreSQL";
  console.log(`Nexlo API listening on http://localhost:${PORT} [${mode}]`);
  console.log(`  GET  /health`);
  console.log(`  GET  /api/v1/categories`);
  console.log(`  POST /api/v1/auth/register`);
  console.log(`  POST /api/v1/auth/login`);
});
