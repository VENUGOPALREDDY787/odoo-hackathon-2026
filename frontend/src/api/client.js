const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

async function request(path, options = {}, token = null) {
  const accessToken = token || localStorage.getItem('dealflow360.accessToken')
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {}),
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body?.error?.message || `Backend request failed (${response.status})`)
  }
  return body
}

export async function apiRequest(path, options = {}) {
  return request(path, options)
}

export async function apiDownload(path) {
  const accessToken = localStorage.getItem('dealflow360.accessToken')
  const response = await fetch(`${API_URL}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body?.error?.message || `Backend request failed (${response.status})`)
  }
  return response.blob()
}

function unwrapList(body) {
  const value = body?.data?.items || body?.data || []
  return Array.isArray(value) ? value : []
}

function unwrapQuotationPayload(body) {
  const value = body?.data
  return value?.quotation || value?.data?.quotation || value
}

export function normalizeQuotation(quotation) {
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

export { normalizeProduct }

export async function listQuotations() {
  const firstPage = await request('/quotations?limit=100&page=1')
  const items = unwrapList(firstPage)
  const totalPages = firstPage?.pagination?.totalPages || 1

  if (totalPages > 1) {
    const remainingPages = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) =>
        request(`/quotations?limit=100&page=${index + 2}`)
      )
    )
    for (const page of remainingPages) {
      items.push(...unwrapList(page))
    }
  }

  return items.map(normalizeQuotation)
}

export async function listProducts(params = {}) {
  const normalizedParams = { limit: 100, ...params }
  const query = new URLSearchParams(Object.entries(normalizedParams).filter(([, value]) => value !== undefined && value !== ''))
  const firstPage = await request(`/products${query.toString() ? `?${query}` : ''}`)
  const items = unwrapList(firstPage)
  const totalPages = firstPage?.pagination?.totalPages || 1

  if (!params.page && totalPages > 1) {
    const remainingPages = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) => {
        const nextQuery = new URLSearchParams({ ...normalizedParams, page: index + 2 })
        return request(`/products?${nextQuery}`)
      })
    )
    for (const page of remainingPages) {
      items.push(...unwrapList(page))
    }
  }

  return {
    ...firstPage,
    data: items.map(normalizeProduct),
    pagination: {
      ...(firstPage.pagination || {}),
      page: params.page || 1,
      total: firstPage?.pagination?.total || items.length,
      totalPages,
    },
  }
}

export async function getQuotation(id) {
  return normalizeQuotation((await request(`/quotations/${id}`)).data)
}

export async function listProductCategories() {
  return unwrapList(await request('/products/categories'))
}

export async function createQuotation(payload) {
  return normalizeQuotation((await request('/quotations', { method: 'POST', body: JSON.stringify(payload) })).data)
}

export async function addQuotationLine(quotationId, payload) {
  return normalizeQuotation(unwrapQuotationPayload(await request(`/quotations/${quotationId}/lines`, { method: 'POST', body: JSON.stringify(payload) })))
}

export async function updateQuotationLine(quotationId, lineId, payload) {
  return normalizeQuotation(unwrapQuotationPayload(await request(`/quotations/${quotationId}/lines/${lineId}`, { method: 'PUT', body: JSON.stringify(payload) })))
}

export async function removeQuotationLine(quotationId, lineId) {
  return normalizeQuotation(unwrapQuotationPayload(await request(`/quotations/${quotationId}/lines/${lineId}`, { method: 'DELETE' })))
}

export async function submitQuotation(quotationId, payload = {}) {
  return normalizeQuotation(unwrapQuotationPayload(await request(`/quotations/${quotationId}/submit`, { method: 'POST', body: JSON.stringify(payload) })))
}

export async function acceptQuotation(quotationId) {
  return normalizeQuotation((await request(`/quotations/${quotationId}/accept`, { method: 'POST' })).data)
}

export async function getApproval(quotationId) {
  const [risk, logs] = await Promise.all([
    request(`/discounts/quotations/${quotationId}/evaluate-risk`, { method: 'POST', body: JSON.stringify({}) }),
    request(`/discounts/quotations/${quotationId}/approval-logs`),
  ])
  return { ...(risk.data || {}), approval_logs: logs.data || [] }
}

export async function approveQuotation(quotationId, comments = '') {
  return (await request(`/discounts/quotations/${quotationId}/approve`, { method: 'POST', body: JSON.stringify({ comments }) })).data
}

export async function rejectQuotation(quotationId, comments = '') {
  return (await request(`/discounts/quotations/${quotationId}/reject`, { method: 'POST', body: JSON.stringify({ comments }) })).data
}

export async function returnQuotation(quotationId, comments = '') {
  return (await request(`/discounts/quotations/${quotationId}/return`, { method: 'POST', body: JSON.stringify({ comments }) })).data
}

export async function listDiscountTiers() {
  return unwrapList(await request('/discounts/tiers'))
}

export async function listApprovalChains() {
  return unwrapList(await request('/discounts/approval-chains'))
}

export async function saveDiscountTier(payload) {
  return (await request('/discounts/tiers', { method: 'POST', body: JSON.stringify(payload) })).data
}

export async function updateDiscountTier(tierId, payload) {
  return (await request(`/discounts/tiers/${tierId}`, { method: 'PUT', body: JSON.stringify(payload) })).data
}

export async function saveApprovalChain(payload) {
  return (await request('/discounts/approval-chains', { method: 'POST', body: JSON.stringify(payload) })).data
}

export async function updateApprovalChain(chainId, payload) {
  return (await request(`/discounts/approval-chains/${chainId}`, { method: 'PUT', body: JSON.stringify(payload) })).data
}

export async function getUpsellSuggestions(quotationId) {
  const value = (await request(`/upsell/quotations/${quotationId}/suggestions`)).data
  return Array.isArray(value) ? value : value?.items || []
}

export async function listWarehouses() {
  return unwrapList(await request('/warehouses'))
}

export async function listStockLevels(warehouseId) {
  return unwrapList(await request(`/warehouses/${warehouseId}/stock-levels`))
}

export async function reserveStock(lineId, payload = {}) {
  return (await request(`/warehouses/lines/${lineId}/reserve-stock`, { method: 'POST', body: JSON.stringify(payload) })).data
}

export async function overrideFulfillment(payload) {
  return (await request('/warehouses/fulfillment-splits/override', { method: 'POST', body: JSON.stringify(payload) })).data
}

export async function consolidateBackorders(payload = {}) {
  return (await request('/warehouses/backorders/consolidate', { method: 'POST', body: JSON.stringify(payload) })).data
}

export async function listSubscriptionPlans() {
  return unwrapList(await request('/subscriptions/plans'))
}

export async function createSubscriptionPlan(payload) {
  return (await request('/subscriptions/plans', { method: 'POST', body: JSON.stringify(payload) })).data
}

export async function generateSchedules(payload) {
  return unwrapList(await request('/subscriptions/schedules/generate', { method: 'POST', body: JSON.stringify(payload) }))
}

export async function getLineSchedules(lineId) {
  return unwrapList(await request(`/subscriptions/lines/${lineId}/schedules`))
}

export async function cancelSubscriptionLine(lineId, payload) {
  return (await request(`/subscriptions/lines/${lineId}/cancel`, { method: 'POST', body: JSON.stringify(payload) })).data
}

export async function negotiateQuotation(quotationId, payload) {
  return (await request(`/negotiation/quotations/${quotationId}/negotiate`, { method: 'POST', body: JSON.stringify(payload) })).data
}

export async function getNegotiationHistory(quotationId) {
  const value = (await request(`/negotiation/quotations/${quotationId}/history`)).data
  return Array.isArray(value) ? value : value?.items || []
}

export async function getDealHealthDashboard() {
  return (await request('/dealHealth/dashboard')).data
}

export async function listDealHealthAlerts() {
  return unwrapList(await request('/dealHealth/alerts'))
}

export async function acknowledgeDealHealthAlert(alertId) {
  return (await request(`/dealHealth/alerts/${alertId}/acknowledge`, { method: 'POST' })).data
}

export async function getSalesReport(params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
  return request(`/reporting/sales?${query}`)
}

// ---------------------------------------------------------------------------
// AUDIT TRAIL — real, role-attributed operation ledger (backend audit_trails)
// Every CREATE / UPDATE / DELETE performed by any role is stored server-side
// with changed_by / changed_by_role and reflected back through this endpoint.
// ---------------------------------------------------------------------------
export async function listAuditTrails(params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
  return unwrapList(await request(`/audit?${query}`))
}

export async function listQuotationAuditTrails(quotationId) {
  return listAuditTrails({ table_name: 'quotations', record_id: quotationId, limit: 20 })
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
