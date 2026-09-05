/**
 * Pure, zero-dependency discount risk scoring and approval routing functions.
 * Independent of Express/DB so they can be unit-tested with plain JavaScript objects.
 */

/**
 * Calculates blended risk score across all quotation lines.
 * Checks EVERY line against its category + customer tier ceiling (not one whole-order ceiling),
 * sums violation points across all lines (not just the worst line), and returns risk metrics.
 *
 * @param {Array<Object>} quotationLines - Array of quotation line items
 * @param {Array<Object>} discountTiers - Array of configured discount tier rules
 * @param {string} customerTier - Customer tier ('Bronze', 'Silver', 'Gold')
 * @returns {Object} { blendedScore, maxSingleViolation, requiresApproval, lineDetails }
 */
export function calculateBlendedRisk(quotationLines = [], discountTiers = [], customerTier = 'Bronze') {
  let blendedScore = 0;
  let maxSingleViolation = 0;
  const lineDetails = [];

  for (const [index, line] of quotationLines.entries()) {
    const lineDiscount = Number(line.discount_percent || 0);
    const productId = line.product_id || null;
    const categoryId = line.category_id || line.product_category_id || null;

    // Find applicable ceiling from discountTiers matching customerTier and product/category
    const ceiling = findApplicableCeiling(discountTiers, customerTier, categoryId, productId);

    const violationPoints = Math.max(0, lineDiscount - ceiling);
    blendedScore += violationPoints;

    if (violationPoints > maxSingleViolation) {
      maxSingleViolation = violationPoints;
    }

    lineDetails.push({
      line_number: line.line_number || index + 1,
      product_id: productId,
      category_id: categoryId,
      discount_percent: lineDiscount,
      ceiling_percent: ceiling,
      violation_points: violationPoints,
      has_violation: violationPoints > 0,
    });
  }

  // Round blendedScore and maxSingleViolation to 2 decimal places to avoid floating point imprecision
  blendedScore = Math.round(blendedScore * 100) / 100;
  maxSingleViolation = Math.round(maxSingleViolation * 100) / 100;

  return {
    blendedScore,
    maxSingleViolation,
    requiresApproval: blendedScore > 0,
    lineDetails,
  };
}

/**
 * Helper to find applicable ceiling discount % for a given line.
 */
function findApplicableCeiling(discountTiers, customerTier, categoryId, productId) {
  const activeTiers = discountTiers.filter(t => t.is_active !== false && !t.deleted_at);

  let candidates = activeTiers.filter(tier => {
    if (tier.customer_tier && tier.customer_tier !== customerTier) {
      return false;
    }

    if (productId && tier.product_id) {
      return tier.product_id === productId;
    }

    if (categoryId && tier.category_id) {
      return tier.category_id === categoryId;
    }

    // General default tier if neither category nor product specified
    if (!tier.product_id && !tier.category_id) {
      return true;
    }

    return false;
  });

  if (candidates.length === 0) {
    return 0; // Default ceiling: 0% unapproved discount allowed
  }

  // Priority sorting:
  // 1. Product-specific > Category-specific > General
  // 2. Customer tier specific > Tier-agnostic
  // 3. Higher priority field value
  candidates.sort((a, b) => {
    const aProd = a.product_id ? 2 : a.category_id ? 1 : 0;
    const bProd = b.product_id ? 2 : b.category_id ? 1 : 0;
    if (aProd !== bProd) return bProd - aProd;

    const aTier = a.customer_tier ? 1 : 0;
    const bTier = b.customer_tier ? 1 : 0;
    if (aTier !== bTier) return bTier - aTier;

    return (b.priority || 0) - (a.priority || 0);
  });

  return Number(candidates[0].discount_percent || 0);
}

/**
 * Pure function to determine required approval levels based on blended score and active approval chains.
 *
 * @param {number} blendedScore - The calculated blended risk score
 * @param {Array<Object>} approvalChains - List of configured approval chain rules
 * @returns {Object} { requires_approval, blended_score, required_roles, min_approvals_required, matching_chains }
 */
export function routeApproval(blendedScore = 0, approvalChains = []) {
  if (blendedScore <= 0) {
    return {
      requires_approval: false,
      blended_score: 0,
      required_roles: [],
      min_approvals_required: 0,
      matching_chains: [],
    };
  }

  const safeChains = Array.isArray(approvalChains) ? approvalChains : [];
  const activeChains = safeChains.filter(c => c.is_active !== false && !c.deleted_at);

  const matchingChains = activeChains.filter(chain => {
    const min = Number(chain.min_discount_percent || 0);
    const max = Number(chain.max_discount_percent || 100);
    return blendedScore >= min && blendedScore <= max;
  });

  const rolesSet = new Set();
  let maxApprovalsRequired = 1;

  for (const chain of matchingChains) {
    let roles = chain.required_approver_roles;
    if (typeof roles === 'string') {
      try {
        roles = JSON.parse(roles);
      } catch (e) {
        roles = [roles];
      }
    }
    if (Array.isArray(roles)) {
      roles.forEach(r => rolesSet.add(r));
    }

    if (chain.min_approvals_required > maxApprovalsRequired) {
      maxApprovalsRequired = chain.min_approvals_required;
    }
  }

  const required_roles = Array.from(rolesSet);

  return {
    requires_approval: required_roles.length > 0,
    blended_score: blendedScore,
    required_roles,
    min_approvals_required: required_roles.length > 0 ? maxApprovalsRequired : 0,
    matching_chains: matchingChains.map(c => ({
      id: c.id,
      name: c.name,
      min_discount_percent: Number(c.min_discount_percent),
      max_discount_percent: Number(c.max_discount_percent),
      required_approver_roles: c.required_approver_roles,
    })),
  };
}

export default {
  calculateBlendedRisk,
  routeApproval,
};
