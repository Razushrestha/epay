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

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="border-b border-[#eef2f7] pb-8 last:border-b-0 last:pb-0">
      <div className="mb-5 flex items-start gap-3">
        <span aria-hidden className="mt-1 h-6 w-1 shrink-0 rounded-full bg-[#13948e]" />
        <div>
          <h2 className="text-[17px] font-extrabold leading-7 text-[#0f1c3f]">{title}</h2>
          {sub ? <p className="text-[13px] leading-snug text-[#6b7587]">{sub}</p> : null}
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function FieldLabel({ children, required, optional, help, htmlFor }: { children: ReactNode; required?: boolean; optional?: boolean; help?: string; htmlFor?: string }) {
  return (
    <div className="mb-2">
      <label htmlFor={htmlFor} className="block text-[14px] font-semibold text-[#0f1c3f]">
        {children}
        {required ? <span className="text-[#e11d48]"> *</span> : null}
        {optional ? <span className="font-normal text-[#8a94a6]"> (optional)</span> : null}
      </label>
      {help ? <p className="mt-0.5 text-[12.5px] leading-snug text-[#8a94a6]">{help}</p> : null}
    </div>
  );
}

function MoneyInput({
  id,
  value,
  onChange,
  placeholder,
  min = "0",
  required,
  className,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  required?: boolean;
  className: string;
  invalid?: boolean;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-[#6b7587]">NPR</span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step="0.01"
        min={min}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${className} pl-14 ${invalid ? "border-[#e53238] focus:border-[#e53238] focus:ring-[#e53238]/15" : ""}`}
      />
    </div>
  );
}

function Toggle({ checked, onChange, label, help }: { checked: boolean; onChange: (next: boolean) => void; label: string; help?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[14px] font-semibold text-[#0f1c3f]">{label}</p>
        {help ? <p className="mt-0.5 text-[12.5px] leading-snug text-[#8a94a6]">{help}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full outline-none transition focus-visible:ring-4 focus-visible:ring-[#13948e]/20 ${checked ? "bg-[#13948e]" : "bg-[#cbd5e3]"}`}
      >
        <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
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
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [customDuration, setCustomDuration] = useState(false);
  const [customDays, setCustomDays] = useState("0");
  const [customHours, setCustomHours] = useState("12");
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
    shipping_free: true,
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

  // Some categories have their own condition scale (e.g. coin grades), so reload it per category.
  useEffect(() => {
    if (!sellerOk) return;
    const query = formData.category_id ? `?category_id=${encodeURIComponent(formData.category_id)}` : "";
    let cancelled = false;
    fetch(`${apiBase}/api/v1/catalog/conditions${query}`)
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        const list: Condition[] = body.conditions || [];
        setConditions(list);
        setFormData((current) =>
          current.condition_id && !list.some((cond) => String(cond.id) === current.condition_id)
            ? { ...current, condition_id: "" }
            : current,
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [formData.category_id, sellerOk]);

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
      const hours = Number(formData.auction_duration);
      if (!Number.isInteger(hours) || hours < 1 || hours > 720) {
        setError("Choose an auction length between 1 hour and 30 days.");
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

  const shortName = (c: Category) => c.name.split(" › ").pop() || c.name;
  const catById = new Map(categories.map((c) => [c.id, c]));
  const catPath: Category[] = [];
  for (let c = formData.category_id ? catById.get(Number(formData.category_id)) : undefined; c; c = c.parent_id != null ? catById.get(c.parent_id) : undefined) {
    catPath.unshift(c);
  }
  const catRows: { label: string; options: Category[]; selectedId: number | null }[] = [
    { label: "Category", options: categories.filter((c) => c.parent_id == null), selectedId: catPath[0]?.id ?? null },
  ];
  catPath.forEach((node, i) => {
    const kids = categories.filter((c) => c.parent_id === node.id);
    if (kids.length) catRows.push({ label: `More specific: ${shortName(node)}`, options: kids, selectedId: catPath[i + 1]?.id ?? null });
  });
  const chip = (on: boolean) =>
    `rounded-full border px-4 py-2.5 text-[14px] font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[#13948e]/20 ${
      on ? "border-[#0f3d4c] bg-[#0f3d4c] text-white shadow-sm" : "border-[#dbe3ee] bg-white text-[#3a4a66] hover:border-[#13948e] hover:text-[#0f3d4c]"
    }`;

  const startN = Number(formData.auction_start_price);
  const binN = Number(formData.price);
  const reserveN = Number(formData.auction_reserve_price);
  const binTooLow =
    formData.format === "both" && formData.auction_start_price !== "" && formData.price !== "" && Number.isFinite(startN) && Number.isFinite(binN) && binN <= startN;
  const reserveTooLow =
    formData.auction_reserve_price !== "" && formData.auction_start_price !== "" && Number.isFinite(reserveN) && Number.isFinite(startN) && reserveN < startN;
  const isFixed = formData.format === "fixed" || formData.format === "both";
  const isAuction = formData.format === "auction" || formData.format === "both";
  const advancedOn = Boolean(formData.compare_at || formData.allow_best_offer || formData.use_variations || formData.auction_reserve_price);
  const moreOpen = showMore || advancedOn;
  const npr = (v: string) => `NPR ${Number(v).toLocaleString("en-NP")}`;
  const fmtDuration = (h: number) => {
    if (!Number.isFinite(h) || h < 1) return "not set";
    if (h < 24) return `${h} hour${h === 1 ? "" : "s"}`;
    const d = Math.floor(h / 24);
    const r = h % 24;
    return `${d} day${d === 1 ? "" : "s"}${r ? ` ${r} hour${r === 1 ? "" : "s"}` : ""}`;
  };
  const durationLabel = fmtDuration(Number(formData.auction_duration));
  const applyCustomDuration = (days: string, hours: string) => {
    setCustomDays(days);
    setCustomHours(hours);
    const total = (parseInt(days, 10) || 0) * 24 + (parseInt(hours, 10) || 0);
    updateField("auction_duration", String(total));
  };
  const priceSummary = (() => {
    const parts: string[] = [];
    if (isAuction && formData.auction_start_price && startN > 0) parts.push(`Bidding starts at ${npr(formData.auction_start_price)}`);
    if (isFixed && formData.price && binN > 0) parts.push(formData.format === "both" ? `Buy Now ${npr(formData.price)}` : npr(formData.price));
    if (isAuction && parts.length) parts.push(`ends in ${durationLabel}`);
    if (formData.format === "fixed" && parts.length && Number(formData.quantity) > 0) parts.push(`${formData.quantity} in stock`);
    return parts.join(" · ");
  })();

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
            <div className="space-y-8">
              <Section title="What are you selling?" sub="Pick a category, then give your item a clear title.">
                {catRows.map((row, idx) => (
                  <div key={idx}>
                    <FieldLabel required={idx === 0}>{row.label}</FieldLabel>
                    <div className="flex flex-wrap gap-2" role="group" aria-label={row.label}>
                      {row.options.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          aria-pressed={row.selectedId === c.id}
                          onClick={() => updateField("category_id", String(c.id))}
                          className={chip(row.selectedId === c.id)}
                        >
                          {shortName(c)}
                        </button>
                      ))}
                    </div>
                    {idx === 0 && !categories.length ? <p className="mt-2 text-[13px] text-[#8a94a6]">Loading categories…</p> : null}
                  </div>
                ))}

                <div>
                  <FieldLabel required htmlFor="sell-title" help="Include the key detail buyers search for: name, year, size, grade.">
                    Title
                  </FieldLabel>
                  <div className="relative">
                    <input
                      id="sell-title"
                      type="text"
                      required
                      maxLength={80}
                      value={formData.title}
                      onChange={(e) => updateField("title", e.target.value)}
                      placeholder="e.g. 1950 Nepal 1 Rupee Silver Coin, Extra Fine"
                      className={`${field} pr-16`}
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[12px] tabular-nums text-[#9aa3b2]">{formData.title.length}/80</span>
                  </div>
                </div>
              </Section>

              <Section title="Tell buyers about it" sub="Honest, detailed descriptions get more bids and fewer questions.">
                <div>
                  <FieldLabel required htmlFor="sell-desc" help="Features, condition, history, and what is included.">
                    Description
                  </FieldLabel>
                  <textarea
                    id="sell-desc"
                    required
                    maxLength={1000}
                    value={formData.description}
                    onChange={(e) => updateField("description", e.target.value)}
                    rows={6}
                    placeholder="Describe your item in detail..."
                    className={`${field} min-h-[150px] resize-y`}
                  />
                  <p className="mt-1.5 text-right text-[12px] tabular-nums text-[#9aa3b2]">{formData.description.length}/1000</p>
                </div>

                {showSubtitle || formData.subtitle ? (
                  <div>
                    <FieldLabel optional htmlFor="sell-subtitle" help="A short line shown under the title in search results.">
                      Subtitle
                    </FieldLabel>
                    <div className="relative">
                      <input
                        id="sell-subtitle"
                        type="text"
                        maxLength={55}
                        value={formData.subtitle}
                        onChange={(e) => updateField("subtitle", e.target.value)}
                        placeholder="e.g. Original box, certificate included"
                        className={`${field} pr-16`}
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[12px] tabular-nums text-[#9aa3b2]">{formData.subtitle.length}/55</span>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowSubtitle(true)} className="text-[13.5px] font-semibold text-[#13948e] hover:underline">
                    + Add a subtitle (optional)
                  </button>
                )}
              </Section>

              <Section title="Condition and brand" sub="Buyers filter by these, so choose carefully.">
                <div>
                  <FieldLabel required>Condition</FieldLabel>
                  {conditions.length ? (
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Condition">
                      {conditions.map((cond) => (
                        <button
                          key={cond.id}
                          type="button"
                          role="radio"
                          aria-checked={formData.condition_id === String(cond.id)}
                          onClick={() => updateField("condition_id", String(cond.id))}
                          className={chip(formData.condition_id === String(cond.id))}
                        >
                          {cond.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13px] text-[#8a94a6]">{formData.category_id ? "No conditions available for this category." : "Choose a category first to see conditions."}</p>
                  )}
                  {conditions.find((cond) => String(cond.id) === formData.condition_id)?.description ? (
                    <p className="mt-2 rounded-xl bg-[#f4f8ff] px-3.5 py-2.5 text-[12.5px] leading-snug text-[#4b5873]">
                      {conditions.find((cond) => String(cond.id) === formData.condition_id)?.description}
                    </p>
                  ) : null}
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

                <div className="max-w-[420px]">
                  <FieldLabel optional htmlFor="sell-brand">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      Brand
                      {brands.find((brand) => String(brand.id) === formData.brand_id)?.is_verified ? <AuthenticityBadge /> : null}
                    </span>
                  </FieldLabel>
                  <select id="sell-brand" value={formData.brand_id} onChange={(e) => updateField("brand_id", e.target.value)} className={field}>
                    <option value="">No brand</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.is_verified ? `${brand.name} · Authentic` : brand.name}
                      </option>
                    ))}
                  </select>
                </div>
              </Section>

              {specifics.length ? (
                <Section title="Item details" sub="Specifics for this category help buyers find your item.">
                                  <div>
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
                </Section>
              ) : null}

              <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-col-reverse gap-3 rounded-b-[28px] border-t border-[#e8eef6] bg-white/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:-mb-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => saveDraft()}
                  className="inline-flex h-12 items-center justify-center rounded-full border border-[#d8dee8] bg-white px-6 text-[14.5px] font-semibold text-[#0f3d4c] transition hover:bg-[#f7fafc] disabled:opacity-60"
                >
                  {loading ? "Saving…" : "Save as draft"}
                </button>
                <button
                  type="button"
                  onClick={() => validateStep1() && setStep(2)}
                  className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-[#0f3d4c] px-8 text-[15px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(15,61,76,0.7)] transition hover:bg-[#0c3240] sm:max-w-[360px]"
                >
                  Continue to pricing
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8">
              <Section title="How do you want to sell?" sub="Choose how buyers will purchase your item.">
                <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Listing format">
                  {[
                    ["fixed", "Fixed price", "Sell now at a price you set.", "Most popular"],
                    ["auction", "Auction", "Buyers bid, highest bid wins.", ""],
                    ["both", "Auction with Buy Now", "Buyers can bid or buy instantly.", ""],
                  ].map(([value, title, hint, tag]) => {
                    const on = formData.format === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => updateField("format", value)}
                        className={`rounded-2xl border-2 px-4 py-4 text-left transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[#13948e]/20 ${
                          on ? "border-[#13948e] bg-[#f2fbfa]" : "border-[#e4eaf2] bg-white hover:border-[#bfd9d7]"
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-[15px] font-bold text-[#0f1c3f]">{title}</span>
                          <span
                            aria-hidden
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-[#13948e]" : "border-[#cbd5e3]"}`}
                          >
                            {on ? <span className="h-2.5 w-2.5 rounded-full bg-[#13948e]" /> : null}
                          </span>
                        </span>
                        <span className="mt-1 block text-[13px] leading-snug text-[#6b7587]">{hint}</span>
                        {tag ? <span className="mt-2 inline-block rounded-full bg-[#e3f4f2] px-2.5 py-0.5 text-[11.5px] font-semibold text-[#0f6d68]">{tag}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </Section>

              <Section title="Set your price" sub={isAuction ? "Buyers place bids starting from your starting bid." : "The price buyers pay for this item."}>
                <div className="grid gap-5 md:grid-cols-2">
                  {isAuction ? (
                    <div>
                      <FieldLabel required htmlFor="sell-start" help="The lowest first bid. A low start attracts more bidders.">
                        Starting bid
                      </FieldLabel>
                      <MoneyInput
                        id="sell-start"
                        required
                        min="1"
                        value={formData.auction_start_price}
                        onChange={(v) => updateField("auction_start_price", v)}
                        placeholder="e.g. 200"
                        className={field}
                      />
                    </div>
                  ) : null}

                  {isFixed ? (
                    <div>
                      <FieldLabel
                        required={!formData.use_variations}
                        htmlFor="sell-price"
                        help={formData.use_variations ? "Default for new variation rows. Each combination can override it." : formData.format === "both" ? "Buyers can skip bidding and pay this price." : undefined}
                      >
                        {formData.format === "both" ? "Buy Now price" : "Price"}
                      </FieldLabel>
                      <MoneyInput
                        id="sell-price"
                        required={!formData.use_variations}
                        value={formData.price}
                        onChange={(v) => updateField("price", v)}
                        placeholder="e.g. 1000"
                        className={field}
                        invalid={binTooLow}
                      />
                      {binTooLow ? (
                        <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-[#e53238]">Buy Now must be higher than the starting bid.</p>
                      ) : null}
                    </div>
                  ) : null}

                  {isFixed ? (
                    <div>
                      <FieldLabel required htmlFor="sell-qty" help={skuRows.length ? "Default for new size and color rows. Total stock is the sum of the matrix below." : undefined}>
                        {skuRows.length ? "Default quantity per combination" : "Quantity in stock"}
                      </FieldLabel>
                      <input id="sell-qty" type="number" min="1" value={formData.quantity} onChange={(e) => updateField("quantity", e.target.value)} className={field} />
                    </div>
                  ) : null}
                </div>

                {isAuction ? (
                  <div>
                    <FieldLabel required help="How long buyers can bid. From 1 hour up to 30 days.">Auction length</FieldLabel>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Auction length">
                      {[
                        ["1", "1 hour"],
                        ["24", "1 day"],
                        ["48", "2 days"],
                        ["72", "3 days"],
                        ["120", "5 days"],
                        ["168", "7 days"],
                        ["240", "10 days"],
                      ].map(([value, label]) => {
                        const on = !customDuration && String(formData.auction_duration) === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => {
                              setCustomDuration(false);
                              updateField("auction_duration", value);
                            }}
                            className={chip(on)}
                          >
                            {label}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        role="radio"
                        aria-checked={customDuration}
                        onClick={() => {
                          setCustomDuration(true);
                          applyCustomDuration(customDays, customHours);
                        }}
                        className={chip(customDuration)}
                      >
                        Custom
                      </button>
                    </div>
                    {customDuration ? (
                      <div className="mt-3 flex flex-wrap items-end gap-4 rounded-2xl border border-[#e4eaf2] bg-[#f7fafc] p-4">
                        <div>
                          <label htmlFor="sell-days" className="mb-1.5 block text-[13px] font-semibold text-[#0f1c3f]">Days</label>
                          <input
                            id="sell-days"
                            type="number"
                            inputMode="numeric"
                            min="0"
                            max="30"
                            value={customDays}
                            onChange={(e) => applyCustomDuration(e.target.value, customHours)}
                            className={`${field} w-28`}
                          />
                        </div>
                        <div>
                          <label htmlFor="sell-hours" className="mb-1.5 block text-[13px] font-semibold text-[#0f1c3f]">Hours</label>
                          <input
                            id="sell-hours"
                            type="number"
                            inputMode="numeric"
                            min="0"
                            max="23"
                            value={customHours}
                            onChange={(e) => applyCustomDuration(customDays, e.target.value)}
                            className={`${field} w-28`}
                          />
                        </div>
                        <p className={`pb-3 text-[13.5px] ${Number(formData.auction_duration) >= 1 && Number(formData.auction_duration) <= 720 ? "text-[#3a4a66]" : "font-medium text-[#e53238]"}`}>
                          {Number(formData.auction_duration) >= 1 && Number(formData.auction_duration) <= 720
                            ? `Auction will run for ${durationLabel}.`
                            : "Choose between 1 hour and 30 days."}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {priceSummary ? (
                  <p className="rounded-xl bg-[#f4f8ff] px-4 py-3 text-[13.5px] text-[#3a4a66]">
                    <span className="font-semibold text-[#0f1c3f]">Buyers will see:</span> {priceSummary}
                  </p>
                ) : null}
              </Section>

              <section>
                <button
                  type="button"
                  aria-expanded={moreOpen}
                  onClick={() => setShowMore((v) => !v)}
                  className="flex w-full items-center justify-between rounded-2xl border border-[#e4eaf2] bg-[#fafcff] px-5 py-4 text-left transition hover:border-[#cfdbec]"
                >
                  <span>
                    <span className="block text-[15px] font-bold text-[#0f1c3f]">More options</span>
                    <span className="block text-[12.5px] text-[#6b7587]">
                      {formData.format === "fixed"
                        ? "Was price, Best Offer, variations."
                        : formData.format === "auction"
                          ? "Reserve price."
                          : "Was price, Best Offer, variations, reserve price."}{" "}
                      Most sellers skip these.
                    </span>
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7587" strokeWidth="2.2" className={`shrink-0 transition-transform ${moreOpen ? "rotate-180" : ""}`} aria-hidden>
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {moreOpen ? (
                  <div className="mt-5 space-y-6 px-1">
                    {isAuction ? (
                      <div className="max-w-[420px]">
                        <FieldLabel optional htmlFor="sell-reserve" help="Buyers never see this amount, only whether the reserve is met.">
                          Reserve price
                        </FieldLabel>
                        <MoneyInput
                          id="sell-reserve"
                          value={formData.auction_reserve_price}
                          onChange={(v) => updateField("auction_reserve_price", v)}
                          placeholder="Minimum price you will accept"
                          className={field}
                          invalid={reserveTooLow}
                        />
                        {reserveTooLow ? (
                          <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-[#e53238]">Reserve must be at least the starting bid.</p>
                        ) : null}
                      </div>
                    ) : null}

                    {isFixed ? (
                      <>
                        <div className="max-w-[420px]">
                          <FieldLabel optional htmlFor="sell-was" help="If higher than your price, the listing can appear in Today's Deals.">
                            Was price
                          </FieldLabel>
                          <MoneyInput id="sell-was" value={formData.compare_at} onChange={(v) => updateField("compare_at", v)} placeholder="Original price" className={field} />
                        </div>

                        <div className="space-y-4 rounded-2xl border border-[#e4eaf2] bg-white p-4">
                          <Toggle
                            checked={formData.allow_best_offer}
                            onChange={(next) => updateField("allow_best_offer", next)}
                            label="Allow Best Offer"
                            help="Let buyers send you offers below your price."
                          />
                          {formData.allow_best_offer ? (
                            <div className="grid gap-5 border-t border-[#eef2f7] pt-4 md:grid-cols-2">
                              <div>
                                <FieldLabel optional htmlFor="sell-accept" help="Offers at or above this are accepted instantly.">
                                  Auto-accept at
                                </FieldLabel>
                                <MoneyInput id="sell-accept" value={formData.auto_accept_price} onChange={(v) => updateField("auto_accept_price", v)} placeholder="e.g. 900" className={field} />
                              </div>
                              <div>
                                <FieldLabel optional htmlFor="sell-decline" help="Offers below this are declined instantly. Others wait for you.">
                                  Auto-decline below
                                </FieldLabel>
                                <MoneyInput id="sell-decline" value={formData.auto_decline_price} onChange={(v) => updateField("auto_decline_price", v)} placeholder="e.g. 700" className={field} />
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="space-y-4 rounded-2xl border border-[#e4eaf2] bg-white p-4">
                          <Toggle
                            checked={formData.use_variations}
                            onChange={(next) => updateField("use_variations", next)}
                            label="This item has variations"
                            help="Add Size and Color options, each with its own price, quantity and SKU."
                          />
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
                      </>
                    ) : null}
                  </div>
                ) : null}
              </section>

              <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-col-reverse gap-3 rounded-b-[28px] border-t border-[#e8eef6] bg-white/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:-mb-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex h-12 items-center justify-center rounded-full border border-[#d8dee8] bg-white px-6 text-[14.5px] font-semibold text-[#0f3d4c] transition hover:bg-[#f7fafc]"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => validateStep2() && setStep(3)}
                  className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-[#0f3d4c] px-8 text-[15px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(15,61,76,0.7)] transition hover:bg-[#0c3240] sm:max-w-[360px]"
                >
                  Continue to photos
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

              <div className="rounded-2xl border border-[#e4eaf2] bg-[#f7fafc] px-4 py-3.5">
                <p className="text-[14px] font-semibold text-[#0f1c3f]">Free shipping</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-[#6b7587]">
                  Every listing currently ships free to the buyer, so there is no shipping cost to set.
                </p>
              </div>

              <div>
                <label htmlFor="sell-location" className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">
                  Item location
                </label>
                <input
                  id="sell-location"
                  type="text"
                  value={formData.item_location}
                  onChange={(e) => updateField("item_location", e.target.value)}
                  placeholder="e.g. Kathmandu, Nepal"
                  className={field}
                />
              </div>

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
