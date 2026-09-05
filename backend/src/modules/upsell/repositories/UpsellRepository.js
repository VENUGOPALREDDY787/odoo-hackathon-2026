import BaseRepository from '../../../utils/BaseRepository.js';

/**
 * Repository for upsell_rules table.
 * Provides efficient queries for fetching active rules with their
 * recommended product/variant data pre-joined in a single round-trip.
 */
export class UpsellRuleRepository extends BaseRepository {
  constructor(db) {
    super(db, 'upsell_rules');
  }

  /**
   * Find active upsell rules triggered by a set of product IDs and/or category IDs.
   * Joins recommended product and variant data in a single query.
   *
   * @param {string[]} productIds      - Products present in the quotation
   * @param {string[]} categoryIds     - Categories of those products (for category-triggered rules)
   * @returns {Promise<Array>}
   */
  async findTriggeredRules(productIds = [], categoryIds = []) {
    if (productIds.length === 0 && categoryIds.length === 0) {
      return [];
    }

    const query = this.db('upsell_rules as ur')
      .join('products as rp', 'ur.recommended_product_id', 'rp.id')
      .leftJoin('product_variants as rv', 'ur.recommended_variant_id', 'rv.id')
      .where({ 'ur.is_active': 1 })
      .whereNull('ur.deleted_at')
      .where(function () {
        if (productIds.length > 0) {
          this.whereIn('ur.trigger_product_id', productIds);
        }
        if (categoryIds.length > 0) {
          this.orWhereIn('ur.trigger_category_id', categoryIds);
        }
      });

    const rows = await query.select(
      'ur.*',
      // Recommended product columns (prefixed to avoid collision)
      'rp.name as rp_name',
      'rp.sku as rp_sku',
      'rp.base_price as rp_base_price',
      'rp.cost_price as rp_cost_price',
      'rp.is_active as rp_is_active',
      'rp.deleted_at as rp_deleted_at',
      'rp.category_id as rp_category_id',
      'rp.description as rp_description',
      'rp.tax_rate as rp_tax_rate',
      // Recommended variant (nullable)
      'rv.id as rv_id',
      'rv.name as rv_name',
      'rv.sku as rv_sku',
      'rv.price_adjustment as rv_price_adjustment',
      'rv.is_active as rv_is_active',
      'rv.deleted_at as rv_deleted_at'
    );

    // Re-shape flat rows into nested objects matching upsellRanker's expected shape
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      trigger_product_id: row.trigger_product_id,
      trigger_category_id: row.trigger_category_id,
      recommended_product_id: row.recommended_product_id,
      recommended_variant_id: row.recommended_variant_id,
      condition_type: row.condition_type,
      condition_config: row.condition_config ? (typeof row.condition_config === 'string' ? JSON.parse(row.condition_config) : row.condition_config) : {},
      discount_percent: Number(row.discount_percent),
      priority: Number(row.priority),
      is_active: Boolean(row.is_active),
      deleted_at: row.deleted_at,
      recommended_product: {
        id: row.recommended_product_id,
        name: row.rp_name,
        sku: row.rp_sku,
        base_price: Number(row.rp_base_price),
        cost_price: Number(row.rp_cost_price || 0),
        is_active: Boolean(row.rp_is_active),
        deleted_at: row.rp_deleted_at,
        category_id: row.rp_category_id,
        description: row.rp_description,
        tax_rate: Number(row.rp_tax_rate || 0),
      },
      recommended_variant: row.rv_id
        ? {
            id: row.rv_id,
            name: row.rv_name,
            sku: row.rv_sku,
            price_adjustment: Number(row.rv_price_adjustment || 0),
            is_active: Boolean(row.rv_is_active),
            deleted_at: row.rv_deleted_at,
          }
        : null,
    }));
  }

  async findById(id) {
    return this.db('upsell_rules').where({ id, deleted_at: null }).first();
  }

  async listWithFilters(filters = {}, options = {}) {
    const { page = 1, limit = 20, orderBy = 'priority', orderDir = 'desc' } = options;
    const offset = (page - 1) * limit;

    let query = this.db('upsell_rules as ur')
      .leftJoin('products as rp', 'ur.recommended_product_id', 'rp.id')
      .whereNull('ur.deleted_at');

    if (filters.is_active !== undefined) query = query.where('ur.is_active', filters.is_active ? 1 : 0);
    if (filters.condition_type) query = query.where('ur.condition_type', filters.condition_type);
    if (filters.trigger_product_id) query = query.where('ur.trigger_product_id', filters.trigger_product_id);
    if (filters.trigger_category_id) query = query.where('ur.trigger_category_id', filters.trigger_category_id);

    const [data, totalResult] = await Promise.all([
      query
        .clone()
        .select('ur.*', 'rp.name as recommended_product_name', 'rp.sku as recommended_product_sku')
        .orderBy(`ur.${orderBy}`, orderDir)
        .limit(limit)
        .offset(offset),
      query.clone().count('ur.id as count').first(),
    ]);

    const total = Number(totalResult?.count || 0);
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  async create(data) {
    const [id] = await this.db('upsell_rules').insert({
      ...data,
      created_at: new Date(),
      updated_at: new Date(),
    });
    return this.findById(id || data.id);
  }

  async update(id, data) {
    await this.db('upsell_rules')
      .where({ id, deleted_at: null })
      .update({ ...data, updated_at: new Date() });
    return this.findById(id);
  }

  async softDelete(id) {
    await this.db('upsell_rules').where({ id }).update({ deleted_at: new Date(), updated_at: new Date() });
    return true;
  }
}

export default UpsellRuleRepository;
