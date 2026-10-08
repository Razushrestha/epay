/**
 * Catalog API Router - Categories, Brands, Conditions, Item Specifics
 * Handles category tree management, item specifics configuration, and catalog browsing
 */

import { query } from './db.mjs';

/**
 * Main catalog router handler
 */
export async function handleCatalog(req, method, urlPath, headers, body, ipAddress, userAgent) {
  const url = new URL(`http://localhost${urlPath}`);
  const pathParts = url.pathname.replace('/api/v1/catalog', '').split('/').filter(Boolean);

  try {
    // Public endpoints (no auth required)
    if (method === 'GET' && pathParts[0] === 'categories') {
      if (!pathParts[1]) return await getCategories(url.searchParams);
      if (pathParts[1] === 'tree') return await getCategoryTree();
      if (pathParts[2] === 'specifics') return await getCategorySpecifics(pathParts[1]);
      return await getCategoryBySlug(pathParts[1]);
    }

    if (method === 'GET' && pathParts[0] === 'conditions') {
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
     WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.is_staff = true`,
    [hash]
  );
  return result.rows[0] || null;
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
      (SELECT COUNT(*) FROM categories WHERE parent_id = c.id) as child_count
    FROM categories c
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

  sql += ` ORDER BY c.sort_order, c.name`;

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
  const catResult = await query(
    `SELECT c.*, 
       (SELECT json_agg(json_build_object(
         'id', p.id, 'name', p.name, 'slug', p.slug, 'level', p.level
       ) ORDER BY p.level)
        FROM categories p
        WHERE p.lft < c.lft AND p.rgt > c.rgt) as breadcrumb,
       (SELECT COUNT(*) FROM categories WHERE parent_id = c.id) as child_count
     FROM categories c
     WHERE c.slug = $1`,
    [slug]
  );

  if (!catResult.rows[0]) {
    return { status: 404, body: { error: 'Category not found' } };
  }

  const category = catResult.rows[0];

  // Get subcategories
  const subResult = await query(
    `SELECT id, name, slug, icon, image_url, item_count
     FROM categories
     WHERE parent_id = $1 AND is_active = true
     ORDER BY sort_order, name`,
    [category.id]
  );

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
async function getCategorySpecifics(slug) {
  const catResult = await query('SELECT id FROM categories WHERE slug = $1', [slug]);
  if (!catResult.rows[0]) {
    return { status: 404, body: { error: 'Category not found' } };
  }

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
  const { name, slug, parent_id, level, icon, image_url, description, is_restricted, requires_approval } = data;

  if (!name || !slug) {
    return { status: 400, body: { error: 'Name and slug are required' } };
  }

  // Calculate lft/rgt for nested set
  let lft, rgt;
  if (parent_id) {
    const parentResult = await query('SELECT rgt FROM categories WHERE id = $1', [parent_id]);
    if (!parentResult.rows[0]) {
      return { status: 400, body: { error: 'Parent category not found' } };
    }
    rgt = parentResult.rows[0].rgt;
    lft = rgt;
    // Update existing nodes
    await query('UPDATE categories SET rgt = rgt + 2 WHERE rgt >= $1', [rgt]);
    await query('UPDATE categories SET lft = lft + 2 WHERE lft > $1', [rgt]);
  } else {
    const maxResult = await query('SELECT COALESCE(MAX(rgt), 0) + 1 as next_lft FROM categories');
    lft = maxResult.rows[0].next_lft;
    rgt = lft + 1;
  }

  const result = await query(
    `INSERT INTO categories 
       (name, slug, parent_id, level, lft, rgt, icon, image_url, description, 
        is_restricted, requires_approval)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [name, slug, parent_id, level || 1, lft, rgt, icon, image_url, description, 
     is_restricted || false, requires_approval || false]
  );

  // Audit log
  await query(
    `INSERT INTO category_audit_log (category_id, action, changed_by, changes, ip_address, user_agent)
     VALUES ($1, 'created', $2, $3, $4, $5)`,
    [result.rows[0].id, userId, JSON.stringify({ name, slug, parent_id }), ipAddress, userAgent]
  );

  return { status: 201, body: { category: result.rows[0] } };
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

  const result = await query(
    `INSERT INTO brands (name, slug, logo_url, description, website, is_verified)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [name, slug, logo_url, description, website, is_verified || false]
  );

  return { status: 201, body: { brand: result.rows[0] } };
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
