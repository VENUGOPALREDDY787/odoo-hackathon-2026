import BaseRepository from '../../utils/BaseRepository.js';

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

  async search(query, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const searchTerm = `%${query}%`;

    const data = await this.db('products')
      .where({ deleted_at: null })
      .where(function() {
        this.where('name', 'like', searchTerm)
          .orWhere('sku', 'like', searchTerm)
          .orWhere('description', 'like', searchTerm);
      })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .select('*');

    const [{ count: total }] = await this.db('products')
      .where({ deleted_at: null })
      .where(function() {
        this.where('name', 'like', searchTerm)
          .orWhere('sku', 'like', searchTerm)
          .orWhere('description', 'like', searchTerm);
      })
      .count('* as count');

    return {
      data,
      pagination: {
        page,
        limit,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limit),
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
}

export default ProductRepository;