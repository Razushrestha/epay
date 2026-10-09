"use client";

import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";

type Page = { slug: string; title: string; body: string; status: string };
type Banner = { id: number; title: string; link: string | null; position: string; active: boolean };
type Setting = { key: string; value: unknown };

export default function AdminCmsPage() {
  const [pages, setPages] = useState<Page[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [page, setPage] = useState({ slug: "", title: "", body: "" });
  const [banner, setBanner] = useState({ title: "", link: "", position: "home_hero" });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const body = await accountApi<{ pages: Page[]; banners: Banner[]; settings: Setting[] }>("/api/v1/admin/cms");
    setPages(body.pages);
    setBanners(body.banners);
    setSettings(body.settings);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load CMS"));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Content</h1>
        <p className="text-[14px] text-[#6b7587]">Help pages, banners, and site rules.</p>
      </div>
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-xl bg-[#eaf1ff] px-4 py-3 text-[13px] text-[#2a4fa8]">{notice}</p> : null}
      <section className="nexlo-card p-5">
        <h2 className="text-[16px] font-extrabold">Pages</h2>
        <form className="mt-3 grid gap-2" onSubmit={async (e) => {
          e.preventDefault();
          await accountApi("/api/v1/admin/cms/pages", { method: "POST", body: JSON.stringify(page) });
          setNotice("Page saved.");
          setPage({ slug: "", title: "", body: "" });
          await load();
        }}>
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={page.slug} onChange={(e) => setPage({ ...page, slug: e.target.value })} placeholder="slug" className="h-10 rounded-full border px-4" />
            <input value={page.title} onChange={(e) => setPage({ ...page, title: e.target.value })} placeholder="Title" className="h-10 rounded-full border px-4" />
          </div>
          <textarea value={page.body} onChange={(e) => setPage({ ...page, body: e.target.value })} className="min-h-24 rounded-xl border px-3 py-2" placeholder="Body" />
          <button className="h-10 w-fit rounded-full bg-[#3665f3] px-5 text-[14px] font-semibold text-white">Save page</button>
        </form>
        <ul className="mt-3 text-[13px] text-[#5b6780]">
          {pages.map((p) => <li key={p.slug}>{p.slug} — {p.title} ({p.status})</li>)}
        </ul>
      </section>
      <section className="nexlo-card p-5">
        <h2 className="text-[16px] font-extrabold">Banners</h2>
        <form className="mt-3 grid gap-2 sm:grid-cols-3" onSubmit={async (e) => {
          e.preventDefault();
          await accountApi("/api/v1/admin/cms/banners", { method: "POST", body: JSON.stringify(banner) });
          setNotice("Banner saved.");
          await load();
        }}>
          <input value={banner.title} onChange={(e) => setBanner({ ...banner, title: e.target.value })} placeholder="Title" className="h-10 rounded-full border px-4" />
          <input value={banner.link} onChange={(e) => setBanner({ ...banner, link: e.target.value })} placeholder="/deals" className="h-10 rounded-full border px-4" />
          <button className="h-10 rounded-full bg-[#121826] px-4 text-[13px] text-white">Add banner</button>
        </form>
        <ul className="mt-3 text-[13px]">{banners.map((b) => <li key={b.id}>{b.title} · {b.position} {b.active ? "" : "(off)"}</li>)}</ul>
      </section>
      <section className="nexlo-card p-5">
        <h2 className="text-[16px] font-extrabold">Site settings</h2>
        <ul className="mt-3 space-y-1 text-[13px]">
          {settings.map((s) => (
            <li key={s.key} className="flex justify-between gap-3 rounded-xl bg-[#f7f7f7] px-3 py-2">
              <span>{s.key}</span>
              <span className="font-mono text-[#3665f3]">{JSON.stringify(s.value)}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-3 h-9 rounded-full border px-4 text-[13px]"
          onClick={async () => {
            await accountApi("/api/v1/admin/cms/settings", { method: "PATCH", body: JSON.stringify({ key: "buyer_protection_days", value: 30 }) });
            setNotice("Buyer protection set to 30 days.");
            await load();
          }}
        >
          Reset protection window to 30 days
        </button>
      </section>
    </div>
  );
}
