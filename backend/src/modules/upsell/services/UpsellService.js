import { rankUpsellSuggestions } from './upsellRanker.js';
import { recalculateQuotationTotals } from '../../quotations/services/recalculator.js';
import { NotFoundError } from '../../../errors/AppError.js';

/**
 * UpsellService
 *
 * Orchestrates data retrieval needed for suggestion ranking, then delegates
 * all ranking logic to the pure rankUpsellSuggestions function.
 *
 * This service is intentionally READ-ONLY — it never mutates state.
 * "Add to Quote" must be handled by the Quotation module's add-line endpoint.
 */
export class UpsellService {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }

  /**
   * Returns ranked upsell suggestions for a given quotation.
   *
   * @param {string} quotationId
   * @param {Object} options
   * @param {number} [options.minMarginPercent=0]  Filter: exclude suggestions below this margin %
   * @param {number} [options.limit=10]            Max suggestions to return
   * @returns {Promise<Object>} { quotation_id, suggestions[], meta }
   */
  async getSuggestionsForQuotation(quotationId, options = {}) {
    const { minMarginPercent = 0, limit = 10 } = options;

    // 1. Load quotation with full line detail and customer tier
    const quotation = await this.db('quotations as q')
      .join('customers as c', 'q.customer_id', 'c.id')
      .where({ 'q.id': quotationId, 'q.deleted_at': null })
      .select('q.*', 'c.tier as customer_tier')
      .first();

    if (!quotation) {
      throw new NotFoundError('Quotation');
    }

    const customerTier = quotation.customer_tier || 'Bronze';

    // 2. Load quotation lines with product cost data
    const quotationLines = await this.db('quotation_lines as ql')
      .leftJoin('products as p', 'ql.product_id', 'p.id')
      .leftJoin('product_variants as pv', 'ql.variant_id', 'pv.id')
      .where({ 'ql.quotation_id': quotationId, 'ql.deleted_at': null })
      .select(
        'ql.*',
        'p.cost_price as product_cost_price',
        'p.name as product_name',
        'p.category_id as product_category_id',
        'p.tax_rate as tax_rate'
      );

    // 3. Collect trigger keys: product IDs and category IDs from the current lines
    const productIds = [...new Set(quotationLines.map((l) => l.product_id).filter(Boolean))];
    const categoryIds = [...new Set(quotationLines.map((l) => l.product_category_id).filter(Boolean))];

    if (productIds.length === 0 && categoryIds.length === 0) {
      return {
        quotation_id: quotationId,
        suggestions: [],
        meta: { total_rules_evaluated: 0, customer_tier: customerTier, min_margin_percent: minMarginPercent },
      };
    }

    // 4. Load triggered upsell rules (with recommended products pre-joined)
    const upsellRules = await this._loadTriggeredRules(productIds, categoryIds);

    // 5. Load discount tiers and approval chains for margin delta simulation
    const [discountTiers, approvalChains] = await Promise.all([
      this.db('discount_tiers').where({ is_active: 1 }).whereNull('deleted_at'),
      this.db('approval_chains').where({ is_active: 1 }).whereNull('deleted_at'),
    ]);

    // 6. Compute current quotation totals (baseline for margin delta)
    const quotationTotals = recalculateQuotationTotals({
      quotation,
      lines: quotationLines.map((l) => ({ ...l, cost_price: l.product_cost_price })),
      discountTiers,
      customerTier,
      approvalChains,
    });

    // 7. Rank suggestions — pure function, no side effects
    const allSuggestions = rankUpsellSuggestions({
      quotationLines: quotationLines.map((l) => ({ ...l, cost_price: l.product_cost_price })),
      quotationTotals,
      upsellRules,
      minMarginPercent: Number(minMarginPercent),
      customerTier,
      discountTiers,
      approvalChains,
      quotation,
    });

    // 8. Apply limit
    const suggestions = allSuggestions.slice(0, Math.min(limit, 50));

    this.logger.debug(
      { quotationId, totalRules: upsellRules.length, returned: suggestions.length },
      'Upsell suggestions computed'
    );

    return {
      quotation_id: quotationId,
      customer_tier: customerTier,
      suggestions,
      meta: {
        total_rules_evaluated: upsellRules.length,
        total_qualified: allSuggestions.length,
        returned: suggestions.length,
        min_margin_percent: minMarginPercent,
        note: 'To add a suggestion to the quote, POST to /api/quotations/:id/lines using the add_to_quote_payload field.',
      },
    };
  }

  // ---------------------------------------------------------------------------
  // CRUD for upsell_rules (admin/ops management)
  // ---------------------------------------------------------------------------

  async listRules(filters = {}, options = {}) {
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
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async getRuleById(id) {
    const rule = await this.db('upsell_rules as ur')
      .leftJoin('products as rp', 'ur.recommended_product_id', 'rp.id')
      .leftJoin('product_variants as rv', 'ur.recommended_variant_id', 'rv.id')
      .where({ 'ur.id': id })
      .whereNull('ur.deleted_at')
      .select('ur.*', 'rp.name as recommended_product_name', 'rv.name as recommended_variant_name')
      .first();

    if (!rule) throw new NotFoundError('UpsellRule');
    return rule;
  }

  async createRule(data) {
    const payload = {
      ...data,
      is_active: data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
      priority: data.priority || 0,
      discount_percent: data.discount_percent || 0,
      condition_type: data.condition_type || 'always',
      condition_config: data.condition_config ? JSON.stringify(data.condition_config) : JSON.stringify({}),
      created_at: new Date(),
      updated_at: new Date(),
    };
    await this.db('upsell_rules').insert(payload);
    return payload;
  }

  async updateRule(id, data) {
    await this._ensureExists(id);
    const payload = {
      ...data,
      updated_at: new Date(),
    };
    if (data.condition_config) payload.condition_config = JSON.stringify(data.condition_config);
    if (data.is_active !== undefined) payload.is_active = data.is_active ? 1 : 0;
    await this.db('upsell_rules').where({ id }).whereNull('deleted_at').update(payload);
    return this.getRuleById(id);
  }

  async deleteRule(id) {
    await this._ensureExists(id);
    await this.db('upsell_rules').where({ id }).update({ deleted_at: new Date(), updated_at: new Date() });
    return { deleted: true, id };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  async _loadTriggeredRules(productIds, categoryIds) {
    const query = this.db('upsell_rules as ur')
      .join('products as rp', 'ur.recommended_product_id', 'rp.id')
      .leftJoin('product_variants as rv', 'ur.recommended_variant_id', 'rv.id')
      .where({ 'ur.is_active': 1 })
      .whereNull('ur.deleted_at')
      .where(function () {
        if (productIds.length > 0) this.whereIn('ur.trigger_product_id', productIds);
        if (categoryIds.length > 0) this.orWhereIn('ur.trigger_category_id', categoryIds);
      });

    const rows = await query.select(
      'ur.*',
      'rp.name as rp_name', 'rp.sku as rp_sku', 'rp.base_price as rp_base_price',
      'rp.cost_price as rp_cost_price', 'rp.is_active as rp_is_active',
      'rp.deleted_at as rp_deleted_at', 'rp.category_id as rp_category_id',
      'rp.description as rp_description', 'rp.tax_rate as rp_tax_rate',
      'rv.id as rv_id', 'rv.name as rv_name', 'rv.sku as rv_sku',
      'rv.price_adjustment as rv_price_adjustment', 'rv.is_active as rv_is_active',
      'rv.deleted_at as rv_deleted_at'
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      trigger_product_id: row.trigger_product_id,
      trigger_category_id: row.trigger_category_id,
      recommended_product_id: row.recommended_product_id,
      recommended_variant_id: row.recommended_variant_id,
      condition_type: row.condition_type,
      condition_config: row.condition_config
        ? (typeof row.condition_config === 'string' ? JSON.parse(row.condition_config) : row.condition_config)
        : {},
      discount_percent: Number(row.discount_percent),
      priority: Number(row.priority),
      is_active: Boolean(row.is_active),
      deleted_at: row.deleted_at,
      recommended_product: {
        id: row.recommended_product_id,
        name: row.rp_name, sku: row.rp_sku,
        base_price: Number(row.rp_base_price),
        cost_price: Number(row.rp_cost_price || 0),
        is_active: Boolean(row.rp_is_active),
        deleted_at: row.rp_deleted_at,
        category_id: row.rp_category_id,
        description: row.rp_description,
        tax_rate: Number(row.rp_tax_rate || 0),
      },
      recommended_variant: row.rv_id ? {
        id: row.rv_id, name: row.rv_name, sku: row.rv_sku,
        price_adjustment: Number(row.rv_price_adjustment || 0),
        is_active: Boolean(row.rv_is_active), deleted_at: row.rv_deleted_at,
      } : null,
    }));
  }

  async _ensureExists(id) {
    const rule = await this.db('upsell_rules').where({ id }).whereNull('deleted_at').first();
    if (!rule) throw new NotFoundError('UpsellRule');
    return rule;
  }
}

export default UpsellService;
