"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { accountApi, apiBase, getToken } from "@/lib/account-api";
import { BuyShell } from "@/components/commerce/BuyShell";
import { VariationMatrix } from "@/components/sell/VariationMatrix";
import { comboKey, skuMinPrice, skuPayload, skuStockTotal, type SkuDraft, type VariationAxis } from "@/lib/variations";

type ListingPhoto = { id: number; url: string; thumbnail_url?: string | null; is_primary?: boolean };

type Variation = {
  id: number;
  name: string;
  options: { id: number; value: string; photo_url?: string | null }[] | null;
};

type ListingSku = {
  id: number;
  sku?: string | null;
  combination: Record<string, string>;
  price: number | null;
  quantity: number;
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
  skus?: ListingSku[] | null;
};

function draftsFromListing(listing: Listing): SkuDraft[] {
  return (listing.skus || []).map((sku) => ({
    key: comboKey(sku.combination || {}),
    combination: sku.combination || {},
    price: sku.price == null ? "" : String(sku.price),
    quantity: String(sku.quantity ?? 0),
    sku: sku.sku || "",
  }));
}

const field =
  "w-full rounded-2xl border border-[#e4eaf2] bg-white px-4 py-3 text-[14.5px] text-[#0f1c3f] outline-none transition placeholder:text-[#9aa3b2] focus:border-[#13948e] focus:ring-2 focus:ring-[#13948e]/15";

export default function EditListingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [skuRows, setSkuRows] = useState<SkuDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const variationAxes = useMemo<VariationAxis[]>(
    () =>
      (listing?.variations || [])
        .filter((variation) => (variation.options || []).length)
        .map((variation) => ({
          name: variation.name,
          values: (variation.options || []).map((opt) => opt.value),
        })),
    [listing?.variations],
  );

  useEffect(() => {
    if (!getToken()) {
      window.location.href = `/login?redirect=/sell/edit/${params.id}`;
      return;
    }
    accountApi<{ listing: Listing }>(`/api/v1/listings/${params.id}`)
      .then((body) => {
        setListing(body.listing);
        setSkuRows(draftsFromListing(body.listing));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load listing"));
  }, [params.id]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!listing) return;
    setSaving(true);
    setError(null);
    try {
      const hasSkus = skuRows.length > 0;
      await accountApi(`/api/v1/listings/${listing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: listing.title,
          subtitle: listing.subtitle,
          description: listing.description,
          price: hasSkus ? skuMinPrice(skuRows) ?? listing.price : listing.price,
          quantity: hasSkus ? skuStockTotal(skuRows) : listing.quantity,
          compare_at: listing.compare_at,
          shipping_additional: listing.shipping_additional,
          skus: hasSkus ? skuPayload(skuRows) : undefined,
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
    <BuyShell
      crumbs={[
        { href: "/", label: "Home" },
        { href: "/sell", label: "Sell" },
        { href: "/sell/listings", label: "Listings" },
        { label: "Edit" },
      ]}
      title="Edit listing"
      body="Update title, price, photos, and quantity. Changes go live on the storefront immediately."
      aside={
        <Link href="/sell/listings" className="text-[13px] font-semibold text-[#3665f3] hover:underline">
          All listings →
        </Link>
      }
    >
      {error ? <p className="nexlo-alert nexlo-alert-error mt-4">{error}</p> : null}
      {!listing ? (
        <p className="mt-8 text-[14px] text-[#6b7587]">Loading listing…</p>
      ) : (
        <form className="mt-5 rounded-[28px] border border-[#e8eef6] bg-white p-5 shadow-[0_18px_50px_-32px_rgba(15,40,80,0.35)] sm:p-8" onSubmit={save}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <p className="text-[13px] text-[#6b7587]">
              Status <span className="font-semibold capitalize text-[#0f1c3f]">{listing.status}</span>
            </p>
            <Link href={`/listing/${listing.id}`} className="text-[13px] font-semibold text-[#3665f3] hover:underline">
              View listing →
            </Link>
          </div>
          <div className="space-y-5">
            <label className="block text-[13.5px] font-semibold text-[#0f1c3f]">
              Title
              <input value={listing.title} onChange={(e) => setListing({ ...listing, title: e.target.value })} className={`${field} mt-1.5 font-normal`} required />
            </label>
            <label className="block text-[13.5px] font-semibold text-[#0f1c3f]">
              Subtitle <span className="font-normal text-[#8a94a6]">(optional)</span>
              <input value={listing.subtitle || ""} onChange={(e) => setListing({ ...listing, subtitle: e.target.value })} className={`${field} mt-1.5 font-normal`} />
            </label>
            <label className="block text-[13.5px] font-semibold text-[#0f1c3f]">
              Description
              <textarea value={listing.description || ""} onChange={(e) => setListing({ ...listing, description: e.target.value })} className={`${field} mt-1.5 min-h-32 resize-y font-normal`} />
            </label>
            <div>
              <p className="text-[13.5px] font-semibold text-[#0f1c3f]">Photos</p>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-[13.5px] font-semibold text-[#0f1c3f]">
                Price (NPR)
                <input type="number" value={listing.price ?? 0} onChange={(e) => setListing({ ...listing, price: Number(e.target.value) })} className={`${field} mt-1.5 font-normal`} />
              </label>
              <label className="block text-[13.5px] font-semibold text-[#0f1c3f]">
                Was price (NPR)
                <input type="number" value={listing.compare_at ?? 0} onChange={(e) => setListing({ ...listing, compare_at: Number(e.target.value) || null })} className={`${field} mt-1.5 font-normal`} />
              </label>
              {skuRows.length ? (
                <div className="block text-[13.5px] font-semibold text-[#0f1c3f]">
                  Quantity
                  <p className="mt-1.5 rounded-2xl border border-[#e4eaf2] bg-[#f7fafc] px-4 py-3 text-[14.5px] font-normal text-[#0f1c3f]">
                    {skuStockTotal(skuRows)} across variations
                  </p>
                </div>
              ) : (
                <label className="block text-[13.5px] font-semibold text-[#0f1c3f]">
                  Quantity
                  <input type="number" min={0} value={listing.quantity} onChange={(e) => setListing({ ...listing, quantity: Number(e.target.value) })} className={`${field} mt-1.5 font-normal`} />
                </label>
              )}
              <label className="block text-[13.5px] font-semibold text-[#0f1c3f]">
                Additional item shipping (NPR)
                <input type="number" value={listing.shipping_additional ?? 0} onChange={(e) => setListing({ ...listing, shipping_additional: Number(e.target.value) || null })} className={`${field} mt-1.5 font-normal`} />
              </label>
            </div>
            {(listing.variations || []).some((v) => (v.options || []).length) ? (
              <div className="space-y-4">
                <VariationMatrix
                  axes={variationAxes}
                  rows={skuRows}
                  onChange={setSkuRows}
                  defaultPrice={listing.price == null ? "" : String(listing.price)}
                />
                <div>
                  <p className="text-[13.5px] font-semibold text-[#0f1c3f]">Variation photos</p>
                  <div className="mt-2 space-y-3">
                    {(listing.variations || []).map((variation) => (
                      <div key={variation.id}>
                        <p className="text-[12px] text-[#6b7587]">{variation.name}</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {(variation.options || []).map((opt) => (
                            <label key={opt.id} className="w-24 cursor-pointer text-center text-[11px] text-[#0f1c3f]">
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
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3 pt-2">
              <button className="nexlo-btn" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
              <Link href="/sell/listings" className="nexlo-btn nexlo-btn-ghost">
                Cancel
              </Link>
            </div>
          </div>
        </form>
      )}
    </BuyShell>
  );
}
