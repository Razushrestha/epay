"use client";

import { useState, useEffect } from "react";
import { accountApi } from "@/lib/account-api";
import { useRouter } from "next/navigation";

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
    publish_immediately: false,
  });

  useEffect(() => {
    loadFormData();
  }, []);

  async function loadFormData() {
    try {
      // Load categories (level 1 for now - can add cascading later)
      const catRes = await fetch("http://localhost:4000/api/v1/catalog/categories?level=1");
      const catData = await catRes.json();
      setCategories(catData.categories || []);

      // Load conditions
      const condRes = await fetch("http://localhost:4000/api/v1/catalog/conditions");
      const condData = await condRes.json();
      setConditions(condData.conditions || []);

      // Load brands
      const brandRes = await fetch("http://localhost:4000/api/v1/catalog/brands?limit=100");
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
    if (photos.length === 0) return;

    setUploadingPhotos(true);
    const token = accountApi.getToken();

    for (const photo of photos) {
      if (!photo.file) continue;

      try {
        const formData = new FormData();
        formData.append('photo', photo.file);
        
        // Add background removal flag if enabled
        if (removeBackground) {
          formData.append('removeBackground', 'true');
        }

        const res = await fetch(`http://localhost:4000/api/v1/listings/${listingId}/photos/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Upload failed');
        }
        
        const data = await res.json();
        console.log('Photo uploaded:', data.backgroundRemoved ? 'with background removed' : 'original');
        
      } catch (err: any) {
        console.error('Photo upload error:', err);
        setError(`Failed to upload ${photo.file.name}: ${err.message}`);
      }
    }

    setUploadingPhotos(false);
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
      };

      const res = await fetch("http://localhost:4000/api/v1/listings", {
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
      const listingId = data.listing.id;
      setCreatedListingId(listingId);

      // Upload photos if any
      if (photos.length > 0) {
        await uploadPhotos(listingId);
      }

      if (formData.publish_immediately) {
        alert("Listing created and published!");
        router.push(`/listing/${listingId}`);
      } else {
        alert("Listing saved as draft!");
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

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create Listing</h1>
          <p className="mt-2 text-gray-600">Sell your item on Nexlo</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-800">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Progress indicator */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex flex-1 items-center">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${step >= 1 ? "bg-blue-600 text-white" : "bg-gray-300"}`}>
              1
            </div>
            <div className={`h-1 flex-1 ${step >= 2 ? "bg-blue-600" : "bg-gray-300"}`} />
          </div>
          <div className="flex flex-1 items-center">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${step >= 2 ? "bg-blue-600 text-white" : "bg-gray-300"}`}>
              2
            </div>
            <div className={`h-1 flex-1 ${step >= 3 ? "bg-blue-600" : "bg-gray-300"}`} />
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${step >= 3 ? "bg-blue-600 text-white" : "bg-gray-300"}`}>
            3
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-lg bg-white p-8 shadow">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Basic Information</h2>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Category *</label>
                <select
                  required
                  value={formData.category_id}
                  onChange={(e) => updateField("category_id", e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2"
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Title *</label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={formData.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder="e.g., iPhone 14 Pro Max 256GB - Space Black"
                  className="w-full rounded border border-gray-300 px-3 py-2"
                />
                <p className="mt-1 text-sm text-gray-500">{formData.title.length}/80 characters</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Subtitle</label>
                <input
                  type="text"
                  maxLength={55}
                  value={formData.subtitle}
                  onChange={(e) => updateField("subtitle", e.target.value)}
                  placeholder="Optional subtitle for extra details"
                  className="w-full rounded border border-gray-300 px-3 py-2"
                />
                <p className="mt-1 text-sm text-gray-500">{formData.subtitle.length}/55 characters</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description *</label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  rows={8}
                  placeholder="Describe your item in detail..."
                  className="w-full rounded border border-gray-300 px-3 py-2"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Condition *</label>
                  <select
                    required
                    value={formData.condition_id}
                    onChange={(e) => updateField("condition_id", e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2"
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
                  <label className="mb-1 block text-sm font-medium text-gray-700">Brand</label>
                  <select
                    value={formData.brand_id}
                    onChange={(e) => updateField("brand_id", e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2"
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

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full rounded-lg bg-blue-600 py-3 text-white hover:bg-blue-700"
              >
                Next: Pricing & Format
              </button>
            </div>
          )}

          {/* Step 2: Pricing & Format */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Pricing & Format</h2>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Listing Format *</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="format"
                      value="fixed"
                      checked={formData.format === "fixed"}
                      onChange={(e) => updateField("format", e.target.value)}
                      className="rounded"
                    />
                    <span>Fixed Price (Buy It Now)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="format"
                      value="auction"
                      checked={formData.format === "auction"}
                      onChange={(e) => updateField("format", e.target.value)}
                      className="rounded"
                    />
                    <span>Auction</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="format"
                      value="both"
                      checked={formData.format === "both"}
                      onChange={(e) => updateField("format", e.target.value)}
                      className="rounded"
                    />
                    <span>Auction with Buy It Now</span>
                  </label>
                </div>
              </div>

              {(formData.format === "fixed" || formData.format === "both") && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Price (NPR) *</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => updateField("price", e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.quantity}
                      onChange={(e) => updateField("quantity", e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2"
                    />
                  </div>
                </div>
              )}

              {(formData.format === "auction" || formData.format === "both") && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Starting Bid (NPR) *</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        value={formData.auction_start_price}
                        onChange={(e) => updateField("auction_start_price", e.target.value)}
                        className="w-full rounded border border-gray-300 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Reserve Price (NPR)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.auction_reserve_price}
                        onChange={(e) => updateField("auction_reserve_price", e.target.value)}
                        className="w-full rounded border border-gray-300 px-3 py-2"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Duration</label>
                    <select
                      value={formData.auction_duration}
                      onChange={(e) => updateField("auction_duration", e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2"
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

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-lg border border-gray-300 bg-white py-3 text-gray-700 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex-1 rounded-lg bg-blue-600 py-3 text-white hover:bg-blue-700"
                >
                  Next: Shipping
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Photos & Shipping */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Photos & Shipping</h2>

              {/* Photo Upload */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Photos (up to 12)
                </label>
                <p className="mb-3 text-sm text-gray-500">
                  Add photos to showcase your item. First photo will be the primary image.
                </p>
                
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {/* Photo Grid */}
                  {photos.map((photo, index) => (
                    <div key={index} className="relative aspect-square group">
                      <img
                        src={photo.preview}
                        alt={`Photo ${index + 1}`}
                        className="h-full w-full rounded-lg border-2 border-gray-300 object-cover"
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
                        <div className="absolute bottom-2 left-2 rounded bg-blue-600 px-2 py-1 text-xs text-white">
                          Primary
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add Photo Button */}
                  {photos.length < 12 && (
                    <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:border-blue-500 hover:bg-blue-50">
                      <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="mt-2 text-sm text-gray-500">Add Photo</span>
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
                  <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={removeBackground}
                        onChange={(e) => setRemoveBackground(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Remove background from photos (recommended for products)
                      </span>
                    </label>
                    <p className="mt-1 text-xs text-gray-600">
                      Automatically removes white backgrounds to make your products stand out.
                      Works best with items photographed on plain backgrounds.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.shipping_free}
                    onChange={(e) => updateField("shipping_free", e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Free Shipping</span>
                </label>
              </div>

              {!formData.shipping_free && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Shipping Cost (NPR)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.shipping_cost}
                      onChange={(e) => updateField("shipping_cost", e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Item Location</label>
                    <input
                      type="text"
                      value={formData.item_location}
                      onChange={(e) => updateField("item_location", e.target.value)}
                      placeholder="e.g., Kathmandu, Nepal"
                      className="w-full rounded border border-gray-300 px-3 py-2"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.publish_immediately}
                    onChange={(e) => updateField("publish_immediately", e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Publish Immediately</span>
                </label>
                <p className="mt-1 text-sm text-gray-500">
                  {formData.publish_immediately
                    ? "Your listing will go live immediately"
                    : "Your listing will be saved as a draft"}
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 rounded-lg border border-gray-300 bg-white py-3 text-gray-700 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || uploadingPhotos}
                  className="flex-1 rounded-lg bg-blue-600 py-3 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploadingPhotos 
                    ? "Uploading photos..." 
                    : loading 
                    ? "Creating..." 
                    : formData.publish_immediately 
                    ? "Publish Listing" 
                    : "Save Draft"}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
