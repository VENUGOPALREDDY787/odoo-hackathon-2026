/**
 * Pure, independently testable price resolution function.
 * Given a product (and optional variant), price list item overrides, customer tier, currency, and quantity,
 * resolves the effective price with full source auditing.
 *
 * @param {Object} params
 * @param {Object} params.product - Product entity
 * @param {Object} [params.variant] - Product variant entity (optional)
 * @param {Array<Object>} [params.priceListItems] - List of candidate price list items with joined price list currency info
 * @param {string} [params.customerTier='Bronze'] - Customer tier ('Bronze', 'Silver', 'Gold')
 * @param {string} [params.currency='USD'] - Target currency ISO code
 * @param {number} [params.quantity=1] - Quantity requested
 * @returns {Object} Resolution result containing effective_price, source, currency, and details
 */
export function resolvePrice({
  product,
  variant = null,
  priceListItems = [],
  customerTier = 'Bronze',
  currency = 'USD',
  quantity = 1,
}) {
  if (!product) {
    return {
      effective_price: null,
      source: 'not_found',
      currency,
      reason: 'Product not found',
    };
  }

  if (product.deleted_at) {
    return {
      effective_price: null,
      source: 'deleted',
      currency,
      reason: 'Product is deleted',
    };
  }

  if (!product.is_active) {
    return {
      effective_price: null,
      source: 'inactive',
      currency,
      reason: 'Product is inactive',
    };
  }

  if (variant && (!variant.is_active || variant.deleted_at)) {
    return {
      effective_price: null,
      source: 'inactive_variant',
      currency,
      reason: 'Product variant is inactive or deleted',
    };
  }

  const reqVariantId = variant ? variant.id : null;
  const targetCurrency = (currency || 'USD').toUpperCase();
  const reqQty = Number(quantity) || 1;

  // Filter candidates matching price list currency, variant, customer tier, and quantity limits
  const validCandidates = priceListItems.filter(item => {
    const itemCurrency = (item.currency || item.price_list_currency || '').toUpperCase();
    
    // Currency check: price list currency must match target currency
    if (itemCurrency && itemCurrency !== targetCurrency) {
      return false;
    }

    // Variant check:
    if (reqVariantId) {
      // If item is specifically for another variant, skip
      if (item.variant_id && item.variant_id !== reqVariantId) return false;
    } else {
      // If request has no variant, skip variant-specific items
      if (item.variant_id) return false;
    }

    // Customer tier check:
    if (item.customer_tier && item.customer_tier !== customerTier) {
      return false;
    }

    // Quantity range check:
    const minQty = Number(item.min_quantity) || 1;
    if (reqQty < minQty) return false;
    if (item.max_quantity !== null && item.max_quantity !== undefined) {
      if (reqQty > Number(item.max_quantity)) return false;
    }

    return true;
  });

  // Sort candidates by specificity priority:
  // 1. Variant-specific override > product-level override
  // 2. Customer tier specific override > tier-agnostic override
  // 3. Default price list preference
  // 4. Higher min_quantity (more specific tier break)
  validCandidates.sort((a, b) => {
    const aVar = a.variant_id ? 1 : 0;
    const bVar = b.variant_id ? 1 : 0;
    if (aVar !== bVar) return bVar - aVar;

    const aTier = a.customer_tier ? 1 : 0;
    const bTier = b.customer_tier ? 1 : 0;
    if (aTier !== bTier) return bTier - aTier;

    const aDef = a.is_default ? 1 : 0;
    const bDef = b.is_default ? 1 : 0;
    if (aDef !== bDef) return bDef - aDef;

    const aMinQty = Number(a.min_quantity) || 1;
    const bMinQty = Number(b.min_quantity) || 1;
    return bMinQty - aMinQty;
  });

  if (validCandidates.length > 0) {
    const selected = validCandidates[0];
    return {
      effective_price: Number(selected.unit_price),
      source: 'price_list_override',
      currency: targetCurrency,
      details: {
        price_list_id: selected.price_list_id,
        price_list_name: selected.price_list_name || null,
        price_list_item_id: selected.id,
        customer_tier: selected.customer_tier || null,
        min_quantity: Number(selected.min_quantity) || 1,
        max_quantity: selected.max_quantity ? Number(selected.max_quantity) : null,
      },
    };
  }

  // Fallback to base product price (+ variant price adjustment if applicable)
  const productCurrency = (product.currency || 'USD').toUpperCase();
  if (productCurrency !== targetCurrency) {
    return {
      effective_price: null,
      source: 'currency_mismatch',
      currency: targetCurrency,
      reason: `Currency mismatch: product base price is in ${productCurrency}, requested ${targetCurrency}`,
    };
  }

  const basePrice = Number(product.base_price) || 0;
  const variantAdj = variant ? Number(variant.price_adjustment || 0) : 0;
  const finalPrice = Math.max(0, basePrice + variantAdj);

  return {
    effective_price: finalPrice,
    source: 'base_price',
    currency: targetCurrency,
    details: {
      base_price: basePrice,
      variant_price_adjustment: variantAdj,
      variant_id: reqVariantId,
    },
  };
}

export default resolvePrice;
