import BaseRepository from '../../../utils/BaseRepository.js';

export class ProductRepository extends BaseRepository {
  constructor(db) {
    super(db, 'products');
  }

  async findBySku(sku) {
    return this.db('products').where({ sku, deleted_at: null }).first();
  }

  async findByCategory(categoryId, options = {}) {
    return this.findAll({ category_id: categoryId }, options);
  }

  async findActive(options = {}) {
    return this.findAll({ is_active: true }, options);
  }

  async listWithFilters(filters = {}, options = {}) {
    const { page = 1, limit = 20, orderBy = 'created_at', orderDir = 'desc' } = options;
    const offset = (page - 1) * limit;

    // Joined so every row carries its category name — the catalog UI and the
    // edit form both need the human-readable category, not just category_id.
    let query = this.db('products as p')
      .leftJoin('product_categories as pc', 'p.category_id', 'pc.id')
      .where({ 'p.deleted_at': null });

    if (filters.category_id) query = query.where('p.category_id', filters.category_id);
    if (filters.is_active !== undefined) query = query.where('p.is_active', filters.is_active);
    if (filters.search) {
      const term = `%${filters.search}%`;
      query = query.where(function() {
        this.where('p.name', 'like', term).orWhere('p.sku', 'like', term).orWhere('p.description', 'like', term);
      });
    }
    if (filters.min_price !== undefined) query = query.where('p.base_price', '>=', filters.min_price);
    if (filters.max_price !== undefined) query = query.where('p.base_price', '<=', filters.max_price);

    const [data, totalResult] = await Promise.all([
      query.clone().orderBy(`p.${orderBy}`, orderDir).limit(limit).offset(offset).select('p.*', 'pc.name as category_name'),
      query.clone().count('p.id as count').first(),
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

  async getWithVariantCount() {
    return this.db('products as p')
      .leftJoin('product_variants as pv', function() {
        this.on('p.id', '=', 'pv.product_id').andOn('pv.deleted_at', '=', this.db.raw('NULL'));
      })
      .where({ 'p.deleted_at': null })
      .select('p.*')
      .count('pv.id as variant_count')
      .groupBy('p.id');
  }

  async getWithPriceLists(productId) {
    const product = await this.findById(productId);
    if (!product) return null;

    const priceLists = await this.db('price_list_items as pli')
      .join('price_lists as pl', 'pli.price_list_id', 'pl.id')
      .where({ 'pli.product_id': productId, 'pli.deleted_at': null, 'pl.deleted_at': null })
      .select(
        'pli.*',
        'pl.name as price_list_name',
        'pl.currency',
        'pl.is_default',
        'pl.effective_from',
        'pl.effective_to'
      )
      .orderBy('pl.is_default', 'desc');

    return { ...product, price_lists: priceLists };
  }

  async hasQuotationLines(productId) {
    const result = await this.db('quotation_lines')
      .where({ product_id: productId, deleted_at: null })
      .select('id')
      .first();
    return !!result;
  }
}

export class ProductVariantRepository extends BaseRepository {
  constructor(db) {
    super(db, 'product_variants');
  }

  async findByProduct(productId, options = {}) {
    return this.findAll({ product_id: productId }, options);
  }

  async findBySku(sku) {
    return this.db('product_variants').where({ sku, deleted_at: null }).first();
  }

  async findActive(options = {}) {
    return this.findAll({ is_active: true }, options);
  }
}

export class PriceListRepository extends BaseRepository {
  constructor(db) {
    super(db, 'price_lists');
  }

  async findDefault() {
    return this.db('price_lists').where({ is_default: true, deleted_at: null }).first();
  }

  async findActive(options = {}) {
    return this.findAll({ is_active: true, deleted_at: null }, options);
  }

  async listWithFilters(filters = {}, options = {}) {
    const { page = 1, limit = 20, orderBy = 'created_at', orderDir = 'desc' } = options;
    const offset = (page - 1) * limit;

    let query = this.db('price_lists').where({ deleted_at: null });

    if (filters.is_default !== undefined) query = query.where('is_default', filters.is_default);
    if (filters.currency) query = query.where('currency', filters.currency);
    if (filters.active_only) {
      const now = new Date();
      query = query.where('effective_from', '<=', now).where(function() {
        this.whereNull('effective_to').orWhere('effective_to', '>=', now);
      });
    }

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

export class PriceListItemRepository extends BaseRepository {
  constructor(db) {
    super(db, 'price_list_items');
  }

  async findByPriceList(priceListId, options = {}) {
    return this.findAll({ price_list_id: priceListId }, options);
  }

  async findForProduct(productId, variantId = null, customerTier = null, currency = null, date = new Date()) {
    let query = this.db('price_list_items as pli')
      .join('price_lists as pl', 'pli.price_list_id', 'pl.id')
      .where({ 'pli.product_id': productId, 'pli.deleted_at': null, 'pl.deleted_at': null })
      .where('pl.effective_from', '<=', date)
      .where(function() {
        this.whereNull('pl.effective_to').orWhere('pl.effective_to', '>=', date);
      });

    if (variantId) {
      query = query.where(function() {
        this.where('pli.variant_id', variantId).orWhereNull('pli.variant_id');
      });
    } else {
      query = query.whereNull('pli.variant_id');
    }

    if (customerTier) {
      query = query.where(function() {
        this.where('pli.customer_tier', customerTier).orWhereNull('pli.customer_tier');
      });
    }

    if (currency) {
      query = query.where('pl.currency', currency);
    }

    return query
      .select('pli.*', 'pl.currency', 'pl.name as price_list_name', 'pl.is_default')
      .orderBy('pl.is_default', 'desc')
      .orderBy('pli.min_quantity', 'desc');
  }
}

export default {
  ProductRepository,
  ProductVariantRepository,
  PriceListRepository,
  PriceListItemRepository,
};