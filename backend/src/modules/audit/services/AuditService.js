/**
 * AuditService
 *
 * Read-side of the immutable audit_trails ledger. Every role-attributed
 * operation performed by any module (quotation line edits, approval decisions,
 * product/variant CRUD, discount policy changes, subscription cancellations,
 * fulfillment overrides…) is persisted there with changed_by / changed_by_role.
 * This service exposes those entries with filters + joins for human-readable
 * actor names so the frontend can reflect real operations, not mocks.
 */
export class AuditService {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger || { info: () => {}, warn: () => {}, error: () => {} };
  }

  async listAuditTrails(filters = {}, options = {}) {
    const { page = 1, limit = 20, orderBy = 'created_at', orderDir = 'desc' } = options;
    const offset = (page - 1) * limit;

    let query = this.db('audit_trails as at')
      .leftJoin('users as u', 'at.changed_by', 'u.id');

    if (filters.table_name) query = query.where('at.table_name', filters.table_name);
    if (filters.record_id) query = query.where('at.record_id', filters.record_id);
    if (filters.operation) query = query.where('at.operation', filters.operation);
    if (filters.changed_by) query = query.where('at.changed_by', filters.changed_by);
    if (filters.changed_by_role) query = query.where('at.changed_by_role', filters.changed_by_role);
    if (filters.start_date) query = query.where('at.created_at', '>=', new Date(filters.start_date));
    if (filters.end_date) query = query.where('at.created_at', '<=', new Date(filters.end_date));

    const [data, totalResult] = await Promise.all([
      query
        .clone()
        .orderBy(`at.${orderBy}`, orderDir)
        .limit(limit)
        .offset(offset)
        .select(
          'at.*',
          'u.full_name as actor_name',
          'u.email as actor_email'
        ),
      query.clone().count('at.id as count').first(),
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

export default AuditService;
