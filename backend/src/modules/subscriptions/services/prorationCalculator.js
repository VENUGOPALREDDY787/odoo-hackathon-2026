/**
 * Pure, unit-testable proration calculation function.
 * Uses integer-cents arithmetic to eliminate floating-point currency imprecision.
 * 
 * @param {number} oldQty - Previous quantity in billing cycle
 * @param {number} newQty - New quantity in billing cycle (0 for cancellation)
 * @param {number} unitPrice - Price per unit per full cycle in dollars
 * @param {number} daysRemainingInCycle - Unused days remaining in current billing cycle
 * @param {number} totalDaysInCycle - Total days in current billing cycle
 * @returns {Object} Proration result with integer cents and dollar amounts
 */
export function calculateProration(
  oldQty,
  newQty,
  unitPrice,
  daysRemainingInCycle,
  totalDaysInCycle
) {
  const oQty = Number(oldQty || 0);
  const nQty = Number(newQty || 0);
  const uPrice = Number(unitPrice || 0);
  const daysRemaining = Math.max(0, Number(daysRemainingInCycle || 0));
  const totalDays = Math.max(1, Number(totalDaysInCycle || 1));

  // Convert unit price to integer cents to avoid floating-point errors
  const unitPriceCents = Math.round(uPrice * 100);
  const deltaQty = nQty - oQty;

  // Calculate full cycle delta in integer cents
  const fullCycleDeltaCents = deltaQty * unitPriceCents;

  // Calculate prorated amount in integer cents
  // Use `|| 0` to normalize IEEE-754 negative zero (-0) to positive zero
  const proratedCents = Math.round((fullCycleDeltaCents * daysRemaining) / totalDays) || 0;

  // Convert back to dollars (rounded to 2 decimal places)
  const proratedAmount = Number((proratedCents / 100).toFixed(2));

  return {
    prorated_amount: proratedAmount,
    prorated_cents: proratedCents,
    old_quantity: oQty,
    new_quantity: nQty,
    delta_quantity: deltaQty,
    unit_price: uPrice,
    unit_price_cents: unitPriceCents,
    days_remaining_in_cycle: daysRemaining,
    total_days_in_cycle: totalDays,
    proration_factor: Math.round((daysRemaining / totalDays) * 10000) / 10000,
    is_credit_note: proratedCents < 0,
  };
}

export default {
  calculateProration,
};
