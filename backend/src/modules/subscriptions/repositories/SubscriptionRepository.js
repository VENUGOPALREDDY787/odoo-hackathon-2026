import BaseRepository from '../../../utils/BaseRepository.js';

export class SubscriptionPlanRepository extends BaseRepository {
  constructor(db) {
    super(db, 'subscription_plans');
  }

  async listWithFilters(filters = {}, options = {}) {
    const { page = 1, limit = 20, orderBy = 'created_at', orderDir = 'desc' } = options;
    const offset = (page - 1) * limit;

    let query = this.db('subscription_plans').where({ deleted_at: null });

    if (filters.interval_type) query = query.where('interval_type', filters.interval_type);
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

export class BillingScheduleRepository extends BaseRepository {
  constructor(db) {
    super(db, 'billing_schedules');
  }

  async findByQuotationLine(quotationLineId, trx = null) {
    const db = trx || this.db;
    return db('billing_schedules')
      .where({ quotation_line_id: quotationLineId, deleted_at: null })
      .orderBy('cycle_number', 'asc')
      .orderBy('period_start', 'asc');
  }

  async findActiveCycle(quotationLineId, targetDate, trx = null) {
    const db = trx || this.db;
    const dateStr = targetDate instanceof Date ? targetDate.toISOString().split('T')[0] : targetDate;
    return db('billing_schedules')
      .where({ quotation_line_id: quotationLineId, deleted_at: null })
      .where('period_start', '<=', dateStr)
      .where('period_end', '>=', dateStr)
      .first();
  }

  async findFutureCycles(quotationLineId, targetDate, trx = null) {
    const db = trx || this.db;
    const dateStr = targetDate instanceof Date ? targetDate.toISOString().split('T')[0] : targetDate;
    return db('billing_schedules')
      .where({ quotation_line_id: quotationLineId, deleted_at: null })
      .where('period_start', '>', dateStr);
  }

  async createSchedules(schedulesArray, trx = null) {
    const db = trx || this.db;
    return db('billing_schedules').insert(schedulesArray);
  }

  async cancelFutureCycles(quotationLineId, targetDate, trx = null) {
    const db = trx || this.db;
    const dateStr = targetDate instanceof Date ? targetDate.toISOString().split('T')[0] : targetDate;
    return db('billing_schedules')
      .where({ quotation_line_id: quotationLineId, deleted_at: null })
      .where('period_start', '>', dateStr)
      .whereIn('status', ['pending'])
      .update({
        status: 'cancelled',
        updated_at: new Date(),
      });
  }
}

export default {
  SubscriptionPlanRepository,
  BillingScheduleRepository,
};
