/**
 * Pure billing schedule generator.
 * Given a quotation and lines (mixed one-time and recurring),
 * produces the complete set of billing_schedules rows.
 * 
 * @param {Object} params
 * @param {Object} params.quotation - Quotation object { id, customer_id, currency }
 * @param {Array<Object>} params.lines - Quotation lines (with line_type, line_total, subscription_plan details)
 * @param {Date|string} params.startDate - Schedule start date
 * @param {number} [params.defaultCycles=12] - Default recurring cycles to generate if not specified
 * @returns {Array<Object>} Array of billing_schedules payload objects
 */
export function generateBillingSchedules({
  quotation,
  lines = [],
  startDate = new Date(),
  defaultCycles = 12,
}) {
  const start = new Date(startDate);
  const currency = quotation?.currency || 'USD';
  const customerId = quotation?.customer_id;
  const schedules = [];

  for (const line of lines) {
    const lineTotal = Number(line.line_total || line.line_subtotal || 0);

    if (line.line_type === 'one_time') {
      // One-time line items bill once immediately / on fulfillment
      schedules.push({
        quotation_line_id: line.id,
        customer_id: customerId,
        subscription_plan_id: line.subscription_plan_id || null,
        cycle_number: 1,
        period_start: formatDate(start),
        period_end: formatDate(start),
        amount: Number(lineTotal.toFixed(2)),
        currency,
        status: 'pending',
        due_date: formatDate(start),
        notes: `One-time line item: ${line.custom_name || line.product_name || 'Line Item'}`,
        proration_details: null,
      });
    } else if (line.line_type === 'recurring') {
      const intervalType = (line.interval_type || line.subscription_plan?.interval_type || 'monthly').toLowerCase();
      const intervalCount = Number(line.interval_count || line.subscription_plan?.interval_count || 1);

      let cyclesToGenerate = Number(line.min_commitment_cycles || 0);
      if (cyclesToGenerate <= 0) {
        cyclesToGenerate = intervalType === 'yearly' ? 1 : intervalType === 'quarterly' ? 4 : defaultCycles;
      }

      let currentPeriodStart = new Date(start);

      for (let cycle = 1; cycle <= cyclesToGenerate; cycle++) {
        const currentPeriodEnd = calculatePeriodEnd(currentPeriodStart, intervalType, intervalCount);

        schedules.push({
          quotation_line_id: line.id,
          customer_id: customerId,
          subscription_plan_id: line.subscription_plan_id || null,
          cycle_number: cycle,
          period_start: formatDate(currentPeriodStart),
          period_end: formatDate(currentPeriodEnd),
          amount: Number(lineTotal.toFixed(2)),
          currency,
          status: 'pending',
          due_date: formatDate(currentPeriodStart),
          notes: `Recurring ${intervalType} billing - Cycle ${cycle} of ${cyclesToGenerate}`,
          proration_details: null,
        });

        // Next cycle starts day after current cycle ends
        currentPeriodStart = addDays(currentPeriodEnd, 1);
      }
    }
  }

  return schedules;
}

function calculatePeriodEnd(startDate, intervalType, intervalCount = 1) {
  const end = new Date(startDate);
  if (intervalType === 'yearly') {
    end.setFullYear(end.getFullYear() + intervalCount);
  } else if (intervalType === 'quarterly') {
    end.setMonth(end.getMonth() + 3 * intervalCount);
  } else {
    // monthly default
    end.setMonth(end.getMonth() + 1 * intervalCount);
  }
  // Period end is 1 day before next period start
  end.setDate(end.getDate() - 1);
  return end;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

export default {
  generateBillingSchedules,
};
