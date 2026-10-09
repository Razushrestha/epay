import "dotenv/config";
import { initDb } from "./db.mjs";
import { startJobs } from "./jobs.mjs";

await initDb();
startJobs();
console.log("[worker] background jobs running (auction close, escrow, alerts, recon)");
