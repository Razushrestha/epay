export type VariationAxis = {
  name: string;
  values: string[];
};

export type SkuDraft = {
  key: string;
  combination: Record<string, string>;
  price: string;
  quantity: string;
  sku: string;
};

export function parseOptionList(raw: string, limit = 12): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of String(raw || "").split(/[,|\n]/)) {
    const value = part.trim().slice(0, 50);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

export function comboKey(combination: Record<string, string>) {
  return Object.keys(combination)
    .sort()
    .map((name) => `${name}=${combination[name]}`)
    .join("|");
}

export function cartesianAxes(axes: VariationAxis[]): Record<string, string>[] {
  const named = axes.filter((axis) => axis.name && axis.values.length);
  if (!named.length) return [];
  let combos: Record<string, string>[] = [{}];
  for (const axis of named) {
    const next: Record<string, string>[] = [];
    for (const combo of combos) {
      for (const value of axis.values) {
        next.push({ ...combo, [axis.name]: value });
      }
    }
    combos = next;
  }
  return combos.slice(0, 80);
}

export function mergeSkuDrafts(
  prev: SkuDraft[],
  axes: VariationAxis[],
  defaults: { price?: string; quantity?: string } = {},
): SkuDraft[] {
  const byKey = new Map(prev.map((row) => [row.key, row]));
  return cartesianAxes(axes).map((combination) => {
    const key = comboKey(combination);
    const existing = byKey.get(key);
    if (existing) {
      return {
        ...existing,
        key,
        combination,
        price: existing.price || defaults.price || "",
        quantity: existing.quantity || defaults.quantity || "1",
      };
    }
    return {
      key,
      combination,
      price: defaults.price || "",
      quantity: defaults.quantity || "1",
      sku: "",
    };
  });
}

export function skuPayload(rows: SkuDraft[]) {
  return rows.map((row) => ({
    combination: row.combination,
    sku: row.sku.trim() || null,
    price: row.price === "" ? null : Number(row.price),
    quantity: Math.max(0, parseInt(row.quantity, 10) || 0),
  }));
}

export function skuStockTotal(rows: SkuDraft[]) {
  return rows.reduce((sum, row) => sum + Math.max(0, parseInt(row.quantity, 10) || 0), 0);
}

export function skuMinPrice(rows: SkuDraft[]): number | null {
  const prices = rows.map((row) => Number(row.price)).filter((value) => Number.isFinite(value) && value > 0);
  return prices.length ? Math.min(...prices) : null;
}
