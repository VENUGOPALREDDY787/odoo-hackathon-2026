import { NotFoundError, ValidationError, AuthorizationError } from '../../../errors/AppError.js';
import { ProductRepository, ProductVariantRepository, PriceListRepository, PriceListItemRepository } from '../repositories/ProductRepository.js';
import { resolvePrice } from './priceResolver.js';
import { AuditTrailRepository } from '../../discounts/repositories/DiscountRepository.js';

export class ProductService {
  constructor(db, logger, cache) {
    this.db = db;
    this.logger = logger || { info: () => {}, warn: () => {}, error: () => {} };
    this.cache = cache; // Global cache instance
    this.productRepo = new ProductRepository(db);
    this.variantRepo = new ProductVariantRepository(db);
    this.priceListRepo = new PriceListRepository(db);
    this.priceListItemRepo = new PriceListItemRepository(db);
    this.auditTrailRepo = new AuditTrailRepository(db);
  }

  // ==================== PRODUCT CRUD ====================

  async createProduct(data, user, reqMeta = {}) {
    if (!user || user.role !== 'admin') {
      throw new AuthorizationError('Only administrators can create products');
    }

    const existing = await this.productRepo.findBySku(data.sku);
    if (existing) {
      throw new ValidationError('Product with this SKU already exists', { sku: data.sku });
    }

    const categoryId = await this.resolveCategoryId(data);

    const payload = {
      ...data,
      category_id: categoryId,
      metadata: data.metadata ? JSON.stringify(data.metadata) : JSON.stringify({}),
      dimensions_cm: data.dimensions_cm ? JSON.stringify(data.dimensions_cm) : null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    delete payload.category;

    const [id] = await this.db('products').insert(payload).returning('id');
    const createdId = typeof id === 'object' ? id.id : id;
    const product = await this.productRepo.findById(createdId || data.id);

    // Role-attributed audit entry: admin created a catalog product
    await this.auditTrailRepo.logChange({
      tableName: 'products',
      recordId: createdId || data.id,
      operation: 'CREATE',
      changedBy: user?.id || null,
      changedByRole: user?.role || null,
      oldValues: null,
      newValues: { sku: data.sku, name: data.name, base_price: data.base_price, category_id: categoryId },
      changedFields: ['sku', 'name', 'base_price', 'category_id'],
      ipAddress: reqMeta?.ip || null,
      userAgent: reqMeta?.userAgent || null,
    });

    this.logger.info({ productId: product?.id, sku: data.sku }, 'Product created');
    if (this.cache) await this.cache.delPattern('products:*');
    return product || { id: createdId, ...data };
  }

  async getProduct(id) {
    const product = await this.productRepo.findById(id);
    if (!product) {
      throw new NotFoundError('Product');
    }
    return product;
  }

  async updateProduct(id, data, user, reqMeta = {}) {
    if (!user || user.role !== 'admin') {
      throw new AuthorizationError('Only administrators can update products');
    }

    const product = await this.getProduct(id);

    const categoryId = data.category_id || data.category
      ? await this.resolveCategoryId(data)
      : product.category_id;

    if (data.sku && data.sku !== product.sku) {
      const existing = await this.productRepo.findBySku(data.sku);
      if (existing) {
        throw new ValidationError('Product with this SKU already exists', { sku: data.sku });
      }
    }

    const updatePayload = { ...data, category_id: categoryId, updated_at: new Date() };
    delete updatePayload.category;
    if (data.metadata) updatePayload.metadata = JSON.stringify(data.metadata);
    if (data.dimensions_cm) updatePayload.dimensions_cm = JSON.stringify(data.dimensions_cm);

    await this.db('products')
      .where({ id, deleted_at: null })
      .update(updatePayload);

    // Role-attributed audit entry: admin edited catalog product fields
    const changedFields = Object.keys(data).filter((key) => !['metadata', 'dimensions_cm', 'category'].includes(key));
    await this.auditTrailRepo.logChange({
      tableName: 'products',
      recordId: id,
      operation: 'UPDATE',
      changedBy: user?.id || null,
      changedByRole: user?.role || null,
      oldValues: { sku: product.sku, name: product.name, base_price: product.base_price },
      newValues: {
        sku: updatePayload.sku ?? product.sku,
        name: updatePayload.name ?? product.name,
        base_price: updatePayload.base_price ?? product.base_price,
      },
      changedFields: changedFields.length ? changedFields : ['updated_at'],
      ipAddress: reqMeta?.ip || null,
      userAgent: reqMeta?.userAgent || null,
    });

    const updated = await this.productRepo.findById(id);
    this.logger.info({ productId: id }, 'Product updated');
    if (this.cache) await this.cache.delPattern('products:*');
    return updated;
  }

  async resolveCategoryId(data) {
    if (data.category_id) return data.category_id;
    if (!data.category) throw new ValidationError('Category is required');
    const category = await this.db('product_categories')
      .where({ name: data.category, deleted_at: null })
      .select('id')
      .first();
    if (!category) throw new ValidationError(`Unknown product category: ${data.category}`);
    return category.id;
  }

  async deleteProduct(id, user = null, reqMeta = {}) {
    const product = await this.getProduct(id);

    const hasLines = await this.productRepo.hasQuotationLines(id);
    if (hasLines) {
      await this.productRepo.softDelete(id);
      // Role-attributed audit entry: soft delete forced by quotation-line references
      await this.auditTrailRepo.logChange({
        tableName: 'products',
        recordId: id,
        operation: 'DELETE',
        changedBy: user?.id || null,
        changedByRole: user?.role || null,
        oldValues: { sku: product.sku, name: product.name },
        newValues: { deleted_at: new Date().toISOString(), soft_deleted: true, reason: 'referenced_by_quotation_lines' },
        changedFields: ['deleted_at'],
        ipAddress: reqMeta?.ip || null,
        userAgent: reqMeta?.userAgent || null,
      });
      this.logger.info({ productId: id }, 'Product soft deleted (referenced by quotation lines)');
      if (this.cache) await this.cache.delPattern('products:*');
      return { success: true, softDeleted: true, message: 'Product soft deleted because it is referenced by quotation lines' };
    }

    await this.productRepo.softDelete(id);
    // Role-attributed audit entry: product removed from the catalog
    await this.auditTrailRepo.logChange({
      tableName: 'products',
      recordId: id,
      operation: 'DELETE',
      changedBy: user?.id || null,
      changedByRole: user?.role || null,
      oldValues: { sku: product.sku, name: product.name },
      newValues: { deleted_at: new Date().toISOString(), soft_deleted: true },
      changedFields: ['deleted_at'],
      ipAddress: reqMeta?.ip || null,
      userAgent: reqMeta?.userAgent || null,
    });
    this.logger.info({ productId: id }, 'Product soft deleted');
    if (this.cache) await this.cache.delPattern('products:*');
    return { success: true, softDeleted: true };
  }

  async listProducts(filters = {}, options = {}) {
    return this.productRepo.listWithFilters(filters, options);
  }

  async getProductWithPriceLists(productId) {
    const product = await this.getProduct(productId);
    return this.productRepo.getWithPriceLists(product.id);
  }

  // ==================== PRICE RESOLUTION ====================

  async getResolvedPrice(productId, variantId = null, customerTier = 'Bronze', currency = 'USD', quantity = 1) {
    // Fetch product raw (even if deleted or inactive, so resolvePrice can return exact status)
    const product = await this.db('products').where({ id: productId }).first();
    let variant = null;
    if (variantId) {
      variant = await this.db('product_variants').where({ id: variantId }).first();
    }

    let priceListItems = [];
    if (product) {
      priceListItems = await this.priceListItemRepo.findForProduct(productId, variantId, customerTier, currency);
    }

    const resolution = resolvePrice({
      product,
      variant,
      priceListItems,
      customerTier,
      currency,
      quantity,
    });

    return {
      product_id: productId,
      variant_id: variantId || null,
      customer_tier: customerTier,
      quantity: Number(quantity) || 1,
      ...resolution,
    };
  }

  // ==================== VARIANT CRUD ====================

  async createVariant(productId, data, user = null, reqMeta = {}) {
    await this.getProduct(productId);

    const existing = await this.variantRepo.findBySku(data.sku);
    if (existing) {
      throw new ValidationError('Variant with this SKU already exists', { sku: data.sku });
    }

    const payload = {
      ...data,
      product_id: productId,
      attributes: data.attributes ? JSON.stringify(data.attributes) : JSON.stringify({}),
      created_at: new Date(),
      updated_at: new Date(),
    };

    const [id] = await this.db('product_variants').insert(payload).returning('id');
    const createdId = typeof id === 'object' ? id.id : id;
    const variant = await this.variantRepo.findById(createdId || data.id);

    // Role-attributed audit entry: variant added to a product
    await this.auditTrailRepo.logChange({
      tableName: 'product_variants',
      recordId: createdId || data.id,
      operation: 'CREATE',
      changedBy: user?.id || null,
      changedByRole: user?.role || null,
      oldValues: null,
      newValues: { sku: data.sku, product_id: productId, price_adjustment: data.price_adjustment },
      changedFields: ['sku', 'product_id', 'price_adjustment'],
      ipAddress: reqMeta?.ip || null,
      userAgent: reqMeta?.userAgent || null,
    });

    this.logger.info({ variantId: variant?.id, productId }, 'Product variant created');
    return variant || { id: createdId, product_id: productId, ...data };
  }

  async getVariant(variantId) {
    const variant = await this.variantRepo.findById(variantId);
    if (!variant) {
      throw new NotFoundError('Product variant');
    }
    return variant;
  }

  async updateVariant(variantId, data) {
    const variant = await this.getVariant(variantId);

    if (data.sku && data.sku !== variant.sku) {
      const existing = await this.variantRepo.findBySku(data.sku);
      if (existing) {
        throw new ValidationError('Variant with this SKU already exists', { sku: data.sku });
      }
    }

    const updatePayload = { ...data, updated_at: new Date() };
    if (data.attributes) updatePayload.attributes = JSON.stringify(data.attributes);

    await this.db('product_variants')
      .where({ id: variantId, deleted_at: null })
      .update(updatePayload);

    return this.variantRepo.findById(variantId);
  }

  async deleteVariant(variantId) {
    await this.getVariant(variantId);
    await this.variantRepo.softDelete(variantId);
    return { success: true };
  }

  async listVariants(productId, options = {}) {
    await this.getProduct(productId);
    return this.variantRepo.findByProduct(productId, options);
  }

  // ==================== PRICE LIST CRUD ====================

  async createPriceList(data) {
    if (data.is_default) {
      await this.db('price_lists').where({ is_default: true, deleted_at: null }).update({ is_default: false });
    }

    const payload = {
      ...data,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const [id] = await this.db('price_lists').insert(payload).returning('id');
    const createdId = typeof id === 'object' ? id.id : id;
    const priceList = await this.priceListRepo.findById(createdId || data.id);

    this.logger.info({ priceListId: priceList?.id }, 'Price list created');
    return priceList || { id: createdId, ...data };
  }

  async getPriceList(id) {
    const priceList = await this.priceListRepo.findById(id);
    if (!priceList) {
      throw new NotFoundError('Price list');
    }
    return priceList;
  }

  async updatePriceList(id, data) {
    const priceList = await this.getPriceList(id);

    if (data.is_default && !priceList.is_default) {
      await this.db('price_lists').where({ is_default: true, deleted_at: null }).update({ is_default: false });
    }

    await this.db('price_lists')
      .where({ id, deleted_at: null })
      .update({ ...data, updated_at: new Date() });

    return this.priceListRepo.findById(id);
  }

  async deletePriceList(id) {
    await this.getPriceList(id);
    await this.priceListRepo.softDelete(id);
    return { success: true };
  }

  async listPriceLists(filters = {}, options = {}) {
    return this.priceListRepo.listWithFilters(filters, options);
  }

  // ==================== PRICE LIST ITEM CRUD ====================

  async addPriceListItem(data) {
    await this.getPriceList(data.price_list_id);
    await this.getProduct(data.product_id);

    if (data.variant_id) {
      await this.getVariant(data.variant_id);
    }

    const existing = await this.db('price_list_items')
      .where({
        price_list_id: data.price_list_id,
        product_id: data.product_id,
        variant_id: data.variant_id || null,
        customer_tier: data.customer_tier || null,
        min_quantity: data.min_quantity || 1,
        deleted_at: null,
      })
      .first();

    if (existing) {
      throw new ValidationError('Price list item already exists for this combination');
    }

    const payload = {
      ...data,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const [id] = await this.db('price_list_items').insert(payload).returning('id');
    const createdId = typeof id === 'object' ? id.id : id;
    const item = await this.priceListItemRepo.findById(createdId || data.id);

    return item || { id: createdId, ...data };
  }

  async updatePriceListItem(itemId, data) {
    const item = await this.priceListItemRepo.findById(itemId);
    if (!item) {
      throw new NotFoundError('Price list item');
    }

    await this.db('price_list_items')
      .where({ id: itemId, deleted_at: null })
      .update({ ...data, updated_at: new Date() });

    return this.priceListItemRepo.findById(itemId);
  }

  async deletePriceListItem(itemId) {
    const item = await this.priceListItemRepo.findById(itemId);
    if (!item) {
      throw new NotFoundError('Price list item');
    }
    await this.priceListItemRepo.softDelete(itemId);
    return { success: true };
  }
}

export { resolvePrice };
export default ProductService;