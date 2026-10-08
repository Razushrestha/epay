"use client";

import { useState, useEffect } from "react";
import { accountApi, apiBase } from "@/lib/account-api";

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
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Catalog Management</h1>
          <p className="mt-2 text-gray-600">Manage categories, brands, conditions, and item specifics</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-800">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex gap-8">
            <button
              onClick={() => setView("categories")}
              className={`border-b-2 px-1 py-4 text-sm font-medium ${
                view === "categories"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              Categories
            </button>
            <button
              onClick={() => setView("brands")}
              className={`border-b-2 px-1 py-4 text-sm font-medium ${
                view === "brands"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              Brands
            </button>
            <button
              onClick={() => setView("conditions")}
              className={`border-b-2 px-1 py-4 text-sm font-medium ${
                view === "conditions"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              Conditions
            </button>
          </nav>
        </div>

        {/* Categories View */}
        {view === "categories" && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Categories ({categories.length})</h2>
              <button
                onClick={() => setShowCategoryForm(!showCategoryForm)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                {showCategoryForm ? "Cancel" : "Add Category"}
              </button>
            </div>

            {showCategoryForm && (
              <form onSubmit={handleCreateCategory} className="mb-6 rounded-lg bg-white p-6 shadow">
                <h3 className="mb-4 text-lg font-semibold">New Category</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
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
                      className="w-full rounded border border-gray-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Slug *</label>
                    <input
                      type="text"
                      required
                      value={categoryForm.slug}
                      onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })}
                      className="w-full rounded border border-gray-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Parent Category</label>
                    <select
                      value={categoryForm.parent_id || ""}
                      onChange={(e) =>
                        setCategoryForm({
                          ...categoryForm,
                          parent_id: e.target.value ? parseInt(e.target.value) : null,
                          level: e.target.value ? 2 : 1,
                        })
                      }
                      className="w-full rounded border border-gray-300 px-3 py-2"
                    >
                      <option value="">None (Root Category)</option>
                      {categories
                        .filter((c) => c.level === 1)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Icon (emoji)</label>
                    <input
                      type="text"
                      value={categoryForm.icon}
                      onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                      className="w-full rounded border border-gray-300 px-3 py-2"
                      placeholder="⚡"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                    <textarea
                      value={categoryForm.description}
                      onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                      className="w-full rounded border border-gray-300 px-3 py-2"
                      rows={2}
                    />
                  </div>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={categoryForm.is_restricted}
                        onChange={(e) => setCategoryForm({ ...categoryForm, is_restricted: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Restricted</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={categoryForm.requires_approval}
                        onChange={(e) => setCategoryForm({ ...categoryForm, requires_approval: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Requires Approval</span>
                    </label>
                  </div>
                </div>
                <button
                  type="submit"
                  className="mt-4 rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
                >
                  Create Category
                </button>
              </form>
            )}

            {loading ? (
              <div className="py-12 text-center text-gray-500">Loading...</div>
            ) : (
              <div className="overflow-hidden rounded-lg bg-white shadow">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Slug
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Level
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Items
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {categories.map((cat) => (
                      <tr key={cat.id}>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center gap-2">
                            {cat.icon && <span className="text-xl">{cat.icon}</span>}
                            <div>
                              <div className="font-medium text-gray-900">{cat.name}</div>
                              {cat.child_count > 0 && (
                                <div className="text-sm text-gray-500">{cat.child_count} subcategories</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{cat.slug}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">L{cat.level}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{cat.item_count}</td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <button
                            onClick={() => handleToggleCategoryActive(cat.id, cat.is_active)}
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              cat.is_active
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {cat.is_active ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="text-red-600 hover:text-red-900"
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
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Brands ({brands.length})</h2>
              <button
                onClick={() => setShowBrandForm(!showBrandForm)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                {showBrandForm ? "Cancel" : "Add Brand"}
              </button>
            </div>

            {showBrandForm && (
              <form onSubmit={handleCreateBrand} className="mb-6 rounded-lg bg-white p-6 shadow">
                <h3 className="mb-4 text-lg font-semibold">New Brand</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
                    <input
                      type="text"
                      required
                      value={brandForm.name}
                      onChange={(e) =>
                        setBrandForm({ ...brandForm, name: e.target.value, slug: generateSlug(e.target.value) })
                      }
                      className="w-full rounded border border-gray-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Slug *</label>
                    <input
                      type="text"
                      required
                      value={brandForm.slug}
                      onChange={(e) => setBrandForm({ ...brandForm, slug: e.target.value })}
                      className="w-full rounded border border-gray-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Logo URL</label>
                    <input
                      type="url"
                      value={brandForm.logo_url}
                      onChange={(e) => setBrandForm({ ...brandForm, logo_url: e.target.value })}
                      className="w-full rounded border border-gray-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Website</label>
                    <input
                      type="url"
                      value={brandForm.website}
                      onChange={(e) => setBrandForm({ ...brandForm, website: e.target.value })}
                      className="w-full rounded border border-gray-300 px-3 py-2"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                    <textarea
                      value={brandForm.description}
                      onChange={(e) => setBrandForm({ ...brandForm, description: e.target.value })}
                      className="w-full rounded border border-gray-300 px-3 py-2"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={brandForm.is_verified}
                        onChange={(e) => setBrandForm({ ...brandForm, is_verified: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Verified Brand</span>
                    </label>
                  </div>
                </div>
                <button
                  type="submit"
                  className="mt-4 rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
                >
                  Create Brand
                </button>
              </form>
            )}

            {loading ? (
              <div className="py-12 text-center text-gray-500">Loading...</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {brands.map((brand) => (
                  <div key={brand.id} className="rounded-lg bg-white p-4 shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{brand.name}</h3>
                          {brand.is_verified && <span className="text-blue-500" title="Verified">✓</span>}
                        </div>
                        <p className="text-sm text-gray-500">{brand.slug}</p>
                        {brand.description && <p className="mt-2 text-sm text-gray-600">{brand.description}</p>}
                        <div className="mt-2 text-sm text-gray-500">{brand.listing_count} listings</div>
                      </div>
                      <button
                        onClick={() => handleDeleteBrand(brand.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        ×
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
            <h2 className="mb-6 text-xl font-semibold text-gray-900">Item Conditions ({conditions.length})</h2>
            {loading ? (
              <div className="py-12 text-center text-gray-500">Loading...</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {conditions.map((condition) => (
                  <div key={condition.id} className="rounded-lg bg-white p-4 shadow">
                    <h3 className="font-semibold text-gray-900">{condition.name}</h3>
                    <p className="text-sm text-gray-500">{condition.slug}</p>
                    {condition.description && <p className="mt-2 text-sm text-gray-600">{condition.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
