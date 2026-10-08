export function money(value: number | string | null | undefined) {
  return `NPR ${Math.round(Number(value || 0)).toLocaleString("en-US")}`;
}

export function when(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function clock(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Today, ${time}`;
  if (d.toDateString() === yest.toDateString()) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${time}`;
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function longDate(d = new Date()) {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

export function StatusPill({ status }: { status: string }) {
  const key = status.replace(/_/g, " ");
  const tone =
    /complete|deliver|active|approved|positive/.test(status)
      ? "text-[#16a34a]"
      : /process|paid|ship/.test(status)
        ? "text-[#2563eb]"
        : /pend|draft|neutral/.test(status)
          ? "text-[#d97706]"
          : /cancel|refund|suspend|reject|negative|removed/.test(status)
            ? "text-[#dc2626]"
            : "text-[#5b6780]";
  return <span className={`text-[13px] font-semibold capitalize ${tone}`}>{key}</span>;
}

type Pt = { x: number; y: number };

function curve(points: Pt[]) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cx = (p0.x + p1.x) / 2;
    d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

function toPoints(values: number[], w: number, h: number, padX = 2, padY = 6): Pt[] {
  const max = Math.max(...values, 1);
  return values.map((v, i) => ({
    x: padX + (values.length <= 1 ? w / 2 : (i / (values.length - 1)) * (w - padX * 2)),
    y: h - padY - (v / max) * (h - padY * 2),
  }));
}

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const pts = toPoints(values.length ? values : [0, 0], 100, 40);
  const d = curve(pts);
  return (
    <svg viewBox="0 0 100 40" className="h-11 w-[92px]" aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="2.3" strokeLinecap="round" />
    </svg>
  );
}

export function LineChart({
  labels,
  series,
}: {
  labels: string[];
  series: { name: string; color: string; values: number[]; fill?: boolean }[];
}) {
  const w = 640;
  const h = 228;
  const pad = { l: 44, r: 16, t: 18, b: 32 };
  const max = Math.max(...series.flatMap((s) => s.values), 1);
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  function x(i: number) {
    return pad.l + (labels.length <= 1 ? innerW / 2 : (i / Math.max(labels.length - 1, 1)) * innerW);
  }
  function y(v: number) {
    return pad.t + innerH - (v / max) * innerH;
  }
  const grid = [0, 0.25, 0.5, 0.75, 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[228px] w-full">
      {grid.map((g) => (
        <g key={g}>
          <line x1={pad.l} x2={w - pad.r} y1={y(max * g)} y2={y(max * g)} stroke="#eef2f7" />
          <text x={pad.l - 10} y={y(max * g) + 4} textAnchor="end" fontSize="11" fill="#8a94a6">
            {g === 0 ? "0" : max >= 1000 ? `${Math.round((max * g) / 1000)}K` : Math.round(max * g)}
          </text>
        </g>
      ))}
      {series.map((s) => {
        const pts = s.values.map((v, i) => ({ x: x(i), y: y(v) }));
        const d = curve(pts);
        const last = pts[pts.length - 1];
        const area = `${d} L ${last?.x ?? 0} ${pad.t + innerH} L ${pts[0]?.x ?? 0} ${pad.t + innerH} Z`;
        return (
          <g key={s.name}>
            {s.fill ? <path d={area} fill={s.color} opacity="0.08" /> : null}
            <path d={d} fill="none" stroke={s.color} strokeWidth="2.8" strokeLinecap="round" />
            {last ? <circle cx={last.x} cy={last.y} r="5" fill={s.color} stroke="white" strokeWidth="2.5" /> : null}
          </g>
        );
      })}
      {labels.map((label, i) => (
        <text key={label + i} x={x(i)} y={h - 10} textAnchor="middle" fontSize="11" fill="#8a94a6">
          {label}
        </text>
      ))}
    </svg>
  );
}

export function Donut({
  segments,
  total,
}: {
  segments: { label: string; value: number; color: string }[];
  total: number;
}) {
  const raw = segments.reduce((a, s) => a + s.value, 0);
  const sum = raw || 1;
  let acc = 0;
  const stops = raw
    ? segments.map((s) => {
        const start = (acc / sum) * 100;
        acc += s.value;
        const end = (acc / sum) * 100;
        return `${s.color} ${start}% ${end}%`;
      })
    : ["#e8eef6 0 100%"];
  return (
    <div className="flex items-center gap-6">
      <div className="relative h-[150px] w-[150px] shrink-0">
        <div
          className="h-full w-full rounded-full"
          style={{ background: `conic-gradient(${stops.join(", ") || "#e8eef6 0 100%"})` }}
        />
        <div className="absolute inset-[26px] flex flex-col items-center justify-center rounded-full bg-white shadow-[inset_0_0_0_1px_#f3f6fb]">
          <p className="text-[22px] font-extrabold leading-none text-[#0f1c3f]">{total.toLocaleString()}</p>
          <p className="mt-1 text-[11px] text-[#8a94a6]">Total Orders</p>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2.5 text-[13px]">
        {segments.map((s) => (
          <li key={s.label} className="grid grid-cols-[12px_1fr_auto_auto] items-center gap-2 text-[#3a4a66]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span>{s.label}</span>
            <span className="w-8 text-right text-[#8a94a6]">{Math.round((s.value / sum) * 100)}%</span>
            <span className="w-10 text-right font-semibold text-[#0f1c3f]">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Empty({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-[15px] font-semibold text-[#0f1c3f]">{title}</p>
      <p className="mt-1 text-[13px] text-[#8a94a6]">{sub}</p>
    </div>
  );
}

export function lastDays(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (count - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}
