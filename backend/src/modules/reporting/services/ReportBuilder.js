/**
 * ReportBuilder
 *
 * Encapsulates the complex Knex query building logic for reports.
 * Allows constructing list, aggregate, or stream queries from a single filter definition.
 */
export class ReportBuilder {
  /**
   * @param {Object} db - Knex instance
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * Base query that joins the necessary tables for sales reporting.
   * Filters are applied here.
   *
   * @param {Object} filters
   * @param {string} [filters.startDate] - YYYY-MM-DD
   * @param {string} [filters.endDate] - YYYY-MM-DD
   * @param {string} [filters.repId] - User UUID
   * @param {string} [filters.status] - Quotation status enum
   * @param {string} [filters.productId] - Product UUID
   * @param {string} [filters.categoryId] - Category UUID
   * @param {string} [filters.customerTier] - Customer tier enum
   * @returns {Object} Knex query builder
   */
  _buildBaseQuery(filters) {
    let query = this.db('quotations as q')
      .join('customers as c', 'q.customer_id', 'c.id')
      .leftJoin('users as u', 'q.assigned_rep_id', 'u.id')
      .whereNull('q.deleted_at')
      .whereNull('c.deleted_at');

    // Need to join quotation_lines and products if filtering by product/category
    const needsProductJoin = filters.productId || filters.categoryId;
    if (needsProductJoin) {
      query = query
        .join('quotation_lines as ql', 'q.id', 'ql.quotation_id')
        .join('products as p', 'ql.product_id', 'p.id')
        .whereNull('ql.deleted_at')
        .whereNull('p.deleted_at');
    }

    // Apply filters
    if (filters.startDate) {
      query = query.where('q.created_at', '>=', filters.startDate);
    }
    if (filters.endDate) {
      // Append time to include the entire end date (assuming date string YYYY-MM-DD)
      const endDateTime = `${filters.endDate} 23:59:59`;
      query = query.where('q.created_at', '<=', endDateTime);
    }
    if (filters.repId) {
      query = query.where('q.assigned_rep_id', filters.repId);
    }
    if (filters.status) {
      query = query.where('q.status', filters.status);
    }
    if (filters.customerTier) {
      query = query.where('c.tier', filters.customerTier);
    }
    if (filters.productId) {
      query = query.where('ql.product_id', filters.productId);
    }
    if (filters.categoryId) {
      query = query.where('p.category_id', filters.categoryId);
    }

    // If joining on lines for filtering, we need to ensure we don't get duplicate quotation rows
    // in list/aggregate queries if multiple lines match.
    // We group by quotation ID.
    if (needsProductJoin) {
      query = query.groupBy('q.id');
    }

    return query;
  }

  /**
   * Builds the query for a paginated list of results.
   *
   * @param {Object} filters - Search filters
   * @param {Object} pagination - { limit, offset, orderBy, orderDir }
   * @returns {Promise<{data: Array, total: number}>}
   */
  async buildListQuery(filters, { limit = 20, offset = 0, orderBy = 'created_at', orderDir = 'desc' }) {
    const baseQuery = this._buildBaseQuery(filters);

    const dataQuery = baseQuery.clone()
      .select(
        'q.id',
        'q.quotation_number',
        'q.status',
        'q.grand_total',
        'q.margin_percentage',
        'q.currency',
        'q.created_at',
        'q.valid_until',
        'c.company_name as customer_name',
        'c.tier as customer_tier',
        'u.full_name as rep_name'
      )
      .orderBy(`q.${orderBy}`, orderDir)
      .limit(limit)
      .offset(offset);

    // If grouping (because of product join), count distinct IDs
    const countQuery = this.db.countDistinct('q.id as total').from(this._buildBaseQuery(filters).as('subquery')).first();
    // Otherwise standard count (optimized)
    const fastCountQuery = this._buildBaseQuery(filters).count('q.id as total').first();

    const needsProductJoin = filters.productId || filters.categoryId;
    const actualCountQuery = needsProductJoin ? countQuery : fastCountQuery;

    const [data, totalResult] = await Promise.all([dataQuery, actualCountQuery]);
    
    return {
      data,
      total: Number(totalResult?.total || 0),
    };
  }

  /**
   * Builds the query for aggregate totals (run in SQL, not Node).
   *
   * @param {Object} filters - Search filters
   * @returns {Promise<Object>} Aggregate stats
   */
  async buildAggregateQuery(filters) {
    const baseQuery = this._buildBaseQuery(filters);
    
    // We want total sum, avg margin, etc.
    // If we joined on products, we need to be careful summing quotation-level fields
    // so they aren't multiplied by the number of matching lines.
    // A subquery approach is safest to get distinct quotation totals.
    
    const subquery = baseQuery.select(
      'q.id',
      'q.grand_total',
      'q.margin_percentage',
      'q.discount_total'
    );
    
    // If grouped by q.id (due to product join), this is already distinct per quotation.
    // If not grouped, it's just selecting the fields.

    const result = await this.db.from(subquery.as('sq'))
      .select(
        this.db.raw('COUNT(sq.id) as total_count'),
        this.db.raw('SUM(sq.grand_total) as total_value'),
        this.db.raw('AVG(sq.margin_percentage) as average_margin'),
        this.db.raw('AVG(sq.discount_total / (sq.grand_total + sq.discount_total) * 100) as average_discount_pct')
      )
      .first();

    return {
      total_count: Number(result.total_count || 0),
      total_value: Number(result.total_value || 0),
      average_margin: Number(result.average_margin || 0),
      average_discount_pct: Number(result.average_discount_pct || 0),
    };
  }

  /**
   * Returns a Knex query builder configured for streaming export.
   * Includes all relevant columns for an export.
   *
   * @param {Object} filters
   * @returns {Object} Knex stream query
   */
  buildStreamQuery(filters) {
    // For exports, we might not want to group if we joined on products, 
    // because we might want one row per matching line item.
    // But to keep it consistent with the list view (one row per quotation), 
    // we'll keep the base query behavior.
    
    return this._buildBaseQuery(filters)
      .select(
        'q.quotation_number as Quotation Number',
        'c.company_name as Customer Name',
        'c.tier as Customer Tier',
        'u.full_name as Sales Rep',
        'q.status as Status',
        'q.currency as Currency',
        'q.grand_total as Grand Total',
        'q.discount_total as Discount Total',
        'q.margin_percentage as Margin %',
        'q.created_at as Created Date',
        'q.valid_until as Expiry Date'
      )
      .orderBy('q.created_at', 'desc')
      .stream();
  }
}
