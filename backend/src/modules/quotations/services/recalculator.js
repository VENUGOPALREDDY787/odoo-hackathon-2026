import { calculateBlendedRisk, routeApproval } from '../../discounts/services/riskScorer.js';

/**
 * Pure recalculation function for quotation line items and order totals.
 * Calculates line-level net unit price, subtotals, tax, and margin.
 * Re-evaluates order-level totals, blended margin %, and blended risk score (Prompt 5 risk engine).
 *
 * @param {Object} params
 * @param {Object} params.quotation - Quotation header record
 * @param {Array<Object>} params.lines - Quotation lines (with product cost_price data)
 * @param {Array<Object>} [params.discountTiers=[]] - Active discount tier rules
 * @param {string} [params.customerTier='Bronze'] - Customer tier ('Bronze', 'Silver', 'Gold')
 * @param {Array<Object>} [params.approvalChains=[]] - Active approval chain rules
 * @returns {Object} Recalculated quotation totals, computed line array, and risk score breakdown
 */
export function recalculateQuotationTotals({
  quotation = {},
  lines = [],
  discountTiers = [],
  customerTier = 'Bronze',
  approvalChains = [],
}) {
  let subtotal = 0;
  let discount_total = 0;
  let tax_total = 0;
  let margin_total = 0;

  const computed_lines = lines.map((line, idx) => {
    const qty = Number(line.quantity) || 1;
    const listPrice = Number(line.list_price) || 0;
    const discountPct = Number(line.discount_percent) || 0;
    const discountAmt = Number(line.discount_amount) || 0;
    const taxRate = Number(line.tax_rate) || 0;
    const costPriceUnit = Number(line.cost_price || line.unit_cost || 0);

    // Compute net unit price: list_price * (1 - discount_percent / 100) - (discount_amount / quantity)
    const netUnitPrice = Math.max(0, listPrice * (1 - discountPct / 100) - (qty > 0 ? discountAmt / qty : 0));
    const lineSubtotal = netUnitPrice * qty;
    const lineTaxAmount = lineSubtotal * (taxRate / 100);
    const lineTotal = lineSubtotal + lineTaxAmount;

    const lineCost = costPriceUnit * qty;
    const lineMargin = lineSubtotal - lineCost;
    const lineMarginPct = lineSubtotal > 0 ? (lineMargin / lineSubtotal) * 100 : 0;

    const rawDiscountDelta = Math.max(0, (listPrice - netUnitPrice) * qty);

    subtotal += lineSubtotal;
    discount_total += rawDiscountDelta;
    tax_total += lineTaxAmount;
    margin_total += lineMargin;

    return {
      ...line,
      line_number: line.line_number || idx + 1,
      quantity: qty,
      list_price: Math.round(listPrice * 100) / 100,
      discount_percent: discountPct,
      discount_amount: discountAmt,
      net_unit_price: Math.round(netUnitPrice * 100) / 100,
      line_subtotal: Math.round(lineSubtotal * 100) / 100,
      tax_rate: taxRate,
      tax_amount: Math.round(lineTaxAmount * 100) / 100,
      line_total: Math.round(lineTotal * 100) / 100,
      unit_cost: Math.round(costPriceUnit * 100) / 100,
      line_cost: Math.round(lineCost * 100) / 100,
      line_margin: Math.round(lineMargin * 100) / 100,
      line_margin_percentage: Math.round(lineMarginPct * 100) / 100,
    };
  });

  const shippingTotal = Number(quotation.shipping_total || 0);
  const grandTotal = subtotal + tax_total + shippingTotal;
  const marginPercentage = subtotal > 0 ? (margin_total / subtotal) * 100 : 0;

  // Re-evaluate risk score via Prompt 5 risk engine
  const risk = calculateBlendedRisk(computed_lines, discountTiers, customerTier);
  const routing = routeApproval(risk.blendedScore, approvalChains);

  return {
    computed_lines,
    subtotal: Math.round(subtotal * 100) / 100,
    discount_total: Math.round(discount_total * 100) / 100,
    tax_total: Math.round(tax_total * 100) / 100,
    shipping_total: Math.round(shippingTotal * 100) / 100,
    grand_total: Math.round(grandTotal * 100) / 100,
    margin_total: Math.round(margin_total * 100) / 100,
    margin_percentage: Math.round(marginPercentage * 100) / 100,
    blended_risk_score: risk.blendedScore,
    max_single_violation: risk.maxSingleViolation,
    requires_approval: routing.requires_approval,
    routing,
  };
}

/**
 * Calculates live margin delta between previous order totals and new order totals.
 *
 * @param {Object} previousTotals - Previous order totals { margin_total, margin_percentage }
 * @param {Object} newTotals - New order totals { margin_total, margin_percentage }
 * @returns {Object} Margin delta breakdown
 */
export function calculateMarginDelta(previousTotals = {}, newTotals = {}) {
  const marginBefore = Number(previousTotals.margin_total || 0);
  const marginAfter = Number(newTotals.margin_total || 0);
  const marginDeltaAmount = marginAfter - marginBefore;

  const pctBefore = Number(previousTotals.margin_percentage || 0);
  const pctAfter = Number(newTotals.margin_percentage || 0);
  const pctDelta = pctAfter - pctBefore;

  return {
    margin_before: Math.round(marginBefore * 100) / 100,
    margin_after: Math.round(marginAfter * 100) / 100,
    margin_delta_amount: Math.round(marginDeltaAmount * 100) / 100,
    margin_pct_before: Math.round(pctBefore * 100) / 100,
    margin_pct_after: Math.round(pctAfter * 100) / 100,
    margin_pct_delta: Math.round(pctDelta * 100) / 100,
  };
}

export default {
  recalculateQuotationTotals,
  calculateMarginDelta,
};
