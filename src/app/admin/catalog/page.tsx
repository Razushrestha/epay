"use client";

import { useState, useEffect } from "react";
import { accountApi, apiBase } from "@/lib/account-api";
import { Empty, StatusPill } from "@/components/admin/admin-ui";
import { AuthenticityBadge } from "@/components/catalog/AuthenticityBadge";
import { CategoryEditorDrawer, type CategoryDraft } from "@/components/admin/CategoryEditorDrawer";

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
  insertion_fee?: number | string | null;
  final_value_fee_percentage?: number | string | null;
  commission_percentage?: number | string | null;
}

interface Brand {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  website: string | null;
  is_verified: boolean;
  is_active: boolean;
  listing_count: number;
}

type CategoryDrawerState = null | { mode: "create" } | { mode: "edit"; category: Category };

function errorMessage(err: unknown, fallback = "Something went wrong") {
  return err instanceof Error ? err.message : fallback;
}

/** Depth-first order (parent, then its children by sort order) so the table reads like the menu. */
function orderAsTree(rows: Category[]): Category[] {
  const byParent = new Map<number | null, Category[]>();
  for (const row of rows) {
    const key = row.parent_id ?? null;
    byParent.set(key, [...(byParent.get(key) || []), row]);
  }
  const out: Category[] = [];
  const walk = (parent: number | null) => {
    const kids = (byParent.get(parent) || []).slice().sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    for (const kid of kids) {
      out.push(kid);
      walk(kid.id);
    }
  };
  walk(null);
  // Anything whose parent is missing from the list still shows up at the end.
  const seen = new Set(out.map((row) => row.id));
  return [...out, ...rows.filter((row) => !seen.has(row.id))];
}

interface Condition {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
}

export default function CatalogAdminPage() {
  const [view, setView] = useState<"categories" | "brands" | "fees" | "conditions">("categories");
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One slide-over handles both "New category" and "Edit category".
  const [categoryDrawer, setCategoryDrawer] = useState<CategoryDrawerState>(null);

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

  const [feeForm, setFeeForm] = useState({
    category_id: "",
    insertion_fee: "50",
    final_value_fee_percentage: "5",
  });
  const [feeSaved, setFeeSaved] = useState<string | null>(null);

  // Hidden (old) categories and brands stay in the database; this switch only controls what the table shows.
  const [showInactive, setShowInactive] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [brandEdit, setBrandEdit] = useState({
    name: "",
    slug: "",
    logo_url: "",
    description: "",
    website: "",
    is_verified: false,
    is_active: true,
  });

  const visibleCategories = orderAsTree(categories).filter((cat) => showInactive || cat.is_active);
  const visibleBrands = brands.filter((brand) => showInactive || brand.is_active);
  const hiddenCategoryCount = categories.filter((cat) => !cat.is_active).length;
  const hiddenBrandCount = brands.filter((brand) => !brand.is_active).length;

  useEffect(() => {
    loadData();
  }, [view]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      if (view === "categories" || view === "fees") {
        const res = await fetch(`${apiBase}/api/v1/catalog/categories?active=false`);
        const data = await res.json();
        const rows: Category[] = data.categories || [];
        setCategories(rows);
        const firstActive = orderAsTree(rows).find((cat) => cat.is_active);
        if (firstActive) {
          setFeeForm((current) =>
            current.category_id
              ? current
              : {
                  category_id: String(firstActive.id),
                  insertion_fee: String(firstActive.insertion_fee ?? 50),
                  final_value_fee_percentage: String(firstActive.final_value_fee_percentage ?? 5),
                },
          );
        }
      } else if (view === "brands") {
        const token = accountApi.getToken();
        const res = await fetch(`${apiBase}/api/v1/catalog/admin/brands?limit=200`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        setBrands(data.brands || []);
      } else if (view === "conditions") {
        const res = await fetch(`${apiBase}/api/v1/catalog/conditions`);
        const data = await res.json();
        setConditions(data.conditions || []);
      }
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
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
    } catch (err: unknown) {
      setError(errorMessage(err));
    }
  }

  async function handleSaveFees(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFeeSaved(null);
    try {
      const token = accountApi.getToken();
      if (!token) throw new Error("Not authenticated");
      if (!feeForm.category_id) throw new Error("Choose a category");

      const res = await fetch(`${apiBase}/api/v1/catalog/admin/fees/${feeForm.category_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          insertion_fee: Number(feeForm.insertion_fee),
          final_value_fee_percentage: Number(feeForm.final_value_fee_percentage),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save fee rules");
      }

      const body = await res.json();
      const catName = body.category?.name || "Category";
      setFeeSaved(`${catName}: insertion NPR ${feeForm.insertion_fee}, FVF ${feeForm.final_value_fee_percentage}%`);
      loadData();
    } catch (err: unknown) {
      setError(errorMessage(err));
    }
  }

  async function saveCategory(values: CategoryDraft): Promise<string | null> {
    const editing = categoryDrawer?.mode === "edit" ? categoryDrawer.category : null;
    try {
      const token = accountApi.getToken();
      if (!token) return "Not authenticated";
      const icon = values.icon.trim() || null;
      const description = values.description.trim() || null;
      const payload = editing
        ? {
            name: values.name,
            slug: values.slug,
            icon,
            description,
            is_restricted: values.is_restricted,
            requires_approval: values.requires_approval,
            is_active: values.is_active,
          }
        : {
            name: values.name,
            slug: values.slug,
            parent_id: values.parent_id,
            level: values.level,
            icon,
            description,
            is_restricted: values.is_restricted,
            requires_approval: values.requires_approval,
          };
      const res = await fetch(
        editing
          ? `${apiBase}/api/v1/catalog/admin/categories/${editing.id}`
          : `${apiBase}/api/v1/catalog/admin/categories`,
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return body.error || "Could not save the category";
      setCategoryDrawer(null);
      setError(null);
      await loadData();
      return null;
    } catch (err: unknown) {
      return errorMessage(err);
    }
  }

  function startEditBrand(brand: Brand) {
    setEditingBrand(brand);
    setBrandEdit({
      name: brand.name,
      slug: brand.slug,
      logo_url: brand.logo_url || "",
      description: brand.description || "",
      website: brand.website || "",
      is_verified: brand.is_verified,
      is_active: brand.is_active,
    });
    setShowBrandForm(false);
    setError(null);
  }

  async function handleSaveBrand(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBrand) return;
    setError(null);
    try {
      const token = accountApi.getToken();
      if (!token) throw new Error("Not authenticated");
      const res = await fetch(`${apiBase}/api/v1/catalog/admin/brands/${editingBrand.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...brandEdit,
          logo_url: brandEdit.logo_url.trim() || null,
          website: brandEdit.website.trim() || null,
          description: brandEdit.description.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to update brand");
      setEditingBrand(null);
      await loadData();
    } catch (err: unknown) {
      setError(errorMessage(err));
    }
  }

  async function handleToggleBrandActive(brand: Brand) {
    try {
      const token = accountApi.getToken();
      if (!token) throw new Error("Not authenticated");
      const res = await fetch(`${apiBase}/api/v1/catalog/admin/brands/${brand.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: !brand.is_active }),
      });
      if (!res.ok) throw new Error("Failed to update brand");
      await loadData();
    } catch (err: unknown) {
      setError(errorMessage(err));
    }
  }

  async function handleToggleBrandVerified(brand: Brand) {
    try {
      const token = accountApi.getToken();
      if (!token) throw new Error("Not authenticated");
      const res = await fetch(`${apiBase}/api/v1/catalog/admin/brands/${brand.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_verified: !brand.is_verified }),
      });
      if (!res.ok) throw new Error("Failed to update authenticity badge");
      loadData();
    } catch (err: unknown) {
      setError(errorMessage(err));
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
    } catch (err: unknown) {
      setError(errorMessage(err));
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
    } catch (err: unknown) {
      setError(errorMessage(err));
    }
  }

  function siblingsOf(cat: Category) {
    return visibleCategories.filter((c) => c.parent_id === cat.parent_id);
  }

  async function moveCategory(cat: Category, direction: -1 | 1) {
    setError(null);
    const siblings = siblingsOf(cat);
    const index = siblings.findIndex((c) => c.id === cat.id);
    const swapWith = siblings[index + direction];
    if (!swapWith) return;
    const ids = siblings.map((c) => c.id);
    const next = [...ids];
    const j = index + direction;
    [next[index], next[j]] = [next[j], next[index]];
    try {
      const token = accountApi.getToken();
      if (!token) throw new Error("Not authenticated");
      const res = await fetch(`${apiBase}/api/v1/catalog/admin/categories/reorder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids: next }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to reorder");
      }
      await loadData();
    } catch (err: unknown) {
      setError(errorMessage(err));
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

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete brand");
      }
      loadData();
    } catch (err: unknown) {
      setError(errorMessage(err));
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
        <p className="mt-1 text-[14px] text-[#6b7587]">Categories, brands, authenticity badges, and category fee rules used on every listing.</p>
      </div>

      {error ? <p className="nexlo-alert nexlo-alert-error">{error}</p> : null}
      {feeSaved ? <p className="nexlo-alert nexlo-alert-info">{feeSaved}</p> : null}

      <div className="flex flex-wrap gap-2">
        {(["categories", "brands", "fees", "conditions"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold capitalize ${
              view === id ? "bg-[#3665f3] text-white" : "border border-[#e7eef6] bg-white text-[#3a4a66]"
            }`}
          >
            {id === "fees" ? "Fees" : id}
          </button>
        ))}
      </div>

        {/* Categories View */}
        {view === "categories" && (
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[16px] font-bold text-[#0f1c3f]">
                Categories ({visibleCategories.length})
              </h2>
              <div className="flex flex-wrap items-center gap-4">
                {hiddenCategoryCount > 0 ? (
                  <label className="flex items-center gap-2 text-[13px] text-[#3a4a66]">
                    <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                    Show {hiddenCategoryCount} hidden
                  </label>
                ) : null}
                <button
                  type="button"
                  onClick={() => setCategoryDrawer({ mode: "create" })}
                  className="nexlo-btn nexlo-btn-blue"
                >
                  + Add category
                </button>
              </div>
            </div>

            {categoryDrawer ? (
              <CategoryEditorDrawer
                key={categoryDrawer.mode === "edit" ? `edit-${categoryDrawer.category.id}` : "create"}
                mode={categoryDrawer.mode}
                initial={categoryDrawer.mode === "edit" ? categoryDrawer.category : undefined}
                categories={orderAsTree(categories).filter((c) => c.is_active && Number(c.level) < 3)}
                onSubmit={saveCategory}
                onClose={() => setCategoryDrawer(null)}
              />
            ) : null}

            {loading ? (
              <p className="py-12 text-center text-[14px] text-[#6b7587]">Loading…</p>
            ) : visibleCategories.length === 0 ? (
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
                      <th className="px-4 py-3">Insertion</th>
                      <th className="px-4 py-3">FVF</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCategories.map((cat) => (
                      <tr key={cat.id} className={`border-b border-[#f3f6fa] ${cat.is_active ? "" : "opacity-60"}`}>
                        <td className="px-4 py-3" style={{ paddingLeft: 16 + Math.max(cat.level - 1, 0) * 22 }}>
                          <p className="font-semibold text-[#0f1c3f]">
                            {cat.icon ? <span className="mr-1.5">{cat.icon}</span> : null}
                            {cat.name}
                          </p>
                          {cat.child_count > 0 ? (
                            <p className="text-[12px] text-[#8a94a6]">{cat.child_count} subcategories</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-[#6b7587]">{cat.slug}</td>
                        <td className="px-4 py-3 text-[#6b7587]">L{cat.level}</td>
                        <td className="px-4 py-3 text-[#6b7587]">{cat.item_count}</td>
                        <td className="px-4 py-3 text-[#6b7587]">
                          NPR {Number(cat.insertion_fee || 0).toLocaleString("en-NP")}
                        </td>
                        <td className="px-4 py-3 text-[#6b7587]">{Number(cat.final_value_fee_percentage || 0)}%</td>
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => handleToggleCategoryActive(cat.id, cat.is_active)}>
                            <StatusPill status={cat.is_active ? "active" : "inactive"} />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setCategoryDrawer({ mode: "edit", category: cat })}
                              className="text-[12.5px] font-semibold text-[#3665f3]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={siblingsOf(cat)[0]?.id === cat.id}
                              onClick={() => moveCategory(cat, -1)}
                              className="text-[12.5px] font-semibold text-[#3665f3] disabled:opacity-30"
                              title="Move up among siblings"
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              disabled={siblingsOf(cat)[siblingsOf(cat).length - 1]?.id === cat.id}
                              onClick={() => moveCategory(cat, 1)}
                              className="text-[12.5px] font-semibold text-[#3665f3] disabled:opacity-30"
                              title="Move down among siblings"
                            >
                              Down
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(cat.id)}
                              className="text-[12.5px] font-semibold text-[#e5484d]"
                            >
                              Delete
                            </button>
                          </div>
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
              <h2 className="text-[16px] font-bold text-[#0f1c3f]">Brands ({visibleBrands.length})</h2>
              <div className="flex flex-wrap items-center gap-4">
                {hiddenBrandCount > 0 ? (
                  <label className="flex items-center gap-2 text-[13px] text-[#3a4a66]">
                    <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                    Show {hiddenBrandCount} hidden
                  </label>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setShowBrandForm(!showBrandForm);
                    setEditingBrand(null);
                  }}
                  className={showBrandForm ? "nexlo-btn-ghost" : "nexlo-btn nexlo-btn-blue"}
                >
                  {showBrandForm ? "Cancel" : "Add brand"}
                </button>
              </div>
            </div>

            {editingBrand && (
              <form onSubmit={handleSaveBrand} className="mb-4 nexlo-card space-y-3 p-5">
                <h3 className="text-[16px] font-bold text-[#0f1c3f]">Edit “{editingBrand.name}”</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block text-[13px] font-medium text-[#0f1c3f]">
                    Name *
                    <input
                      type="text"
                      required
                      value={brandEdit.name}
                      onChange={(e) => setBrandEdit({ ...brandEdit, name: e.target.value })}
                      className="nexlo-field mt-1"
                    />
                  </label>
                  <label className="block text-[13px] font-medium text-[#0f1c3f]">
                    Slug *
                    <input
                      type="text"
                      required
                      value={brandEdit.slug}
                      onChange={(e) => setBrandEdit({ ...brandEdit, slug: e.target.value })}
                      className="nexlo-field mt-1"
                    />
                  </label>
                  <label className="block text-[13px] font-medium text-[#0f1c3f]">
                    Logo URL
                    <input
                      type="url"
                      value={brandEdit.logo_url}
                      onChange={(e) => setBrandEdit({ ...brandEdit, logo_url: e.target.value })}
                      className="nexlo-field mt-1"
                    />
                  </label>
                  <label className="block text-[13px] font-medium text-[#0f1c3f]">
                    Website
                    <input
                      type="url"
                      value={brandEdit.website}
                      onChange={(e) => setBrandEdit({ ...brandEdit, website: e.target.value })}
                      className="nexlo-field mt-1"
                    />
                  </label>
                  <label className="block text-[13px] font-medium text-[#0f1c3f] md:col-span-2">
                    Description
                    <textarea
                      value={brandEdit.description}
                      onChange={(e) => setBrandEdit({ ...brandEdit, description: e.target.value })}
                      className="nexlo-field mt-1 h-auto min-h-20 rounded-2xl py-3"
                      rows={2}
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-6 text-[13px] text-[#0f1c3f]">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={brandEdit.is_active}
                        onChange={(e) => setBrandEdit({ ...brandEdit, is_active: e.target.checked })}
                      />
                      Visible to sellers
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={brandEdit.is_verified}
                        onChange={(e) => setBrandEdit({ ...brandEdit, is_verified: e.target.checked })}
                      />
                      Authenticity badge
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="nexlo-btn nexlo-btn-blue">
                    Save changes
                  </button>
                  <button type="button" onClick={() => setEditingBrand(null)} className="nexlo-btn-ghost">
                    Cancel
                  </button>
                </div>
              </form>
            )}

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
                    Authenticity badge
                  </label>
                </div>
                <button type="submit" className="nexlo-btn nexlo-btn-blue">
                  Create brand
                </button>
              </form>
            )}

            {loading ? (
              <p className="py-12 text-center text-[14px] text-[#6b7587]">Loading…</p>
            ) : visibleBrands.length === 0 ? (
              <div className="nexlo-card">
                <Empty title="No brands yet" sub="Add a brand so sellers can pick it on a listing." />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleBrands.map((brand) => (
                  <div key={brand.id} className={`nexlo-card p-4 ${brand.is_active ? "" : "opacity-60"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-[#0f1c3f]">{brand.name}</h3>
                          {brand.is_verified ? <AuthenticityBadge /> : null}
                          {brand.is_active ? null : <StatusPill status="inactive" />}
                        </div>
                        <p className="text-[12.5px] text-[#6b7587]">{brand.slug}</p>
                        {brand.description ? <p className="mt-2 text-[13px] text-[#5b6780]">{brand.description}</p> : null}
                        <p className="mt-2 text-[12.5px] text-[#8a94a6]">
                          {brand.listing_count} listing{brand.listing_count === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEditBrand(brand)}
                          className="text-[12.5px] font-semibold text-[#3665f3]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleBrandActive(brand)}
                          className="text-[12.5px] font-semibold text-[#3665f3]"
                        >
                          {brand.is_active ? "Hide" : "Show"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleBrandVerified(brand)}
                          className="text-[12.5px] font-semibold text-[#3665f3]"
                        >
                          {brand.is_verified ? "Remove badge" : "Grant authenticity"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBrand(brand.id)}
                          className="text-[12.5px] font-semibold text-[#e5484d]"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "fees" && (
          <div>
            <h2 className="mb-4 text-[16px] font-bold text-[#0f1c3f]">Category fees</h2>
            <form onSubmit={handleSaveFees} className="mb-4 nexlo-card space-y-3 p-5">
              <p className="text-[13px] text-[#6b7587]">
                Insertion fee is charged when a listing goes live. Final value fee (FVF) is a percentage of the sale price.
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="block text-[13px] font-medium text-[#0f1c3f]">
                  Category *
                  <select
                    required
                    value={feeForm.category_id}
                    onChange={(e) => {
                      const next = categories.find((c) => String(c.id) === e.target.value);
                      setFeeForm({
                        category_id: e.target.value,
                        insertion_fee: String(next?.insertion_fee ?? feeForm.insertion_fee),
                        final_value_fee_percentage: String(next?.final_value_fee_percentage ?? feeForm.final_value_fee_percentage),
                      });
                      setFeeSaved(null);
                    }}
                    className="nexlo-field mt-1"
                  >
                    <option value="">Select category</option>
                    {visibleCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {`${"\u2014 ".repeat(Math.max(c.level - 1, 0))}${c.name}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[13px] font-medium text-[#0f1c3f]">
                  Insertion fee (NPR) *
                  <input
                    type="number"
                    required
                    min={0}
                    step="1"
                    value={feeForm.insertion_fee}
                    onChange={(e) => setFeeForm({ ...feeForm, insertion_fee: e.target.value })}
                    className="nexlo-field mt-1"
                  />
                </label>
                <label className="block text-[13px] font-medium text-[#0f1c3f]">
                  Final value fee (%) *
                  <input
                    type="number"
                    required
                    min={0}
                    max={100}
                    step="0.01"
                    value={feeForm.final_value_fee_percentage}
                    onChange={(e) => setFeeForm({ ...feeForm, final_value_fee_percentage: e.target.value })}
                    className="nexlo-field mt-1"
                  />
                </label>
              </div>
              <button type="submit" className="nexlo-btn nexlo-btn-blue">
                Save fee rules
              </button>
            </form>

            {loading ? (
              <p className="py-12 text-center text-[14px] text-[#6b7587]">Loading…</p>
            ) : (
              <div className="nexlo-card overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-[13.5px]">
                  <thead>
                    <tr className="border-b border-[#eef2f7] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8a94a6]">
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Slug</th>
                      <th className="px-4 py-3">Insertion (NPR)</th>
                      <th className="px-4 py-3">FVF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCategories.map((cat) => (
                      <tr key={cat.id} className="border-b border-[#f3f6fa]">
                        <td className="px-4 py-3 font-semibold text-[#0f1c3f]">{cat.name}</td>
                        <td className="px-4 py-3 text-[#6b7587]">{cat.slug}</td>
                        <td className="px-4 py-3 text-[#6b7587]">NPR {Number(cat.insertion_fee || 0).toLocaleString("en-NP")}</td>
                        <td className="px-4 py-3 text-[#6b7587]">{Number(cat.final_value_fee_percentage || 0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
