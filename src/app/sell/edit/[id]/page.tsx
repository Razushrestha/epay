"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { accountApi, apiBase, getToken } from "@/lib/account-api";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/ui/PageHero";

type ListingPhoto = { id: number; url: string; thumbnail_url?: string | null; is_primary?: boolean };

type Variation = {
  id: number;
  name: string;
  options: { id: number; value: string; photo_url?: string | null }[] | null;
};

type Listing = {
  id: number;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  price: number | null;
  compare_at?: number | null;
  shipping_additional?: number | null;
  quantity: number;
  status: string;
  photos?: ListingPhoto[] | null;
  variations?: Variation[] | null;
};

export default function EditListingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      window.location.href = `/login?redirect=/sell/edit/${params.id}`;
      return;
    }
    accountApi<{ listing: Listing }>(`/api/v1/listings/${params.id}`)
      .then((body) => setListing(body.listing))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load listing"));
  }, [params.id]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!listing) return;
    setSaving(true);
    setError(null);
    try {
      await accountApi(`/api/v1/listings/${listing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: listing.title,
          subtitle: listing.subtitle,
          description: listing.description,
          price: listing.price,
          quantity: listing.quantity,
          compare_at: listing.compare_at,
          shipping_additional: listing.shipping_additional,
        }),
      });
      router.push("/sell/listings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function addPhotos(files: FileList | null) {
    if (!listing || !files?.length) return;
    setUploading(true);
    setError(null);
    const token = getToken();
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("photo", file);
        const res = await fetch(`${apiBase}/api/v1/listings/${listing.id}/photos/upload`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: form,
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Photo upload failed");
      }
      const fresh = await accountApi<{ listing: Listing }>(`/api/v1/listings/${listing.id}`);
      setListing(fresh.listing);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function addVariationPhoto(name: string, value: string, file?: File) {
    if (!listing || !file) return;
    setUploading(true);
    setError(null);
    const token = getToken();
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch(`${apiBase}/api/v1/listings/${listing.id}/photos/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.photo?.url) throw new Error(body.error || "Photo upload failed");
      await accountApi(`/api/v1/listings/${listing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ variation_photos: [{ name, value, url: body.photo.url }] }),
      });
      const fresh = await accountApi<{ listing: Listing }>(`/api/v1/listings/${listing.id}`);
      setListing(fresh.listing);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save variation photo");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Seller hub"
        title="Edit listing"
        body="Update title, price, and quantity. Changes go live on the storefront immediately."
        cta="All listings"
        href="/sell/listings"
      />
      <main className="page-shell py-8">
        {error ? <p className="mb-4 rounded-xl bg-[#fff5f5] px-4 py-3 text-[14px] text-[#e53238]">{error}</p> : null}
        {!listing ? (
          <p className="text-[14px] text-[#6b7587]">Loading listing…</p>
        ) : (
          <form className="nexlo-card max-w-2xl space-y-4 p-6" onSubmit={save}>
            <label className="block text-[13px] font-semibold text-[#0f1c3f]">
              Title
              <input value={listing.title} onChange={(e) => setListing({ ...listing, title: e.target.value })} className="mt-1 h-11 w-full rounded-full border border-[#e7eef6] px-4 font-normal" required />
            </label>
            <label className="block text-[13px] font-semibold text-[#0f1c3f]">
              Subtitle
              <input value={listing.subtitle || ""} onChange={(e) => setListing({ ...listing, subtitle: e.target.value })} className="mt-1 h-11 w-full rounded-full border border-[#e7eef6] px-4 font-normal" />
            </label>
            <label className="block text-[13px] font-semibold text-[#0f1c3f]">
              Description
              <textarea value={listing.description || ""} onChange={(e) => setListing({ ...listing, description: e.target.value })} className="mt-1 min-h-32 w-full rounded-xl border border-[#e7eef6] px-4 py-3 font-normal" />
            </label>
            <div>
              <p className="text-[13px] font-semibold text-[#0f1c3f]">Photos</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(listing.photos ?? []).map((photo) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={photo.id} src={photo.thumbnail_url || photo.url} alt="" className="h-20 w-20 rounded-xl object-cover" />
                ))}
                <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#c9d3e0] text-[12px] text-[#667085]">
                  {uploading ? "…" : "Add"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
                </label>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[13px] font-semibold text-[#0f1c3f]">
                Price (NPR)
                <input type="number" value={listing.price ?? 0} onChange={(e) => setListing({ ...listing, price: Number(e.target.value) })} className="mt-1 h-11 w-full rounded-full border border-[#e7eef6] px-4 font-normal" />
              </label>
              <label className="block text-[13px] font-semibold text-[#0f1c3f]">
                Was price (NPR)
                <input type="number" value={listing.compare_at ?? 0} onChange={(e) => setListing({ ...listing, compare_at: Number(e.target.value) || null })} className="mt-1 h-11 w-full rounded-full border border-[#e7eef6] px-4 font-normal" />
              </label>
              <label className="block text-[13px] font-semibold text-[#0f1c3f]">
                Quantity
                <input type="number" min={0} value={listing.quantity} onChange={(e) => setListing({ ...listing, quantity: Number(e.target.value) })} className="mt-1 h-11 w-full rounded-full border border-[#e7eef6] px-4 font-normal" />
              </label>
              <label className="block text-[13px] font-semibold text-[#0f1c3f]">
                Additional item shipping (NPR)
                <input type="number" value={listing.shipping_additional ?? 0} onChange={(e) => setListing({ ...listing, shipping_additional: Number(e.target.value) || null })} className="mt-1 h-11 w-full rounded-full border border-[#e7eef6] px-4 font-normal" />
              </label>
            </div>
            {(listing.variations || []).some((v) => (v.options || []).length) ? (
              <div>
                <p className="text-[13px] font-semibold text-[#0f1c3f]">Variation photos</p>
                <div className="mt-2 space-y-3">
                  {(listing.variations || []).map((variation) => (
                    <div key={variation.id}>
                      <p className="text-[12px] text-[#6b7587]">{variation.name}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {(variation.options || []).map((opt) => (
                          <label key={opt.id} className="w-24 text-center text-[11px] text-[#0f1c3f]">
                            {opt.photo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={opt.photo_url} alt="" className="mb-1 h-20 w-20 rounded-xl object-cover" />
                            ) : (
                              <span className="mb-1 flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-[#c9d3e0] text-[10px] text-[#667085]">Add</span>
                            )}
                            {opt.value}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={(e) => addVariationPhoto(variation.name, opt.value, e.target.files?.[0])}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <button className="nexlo-btn" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
          </form>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
