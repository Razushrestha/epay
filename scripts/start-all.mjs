// Runs the Next.js website and the API together in ONE process group (single Render service).
//   - website listens on $PORT (Render sets it, default 10000)
//   - API listens on API_INTERNAL_PORT (default 4000) and is reached by Next through
//     API_PROXY_TARGET=http://127.0.0.1:4000 (set at BUILD time, because Next bakes rewrites in).
// If either process exits, everything exits so Render restarts the service.
import { spawn } from "node:child_process";

const webPort = String(process.env.PORT || "10000");
const apiPort = String(process.env.API_INTERNAL_PORT || "4000");
const children = [];
let closing = false;

function shutdown(code) {
  if (closing) return;
  closing = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 3000).unref();
}

function run(name, args, env) {
  const child = spawn(process.execPath, args, { stdio: "inherit", env: { ...process.env, ...env } });
  child.on("exit", (code, signal) => {
    console.error(`[start-all] ${name} exited (${signal || code}); shutting down`);
    shutdown(typeof code === "number" ? code : 1);
  });
  children.push(child);
}

process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));

console.log(`[start-all] api on ${apiPort}, web on ${webPort}`);
run("api", ["server/index.mjs"], { PORT: apiPort, API_PORT: apiPort });
run("web", ["node_modules/next/dist/bin/next", "start", "-p", webPort], {});
