export type SavedView = {
  id: string;
  name: string;
  query?: string;
  status?: string;
  createdAt: string;
};

const PREFIX = "nexlo-admin-views";

function key(desk: string, role: string) {
  return `${PREFIX}:${desk}:${role || "staff"}`;
}

export function loadSavedViews(desk: string, role: string): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key(desk, role));
    const parsed = raw ? (JSON.parse(raw) as SavedView[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSavedViews(desk: string, role: string, views: SavedView[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(desk, role), JSON.stringify(views.slice(0, 12)));
}

export function addSavedView(desk: string, role: string, view: Omit<SavedView, "id" | "createdAt">) {
  const next: SavedView = {
    ...view,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  const views = loadSavedViews(desk, role);
  const merged = [next, ...views.filter((v) => v.name !== next.name)];
  saveSavedViews(desk, role, merged);
  return merged;
}

export function removeSavedView(desk: string, role: string, id: string) {
  const views = loadSavedViews(desk, role).filter((v) => v.id !== id);
  saveSavedViews(desk, role, views);
  return views;
}
