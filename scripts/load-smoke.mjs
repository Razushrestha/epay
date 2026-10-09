const base = process.env.API_URL || "http://localhost:4000";
const n = Number(process.env.REQUESTS || 40);
const started = Date.now();
const times = [];
let fail = 0;
for (let i = 0; i < n; i += 1) {
  const t = Date.now();
  try {
    const res = await fetch(`${base}/health`);
    times.push(Date.now() - t);
    if (!res.ok) fail += 1;
  } catch {
    fail += 1;
    times.push(Date.now() - t);
  }
}
times.sort((a, b) => a - b);
const p95 = times[Math.min(times.length - 1, Math.floor(times.length * 0.95))];
console.log(JSON.stringify({
  requests: n,
  failed: fail,
  avgMs: Math.round(times.reduce((s, x) => s + x, 0) / times.length),
  p95Ms: p95,
  totalMs: Date.now() - started,
}, null, 2));
if (fail) process.exit(1);
