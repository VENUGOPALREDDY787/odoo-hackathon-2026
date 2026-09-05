/**
 * Deal Health Detection Queries
 *
 * Three pure, side-effect-free functions that query the DB for unhealthy deals.
 * Each returns an array of alert payloads ready to insert into deal_health_alerts.
 * No writes happen here — the caller (scheduler) decides whether to persist.
 */

// ---------------------------------------------------------------------------
// 1. STALLED DEAL DETECTION
//    Quotations with no status change in > N configurable days.
//    Uses updated_at as a proxy for "last state change" since the schema
//    doesn't have a dedicated last_status_change column.
// ---------------------------------------------------------------------------
export async function detectStalledDeals(db, { stalledDaysThreshold = 7 } = {}) {
  const cutoff = new Date(Date.now() - stalledDaysThreshold * 24 * 60 * 60 * 1000);

  // Only active (non-terminal) statuses can be stalled
  const activeStatuses = ['draft', 'pending_approval', 'sent'];

  const rows = await db('quotations as q')
    .join('customers as c', 'q.customer_id', 'c.id')
    .leftJoin('users as u', 'q.assigned_rep_id', 'u.id')
    .whereIn('q.status', activeStatuses)
    .whereNull('q.deleted_at')
    .where('q.updated_at', '<', cutoff)
    // Exclude quotations that already have an unacknowledged stalled alert
    .whereNotExists(function () {
      this.select('id')
        .from('deal_health_alerts')
        .whereRaw('deal_health_alerts.quotation_id = q.id')
        .where('deal_health_alerts.alert_type', 'stalled_deal')
        .where('deal_health_alerts.is_acknowledged', 0)
        .whereNull('deal_health_alerts.deleted_at');
    })
    .select(
      'q.id as quotation_id',
      'q.quotation_number',
      'q.status',
      'q.updated_at',
      'q.grand_total',
      'q.assigned_rep_id',
      'c.company_name as customer_name',
      'u.full_name as rep_name',
      db.raw(`DATEDIFF(NOW(), q.updated_at) AS days_stalled`)
    );

  return rows.map((row) => ({
    quotation_id: row.quotation_id,
    alert_type: 'stalled_deal',
    severity: row.days_stalled > stalledDaysThreshold * 2 ? 'critical' : 'high',
    title: `Stalled Deal — No activity for ${row.days_stalled} days`,
    description:
      `Quotation ${row.quotation_number} for ${row.customer_name} has been in ` +
      `'${row.status}' status for ${row.days_stalled} days without any update. ` +
      `Rep: ${row.rep_name || 'Unassigned'}. Value: ${row.grand_total}.`,
    metric_name: 'days_since_last_update',
    metric_value: row.days_stalled,
    threshold_value: stalledDaysThreshold,
    metadata: JSON.stringify({
      quotation_number: row.quotation_number,
      status: row.status,
      assigned_rep_id: row.assigned_rep_id,
      customer_name: row.customer_name,
      grand_total: row.grand_total,
      updated_at: row.updated_at,
    }),
  }));
}

// ---------------------------------------------------------------------------
// 2. DISCOUNT ANOMALY DETECTION
//    A rep's current quotation discount is significantly above their own
//    historical average discount across past APPROVED quotations.
// ---------------------------------------------------------------------------
export async function detectDiscountAnomalies(
  db,
  { anomalyStdDevMultiplier = 1.5, minHistoricalQuotations = 3 } = {}
) {
  // Step 1: Compute historical average discount per rep across approved quotations
  // Uses weighted average of line-level discount_percent
  const historicalAvgRows = await db('quotation_lines as ql')
    .join('quotations as q', 'ql.quotation_id', 'q.id')
    .where('q.status', 'approved')
    .whereNull('q.deleted_at')
    .whereNull('ql.deleted_at')
    .whereNotNull('q.assigned_rep_id')
    .groupBy('q.assigned_rep_id')
    .having(db.raw('COUNT(DISTINCT q.id) >= ?', [minHistoricalQuotations]))
    .select(
      'q.assigned_rep_id as rep_id',
      db.raw('AVG(ql.discount_percent) AS avg_discount'),
      db.raw('STDDEV(ql.discount_percent) AS stddev_discount'),
      db.raw('COUNT(DISTINCT q.id) AS historical_count')
    );

  if (historicalAvgRows.length === 0) return [];

  const repStatsMap = new Map(
    historicalAvgRows.map((r) => [
      r.rep_id,
      {
        avg_discount: Number(r.avg_discount || 0),
        stddev_discount: Number(r.stddev_discount || 0),
        historical_count: Number(r.historical_count),
      },
    ])
  );

  const repIds = [...repStatsMap.keys()];

  // Step 2: Find active draft/pending_approval quotations for those reps
  const currentQuotationLines = await db('quotation_lines as ql')
    .join('quotations as q', 'ql.quotation_id', 'q.id')
    .join('customers as c', 'q.customer_id', 'c.id')
    .leftJoin('users as u', 'q.assigned_rep_id', 'u.id')
    .whereIn('q.assigned_rep_id', repIds)
    .whereIn('q.status', ['draft', 'pending_approval'])
    .whereNull('q.deleted_at')
    .whereNull('ql.deleted_at')
    .groupBy('q.id', 'q.quotation_number', 'q.assigned_rep_id', 'c.company_name', 'u.full_name', 'q.grand_total')
    .select(
      'q.id as quotation_id',
      'q.quotation_number',
      'q.assigned_rep_id as rep_id',
      'c.company_name as customer_name',
      'u.full_name as rep_name',
      'q.grand_total',
      db.raw('AVG(ql.discount_percent) AS current_avg_discount')
    );

  const alerts = [];

  for (const row of currentQuotationLines) {
    const stats = repStatsMap.get(row.rep_id);
    if (!stats) continue;

    const currentDiscount = Number(row.current_avg_discount || 0);
    const threshold = stats.avg_discount + anomalyStdDevMultiplier * (stats.stddev_discount || stats.avg_discount * 0.2);

    if (currentDiscount <= threshold) continue;

    // Check we haven't already raised an unacknowledged anomaly alert for this quotation
    const existingAlert = await db('deal_health_alerts')
      .where({
        quotation_id: row.quotation_id,
        alert_type: 'discount_anomaly',
        is_acknowledged: 0,
      })
      .whereNull('deleted_at')
      .first();

    if (existingAlert) continue;

    const deviation = currentDiscount - stats.avg_discount;

    alerts.push({
      quotation_id: row.quotation_id,
      alert_type: 'discount_anomaly',
      severity: deviation > stats.avg_discount * 0.5 ? 'critical' : 'high',
      title: `Discount Anomaly — Rep's discount is ${deviation.toFixed(1)}% above their average`,
      description:
        `Quotation ${row.quotation_number} for ${row.customer_name} has an average discount of ` +
        `${currentDiscount.toFixed(1)}%, which is ${deviation.toFixed(1)}% above ` +
        `${row.rep_name || 'the rep'}'s historical average of ${stats.avg_discount.toFixed(1)}% ` +
        `(based on ${stats.historical_count} approved quotations, threshold: ${threshold.toFixed(1)}%).`,
      metric_name: 'current_avg_discount_percent',
      metric_value: currentDiscount,
      threshold_value: threshold,
      metadata: JSON.stringify({
        quotation_number: row.quotation_number,
        rep_id: row.rep_id,
        rep_name: row.rep_name,
        customer_name: row.customer_name,
        current_avg_discount: currentDiscount,
        historical_avg_discount: stats.avg_discount,
        historical_stddev: stats.stddev_discount,
        historical_count: stats.historical_count,
        deviation,
        threshold,
        grand_total: row.grand_total,
      }),
    });
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// 3. DELIVERY SLIPPAGE DETECTION
//    Fulfillment estimated/requested date has passed without the split
//    being shipped or delivered.
// ---------------------------------------------------------------------------
export async function detectDeliverySlippage(db) {
  const now = new Date();

  const rows = await db('fulfillment_splits as fs')
    .join('quotation_lines as ql', 'fs.quotation_line_id', 'ql.id')
    .join('quotations as q', 'ql.quotation_id', 'q.id')
    .join('customers as c', 'q.customer_id', 'c.id')
    .leftJoin('users as u', 'q.assigned_rep_id', 'u.id')
    .leftJoin('warehouses as w', 'fs.warehouse_id', 'w.id')
    .whereIn('fs.status', ['pending', 'partial'])
    .whereNull('fs.deleted_at')
    .whereNull('ql.deleted_at')
    .whereNull('q.deleted_at')
    .whereNotNull('ql.requested_delivery_date')
    .where('ql.requested_delivery_date', '<', now)
    // Not already alerted
    .whereNotExists(function () {
      this.select('id')
        .from('deal_health_alerts')
        .whereRaw('deal_health_alerts.quotation_id = q.id')
        .where('deal_health_alerts.alert_type', 'delivery_slippage')
        .where('deal_health_alerts.is_acknowledged', 0)
        .whereNull('deal_health_alerts.deleted_at');
    })
    .select(
      'q.id as quotation_id',
      'q.quotation_number',
      'fs.id as fulfillment_split_id',
      'fs.status as fulfillment_status',
      'fs.quantity',
      'ql.requested_delivery_date',
      'c.company_name as customer_name',
      'u.full_name as rep_name',
      'w.name as warehouse_name',
      db.raw(`DATEDIFF(NOW(), ql.requested_delivery_date) AS days_overdue`)
    );

  return rows.map((row) => ({
    quotation_id: row.quotation_id,
    alert_type: 'delivery_slippage',
    severity: row.days_overdue > 7 ? 'critical' : row.days_overdue > 3 ? 'high' : 'medium',
    title: `Delivery Slippage — ${row.days_overdue} day(s) past requested delivery`,
    description:
      `Fulfillment for quotation ${row.quotation_number} (${row.customer_name}) ` +
      `was due on ${row.requested_delivery_date} but is still '${row.fulfillment_status}'. ` +
      `Warehouse: ${row.warehouse_name || 'Unknown'}. Qty: ${row.quantity}. ` +
      `Overdue by ${row.days_overdue} day(s). Rep: ${row.rep_name || 'Unassigned'}.`,
    metric_name: 'days_overdue',
    metric_value: row.days_overdue,
    threshold_value: 0,
    metadata: JSON.stringify({
      quotation_number: row.quotation_number,
      fulfillment_split_id: row.fulfillment_split_id,
      fulfillment_status: row.fulfillment_status,
      requested_delivery_date: row.requested_delivery_date,
      warehouse_name: row.warehouse_name,
      days_overdue: row.days_overdue,
      customer_name: row.customer_name,
    }),
  }));
}

export default {
  detectStalledDeals,
  detectDiscountAnomalies,
  detectDeliverySlippage,
};
