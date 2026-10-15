type Dsr = {
  count?: number;
  item?: number | null;
  communication?: number | null;
  shipping_time?: number | null;
  shipping_cost?: number | null;
};

const LABELS: { key: keyof Dsr; label: string }[] = [
  { key: "item", label: "Item as described" },
  { key: "communication", label: "Communication" },
  { key: "shipping_time", label: "Shipping time" },
  { key: "shipping_cost", label: "Shipping charges" },
];

export function DsrBars({ dsr }: { dsr?: Dsr | null }) {
  if (!dsr?.count) {
    return <p className="text-[13px] text-[#8a94a6]">No detailed seller ratings yet.</p>;
  }
  return (
    <div className="space-y-2">
      {LABELS.map((row) => {
        const value = Number(dsr[row.key] || 0);
        const pct = Math.max(0, Math.min(100, (value / 5) * 100));
        return (
          <div key={row.key}>
            <div className="flex items-center justify-between text-[12.5px] text-[#5b6780]">
              <span>{row.label}</span>
              <span className="font-semibold text-[#0f1c3f]">{value.toFixed(1)} / 5</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#e8eef5]">
              <div className="h-full rounded-full bg-[#16a34a]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
      <p className="text-[11px] text-[#8a94a6]">Based on {dsr.count} detailed ratings</p>
    </div>
  );
}
