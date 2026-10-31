/**
 * Catalog API Router - Categories, Brands, Conditions, Item Specifics
 * Handles category tree management, item specifics configuration, and catalog browsing
 */

import { query, withTx } from './db.mjs';

/**
 * Main catalog router handler
 */
export async function handleCatalog(req, method, urlPath, headers, body, ipAddress, userAgent) {
  const url = new URL(`http://localhost${urlPath}`);
  const pathParts = url.pathname.replace('/api/v1/catalog', '').split('/').filter(Boolean);

  try {
    // Public endpoints (no auth required)
    if (method === 'GET' && pathParts[0] === 'categories') {
      await ensureCategoryHierarchy();
      if (!pathParts[1]) return await getCategories(url.searchParams);
      if (pathParts[1] === 'tree') return await getCategoryTree();
      if (pathParts[2] === 'specifics') return await getCategorySpecifics(pathParts[1]);
      return await getCategoryBySlug(pathParts[1]);
    }

    if (method === 'GET' && pathParts[0] === 'conditions') {
      await ensureItemConditions();
      return await getConditions();
    }

    if (method === 'GET' && pathParts[0] === 'brands') {
      return await getBrands(url.searchParams);
    }

    // Admin-only endpoints (require staff role)
    const token = headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return { status: 401, body: { error: 'Unauthorized' } };
    }

    const auth = await validateStaffToken(token);
    if (!auth) {
      return { status: 403, body: { error: 'Staff access required' } };
    }

    // Category management (admin)
    if (pathParts[0] === 'admin') {
      if (pathParts[1] === 'fees') {
        if (method === 'GET' && !pathParts[2]) {
          return await listCategoryFees();
        }
        if ((method === 'PUT' || method === 'PATCH') && pathParts[2]) {
          return await upsertCategoryFees(pathParts[2], body, auth.userId);
        }
      }

      if (pathParts[1] === 'categories') {
        if (method === 'POST' && !pathParts[2]) {
          return await createCategory(body, auth.userId, ipAddress, userAgent);
        }
        if (method === 'PATCH' && pathParts[2]) {
          return await updateCategory(pathParts[2], body, auth.userId, ipAddress, userAgent);
        }
        if (method === 'DELETE' && pathParts[2]) {
          return await deleteCategory(pathParts[2], auth.userId, ipAddress, userAgent);
        }
        if (method === 'POST' && pathParts[2] === 'reorder') {
          return await reorderCategories(body, auth.userId);
        }
        if ((method === 'PUT' || method === 'PATCH') && pathParts[3] === 'fees') {
          return await upsertCategoryFees(pathParts[2], body, auth.userId);
        }
      }

      if (pathParts[1] === 'specifics') {
        if (method === 'POST' && !pathParts[2]) {
          return await createItemSpecific(body, auth.userId);
        }
        if (method === 'PATCH' && pathParts[2]) {
          return await updateItemSpecific(pathParts[2], body, auth.userId);
        }
        if (method === 'DELETE' && pathParts[2]) {
          return await deleteItemSpecific(pathParts[2]);
        }
      }

      if (pathParts[1] === 'brands') {
        if (method === 'POST' && !pathParts[2]) {
          return await createBrand(body, auth.userId);
        }
        if (method === 'PATCH' && pathParts[2]) {
          return await updateBrand(pathParts[2], body, auth.userId);
        }
        if (method === 'DELETE' && pathParts[2]) {
          return await deleteBrand(pathParts[2]);
        }
      }

      if (pathParts[1] === 'restrictions') {
        if (method === 'POST') {
          return await createRestriction(body, auth.userId);
        }
        if (method === 'DELETE' && pathParts[2]) {
          return await deleteRestriction(pathParts[2]);
        }
      }
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    console.error('Catalog API error:', error);
    return { status: 500, body: { error: 'Internal server error' } };
  }
}

/**
 * Validate staff token
 */
async function validateStaffToken(token) {
  const hash = await hashToken(token);
  const result = await query(
    `SELECT u.id as user_id, u.is_staff
     FROM auth_sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW() AND u.is_staff = true`,
    [hash]
  );
  const row = result.rows[0];
  if (!row) return null;
  return { userId: row.user_id, is_staff: row.is_staff };
}

async function hashToken(token) {
  const crypto = await import('node:crypto');
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Get categories with optional filters
 */
async function getCategories(params) {
  const parentId = params.get('parent_id');
  const level = params.get('level');
  const active = params.get('active') !== 'false';

  let sql = `
    SELECT 
      c.id, c.name, c.slug, c.parent_id, c.level, c.icon, c.image_url,
      c.description, c.item_count, c.is_restricted, c.requires_approval,
      c.is_active, c.sort_order,
      (SELECT COUNT(*) FROM categories WHERE parent_id = c.id) as child_count,
      f.insertion_fee, f.final_value_fee_percentage, f.commission_percentage
    FROM categories c
    LEFT JOIN category_fees f ON f.category_id = c.id
    WHERE 1=1
  `;
  const values = [];
  let paramCount = 1;

  if (parentId !== null) {
    if (parentId === 'null') {
      sql += ` AND c.parent_id IS NULL`;
    } else {
      sql += ` AND c.parent_id = $${paramCount++}`;
      values.push(parentId);
    }
  }

  if (level) {
    sql += ` AND c.level = $${paramCount++}`;
    values.push(level);
  }

  if (active) {
    sql += ` AND c.is_active = true`;
  }

  sql += ` ORDER BY c.lft, c.sort_order, c.name`;

  const result = await query(sql, values);
  return { status: 200, body: { categories: result.rows } };
}

/**
 * Get full category tree (nested structure)
 */
async function getCategoryTree() {
  const result = await query(`
    SELECT id, name, slug, parent_id, level, icon, image_url, 
           item_count, is_active, sort_order
    FROM categories
    WHERE is_active = true
    ORDER BY sort_order, name
  `);

  const tree = buildTree(result.rows);
  return { status: 200, body: { tree } };
}

function buildTree(rows, parentId = null) {
  const children = rows.filter(r => r.parent_id === parentId);
  return children.map(child => ({
    ...child,
    children: buildTree(rows, child.id)
  }));
}

/**
 * Get category by slug with breadcrumb and specifics
 */
async function getCategoryBySlug(slug) {
  const byId = /^\d+$/.test(String(slug));
  const catResult = await query(
    `SELECT c.*, 
       (SELECT json_agg(json_build_object(
         'id', p.id, 'name', p.name, 'slug', p.slug, 'level', p.level
       ) ORDER BY p.level)
        FROM categories p
        WHERE p.lft < c.lft AND p.rgt > c.rgt) as ancestors,
       (SELECT COUNT(*) FROM categories WHERE parent_id = c.id) as child_count
     FROM categories c
     WHERE ${byId ? "c.id = $1" : "c.slug = $1"}`,
    [byId ? Number(slug) : slug]
  );

  if (!catResult.rows[0]) {
    return { status: 404, body: { error: 'Category not found' } };
  }

  const category = catResult.rows[0];
  const ancestors = Array.isArray(category.ancestors) ? category.ancestors : [];
  const breadcrumb = [
    ...ancestors,
    { id: category.id, name: category.name, slug: category.slug, level: category.level },
  ];

  // Get subcategories
  const subResult = await query(
    `SELECT id, name, slug, icon, image_url, item_count
     FROM categories
     WHERE parent_id = $1 AND is_active = true
     ORDER BY sort_order, name`,
    [category.id]
  );

  await ensureDefaultSpecifics(category.id);

  // Get item specifics for this category
  const specificsResult = await query(
    `SELECT 
       s.id, s.name, s.slug, s.input_type, s.unit, 
       cs.is_required, s.help_text, s.is_variant,
       (SELECT json_agg(json_build_object('id', o.id, 'value', o.value) ORDER BY o.sort_order)
        FROM item_specific_options o
        WHERE o.specific_id = s.id AND o.is_active = true) as options
     FROM category_specifics cs
     JOIN item_specifics s ON cs.specific_id = s.id
     WHERE cs.category_id = $1 AND s.is_active = true
     ORDER BY cs.sort_order, s.name`,
    [category.id]
  );

  // Get allowed conditions
  const conditionsResult = await query(
    `SELECT c.id, c.name, c.slug, c.description, cc.is_default
     FROM category_conditions cc
     JOIN conditions c ON cc.condition_id = c.id
     WHERE cc.category_id = $1 AND c.is_active = true
     ORDER BY c.sort_order`,
    [category.id]
  );

  // Get fees
  const feesResult = await query(
    `SELECT commission_percentage, insertion_fee, final_value_fee_percentage,
            auction_listing_fee, featured_listing_fee
     FROM category_fees
     WHERE category_id = $1`,
    [category.id]
  );

  return {
    status: 200,
    body: {
      category,
      breadcrumb,
      subcategories: subResult.rows,
      specifics: specificsResult.rows,
      conditions: conditionsResult.rows,
      fees: feesResult.rows[0] || null
    }
  };
}

/**
 * Get item specifics for a category (by slug)
 */
const LAPTOP_SPECIFICS = [
  {
    name: "Brand",
    slug: "brand",
    input_type: "select",
    required: true,
    options: ["Apple", "Dell", "HP", "Lenovo", "ASUS", "Acer", "MSI", "Samsung", "Microsoft", "Other"],
  },
  { name: "Model", slug: "model", input_type: "text", required: false, options: [] },
  {
    name: "Screen Size",
    slug: "screen-size",
    input_type: "number",
    required: false,
    unit: "inch",
    min: 10,
    max: 20,
    help_text: "Enter screen size in inches (10–20).",
    options: [],
  },
  {
    name: "Processor",
    slug: "processor",
    input_type: "select",
    required: false,
    options: ["Intel Core i5", "Intel Core i7", "AMD Ryzen 5", "AMD Ryzen 7", "Apple M-series", "Other"],
  },
  {
    name: "RAM",
    slug: "ram",
    input_type: "number",
    required: false,
    unit: "GB",
    min: 1,
    max: 128,
    help_text: "Enter RAM in GB (1–128). Negative values are not allowed.",
    options: [],
  },
  {
    name: "Storage",
    slug: "storage",
    input_type: "number",
    required: false,
    unit: "GB",
    min: 1,
    max: 8192,
    help_text: "Enter storage in GB (1–8192). Negative values are not allowed.",
    options: [],
  },
  {
    name: "Operating System",
    slug: "operating-system",
    input_type: "select",
    required: false,
    options: ["Windows 11", "Windows 10", "macOS", "ChromeOS", "Linux"],
  },
];

const DEFAULT_SPECIFICS = [
  { name: "Brand", slug: "brand", input_type: "text", required: false, options: [] },
  { name: "Model", slug: "model", input_type: "text", required: false, options: [] },
  { name: "Color", slug: "color", input_type: "select", required: false, options: ["Black", "White", "Blue", "Red", "Green", "Gold", "Silver", "Other"] },
  { name: "Size", slug: "size", input_type: "select", required: false, options: ["XS", "S", "M", "L", "XL", "XXL", "One size", "Other"] },
  { name: "Storage", slug: "storage", input_type: "select", required: false, options: ["64GB", "128GB", "256GB", "512GB", "1TB", "Other"] },
];

async function attachSpecifics(categoryId, pack) {
  for (let index = 0; index < pack.length; index += 1) {
    const spec = pack[index];
    let row = await query("SELECT id FROM item_specifics WHERE slug = $1 LIMIT 1", [spec.slug]);
    if (!row.rows[0]) {
      row = await query(
        `INSERT INTO item_specifics (name, slug, input_type, unit, is_required, is_active, min_value, max_value, help_text)
         VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8) RETURNING id`,
        [spec.name, spec.slug, spec.input_type, spec.unit || null, spec.required, spec.min ?? null, spec.max ?? null, spec.help_text || null],
      );
    } else {
      await query(
        `UPDATE item_specifics
         SET name = $1, input_type = $2, unit = $3, is_required = $4, min_value = $5, max_value = $6, help_text = $7, updated_at = NOW()
         WHERE id = $8`,
        [spec.name, spec.input_type, spec.unit || null, spec.required, spec.min ?? null, spec.max ?? null, spec.help_text || null, row.rows[0].id],
      );
    }
    const specificId = row.rows[0].id;
    if (spec.input_type === "select" || spec.input_type === "dropdown") {
      await query(`UPDATE item_specific_options SET is_active = false WHERE specific_id = $1`, [specificId]);
      for (let i = 0; i < (spec.options || []).length; i += 1) {
        const existingOpt = await query(
          `SELECT id FROM item_specific_options WHERE specific_id = $1 AND value = $2 LIMIT 1`,
          [specificId, spec.options[i]],
        );
        if (existingOpt.rows[0]) {
          await query(`UPDATE item_specific_options SET is_active = true, sort_order = $1 WHERE id = $2`, [i, existingOpt.rows[0].id]);
        } else {
          await query(
            `INSERT INTO item_specific_options (specific_id, value, sort_order, is_active) VALUES ($1, $2, $3, true)`,
            [specificId, spec.options[i], i],
          );
        }
      }
    } else {
      await query(`UPDATE item_specific_options SET is_active = false WHERE specific_id = $1`, [specificId]);
    }
    await query(
      `INSERT INTO category_specifics (category_id, specific_id, is_required, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (category_id, specific_id) DO UPDATE SET is_required = EXCLUDED.is_required, sort_order = EXCLUDED.sort_order`,
      [categoryId, specificId, spec.required, index + 1],
    );
  }
}

async function ensureDefaultSpecifics(categoryId) {
  const category = await query("SELECT slug FROM categories WHERE id = $1", [categoryId]);
  if (category.rows[0]?.slug === "laptops") {
    const check = await query(
      `SELECT s.slug, s.input_type
       FROM item_specifics s
       JOIN category_specifics cs ON cs.specific_id = s.id
       WHERE cs.category_id = $1 AND s.slug IN ('ram', 'brand', 'storage', 'screen-size')`,
      [categoryId],
    );
    const types = Object.fromEntries(check.rows.map((row) => [row.slug, row.input_type]));
    if (types.ram === "number" && types.brand === "select" && types.storage === "number" && types["screen-size"] === "number") {
      return;
    }
    await attachSpecifics(categoryId, LAPTOP_SPECIFICS);
    return;
  }
  const existing = await query("SELECT COUNT(*)::int AS c FROM category_specifics WHERE category_id = $1", [categoryId]);
  if (Number(existing.rows[0]?.c || 0) > 0) return;
  await attachSpecifics(categoryId, DEFAULT_SPECIFICS);
}

export async function validateListingSpecifics(categoryId, values) {
  if (!categoryId) return null;
  const loaded = await getCategorySpecifics(categoryId);
  if (loaded.status !== 200) return loaded;
  const specs = loaded.body?.specifics || [];
  const provided = values && typeof values === "object" ? values : {};
  for (const spec of specs) {
    const raw = String(provided[spec.slug] ?? "").trim();
    if (spec.input_type === "number" && raw) {
      const num = Number(raw);
      const min = spec.min_value == null ? 0 : Number(spec.min_value);
      const max = spec.max_value == null ? null : Number(spec.max_value);
      const unit = spec.unit ? ` ${spec.unit}` : "";
      if (!Number.isFinite(num)) {
        return { status: 400, body: { error: `${spec.name} must be a number${unit}.` } };
      }
      if (num < min || (max != null && num > max)) {
        const range = max != null ? `${min}–${max}${unit}` : `at least ${min}${unit}`;
        return {
          status: 400,
          body: {
            error: `${spec.name} must be ${range}. Negative or out-of-range values are not allowed.`,
          },
        };
      }
    }
  }
  for (const spec of specs) {
    const raw = String(provided[spec.slug] ?? "").trim();
    if (spec.is_required && !raw) {
      return { status: 400, body: { error: `${spec.name} is required for this category.` } };
    }
    if (!raw) continue;
    if ((spec.input_type === "select" || spec.input_type === "dropdown") && spec.options?.length) {
      const allowed = spec.options.map((opt) => opt.value);
      if (!allowed.includes(raw)) {
        return { status: 400, body: { error: `${spec.name} must be one of the listed options.` } };
      }
    }
  }
  return null;
}

let hierarchyPromise = null;

async function insertChild(parentId, { name, slug, level, sort_order }) {
  const found = await query("SELECT * FROM categories WHERE slug = $1", [slug]);
  if (found.rows[0]) return found.rows[0];
  const parentResult = await query("SELECT id, rgt FROM categories WHERE id = $1", [parentId]);
  if (!parentResult.rows[0]) throw new Error("Parent category not found");
  const gap = parentResult.rows[0].rgt;
  await query("UPDATE categories SET rgt = rgt + 2 WHERE rgt >= $1", [gap]);
  await query("UPDATE categories SET lft = lft + 2 WHERE lft > $1", [gap]);
  const inserted = await query(
    `INSERT INTO categories (name, slug, parent_id, level, lft, rgt, sort_order, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true)
     RETURNING *`,
    [name, slug, parentId, level, gap, gap + 1, sort_order],
  );
  return inserted.rows[0];
}

async function seedCategoryHierarchy() {
  const electronics = await query("SELECT id FROM categories WHERE slug = 'electronics' LIMIT 1");
  if (!electronics.rows[0]) return;
  const computers = await insertChild(electronics.rows[0].id, {
    name: "Computers",
    slug: "computers",
    level: 2,
    sort_order: 1,
  });
  await insertChild(electronics.rows[0].id, {
    name: "Cell Phones",
    slug: "cell-phones",
    level: 2,
    sort_order: 2,
  });
  const laptops = await insertChild(computers.id, {
    name: "Laptops",
    slug: "laptops",
    level: 3,
    sort_order: 1,
  });
  await insertChild(computers.id, { name: "Desktops", slug: "desktops", level: 3, sort_order: 2 });
  await insertChild(computers.id, { name: "Tablets", slug: "tablets", level: 3, sort_order: 3 });
  await attachSpecifics(laptops.id, LAPTOP_SPECIFICS);
}

async function ensureCategoryHierarchy() {
  if (!hierarchyPromise) {
    hierarchyPromise = seedCategoryHierarchy().catch((err) => {
      hierarchyPromise = null;
      throw err;
    });
  }
  await hierarchyPromise;
}

async function getCategorySpecifics(key) {
  const isId = /^\d+$/.test(String(key));
  const catResult = await query(
    isId ? 'SELECT id FROM categories WHERE id = $1' : 'SELECT id FROM categories WHERE slug = $1',
    [key],
  );
  if (!catResult.rows[0]) {
    return { status: 404, body: { error: 'Category not found' } };
  }

  await ensureDefaultSpecifics(catResult.rows[0].id);

  const result = await query(
    `SELECT 
       s.id, s.name, s.slug, s.input_type, s.unit, 
       cs.is_required, s.help_text, s.is_variant, s.validation_regex,
       s.min_value, s.max_value,
       (SELECT json_agg(json_build_object('id', o.id, 'value', o.value) ORDER BY o.sort_order)
        FROM item_specific_options o
        WHERE o.specific_id = s.id AND o.is_active = true) as options
     FROM category_specifics cs
     JOIN item_specifics s ON cs.specific_id = s.id
     WHERE cs.category_id = $1 AND s.is_active = true
     ORDER BY cs.sort_order, s.name`,
    [catResult.rows[0].id]
  );

  return { status: 200, body: { specifics: result.rows } };
}

const STANDARD_CONDITIONS = [
  { name: "New", slug: "new", description: "Brand new, unused item in original packaging", sort_order: 1 },
  { name: "Like New", slug: "like-new", description: "Barely used with no signs of wear", sort_order: 2 },
  { name: "Excellent", slug: "excellent", description: "Very lightly used with minimal wear", sort_order: 3 },
  { name: "Good", slug: "good", description: "Used with noticeable signs of wear", sort_order: 4 },
  { name: "Fair", slug: "fair", description: "Heavily used but still functional", sort_order: 5 },
  { name: "For Parts", slug: "for-parts", description: "Not working or missing parts", sort_order: 6 },
  { name: "Refurbished", slug: "refurbished", description: "Professionally restored to working condition", sort_order: 7 },
];

let conditionsPromise = null;

async function ensureItemConditions() {
  if (!conditionsPromise) {
    conditionsPromise = syncItemConditions().catch((err) => {
      conditionsPromise = null;
      throw err;
    });
  }
  await conditionsPromise;
}

async function syncItemConditions() {
  const fairRow = (await query(`SELECT id FROM conditions WHERE slug = 'fair' OR name = 'Fair' LIMIT 1`)).rows[0];
  const oldAcceptable = (await query(`SELECT id FROM conditions WHERE slug = 'acceptable' OR name = 'Acceptable' LIMIT 1`)).rows[0];
  if (oldAcceptable && fairRow && oldAcceptable.id !== fairRow.id) {
    await query(`UPDATE listings SET condition_id = $1 WHERE condition_id = $2`, [fairRow.id, oldAcceptable.id]);
    await query(`UPDATE conditions SET is_active = false WHERE id = $1`, [oldAcceptable.id]);
  } else if (oldAcceptable && !fairRow) {
    await query(
      `UPDATE conditions SET name = 'Fair', slug = 'fair', description = $1, sort_order = 5, is_active = true WHERE id = $2`,
      ["Heavily used but still functional", oldAcceptable.id],
    );
  }

  await query(`UPDATE conditions SET is_active = false WHERE slug IN ('very-good', 'used', 'for_parts') OR name IN ('Very Good')`);

  for (const spec of STANDARD_CONDITIONS) {
    const existing = await query(`SELECT id FROM conditions WHERE slug = $1 LIMIT 1`, [spec.slug]);
    if (existing.rows[0]) {
      await query(
        `UPDATE conditions SET name = $1, description = $2, sort_order = $3, is_active = true WHERE id = $4`,
        [spec.name, spec.description, spec.sort_order, existing.rows[0].id],
      );
    } else {
      await query(
        `INSERT INTO conditions (name, slug, description, sort_order, is_active)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, sort_order = EXCLUDED.sort_order, is_active = true`,
        [spec.name, spec.slug, spec.description, spec.sort_order],
      );
    }
  }
}

/**
 * Get all conditions
 */
async function getConditions() {
  const result = await query(
    `SELECT id, name, slug, description, sort_order
     FROM conditions
     WHERE is_active = true
     ORDER BY sort_order`
  );
  return { status: 200, body: { conditions: result.rows } };
}

/**
 * Get brands with optional search
 */
async function getBrands(params) {
  const search = params.get('search');
  const verified = params.get('verified');
  const limit = Math.min(parseInt(params.get('limit')) || 50, 200);
  const offset = parseInt(params.get('offset')) || 0;

  let sql = `
    SELECT id, name, slug, logo_url, description, website, 
           is_verified, listing_count
    FROM brands
    WHERE is_active = true
  `;
  const values = [];
  let paramCount = 1;

  if (search) {
    sql += ` AND name ILIKE $${paramCount++}`;
    values.push(`%${search}%`);
  }

  if (verified === 'true') {
    sql += ` AND is_verified = true`;
  }

  sql += ` ORDER BY is_verified DESC, listing_count DESC, name LIMIT $${paramCount++} OFFSET $${paramCount++}`;
  values.push(limit, offset);

  const result = await query(sql, values);
  return { status: 200, body: { brands: result.rows, limit, offset } };
}

/**
 * ADMIN: Create category
 */
async function createCategory(data, userId, ipAddress, userAgent) {
  const { name, slug, parent_id, icon, image_url, description, is_restricted, requires_approval } = data;

  if (!name || !slug) {
    return { status: 400, body: { error: 'Name and slug are required' } };
  }

  try {
    const category = await withTx(async (client) => {
      let lft;
      let rgt;
      let level = 1;
      if (parent_id) {
        const parentResult = await client.query('SELECT rgt, level FROM categories WHERE id = $1', [parent_id]);
        if (!parentResult.rows[0]) {
          const err = new Error('Parent category not found');
          err.status = 400;
          throw err;
        }
        level = Number(parentResult.rows[0].level || 0) + 1;
        if (level > 3) {
          const err = new Error('Categories are limited to 3 levels. Choose a root or level-2 parent.');
          err.status = 400;
          throw err;
        }
        const gap = parentResult.rows[0].rgt;
        await client.query("UPDATE categories SET rgt = rgt + 2 WHERE rgt >= $1", [gap]);
        await client.query("UPDATE categories SET lft = lft + 2 WHERE lft > $1", [gap]);
        lft = gap;
        rgt = gap + 1;
      } else {
        const maxResult = await client.query('SELECT COALESCE(MAX(rgt), 0) + 1 as next_lft FROM categories');
        lft = maxResult.rows[0].next_lft;
        rgt = lft + 1;
      }

      const result = await client.query(
        `INSERT INTO categories 
           (name, slug, parent_id, level, lft, rgt, icon, image_url, description, 
            is_restricted, requires_approval)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [name, slug, parent_id || null, level, lft, rgt, icon, image_url, description, 
         is_restricted || false, requires_approval || false]
      );

      const insertion = data.insertion_fee == null ? 0 : Number(data.insertion_fee);
      const fvf = data.final_value_fee_percentage == null ? 0 : Number(data.final_value_fee_percentage);
      await client.query(
        `INSERT INTO category_fees (category_id, insertion_fee, final_value_fee_percentage)
         VALUES ($1, $2, $3)
         ON CONFLICT (category_id) DO NOTHING`,
        [result.rows[0].id, Number.isFinite(insertion) ? insertion : 0, Number.isFinite(fvf) ? fvf : 0]
      );

      await client.query(
        `INSERT INTO category_audit_log (category_id, action, changed_by, changes, ip_address, user_agent)
         VALUES ($1, 'created', $2, $3, $4, $5)`,
        [result.rows[0].id, userId || null, JSON.stringify({ name, slug, parent_id, level }), ipAddress, userAgent]
      );

      return result.rows[0];
    });

    return { status: 201, body: { category } };
  } catch (err) {
    if (err?.status === 400) {
      return { status: 400, body: { error: err.message } };
    }
    if (err?.code === '23505') {
      return { status: 409, body: { error: 'A category with that name or slug already exists' } };
    }
    throw err;
  }
}

async function listCategoryFees() {
  const result = await query(
    `SELECT f.category_id, c.name as category_name, c.slug as category_slug, c.level,
            f.insertion_fee, f.final_value_fee_percentage, f.commission_percentage,
            f.auction_listing_fee, f.featured_listing_fee, f.updated_at
     FROM category_fees f
     JOIN categories c ON c.id = f.category_id
     ORDER BY c.lft, c.name`
  );
  return { status: 200, body: { fees: result.rows } };
}

async function upsertCategoryFees(categoryId, data, userId) {
  const cat = await query('SELECT id, name, slug FROM categories WHERE id = $1', [categoryId]);
  if (!cat.rows[0]) {
    return { status: 404, body: { error: 'Category not found' } };
  }

  const insertion = data.insertion_fee == null ? 0 : Number(data.insertion_fee);
  const fvf = data.final_value_fee_percentage == null ? 0 : Number(data.final_value_fee_percentage);
  const commission = data.commission_percentage == null ? null : Number(data.commission_percentage);

  if (!Number.isFinite(insertion) || insertion < 0) {
    return { status: 400, body: { error: 'Insertion fee must be 0 or greater (NPR)' } };
  }
  if (!Number.isFinite(fvf) || fvf < 0 || fvf > 100) {
    return { status: 400, body: { error: 'Final value fee must be between 0 and 100%' } };
  }
  if (commission != null && (!Number.isFinite(commission) || commission < 0 || commission > 100)) {
    return { status: 400, body: { error: 'Commission must be between 0 and 100%' } };
  }

  const result = await query(
    `INSERT INTO category_fees (category_id, insertion_fee, final_value_fee_percentage, commission_percentage, updated_at)
     VALUES ($1, $2, $3, COALESCE($4, 10), NOW())
     ON CONFLICT (category_id) DO UPDATE SET
       insertion_fee = EXCLUDED.insertion_fee,
       final_value_fee_percentage = EXCLUDED.final_value_fee_percentage,
       commission_percentage = COALESCE($4, category_fees.commission_percentage),
       updated_at = NOW()
     RETURNING *`,
    [categoryId, insertion, fvf, commission]
  );

  await query(
    `INSERT INTO category_audit_log (category_id, action, changed_by, changes)
     VALUES ($1, 'fees_updated', $2, $3)`,
    [categoryId, userId || null, JSON.stringify({ insertion_fee: insertion, final_value_fee_percentage: fvf, commission_percentage: commission })]
  );

  return { status: 200, body: { fees: result.rows[0], category: cat.rows[0] } };
}

/**
 * ADMIN: Update category
 */
async function updateCategory(categoryId, data, userId, ipAddress, userAgent) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  const allowed = ['name', 'slug', 'icon', 'image_url', 'description', 'is_restricted', 
                   'requires_approval', 'is_active', 'sort_order'];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${paramCount++}`);
      values.push(data[key]);
    }
  }

  if (fields.length === 0) {
    return { status: 400, body: { error: 'No valid fields to update' } };
  }

  fields.push(`updated_at = NOW()`);
  values.push(categoryId);

  const result = await query(
    `UPDATE categories SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (!result.rows[0]) {
    return { status: 404, body: { error: 'Category not found' } };
  }

  await query(
    `INSERT INTO category_audit_log (category_id, action, changed_by, changes, ip_address, user_agent)
     VALUES ($1, 'updated', $2, $3, $4, $5)`,
    [categoryId, userId, JSON.stringify(data), ipAddress, userAgent]
  );

  return { status: 200, body: { category: result.rows[0] } };
}

/**
 * ADMIN: Delete category
 */
async function deleteCategory(categoryId, userId, ipAddress, userAgent) {
  // Check if has children
  const childCheck = await query('SELECT COUNT(*) as count FROM categories WHERE parent_id = $1', [categoryId]);
  if (childCheck.rows[0].count > 0) {
    return { status: 400, body: { error: 'Cannot delete category with subcategories' } };
  }

  // Check if has listings (when listings table exists)
  // const listingCheck = await query('SELECT COUNT(*) as count FROM listings WHERE category_id = $1', [categoryId]);
  // if (listingCheck.rows[0].count > 0) {
  //   return { status: 400, body: { error: 'Cannot delete category with active listings' } };
  // }

  await query(
    `INSERT INTO category_audit_log (category_id, action, changed_by, ip_address, user_agent)
     VALUES ($1, 'deleted', $2, $3, $4)`,
    [categoryId, userId, ipAddress, userAgent]
  );

  await query('DELETE FROM categories WHERE id = $1', [categoryId]);
  return { status: 200, body: { success: true } };
}

/**
 * ADMIN: Create item specific
 */
async function createItemSpecific(data, userId) {
  const { name, slug, input_type, unit, is_required, is_variant, help_text, 
          validation_regex, min_value, max_value, options } = data;

  if (!name || !slug || !input_type) {
    return { status: 400, body: { error: 'Name, slug, and input_type are required' } };
  }

  const result = await query(
    `INSERT INTO item_specifics 
       (name, slug, input_type, unit, is_required, is_variant, help_text, 
        validation_regex, min_value, max_value)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [name, slug, input_type, unit, is_required, is_variant, help_text,
     validation_regex, min_value, max_value]
  );

  const specificId = result.rows[0].id;

  // Add options if provided
  if (options && Array.isArray(options)) {
    for (let i = 0; i < options.length; i++) {
      await query(
        `INSERT INTO item_specific_options (specific_id, value, sort_order)
         VALUES ($1, $2, $3)`,
        [specificId, options[i], i]
      );
    }
  }

  return { status: 201, body: { specific: result.rows[0] } };
}

/**
 * ADMIN: Update item specific
 */
async function updateItemSpecific(specificId, data, userId) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  const allowed = ['name', 'slug', 'input_type', 'unit', 'is_required', 'is_variant',
                   'help_text', 'validation_regex', 'min_value', 'max_value', 'is_active'];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${paramCount++}`);
      values.push(data[key]);
    }
  }

  if (fields.length === 0) {
    return { status: 400, body: { error: 'No valid fields to update' } };
  }

  fields.push(`updated_at = NOW()`);
  values.push(specificId);

  const result = await query(
    `UPDATE item_specifics SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (!result.rows[0]) {
    return { status: 404, body: { error: 'Item specific not found' } };
  }

  return { status: 200, body: { specific: result.rows[0] } };
}

/**
 * ADMIN: Delete item specific
 */
async function deleteItemSpecific(specificId) {
  await query('DELETE FROM item_specifics WHERE id = $1', [specificId]);
  return { status: 200, body: { success: true } };
}

/**
 * ADMIN: Create brand
 */
async function createBrand(data, userId) {
  const { name, slug, logo_url, description, website, is_verified } = data;

  if (!name || !slug) {
    return { status: 400, body: { error: 'Name and slug are required' } };
  }

  try {
    const result = await query(
      `INSERT INTO brands (name, slug, logo_url, description, website, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (name) DO UPDATE SET
         is_verified = EXCLUDED.is_verified,
         logo_url = COALESCE(NULLIF(EXCLUDED.logo_url, ''), brands.logo_url),
         description = COALESCE(NULLIF(EXCLUDED.description, ''), brands.description),
         website = COALESCE(NULLIF(EXCLUDED.website, ''), brands.website),
         is_active = true,
         updated_at = NOW()
       RETURNING *`,
      [name, slug, logo_url || null, description || null, website || null, Boolean(is_verified)]
    );
    return { status: 201, body: { brand: result.rows[0] } };
  } catch (err) {
    if (err?.code === '23505') {
      return { status: 409, body: { error: 'A brand with that name or slug already exists' } };
    }
    throw err;
  }
}

/**
 * ADMIN: Update brand
 */
async function updateBrand(brandId, data, userId) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  const allowed = ['name', 'slug', 'logo_url', 'description', 'website', 'is_verified', 'is_active'];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${paramCount++}`);
      values.push(data[key]);
    }
  }

  if (fields.length === 0) {
    return { status: 400, body: { error: 'No valid fields to update' } };
  }

  fields.push(`updated_at = NOW()`);
  values.push(brandId);

  const result = await query(
    `UPDATE brands SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (!result.rows[0]) {
    return { status: 404, body: { error: 'Brand not found' } };
  }

  return { status: 200, body: { brand: result.rows[0] } };
}

/**
 * ADMIN: Delete brand
 */
async function deleteBrand(brandId) {
  await query('DELETE FROM brands WHERE id = $1', [brandId]);
  return { status: 200, body: { success: true } };
}

/**
 * ADMIN: Create restriction rule
 */
async function createRestriction(data, userId) {
  const { category_id, name, description, keywords, rule_type } = data;

  if (!category_id || !name || !rule_type) {
    return { status: 400, body: { error: 'category_id, name, and rule_type are required' } };
  }

  const result = await query(
    `INSERT INTO restricted_items (category_id, name, description, keywords, rule_type)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [category_id, name, description, keywords || [], rule_type]
  );

  return { status: 201, body: { restriction: result.rows[0] } };
}

/**
 * ADMIN: Delete restriction rule
 */
async function deleteRestriction(restrictionId) {
  await query('DELETE FROM restricted_items WHERE id = $1', [restrictionId]);
  return { status: 200, body: { success: true } };
}
