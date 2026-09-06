import BaseRepository from '../../../utils/BaseRepository.js';

export class DiscountTierRepository extends BaseRepository {
  constructor(db) {
    super(db, 'discount_tiers');
  }

  async findActiveTiers(customerTier = null, date = new Date()) {
    let query = this.db('discount_tiers')
      .where({ deleted_at: null, is_active: true })
      .where('effective_from', '<=', date)
      .where(function() {
        this.whereNull('effective_to').orWhere('effective_to', '>=', date);
      });

    if (customerTier) {
      query = query.where(function() {
        this.where('customer_tier', customerTier).orWhereNull('customer_tier');
      });
    }

    return query.orderBy('priority', 'desc');
  }

  async listWithFilters(filters = {}, options = {}) {
    const { page = 1, limit = 20, orderBy = 'priority', orderDir = 'desc' } = options;
    const offset = (page - 1) * limit;

    let query = this.db('discount_tiers as dt')
      .leftJoin('product_categories as pc', 'dt.category_id', 'pc.id')
      .where({ 'dt.deleted_at': null });

    if (filters.customer_tier) query = query.where('dt.customer_tier', filters.customer_tier);
    if (filters.category_id) query = query.where('dt.category_id', filters.category_id);
    if (filters.product_id) query = query.where('dt.product_id', filters.product_id);
    if (filters.is_active !== undefined) query = query.where('dt.is_active', filters.is_active);

    const [data, totalResult] = await Promise.all([
      query
        .clone()
        .orderBy(`dt.${orderBy}`, orderDir)
        .limit(limit)
        .offset(offset)
        .select('dt.*', 'pc.name as category_name', 'pc.id as category_id'),
      query.clone().count('dt.id as count').first(),
    ]);

    const total = Number(totalResult?.count || 0);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }
}

export class ApprovalChainRepository extends BaseRepository {
  constructor(db) {
    super(db, 'approval_chains');
  }

  async findActiveChains() {
    return this.db('approval_chains')
      .where({ deleted_at: null, is_active: true })
      .orderBy('min_discount_percent', 'asc');
  }

  async listWithFilters(filters = {}, options = {}) {
    const { page = 1, limit = 20, orderBy = 'min_discount_percent', orderDir = 'asc' } = options;
    const offset = (page - 1) * limit;

    let query = this.db('approval_chains').where({ deleted_at: null });

    if (filters.is_active !== undefined) query = query.where('is_active', filters.is_active);

    const [data, totalResult] = await Promise.all([
      query.clone().orderBy(orderBy, orderDir).limit(limit).offset(offset).select('*'),
      query.clone().count('* as count').first(),
    ]);

    const total = Number(totalResult?.count || 0);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }
}

export class ApprovalLogRepository extends BaseRepository {
  constructor(db) {
    super(db, 'approval_logs');
  }

  async findByQuotation(quotationId) {
    return this.db('approval_logs')
      .where({ quotation_id: quotationId, deleted_at: null })
      .orderBy('created_at', 'desc');
  }
}

export class AuditTrailRepository extends BaseRepository {
  constructor(db) {
    super(db, 'audit_trails');
  }

  /**
   * Appends an immutable audit trail entry.
   */
  async logChange({
    tableName,
    recordId,
    operation,
    changedBy = null,
    changedByRole = null,
    oldValues = null,
    newValues = null,
    changedFields = null,
    ipAddress = null,
    userAgent = null,
    requestId = null,
  }) {
    const payload = {
      table_name: tableName,
      record_id: recordId,
      operation,
      changed_by: changedBy,
      changed_by_role: changedByRole,
      old_values: oldValues ? JSON.stringify(oldValues) : null,
      new_values: newValues ? JSON.stringify(newValues) : null,
      changed_fields: changedFields ? JSON.stringify(changedFields) : null,
      ip_address: ipAddress,
      user_agent: userAgent,
      request_id: requestId,
      created_at: new Date(),
    };

    const [id] = await this.db('audit_trails').insert(payload).returning('id');
    return id;
  }
}

export class DealHealthAlertRepository extends BaseRepository {
  constructor(db) {
    super(db, 'deal_health_alerts');
  }

  async countReturnedForRevision(quotationId, trx = null) {
    const db = trx || this.db;
    const result = await db('approval_logs')
      .where({ quotation_id: quotationId, deleted_at: null })
      .whereIn('action', ['returned', 'return_for_revision'])
      .count('id as count')
      .first();

    return Number(result?.count || 0);
  }

  async createAlert({
    quotationId,
    alertType,
    severity = 'high',
    title,
    description,
    metricName = null,
    metricValue = null,
    thresholdValue = null,
    metadata = {},
  }, trx = null) {
    const db = trx || this.db;
    const payload = {
      quotation_id: quotationId,
      alert_type: alertType,
      severity,
      title,
      description,
      metric_name: metricName,
      metric_value: metricValue,
      threshold_value: thresholdValue,
      metadata: JSON.stringify(metadata),
      is_acknowledged: false,
      created_at: new Date(),
    };

    const [id] = await db('deal_health_alerts').insert(payload).returning('id');
    return id;
  }
}

export default {
  DiscountTierRepository,
  ApprovalChainRepository,
  ApprovalLogRepository,
  AuditTrailRepository,
  DealHealthAlertRepository,
};
