/**
 * Collectibles taxonomy requested by the client (10 top-level categories).
 *
 * - Idempotent: re-running only adds what is missing and re-syncs attribute options.
 * - Safe: never deletes categories or listings. Old categories can be hidden/restored.
 * - Every node (including L1/L2) gets its own attribute pack, otherwise catalog.mjs would
 *   auto-attach the generic electronics defaults (Brand / Color / Size / Storage).
 * - Attribute slugs are globally unique on purpose: catalog.mjs identifies item_specifics by slug.
 */
import { query, withTx } from "./db.mjs";

// ---------------------------------------------------------------------------------------------
// Attribute definitions (item_specifics). Only text / number / select are used (all render in the sell form).
// ---------------------------------------------------------------------------------------------
const MATERIALS = ["Gold", "Silver", "Bronze", "Copper", "Brass", "Nickel", "Steel", "Leather", "Other"];

export const SPECIFICS = {
  // --- shared ---
  edition: {
    name: "Edition",
    input_type: "select",
    options: ["Standard", "Special Edition", "Limited Edition"],
    help_text: "Special and limited editions can also be listed under Special / Limited Edition Items.",
  },
  "edition-number": { name: "Edition / Serial No.", input_type: "text", help_text: "e.g. 25 of 100" },
  "item-year": { name: "Year", input_type: "number", min: 1, max: 2100, help_text: "Year of issue or manufacture." },
  "item-era": { name: "Era / Period", input_type: "text", help_text: "e.g. Rana period, 19th century" },
  "item-origin": { name: "Country / Region", input_type: "text" },
  "item-material": { name: "Material", input_type: "select", options: MATERIALS },
  authenticity: {
    name: "Authenticity",
    input_type: "select",
    options: ["Certified (with certificate)", "Normal (no certificate)"],
  },
  "authenticity-issuer": { name: "Certified By", input_type: "text", help_text: "Who issued the certificate (if any)." },
  provenance: { name: "Provenance / History", input_type: "text", help_text: "Where the item came from, previous owners." },

  // --- coins & banknotes ---
  "numis-denomination": { name: "Denomination / Face Value", input_type: "text", help_text: "e.g. 10 Rupees" },
  "coin-metal": { name: "Metal / Composition", input_type: "select", options: MATERIALS.filter((m) => !["Leather", "Steel"].includes(m)) },
  "numis-grading-company": {
    name: "Grading Company",
    input_type: "select",
    options: ["Ungraded", "PCGS", "NGC", "ANACS", "PMG", "Other"],
  },
  "banknote-serial": { name: "Serial Number", input_type: "text" },

  // --- stamps ---
  "stamp-status": { name: "Stamp Status", input_type: "select", options: ["Used", "New", "Special Edition"] },
  "stamp-format": {
    name: "Format",
    input_type: "select",
    options: ["Single", "Block", "Sheet", "Strip", "Set / Series", "First Day Cover", "Other"],
  },

  // --- medals & tokens ---
  "medal-type": { name: "Type", input_type: "select", options: ["Medal", "Badge", "Token"] },
  "medal-issuer": { name: "Issued By / Awarded For", input_type: "text" },

  // --- trading cards ---
  "card-game": {
    name: "Game / Sport",
    input_type: "select",
    options: ["Pokemon", "Magic: The Gathering", "Yu-Gi-Oh!", "Cricket", "Football", "Basketball", "Baseball", "Other"],
  },
  "card-set": { name: "Set / Series", input_type: "text" },
  "card-number": { name: "Card Number", input_type: "text" },
  "card-rarity": { name: "Rarity", input_type: "text" },
  "card-grading-company": {
    name: "Graded By",
    input_type: "select",
    options: ["Ungraded", "PSA", "BGS", "CGC", "SGC", "Other"],
  },
  "card-grade": { name: "Grade", input_type: "text", help_text: "e.g. PSA 9, BGS 9.5" },

  // --- image & video rights ---
  "rights-license": {
    name: "License Type",
    input_type: "select",
    options: ["Royalty-free", "Rights-managed", "Exclusive rights", "Non-exclusive", "Editorial use only", "Full copyright transfer"],
  },
  "rights-usage": {
    name: "Permitted Use",
    input_type: "select",
    options: ["Personal", "Commercial", "Editorial", "Broadcast / Media", "Unlimited"],
  },
  "rights-format": { name: "File Format / Resolution", input_type: "text", help_text: "e.g. RAW + JPEG, 4K MP4" },
  "rights-duration": { name: "Video Length", input_type: "text", help_text: "e.g. 00:45 (video only)" },
  "rights-delivery": {
    name: "Delivery",
    input_type: "select",
    options: ["Digital download link", "Email", "Physical media", "Other"],
  },

  // --- autographed ---
  "signed-by": { name: "Signed By", input_type: "text" },
  "signed-item": { name: "Signed Item", input_type: "text", help_text: "e.g. Jersey, photo, ball, album" },

  // --- limited edition ---
  "item-maker": { name: "Maker / Artist / Manufacturer", input_type: "text" },
  "edition-run": { name: "Total Run Size", input_type: "number", min: 1, max: 100000000, help_text: "How many were made, if known." },

  // --- luxury ---
  "luxury-brand": { name: "Brand", input_type: "text" },
  "luxury-model": { name: "Model / Reference", input_type: "text" },
  "luxury-box-papers": {
    name: "Box & Papers",
    input_type: "select",
    options: ["Box and papers", "Box only", "Papers only", "Neither"],
  },
  "luxury-size": { name: "Size", input_type: "text" },
  "watch-movement": { name: "Movement", input_type: "select", options: ["Automatic", "Manual", "Quartz", "Smart", "Other"] },
  "watch-case-size": { name: "Case Size", input_type: "number", unit: "mm", min: 10, max: 70 },
  "jersey-team": { name: "Team / Club", input_type: "text" },
  "jersey-player": { name: "Player", input_type: "text" },
  "ornament-gemstone": { name: "Gemstone", input_type: "text" },
  "ornament-weight": { name: "Weight", input_type: "number", unit: "g", min: 0.01, max: 100000 },

  // --- property & vehicles ---
  "property-location": { name: "Location", input_type: "text", help_text: "District, city or area." },
  "property-area": { name: "Area", input_type: "text", help_text: "e.g. 4 ropani 2 aana, or 1,800 sq ft" },
  "property-bedrooms": { name: "Bedrooms", input_type: "number", min: 0, max: 100 },
  "property-road-access": { name: "Road Access", input_type: "select", options: ["Pitched road", "Gravel road", "Footpath", "None"] },
  "ownership-docs": {
    name: "Ownership Documents",
    input_type: "select",
    options: ["Available (clear title)", "In process", "Not available"],
    help_text: "e.g. Lalpurja / land ownership certificate.",
  },
  "vehicle-make": { name: "Make", input_type: "text" },
  "vehicle-model": { name: "Model", input_type: "text" },
  "vehicle-year": { name: "Year", input_type: "number", min: 1900, max: 2100 },
  "vehicle-mileage": { name: "Mileage", input_type: "number", unit: "km", min: 0, max: 5000000 },
  "vehicle-fuel": { name: "Fuel", input_type: "select", options: ["Petrol", "Diesel", "Electric", "Hybrid", "Other"] },
  "vehicle-transmission": { name: "Transmission", input_type: "select", options: ["Manual", "Automatic"] },
  "vehicle-bluebook": { name: "Registration (Bluebook)", input_type: "select", options: ["Available", "Not available"] },
};

// ---------------------------------------------------------------------------------------------
// Packs of attributes. A node inherits its parent's pack unless it declares its own `specifics`;
// `extra` appends more attributes to the inherited pack.
// ---------------------------------------------------------------------------------------------
const COIN_PACK = ["item-origin", "item-year", "numis-denomination", "coin-metal", "numis-grading-company", "edition", "provenance"];
const NOTE_PACK = ["item-origin", "item-year", "numis-denomination", "banknote-serial", "numis-grading-company", "edition", "provenance"];
const LUXURY_BASE = ["luxury-brand", "luxury-model", "authenticity", "authenticity-issuer", "luxury-box-papers", "item-year", "edition"];

/**
 * level 1..3 only (categories.level CHECK). `icon` is a short emoji used by the home grid.
 * requires_approval is stored as catalog metadata for admins (moderation of these is a follow-up).
 */
export const TAXONOMY = [
  {
    name: "Banknotes & Coins",
    slug: "banknotes-coins",
    icon: "🪙",
    specifics: COIN_PACK,
    children: [
      {
        name: "Coins",
        slug: "coins",
        specifics: COIN_PACK,
        children: [
          { name: "National", slug: "coins-national" },
          { name: "International", slug: "coins-international" },
        ],
      },
      {
        name: "Banknotes",
        slug: "banknotes",
        specifics: NOTE_PACK,
        children: [
          { name: "National", slug: "banknotes-national" },
          { name: "International", slug: "banknotes-international" },
        ],
      },
    ],
  },
  {
    name: "Stamps",
    slug: "stamps",
    icon: "✉️",
    specifics: ["stamp-status", "stamp-format", "item-origin", "item-year", "numis-denomination", "edition", "provenance"],
    children: [
      { name: "National", slug: "stamps-national" },
      { name: "International", slug: "stamps-international" },
    ],
  },
  {
    name: "Medals & Tokens",
    slug: "medals-tokens",
    icon: "🏅",
    specifics: ["medal-type", "item-origin", "item-year", "item-material", "medal-issuer", "edition", "provenance"],
    children: [
      { name: "National", slug: "medals-tokens-national" },
      { name: "International", slug: "medals-tokens-international" },
    ],
  },
  {
    name: "Antiques & Collectibles",
    slug: "antiques-collectibles",
    icon: "🏺",
    specifics: ["item-era", "item-origin", "item-material", "item-year", "authenticity", "authenticity-issuer", "provenance"],
  },
  {
    name: "Trading Cards",
    slug: "trading-cards",
    icon: "🃏",
    specifics: ["card-game", "card-set", "card-number", "card-rarity", "card-grading-company", "card-grade", "item-year", "edition"],
  },
  {
    name: "Image & Video Rights",
    slug: "image-video-rights",
    icon: "🎞️",
    specifics: ["rights-license", "rights-usage", "rights-format", "rights-delivery", "edition-number"],
    children: [
      { name: "Image", slug: "rights-image" },
      { name: "Video", slug: "rights-video", specifics: ["rights-license", "rights-usage", "rights-format", "rights-duration", "rights-delivery"] },
    ],
  },
  {
    name: "Autographed Items",
    slug: "autographed-items",
    icon: "✍️",
    requires_approval: true,
    specifics: ["signed-by", "signed-item", "authenticity", "authenticity-issuer", "item-year", "provenance"],
    children: [
      { name: "Certified", slug: "autographed-certified" },
      { name: "Normal", slug: "autographed-normal" },
    ],
  },
  {
    name: "Special / Limited Edition Items",
    slug: "limited-edition-items",
    icon: "💎",
    specifics: ["edition", "edition-number", "edition-run", "item-maker", "item-year", "authenticity", "provenance"],
  },
  {
    name: "Luxury Items",
    slug: "luxury-items",
    icon: "👑",
    requires_approval: true,
    specifics: LUXURY_BASE,
    children: [
      { name: "Watches", slug: "luxury-watches", specifics: [...LUXURY_BASE, "watch-movement", "watch-case-size"] },
      { name: "Shoes", slug: "luxury-shoes", specifics: [...LUXURY_BASE, "luxury-size"] },
      { name: "Bags", slug: "luxury-bags", specifics: [...LUXURY_BASE, "item-material"] },
      { name: "Ornaments", slug: "luxury-ornaments", specifics: [...LUXURY_BASE, "item-material", "ornament-gemstone", "ornament-weight"] },
      { name: "Jerseys", slug: "luxury-jerseys", specifics: [...LUXURY_BASE, "jersey-team", "jersey-player", "luxury-size"] },
      { name: "Others", slug: "luxury-others" },
    ],
  },
  {
    name: "Others",
    slug: "others",
    icon: "📦",
    specifics: ["item-origin", "item-year", "authenticity", "provenance"],
    children: [
      {
        name: "Homes",
        slug: "others-homes",
        requires_approval: true,
        specifics: ["property-location", "property-area", "property-bedrooms", "property-road-access", "ownership-docs", "item-year"],
      },
      {
        name: "Land",
        slug: "others-land",
        requires_approval: true,
        specifics: ["property-location", "property-area", "property-road-access", "ownership-docs"],
      },
      {
        name: "Bikes",
        slug: "others-bikes",
        requires_approval: true,
        specifics: ["vehicle-make", "vehicle-model", "vehicle-year", "vehicle-mileage", "vehicle-fuel", "vehicle-bluebook"],
      },
      {
        name: "Cars",
        slug: "others-cars",
        requires_approval: true,
        specifics: ["vehicle-make", "vehicle-model", "vehicle-year", "vehicle-mileage", "vehicle-fuel", "vehicle-transmission", "vehicle-bluebook"],
      },
      { name: "Other Items", slug: "others-misc" },
    ],
  },
];

/** Grades used for coins & banknotes. Linked ONLY to Banknotes & Coins through category_conditions. */
export const NUMISMATIC_CONDITIONS = [
  { name: "Circulated", slug: "circulated", description: "Previously used in circulation.", sort_order: 101 },
  { name: "Extra Fine", slug: "extra-fine", description: "A high-grade item with only light signs of use.", sort_order: 102 },
  { name: "AUNC", slug: "aunc", description: "About Uncirculated.", sort_order: 103 },
  { name: "UNC", slug: "unc", description: "Uncirculated.", sort_order: 104 },
];
const NUMISMATIC_CATEGORY_SLUG = "banknotes-coins";

export const NEW_ROOT_SLUGS = TAXONOMY.map((node) => node.slug);

// ---------------------------------------------------------------------------------------------
// Seeder
// ---------------------------------------------------------------------------------------------
async function ensureSpecific(client, slug, def) {
  const found = await client.query("SELECT id FROM item_specifics WHERE slug = $1 LIMIT 1", [slug]);
  let id = found.rows[0]?.id;
  if (id) {
    await client.query(
      `UPDATE item_specifics
       SET name = $1, input_type = $2, unit = $3, is_required = false, min_value = $4, max_value = $5,
           help_text = $6, is_active = true, updated_at = NOW()
       WHERE id = $7`,
      [def.name, def.input_type, def.unit ?? null, def.min ?? null, def.max ?? null, def.help_text ?? null, id],
    );
  } else {
    const inserted = await client.query(
      `INSERT INTO item_specifics (name, slug, input_type, unit, is_required, is_active, min_value, max_value, help_text)
       VALUES ($1, $2, $3, $4, false, true, $5, $6, $7) RETURNING id`,
      [def.name, slug, def.input_type, def.unit ?? null, def.min ?? null, def.max ?? null, def.help_text ?? null],
    );
    id = inserted.rows[0].id;
  }

  if (def.input_type === "select") {
    await client.query("UPDATE item_specific_options SET is_active = false WHERE specific_id = $1", [id]);
    for (const [index, value] of (def.options || []).entries()) {
      const existing = await client.query(
        "SELECT id FROM item_specific_options WHERE specific_id = $1 AND value = $2 LIMIT 1",
        [id, value],
      );
      if (existing.rows[0]) {
        await client.query("UPDATE item_specific_options SET is_active = true, sort_order = $1 WHERE id = $2", [index, existing.rows[0].id]);
      } else {
        await client.query(
          "INSERT INTO item_specific_options (specific_id, value, sort_order, is_active) VALUES ($1, $2, $3, true)",
          [id, value, index],
        );
      }
    }
  }
  return id;
}

async function ensureCategory(client, node, parent, level, sortOrder) {
  const found = await client.query("SELECT * FROM categories WHERE slug = $1", [node.slug]);
  if (found.rows[0]) {
    // Existing node: only make sure it is visible. Never overwrite names/flags an admin has edited.
    await client.query(
      "UPDATE categories SET is_active = true, icon = COALESCE(icon, $2), updated_at = NOW() WHERE id = $1",
      [found.rows[0].id, node.icon ?? null],
    );
    return { row: found.rows[0], created: false };
  }

  let lft;
  if (parent) {
    const fresh = (await client.query("SELECT rgt FROM categories WHERE id = $1", [parent.id])).rows[0];
    lft = fresh.rgt;
    await client.query("UPDATE categories SET rgt = rgt + 2 WHERE rgt >= $1", [lft]);
    await client.query("UPDATE categories SET lft = lft + 2 WHERE lft > $1", [lft]);
  } else {
    const max = (await client.query("SELECT COALESCE(MAX(rgt), 0)::int AS m FROM categories")).rows[0].m;
    lft = max + 1;
  }
  const inserted = await client.query(
    `INSERT INTO categories (name, slug, parent_id, level, lft, rgt, icon, sort_order, is_active, requires_approval)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9) RETURNING *`,
    [node.name, node.slug, parent?.id ?? null, level, lft, lft + 1, node.icon ?? null, sortOrder, Boolean(node.requires_approval)],
  );
  return { row: inserted.rows[0], created: true };
}

async function attachPack(client, categoryId, slugs, specificIds) {
  const wanted = [];
  for (const [index, slug] of slugs.entries()) {
    const specificId = specificIds.get(slug);
    if (!specificId) throw new Error(`Unknown attribute slug in taxonomy: ${slug}`);
    wanted.push(specificId);
    await client.query(
      `INSERT INTO category_specifics (category_id, specific_id, is_required, sort_order)
       VALUES ($1, $2, false, $3)
       ON CONFLICT (category_id, specific_id) DO UPDATE SET sort_order = EXCLUDED.sort_order`,
      [categoryId, specificId, index + 1],
    );
  }
  // Drop attributes that are no longer part of this node's pack (e.g. auto-attached electronics defaults).
  await client.query(
    "DELETE FROM category_specifics WHERE category_id = $1 AND NOT (specific_id = ANY($2::int[]))",
    [categoryId, wanted],
  );
}

class DryRunRollback extends Error {}

const DESCRIBE_SQL = `SELECT c.level, c.name, c.slug, c.is_active,
            (SELECT COUNT(*)::int FROM category_specifics cs WHERE cs.category_id = c.id) AS attributes
     FROM categories c ORDER BY c.lft`;

/** dryRun: executes everything inside the transaction, captures the result, then rolls back. */
export async function seedTaxonomy({ retireOld = false, dryRun = false } = {}) {
  const summary = { categoriesCreated: 0, categoriesTotal: 0, retired: 0, dryRun, preview: null };

  try {
    await seedInTransaction(summary, retireOld, dryRun);
  } catch (err) {
    if (!(err instanceof DryRunRollback)) throw err;
  }
  return summary;
}

async function seedInTransaction(summary, retireOld, dryRun) {
  await withTx(async (client) => {
    const specificIds = new Map();
    for (const [slug, def] of Object.entries(SPECIFICS)) {
      specificIds.set(slug, await ensureSpecific(client, slug, def));
    }

    async function walk(nodes, parent, level, inherited) {
      for (const [index, node] of nodes.entries()) {
        const { row, created } = await ensureCategory(client, node, parent, level, index + 1);
        if (created) summary.categoriesCreated += 1;
        summary.categoriesTotal += 1;
        const pack = node.specifics ?? inherited ?? [];
        if (pack.length) await attachPack(client, row.id, pack, specificIds);
        if (node.children?.length) await walk(node.children, row, level + 1, pack);
      }
    }
    await walk(TAXONOMY, null, 1, null);

    // Numismatic grades: scoped to Banknotes & Coins (and everything beneath it).
    const numis = (await client.query("SELECT id FROM categories WHERE slug = $1", [NUMISMATIC_CATEGORY_SLUG])).rows[0];
    for (const [index, cond] of NUMISMATIC_CONDITIONS.entries()) {
      const upserted = await client.query(
        `INSERT INTO conditions (name, slug, description, sort_order, is_active)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description,
                                          sort_order = EXCLUDED.sort_order, is_active = true
         RETURNING id`,
        [cond.name, cond.slug, cond.description, cond.sort_order],
      );
      await client.query(
        `INSERT INTO category_conditions (category_id, condition_id, is_default)
         VALUES ($1, $2, $3) ON CONFLICT (category_id, condition_id) DO NOTHING`,
        [numis.id, upserted.rows[0].id, index === 0],
      );
    }

    if (retireOld) summary.retired = await setOldCategoriesActive(client, false);

    if (dryRun) {
      summary.preview = (await client.query(DESCRIBE_SQL)).rows;
      throw new DryRunRollback("dry run - rolled back");
    }
  });
}

/** Hide (false) or show (true) every top-level tree that is not part of the new taxonomy. Reversible. */
export async function setOldCategoriesActive(client, active) {
  const roots = await client.query(
    "SELECT id, lft, rgt FROM categories WHERE parent_id IS NULL AND NOT (slug = ANY($1::text[]))",
    [NEW_ROOT_SLUGS],
  );
  let touched = 0;
  for (const root of roots.rows) {
    const result = await client.query(
      "UPDATE categories SET is_active = $1, updated_at = NOW() WHERE lft >= $2 AND rgt <= $3 AND is_active <> $1",
      [active, root.lft, root.rgt],
    );
    touched += result.rowCount ?? 0;
  }
  return touched;
}

export async function restoreOldCategories() {
  return withTx((client) => setOldCategoriesActive(client, true));
}

export async function describeTaxonomy() {
  const { rows } = await query(DESCRIBE_SQL);
  return rows;
}
