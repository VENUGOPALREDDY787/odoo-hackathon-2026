import { ValidationError, NotFoundError, ConflictError } from '../../../errors/AppError.js';

const PRODUCT_FIELDS = [
  'sku', 'name', 'description', 'base_price', 'cost_price', 'unit_of_measure',
  'weight_kg', 'dimensions_cm', 'is_active', 'is_recurring_eligible', 'metadata',
];
const VARIANT_FIELDS = [
  'sku', 'name', 'attributes', 'price_adjustment', 'cost_adjustment', 'weight_kg', 'is_active',
];

export class ProductService {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }

  async createProduct(data) {
    const productData = await this.normalizeProduct(data);
    const existing = await this.db('products').where({ sku: productData.sku, deleted_at: null }).first();
    if (existing) {throw new ConflictError('Product with this SKU already exists', { sku: productData.sku });}

    await this.db('products').insert({ ...productData, created_at: new Date(), updated_at: new Date() });
    const product = await this.getProductBySku(productData.sku);
    this.logger.info({ productId: product.id, sku: product.sku }, 'Product created');
    return product;
  }

  async getProduct(id) {
    const product = await this.db('products as p')
      .leftJoin('product_categories as c', 'c.id', 'p.category_id')
      .where({ 'p.id': id, 'p.deleted_at': null })
      .select('p.*', 'c.name as category_name')
      .first();

    if (!product) {throw new NotFoundError('Product');}
    return product;
  }

  async updateProduct(id, data) {
    const product = await this.getProduct(id);
    const productData = await this.normalizeProduct(data, { partial: true });

    if (productData.sku && productData.sku !== product.sku) {
      const existing = await this.db('products').where({ sku: productData.sku, deleted_at: null }).first();
      if (existing) {throw new ConflictError('Product with this SKU already exists', { sku: productData.sku });}
    }

    if (Object.keys(productData).length === 0) {throw new ValidationError('No valid product fields to update');}
    await this.db('products').where({ id, deleted_at: null }).update({ ...productData, updated_at: new Date() });
    this.logger.info({ productId: id }, 'Product updated');
    return this.getProduct(id);
  }

  async deleteProduct(id) {
    await this.getProduct(id);
    await this.db('products').where({ id, deleted_at: null }).update({ deleted_at: new Date(), updated_at: new Date() });
    this.logger.info({ productId: id }, 'Product soft deleted');
    return { success: true };
  }

  async listProducts(filters = {}, options = {}) {
    const page = Math.max(Number(options.page) || 1, 1);
    const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
    const orderBy = ['created_at', 'name', 'base_price', 'sku'].includes(options.orderBy) ? options.orderBy : 'created_at';
    const orderDir = options.orderDir === 'asc' ? 'asc' : 'desc';
    const applyFilters = (query) => {
      query.where({ 'p.deleted_at': null });
      if (filters.category_id) {query.where('p.category_id', filters.category_id);}
      if (filters.is_active !== undefined) {query.where('p.is_active', filters.is_active);}
      if (filters.search) {
        const term = `%${filters.search}%`;
        query.where((builder) => builder.where('p.name', 'like', term).orWhere('p.sku', 'like', term));
      }
      return query;
    };

    const dataQuery = applyFilters(this.db('products as p').leftJoin('product_categories as c', 'c.id', 'p.category_id'))
      .select('p.*', 'c.name as category_name')
      .orderBy(`p.${orderBy}`, orderDir)
      .limit(limit)
      .offset((page - 1) * limit);
    const countQuery = applyFilters(this.db('products as p')).count('p.id as count');
    const [data, [{ count: total }]] = await Promise.all([dataQuery, countQuery]);

    return { data, pagination: { page, limit, total: Number(total), totalPages: Math.ceil(Number(total) / limit) } };
  }

  async getVariants(productId) {
    await this.getProduct(productId);
    return this.db('product_variants').where({ product_id: productId, deleted_at: null }).select('*');
  }

  async createVariant(productId, data) {
    await this.getProduct(productId);
    const variantData = this.normalizeVariant(data);
    const existing = await this.db('product_variants').where({ sku: variantData.sku, deleted_at: null }).first();
    if (existing) {throw new ConflictError('Product variant with this SKU already exists', { sku: variantData.sku });}

    await this.db('product_variants').insert({ ...variantData, product_id: productId, created_at: new Date(), updated_at: new Date() });
    return this.db('product_variants').where({ sku: variantData.sku, deleted_at: null }).first();
  }

  async updateVariant(productId, variantId, data) {
    await this.getProduct(productId);
    const variant = await this.db('product_variants').where({ id: variantId, product_id: productId, deleted_at: null }).first();
    if (!variant) {throw new NotFoundError('Product variant');}
    const variantData = this.normalizeVariant(data, { partial: true });

    if (variantData.sku && variantData.sku !== variant.sku) {
      const existing = await this.db('product_variants').where({ sku: variantData.sku, deleted_at: null }).first();
      if (existing) {throw new ConflictError('Product variant with this SKU already exists', { sku: variantData.sku });}
    }
    if (Object.keys(variantData).length === 0) {throw new ValidationError('No valid variant fields to update');}
    await this.db('product_variants').where({ id: variantId, product_id: productId, deleted_at: null }).update({ ...variantData, updated_at: new Date() });
    return this.db('product_variants').where({ id: variantId, product_id: productId, deleted_at: null }).first();
  }

  async deleteVariant(productId, variantId) {
    await this.getProduct(productId);
    const variant = await this.db('product_variants').where({ id: variantId, product_id: productId, deleted_at: null }).first();
    if (!variant) {throw new NotFoundError('Product variant');}
    await this.db('product_variants').where({ id: variantId, product_id: productId }).update({ deleted_at: new Date(), updated_at: new Date() });
    return { success: true };
  }

  async getProductBySku(sku) {
    return this.db('products as p')
      .leftJoin('product_categories as c', 'c.id', 'p.category_id')
      .where({ 'p.sku': sku, 'p.deleted_at': null })
      .select('p.*', 'c.name as category_name')
      .first();
  }

  async normalizeProduct(data, { partial = false } = {}) {
    const fields = Object.fromEntries(PRODUCT_FIELDS.filter((field) => data[field] !== undefined).map((field) => [field, data[field]]));
    if (!partial && (!fields.sku || !fields.name || fields.base_price === undefined)) {
      throw new ValidationError('SKU, name, and base price are required');
    }
    if (fields.base_price !== undefined && Number(fields.base_price) < 0) {throw new ValidationError('Base price must be zero or greater');}
    if (fields.sku) {fields.sku = String(fields.sku).trim();}
    if (fields.name) {fields.name = String(fields.name).trim();}

    const categoryId = await this.resolveCategoryId(data.category_id, data.category);
    if (!partial && !categoryId) {throw new ValidationError('A product category is required');}
    if (categoryId) {fields.category_id = categoryId;}
    return fields;
  }

  normalizeVariant(data, { partial = false } = {}) {
    const fields = Object.fromEntries(VARIANT_FIELDS.filter((field) => data[field] !== undefined).map((field) => [field, data[field]]));
    if (!partial && (!fields.sku || !fields.name)) {throw new ValidationError('Variant SKU and name are required');}
    if (fields.sku) {fields.sku = String(fields.sku).trim();}
    if (fields.name) {fields.name = String(fields.name).trim();}
    return fields;
  }

  async resolveCategoryId(categoryId, categoryName) {
    if (categoryId) {
      const category = await this.db('product_categories').where({ id: categoryId, deleted_at: null }).first();
      if (!category) {throw new ValidationError('Product category does not exist');}
      return category.id;
    }
    if (!categoryName) {return null;}
    const name = String(categoryName).trim();
    let category = await this.db('product_categories').where({ name, deleted_at: null }).first();
    if (!category) {
      await this.db('product_categories').insert({ name, created_at: new Date(), updated_at: new Date() });
      category = await this.db('product_categories').where({ name, deleted_at: null }).first();
    }
    return category?.id || null;
  }
}

export default ProductService;
