const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

async function request(path, options = {}, token = null) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body?.error?.message || `Backend request failed (${response.status})`)
  }
  return body
}

function unwrapList(body) {
  const value = body?.data?.items || body?.data || []
  return Array.isArray(value) ? value : []
}

function normalizeQuotation(quotation) {
  const rawLines = quotation.lines || quotation.quotation_lines || []

  return {
    ...quotation,
    id: quotation.id || quotation.quotation_number,
    customer: quotation.customer || quotation.customer_name || quotation.company_name || quotation.customer_id,
    customerTier: quotation.customerTier || quotation.customer_tier || 'Bronze',
    assignedTo: quotation.assignedTo || quotation.rep_name || quotation.assigned_rep_id || 'Unassigned',
    createdAt: quotation.createdAt || quotation.created_at,
    expiresAt: quotation.expiresAt || quotation.valid_until,
    blended_risk_score: quotation.blended_risk_score || 0,
    stage: quotation.stage || quotation.status,
    requiresFinance: quotation.requiresFinance || quotation.requires_finance || false,
    auditTrails: quotation.auditTrails || quotation.audit_trails || quotation.approval_logs || [],
    lines: rawLines.map((line) => ({
      ...line,
      id: line.id || line.quotation_line_id,
      productId: line.productId || line.product_id,
      product: line.product || line.product_name || line.custom_name || 'Custom line item',
      qty: line.qty || line.quantity || 0,
      unitPrice: line.unitPrice || line.list_price || 0,
      discountPct: line.discountPct || line.discount_percent || 0,
      isRecurring: line.isRecurring || line.line_type === 'recurring',
    })),
  }
}

function normalizeProduct(product) {
  return {
    ...product,
    price: product.price || product.base_price || 0,
    category: product.category || product.category_name || product.category_id || 'Uncategorized',
    status: product.status || (product.is_active === false ? 'Inactive' : 'Active'),
    isSubscription: product.isSubscription || Boolean(product.subscription_plan_id),
    variants: product.variants || [],
    pricelists: product.pricelists || [],
  }
}

export async function login(email, password) {
  const response = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  return { ...response.data, token: response.data.accessToken }
}

export async function registerInternal({ email, password, fullName, role }) {
  const response = await request('/auth/register/internal', {
    method: 'POST',
    body: JSON.stringify({ email, password, fullName, role }),
  })
  return { ...response.data, token: response.data.accessToken }
}

export async function registerCustomer({ email, fullName, password }) {
  const response = await request('/auth/register/customer', {
    method: 'POST',
    body: JSON.stringify({ email, fullName, password }),
  })
  return { ...response.data, token: response.data.accessToken }
}

export async function getWorkspace(token) {
  const [quotations, products, warehouses, discountTiers, plans] = await Promise.all([
    request('/quotations?limit=100', {}, token),
    request('/products?limit=100', {}, token),
    request('/warehouses', {}, token),
    request('/discounts/tiers', {}, token),
    request('/subscriptions/plans', {}, token),
  ])
  return {
    quotations: unwrapList(quotations).map(normalizeQuotation),
    products: unwrapList(products).map(normalizeProduct),
    warehouses: unwrapList(warehouses),
    discountTiers: unwrapList(discountTiers),
    plans: unwrapList(plans),
  }
}

export function getBackendUrl() {
  return API_URL.replace(/\/api$/, '')
}
