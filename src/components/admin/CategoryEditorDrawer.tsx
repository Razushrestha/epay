"use client";

import { useEffect, useState } from "react";

export type DrawerCategory = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  level: number;
  icon: string | null;
  description: string | null;
  is_restricted: boolean;
  requires_approval: boolean;
  is_active: boolean;
};

export type CategoryDraft = {
  name: string;
  slug: string;
  parent_id: number | null;
  level: number;
  icon: string;
  description: string;
  is_restricted: boolean;
  requires_approval: boolean;
  is_active: boolean;
};

const EMOJI = ["🪙", "💵", "✉️", "🏅", "🏺", "🃏", "🖼️", "🎬", "✍️", "💎", "👑", "📦", "⌚", "👜", "👟", "🏠", "🚗", "🏍️", "📚", "🎨", "🧸", "🔔", "🏆", "🗝️"];

export function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-[#e7eef6] bg-white px-4 py-3 text-left transition hover:border-[#c7d3e6]"
    >
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold text-[#0f1c3f]">{label}</span>
        <span className="mt-0.5 block text-[12px] leading-snug text-[#6b7587]">{hint}</span>
      </span>
      <span
        aria-hidden
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-[#3665f3]" : "bg-[#cfd8e6]"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

const labelClass = "mb-1.5 block text-[12px] font-bold uppercase tracking-[0.06em] text-[#6b7587]";
const inputClass =
  "w-full rounded-xl border border-[#dbe3ef] bg-[#fbfcfe] px-3.5 py-2.5 text-[14px] text-[#0f1c3f] outline-none transition placeholder:text-[#a3adbf] focus:border-[#3665f3] focus:bg-white focus:ring-4 focus:ring-[#3665f3]/10";

/** Slide-over used for both "New category" and "Edit category". */
export function CategoryEditorDrawer({
  mode,
  initial,
  categories,
  onSubmit,
  onClose,
}: {
  mode: "create" | "edit";
  initial?: DrawerCategory;
  /** Categories a new one may be placed under (already ordered like the tree, level < 3). */
  categories: DrawerCategory[];
  onSubmit: (values: CategoryDraft) => Promise<string | null>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<CategoryDraft>(() => ({
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    parent_id: initial?.parent_id ?? null,
    level: initial?.level ?? 1,
    icon: initial?.icon ?? "",
    description: initial?.description ?? "",
    is_restricted: initial?.is_restricted ?? false,
    requires_approval: initial?.requires_approval ?? false,
    is_active: initial?.is_active ?? true,
  }));
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [editSlug, setEditSlug] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const parent = categories.find((c) => c.id === draft.parent_id) ?? null;
  const editParent = initial?.parent_id != null ? categories.find((c) => c.id === initial.parent_id) : null;

  function set<K extends keyof CategoryDraft>(key: K, value: CategoryDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) return setError("Give the category a name.");
    if (!draft.slug.trim()) return setError("The URL name is empty. Type a name or edit the URL name.");
    setSaving(true);
    setError(null);
    const message = await onSubmit({ ...draft, name: draft.name.trim(), slug: draft.slug.trim() });
    if (message) {
      setError(message);
      setSaving(false);
    }
  }

  const shownIcon = draft.icon.trim() || "🗂️";
  const where = mode === "edit"
    ? editParent
      ? `Under ${editParent.name}`
      : initial?.parent_id != null
        ? "Subcategory"
        : "Top-level menu item"
    : parent
      ? `Under ${parent.name}`
      : "Top-level menu item";

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true" aria-label={mode === "create" ? "New category" : "Edit category"}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-[#0f1c3f]/40 backdrop-blur-[2px]" />

      <form onSubmit={submit} className="relative flex h-full w-full max-w-[480px] flex-col bg-white shadow-[-24px_0_60px_-30px_rgba(15,28,63,0.5)]">
        <header className="flex items-start justify-between gap-3 border-b border-[#eef2f7] px-6 py-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#3665f3]">
              {mode === "create" ? "Catalog" : "Editing"}
            </p>
            <h2 className="mt-0.5 text-[20px] font-extrabold tracking-tight text-[#0f1c3f]">
              {mode === "create" ? "New category" : initial?.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[20px] leading-none text-[#6b7587] hover:bg-[#f1f5fb]"
          >
            ×
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* live preview */}
          <div className="rounded-2xl bg-gradient-to-br from-[#eef3ff] to-[#f7f1ff] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7587]">Preview</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[26px] shadow-sm">{shownIcon}</span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-[#0f1c3f]">{draft.name.trim() || "Category name"}</p>
                <p className="truncate text-[12px] text-[#6b7587]">
                  {where} · /{draft.slug || "url-name"}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold">
              {draft.is_active ? (
                <span className="rounded-full bg-[#e3f6ec] px-2.5 py-1 text-[#127a45]">Visible</span>
              ) : (
                <span className="rounded-full bg-[#eef0f4] px-2.5 py-1 text-[#6b7587]">Hidden</span>
              )}
              {draft.requires_approval ? <span className="rounded-full bg-[#fff1d6] px-2.5 py-1 text-[#9a5b00]">Needs approval</span> : null}
              {draft.is_restricted ? <span className="rounded-full bg-[#ffe3e3] px-2.5 py-1 text-[#b42318]">Restricted</span> : null}
            </div>
          </div>

          {error ? <p className="nexlo-alert nexlo-alert-error">{error}</p> : null}

          {/* basics */}
          <section className="space-y-4">
            <div>
              <label htmlFor="cat-name" className={labelClass}>
                Name
              </label>
              <input
                id="cat-name"
                autoFocus
                type="text"
                value={draft.name}
                placeholder="e.g. Rare Books"
                onChange={(e) => {
                  const name = e.target.value;
                  setDraft((current) => ({ ...current, name, slug: slugTouched ? current.slug : slugify(name) }));
                }}
                className={inputClass}
              />
              <div className="mt-2 flex items-center gap-2 text-[12px] text-[#6b7587]">
                <span>URL name:</span>
                {editSlug ? (
                  <input
                    type="text"
                    value={draft.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      set("slug", slugify(e.target.value));
                    }}
                    className="w-full max-w-[220px] rounded-lg border border-[#dbe3ef] bg-white px-2.5 py-1 font-mono text-[12px] text-[#0f1c3f] outline-none focus:border-[#3665f3]"
                    aria-label="URL name"
                  />
                ) : (
                  <code className="rounded-md bg-[#f1f5fb] px-2 py-0.5 text-[#0f1c3f]">/{draft.slug || "…"}</code>
                )}
                <button type="button" onClick={() => setEditSlug((v) => !v)} className="font-semibold text-[#3665f3] hover:underline">
                  {editSlug ? "Done" : "Change"}
                </button>
              </div>
            </div>

            {mode === "create" ? (
              <div>
                <span className={labelClass}>Where does it go?</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "root", title: "Top level", sub: "Shows in the main menu" },
                    { id: "child", title: "Subcategory", sub: "Inside another category" },
                  ].map((option) => {
                    const active = (option.id === "root") === (draft.parent_id == null);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          if (option.id === "root") setDraft((c) => ({ ...c, parent_id: null, level: 1 }));
                          else if (draft.parent_id == null && categories[0]) {
                            setDraft((c) => ({ ...c, parent_id: categories[0].id, level: categories[0].level + 1 }));
                          }
                        }}
                        className={`rounded-2xl border px-3.5 py-3 text-left transition ${
                          active ? "border-[#3665f3] bg-[#f2f6ff] ring-4 ring-[#3665f3]/10" : "border-[#e7eef6] bg-white hover:border-[#c7d3e6]"
                        }`}
                      >
                        <span className="block text-[13.5px] font-semibold text-[#0f1c3f]">{option.title}</span>
                        <span className="block text-[11.5px] text-[#6b7587]">{option.sub}</span>
                      </button>
                    );
                  })}
                </div>
                {draft.parent_id != null ? (
                  <select
                    value={draft.parent_id}
                    onChange={(e) => {
                      const next = categories.find((c) => c.id === Number(e.target.value));
                      if (next) setDraft((c) => ({ ...c, parent_id: next.id, level: next.level + 1 }));
                    }}
                    className={`${inputClass} mt-2`}
                    aria-label="Parent category"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {`${"— ".repeat(Math.max(c.level - 1, 0))}${c.name}`}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            ) : null}
          </section>

          {/* icon */}
          <section>
            <span className={labelClass}>Icon</span>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => set("icon", draft.icon === emoji ? "" : emoji)}
                  aria-label={`Use ${emoji}`}
                  aria-pressed={draft.icon === emoji}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border text-[20px] transition ${
                    draft.icon === emoji ? "border-[#3665f3] bg-[#f2f6ff] ring-4 ring-[#3665f3]/10" : "border-[#e7eef6] bg-white hover:bg-[#f7f9fc]"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={draft.icon}
              onChange={(e) => set("icon", e.target.value)}
              placeholder="Or paste any emoji"
              className={`${inputClass} mt-2`}
              maxLength={8}
              aria-label="Custom emoji"
            />
          </section>

          <section>
            <label htmlFor="cat-desc" className={labelClass}>
              Description <span className="font-normal normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              id="cat-desc"
              rows={3}
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="A short line shown to sellers when they pick this category."
              className={`${inputClass} resize-none`}
            />
          </section>

          {/* rules */}
          <section className="space-y-2">
            <span className={labelClass}>Rules</span>
            {mode === "edit" ? (
              <Switch
                checked={draft.is_active}
                onChange={(v) => set("is_active", v)}
                label="Visible"
                hint="Buyers see it in menus and search; sellers can list in it."
              />
            ) : null}
            <Switch
              checked={draft.requires_approval}
              onChange={(v) => set("requires_approval", v)}
              label="Listings need approval"
              hint="New listings wait for a moderator before going live."
            />
            <Switch
              checked={draft.is_restricted}
              onChange={(v) => set("is_restricted", v)}
              label="Restricted category"
              hint="Extra rules apply, for example verified sellers only."
            />
          </section>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-[#eef2f7] bg-white px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-[13.5px] font-semibold text-[#5b6780] hover:bg-[#f1f5fb]">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-[#3665f3] px-6 py-2.5 text-[13.5px] font-semibold text-white shadow-sm transition hover:bg-[#2953c6] disabled:opacity-60"
          >
            {saving ? "Saving…" : mode === "create" ? "Create category" : "Save changes"}
          </button>
        </footer>
      </form>
    </div>
  );
}
