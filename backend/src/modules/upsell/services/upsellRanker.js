/**
 * Pure, side-effect-free upsell ranking function.
 *
 * Given a quotation's current line items and a set of active upsell_rules
 * (with their recommended products pre-joined), returns a ranked list of
 * upsell suggestions, each annotated with the live margin delta they would
 * add if accepted.
 *
 * RANKING ALGORITHM
 * -----------------
 *  score = base_score + promotion_boost + priority_boost
 *
 *  base_score       = 100 (constant – every qualified rule starts here)
 *  promotion_boost  = +50 if rule.priority >= PROMOTED_PRIORITY_THRESHOLD
 *  priority_boost   = rule.priority (0..N – higher priority = higher rank)
 *
 * Rules are EXCLUDED when:
 *  - recommended_product already present in any quotation line (by product_id OR variant_id)
 *  - recommended product is inactive / soft-deleted
 *  - rule itself is inactive / soft-deleted
 *  - the recommendation's margin % (after the rule's discount) is below minMarginPercent threshold
 *  - a condition_type filter fails (customer_tier, quantity_threshold)
 *
 * Margin delta reuses recalculator.js calculateMarginDelta – no duplication.
 *
 * @param {Object}   params
 * @param {Array}    params.quotationLines         - Current quotation line items
 * @param {Object}   params.quotationTotals        - Current totals from recalculateQuotationTotals
 * @param {Array}    params.upsellRules            - Active upsell_rules rows with joined product data
 * @param {number}   [params.minMarginPercent=0]   - Minimum post-discount margin % to include suggestion
 * @param {string}   [params.customerTier='Bronze'] - Customer tier for condition_type='customer_tier' checks
 * @returns {Array} Ranked array of upsell suggestions with score and margin_delta
 */

import { recalculateQuotationTotals, calculateMarginDelta } from '../../quotations/services/recalculator.js';

const PROMOTED_PRIORITY_THRESHOLD = 10; // rules with priority >= 10 are treated as "promoted"
const BASE_SCORE = 100;
const PROMOTION_BOOST = 50;

export function rankUpsellSuggestions({
  quotationLines = [],
  quotationTotals = {},
  upsellRules = [],
  minMarginPercent = 0,
  customerTier = 'Bronze',
  discountTiers = [],
  approvalChains = [],
  quotation = {},
}) {
  // Build a fast lookup of products / variants already in the quote
  const existingProductIds = new Set(quotationLines.map((l) => l.product_id).filter(Boolean));
  const existingVariantIds = new Set(quotationLines.map((l) => l.variant_id).filter(Boolean));

  const suggestions = [];

  for (const rule of upsellRules) {
    // --- Guard: rule itself must be active and not deleted
    if (!rule.is_active || rule.deleted_at) continue;

    // --- Guard: recommended product must be active and not deleted
    const recProd = rule.recommended_product;
    if (!recProd || !recProd.is_active || recProd.deleted_at) continue;

    const recVariantId = rule.recommended_variant_id || null;

    // --- Guard: exclude if product already in the quotation
    if (existingProductIds.has(rule.recommended_product_id)) continue;
    if (recVariantId && existingVariantIds.has(recVariantId)) continue;

    // --- Guard: condition_type filtering
    if (!meetsCondition(rule, quotationLines, customerTier)) continue;

    // --- Compute effective price after any rule-level discount
    const basePrice = Number(recProd.base_price) || 0;
    const discountPct = Number(rule.discount_percent) || 0;
    const effectivePrice = Math.max(0, basePrice * (1 - discountPct / 100));

    // --- Guard: margin check
    const costPrice = Number(recProd.cost_price) || 0;
    const margin = effectivePrice - costPrice;
    const marginPct = effectivePrice > 0 ? (margin / effectivePrice) * 100 : 0;
    if (marginPct < minMarginPercent) continue;

    // --- Compute live margin delta by simulating the addition of this line
    //     Reuses recalculator.js – no duplicated logic
    const simulatedLine = buildSimulatedLine(rule, recProd, effectivePrice, costPrice);
    const simulatedTotals = recalculateQuotationTotals({
      quotation,
      lines: [...quotationLines, simulatedLine],
      discountTiers,
      customerTier,
      approvalChains,
    });
    const marginDelta = calculateMarginDelta(quotationTotals, simulatedTotals);

    // --- Ranking score
    const isPromoted = Number(rule.priority) >= PROMOTED_PRIORITY_THRESHOLD;
    const score = BASE_SCORE + (isPromoted ? PROMOTION_BOOST : 0) + Number(rule.priority || 0);

    suggestions.push({
      rule_id: rule.id,
      rule_name: rule.name,
      rule_description: rule.description || null,
      condition_type: rule.condition_type,
      condition_config: rule.condition_config || {},
      discount_percent: discountPct,
      priority: Number(rule.priority),
      is_promoted: isPromoted,
      score,

      recommended_product_id: rule.recommended_product_id,
      recommended_variant_id: recVariantId,
      recommended_product: {
        id: recProd.id,
        name: recProd.name,
        sku: recProd.sku,
        base_price: basePrice,
        cost_price: costPrice,
        category_id: recProd.category_id || null,
        description: recProd.description || null,
      },
      recommended_variant: rule.recommended_variant || null,

      effective_price: Math.round(effectivePrice * 100) / 100,
      margin_percent: Math.round(marginPct * 100) / 100,
      margin_delta: marginDelta,

      // Convenience: what to POST to /api/quotations/:id/lines to accept
      add_to_quote_payload: {
        product_id: rule.recommended_product_id,
        variant_id: recVariantId,
        quantity: 1,
        list_price: effectivePrice,
        discount_percent: 0,
        line_type: 'one_time',
      },
    });
  }

  // Sort descending by score – highest relevance first
  suggestions.sort((a, b) => b.score - a.score);

  return suggestions;
}

// ---------------------------------------------------------------------------
// Helpers (private to this module)
// ---------------------------------------------------------------------------

/**
 * Checks whether a rule's condition_type is satisfied by the current quote context.
 */
function meetsCondition(rule, quotationLines, customerTier) {
  const config = rule.condition_config || {};

  switch (rule.condition_type) {
    case 'always':
      return true;

    case 'customer_tier': {
      // condition_config.required_tier or condition_config.required_tiers[]
      const requiredTier = config.required_tier;
      const requiredTiers = config.required_tiers;
      if (requiredTier) return customerTier === requiredTier;
      if (Array.isArray(requiredTiers)) return requiredTiers.includes(customerTier);
      return true; // no tier constraint configured → pass
    }

    case 'quantity_threshold': {
      // condition_config.trigger_product_id + min_quantity
      const triggerProductId = rule.trigger_product_id;
      const minQty = Number(config.min_quantity) || 1;
      if (!triggerProductId) return false;
      const triggerLine = quotationLines.find((l) => l.product_id === triggerProductId);
      return triggerLine ? Number(triggerLine.quantity) >= minQty : false;
    }

    case 'custom':
      // Custom conditions require server-side evaluation via condition_config.
      // For now, treat as always-pass (extensible hook).
      return true;

    default:
      return true;
  }
}

/**
 * Builds a minimal synthetic quotation line for recalculation simulation.
 * Mirrors the shape expected by recalculateQuotationTotals.
 */
function buildSimulatedLine(rule, product, effectivePrice, costPrice) {
  return {
    id: `__upsell_sim_${rule.id}`,
    product_id: rule.recommended_product_id,
    variant_id: rule.recommended_variant_id || null,
    quantity: 1,
    list_price: effectivePrice,
    discount_percent: 0,
    discount_amount: 0,
    tax_rate: Number(product.tax_rate || 0),
    cost_price: costPrice,
    unit_cost: costPrice,
    line_type: 'one_time',
    // Pre-computed to satisfy recalculator's cost path
    product_cost_price: costPrice,
  };
}

export default rankUpsellSuggestions;
