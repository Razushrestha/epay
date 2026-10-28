"use client";

import type { SkuDraft, VariationAxis } from "@/lib/variations";
import { skuStockTotal } from "@/lib/variations";

const field =
  "w-full rounded-xl border border-[#e4eaf2] bg-white px-3 py-2 text-[13.5px] text-[#0f1c3f] outline-none transition placeholder:text-[#9aa3b2] focus:border-[#13948e] focus:ring-2 focus:ring-[#13948e]/15";

export function VariationMatrix({
  axes,
  rows,
  onChange,
  defaultPrice,
}: {
  axes: VariationAxis[];
  rows: SkuDraft[];
  onChange: (rows: SkuDraft[]) => void;
  defaultPrice?: string;
}) {
  if (!rows.length) return null;

  const names = axes.map((axis) => axis.name);
  const total = skuStockTotal(rows);

  function patch(key: string, next: Partial<SkuDraft>) {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...next } : row)));
  }

  function fillPrices() {
    if (!defaultPrice) return;
    onChange(rows.map((row) => ({ ...row, price: row.price || defaultPrice })));
  }

  function fillQty(value: string) {
    onChange(rows.map((row) => ({ ...row, quantity: value })));
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#e4eaf2]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8eef6] bg-[#f7fafc] px-4 py-3">
        <div>
          <p className="text-[13.5px] font-semibold text-[#0f1c3f]">Variation stock</p>
          <p className="mt-0.5 text-[12.5px] text-[#6b7587]">
            Set a price and quantity for each combination. Buyers pick these on the listing.
          </p>
        </div>
        <p className="text-[12.5px] font-semibold text-[#0f3d4c]">Total stock {total}</p>
      </div>
      <div className="flex flex-wrap gap-2 px-4 py-3">
        <button
          type="button"
          onClick={fillPrices}
          disabled={!defaultPrice}
          className="h-8 rounded-full border border-[#d8dee8] bg-white px-3 text-[12px] font-semibold text-[#0f3d4c] hover:bg-[#f7fafc] disabled:opacity-50"
        >
          Fill empty prices
        </button>
        <button
          type="button"
          onClick={() => fillQty("1")}
          className="h-8 rounded-full border border-[#d8dee8] bg-white px-3 text-[12px] font-semibold text-[#0f3d4c] hover:bg-[#f7fafc]"
        >
          Set qty to 1
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-[13px]">
          <thead className="bg-[#f4f8fd] text-[11.5px] font-bold uppercase tracking-wide text-[#6b7587]">
            <tr>
              {names.map((name) => (
                <th key={name} className="px-4 py-2 font-bold">
                  {name}
                </th>
              ))}
              <th className="px-4 py-2 font-bold">Price (NPR)</th>
              <th className="px-4 py-2 font-bold">Qty</th>
              <th className="px-4 py-2 font-bold">SKU</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-[#eef3f8]">
                {names.map((name) => (
                  <td key={name} className="px-4 py-2 font-medium text-[#0f1c3f]">
                    {row.combination[name]}
                  </td>
                ))}
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.price}
                    onChange={(e) => patch(row.key, { price: e.target.value })}
                    className={field}
                    aria-label={`Price for ${row.key}`}
                  />
                </td>
                <td className="w-24 px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    value={row.quantity}
                    onChange={(e) => patch(row.key, { quantity: e.target.value })}
                    className={field}
                    aria-label={`Quantity for ${row.key}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={row.sku}
                    onChange={(e) => patch(row.key, { sku: e.target.value })}
                    placeholder="Optional"
                    className={field}
                    aria-label={`SKU for ${row.key}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
