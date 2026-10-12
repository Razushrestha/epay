"use client";

import { useState, useEffect, type ReactNode } from "react";
import { accountApi, apiBase } from "@/lib/account-api";
import { useRouter } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";

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
}

interface Photo {
  id?: number;
  url?: string;
  thumbnail_url?: string;
  file?: File;
  preview: string;
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
    shipping_international: false,
    shipping_international_cost: "",
    item_location: "",
    sku: "",
    upc: "",
    size_options: "",
    color_options: "",
    publish_immediately: false,
  });

  useEffect(() => {
    loadFormData();
  }, []);

  async function loadFormData() {
    try {
      // Load categories (level 1 for now - can add cascading later)
      const catRes = await fetch(`${apiBase}/api/v1/catalog/categories?level=1`);
      const catData = await catRes.json();
      setCategories(catData.categories || []);

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

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPhotos: Photo[] = [];
    
    for (let i = 0; i < Math.min(files.length, 12 - photos.length); i++) {
      const file = files[i];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError(`${file.name} is not an image file`);
        continue;
      }

      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} is too large. Maximum size is 10MB`);
        continue;
      }

      // Create preview
      const preview = URL.createObjectURL(file);
      newPhotos.push({ file, preview });
    }

    setPhotos([...photos, ...newPhotos]);
  }

  function removePhoto(index: number) {
    const newPhotos = [...photos];
    // Revoke preview URL to free memory
    if (newPhotos[index].preview) {
      URL.revokeObjectURL(newPhotos[index].preview);
    }
    newPhotos.splice(index, 1);
    setPhotos(newPhotos);
  }

  async function uploadPhotos(listingId: number) {
    const pending = photos.filter((photo) => photo.file);
    if (pending.length === 0) return true;

    setUploadingPhotos(true);
    const token = accountApi.getToken();
    let failed = false;

    for (const photo of pending) {
      try {
        const formData = new FormData();
        formData.append("photo", photo.file as File);
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
      } catch (err: unknown) {
        failed = true;
        const message = err instanceof Error ? err.message : "Upload failed";
        console.error("Photo upload error:", err);
        setError(`Failed to upload ${photo.file?.name ?? "photo"}: ${message}`);
      }
    }

    setUploadingPhotos(false);
    return !failed;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        const payload = {
          ...formData,
          category_id: parseInt(formData.category_id),
          brand_id: formData.brand_id ? parseInt(formData.brand_id) : null,
          condition_id: formData.condition_id ? parseInt(formData.condition_id) : null,
          price: formData.price ? parseFloat(formData.price) : null,
          quantity: parseInt(formData.quantity),
          auction_start_price: formData.auction_start_price ? parseFloat(formData.auction_start_price) : null,
          auction_reserve_price: formData.auction_reserve_price ? parseFloat(formData.auction_reserve_price) : null,
          auction_duration: parseInt(formData.auction_duration),
          auto_accept_price: formData.auto_accept_price ? parseFloat(formData.auto_accept_price) : null,
          auto_decline_price: formData.auto_decline_price ? parseFloat(formData.auto_decline_price) : null,
          shipping_cost: formData.shipping_cost ? parseFloat(formData.shipping_cost) : null,
          shipping_international_cost: formData.shipping_international_cost
            ? parseFloat(formData.shipping_international_cost)
            : null,
          variations: [
            formData.size_options
              ? { name: "Size", options: formData.size_options.split(",").map((s) => s.trim()).filter(Boolean) }
              : null,
            formData.color_options
              ? { name: "Color", options: formData.color_options.split(",").map((s) => s.trim()).filter(Boolean) }
              : null,
          ].filter(Boolean),
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
    if (!formData.category_id || !formData.title.trim() || !formData.description.trim() || !formData.condition_id) {
      setError("Fill in category, title, description, and condition first.");
      return false;
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

  return (
    <div className="min-h-screen bg-[#f3f6fa] py-8">
      <div className="page-shell mx-auto max-w-[920px]">
        {error && (
          <div className="mb-5 rounded-2xl border border-[#f5c2c7] bg-[#fff5f5] px-4 py-3 text-[14px] text-[#e53238]">
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
                <span className={`truncate text-[13px] font-semibold sm:text-[14.5px] ${active || done ? "text-[#0f3d4c]" : "text-[#8a94a6]"}`}>
                  {item.label}
                </span>
                {i < steps.length - 1 ? (
                  <span className={`ml-1 h-px min-w-[24px] flex-1 ${done ? "bg-[#13948e]" : "bg-[#d8dee8]"}`} />
                ) : null}
              </li>
            );
          })}
        </ol>

        <form onSubmit={handleSubmit} className="rounded-[28px] border border-[#e8eef6] bg-white p-5 shadow-[0_18px_50px_-32px_rgba(15,40,80,0.35)] sm:p-8">
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
                  <label className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">
                    Brand <span className="text-[#e11d48]">*</span>
                  </label>
                  <select
                    value={formData.brand_id}
                    onChange={(e) => updateField("brand_id", e.target.value)}
                    className={field}
                  >
                    <option value="">No brand</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#d8dee8] bg-white px-5 text-[14.5px] font-semibold text-[#0f3d4c] hover:bg-[#f7fafc] disabled:opacity-60"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d="M7 3h8l5 5v13H7V3Z" />
                    <path d="M15 3v6h6M9 13h6M9 17h6" />
                  </svg>
                  Save draft
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
                      Price (NPR) <span className="text-[#e11d48]">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => updateField("price", e.target.value)}
                      className={field}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.quantity}
                      onChange={(e) => updateField("quantity", e.target.value)}
                      className={field}
                    />
                  </div>
                </div>
              )}

              {formData.format === "fixed" ? (
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">Sizes (optional)</label>
                    <input
                      type="text"
                      value={formData.size_options}
                      onChange={(e) => updateField("size_options", e.target.value)}
                      placeholder="S, M, L, XL"
                      className={field}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">Colors (optional)</label>
                    <input
                      type="text"
                      value={formData.color_options}
                      onChange={(e) => updateField("color_options", e.target.value)}
                      placeholder="Black, White"
                      className={field}
                    />
                  </div>
                </div>
              ) : null}

              {(formData.format === "auction" || formData.format === "both") && (
                <div className="space-y-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">
                        Starting bid (NPR) <span className="text-[#e11d48]">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
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
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13.5px] font-semibold text-[#0f1c3f]">Duration</label>
                    <select
                      value={formData.auction_duration}
                      onChange={(e) => updateField("auction_duration", e.target.value)}
                      className={field}
                    >
                      <option value="24">1 day</option>
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
                  onClick={() => setStep(3)}
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
                <Hint>Add photos to showcase your item. The first photo is the primary image.</Hint>
                
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {/* Photo Grid */}
                  {photos.map((photo, index) => (
                    <div key={index} className="relative aspect-square group">
                      <img
                        src={photo.preview}
                        alt={`Photo ${index + 1}`}
                        className="h-full w-full rounded-lg border-2 border-[#e7e7e7] object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1.5 text-white opacity-0 shadow-lg transition-opacity hover:bg-red-600 group-hover:opacity-100"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      {index === 0 && (
                        <div className="absolute bottom-2 left-2 rounded bg-[#0f1c3f] px-2 py-1 text-xs text-white">
                          Primary
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add Photo Button */}
                  {photos.length < 12 && (
                    <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#e7e7e7] bg-[#f7f7f7] hover:border-[#3665f3] hover:bg-[#eef3ff]">
                      <svg className="h-8 w-8 text-[#707070]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="mt-2 text-sm text-[#707070]">Add Photo</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        multiple
                        onChange={handlePhotoSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

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
                    <p className="mt-1 text-xs text-[#707070]">
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
