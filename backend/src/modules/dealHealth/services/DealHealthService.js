/**
 * DealHealthService
 *
 * Orchestrates the three detection functions, writes alerts to deal_health_alerts,
 * emits real-time Socket.IO events when new alerts fire, and invalidates the
 * Redis-cached dashboard summary.
 */
import { detectStalledDeals, detectDiscountAnomalies, detectDeliverySlippage } from './detectors.js';

const DASHBOARD_CACHE_KEY = 'dealhealth:dashboard:summary';
const DASHBOARD_CACHE_TTL_SECONDS = 120; // 2 minutes

export class DealHealthService {
  /**
   * @param {Object} db         - Knex database instance
   * @param {Object} logger     - Pino logger
   * @param {Object} cache      - Cache instance (RedisCache | InProcessCache)
   * @param {Object} [io]       - Socket.IO server instance (optional)
   * @param {Object} [config]   - Detection thresholds
   */
  constructor(db, logger, cache, io = null, config = {}) {
    this.db = db;
    this.logger = logger;
    this.cache = cache;
    this.io = io;
    this.config = {
      stalledDaysThreshold: config.stalledDaysThreshold || 7,
      anomalyStdDevMultiplier: config.anomalyStdDevMultiplier || 1.5,
      minHistoricalQuotations: config.minHistoricalQuotations || 3,
    };
  }

  // ---------------------------------------------------------------------------
  // Run all three detectors and persist new alerts
  // ---------------------------------------------------------------------------
  async runAllDetectors() {
    const results = { stalled: 0, anomaly: 0, slippage: 0, errors: [] };

    try {
      const stalledAlerts = await detectStalledDeals(this.db, {
        stalledDaysThreshold: this.config.stalledDaysThreshold,
      });
      results.stalled = await this._persistAlerts(stalledAlerts);
    } catch (err) {
      this.logger.error({ err: err.message }, 'Stalled deal detection failed');
      results.errors.push({ detector: 'stalled', error: err.message });
    }

    try {
      const anomalyAlerts = await detectDiscountAnomalies(this.db, {
        anomalyStdDevMultiplier: this.config.anomalyStdDevMultiplier,
        minHistoricalQuotations: this.config.minHistoricalQuotations,
      });
      results.anomaly = await this._persistAlerts(anomalyAlerts);
    } catch (err) {
      this.logger.error({ err: err.message }, 'Discount anomaly detection failed');
      results.errors.push({ detector: 'anomaly', error: err.message });
    }

    try {
      const slippageAlerts = await detectDeliverySlippage(this.db);
      results.slippage = await this._persistAlerts(slippageAlerts);
    } catch (err) {
      this.logger.error({ err: err.message }, 'Delivery slippage detection failed');
      results.errors.push({ detector: 'slippage', error: err.message });
    }

    const totalNew = results.stalled + results.anomaly + results.slippage;

    if (totalNew > 0) {
      // Invalidate dashboard cache so next read gets fresh data
      await this._invalidateDashboardCache();
    }

    this.logger.info(results, `Deal health scan complete — ${totalNew} new alert(s)`);
    return results;
  }

  // ---------------------------------------------------------------------------
  // Cached dashboard summary endpoint
  // ---------------------------------------------------------------------------
  async getDashboardSummary() {
    // Try cache first
    const cached = await this.cache.get(DASHBOARD_CACHE_KEY);
    if (cached) {
      return { ...cached, from_cache: true };
    }

    const summary = await this._computeDashboardSummary();

    // Persist to cache
    await this.cache.set(DASHBOARD_CACHE_KEY, summary, DASHBOARD_CACHE_TTL_SECONDS);

    return { ...summary, from_cache: false };
  }

  // ---------------------------------------------------------------------------
  // Alerts CRUD
  // ---------------------------------------------------------------------------
  async listAlerts(filters = {}, options = {}) {
    const { page = 1, limit = 20, orderBy = 'created_at', orderDir = 'desc' } = options;
    const offset = (page - 1) * limit;

    let query = this.db('deal_health_alerts as dha')
      .join('quotations as q', 'dha.quotation_id', 'q.id')
      .join('customers as c', 'q.customer_id', 'c.id')
      .whereNull('dha.deleted_at');

    if (filters.alert_type) query = query.where('dha.alert_type', filters.alert_type);
    if (filters.severity) query = query.where('dha.severity', filters.severity);
    if (filters.is_acknowledged !== undefined) query = query.where('dha.is_acknowledged', filters.is_acknowledged ? 1 : 0);
    if (filters.quotation_id) query = query.where('dha.quotation_id', filters.quotation_id);

    const [data, totalResult] = await Promise.all([
      query
        .clone()
        .select('dha.*', 'q.quotation_number', 'c.company_name as customer_name')
        .orderBy(`dha.${orderBy}`, orderDir)
        .limit(limit)
        .offset(offset),
      query.clone().count('dha.id as count').first(),
    ]);

    const total = Number(totalResult?.count || 0);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async acknowledgeAlert(alertId, userId) {
    const alert = await this.db('deal_health_alerts').where({ id: alertId }).whereNull('deleted_at').first();
    if (!alert) return null;

    await this.db('deal_health_alerts').where({ id: alertId }).update({
      is_acknowledged: 1,
      acknowledged_by: userId,
      acknowledged_at: new Date(),
    });

    await this._invalidateDashboardCache();

    const updated = await this.db('deal_health_alerts').where({ id: alertId }).first();
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  async _persistAlerts(alerts) {
    if (!alerts || alerts.length === 0) return 0;

    let inserted = 0;
    const now = new Date();

    for (const alert of alerts) {
      try {
        await this.db('deal_health_alerts').insert({
          ...alert,
          is_acknowledged: 0,
          created_at: now,
        });
        inserted++;

        // Emit real-time alert via Socket.IO
        this._emitAlertEvent(alert);
      } catch (err) {
        // Log but don't throw — we want other alerts to still persist
        this.logger.error(
          { err: err.message, alert_type: alert.alert_type, quotation_id: alert.quotation_id },
          'Failed to persist deal health alert'
        );
      }
    }

    return inserted;
  }

  _emitAlertEvent(alert) {
    if (!this.io) return;
    try {
      // Emit to a named room so only subscribed dashboard clients receive it
      this.io.to('deal-health').emit('deal_health_alert', {
        event: 'new_alert',
        alert_type: alert.alert_type,
        severity: alert.severity,
        title: alert.title,
        quotation_id: alert.quotation_id,
        timestamp: new Date().toISOString(),
      });
      this.logger.debug({ alert_type: alert.alert_type, quotation_id: alert.quotation_id }, 'Socket.IO alert emitted');
    } catch (err) {
      this.logger.warn({ err: err.message }, 'Failed to emit Socket.IO alert event');
    }
  }

  async _invalidateDashboardCache() {
    try {
      await this.cache.delPattern('dealhealth:dashboard:*');
      this.logger.debug('Dashboard summary cache invalidated');
    } catch (err) {
      this.logger.warn({ err: err.message }, 'Cache invalidation failed — next read will recompute');
    }
  }

  async _computeDashboardSummary() {
    const [
      totalUnacknowledged,
      bySeverity,
      byType,
      recentAlerts,
      atRiskQuotations,
    ] = await Promise.all([
      // Total unacknowledged alerts
      this.db('deal_health_alerts')
        .where({ is_acknowledged: 0 })
        .whereNull('deleted_at')
        .count('id as count')
        .first(),

      // Breakdown by severity
      this.db('deal_health_alerts')
        .where({ is_acknowledged: 0 })
        .whereNull('deleted_at')
        .groupBy('severity')
        .select('severity', this.db.raw('COUNT(*) as count')),

      // Breakdown by type
      this.db('deal_health_alerts')
        .where({ is_acknowledged: 0 })
        .whereNull('deleted_at')
        .groupBy('alert_type')
        .select('alert_type', this.db.raw('COUNT(*) as count')),

      // 5 most recent unacknowledged alerts
      this.db('deal_health_alerts as dha')
        .join('quotations as q', 'dha.quotation_id', 'q.id')
        .join('customers as c', 'q.customer_id', 'c.id')
        .where({ 'dha.is_acknowledged': 0 })
        .whereNull('dha.deleted_at')
        .orderBy('dha.created_at', 'desc')
        .limit(5)
        .select(
          'dha.id',
          'dha.alert_type',
          'dha.severity',
          'dha.title',
          'dha.created_at',
          'q.quotation_number',
          'c.company_name as customer_name'
        ),

      // Quotations with multiple unacknowledged alerts (high risk)
      this.db('deal_health_alerts')
        .where({ is_acknowledged: 0 })
        .whereNull('deleted_at')
        .groupBy('quotation_id')
        .having(this.db.raw('COUNT(*) >= 2'))
        .select('quotation_id', this.db.raw('COUNT(*) as alert_count'))
        .orderBy('alert_count', 'desc')
        .limit(10),
    ]);

    const severityMap = {};
    for (const row of bySeverity) severityMap[row.severity] = Number(row.count);

    const typeMap = {};
    for (const row of byType) typeMap[row.alert_type] = Number(row.count);

    return {
      summary: {
        total_unacknowledged: Number(totalUnacknowledged?.count || 0),
        by_severity: {
          critical: severityMap.critical || 0,
          high: severityMap.high || 0,
          medium: severityMap.medium || 0,
          low: severityMap.low || 0,
        },
        by_type: {
          stalled_deal: typeMap.stalled_deal || 0,
          discount_anomaly: typeMap.discount_anomaly || 0,
          delivery_slippage: typeMap.delivery_slippage || 0,
          negotiation_failed: typeMap.negotiation_failed || 0,
        },
      },
      recent_alerts: recentAlerts,
      at_risk_quotations: atRiskQuotations,
      computed_at: new Date().toISOString(),
      cache_ttl_seconds: DASHBOARD_CACHE_TTL_SECONDS,
    };
  }
}

export default DealHealthService;
