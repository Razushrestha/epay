"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { accountApi, apiBase } from "@/lib/account-api";
import { useRouter } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { VariationMatrix } from "@/components/sell/VariationMatrix";
import {
  mergeSkuDrafts,
  parseOptionList,
  skuMinPrice,
  skuPayload,
  skuStockTotal,
  type SkuDraft,
  type VariationAxis,
} from "@/lib/variations";
import { AuthenticityBadge } from "@/components/catalog/AuthenticityBadge";
import { ListingPhotoGrid, type ListingPhotoItem } from "@/components/sell/ListingPhotoGrid";

interface Category {
  id: number;
  name: string;
  slug: string;
  level: number;
  parent_id: number | null;
}

interface Condition {
  id: number;
  name: string;
  slug: string;
  description: string | null;
}

interface Brand {
  id: number;
  name: string;
  slug: string;
  is_verified?: boolean;
}

type Photo = ListingPhotoItem;

interface Specific {
  id: number;
  name: string;
  slug: string;
  input_type: string;
  is_required: boolean;
  unit?: string | null;
  help_text?: string | null;
  min_value?: number | string | null;
  max_value?: number | string | null;
  options?: { id: number; value: string }[] | null;
}

function specificFieldError(spec: Specific, raw: string) {
  const value = String(raw ?? "").trim();
  if (spec.input_type === "number" && value) {
    const num = Number(value);
    const min = spec.min_value == null ? 0 : Number(spec.min_value);
    const max = spec.max_value == null ? Number.POSITIVE_INFINITY : Number(spec.max_value);
    const unit = spec.unit ? ` ${spec.unit}` : "";
    if (!Number.isFinite(num)) return `${spec.name} must be a number${unit}.`;
    if (num < min || num > max) {
      const high = Number.isFinite(max) ? String(max) : "∞";
      return `${spec.name} must be between ${min} and ${high}${unit}. Negative or out-of-range values are not allowed.`;
    }
  }
  if (spec.is_required && !value) return `Fill in ${spec.name} for this category.`;
  return null;
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px] leading-snug text-[#8a94a6]">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 shrink-0" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </svg>
      {children}
    </p>
  );
}

export default function CreateListingPage() {
  const router = useRouter();
  const [sellerOk, setSellerOk] = useState<boolean | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [createdListingId, setCreatedListingId] = useState<number | null>(null);
  const [removeBackground, setRemoveBackground] = useState(false); // Background removal option

  // Form data
  const [categories, setCategories] = useState<Category[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [colorPhotos, setColorPhotos] = useState<Record<string, File>>({});
  const [skuEdits, setSkuEdits] = useState<Record<string, Partial<SkuDraft>>>({});
  const [specifics, setSpecifics] = useState<Specific[]>([]);
  const [specificValues, setSpecificValues] = useState<Record<string, string>>({});
  const [specificErrors, setSpecificErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    category_id: "",
    brand_id: "",
    title: "",
    subtitle: "",
    description: "",
    condition_id: "",
    condition_description: "",
    format: "fixed" as "fixed" | "auction" | "both",
    price: "",
    quantity: "1",
    auction_start_price: "",
    auction_reserve_price: "",
    auction_duration: "168", // 7 days in hours
    allow_best_offer: false,
    auto_accept_price: "",
    auto_decline_price: "",
    shipping_free: false,
    shipping_cost: "",
    shipping_additional: "",
    compare_at: "",
    shipping_international: false,
    shipping_international_cost: "",
    item_location: "",
    sku: "",
    upc: "",
    size_options: "",
    color_options: "",
    use_variations: false,
    publish_immediately: true,
  });

  useEffect(() => {
    const token = accountApi.getToken();
    if (!token) {
      router.replace("/login?redirect=/sell/create");
      return;
    }
    accountApi<{ user: { isSeller?: boolean; isStaff?: boolean; kyc?: { status?: string } | null } }>("/api/v1/account")
      .then((body) => {
        if (body.user.isSeller || body.user.isStaff) {
          setSellerOk(true);
          return;
        }
        router.replace("/account/selling");
      })
      .catch(() => router.replace("/login?redirect=/sell/create"));
  }, [router]);

  useEffect(() => {
    if (sellerOk) loadFormData();
  }, [sellerOk]);

  const variationAxes = useMemo<VariationAxis[]>(() => {
    if (!formData.use_variations) return [];
    if (formData.format !== "fixed" && formData.format !== "both") return [];
    const sizes = parseOptionList(formData.size_options);
    const colors = parseOptionList(formData.color_options);
    return [
      ...(sizes.length ? [{ name: "Size", values: sizes }] : []),
      ...(colors.length ? [{ name: "Color", values: colors }] : []),
    ];
  }, [formData.use_variations, formData.format, formData.size_options, formData.color_options]);

  const skuRows = useMemo(
    () =>
      mergeSkuDrafts([], variationAxes, { price: formData.price, quantity: formData.quantity }).map((row) => ({
        ...row,
        ...skuEdits[row.key],
        key: row.key,
        combination: row.combination,
      })),
    [variationAxes, formData.price, formData.quantity, skuEdits],
  );

  function setSkuRows(next: SkuDraft[] | ((current: SkuDraft[]) => SkuDraft[])) {
    const rows = typeof next === "function" ? next(skuRows) : next;
    setSkuEdits(Object.fromEntries(rows.map((row) => [row.key, { price: row.price, quantity: row.quantity, sku: row.sku }])));
  }

  useEffect(() => {
    if (!formData.category_id) {
      setSpecifics([]);
      setSpecificValues({});
      setSpecificErrors({});
      return;
    }
    fetch(`${apiBase}/api/v1/catalog/categories/${formData.category_id}/specifics`)
      .then((res) => res.json())
      .then((body) => {
        setSpecifics(body.specifics || []);
        setSpecificValues({});
        setSpecificErrors({});
      })
      .catch(() => setSpecifics([]));
  }, [formData.category_id]);

  async function loadFormData() {
    try {
      // Load categories (level 1 for now - can add cascading later)
      const catRes = await fetch(`${apiBase}/api/v1/catalog/categories/tree`);
      const catData = await catRes.json();
      const flatten = (nodes: Category[] = [], trail: string[] = []): Category[] =>
        nodes.flatMap((node) => {
          const path = [...trail, node.name];
          return [{ ...node, name: path.join(" › ") }, ...flatten((node as Category & { children?: Category[] }).children, path)];
        });
      setCategories(flatten(catData.tree || []));

      // Load conditions
      const condRes = await fetch(`${apiBase}/api/v1/catalog/conditions`);
      const condData = await condRes.json();
      setConditions(condData.conditions || []);

      // Load brands
      const brandRes = await fetch(`${apiBase}/api/v1/catalog/brands?limit=100`);
      const brandData = await brandRes.json();
      setBrands(brandData.brands || []);
    } catch (err: any) {
      setError("Failed to load form data: " + err.message);
    }
  }

  async function persistPhotoLayout(listingId: number, list: Photo[]) {
    const token = accountApi.getToken();
    const ids = list.map((photo) => photo.id).filter((id): id is number => Number.isInteger(id));
    if (ids.length) {
      await fetch(`${apiBase}/api/v1/listings/${listingId}/photos/reorder`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ photo_ids: ids }),
      });
    }
    const primary = list.find((photo) => photo.is_primary && photo.id);
    if (primary?.id) {
      await fetch(`${apiBase}/api/v1/listings/photos/${primary.id}/primary`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  }

  async function uploadPhotos(listingId: number) {
    if (!photos.length) return true;

    setUploadingPhotos(true);
    const token = accountApi.getToken();
    let failed = false;
    const next = [...photos];

    for (let index = 0; index < next.length; index += 1) {
      const photo = next[index];
      if (!photo.file) continue;
      try {
        const formData = new FormData();
        formData.append("photo", photo.file);
        if (removeBackground) {
          formData.append("removeBackground", "true");
        }

        const res = await fetch(`${apiBase}/api/v1/listings/${listingId}/photos/upload`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Upload failed");
        }
        next[index] = {
          ...photo,
          id: data.photo?.id,
          url: data.photo?.url,
          thumbnail_url: data.photo?.thumbnail_url,
          file: undefined,
        };
      } catch (err: unknown) {
        failed = true;
        const message = err instanceof Error ? err.message : "Upload failed";
        console.error("Photo upload error:", err);
        setError(`Failed to upload ${photo.file?.name ?? "photo"}: ${message}`);
      }
    }

    setPhotos(next);
    if (!failed) {
      try {
        await persistPhotoLayout(listingId, next);
      } catch (err: unknown) {
        failed = true;
        setError(err instanceof Error ? err.message : "Could not save photo order");
      }
    }
    setUploadingPhotos(false);
    return !failed;
  }

  async function saveDraft() {
    if (!formData.category_id || !formData.title.trim()) {
      setError("Enter a title and category to save this draft.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const token = accountApi.getToken();
      if (!token) {
        router.push("/login?redirect=/sell/create");
        return;
      }
      const payload = {
        ...formData,
        category_id: parseInt(formData.category_id, 10),
        brand_id: formData.brand_id ? parseInt(formData.brand_id, 10) : null,
        condition_id: formData.condition_id ? parseInt(formData.condition_id, 10) : null,
        price: formData.price ? parseFloat(formData.price) : null,
        quantity: parseInt(formData.quantity, 10) || 1,
        auction_start_price: formData.auction_start_price ? parseFloat(formData.auction_start_price) : null,
        auction_reserve_price: formData.auction_reserve_price ? parseFloat(formData.auction_reserve_price) : null,
        auction_duration: parseInt(formData.auction_duration, 10) || 168,
        specifics: specificValues,
        publish_immediately: false,
        save_as_draft: true,
      };
      const res = await fetch(`${apiBase}/api/v1/listings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save draft");
      router.push("/sell/listings?tab=draft");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateStep1()) return;
    if (!validateStep2()) return;
    setError(null);
    setLoading(true);

    try {
      const token = accountApi.getToken();
      if (!token) {
        router.push("/login?redirect=/sell/create");
        return;
      }

      let listingId = createdListingId;
      if (!listingId) {
        const skus = skuRows.length ? skuPayload(skuRows) : undefined;
        const variationQty = skuRows.length ? skuStockTotal(skuRows) : parseInt(formData.quantity);
        const variationPrice = skuRows.length ? skuMinPrice(skuRows) : null;
        const payload = {
          ...formData,
          category_id: parseInt(formData.category_id),
          brand_id: formData.brand_id ? parseInt(formData.brand_id) : null,
          condition_id: formData.condition_id ? parseInt(formData.condition_id) : null,
          price: variationPrice ?? (formData.price ? parseFloat(formData.price) : null),
          quantity: Number.isFinite(variationQty) ? variationQty : 1,
          auction_start_price: formData.auction_start_price ? parseFloat(formData.auction_start_price) : null,
          auction_reserve_price: formData.auction_reserve_price ? parseFloat(formData.auction_reserve_price) : null,
          auction_duration: parseInt(formData.auction_duration),
          auto_accept_price: formData.auto_accept_price ? parseFloat(formData.auto_accept_price) : null,
          auto_decline_price: formData.auto_decline_price ? parseFloat(formData.auto_decline_price) : null,
          shipping_cost: formData.shipping_cost ? parseFloat(formData.shipping_cost) : null,
          shipping_additional: formData.shipping_additional ? parseFloat(formData.shipping_additional) : null,
          compare_at: formData.compare_at ? parseFloat(formData.compare_at) : null,
          shipping_international_cost: formData.shipping_international_cost
            ? parseFloat(formData.shipping_international_cost)
            : null,
          specifics: specificValues,
          variations: variationAxes.length
            ? variationAxes.map((axis) => ({ name: axis.name, options: axis.values }))
            : undefined,
          skus,
        };

        const res = await fetch(`${apiBase}/api/v1/listings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create listing");
        }

        const data = await res.json();
        listingId = data.listing.id;
        setCreatedListingId(listingId);
      }

      if (!listingId) throw new Error("Could not create listing");

      if (photos.some((photo) => photo.file)) {
        const uploaded = await uploadPhotos(listingId);
        if (!uploaded) {
          setError((current) => current || "Listing saved, but photos did not upload. Try Publish again or add them from Edit listing.");
          return;
        }
      }

      const colorEntries = Object.entries(colorPhotos).filter(([, file]) => file);
      if (colorEntries.length) {
        const variation_photos: { name: string; value: string; url: string }[] = [];
        for (const [value, file] of colorEntries) {
          const body = new FormData();
          body.append("photo", file);
          const res = await fetch(`${apiBase}/api/v1/listings/${listingId}/photos/upload`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body,
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.photo?.url) {
            variation_photos.push({ name: "Color", value, url: data.photo.url });
          }
        }
        if (variation_photos.length) {
          await fetch(`${apiBase}/api/v1/listings/${listingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ variation_photos }),
          });
        }
      }

      if (formData.publish_immediately) {
        router.push(`/listing/${listingId}`);
      } else {
        router.push("/sell/listings");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateField(field: string, value: any) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function validateStep1() {
    const nextErrors: Record<string, string> = {};
    for (const spec of specifics) {
      const message = specificFieldError(spec, specificValues[spec.slug] ?? "");
      if (message && spec.input_type === "number" && String(specificValues[spec.slug] ?? "").trim()) {
        nextErrors[spec.slug] = message;
      }
    }
    if (Object.keys(nextErrors).length) {
      setSpecificErrors(nextErrors);
      setError(Object.values(nextErrors)[0]);
      return false;
    }
    if (!formData.category_id || !formData.title.trim() || !formData.description.trim() || !formData.condition_id) {
      setError("Fill in category, title, description, and condition first.");
      return false;
    }
    for (const spec of specifics) {
      const message = specificFieldError(spec, specificValues[spec.slug] ?? "");
      if (message) nextErrors[spec.slug] = message;
    }
    if (Object.keys(nextErrors).length) {
      setSpecificErrors(nextErrors);
      setError(Object.values(nextErrors)[0]);
      return false;
    }
    setSpecificErrors({});
    setError(null);
    return true;
  }

  function validateStep2() {
    if (formData.format === "fixed" || formData.format === "both") {
      if (formData.use_variations) {
        if (!variationAxes.length) {
          setError("Add Size and/or Color options for this variation listing.");
          return false;
        }
        const priced = skuRows.some((row) => Number(row.price) > 0);
        const total = skuStockTotal(skuRows);
        if (!priced) {
          setError("Set a price for each SKU combination.");
          return false;
        }
        if (total < 1) {
          setError("Set quantity for at least one SKU combination.");
          return false;
        }
      } else {
        const price = Number(formData.price);
        const qty = parseInt(formData.quantity, 10);
        if (!Number.isFinite(price) || price <= 0) {
          setError("Enter a Buy It Now price in NPR.");
          return false;
        }
        if (!Number.isFinite(qty) || qty < 1) {
          setError("Stock quantity must be at least 1.");
          return false;
        }
      }
    }
    if (formData.format === "auction" || formData.format === "both") {
      const start = Number(formData.auction_start_price);
      const reserve = formData.auction_reserve_price === "" ? null : Number(formData.auction_reserve_price);
      if (!Number.isFinite(start) || start <= 0) {
        setError("Enter a starting bid in NPR.");
        return false;
      }
      if (reserve != null && (!Number.isFinite(reserve) || reserve < start)) {
        setError("Reserve price must be at least the starting bid.");
        return false;
      }
      if (!["72", "120", "168", "240"].includes(String(formData.auction_duration))) {
        setError("Select a duration of 3, 5, 7, or 10 days.");
        return false;
      }
    }
    if (formData.format === "both") {
      const start = Number(formData.auction_start_price);
      const bin = Number(formData.price);
      if (Number.isFinite(start) && Number.isFinite(bin) && bin <= start) {
        setError("Buy It Now price must be higher than the starting bid.");
        return false;
      }
    }
    if (formData.allow_best_offer && (formData.format === "fixed" || formData.format === "both")) {
      const listed = Number(formData.price);
      const accept = formData.auto_accept_price === "" ? null : Number(formData.auto_accept_price);
      const decline = formData.auto_decline_price === "" ? null : Number(formData.auto_decline_price);
      if (accept != null && (!Number.isFinite(accept) || accept <= 0)) {
        setError("Enter a valid auto-accept amount, or leave it blank.");
        return false;
      }
      if (decline != null && (!Number.isFinite(decline) || decline <= 0)) {
        setError("Enter a valid auto-decline amount, or leave it blank.");
        return false;
      }
      if (accept != null && Number.isFinite(listed) && accept > listed) {
        setError("Auto-accept must be at or below the listed price.");
        return false;
      }
      if (decline != null && accept != null && decline >= accept) {
        setError("Auto-decline must be lower than auto-accept.");
        return false;
      }
    }
    setError(null);
    return true;
  }

  const field =
    "w-full rounded-2xl border border-[#e4eaf2] bg-white px-4 py-3 text-[14.5px] text-[#0f1c3f] outline-none transition placeholder:text-[#9aa3b2] focus:border-[#13948e] focus:ring-2 focus:ring-[#13948e]/15";
  const steps = [
    { n: 1, label: "Basic info" },
    { n: 2, label: "Pricing & format" },
    { n: 3, label: "Photos & publish" },
  ];

  if (sellerOk !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f8fd] text-[14px] text-[#6b7587]">
        Checking seller access…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f8fd] py-5 sm:py-8">
      <div className="page-shell mx-auto max-w-[920px]">
        {error && (
          <div role="alert" className="mb-5 rounded-2xl border border-[#f5c2c7] bg-[#fff5f5] px-4 py-3 text-[14px] text-[#e53238]">
            {error}
          </div>
        )}

        <ol className="mb-7 flex items-center gap-2 sm:gap-3">
          {steps.map((item, i) => {
            const active = step === item.n;
            const done = step > item.n;
            return (
              <li key={item.n} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                    active || done ? "bg-[#13948e] text-white" : "bg-[#d8dee8] text-[#6b7587]"
                  }`}
                >
                  {item.n}
                </span>
                <span className={`hidden truncate text-[13px] font-semibold sm:inline sm:text-[14.5px] ${active || done ? "text-[#0f3d4c]" : "text-[#8a94a6]"}`}>
                  {item.label}
                </span>
                {i < steps.length - 1 ? (
                  <span className={`ml-1 h-px min-w-[24px] flex-1 ${done ? "bg-[#13948e]" : "bg-[#d8dee8]"}`} />
                ) : null}
              </li>
            );
          })}
        </ol>

        <form noValidate onSubmit={handleSubmit} className="rounded-[28px] border border-[#e8eef6] bg-white p-5 shadow-[0_18px_50px_-32px_rgba(15,40,80,0.35)] sm:p-8">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">
                  Category <span className="text-[#e11d48]">*</span>
                </label>
                <select
                  required
                  value={formData.category_id}
                  onChange={(e) => updateField("category_id", e.target.value)}
                  className={field}
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <Hint>Choose the most relevant category for your item.</Hint>
              </div>

              <div>
                <label className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">
                  Title <span className="text-[#e11d48]">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={formData.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder="e.g. iPhone 14 Pro Max 256GB, Space Black"
                  className={field}
                />
                <div className="mt-1.5 flex items-start justify-between gap-3">
                  <Hint>Use a clear and descriptive title to get better visibility.</Hint>
                  <span className="shrink-0 text-[12px] text-[#8a94a6]">{formData.title.length}/80 characters</span>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">
                  Subtitle <span className="font-normal text-[#8a94a6]">(optional)</span>
                </label>
                <input
                  type="text"
                  maxLength={55}
                  value={formData.subtitle}
                  onChange={(e) => updateField("subtitle", e.target.value)}
                  placeholder="e.g. Excellent condition, 1 year warranty, with original box"
                  className={field}
                />
                <div className="mt-1.5 flex items-start justify-between gap-3">
                  <Hint>Add a short subtitle to highlight key details (e.g. brand, condition, features).</Hint>
                  <span className="shrink-0 text-[12px] text-[#8a94a6]">{formData.subtitle.length}/55 characters</span>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">
                  Description <span className="text-[#e11d48]">*</span>
                </label>
                <textarea
                  required
                  maxLength={1000}
                  value={formData.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  rows={6}
                  placeholder="Describe your item in detail, including features, condition, and what's included."
                  className={`${field} min-h-[140px] resize-y`}
                />
                <div className="mt-1.5 flex items-start justify-between gap-3">
                  <Hint>Be honest and detailed to build trust and get better offers.</Hint>
                  <span className="shrink-0 text-[12px] text-[#8a94a6]">{formData.description.length}/1000 characters</span>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">
                    Condition <span className="text-[#e11d48]">*</span>
                  </label>
                  <select
                    required
                    value={formData.condition_id}
                    onChange={(e) => updateField("condition_id", e.target.value)}
                    className={field}
                  >
                    <option value="">Select condition</option>
                    {conditions.map((cond) => (
                      <option key={cond.id} value={cond.id}>
                        {cond.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-[#0f1c3f]">
                    <span>
                      Brand <span className="text-[#e11d48]">*</span>
                    </span>
                    {brands.find((brand) => String(brand.id) === formData.brand_id)?.is_verified ? <AuthenticityBadge /> : null}
                  </label>
                  <select
                    value={formData.brand_id}
                    onChange={(e) => updateField("brand_id", e.target.value)}
                    className={field}
                  >
                    <option value="">No brand</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.is_verified ? `${brand.name} · Authentic` : brand.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {formData.condition_id ? (
                <div>
                  <label className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">
                    Seller notes
                    {conditions.find((cond) => String(cond.id) === formData.condition_id)?.name ? (
                      <span className="font-normal text-[#8a94a6]">
                        {" "}
                        ({conditions.find((cond) => String(cond.id) === formData.condition_id)?.name})
                      </span>
                    ) : null}
                  </label>
                  <textarea
                    value={formData.condition_description}
                    onChange={(e) => updateField("condition_description", e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Describe wear, repairs, battery health, or restoration work for this condition."
                    className={`${field} min-h-[88px] resize-y`}
                  />
                  <Hint>Shown on the product page next to the condition badge.</Hint>
                </div>
              ) : null}

              {specifics.length ? (
                <div>
                  <h2 className="mb-3 text-[15px] font-bold text-[#0f1c3f]">Item specifics</h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    {specifics.map((spec) => (
                      <label key={spec.id} className="block text-[13.5px] font-semibold text-[#0f1c3f]">
                        {spec.name}
                        {spec.is_required ? <span className="text-[#e11d48]"> *</span> : null}
                        {spec.unit ? <span className="font-normal text-[#8a94a6]"> ({spec.unit})</span> : null}
                        {spec.input_type === "select" || spec.input_type === "dropdown" ? (
                          <select
                            required={spec.is_required}
                            value={specificValues[spec.slug] ?? ""}
                            onChange={(e) => {
                              setSpecificValues((prev) => ({ ...prev, [spec.slug]: e.target.value }));
                              setSpecificErrors((prev) => {
                                const next = { ...prev };
                                delete next[spec.slug];
                                return next;
                              });
                            }}
                            className={`${field} mt-1.5 font-normal`}
                          >
                            <option value="">Select</option>
                            {(spec.options || []).map((opt) => (
                              <option key={opt.id} value={opt.value}>
                                {opt.value}
                              </option>
                            ))}
                          </select>
                        ) : spec.input_type === "boolean" || spec.input_type === "yes_no" ? (
                          <select
                            value={specificValues[spec.slug] ?? ""}
                            onChange={(e) => setSpecificValues((prev) => ({ ...prev, [spec.slug]: e.target.value }))}
                            className={`${field} mt-1.5 font-normal`}
                          >
                            <option value="">Select</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        ) : spec.input_type === "number" ? (
                          <input
                            type="number"
                            inputMode="decimal"
                            required={spec.is_required}
                            value={specificValues[spec.slug] ?? ""}
                            onChange={(e) => {
                              setSpecificValues((prev) => ({ ...prev, [spec.slug]: e.target.value }));
                              setSpecificErrors((prev) => {
                                const next = { ...prev };
                                delete next[spec.slug];
                                return next;
                              });
                            }}
                            className={`${field} mt-1.5 font-normal ${specificErrors[spec.slug] ? "border-[#e53238] focus:border-[#e53238] focus:ring-[#e53238]/15" : ""}`}
                            placeholder={spec.unit ? `Number (${spec.unit})` : "Number"}
                          />
                        ) : (
                          <input
                            required={spec.is_required}
                            value={specificValues[spec.slug] ?? ""}
                            onChange={(e) => setSpecificValues((prev) => ({ ...prev, [spec.slug]: e.target.value }))}
                            className={`${field} mt-1.5 font-normal`}
                          />
                        )}
                        {specificErrors[spec.slug] ? (
                          <p className="mt-1.5 text-[12.5px] font-normal text-[#e53238]" role="alert">
                            {specificErrors[spec.slug]}
                          </p>
                        ) : spec.help_text ? (
                          <Hint>{spec.help_text}</Hint>
                        ) : null}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => saveDraft()}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#d8dee8] bg-white px-5 text-[14.5px] font-semibold text-[#0f3d4c] hover:bg-[#f7fafc] disabled:opacity-60"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d="M7 3h8l5 5v13H7V3Z" />
                    <path d="M15 3v6h6M9 13h6M9 17h6" />
                  </svg>
                  {loading ? "Saving…" : "Save as Draft"}
                </button>
                <button
                  type="button"
                  onClick={() => validateStep1() && setStep(2)}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#0f3d4c] px-6 text-[14.5px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(15,61,76,0.7)] hover:bg-[#0c3240] sm:max-w-[420px]"
                >
                  Continue to pricing & format
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-[13.5px] font-semibold text-[#0f1c3f]">
                  Listing format <span className="text-[#e11d48]">*</span>
                </label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    ["fixed", "Buy It Now", "Set a fixed price"],
                    ["auction", "Auction", "Buyers bid to win"],
                    ["both", "Auction + BIN", "Bids with a buy price"],
                  ].map(([value, title, hint]) => (
                    <label
                      key={value}
                      className={`cursor-pointer rounded-2xl border px-4 py-3 ${
                        formData.format === value ? "border-[#13948e] bg-[#f2fbfa]" : "border-[#e4eaf2] bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="format"
                        value={value}
                        checked={formData.format === value}
                        onChange={(e) => updateField("format", e.target.value)}
                        className="sr-only"
                      />
                      <span className="block text-[14px] font-semibold text-[#0f1c3f]">{title}</span>
                      <span className="mt-0.5 block text-[12.5px] text-[#8a94a6]">{hint}</span>
                    </label>
                  ))}
                </div>
              </div>

              {(formData.format === "fixed" || formData.format === "both") && (
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">
                      {formData.format === "both" ? "Buy It Now price (NPR)" : "Price (NPR)"}{" "}
                      <span className="text-[#e11d48]">*</span>
                    </label>
                    <input
                      type="number"
                      required={!formData.use_variations}
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => updateField("price", e.target.value)}
                      className={field}
                    />
                    {formData.use_variations ? (
                      <Hint>Used as the default for new SKU rows. Each combination can override this.</Hint>
                    ) : null}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">Was price (NPR)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.compare_at}
                      onChange={(e) => updateField("compare_at", e.target.value)}
                      placeholder="Optional compare-at for Daily Deals"
                      className={field}
                    />
                    <Hint>If this is higher than the sale price, the listing can appear in Today&apos;s Deals.</Hint>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">
                      {skuRows.length ? "Default quantity per combination" : "Stock quantity"}{" "}
                      <span className="text-[#e11d48]">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.quantity}
                      onChange={(e) => updateField("quantity", e.target.value)}
                      className={field}
                    />
                    {skuRows.length ? (
                      <Hint>Used for new size/color rows. Total stock is the sum of the matrix below.</Hint>
                    ) : null}
                  </div>
                </div>
              )}

              {(formData.format === "fixed" || formData.format === "both") && (
                <div className="space-y-4 rounded-2xl border border-[#e4eaf2] bg-white px-4 py-4">
                  <label className="flex items-center gap-2 text-[14px] font-medium text-[#0f1c3f]">
                    <input
                      type="checkbox"
                      checked={formData.allow_best_offer}
                      onChange={(e) => updateField("allow_best_offer", e.target.checked)}
                      className="h-4 w-4 rounded border-[#c5cedb] text-[#13948e]"
                    />
                    Allow Best Offer
                  </label>
                  {formData.allow_best_offer ? (
                    <div className="grid gap-5 md:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">
                          Auto-Accept Threshold (NPR)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.auto_accept_price}
                          onChange={(e) => updateField("auto_accept_price", e.target.value)}
                          placeholder="e.g. 9000"
                          className={field}
                        />
                        <Hint>Offers at or above this amount are accepted immediately.</Hint>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">
                          Auto-Decline Threshold (NPR)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.auto_decline_price}
                          onChange={(e) => updateField("auto_decline_price", e.target.value)}
                          placeholder="e.g. 7000"
                          className={field}
                        />
                        <Hint>Offers below this amount are declined immediately. Amounts in between wait for review.</Hint>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {formData.format === "fixed" || formData.format === "both" ? (
                <div className="space-y-4">
                  <label className="flex items-center gap-2 text-[14px] font-medium text-[#0f1c3f]">
                    <input
                      type="checkbox"
                      checked={formData.use_variations}
                      onChange={(e) => updateField("use_variations", e.target.checked)}
                      className="h-4 w-4 rounded border-[#d8dee8] text-[#13948e]"
                    />
                    Variations
                  </label>
                  <Hint>Turn on to add Size and Color options with a unique price, quantity, and SKU for each combination.</Hint>
                  {formData.use_variations ? (
                  <>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">Option 1: Size</label>
                      <input
                        type="text"
                        value={formData.size_options}
                        onChange={(e) => updateField("size_options", e.target.value)}
                        placeholder="S, M, L"
                        className={field}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">Option 2: Color</label>
                      <input
                        type="text"
                        value={formData.color_options}
                        onChange={(e) => updateField("color_options", e.target.value)}
                        placeholder="Black, White"
                        className={field}
                      />
                    </div>
                  </div>
                  {formData.color_options.split(",").map((s) => s.trim()).filter(Boolean).length ? (
                    <div>
                      <p className="mb-2 text-[13.5px] font-semibold text-[#0f1c3f]">Color photos</p>
                      <Hint>Each color can have its own photo. Buyers see it when they pick that variation.</Hint>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        {formData.color_options.split(",").map((s) => s.trim()).filter(Boolean).map((color) => (
                          <label key={color} className="rounded-2xl border border-[#e4eaf2] px-3 py-2 text-[13px] font-medium text-[#0f1c3f]">
                            {color}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="mt-1 block w-full text-[12px] font-normal"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                setColorPhotos((current) => {
                                  const next = { ...current };
                                  if (file) next[color] = file;
                                  else delete next[color];
                                  return next;
                                });
                              }}
                            />
                            {colorPhotos[color] ? (
                              <span className="mt-1 block text-[12px] font-normal text-[#16a34a]">{colorPhotos[color].name}</span>
                            ) : null}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <VariationMatrix
                    axes={variationAxes}
                    rows={skuRows}
                    onChange={setSkuRows}
                    defaultPrice={formData.price}
                  />
                  </>
                  ) : null}
                </div>
              ) : null}

              {(formData.format === "auction" || formData.format === "both") && (
                <div className="space-y-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">
                        Starting price (NPR) <span className="text-[#e11d48]">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="1"
                        value={formData.auction_start_price}
                        onChange={(e) => updateField("auction_start_price", e.target.value)}
                        className={field}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">Reserve price (NPR)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.auction_reserve_price}
                        onChange={(e) => updateField("auction_reserve_price", e.target.value)}
                        className={field}
                      />
                      <Hint>Optional. Buyers never see this amount — only whether the reserve is met.</Hint>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">
                      Duration <span className="text-[#e11d48]">*</span>
                    </label>
                    <select
                      value={formData.auction_duration}
                      onChange={(e) => updateField("auction_duration", e.target.value)}
                      className={field}
                    >
                      <option value="72">3 days</option>
                      <option value="120">5 days</option>
                      <option value="168">7 days</option>
                      <option value="240">10 days</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-[#d8dee8] bg-white px-5 text-[14.5px] font-semibold text-[#0f3d4c] hover:bg-[#f7fafc]"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => validateStep2() && setStep(3)}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#0f3d4c] px-6 text-[14.5px] font-semibold text-white sm:max-w-[420px]"
                >
                  Continue to photos & publish
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">Photos (up to 12)</label>
                <Hint>Drop up to 12 photos at once, drag to reorder, and choose the primary image. Only JPEG, PNG, and WebP under 10MB are accepted.</Hint>
                <ListingPhotoGrid
                  photos={photos}
                  onChange={setPhotos}
                  onError={setError}
                  disabled={loading || uploadingPhotos}
                />

                {photos.length === 0 && (
                  <p className="mt-2 text-sm text-yellow-600">
                    ⚠️ Listings with photos get 5x more views!
                  </p>
                )}
                
                {photos.length > 0 && (
                  <div className="mt-4 rounded-xl border border-[#cfe0ff] bg-[#eef3ff] p-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={removeBackground}
                        onChange={(e) => setRemoveBackground(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm font-medium text-[#333]">
                        Remove background from photos (recommended for products)
                      </span>
                    </label>
                    <p className="mt-1 text-xs text-[#6b7587]">
                      Automatically removes white backgrounds to make your products stand out.
                      Works best with items photographed on plain backgrounds.
                    </p>
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-[14px] font-medium text-[#0f1c3f]">
                <input
                  type="checkbox"
                  checked={formData.shipping_free}
                  onChange={(e) => updateField("shipping_free", e.target.checked)}
                  className="h-4 w-4 rounded border-[#d8dee8] text-[#13948e]"
                />
                Free shipping
              </label>

              {!formData.shipping_free && (
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">Shipping cost (NPR)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.shipping_cost}
                      onChange={(e) => updateField("shipping_cost", e.target.value)}
                      className={field}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">Additional item shipping (NPR)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.shipping_additional}
                      onChange={(e) => updateField("shipping_additional", e.target.value)}
                      placeholder="Combined shipping add-on"
                      className={field}
                    />
                    <Hint>Charged for extra items from you in the same cart. Defaults to half the first-item rate.</Hint>
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">Item location</label>
                    <input
                      type="text"
                      value={formData.item_location}
                      onChange={(e) => updateField("item_location", e.target.value)}
                      placeholder="e.g. Kathmandu, Nepal"
                      className={field}
                    />
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-[14px] font-medium text-[#0f1c3f]">
                <input
                  type="checkbox"
                  checked={formData.publish_immediately}
                  onChange={(e) => updateField("publish_immediately", e.target.checked)}
                  className="h-4 w-4 rounded border-[#d8dee8] text-[#13948e]"
                />
                Publish immediately
              </label>
              <Hint>
                {formData.publish_immediately
                  ? "Your listing will go live as soon as you publish."
                  : "Your listing is not public until you publish it."}
              </Hint>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-[#d8dee8] bg-white px-5 text-[14.5px] font-semibold text-[#0f3d4c] hover:bg-[#f7fafc]"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || uploadingPhotos}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#0f3d4c] px-6 text-[14.5px] font-semibold text-white disabled:opacity-50 sm:max-w-[420px]"
                >
                  {uploadingPhotos
                    ? "Uploading photos..."
                    : loading
                      ? "Creating..."
                      : formData.publish_immediately
                        ? "Publish listing"
                        : "Save draft"}
                </button>
              </div>
            </div>
          )}
        </form>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[12.5px] text-[#8a94a6]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" />
            <circle cx="12" cy="10" r="2.2" />
          </svg>
          Your listing is not public until you publish it.
        </p>
      </div>
      <SiteFooter />
    </div>
  );
}
