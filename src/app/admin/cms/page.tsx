"use client";

import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { Empty, StatusPill } from "@/components/admin/admin-ui";

type Page = { slug: string; title: string; body: string; status: string };
type Banner = { id: number; title: string; link: string | null; position: string; active: boolean };
type Setting = { key: string; value: unknown };

type Tab = "pages" | "banners" | "settings";

export default function AdminCmsPage() {
  const [tab, setTab] = useState<Tab>("pages");
  const [pages, setPages] = useState<Page[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [page, setPage] = useState({ slug: "", title: "", body: "", status: "published" });
  const [banner, setBanner] = useState({ title: "", link: "", position: "home_hero" });
  const [protectionDays, setProtectionDays] = useState("30");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const body = await accountApi<{ pages: Page[]; banners: Banner[]; settings: Setting[] }>("/api/v1/admin/cms");
    setPages(body.pages);
    setBanners(body.banners);
    setSettings(body.settings);
    const protection = body.settings.find((s) => s.key === "buyer_protection_days");
    if (protection != null) setProtectionDays(String(protection.value));
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load CMS"));
  }, []);

  useEffect(() => {
    if (!selectedSlug) return;
    const existing = pages.find((p) => p.slug === selectedSlug);
    if (existing) {
      setPage({ slug: existing.slug, title: existing.title, body: existing.body, status: existing.status || "published" });
    }
  }, [selectedSlug, pages]);

  async function savePage(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await accountApi("/api/v1/admin/cms/pages", { method: "POST", body: JSON.stringify(page) });
      setNotice(`Page “${page.slug}” saved.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save page");
    } finally {
      setBusy(false);
    }
  }

  async function saveBanner(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await accountApi("/api/v1/admin/cms/banners", { method: "POST", body: JSON.stringify(banner) });
      setNotice("Banner added.");
      setBanner({ title: "", link: "", position: "home_hero" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save banner");
    } finally {
      setBusy(false);
    }
  }

  async function saveProtection(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await accountApi("/api/v1/admin/cms/settings", {
        method: "PATCH",
        body: JSON.stringify({ key: "buyer_protection_days", value: Number(protectionDays) || 30 }),
      });
      setNotice(`Buyer protection set to ${protectionDays} days.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save setting");
    } finally {
      setBusy(false);
    }
  }

  async function deletePage(slug: string) {
    if (!confirm(`Delete page /${slug}?`)) return;
    setBusy(true);
    try {
      await accountApi(`/api/v1/admin/cms/pages/${encodeURIComponent(slug)}`, { method: "DELETE" });
      setNotice(`Deleted page ${slug}.`);
      if (selectedSlug === slug) {
        setSelectedSlug(null);
        setPage({ slug: "", title: "", body: "", status: "published" });
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete page");
    } finally {
      setBusy(false);
    }
  }

  async function deleteBanner(id: number) {
    if (!confirm("Delete this banner?")) return;
    setBusy(true);
    try {
      await accountApi(`/api/v1/admin/cms/banners/${id}`, { method: "DELETE" });
      setNotice("Banner deleted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete banner");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Content</h1>
        <p className="text-[14px] text-[#6b7587]">Help pages, banners, and site rules used across Nexlo.</p>
      </div>
      {error ? <p className="nexlo-alert nexlo-alert-error">{error}</p> : null}
      {notice ? <p className="nexlo-alert nexlo-alert-info">{notice}</p> : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["pages", "Pages"],
            ["banners", "Banners"],
            ["settings", "Settings"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold ${
              tab === id ? "bg-[#3665f3] text-white" : "border border-[#e7eef6] bg-white text-[#3a4a66]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "pages" ? (
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <section className="nexlo-card overflow-hidden">
            <button
              type="button"
              className="w-full border-b border-[#eef2f7] px-4 py-3 text-left text-[13px] font-semibold text-[#3665f3]"
              onClick={() => {
                setSelectedSlug(null);
                setPage({ slug: "", title: "", body: "", status: "published" });
              }}
            >
              + New page
            </button>
            <ul className="divide-y divide-[#eef2f7]">
              {pages.map((p) => (
                <li key={p.slug}>
                  <button
                    type="button"
                    className={`w-full px-4 py-3 text-left ${selectedSlug === p.slug ? "bg-[#eef4ff]" : "hover:bg-[#f8fbff]"}`}
                    onClick={() => setSelectedSlug(p.slug)}
                  >
                    <p className="font-semibold text-[#0f1c3f]">{p.title}</p>
                    <p className="text-[12px] text-[#8a94a6]">
                      /{p.slug} · {p.status}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
            {!pages.length ? <Empty title="No pages yet" sub="Create a help or policy page." /> : null}
          </section>
          <section className="nexlo-card p-5">
            <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">{selectedSlug ? "Edit page" : "New page"}</h2>
            <form className="mt-3 grid gap-3" onSubmit={savePage}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-[13px] font-medium text-[#0f1c3f]">
                  Slug
                  <input
                    value={page.slug}
                    onChange={(e) => setPage({ ...page, slug: e.target.value })}
                    required
                    className="nexlo-field mt-1"
                    placeholder="selling-guide"
                  />
                </label>
                <label className="text-[13px] font-medium text-[#0f1c3f]">
                  Title
                  <input
                    value={page.title}
                    onChange={(e) => setPage({ ...page, title: e.target.value })}
                    required
                    className="nexlo-field mt-1"
                  />
                </label>
              </div>
              <label className="text-[13px] font-medium text-[#0f1c3f]">
                Status
                <select value={page.status} onChange={(e) => setPage({ ...page, status: e.target.value })} className="nexlo-field mt-1">
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </label>
              <label className="text-[13px] font-medium text-[#0f1c3f]">
                Body
                <textarea
                  value={page.body}
                  onChange={(e) => setPage({ ...page, body: e.target.value })}
                  required
                  rows={10}
                  className="mt-1 w-full rounded-xl border border-[#e7eef6] px-3 py-2 text-[13px]"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button disabled={busy} className="nexlo-btn nexlo-btn-blue w-fit">
                  Save page
                </button>
                {selectedSlug ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="h-10 rounded-full border border-[#f5c2c7] px-4 text-[13px] font-semibold text-[#e5484d]"
                    onClick={() => deletePage(selectedSlug)}
                  >
                    Delete page
                  </button>
                ) : null}
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {tab === "banners" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="nexlo-card overflow-x-auto p-0">
            <table className="w-full min-w-[520px] text-left text-[13.5px]">
              <thead className="bg-[#f7fafd] text-[#6b7587]">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th>Position</th>
                  <th>Link</th>
                  <th>Status</th>
                  <th className="pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {banners.map((b) => (
                  <tr key={b.id} className="border-t border-[#eef2f7]">
                    <td className="px-4 py-3 font-semibold text-[#0f1c3f]">{b.title}</td>
                    <td>{b.position}</td>
                    <td className="text-[#6b7587]">{b.link || "—"}</td>
                    <td>
                      <StatusPill status={b.active ? "active" : "inactive"} />
                    </td>
                    <td className="pr-4 text-right">
                      <button
                        type="button"
                        disabled={busy}
                        className="text-[12.5px] font-semibold text-[#e5484d]"
                        onClick={() => deleteBanner(b.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!banners.length ? <Empty title="No banners" sub="Add a home hero or promo strip." /> : null}
          </section>
          <aside className="nexlo-card h-fit p-5">
            <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Add banner</h2>
            <form className="mt-3 grid gap-3" onSubmit={saveBanner}>
              <input
                value={banner.title}
                onChange={(e) => setBanner({ ...banner, title: e.target.value })}
                placeholder="Title"
                required
                className="nexlo-field"
              />
              <input
                value={banner.link}
                onChange={(e) => setBanner({ ...banner, link: e.target.value })}
                placeholder="/deals"
                className="nexlo-field"
              />
              <select
                value={banner.position}
                onChange={(e) => setBanner({ ...banner, position: e.target.value })}
                className="nexlo-field"
              >
                <option value="home_hero">Home hero</option>
                <option value="home_strip">Home strip</option>
                <option value="category">Category</option>
              </select>
              <button disabled={busy} className="nexlo-btn nexlo-btn-blue">
                Add banner
              </button>
            </form>
          </aside>
        </div>
      ) : null}

      {tab === "settings" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="nexlo-card p-5">
            <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Site settings</h2>
            <ul className="mt-3 space-y-1 text-[13px]">
              {settings.map((s) => (
                <li key={s.key} className="flex justify-between gap-3 rounded-xl bg-[#f4f8fd] px-3 py-2">
                  <span>{s.key}</span>
                  <span className="font-mono text-[#3665f3]">{JSON.stringify(s.value)}</span>
                </li>
              ))}
            </ul>
            {!settings.length ? <Empty title="No settings rows" sub="CMS settings appear after first write." /> : null}
          </section>
          <aside className="nexlo-card h-fit p-5">
            <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Buyer protection</h2>
            <p className="mt-1 text-[13px] text-[#6b7587]">Days after delivery a buyer can open a return or case.</p>
            <form className="mt-3 space-y-3" onSubmit={saveProtection}>
              <input
                type="number"
                min={1}
                max={90}
                value={protectionDays}
                onChange={(e) => setProtectionDays(e.target.value)}
                className="nexlo-field"
              />
              <button disabled={busy} className="nexlo-btn nexlo-btn-blue w-full">
                Save window
              </button>
            </form>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
