import BaseRepository from '../../../utils/BaseRepository.js';
import { NotFoundError, ConflictError } from '../../../errors/AppError.js';

export class QuotationRepository extends BaseRepository {
  constructor(db) {
    super(db, 'quotations');
  }

  async findById(id, columns = '*', trx = null) {
    const db = trx || this.db;
    return db('quotations')
      .where({ id, deleted_at: null })
      .select(columns)
      .first();
  }

  async findWithDetails(id, trx = null) {
    const db = trx || this.db;
    const quotation = await db('quotations as q')
      .join('customers as c', 'q.customer_id', 'c.id')
      .leftJoin('users as u', 'q.assigned_rep_id', 'u.id')
      .where({ 'q.id': id, 'q.deleted_at': null })
      .select(
        'q.*',
        'c.company_name as customer_name',
        'c.tier as customer_tier',
        'u.full_name as rep_name',
        'u.email as rep_email'
      )
      .first();

    if (!quotation) return null;

    const lines = await db('quotation_lines as ql')
      .leftJoin('products as p', 'ql.product_id', 'p.id')
      .leftJoin('product_variants as pv', 'ql.variant_id', 'pv.id')
      .where({ 'ql.quotation_id': id, 'ql.deleted_at': null })
      .select(
        'ql.*',
        'p.name as product_name',
        'p.sku as product_sku',
        'p.cost_price as product_cost_price',
        'pv.sku as variant_sku',
        'pv.name as variant_name',
        'pv.cost_adjustment'
      )
      .orderBy('ql.sort_order', 'asc')
      .orderBy('ql.line_number', 'asc');

    const approvalLogs = await db('approval_logs as al')
      .leftJoin('users as u', 'al.approver_id', 'u.id')
      .where({ 'al.quotation_id': id, 'al.deleted_at': null })
      .select('al.*', 'u.full_name as approver_name')
      .orderBy('al.created_at', 'desc');

    return {
      ...quotation,
      lines,
      approval_logs: approvalLogs,
    };
  }

  /**
   * Optimistic locking update enforcing version column equality.
   * Increments version on success, throws ConflictError (409) on concurrent update mismatch.
   */
  async updateWithVersion(id, expectedVersion, data, trx = null) {
    const db = trx || this.db;
    let query = db('quotations').where({ id, deleted_at: null });

    if (expectedVersion !== undefined && expectedVersion !== null) {
      query = query.where('version', expectedVersion);
    }

    const updatedCount = await query.update({
      ...data,
      version: db.raw('version + 1'),
      updated_at: new Date(),
    });

    if (updatedCount === 0) {
      const existing = await db('quotations').where({ id, deleted_at: null }).first();
      if (!existing) {
        throw new NotFoundError('Quotation');
      }
      throw new ConflictError(
        `Quotation has been modified by another user or session. Current version is ${existing.version}, expected ${expectedVersion}. Please reload and try again.`,
        { currentVersion: existing.version, expectedVersion }
      );
    }

    return this.findById(id, '*', trx);
  }

  async listWithFilters(filters = {}, options = {}) {
    const { page = 1, limit = 20, orderBy = 'created_at', orderDir = 'desc' } = options;
    const offset = (page - 1) * limit;

    let query = this.db('quotations as q')
      .join('customers as c', 'q.customer_id', 'c.id')
      .leftJoin('users as u', 'q.assigned_rep_id', 'u.id')
      .where({ 'q.deleted_at': null });

    if (filters.customer_id) query = query.where('q.customer_id', filters.customer_id);
    if (Array.isArray(filters.customer_ids) && filters.customer_ids.length) {
      query = query.whereIn('q.customer_id', filters.customer_ids);
    }
    if (filters.assigned_rep_id) query = query.where('q.assigned_rep_id', filters.assigned_rep_id);
    if (filters.status) query = query.where('q.status', filters.status);

    const [data, totalResult] = await Promise.all([
      query
        .clone()
        .select(
          'q.*',
          'c.company_name as customer_name',
          'c.tier as customer_tier',
          'u.full_name as rep_name',
          this.db.raw('(SELECT COUNT(*) FROM quotation_lines ql WHERE ql.quotation_id = q.id AND ql.deleted_at IS NULL) as line_count'),
          this.db.raw('(SELECT al.action FROM approval_logs al WHERE al.quotation_id = q.id AND al.deleted_at IS NULL ORDER BY al.created_at DESC LIMIT 1) as last_approval_action')
        )
        .orderBy(`q.${orderBy}`, orderDir)
        .limit(limit)
        .offset(offset),
      query.clone().count('q.id as count').first(),
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

  async generateNextQuotationNumber(trx = null) {
    const db = trx || this.db;
    const year = new Date().getFullYear();
    const countResult = await db('quotations')
      .whereRaw('YEAR(created_at) = ?', [year])
      .count('id as count')
      .first();

    const count = Number(countResult?.count || 0) + 1;
    return `QT-${year}-${String(count).padStart(5, '0')}`;
  }
}

export class QuotationLineRepository extends BaseRepository {
  constructor(db) {
    super(db, 'quotation_lines');
  }

  async findByQuotation(quotationId, trx = null) {
    const db = trx || this.db;
    return db('quotation_lines')
      .where({ quotation_id: quotationId, deleted_at: null })
      .orderBy('line_number', 'asc');
  }

  async getNextLineNumber(quotationId, trx = null) {
    const db = trx || this.db;
    const result = await db('quotation_lines')
      .where({ quotation_id: quotationId, deleted_at: null })
      .max('line_number as max_line')
      .first();

    return Number(result?.max_line || 0) + 1;
  }
}

export class IdempotencyKeyRepository extends BaseRepository {
  constructor(db) {
    super(db, 'idempotency_keys');
  }

  async findKey(key, requestPath) {
    return this.db('idempotency_keys')
      .where({ key, request_path: requestPath })
      .where('expires_at', '>', new Date())
      .first();
  }

  async saveKey(key, requestPath, responseCode, responseBody, ttlHours = 24) {
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    const payload = {
      key,
      request_path: requestPath,
      response_code: responseCode,
      response_body: typeof responseBody === 'object' ? JSON.stringify(responseBody) : responseBody,
      expires_at: expiresAt,
      created_at: new Date(),
    };

    const [id] = await this.db('idempotency_keys').insert(payload).returning('id');
    return id;
  }
}

export default {
  QuotationRepository,
  QuotationLineRepository,
  IdempotencyKeyRepository,
};
