"use client";

import { useState, useEffect } from "react";
import { accountApi, apiBase } from "@/lib/account-api";
import { Empty, StatusPill } from "@/components/admin/admin-ui";

interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  level: number;
  icon: string;
  image_url: string | null;
  description: string | null;
  item_count: number;
  is_restricted: boolean;
  requires_approval: boolean;
  is_active: boolean;
  sort_order: number;
  child_count: number;
}

interface Brand {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  website: string | null;
  is_verified: boolean;
  listing_count: number;
}

interface Condition {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
}

export default function CatalogAdminPage() {
  const [view, setView] = useState<"categories" | "brands" | "conditions">("categories");
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Category form
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    slug: "",
    parent_id: null as number | null,
    level: 1,
    icon: "",
    description: "",
    is_restricted: false,
    requires_approval: false,
  });

  // Brand form
  const [showBrandForm, setShowBrandForm] = useState(false);
  const [brandForm, setBrandForm] = useState({
    name: "",
    slug: "",
    logo_url: "",
    description: "",
    website: "",
    is_verified: false,
  });

  useEffect(() => {
    loadData();
  }, [view]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      if (view === "categories") {
        const res = await fetch(`${apiBase}/api/v1/catalog/categories`);
        const data = await res.json();
        setCategories(data.categories || []);
      } else if (view === "brands") {
        const res = await fetch(`${apiBase}/api/v1/catalog/brands`);
        const data = await res.json();
        setBrands(data.brands || []);
      } else if (view === "conditions") {
        const res = await fetch(`${apiBase}/api/v1/catalog/conditions`);
        const data = await res.json();
        setConditions(data.conditions || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const token = accountApi.getToken();
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(`${apiBase}/api/v1/catalog/admin/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(categoryForm),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create category");
      }

      setShowCategoryForm(false);
      setCategoryForm({
        name: "",
        slug: "",
        parent_id: null,
        level: 1,
        icon: "",
        description: "",
        is_restricted: false,
        requires_approval: false,
      });
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleCreateBrand(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const token = accountApi.getToken();
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(`${apiBase}/api/v1/catalog/admin/brands`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(brandForm),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create brand");
      }

      setShowBrandForm(false);
      setBrandForm({
        name: "",
        slug: "",
        logo_url: "",
        description: "",
        website: "",
        is_verified: false,
      });
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleToggleCategoryActive(categoryId: number, isActive: boolean) {
    try {
      const token = accountApi.getToken();
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(`${apiBase}/api/v1/catalog/admin/categories/${categoryId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !isActive }),
      });

      if (!res.ok) throw new Error("Failed to update category");
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDeleteCategory(categoryId: number) {
    if (!confirm("Are you sure you want to delete this category?")) return;

    try {
      const token = accountApi.getToken();
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(`${apiBase}/api/v1/catalog/admin/categories/${categoryId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete category");
      }

      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDeleteBrand(brandId: number) {
    if (!confirm("Are you sure you want to delete this brand?")) return;

    try {
      const token = accountApi.getToken();
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(`${apiBase}/api/v1/catalog/admin/brands/${brandId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Failed to delete brand");
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-[#0f1c3f]">Catalog</h1>
        <p className="mt-1 text-[14px] text-[#6b7587]">Categories, brands, and item conditions used on every listing.</p>
      </div>

      {error ? <p className="nexlo-alert nexlo-alert-error">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {(["categories", "brands", "conditions"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold capitalize ${
              view === id ? "bg-[#3665f3] text-white" : "border border-[#e7eef6] bg-white text-[#3a4a66]"
            }`}
          >
            {id}
          </button>
        ))}
      </div>

        {/* Categories View */}
        {view === "categories" && (
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[16px] font-bold text-[#0f1c3f]">Categories ({categories.length})</h2>
              <button
                type="button"
                onClick={() => setShowCategoryForm(!showCategoryForm)}
                className={showCategoryForm ? "nexlo-btn-ghost" : "nexlo-btn nexlo-btn-blue"}
              >
                {showCategoryForm ? "Cancel" : "Add category"}
              </button>
            </div>

            {showCategoryForm && (
              <form onSubmit={handleCreateCategory} className="mb-4 nexlo-card space-y-3 p-5">
                <h3 className="text-[16px] font-bold text-[#0f1c3f]">New category</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block text-[13px] font-medium text-[#0f1c3f]">
                    Name *
                    <input
                      type="text"
                      required
                      value={categoryForm.name}
                      onChange={(e) => {
                        setCategoryForm({
                          ...categoryForm,
                          name: e.target.value,
                          slug: generateSlug(e.target.value),
                        });
                      }}
                      className="nexlo-field mt-1"
                    />
                  </label>
                  <label className="block text-[13px] font-medium text-[#0f1c3f]">
                    Slug *
                    <input
                      type="text"
                      required
                      value={categoryForm.slug}
                      onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })}
                      className="nexlo-field mt-1"
                    />
                  </label>
                  <label className="block text-[13px] font-medium text-[#0f1c3f]">
                    Parent category
                    <select
                      value={categoryForm.parent_id || ""}
                      onChange={(e) =>
                        setCategoryForm({
                          ...categoryForm,
                          parent_id: e.target.value ? parseInt(e.target.value) : null,
                          level: e.target.value ? 2 : 1,
                        })
                      }
                      className="nexlo-field mt-1"
                    >
                      <option value="">None (root)</option>
                      {categories
                        .filter((c) => c.level === 1)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="block text-[13px] font-medium text-[#0f1c3f]">
                    Icon
                    <input
                      type="text"
                      value={categoryForm.icon}
                      onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                      className="nexlo-field mt-1"
                      placeholder="Optional"
                    />
                  </label>
                  <label className="block text-[13px] font-medium text-[#0f1c3f] md:col-span-2">
                    Description
                    <textarea
                      value={categoryForm.description}
                      onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                      className="nexlo-field mt-1 h-auto min-h-20 rounded-2xl py-3"
                      rows={2}
                    />
                  </label>
                  <div className="flex items-center gap-6 text-[13px] text-[#0f1c3f]">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={categoryForm.is_restricted}
                        onChange={(e) => setCategoryForm({ ...categoryForm, is_restricted: e.target.checked })}
                      />
                      Restricted
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={categoryForm.requires_approval}
                        onChange={(e) => setCategoryForm({ ...categoryForm, requires_approval: e.target.checked })}
                      />
                      Requires approval
                    </label>
                  </div>
                </div>
                <button type="submit" className="nexlo-btn nexlo-btn-blue">
                  Create category
                </button>
              </form>
            )}

            {loading ? (
              <p className="py-12 text-center text-[14px] text-[#6b7587]">Loading…</p>
            ) : categories.length === 0 ? (
              <div className="nexlo-card">
                <Empty title="No categories yet" sub="Add a root category, then nest subcategories under it." />
              </div>
            ) : (
              <div className="nexlo-card overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[13.5px]">
                  <thead>
                    <tr className="border-b border-[#eef2f7] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8a94a6]">
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Slug</th>
                      <th className="px-4 py-3">Level</th>
                      <th className="px-4 py-3">Items</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => (
                      <tr key={cat.id} className="border-b border-[#f3f6fa]">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#0f1c3f]">{cat.name}</p>
                          {cat.child_count > 0 ? (
                            <p className="text-[12px] text-[#8a94a6]">{cat.child_count} subcategories</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-[#6b7587]">{cat.slug}</td>
                        <td className="px-4 py-3 text-[#6b7587]">L{cat.level}</td>
                        <td className="px-4 py-3 text-[#6b7587]">{cat.item_count}</td>
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => handleToggleCategoryActive(cat.id, cat.is_active)}>
                            <StatusPill status={cat.is_active ? "active" : "inactive"} />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="text-[12.5px] font-semibold text-[#e5484d]"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Brands View */}
        {view === "brands" && (
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[16px] font-bold text-[#0f1c3f]">Brands ({brands.length})</h2>
              <button
                type="button"
                onClick={() => setShowBrandForm(!showBrandForm)}
                className={showBrandForm ? "nexlo-btn-ghost" : "nexlo-btn nexlo-btn-blue"}
              >
                {showBrandForm ? "Cancel" : "Add brand"}
              </button>
            </div>

            {showBrandForm && (
              <form onSubmit={handleCreateBrand} className="mb-4 nexlo-card space-y-3 p-5">
                <h3 className="text-[16px] font-bold text-[#0f1c3f]">New brand</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block text-[13px] font-medium text-[#0f1c3f]">
                    Name *
                    <input
                      type="text"
                      required
                      value={brandForm.name}
                      onChange={(e) =>
                        setBrandForm({ ...brandForm, name: e.target.value, slug: generateSlug(e.target.value) })
                      }
                      className="nexlo-field mt-1"
                    />
                  </label>
                  <label className="block text-[13px] font-medium text-[#0f1c3f]">
                    Slug *
                    <input
                      type="text"
                      required
                      value={brandForm.slug}
                      onChange={(e) => setBrandForm({ ...brandForm, slug: e.target.value })}
                      className="nexlo-field mt-1"
                    />
                  </label>
                  <label className="block text-[13px] font-medium text-[#0f1c3f]">
                    Logo URL
                    <input
                      type="url"
                      value={brandForm.logo_url}
                      onChange={(e) => setBrandForm({ ...brandForm, logo_url: e.target.value })}
                      className="nexlo-field mt-1"
                    />
                  </label>
                  <label className="block text-[13px] font-medium text-[#0f1c3f]">
                    Website
                    <input
                      type="url"
                      value={brandForm.website}
                      onChange={(e) => setBrandForm({ ...brandForm, website: e.target.value })}
                      className="nexlo-field mt-1"
                    />
                  </label>
                  <label className="block text-[13px] font-medium text-[#0f1c3f] md:col-span-2">
                    Description
                    <textarea
                      value={brandForm.description}
                      onChange={(e) => setBrandForm({ ...brandForm, description: e.target.value })}
                      className="nexlo-field mt-1 h-auto min-h-20 rounded-2xl py-3"
                      rows={2}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-[13px] text-[#0f1c3f]">
                    <input
                      type="checkbox"
                      checked={brandForm.is_verified}
                      onChange={(e) => setBrandForm({ ...brandForm, is_verified: e.target.checked })}
                    />
                    Verified brand
                  </label>
                </div>
                <button type="submit" className="nexlo-btn nexlo-btn-blue">
                  Create brand
                </button>
              </form>
            )}

            {loading ? (
              <p className="py-12 text-center text-[14px] text-[#6b7587]">Loading…</p>
            ) : brands.length === 0 ? (
              <div className="nexlo-card">
                <Empty title="No brands yet" sub="Add a brand so sellers can pick it on a listing." />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {brands.map((brand) => (
                  <div key={brand.id} className="nexlo-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-[#0f1c3f]">{brand.name}</h3>
                          {brand.is_verified ? <StatusPill status="verified" /> : null}
                        </div>
                        <p className="text-[12.5px] text-[#6b7587]">{brand.slug}</p>
                        {brand.description ? <p className="mt-2 text-[13px] text-[#5b6780]">{brand.description}</p> : null}
                        <p className="mt-2 text-[12.5px] text-[#8a94a6]">
                          {brand.listing_count} listing{brand.listing_count === 1 ? "" : "s"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteBrand(brand.id)}
                        className="text-[12.5px] font-semibold text-[#e5484d]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Conditions View */}
        {view === "conditions" && (
          <div>
            <h2 className="mb-4 text-[16px] font-bold text-[#0f1c3f]">Item conditions ({conditions.length})</h2>
            {loading ? (
              <p className="py-12 text-center text-[14px] text-[#6b7587]">Loading…</p>
            ) : conditions.length === 0 ? (
              <div className="nexlo-card">
                <Empty title="No conditions yet" sub="Condition options appear here once they are seeded." />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {conditions.map((condition) => (
                  <div key={condition.id} className="nexlo-card p-4">
                    <h3 className="font-semibold text-[#0f1c3f]">{condition.name}</h3>
                    <p className="text-[12.5px] text-[#6b7587]">{condition.slug}</p>
                    {condition.description ? <p className="mt-2 text-[13px] text-[#5b6780]">{condition.description}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
    </div>
  );
}
