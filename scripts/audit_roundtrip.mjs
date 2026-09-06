/**
 * Dev-only audit helper: exercises the real DealFlow360 HTTP API the way the
 * fixed QuotationBuilder does — version tracked after every mutation so submit
 * passes the CURRENT expected_version.
 * Usage: node scripts/audit_roundtrip.mjs  (expects admin token in ./scripts/.admin_token)
 */
const API = 'http://localhost:3000/api';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN = fs.readFileSync(path.join(__dirname, '.admin_token'), 'utf8').trim();

async function api(method, url, body) {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text.slice(0, 300) }; }
  return { status: res.status, json };
}

const pickQuote = (r) => r.json?.data?.quotation || r.json?.data?.data?.quotation || r.json?.data;
const out = (label, result) => {
  const q = pickQuote(result);
  console.log(`[${label}] http=${result.status}`, q ? `ver=${q.version} status=${q.status} risk=${q.blended_risk_score} lines=${q.lines?.length ?? '?'}` : (result.json?.error?.message || JSON.stringify(result.json).slice(0, 200)));
};

// 1. Create a real draft (customer resolved from name → row in customers)
const created = await api('POST', '/quotations', {
  customer_name: 'Audit Roundtrip Co',
  customer_tier: 'Bronze',
  currency: 'INR',
  valid_until: new Date(Date.now() + 30 * 86400000).toISOString(),
  metadata: { customer_name: 'Audit Roundtrip Co' },
});
out('create', created);
let quote = pickQuote(created);
let version = quote?.version ?? null;
if (!quote?.id) { console.error('ABORT: no quotation id'); process.exit(1); }

const products = await api('GET', '/products?limit=5');
const prod = (products.json?.data?.items || products.json?.data || [])[0];
console.log('picked product:', prod?.name, 'base_price=', prod?.base_price);

// 2. Add a line → builder stores fresh version from response
const lineAdded = await api('POST', `/quotations/${quote.id}/lines`, {
  product_id: prod.id, quantity: 3, line_type: 'one_time', discount_percent: 0,
});
out('addLine', lineAdded);
const lineId = lineAdded.json?.data?.line?.id;
const addResp = pickQuote(lineAdded);
version = addResp?.version ?? version;
console.log('   added lineId:', lineId, '→ version now:', version);

// 3. Update line qty & discount → builder stores fresh version
if (lineId) {
  const upd = await api('PUT', `/quotations/${quote.id}/lines/${lineId}`, { quantity: 5, discount_percent: 8 });
  out('updateLine', upd);
  version = pickQuote(upd)?.version ?? version;
  console.log('   → version now:', version);
}

// 4. Submit with CURRENT version (what fixed builder does)
const submitted = await api('POST', `/quotations/${quote.id}/submit`, { expected_version: version });
out('submit', submitted);

// 5. Persistence check — reread fresh
const reread = await api('GET', `/quotations/${quote.id}`);
out('reread', reread);

console.log('quote id for inspection:', quote.id);
