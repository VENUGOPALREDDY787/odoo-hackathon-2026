import { ValidationError, NotFoundError, ConflictError } from '../../errors/AppError.js';

export class ProductService {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }

  async createProduct(data) {
    const existing = await this.db('products').where({ sku: data.sku, deleted_at: null }).first();
    if (existing) {
      throw new ConflictError('Product with this SKU already exists', { sku: data.sku });
    }

    const [product] = await this.db('products')
      .insert({
        ...data,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    this.logger.info({ productId: product.id, sku: product.sku }, 'Product created');
    return product;
  }

  async getProduct(id) {
    const product = await this.db('products')
      .where({ id, deleted_at: null })
      .first();

    if (!product) {
      throw new NotFoundError('Product');
    }

    return product;
  }

  async updateProduct(id, data) {
    const product = await this.getProduct(id);

    if (data.sku && data.sku !== product.sku) {
      const existing = await this.db('products').where({ sku: data.sku, deleted_at: null }).first();
      if (existing) {
        throw new ConflictError('Product with this SKU already exists', { sku: data.sku });
      }
    }

    const [updated] = await this.db('products')
      .where({ id, deleted_at: null })
      .update({ ...data, updated_at: new Date() })
      .returning('*');

    this.logger.info({ productId: id }, 'Product updated');
    return updated;
  }

  async deleteProduct(id) {
    await this.getProduct(id);

    await this.db('products')
      .where({ id, deleted_at: null })
      .update({ deleted_at: new Date(), updated_at: new Date() });

    this.logger.info({ productId: id }, 'Product soft deleted');
    return { success: true };
  }

  async listProducts(filters = {}, options = {}) {
    const { page = 1, limit = 20, orderBy = 'created_at', orderDir = 'desc' } = options;
    const offset = (page - 1) * limit;

    let query = this.db('products').where({ deleted_at: null });

    if (filters.category_id) query = query.where('category_id', filters.category_id);
    if (filters.is_active !== undefined) query = query.where('is_active', filters.is_active);
    if (filters.search) {
      const term = `%${filters.search}%`;
      query = query.where(function() {
        this.where('name', 'like', term).orWhere('sku', 'like', term);
      });
    }

    const [data, [{ count: total }]] = await Promise.all([
      query.clone().orderBy(orderBy, orderDir).limit(limit).offset(offset).select('*'),
      query.clone().count('* as count'),
    ]);

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

  async getVariants(productId) {
    return this.db('product_variants')
      .where({ product_id: productId, deleted_at: null })
      .select('*');
  }

  async createVariant(productId, data) {
    await this.getProduct(productId);

    const existing = await this.db('product_variants').where({ sku: data.sku, deleted_at: null }).first();
    if (existing) {
      throw new ConflictError('Variant with this SKU already exists', { sku: data.sku });
    }

    const [variant] = await this.db('product_variants')
      .insert({
        ...data,
        product_id: productId,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    this.logger.info({ variantId: variant.id, productId }, 'Product variant created');
    return variant;
  }

  async updateVariant(variantId, data) {
    const variant = await this.db('product_variants')
      .where({ id: variantId, deleted_at: null })
      .first();

    if (!variant) {
      throw new NotFoundError('Product variant');
    }

    if (data.sku && data.sku !== variant.sku) {
      const existing = await this.db('product_variants').where({ sku: data.sku, deleted_at: null }).first();
      if (existing) {
        throw new ConflictError('Variant with this SKU already exists', { sku: data.sku });
      }
    }

    const [updated] = await this.db('product_variants')
      .where({ id: variantId, deleted_at: null })
      .update({ ...data, updated_at: new Date() })
      .returning('*');

    return updated;
  }
}

export default ProductService;