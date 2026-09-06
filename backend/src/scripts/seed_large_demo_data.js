import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/index.js';
import { getDatabase, closeDatabase } from '../utils/database.js';

const MARKER = 'large_demo_seed_2026_09';
const QUOTATION_COUNT = Number(process.env.DEMO_QUOTATION_COUNT || 1000);
const CUSTOMER_COUNT = Number(process.env.DEMO_CUSTOMER_COUNT || 240);
const PRODUCT_COUNT = Number(process.env.DEMO_PRODUCT_COUNT || 160);

const categories = [
  'Enterprise Hardware',
  'SaaS Licenses',
  'Professional Services',
  'Cloud Infrastructure',
  'Support Packages',
  'Security Add-ons',
  'Data Services',
  'Implementation',
];

const customerSuffixes = [
  'Logistics', 'BioDynamics', 'Aerospace', 'Retail Systems', 'Energy Grid',
  'Cloud Labs', 'Manufacturing', 'Health Networks', 'FinOps', 'Cyber Defense',
];

const productFamilies = [
  'AETHER Edge Compute Node',
  'DealFlow360 Enterprise Core',
  'AETHER Risk Orchestrator',
  'Revenue Intelligence Mesh',
  'Warehouse Sync Gateway',
  'Negotiation Autopilot',
  'Billing Schedule Engine',
  'Customer Portal Shield',
];

function money(value) {
  return Math.round(value * 100) / 100;
}

function pick(items, index) {
  return items[index % items.length];
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 86400000);
}

async function getColumns(db, table) {
  const rows = await db('information_schema.columns')
    .where({ table_schema: config.DB_NAME, table_name: table })
    .select('column_name');
  return new Set(rows.map((row) => row.column_name));
}

function shape(row, columns) {
  return Object.fromEntries(Object.entries(row).filter(([key]) => columns.has(key)));
}

async function insertMissingBy(db, table, rows, key) {
  if (!rows.length) {
    return [];
  }
  const columns = await getColumns(db, table);
  const existingRows = await db(table)
    .whereIn(key, rows.map((row) => row[key]))
    .select(key);
  const existing = new Set(existingRows.map((row) => row[key]));
  const missing = rows.filter((row) => !existing.has(row[key])).map((row) => shape(row, columns));
  if (missing.length) {
    await db.batchInsert(table, missing, 100);
  }
  return db(table).whereIn(key, rows.map((row) => row[key])).select('*');
}

async function ensureRequiredTables(db) {
  const required = [
    'users',
    'customers',
    'product_categories',
    'products',
    'discount_tiers',
    'approval_chains',
    'quotations',
    'quotation_lines',
  ];

  const missing = [];
  for (const table of required) {
    if (!(await db.schema.hasTable(table))) {
      missing.push(table);
    }
  }

  if (missing.length) {
    throw new Error(`Missing tables: ${missing.join(', ')}. Run database migrations before seeding demo data.`);
  }
}

async function main() {
  const db = getDatabase();
  await ensureRequiredTables(db);

  const now = new Date();
  const passwordHash = await bcrypt.hash('Password123!', config.BCRYPT_ROUNDS);

  const users = await insertMissingBy(db, 'users', [
    { id: uuidv4(), email: 'admin@dealflow360.io', password_hash: passwordHash, full_name: 'AETHER Admin', role: 'admin', is_active: true, created_at: now, updated_at: now },
    { id: uuidv4(), email: 'rep@dealflow360.io', password_hash: passwordHash, full_name: 'Marcus Vance', role: 'rep', is_active: true, created_at: now, updated_at: now },
    { id: uuidv4(), email: 'manager@dealflow360.io', password_hash: passwordHash, full_name: 'Sarah Lin', role: 'manager', is_active: true, created_at: now, updated_at: now },
    { id: uuidv4(), email: 'finance@dealflow360.io', password_hash: passwordHash, full_name: 'Priya Raman', role: 'finance', is_active: true, created_at: now, updated_at: now },
  ], 'email');

  const reps = users.filter((user) => ['rep', 'manager', 'admin'].includes(user.role));

  const categoryRows = categories.map((name) => ({
    id: uuidv4(),
    name,
    description: `${name} catalog group`,
    is_active: true,
    created_at: now,
    updated_at: now,
  }));
  const persistedCategories = await insertMissingBy(db, 'product_categories', categoryRows, 'name');

  const products = Array.from({ length: PRODUCT_COUNT }, (_, index) => {
    const category = pick(persistedCategories, index);
    const base = 1200 + (index % 40) * 725 + Math.floor(index / 8) * 110;
    const recurring = ['SaaS Licenses', 'Cloud Infrastructure', 'Support Packages', 'Data Services'].includes(category.name);
    return {
      id: uuidv4(),
      sku: `AETHER-${String(index + 1).padStart(4, '0')}`,
      name: `${pick(productFamilies, index)} ${index % 5 === 0 ? 'Enterprise' : 'Pro'} ${index + 1}`,
      description: `Seeded ${category.name.toLowerCase()} offer for DealFlow360 governance demos.`,
      category_id: category.id,
      base_price: money(base),
      cost_price: money(base * (0.42 + (index % 9) / 100)),
      unit_of_measure: recurring ? 'seat/mo' : 'EA',
      is_active: true,
      is_recurring_eligible: recurring,
      metadata: JSON.stringify({ seed: MARKER, family: pick(productFamilies, index) }),
      created_at: now,
      updated_at: now,
    };
  });
  const persistedProducts = await insertMissingBy(db, 'products', products, 'sku');

  const customers = Array.from({ length: CUSTOMER_COUNT }, (_, index) => ({
    id: uuidv4(),
    company_name: `${pick(['Apex', 'Hyperion', 'Vector', 'Solaria', 'Nimble', 'Northstar', 'Zenith', 'Kaveri'], index)} ${pick(customerSuffixes, index)} ${String(index + 1).padStart(3, '0')}`,
    tier: pick(['Bronze', 'Silver', 'Gold'], index),
    currency: 'INR',
    payment_terms_days: pick([15, 30, 45, 60], index),
    billing_address: JSON.stringify({ country: 'IN', city: pick(['Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune'], index) }),
    shipping_address: JSON.stringify({ country: 'IN', city: pick(['Bengaluru', 'Chennai', 'Noida', 'Ahmedabad', 'Kochi'], index) }),
    metadata: JSON.stringify({ seed: MARKER, segment: pick(['Enterprise', 'Mid-market', 'Strategic'], index) }),
    created_at: now,
    updated_at: now,
  }));
  const persistedCustomers = await insertMissingBy(db, 'customers', customers, 'company_name');

  const discountRows = [];
  for (const tier of ['Bronze', 'Silver', 'Gold']) {
    for (const category of persistedCategories) {
      discountRows.push({
        id: uuidv4(),
        name: `${tier} ${category.name} ceiling`,
        customer_tier: tier,
        category_id: category.id,
        discount_percent: tier === 'Gold' ? 25 : tier === 'Silver' ? 18 : 10,
        priority: tier === 'Gold' ? 30 : tier === 'Silver' ? 20 : 10,
        effective_from: new Date('2026-01-01T00:00:00.000Z'),
        is_active: true,
        metadata: JSON.stringify({ seed: MARKER }),
        created_at: now,
        updated_at: now,
      });
    }
  }
  await insertMissingBy(db, 'discount_tiers', discountRows, 'name');

  await insertMissingBy(db, 'approval_chains', [
    {
      id: uuidv4(),
      name: 'Seeded Manager Approval',
      min_discount_percent: 10,
      max_discount_percent: 25,
      required_approver_roles: JSON.stringify(['manager']),
      min_approvals_required: 1,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      name: 'Seeded Finance Dual Signoff',
      min_discount_percent: 25.01,
      max_discount_percent: 100,
      required_approver_roles: JSON.stringify(['manager', 'finance']),
      min_approvals_required: 2,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
  ], 'name');

  const quotationColumns = await getColumns(db, 'quotations');
  const lineColumns = await getColumns(db, 'quotation_lines');
  const existingQuoteNumbers = new Set(
    (await db('quotations').where('quotation_number', 'like', 'QT-2026-DEMO-%').select('quotation_number'))
      .map((row) => row.quotation_number)
  );

  const quotationRows = [];
  const lineRows = [];

  for (let index = 0; index < QUOTATION_COUNT; index += 1) {
    const quotationNumber = `QT-2026-DEMO-${String(index + 1).padStart(4, '0')}`;
    if (existingQuoteNumbers.has(quotationNumber)) {
      continue;
    }

    const customer = pick(persistedCustomers, index);
    const rep = pick(reps, index);
    const quoteId = uuidv4();
    const lineCount = 2 + (index % 4);
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    let marginTotal = 0;
    let maxDiscount = 0;

    for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
      const product = pick(persistedProducts, index * 3 + lineIndex);
      const quantity = 1 + ((index + lineIndex) % 12);
      const listPrice = Number(product.base_price || 0);
      const discount = pick([0, 5, 8, 12, 15, 18, 22, 28, 32], index + lineIndex);
      const lineSubtotal = money(quantity * listPrice);
      const lineDiscount = money(lineSubtotal * discount / 100);
      const taxable = lineSubtotal - lineDiscount;
      const tax = money(taxable * 0.18);
      const cost = Number(product.cost_price || 0) * quantity;

      subtotal += lineSubtotal;
      discountTotal += lineDiscount;
      taxTotal += tax;
      marginTotal += taxable - cost;
      maxDiscount = Math.max(maxDiscount, discount);

      lineRows.push(shape({
        id: uuidv4(),
        quotation_id: quoteId,
        line_number: lineIndex + 1,
        line_type: product.is_recurring_eligible ? 'recurring' : 'one_time',
        product_id: product.id,
        quantity,
        unit_of_measure: product.unit_of_measure || 'EA',
        list_price: listPrice,
        discount_percent: discount,
        discount_amount: lineDiscount,
        tax_rate: 18,
        sort_order: lineIndex + 1,
        created_at: now,
        updated_at: now,
      }, lineColumns));
    }

    const grandTotal = money(subtotal - discountTotal + taxTotal);
    const marginPercentage = grandTotal > 0 ? money((marginTotal / grandTotal) * 100) : 0;
    const riskScore = Math.min(95, Math.max(5, Math.round(maxDiscount * 2.2 + (marginPercentage < 25 ? 25 : 0))));

    quotationRows.push(shape({
      id: quoteId,
      quotation_number: quotationNumber,
      customer_id: customer.id,
      assigned_rep_id: rep?.id || null,
      status: pick(['draft', 'pending_approval', 'approved', 'sent', 'accepted'], index),
      currency: 'INR',
      payment_terms_days: customer.payment_terms_days || 30,
      valid_from: daysFromNow(-1 * (index % 90)),
      valid_until: daysFromNow(15 + (index % 60)),
      tags: JSON.stringify([MARKER, pick(['hardware', 'subscription', 'strategic', 'renewal'], index)]),
      metadata: JSON.stringify({ seed: MARKER, source: 'seed_large_demo_data' }),
      version: 1,
      subtotal: money(subtotal),
      discount_total: money(discountTotal),
      tax_total: money(taxTotal),
      shipping_total: 0,
      grand_total: grandTotal,
      margin_total: money(marginTotal),
      margin_percentage: marginPercentage,
      blended_risk_score: riskScore,
      created_at: daysFromNow(-1 * (index % 120)),
      updated_at: now,
    }, quotationColumns));
  }

  if (quotationRows.length) {
    await db.batchInsert('quotations', quotationRows, 100);
    await db.batchInsert('quotation_lines', lineRows, 250);
  }

  console.log(JSON.stringify({
    seeded: {
      customers: persistedCustomers.length,
      products: persistedProducts.length,
      quotationsInserted: quotationRows.length,
      quotationLinesInserted: lineRows.length,
    },
    demoAccounts: [
      'admin@dealflow360.io',
      'rep@dealflow360.io',
      'manager@dealflow360.io',
      'finance@dealflow360.io',
    ],
    password: 'Password123!',
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
