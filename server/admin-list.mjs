/** Shared admin list pagination envelope. */

export function pageParams(searchParams, defaultSize = 80) {
  const get = (key, fallback) => {
    if (!searchParams) return fallback;
    if (typeof searchParams.get === "function") return searchParams.get(key) ?? fallback;
    return searchParams[key] ?? fallback;
  };
  const page = Math.max(1, Number(get("page", 1)) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(get("pageSize", defaultSize)) || defaultSize));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function listEnvelope(rows, { page = 1, pageSize = rows.length || 80, total = rows.length } = {}) {
  return {
    data: rows,
    total: Number(total) || 0,
    page: Number(page) || 1,
    pageSize: Number(pageSize) || rows.length || 0,
  };
}
