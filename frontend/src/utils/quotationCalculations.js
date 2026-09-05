export const TIER_DISCOUNT_CEILINGS = { Bronze: 10, Silver: 15, Gold: 25 }

export const CATEGORY_DISCOUNT_CEILINGS = {
  'Enterprise Hardware': 12,
  'SaaS Licenses': 20,
  'Professional Services': 15,
  'Cloud Infrastructure': 18,
  'Support & Maintenance': 25,
}

export function calculateLineTotal(line) {
  const base = line.qty * line.unitPrice
  return base - base * (line.discountPct / 100)
}

export function calculateQuotationTotals(lines) {
  let subtotal = 0
  let totalDiscount = 0
  let total = 0
  let hasRecurring = false
  let hasOneTime = false

  lines.forEach((line) => {
    const base = line.qty * line.unitPrice
    const discount = base * (line.discountPct / 100)
    subtotal += base
    totalDiscount += discount
    total += base - discount
    if (line.isRecurring) hasRecurring = true
    else hasOneTime = true
  })

  return {
    subtotal,
    totalDiscount,
    total,
    effectiveDiscountPct: subtotal > 0 ? (totalDiscount / subtotal) * 100 : 0,
    hasRecurring,
    hasOneTime,
  }
}

export function calculateBlendedRisk(lines, customerTier) {
  if (!lines?.length) return { score: 0, level: 'LOW', flaggedLines: [] }
  const tierCeiling = TIER_DISCOUNT_CEILINGS[customerTier] || 10
  let maxExcess = 0
  let weightedExcess = 0
  let totalWeight = 0
  const flaggedLines = []

  lines.forEach((line) => {
    const categoryLimit = CATEGORY_DISCOUNT_CEILINGS[line.category] || 15
    const effectiveCeiling = Math.min(tierCeiling, categoryLimit)
    const excess = Math.max(0, line.discountPct - effectiveCeiling)
    const weight = line.qty * line.unitPrice
    if (line.discountPct > effectiveCeiling) {
      flaggedLines.push({
        productId: line.productId,
        product: line.product,
        category: line.category,
        discountGiven: line.discountPct,
        limitAllowed: effectiveCeiling,
        tierLimit: tierCeiling,
        categoryLimit,
        overBy: Number((line.discountPct - effectiveCeiling).toFixed(1)),
      })
    }
    maxExcess = Math.max(maxExcess, excess)
    weightedExcess += excess * weight
    totalWeight += weight
  })

  const averageExcess = totalWeight > 0 ? weightedExcess / totalWeight : 0
  const score = Math.min(100, Math.round(averageExcess * 4.5 + flaggedLines.length * 10))
  return {
    score,
    level: score > 65 ? 'HIGH' : score > 25 ? 'MEDIUM' : 'LOW',
    flaggedLines,
    requiresFinance: score > 50 || maxExcess > 10,
  }
}

export function calculateProration(oldQty, newQty, unitPrice, daysRemainingInCycle, totalDaysInCycle) {
  const dailyRate = unitPrice / totalDaysInCycle
  const deltaQty = newQty - oldQty
  return {
    deltaQty,
    dailyRate,
    daysRemainingInCycle,
    totalDaysInCycle,
    prorationAmount: Math.round(deltaQty * dailyRate * daysRemainingInCycle * 100) / 100,
  }
}
