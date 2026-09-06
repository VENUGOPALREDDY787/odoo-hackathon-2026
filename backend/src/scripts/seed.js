/**
 * DealFlow360 Comprehensive Demo Seed
 * ====================================
 *
 * Generates ~1,000 interconnected, realistic records across every module so the
 * dashboards, kanban, approvals, subscriptions, negotiation, deal-health and
 * reporting screens look like a real production system.
 *
 * Data is generated IN FK-SAFE ORDER:
 *   1. users (reuse demo accounts from seed_demo_users.js, add more reps)
 *   2. product_categories -> products -> product_variants -> price list
 *   3. warehouses -> stock_levels
 *   4. discount_tiers + approval_chains (spec ceilings + routing)
 *   5. customers (assigned reps, tier mix)
 *   6. quotations + quotation_lines + approval_logs (risk-engine aware)
 *   7. subscriptions -> billing_schedules
 *   8. negotiation_logs (some deals pushed back into approval)
 *   9. fulfillment_splits (feeds delivery-slippage detection)
 *  10. upsell_rules (margin-threshold aware)
 *  11. run the real deal-health detectors once
 *  12. verification queries + summary
 *
 * Idempotency:
 *   - Static/reference data (users, categories, products, warehouses, plans,
 *     price lists, tiers, chains, upsell rules) is inserted only if missing.
 *   - Transactional data (customers, quotations, lines, logs, schedules,
 *     splits) carries a marker. If the marker is already present the script
 *     SKIPS in production, and CLEARS + RESEEDS in development so a second
 *     run refreshes the demo without duplicating rows.
 *
 * Safety:
 *   - The whole seed runs inside a single knex transaction — a failure rolls
 *     everything back, leaving no partial data.
 *   - Business logic files are NOT modified. The pure risk-scoring functions
 *     are imported only to compute/verify the blended-risk scores and approval
 *     routing of the generated quotations.
 */

import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/index.js';
import { getDatabase, closeDatabase } from '../utils/database.js';
import { logger } from '../utils/logger.js';
import { InProcessCache } from '../utils/cache.js';
import { DealHealthService } from '../modules/dealHealth/services/DealHealthService.js';
import { calculateBlendedRisk, routeApproval } from '../modules/discounts/services/riskScorer.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const MARKER = 'full_demo_seed_v1';
const DEMO_PASSWORD = 'DemoPass2026';
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

const TARGETS = {
  customers: 150,
  products: 120,
  warehouses: 6,
  quotations: 400,
  subscriptions: 80,   // recurring quotation lines carrying subscription plans
  negotiations: 60,    // quotations with negotiation history
  upsellRules: 50,
};

// The three product categories the app actually uses.
const CATEGORY_NAMES = ['Hardware', 'Services', 'Subscriptions/SaaS'];

// Customer tier mix (schema has no Platinum tier, so Gold absorbs that share).
const TIER_SHARE = [
  { tier: 'Bronze', share: 0.40 },
  { tier: 'Silver', share: 0.35 },
  { tier: 'Gold', share: 0.25 },
];

// Discount ceilings per customer tier (%).
// Services get a thinner ceiling because its margins are genuinely thinner —
// the blended-risk engine depends on that gap existing in the data.
const CEILING_GENERAL = { Bronze: 5, Silver: 10, Gold: 15 };
const CEILING_SERVICES = { Bronze: 3, Silver: 7, Gold: 10 };

// Approval routing: blended violation points (summed across lines) vs chains.
// 0.01-10  -> manager sign-off only
// >10      -> manager AND finance dual sign-off
const CHAIN_MANAGER = { min: 0.01, max: 10.0, roles: ['manager'], approvals: 1 };
const CHAIN_DUAL = { min: 10.01, max: 100.0, roles: ['manager', 'finance'], approvals: 2 };

// Approval-trigger scenario mix for quotations.
const SCENARIO_MIX = { normal: 0.70, singleBreach: 0.20, blendedBreach: 0.10 };

const TAX_RATE = 18; // GST on INR quotations

// ============================================================================
// HELPERS
// ============================================================================

const money = (value) => Math.round(value * 100) / 100;
const randInt = (min, max) => faker.number.int({ min, max });
const pick = (items) => items[randInt(0, items.length - 1)];
const chance = (probability) => Math.random() < probability;
const daysFromNow = (days) => new Date(Date.now() + days * 86400000);
const addDays = (date, days) => new Date(date.getTime() + days * 86400000);
const formatDate = (date) => date.toISOString().slice(0, 10);

async function getColumns(db, table) {
  const rows = await db('information_schema.columns')
    .where({ table_schema: config.DB_NAME, table_name: table })
    .select('column_name');
  // mysql2 may return information_schema columns uppercased (COLUMN_NAME).
  return new Set(rows.map((row) => row.column_name || row.COLUMN_NAME));
}

function shape(row, columns) {
  return Object.fromEntries(Object.entries(row).filter(([key]) => columns.has(key)));
}

async function insertRows(trx, table, rows, chunkSize = 100) {
  if (!rows.length) {return 0;}
  try {
    await trx.batchInsert(table, rows, chunkSize);
  } catch (error) {
    console.error(`[seed] insertRows failed for table '${table}' (${rows.length} rows). First row keys:`, Object.keys(rows[0] || {}));
    throw error;
  }
  return rows.length;
}

/** Insert rows only when their unique key isn't already present. */
async function insertMissingBy(trx, table, rows, key) {
  if (!rows.length) {return [];}
  const columns = await getColumns(trx, table);
  const existingRows = await trx(table).whereIn(key, rows.map((row) => row[key])).select(key);
  const existing = new Set(existingRows.map((row) => row[key]));
  const missing = rows
    .filter((row) => !existing.has(row[key]))
    .map((row) => shape(row, columns));
  if (missing.length) {
    try {
      await trx.batchInsert(table, missing, 100);
    } catch (error) {
      console.error(`[seed] insertMissingBy failed for table '${table}' (${missing.length} new of ${rows.length}). Sample row:`, JSON.stringify(missing[0]));
      throw error;
    }
  }
  return trx(table).whereIn(key, rows.map((row) => row[key])).select('*');
}

const REQUIRED_TABLES = [
  'users',
  'customers',
  'product_categories',
  'products',
  'product_variants',
  'warehouses',
  'stock_levels',
  'price_lists',
  'price_list_items',
  'discount_tiers',
  'approval_chains',
  'subscription_plans',
  'upsell_rules',
  'quotations',
  'quotation_lines',
  'approval_logs',
  'fulfillment_splits',
  'billing_schedules',
  'negotiation_logs',
  'deal_health_alerts',
];

async function ensureRequiredTables(db) {
  const missing = [];
  for (const table of REQUIRED_TABLES) {
    if (!(await db.schema.hasTable(table))) {missing.push(table);}
  }
  if (missing.length) {
    throw new Error(`Missing tables: ${missing.join(', ')}. Apply the schema (docker-compose init or schema_mysql.sql) before seeding.`);
  }
}

// ============================================================================
// SEED SECTIONS
// ============================================================================

/** Users: reuse the seed_demo_users accounts, add extra reps/managers/customers. */
async function seedUsers(trx, now, passwordHash) {
  const userRows = [
    { email: 'rep.demo@dealflow360.local', full_name: 'Demo Sales Rep', role: 'rep' },
    { email: 'manager.demo@dealflow360.local', full_name: 'Demo Sales Manager', role: 'manager' },
    { email: 'finance.demo@dealflow360.local', full_name: 'Demo Finance Lead', role: 'finance' },
    { email: 'admin.demo@dealflow360.local', full_name: 'Demo Administrator', role: 'admin' },
    { email: 'customer.demo@dealflow360.local', full_name: 'Demo Customer', role: 'customer' },
  ];

  // Extra internal users so anomaly detection has multiple reps with baselines.
  for (let i = 1; i <= 14; i += 1) {
    userRows.push({
      email: `rep.${i}@dealflow360.local`,
      full_name: faker.person.fullName(),
      role: 'rep',
      phone: faker.phone.number(),
    });
  }
  for (let i = 1; i <= 3; i += 1) {
    userRows.push({
      email: `manager.${i}@dealflow360.local`,
      full_name: faker.person.fullName(),
      role: 'manager',
      phone: faker.phone.number(),
    });
  }
  for (let i = 1; i <= 2; i += 1) {
    userRows.push({
      email: `finance.${i}@dealflow360.local`,
      full_name: faker.person.fullName(),
      role: 'finance',
      phone: faker.phone.number(),
    });
  }
  userRows.push({
    email: 'admin.ops@dealflow360.local',
    full_name: faker.person.fullName(),
    role: 'admin',
    phone: faker.phone.number(),
  });
  for (let i = 1; i <= 8; i += 1) {
    userRows.push({
      email: `customer.${i}@dealflow360.local`,
      full_name: faker.person.fullName(),
      role: 'customer',
    });
  }

  const payloads = userRows.map((row) => ({
    id: uuidv4(),
    ...row,
    password_hash: passwordHash,
    is_active: true,
    last_login_at: chance(0.7) ? daysFromNow(-randInt(1, 20)) : null,
    created_at: daysFromNow(-randInt(120, 200)),
    updated_at: now,
  }));

  const persisted = await insertMissingBy(trx, 'users', payloads, 'email');
  return {
    all: persisted,
    reps: persisted.filter((u) => u.role === 'rep'),
    managers: persisted.filter((u) => u.role === 'manager'),
    finance: persisted.filter((u) => u.role === 'finance'),
    admins: persisted.filter((u) => u.role === 'admin'),
    customers: persisted.filter((u) => u.role === 'customer'),
  };
}

/** Product categories used by the app. */
async function seedCategories(trx, now) {
  const rows = CATEGORY_NAMES.map((name) => ({
    id: uuidv4(),
    name,
    description: `${name} catalog group for the DealFlow360 demo.`,
    created_at: now,
    updated_at: now,
  }));
  const persisted = await insertMissingBy(trx, 'product_categories', rows, 'name');
  const byName = Object.fromEntries(persisted.map((c) => [c.name, c]));
  return {
    hardware: byName['Hardware'],
    services: byName['Services'],
    saas: byName['Subscriptions/SaaS'],
  };
}

/** Products (+variants) with realistic INR pricing and category-aware margins. */
async function seedProducts(trx, now, categories) {
  const categoryNames = Object.values(categories).map((c) => c.name);
  const productRows = [];
  const variantRows = [];

  // Cost ratios deliberately differ per category so Services margins are thin.
  const costRatio = (categoryName) => {
    if (categoryName === 'Hardware') {return 0.55 + (randInt(0, 10) / 100);}      // 35-45% margin
    if (categoryName === 'Services') {return 0.82 + (randInt(0, 8) / 100);}       // 10-18% margin
    return 0.70 + (randInt(0, 10) / 100);                                        // 20-30% margin
  };

  const priceRange = (categoryName) => {
    if (categoryName === 'Hardware') {return [15000, 450000];}
    if (categoryName === 'Services') {return [20000, 300000];}
    return [2500, 120000]; // per seat / month
  };

  const hardwareFamilies = [
    'AETHER Edge Gateway', 'DealFlow Core Appliance', 'Revenue Intelligence Node',
    'Warehouse Sync Gateway', 'Risk Orchestrator Rack', 'Customer Portal Shield',
  ];
  const serviceFamilies = [
    'Implementation Package', 'Solution Architecture Workshop', 'Managed Operations Retainer',
    'Data Migration Service', 'Integration Engineering Sprint', 'Security Hardening Review',
  ];
  const saasFamilies = [
    'DealFlow360 Enterprise License', 'Pricing Governance Suite', 'Billing Schedule Engine',
    'Negotiation Autopilot Seat', 'Analytics Mesh Subscription', 'Customer Portal Shield SaaS',
  ];

  for (let i = 0; i < TARGETS.products; i += 1) {
    const categoryName = categoryNames[i % categoryNames.length];
    const category = categories[categoryName === 'Hardware' ? 'hardware' : categoryName === 'Services' ? 'services' : 'saas'];
    const [minPrice, maxPrice] = priceRange(categoryName);
    const basePrice = money(randInt(minPrice, maxPrice));
    const costPrice = money(basePrice * costRatio(categoryName));
    const recurring = categoryName !== 'Hardware' && (categoryName === 'Subscriptions/SaaS' || chance(0.3));
    const family = categoryName === 'Hardware' ? pick(hardwareFamilies) : categoryName === 'Services' ? pick(serviceFamilies) : pick(saasFamilies);
    const skuPrefix = categoryName === 'Hardware' ? 'HW' : categoryName === 'Services' ? 'SV' : 'SA';

    const product = {
      id: uuidv4(),
      sku: `${skuPrefix}-${String(i + 1).padStart(4, '0')}`,
      name: `${family} ${faker.commerce.productAdjective()} ${i + 1}`,
      description: `${categoryName} offering seeded for the DealFlow360 demo.`,
      category_id: category.id,
      base_price: basePrice,
      cost_price: costPrice,
      unit_of_measure: categoryName === 'Subscriptions/SaaS' ? 'seat/mo' : categoryName === 'Services' ? 'day' : 'EA',
      weight_kg: categoryName === 'Hardware' ? money(randInt(150, 4500) / 100) : null,
      dimensions_cm: categoryName === 'Hardware' ? JSON.stringify({ l: randInt(20, 60), w: randInt(20, 60), h: randInt(5, 30) }) : null,
      is_active: chance(0.97),
      is_recurring_eligible: recurring ? 1 : 0,
      metadata: JSON.stringify({ seed: MARKER, family, category: categoryName }),
      created_at: daysFromNow(-randInt(120, 200)),
      updated_at: now,
    };
    productRows.push(product);

    // 2-3 variants for ~30% of products.
    if (chance(0.3)) {
      const variantCount = randInt(2, 3);
      const adjustments = ['Standard Config', 'High-Capacity', 'Enterprise'];
      for (let v = 0; v < variantCount; v += 1) {
        const priceAdj = money(basePrice * ((v * 0.08) + 0.05));
        variantRows.push({
          id: uuidv4(),
          product_id: product.id,
          sku: `${product.sku}-V${v + 1}`,
          name: adjustments[v],
          attributes: JSON.stringify({ configuration: adjustments[v], tier: v + 1 }),
          price_adjustment: priceAdj,
          cost_adjustment: money(priceAdj * costRatio(categoryName)),
          is_active: true,
          created_at: daysFromNow(-randInt(100, 180)),
          updated_at: now,
        });
      }
    }
  }

  const products = await insertMissingBy(trx, 'products', productRows, 'sku');
  const variants = await insertMissingBy(trx, 'product_variants', variantRows, 'sku');
  return { products, variants };
}

/** A single default INR price list with base-tier items for every product. */
async function seedPriceList(trx, now, products) {
  const columns = await getColumns(trx, 'price_lists');
  const list = {
    id: uuidv4(),
    name: 'Standard INR Catalog 2026',
    description: `[SEED:${MARKER}] Default price list for the demo catalog.`,
    currency: 'INR',
    is_default: true,
    effective_from: '2026-01-01',
    effective_to: null,
    created_at: now,
    updated_at: now,
  };
  const existing = await trx('price_lists').where({ name: list.name }).whereNull('deleted_at').first();
  const listId = existing ? existing.id : (await insertRows(trx, 'price_lists', [shape(list, columns)]), list.id);

  const itemColumns = await getColumns(trx, 'price_list_items');
  const items = products.map((product) => ({
    id: uuidv4(),
    price_list_id: listId,
    product_id: product.id,
    variant_id: null,
    customer_tier: 'Bronze',
    min_quantity: 1,
    max_quantity: null,
    unit_price: Number(product.base_price),
    created_at: now,
    updated_at: now,
  }));
  const existingItems = await trx('price_list_items').where({ price_list_id: listId }).select('product_id');
  const have = new Set(existingItems.map((r) => r.product_id));
  const missing = items.filter((item) => !have.has(item.product_id)).map((item) => shape(item, itemColumns));
  await insertRows(trx, 'price_list_items', missing, 250);
  return listId;
}

/** Warehouses + per-product stock levels with ~15% low/zero stock. */
async function seedWarehousesAndStock(trx, now, products) {
  const cityNames = ['Mumbai Central DC', 'Bengaluru Tech Hub', 'Delhi NCR Fulfilment', 'Hyderabad South Hub', 'Chennai Port Warehouse', 'Pune Logistics Center'];
  const warehouseRows = cityNames.map((name, i) => ({
    id: uuidv4(),
    code: `WH-SEED-${String(i + 1).padStart(2, '0')}`,
    name,
    address: JSON.stringify({
      street: faker.location.streetAddress(),
      city: name.split(' ')[0],
      state: pick(['Maharashtra', 'Karnataka', 'Delhi', 'Telangana', 'Tamil Nadu', 'Pune']),
      country: 'India',
      postal_code: faker.location.zipCode('######'),
    }),
    contact_email: `ops@${name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.in`,
    contact_phone: faker.phone.number(),
    is_default: i === 0,
    is_active: true,
    created_at: daysFromNow(-randInt(100, 200)),
    updated_at: now,
  }));
  const warehouses = await insertMissingBy(trx, 'warehouses', warehouseRows, 'code');

  const stockColumns = await getColumns(trx, 'stock_levels');
  const stockRows = [];
  for (let p = 0; p < products.length; p += 1) {
    const product = products[p];
    const warehouseCount = randInt(2, 3);
    for (let w = 0; w < warehouseCount; w += 1) {
      const warehouse = warehouses[(p + w) % warehouses.length];
      const lowStock = chance(0.15);
      const quantityOnHand = lowStock ? randInt(0, 5) : randInt(15, 400);
      stockRows.push({
        id: uuidv4(),
        warehouse_id: warehouse.id,
        product_id: product.id,
        variant_id: null,
        quantity_on_hand: quantityOnHand,
        quantity_reserved: randInt(0, Math.max(0, Math.floor(quantityOnHand * 0.3))),
        reorder_point: randInt(10, 20),
        reorder_quantity: randInt(50, 150),
        last_counted_at: daysFromNow(-randInt(0, 14)),
        created_at: daysFromNow(-randInt(60, 180)),
        updated_at: now,
      });
    }
  }
  await insertRows(trx, 'stock_levels', stockRows.map((row) => shape(row, stockColumns)), 250);
  return warehouses;
}

/**
 * Ceiling map: Services gets the thin ceiling, everything else (Hardware and
 * Subscriptions/SaaS) uses the general tier ceiling.
 */
function ceilingFor(categoryId, categories, tier) {
  if (categoryId === categories.services.id) {return CEILING_SERVICES[tier];}
  return CEILING_GENERAL[tier];
}

/** Build the discount_tiers row payloads for every tier x category combo. */
function discountTierPayloads(categories, now) {
  const rows = [];
  for (const category of Object.values(categories)) {
    for (const tier of ['Bronze', 'Silver', 'Gold']) {
      const ceiling = ceilingFor(category.id, categories, tier);
      rows.push({
        id: uuidv4(),
        customer_tier: tier,
        category_id: category.id,
        product_id: null,
        min_quantity: 1,
        max_quantity: null,
        discount_percent: ceiling,
        discount_fixed_amount: 0,
        priority: 20,
        is_active: 1,
        effective_from: '2026-01-01',
        effective_to: null,
        created_at: now,
        updated_at: now,
      });
    }
  }
  return rows;
}

/** Tier rows shaped for calculateBlendedRisk (uses real category ids). */
function riskTierRows(categories) {
  return discountTierPayloads(categories, new Date()).map((tier) => ({
    customer_tier: tier.customer_tier,
    category_id: tier.category_id,
    discount_percent: tier.discount_percent,
    is_active: true,
  }));
}

/** Discount ceilings (spec) + approval chains (manager / manager+finance). */
async function seedDiscountGovernance(trx, now, categories) {
  const tierColumns = await getColumns(trx, 'discount_tiers');
  const chainColumns = await getColumns(trx, 'approval_chains');

  // The schema enforces chk_discount_either (category XOR product), so ceilings
  // are expressed per category: Hardware + SaaS at Bronze 5% / Silver 10% /
  // Gold 15%, Services at Bronze 3% / Silver 7% / Gold 10% (thin margins).
  const tierRows = discountTierPayloads(categories, now).map((row) => shape(row, tierColumns));
  for (const row of tierRows) {
    const exists = await trx('discount_tiers')
      .where({ customer_tier: row.customer_tier, category_id: row.category_id, discount_percent: row.discount_percent })
      .whereNull('deleted_at')
      .first();
    if (!exists) {await trx('discount_tiers').insert(row);}
  }

  const chainRows = [
    {
      id: uuidv4(),
      name: '[DEMO] Manager Approval',
      description: 'Blended risk score 0.01-10%: single manager sign-off required.',
      min_discount_percent: CHAIN_MANAGER.min,
      max_discount_percent: CHAIN_MANAGER.max,
      required_approver_roles: JSON.stringify(CHAIN_MANAGER.roles),
      min_approvals_required: CHAIN_MANAGER.approvals,
      is_active: 1,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      name: '[DEMO] Manager + Finance Dual Signoff',
      description: 'Blended risk score >10%: manager then finance sign-off required.',
      min_discount_percent: CHAIN_DUAL.min,
      max_discount_percent: CHAIN_DUAL.max,
      required_approver_roles: JSON.stringify(CHAIN_DUAL.roles),
      min_approvals_required: CHAIN_DUAL.approvals,
      is_active: 1,
      created_at: now,
      updated_at: now,
    },
  ].map((row) => shape(row, chainColumns));

  const managerChainId = chainRows[0].id;
  const dualChainId = chainRows[1].id;
  for (const row of chainRows) {
    const exists = await trx('approval_chains').where({ name: row.name }).whereNull('deleted_at').first();
    if (!exists) {await trx('approval_chains').insert(row);}
  }

  return { managerChainId, dualChainId };
}

/** Subscription plans across monthly/quarterly/yearly intervals. */
async function seedSubscriptionPlans(trx, now) {
  const plans = [];
  const definitions = [
    { interval: 'monthly', names: ['DealFlow360 Monthly Seat', 'Pricing Suite Monthly', 'Analytics Monthly'], base: [900, 2500, 1800] },
    { interval: 'quarterly', names: ['DealFlow360 Quarterly Seat', 'Governance Suite Quarterly', 'Ops Retainer Quarterly'], base: [2400, 6900, 4200] },
    { interval: 'yearly', names: ['DealFlow360 Annual Enterprise', 'Billing Engine Annual', 'Customer Portal Annual'], base: [8400, 24000, 15000] },
  ];

  for (const def of definitions) {
    def.names.forEach((name, i) => {
      plans.push({
        id: uuidv4(),
        name,
        description: `${def.interval} subscription plan seeded for the demo.`,
        interval_type: def.interval,
        interval_count: 1,
        base_price: def.base[i],
        setup_fee: i === 0 ? randInt(0, 5000) : 0,
        trial_days: i === 0 ? 14 : 0,
        proration_rule: 'day_based',
        max_users: randInt(50, 2000),
        features: JSON.stringify({ seed: MARKER, category: 'subscription', interval: def.interval }),
        is_active: true,
        created_at: daysFromNow(-randInt(100, 200)),
        updated_at: now,
      });
    });
  }
  return insertMissingBy(trx, 'subscription_plans', plans, 'name');
}

/** Customers with a realistic tier mix and assigned reps. */
async function seedCustomers(trx, now, users) {
  const internalUsers = [...users.reps, ...users.managers];
  const customerRows = [];
  let tierCursor = 0;

  for (let i = 0; i < TARGETS.customers; i += 1) {
    // Rotate through the tier mix to hit the target distribution (40/35/25).
    while (tierCursor < TIER_SHARE.length && i / TARGETS.customers > TIER_SHARE[tierCursor].share) {
      tierCursor += 1;
    }
    const tier = TIER_SHARE[Math.min(tierCursor, TIER_SHARE.length - 1)].tier;

    const companyName = `${faker.company.name()} ${String(i + 1).padStart(3, '0')}`;
    const creditLimit = randInt(500000, 6000000);
    customerRows.push({
      id: uuidv4(),
      user_id: null, // linked to a customer user account below
      company_name: companyName,
      legal_name: `${companyName} Private Limited`,
      tax_id: `GSTIN-${randInt(100000000000000, 999999999999999)}`,
      tier,
      billing_address: JSON.stringify({
        street: faker.location.streetAddress(),
        city: pick(['Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune', 'Chennai', 'Noida', 'Ahmedabad', 'Kochi', 'Jaipur']),
        state: pick(['Karnataka', 'Maharashtra', 'Delhi', 'Telangana', 'Maharashtra', 'Tamil Nadu', 'Uttar Pradesh', 'Gujarat', 'Kerala', 'Rajasthan']),
        country: 'India',
        postal_code: faker.location.zipCode('######'),
      }),
      shipping_address: JSON.stringify({
        street: faker.location.streetAddress(),
        city: pick(['Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune', 'Chennai', 'Noida', 'Ahmedabad', 'Kochi', 'Jaipur']),
        state: pick(['Karnataka', 'Maharashtra', 'Delhi', 'Telangana', 'Maharashtra', 'Tamil Nadu', 'Uttar Pradesh', 'Gujarat', 'Kerala', 'Rajasthan']),
        country: 'India',
        postal_code: faker.location.zipCode('######'),
      }),
      payment_terms_days: pick([15, 30, 45, 60]),
      credit_limit: creditLimit,
      credit_used: randInt(0, Math.floor(creditLimit * 0.6)),
      currency: 'INR',
      primary_contact_id: null,
      assigned_rep_id: internalUsers[i % internalUsers.length].id,
      notes: `[SEED:${MARKER}] Segment: ${pick(['Enterprise', 'Mid-market', 'Strategic', 'SMB'])}.`,
      created_at: daysFromNow(-randInt(30, 240)),
      updated_at: now,
    });
  }

  // Link the first 8 customers to customer user accounts so the Customer Portal
  // has real logins.
  for (let i = 0; i < Math.min(8, users.customers.length); i += 1) {
    customerRows[i].user_id = users.customers[i].id;
  }

  const columns = await getColumns(trx, 'customers');
  const customers = customerRows.map((row) => shape(row, columns));
  await insertRows(trx, 'customers', customers, 100);
  return customers;
}

/**
 * Build a quotation with 1-5 lines, computing real totals and blended risk.
 * Returns { quotation, lines, approvalLogs, scenario, blendedScore, requiredRoles }.
 */
function buildQuotation({ index, customers, products, variants, categories, discountScenario, deep = false }) {
  const customer = customers[index % customers.length];
  const repId = customer.assigned_rep_id;
  const tier = customer.tier;

  // Blended-breach quotes need at least 2 lines (the sum across lines is what
  // triggers dual sign-off); the "deep" ones use heavier per-line breaches so a
  // few score >50 and light up the finance step in the ApprovalsHub UI.
  const minLines = discountScenario === 'blendedBreach' ? 2 : 1;
  const lineCount = deep ? randInt(4, 5) : randInt(minLines, 5);
  const chosen = [];
  for (let i = 0; i < lineCount; i += 1) {
    const product = products[(index * 3 + i) % products.length];
    if (chosen.some((c) => c.product.id === product.id)) {continue;}
    chosen.push({ product, variant: chance(0.25) ? variants.find((v) => v.product_id === product.id) || null : null });
  }
  if (!chosen.length) {chosen.push({ product: products[index % products.length], variant: null });}

  // Per-line discount strategy depends on the scenario.
  const lines = [];
  for (let li = 0; li < chosen.length; li += 1) {
    const { product, variant } = chosen[li];
    const ceiling = ceilingFor(product.category_id, categories, tier);
    let discountPct = 0;

    if (discountScenario === 'normal') {
      discountPct = chance(0.2) ? 0 : money(Math.max(0, ceiling) * (0.2 + Math.random() * 0.75));
    } else if (discountScenario === 'singleBreach') {
      if (li === 0) {discountPct = money(ceiling + randInt(2, 8));}
      else {discountPct = money(Math.max(0, ceiling) * (0.2 + Math.random() * 0.7));}
    } else {
      // blendedBreach: every line breaches a little; the SUM triggers routing.
      discountPct = money(ceiling + (deep ? randInt(10, 15) : randInt(3, 9)));
    }

    const listPrice = Number(product.base_price) + (variant ? Number(variant.price_adjustment) : 0);
    const costPrice = Number(product.cost_price) + (variant ? Number(variant.cost_adjustment || 0) : 0);
    const quantity = randInt(1, 12);
    const netUnitPrice = money(listPrice * (1 - discountPct / 100));
    const lineSubtotal = money(netUnitPrice * quantity);
    const taxAmount = money(lineSubtotal * TAX_RATE / 100);

    lines.push({
      id: uuidv4(),
      product,
      variant,
      list_price: money(listPrice),
      cost_price: money(costPrice),
      quantity,
      unit_of_measure: product.unit_of_measure || 'EA',
      discount_percent: discountPct,
      discount_amount: 0,
      tax_rate: TAX_RATE,
      net_unit_price: netUnitPrice,
      line_subtotal: lineSubtotal,
      tax_amount: taxAmount,
      line_total: money(lineSubtotal + taxAmount),
      line_margin: money(lineSubtotal - costPrice * quantity),
      category_id: product.category_id,
      ceiling,
    });
  }

  const subtotal = money(lines.reduce((sum, l) => sum + l.line_subtotal, 0));
  const discountTotal = money(lines.reduce((sum, l) => sum + money((l.list_price - l.net_unit_price) * l.quantity), 0));
  const taxTotal = money(lines.reduce((sum, l) => sum + l.tax_amount, 0));
  const marginTotal = money(lines.reduce((sum, l) => sum + l.line_margin, 0));
  const grandTotal = money(subtotal + taxTotal);
  const marginPercentage = subtotal > 0 ? money((marginTotal / subtotal) * 100) : 0;

  // Use the real risk engine on the exact line data.
  const risk = calculateBlendedRisk(
    lines.map((l, idx) => ({ line_number: idx + 1, category_id: l.category_id, discount_percent: l.discount_percent })),
    riskTierRows(categories),
    tier
  );
  const routing = routeApproval(risk.blendedScore, [
    { id: 'manager-chain', min_discount_percent: CHAIN_MANAGER.min, max_discount_percent: CHAIN_MANAGER.max, required_approver_roles: CHAIN_MANAGER.roles, min_approvals_required: CHAIN_MANAGER.approvals, is_active: true },
    { id: 'dual-chain', min_discount_percent: CHAIN_DUAL.min, max_discount_percent: CHAIN_DUAL.max, required_approver_roles: CHAIN_DUAL.roles, min_approvals_required: CHAIN_DUAL.approvals, is_active: true },
  ]);

  return {
    lines,
    subtotal,
    discount_total: discountTotal,
    tax_total: taxTotal,
    grand_total: grandTotal,
    margin_total: marginTotal,
    margin_percentage: marginPercentage,
    blended_risk_score: money(risk.blendedScore),
    requiredRoles: routing.required_roles,
    scenario: discountScenario,
    repId,
    tier,
  };
}

/**
 * Pick a status for a quotation given its scenario & blended score, with dates
 * that make "stalled" detection find genuinely old, untouched deals.
 */
function pickStatusAndDates(scenario, blendedScore, createdAt, users) {
  const manager = pick(users.managers);
  const finance = pick(users.finance);
  const oldUntouched = chance(0.3); // no touch since creation -> stalled candidate

  const base = {
    approvedBy: null,
    approvedAt: null,
    sentAt: null,
    acceptedAt: null,
    status: 'draft',
    updatedAt: addDays(createdAt, randInt(1, 3)),
    approvalLogs: [],
  };

  if (scenario === 'normal') {
    const roll = Math.random();
    if (roll < 0.16) {
      base.status = 'draft';
      if (oldUntouched || chance(0.4)) {base.updatedAt = createdAt;}
    } else if (roll < 0.5) {
      base.status = 'approved';
      base.approvedAt = addDays(createdAt, randInt(1, 4));
      base.approvedBy = manager.id;
      base.updatedAt = base.approvedAt;
    } else if (roll < 0.7) {
      base.status = 'sent';
      base.approvedAt = addDays(createdAt, randInt(1, 4));
      base.approvedBy = manager.id;
      base.sentAt = addDays(base.approvedAt, randInt(1, 3));
      base.updatedAt = oldUntouched ? createdAt : addDays(base.sentAt, randInt(0, 8));
    } else if (roll < 0.95) {
      base.status = 'accepted';
      base.approvedAt = addDays(createdAt, randInt(1, 4));
      base.approvedBy = manager.id;
      base.sentAt = addDays(base.approvedAt, randInt(1, 3));
      base.acceptedAt = addDays(base.sentAt, randInt(2, 12));
      base.updatedAt = base.acceptedAt;
    } else {
      base.status = 'expired';
      base.approvedAt = addDays(createdAt, randInt(1, 4));
      base.approvedBy = manager.id;
      base.sentAt = addDays(base.approvedAt, randInt(1, 3));
      base.updatedAt = addDays(base.sentAt, randInt(15, 30));
    }
  } else if (scenario === 'singleBreach') {
    const roll = Math.random();
    if (roll < 0.55) {
      base.status = 'pending_approval';
      base.updatedAt = oldUntouched ? createdAt : addDays(createdAt, randInt(1, 3));
      base.approvalLogs = [
        {
          role: 'manager',
          action: 'pending',
          created: addDays(createdAt, randInt(0, 1)),
        },
      ];
    } else if (roll < 0.75) {
      base.status = 'approved';
      base.approvedAt = addDays(createdAt, randInt(1, 5));
      base.approvedBy = manager.id;
      base.updatedAt = base.approvedAt;
      base.approvalLogs = [
        { role: 'manager', action: 'approved', created: base.approvedAt, comments: 'Within governance tolerance for this customer tier.' },
      ];
    } else if (roll < 0.88) {
      base.status = 'rejected';
      base.updatedAt = addDays(createdAt, randInt(1, 3));
      base.approvalLogs = [
        { role: 'manager', action: 'rejected', created: base.updatedAt, comments: 'Discount above ceiling; rep to re-quote at compliant levels.' },
      ];
    } else {
      base.status = 'draft';
      base.updatedAt = addDays(createdAt, randInt(1, 3));
      base.approvalLogs = [
        { role: 'manager', action: 'returned', created: base.updatedAt, comments: 'Returned for revision — revise discounts then resubmit.' },
      ];
    }
  } else {
    // blendedBreach -> dual sign-off by design
    const roll = Math.random();
    const managerApprovedFirst = chance(0.45);
    if (roll < 0.65) {
      base.status = 'pending_approval';
      base.updatedAt = oldUntouched ? createdAt : addDays(createdAt, randInt(1, 4));
      if (managerApprovedFirst) {
        base.approvalLogs = [
          { role: 'manager', action: 'approved', created: addDays(createdAt, randInt(1, 2)), comments: 'Manager step signed. Escalated for finance review.' },
          { role: 'finance', action: 'pending', created: addDays(createdAt, randInt(2, 3)) },
        ];
      } else {
        base.approvalLogs = [
          { role: 'manager', action: 'pending', created: addDays(createdAt, randInt(0, 1)) },
          { role: 'finance', action: 'pending', created: addDays(createdAt, randInt(1, 2)) },
        ];
      }
    } else if (roll < 0.85) {
      base.status = 'approved';
      base.approvedAt = addDays(createdAt, randInt(2, 8));
      base.approvedBy = finance.id;
      base.updatedAt = base.approvedAt;
      base.approvalLogs = [
        { role: 'manager', action: 'approved', created: addDays(createdAt, randInt(1, 3)) },
        { role: 'finance', action: 'approved', created: base.approvedAt, comments: 'Dual sign-off complete.' },
      ];
    } else if (roll < 0.95) {
      base.status = 'rejected';
      base.updatedAt = addDays(createdAt, randInt(2, 5));
      base.approvalLogs = [
        { role: 'manager', action: 'approved', created: addDays(createdAt, randInt(1, 2)) },
        { role: 'finance', action: 'rejected', created: base.updatedAt, comments: 'Blended risk too high for the margin profile.' },
      ];
    } else {
      base.status = 'draft';
      base.updatedAt = addDays(createdAt, randInt(1, 3));
      base.approvalLogs = [
        { role: 'manager', action: 'returned', created: base.updatedAt, comments: 'Returned for revision after finance feedback.' },
      ];
    }
  }

  return base;
}

// ============================================================================
// MAIN
// ============================================================================

async function waitForDatabase(maxRetries = 30, intervalMs = 1000) {
  const db = getDatabase();
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      await db.raw('SELECT 1');
      logger.info(`[seed] Database connection established on attempt ${attempt}.`);
      return;
    } catch (error) {
      logger.warn(`[seed] Database connection attempt ${attempt}/${maxRetries} failed: ${error.message}. Retrying in ${intervalMs}ms...`);
      if (attempt === maxRetries) {throw error;}
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}

async function main() {
  faker.seed(20260905);
  await waitForDatabase();
  const db = getDatabase();
  await ensureRequiredTables(db);
  const now = new Date();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, config.BCRYPT_ROUNDS);

  // --- Idempotency check -----------------------------------------------------
  const existingMarker = await db('quotations')
    .whereRaw('metadata LIKE ?', [`%${MARKER}%`])
    .count('id as count')
    .first();
  const alreadySeeded = Number(existingMarker?.count || 0) > 0;

  if (alreadySeeded && IS_PRODUCTION) {
    console.log(`\n[seed] Demo data (marker '${MARKER}') already present and NODE_ENV=production — skipping.`);
    console.log('[seed] Re-run with NODE_ENV=development to clear and reseed a fresh dataset.\n');
    await closeDatabase();
    return;
  }

  const counts = {};
  const approvalCategoryCounts = { normal: 0, singleBreach: 0, blendedBreach: 0 };

  try {
    await db.transaction(async (trx) => {
      // --- Clear previous seed (dev reseed) ----------------------------------
      if (alreadySeeded) {
        console.log(`[seed] Clearing previous demo data (marker '${MARKER}') for a clean reseed...`);

        const seededQuotes = await trx('quotations').whereRaw('metadata LIKE ?', [`%${MARKER}%`]).select('id');
        const quoteIds = seededQuotes.map((r) => r.id);
        const seededCustomers = await trx('customers').where('notes', 'LIKE', `%${MARKER}%`).select('id');
        const customerIds = seededCustomers.map((r) => r.id);
        const seededLines = quoteIds.length
          ? await trx('quotation_lines').whereIn('quotation_id', quoteIds).select('id')
          : [];
        const lineIds = seededLines.map((r) => r.id);
        const seededWarehouses = await trx('warehouses').where('code', 'LIKE', 'WH-SEED-%').select('id');
        const warehouseIds = seededWarehouses.map((r) => r.id);
        const seededPriceLists = await trx('price_lists').where('description', 'LIKE', `%${MARKER}%`).select('id');
        const priceListIds = seededPriceLists.map((r) => r.id);
        const seededProducts = await trx('products').whereRaw('metadata LIKE ?', [`%${MARKER}%`]).select('id');
        const productIds = seededProducts.map((r) => r.id);

        const del = async (table, column, ids) => {
          if (ids.length) {await trx(table).whereIn(column, ids).del();}
        };
        if (customerIds.length) {await trx('billing_schedules').whereIn('customer_id', customerIds).del();}
        await del('negotiation_logs', 'quotation_id', quoteIds);
        await del('deal_health_alerts', 'quotation_id', quoteIds);
        await del('approval_logs', 'quotation_id', quoteIds);
        await del('fulfillment_splits', 'quotation_line_id', lineIds);
        await del('quotation_lines', 'quotation_id', quoteIds);
        await del('quotations', 'id', quoteIds);
        await del('stock_levels', 'warehouse_id', warehouseIds);
        await del('price_list_items', 'price_list_id', priceListIds);
        await del('price_lists', 'id', priceListIds);
        // Upsell rules FK-reference products — clear them before the products go.
        await trx('upsell_rules').where('name', 'LIKE', '[DEMO]%').del();
        await trx('subscription_plans').whereRaw('features LIKE ?', [`%${MARKER}%`]).del();
        await del('product_variants', 'product_id', productIds);
        await del('products', 'id', productIds);
        // All seeded tier rows (general + Services override) are created with
        // priority 10 or 20 — target those so user-created tiers are untouched.
        await trx('discount_tiers')
          .whereIn('priority', [10, 20])
          .whereNotNull('customer_tier')
          .whereNull('deleted_at')
          .del();
        await trx('approval_chains').where('name', 'LIKE', '[DEMO]%').del();
        await del('customers', 'id', customerIds);
        console.log('[seed] Previous demo data cleared.');
      }

      // --- 1. Users ----------------------------------------------------------
      const users = await seedUsers(trx, now, passwordHash);
      counts.users = users.all.length;

      // --- 2. Categories, products, variants, price list ---------------------
      const categories = await seedCategories(trx, now);
      const { products, variants } = await seedProducts(trx, now, categories);
      counts.products = products.length;
      counts.product_variants = variants.length;
      await seedPriceList(trx, now, products);

      // --- 3. Warehouses + stock ---------------------------------------------
      const warehouses = await seedWarehousesAndStock(trx, now, products);
      counts.warehouses = warehouses.length;
      counts.stock_levels = await trx('stock_levels').count('id as c').first().then((r) => Number(r.c));

      // --- 4. Discount tiers + approval chains -------------------------------
      const { managerChainId, dualChainId } = await seedDiscountGovernance(trx, now, categories);
      counts.discount_tiers = await trx('discount_tiers').whereIn('priority', [10, 20]).count('id as c').first().then((r) => Number(r.c));
      counts.approval_chains = await trx('approval_chains').where('name', 'LIKE', '[DEMO]%').count('id as c').first().then((r) => Number(r.c));

      // --- 5. Subscription plans ---------------------------------------------
      const plans = await seedSubscriptionPlans(trx, now);
      counts.subscription_plans = plans.length;

      // --- 6. Customers ------------------------------------------------------
      const customers = await seedCustomers(trx, now, users);
      counts.customers = customers.length;

      // --- 7. Quotations + lines + approval logs ------------------------------
      const quotationRows = [];
      const lineRows = [];
      const approvalLogRows = [];
      const quoteMeta = [];

      const scenarioFor = (index) => {
        const roll = index / TARGETS.quotations;
        if (roll < SCENARIO_MIX.normal) {return 'normal';}
        if (roll < SCENARIO_MIX.normal + SCENARIO_MIX.singleBreach) {return 'singleBreach';}
        return 'blendedBreach';
      };

      for (let i = 0; i < TARGETS.quotations; i += 1) {
        const scenario = scenarioFor(i);
        approvalCategoryCounts[scenario] += 1;

        const createdAt = daysFromNow(-randInt(0, 180));
        const built = buildQuotation({
          index: i,
          customers,
          products,
          variants,
          categories,
          discountScenario: scenario,
          deep: scenario === 'blendedBreach' && i % 10 < 3,
        });

        const statusPlan = pickStatusAndDates(scenario, built.blended_risk_score, createdAt, users);

        // Deep blended quotes (every 10th) breach more heavily so their real
        // blended score crosses 50 and the ApprovalsHub UI shows the finance
        // step, matching the backend dual-signoff routing.
        const blendedScore = built.blended_risk_score;
        const requiredRoles = built.requiredRoles;
        const quotation = {
          id: uuidv4(),
          quotation_number: `QT-2026-SEED-${String(i + 1).padStart(4, '0')}`,
          customer_id: customers[i % customers.length].id,
          assigned_rep_id: built.repId,
          status: statusPlan.status,
          currency: 'INR',
          exchange_rate: 1.0,
          subtotal: built.subtotal,
          discount_total: built.discount_total,
          tax_total: built.tax_total,
          shipping_total: 0,
          grand_total: built.grand_total,
          version: 1,
          margin_total: built.margin_total,
          margin_percentage: built.margin_percentage,
          blended_risk_score: blendedScore,
          valid_from: formatDate(createdAt),
          valid_until: formatDate(addDays(createdAt, randInt(30, 90))),
          approved_at: statusPlan.approvedAt,
          approved_by: statusPlan.approvedBy,
          sent_at: statusPlan.sentAt,
          accepted_at: statusPlan.acceptedAt,
          expires_at: statusPlan.status === 'expired' ? addDays(statusPlan.updatedAt, 1) : null,
          payment_terms_days: customers[i % customers.length].payment_terms_days,
          terms_and_conditions: 'Standard DealFlow360 terms apply. Taxes (GST) extra where applicable.',
          internal_notes: `Seeded ${scenario} quote for the comprehensive demo dataset.`,
          customer_notes: chance(0.3) ? pick(['Requesting expedited delivery.', 'Procurement review in progress.', 'Budget approval expected next quarter.']) : null,
          source: pick(['manual', 'api', 'portal']),
          tags: JSON.stringify(['demo', MARKER, scenario]),
          metadata: JSON.stringify({ seed: MARKER, scenario }),
          created_at: createdAt,
          updated_at: statusPlan.updatedAt,
        };
        quotationRows.push(quotation);

        built.lines.forEach((line, lineIndex) => {
          lineRows.push({
            id: line.id,
            quotation_id: quotation.id,
            line_number: lineIndex + 1,
            line_type: 'one_time',
            product_id: line.product.id,
            variant_id: line.variant ? line.variant.id : null,
            quantity: line.quantity,
            unit_of_measure: line.unit_of_measure,
            list_price: line.list_price,
            discount_percent: line.discount_percent,
            discount_amount: 0,
            tax_rate: TAX_RATE,
            sort_order: lineIndex + 1,
            metadata: JSON.stringify({ seed: MARKER }),
            created_at: createdAt,
            updated_at: statusPlan.updatedAt,
          });
        });

        for (const log of statusPlan.approvalLogs) {
          const approver = log.role === 'manager' ? pick(users.managers) : pick(users.finance);
          approvalLogRows.push({
            id: uuidv4(),
            quotation_id: quotation.id,
            approval_chain_id: requiredRoles.includes('finance') ? dualChainId : managerChainId,
            approver_id: approver.id,
            role_at_approval: log.role,
            action: log.action,
            discount_percent_at_review: blendedScore,
            comments: log.comments || null,
            created_at: log.created,
          });
        }

        quoteMeta.push({ quotation, built, scenario, statusPlan });
      }

      counts.quotations = quotationRows.length;
      counts.quotation_lines = lineRows.length;

      // --- 8. Subscriptions -> billing schedules ------------------------------
      const recurringLineRows = [];
      const billingScheduleRows = [];
      const acceptedQuotes = quoteMeta.filter((meta) => meta.quotation.status === 'accepted');
      let subscriptionCount = 0;

      for (const meta of acceptedQuotes) {
        if (subscriptionCount >= TARGETS.subscriptions) {break;}
        const { quotation } = meta;
        const plan = pick(plans);
        const lineIndex = meta.built.lines.length; // append as extra line
        const lineId = uuidv4();
        const startDate = new Date(quotation.accepted_at);
        const cycles = plan.interval_type === 'yearly' ? randInt(1, 3) : plan.interval_type === 'quarterly' ? 4 : randInt(6, 12);
        const unitAmount = money(Number(plan.base_price) * (1 - 0.05)); // 5% discount on the recurring line

        recurringLineRows.push({
          id: lineId,
          quotation_id: quotation.id,
          line_number: lineIndex + 1,
          line_type: 'recurring',
          product_id: null,
          variant_id: null,
          custom_name: plan.name,
          custom_description: plan.description,
          quantity: 1,
          unit_of_measure: 'seat/mo',
          list_price: Number(plan.base_price),
          discount_percent: 5,
          discount_amount: 0,
          tax_rate: TAX_RATE,
          subscription_plan_id: plan.id,
          billing_cycle_anchor: formatDate(startDate),
          billing_day_of_month: startDate.getDate(),
          proration_behavior: 'partial',
          min_commitment_cycles: cycles,
          auto_renew: 1,
          sort_order: lineIndex + 1,
          metadata: JSON.stringify({ seed: MARKER }),
          created_at: quotation.created_at,
          updated_at: quotation.updated_at,
        });

        // Generate billing schedules for the committed cycles.
        const proratedCycle = chance(0.15) ? randInt(2, Math.max(2, Math.min(3, cycles))) : null;
        let periodStart = new Date(startDate);
        for (let cycle = 1; cycle <= cycles; cycle += 1) {
          const periodEnd = new Date(periodStart);
          if (plan.interval_type === 'yearly') {periodEnd.setFullYear(periodEnd.getFullYear() + plan.interval_count);}
          else if (plan.interval_type === 'quarterly') {periodEnd.setMonth(periodEnd.getMonth() + 3 * plan.interval_count);}
          else {periodEnd.setMonth(periodEnd.getMonth() + plan.interval_count);}
          const periodEndMinus = addDays(periodEnd, -1);
          const dueDate = new Date(periodStart);
          const isPast = periodEndMinus < now;

          let status = 'pending';
          let paidAt = null;
          let invoicedAt = null;
          let amount = unitAmount;
          let prorationDetails = null;
          let notes = `Recurring ${plan.interval_type} billing - Cycle ${cycle} of ${cycles}`;

          if (proratedCycle === cycle) {
            const credit = money(unitAmount * 0.35);
            amount = money(unitAmount - credit);
            prorationDetails = JSON.stringify({
              type: 'quantity_change',
              previous_quantity: 1,
              new_quantity: 1,
              prorated_credit: credit,
              reason: 'Mid-cycle seat change',
            });
            notes = `${notes} — mid-cycle change prorated (credit ₹${credit})`;
          }

          if (isPast) {
            const roll = Math.random();
            status = roll < 0.7 ? 'paid' : roll < 0.9 ? 'invoiced' : 'overdue';
            paidAt = status === 'paid' ? addDays(dueDate, randInt(0, 5)) : null;
            invoicedAt = status === 'invoiced' ? addDays(dueDate, -randInt(0, 5)) : null;
          }

          billingScheduleRows.push({
            id: uuidv4(),
            quotation_line_id: lineId,
            customer_id: quotation.customer_id,
            subscription_plan_id: plan.id,
            cycle_number: cycle,
            period_start: formatDate(periodStart),
            period_end: formatDate(periodEndMinus),
            amount: money(amount),
            currency: 'INR',
            status,
            invoice_number: status === 'paid' || status === 'invoiced' || status === 'overdue' ? `INV-2026-${String(randInt(10000, 99999))}` : null,
            invoiced_at: invoicedAt,
            paid_at: paidAt,
            due_date: formatDate(dueDate),
            proration_details: prorationDetails,
            notes,
            created_at: quotation.created_at,
            updated_at: quotation.updated_at,
          });

          periodStart = addDays(periodEndMinus, 1);
        }

        subscriptionCount += 1;
      }

      counts.subscriptions = recurringLineRows.length;
      counts.billing_schedules = billingScheduleRows.length;
      lineRows.push(...recurringLineRows); // merge so they are inserted with the other lines

      // --- 9. Negotiation rounds ----------------------------------------------
      const negotiationLogRows = [];
      const negotiable = quoteMeta.filter((meta) => ['sent', 'approved'].includes(meta.quotation.status));
      const negotiated = negotiable.slice(0, TARGETS.negotiations);

      for (const meta of negotiated) {
        const { quotation, built } = meta;
        const customer = customers.find((c) => c.id === quotation.customer_id);
        const initiator = customer?.user_id
          ? customer.user_id
          : pick([...users.managers, ...users.reps]).id;
        const finalAgreed = chance(0.87);
        const roundCount = randInt(2, 4);
        const discountDown = (built.grand_total * (0.03 + Math.random() * 0.07)); // 3-10% off

        for (let r = 1; r <= roundCount; r += 1) {
          const isLast = r === roundCount;
          const sellerOffer = money(built.grand_total - discountDown * (r / roundCount));
          const buyerOffer = money(built.grand_total * (0.86 + 0.08 * (r / roundCount)));
          negotiationLogRows.push({
            id: uuidv4(),
            quotation_id: quotation.id,
            initiated_by: initiator,
            counterparty_type: customer?.user_id ? 'customer' : 'internal',
            counterparty_id: customer?.user_id ? customer.id : null,
            status: isLast && !finalAgreed ? 'rejected' : isLast ? 'accepted' : 'countered',
            previous_version: JSON.stringify({ seller_offer: money(sellerOffer + discountDown / roundCount), round: r }),
            proposed_version: JSON.stringify({ buyer_offer: buyerOffer, gap: money(sellerOffer - buyerOffer), round: r }),
            message: isLast
              ? `Round ${r}: agreed at ₹${money((sellerOffer + buyerOffer) / 2)}`
              : `Round ${r}: seller ₹${sellerOffer} vs buyer ₹${buyerOffer}`,
            expires_at: addDays(quotation.created_at, randInt(14, 30)),
            resolved_at: isLast ? addDays(quotation.created_at, randInt(5, 12)) : null,
            resolved_by: isLast ? initiator : null,
            created_at: addDays(quotation.created_at, r * randInt(1, 2)),
            updated_at: addDays(quotation.created_at, r * randInt(1, 2)),
          });
        }

        // ~20% of negotiated deals re-cross the risk threshold and get pushed
        // back into approval (the signature demo of the negotiation module).
        if (finalAgreed && chance(0.2) && ['sent', 'approved'].includes(quotation.status)) {
          const priceRatio = 1 - (discountDown / built.grand_total);
          const adjustedLines = built.lines.map((l) => ({
            category_id: l.category_id,
            discount_percent: money(Math.max(0, (1 - (l.net_unit_price * priceRatio) / l.list_price) * 100)),
          }));
          const risk = calculateBlendedRisk(
            adjustedLines.map((l, idx) => ({ line_number: idx + 1, category_id: l.category_id, discount_percent: l.discount_percent })),
            riskTierRows(categories),
            meta.tier
          );
          const routing = routeApproval(risk.blendedScore, [
            { min_discount_percent: CHAIN_MANAGER.min, max_discount_percent: CHAIN_MANAGER.max, required_approver_roles: CHAIN_MANAGER.roles, is_active: true },
            { min_discount_percent: CHAIN_DUAL.min, max_discount_percent: CHAIN_DUAL.max, required_approver_roles: CHAIN_DUAL.roles, is_active: true },
          ]);
          if (routing.requires_approval) {
            quotation.status = 'pending_approval';
            quotation.blended_risk_score = money(risk.blendedScore);
            quotation.updated_at = addDays(quotation.created_at, randInt(5, 12));
            const metadata = JSON.parse(quotation.metadata);
            metadata.negotiated_final_price = money(built.grand_total - discountDown);
            metadata.negotiated_at = quotation.updated_at.toISOString();
            metadata.pre_negotiation_total = built.grand_total;
            quotation.metadata = JSON.stringify(metadata);
            for (const role of routing.required_roles) {
              const approver = role === 'manager' ? pick(users.managers) : pick(users.finance);
              approvalLogRows.push({
                id: uuidv4(),
                quotation_id: quotation.id,
                approval_chain_id: routing.required_roles.includes('finance') ? dualChainId : managerChainId,
                approver_id: approver.id,
                role_at_approval: role,
                action: 'pending',
                discount_percent_at_review: money(risk.blendedScore),
                comments: 'Negotiated price re-crosses the blended risk threshold — re-submitted for approval.',
                created_at: quotation.updated_at,
              });
            }
          }
        }
      }

      counts.negotiation_logs = negotiationLogRows.length;
      counts.approval_logs = approvalLogRows.length;

      // --- 10. Fulfillment splits (accepted quotes) ---------------------------
      const fulfillmentSplitRows = [];
      for (const meta of acceptedQuotes) {
        const { quotation } = meta;
        const oneTimeLines = meta.built.lines; // one_time lines built above
        for (const line of oneTimeLines.slice(0, 1)) {
          const roll = Math.random();
          const requestedDate = roll < 0.25
            ? addDays(now, -randInt(3, 15))   // past due -> slippage detection
            : roll < 0.4
              ? addDays(now, randInt(5, 20))  // in flight, future
              : addDays(quotation.accepted_at, randInt(-5, -1)); // delivered window
          const warehouse = pick(warehouses);
          const delivered = roll >= 0.4;

          // Keep the line's requested_delivery_date in sync for the detector.
          lineRows.find((lr) => lr.id === line.id).requested_delivery_date = formatDate(requestedDate);

          fulfillmentSplitRows.push({
            id: uuidv4(),
            quotation_line_id: line.id,
            warehouse_id: warehouse.id,
            quantity: line.quantity,
            status: delivered ? 'delivered' : 'pending',
            tracking_number: delivered ? faker.string.alphanumeric(12).toUpperCase() : null,
            carrier: delivered ? pick(['BlueDart', 'Delhivery', 'DTDC', 'FedEx India']) : null,
            shipped_at: delivered ? addDays(quotation.accepted_at, randInt(0, 3)) : null,
            delivered_at: delivered ? addDays(quotation.accepted_at, randInt(2, 6)) : null,
            notes: delivered ? 'Delivered in full.' : 'Awaiting stock allocation.',
            created_at: quotation.accepted_at,
            updated_at: delivered ? addDays(quotation.accepted_at, randInt(2, 6)) : now,
          });
        }
      }
      counts.fulfillment_splits = fulfillmentSplitRows.length;

      // --- Insert quotations, lines, logs ------------------------------------
      const quotationColumns = await getColumns(trx, 'quotations');
      const lineColumns = await getColumns(trx, 'quotation_lines');
      await insertRows(trx, 'quotations', quotationRows.map((row) => shape(row, quotationColumns)), 100);
      await insertRows(trx, 'quotation_lines', lineRows.map((row) => shape(row, lineColumns)), 250);
      await insertRows(trx, 'billing_schedules', billingScheduleRows, 250);
      await insertRows(trx, 'negotiation_logs', negotiationLogRows, 100);
      await insertRows(trx, 'fulfillment_splits', fulfillmentSplitRows, 100);
      await insertRows(trx, 'approval_logs', approvalLogRows, 100);

      // --- 11. Upsell rules (margin-threshold aware) --------------------------
      const upsellColumns = await getColumns(trx, 'upsell_rules');
      const upsellRows = [];
      let guard = 0;
      while (upsellRows.length < TARGETS.upsellRules && guard < 2000) {
        guard += 1;
        const trigger = pick(products);
        const recommended = pick(products.filter((p) => p.id !== trigger.id));
        const conditionType = pick(['always', 'always', 'always', 'customer_tier', 'quantity_threshold']);
        const discountPercent = randInt(0, 10);
        const effectivePrice = Number(recommended.base_price) * (1 - discountPercent / 100);
        const marginPct = effectivePrice > 0 ? ((effectivePrice - Number(recommended.cost_price)) / effectivePrice) * 100 : 0;
        if (marginPct < 25) {continue;} // respect the minimum margin threshold rule

        const promoted = upsellRows.length % 6 === 0; // ~1 in 6 promoted
        const triggerCategory = chance(0.35) ? categories[trigger.category_id === categories.hardware.id ? 'hardware' : trigger.category_id === categories.services.id ? 'services' : 'saas'].id : null;
        const conditionConfig = conditionType === 'customer_tier'
          ? JSON.stringify({ required_tiers: ['Gold', 'Silver'] })
          : conditionType === 'quantity_threshold'
            ? JSON.stringify({ min_quantity: randInt(3, 10) })
            : JSON.stringify({});

        upsellRows.push({
          id: uuidv4(),
          name: `[DEMO] Upsell ${String(upsellRows.length + 1).padStart(3, '0')}: ${trigger.name} → ${recommended.name}`,
          description: pick([
            'Frequently purchased together with the trigger product.',
            'Recommended add-on for the trigger line item.',
            'Companion service for the primary product.',
          ]),
          trigger_product_id: triggerCategory ? null : trigger.id,
          trigger_category_id: triggerCategory,
          recommended_product_id: recommended.id,
          recommended_variant_id: null,
          condition_type: conditionType,
          condition_config: conditionConfig,
          discount_percent: discountPercent,
          priority: promoted ? randInt(10, 25) : randInt(1, 8),
          is_active: chance(0.95),
          created_at: daysFromNow(-randInt(30, 120)),
          updated_at: now,
        });
      }
      await insertRows(trx, 'upsell_rules', upsellRows.map((row) => shape(row, upsellColumns)), 100);
      counts.upsell_rules = upsellRows.length;

      console.log(`[seed] Transaction committed: ${counts.quotations} quotations, ${counts.quotation_lines} lines, ${counts.subscriptions} subscriptions, ${counts.negotiation_logs} negotiation logs, ${counts.fulfillment_splits} splits, ${counts.upsell_rules} upsell rules.`);
    });

    // --- 12. Run the real deal-health detectors --------------------------------
    const dealHealth = new DealHealthService(db, logger, new InProcessCache(), null, {
      stalledDaysThreshold: Number(process.env.STALLED_DEAL_DAYS) || 7,
      anomalyStdDevMultiplier: Number(process.env.ANOMALY_STDDEV_MULTIPLIER) || 1.5,
      minHistoricalQuotations: Number(process.env.MIN_HISTORICAL_QUOTATIONS) || 3,
    });
    const detectorResults = await dealHealth.runAllDetectors();
    counts.deal_health_alerts = await db('deal_health_alerts').count('id as c').first().then((r) => Number(r.c));

    // --- 13. Verification queries ---------------------------------------------
    const [financePendingRows, managerOnlyPendingRows, pendingTotalRows, activeAlertsRows] = await Promise.all([
      // (a) pending_approval requiring BOTH manager AND finance sign-off
      db('quotations as q')
        .where({ 'q.status': 'pending_approval' })
        .whereNull('q.deleted_at')
        .whereExists(function () {
          this.select('ac.id')
            .from('approval_chains as ac')
            .where({ 'ac.is_active': 1 })
            .whereNull('ac.deleted_at')
            .whereRaw('JSON_CONTAINS(ac.required_approver_roles, ?)', [JSON.stringify('finance')])
            .whereRaw('q.blended_risk_score BETWEEN ac.min_discount_percent AND ac.max_discount_percent');
        })
        .count('q.id as count')
        .first(),
      db('quotations as q')
        .where({ 'q.status': 'pending_approval' })
        .whereNull('q.deleted_at')
        .whereExists(function () {
          this.select('ac.id')
            .from('approval_chains as ac')
            .where({ 'ac.is_active': 1 })
            .whereNull('ac.deleted_at')
            .whereRaw('JSON_CONTAINS(ac.required_approver_roles, ?)', [JSON.stringify('manager')])
            .whereRaw('q.blended_risk_score BETWEEN ac.min_discount_percent AND ac.max_discount_percent');
        })
        .whereNotExists(function () {
          this.select('ac.id')
            .from('approval_chains as ac')
            .where({ 'ac.is_active': 1 })
            .whereNull('ac.deleted_at')
            .whereRaw('JSON_CONTAINS(ac.required_approver_roles, ?)', [JSON.stringify('finance')])
            .whereRaw('q.blended_risk_score BETWEEN ac.min_discount_percent AND ac.max_discount_percent');
        })
        .count('q.id as count')
        .first(),
      db('quotations').where({ status: 'pending_approval' }).whereNull('deleted_at').count('id as count').first(),
      db('deal_health_alerts').where({ is_acknowledged: 0 }).whereNull('deleted_at').count('id as count').first(),
    ]);

    const financePending = Number(financePendingRows?.count || 0);
    const managerOnlyPending = Number(managerOnlyPendingRows?.count || 0);
    const pendingTotal = Number(pendingTotalRows?.count || 0);
    const activeAlerts = Number(activeAlertsRows?.count || 0);

    // --- 14. Summary ----------------------------------------------------------
    console.log('\n============================================================');
    console.log('  DealFlow360 — Comprehensive Demo Seed Summary');
    console.log('============================================================');
    console.log(`Rows inserted per table:`);
    for (const [table, count] of Object.entries(counts)) {
      console.log(`  ${table.padEnd(22)} ${String(count).padStart(6)}`);
    }
    console.log('\nApproval-trigger category breakdown (quotations):');
    console.log(`  normal            ${String(approvalCategoryCounts.normal).padStart(4)}  (within tier ceilings — auto-approved)`);
    console.log(`  single-line breach ${String(approvalCategoryCounts.singleBreach).padStart(4)}  (one line over its category ceiling → manager)`);
    console.log(`  blended breach    ${String(approvalCategoryCounts.blendedBreach).padStart(4)}  (multiple lines slightly over → manager + finance)`);
    console.log('\nReal-data verification:');
    console.log(`  (a) pending_approval requiring BOTH manager AND finance sign-off: ${financePending}`);
    console.log(`      (manager-only pending: ${managerOnlyPending} · total pending: ${pendingTotal})`);
    console.log(`  (b) active (unacknowledged) deal-health alerts: ${activeAlerts}`);
    console.log(`      → stalled: ${detectorResults.stalled}, discount anomalies: ${detectorResults.anomaly}, delivery slippage: ${detectorResults.slippage}`);
    if (financePending === 0 || activeAlerts === 0) {
      console.log('\n  ⚠️  Verification returned zero somewhere — check the data before demoing.');
    } else {
      console.log('\n  ✅ Both demo-critical checks are non-zero — the demo will show real cases.');
    }
    console.log('\nDemo accounts (password for all: DemoPass2026):');
    console.log('  rep.demo@dealflow360.local   (rep)');
    console.log('  manager.demo@dealflow360.local (manager)');
    console.log('  finance.demo@dealflow360.local (finance)');
    console.log('  admin.demo@dealflow360.local  (admin)');
    console.log('  customer.1@dealflow360.local … customer.8@dealflow360.local (customer portal)');
    console.log('============================================================\n');
  } catch (error) {
    console.error('\n[seed] FAILED — transaction rolled back, no partial data was left behind.');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

main();