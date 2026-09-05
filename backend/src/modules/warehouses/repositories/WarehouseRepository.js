import BaseRepository from '../../../utils/BaseRepository.js';

export class WarehouseRepository extends BaseRepository {
  constructor(db) {
    super(db, 'warehouses');
  }

  async findDefault(trx = null) {
    const db = trx || this.db;
    return db('warehouses')
      .where({ is_default: true, is_active: true, deleted_at: null })
      .first();
  }

  async listWithFilters(filters = {}, options = {}) {
    const { page = 1, limit = 20, orderBy = 'created_at', orderDir = 'desc' } = options;
    const offset = (page - 1) * limit;

    let query = this.db('warehouses').where({ deleted_at: null });

    if (filters.is_active !== undefined) query = query.where('is_active', filters.is_active);
    if (filters.search) {
      query = query.where(function() {
        this.where('name', 'like', `%${filters.search}%`).orWhere('code', 'like', `%${filters.search}%`);
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

export class StockLevelRepository extends BaseRepository {
  constructor(db) {
    super(db, 'stock_levels');
  }

  /**
   * Fetches active warehouse stock levels for a product with FOR UPDATE row-level locking.
   * Ensures concurrent order reservations are serialized at the DB layer.
   */
  async findByProductWithLock(productId, variantId = null, trx) {
    if (!trx) {
      throw new Error('Database transaction (trx) is required for row locking (FOR UPDATE)');
    }

    let query = trx('stock_levels as sl')
      .join('warehouses as w', 'sl.warehouse_id', 'w.id')
      .where({ 'sl.product_id': productId, 'sl.deleted_at': null, 'w.is_active': true, 'w.deleted_at': null });

    if (variantId) {
      query = query.where('sl.variant_id', variantId);
    } else {
      query = query.whereNull('sl.variant_id');
    }

    return query
      .select(
        'sl.*',
        'w.name as warehouse_name',
        'w.code as warehouse_code',
        trx.raw('(sl.quantity_on_hand - sl.quantity_reserved) as quantity_available')
      )
      .forUpdate();
  }

  async findByWarehouseAndProduct(warehouseId, productId, variantId = null, trx = null) {
    const db = trx || this.db;
    let query = db('stock_levels').where({ warehouse_id: warehouseId, product_id: productId, deleted_at: null });
    if (variantId) {
      query = query.where('variant_id', variantId);
    } else {
      query = query.whereNull('variant_id');
    }
    return query.first();
  }

  async reserveStock(warehouseId, productId, variantId = null, quantity, trx) {
    const db = trx || this.db;
    let query = db('stock_levels').where({ warehouse_id: warehouseId, product_id: productId, deleted_at: null });
    if (variantId) {
      query = query.where('variant_id', variantId);
    } else {
      query = query.whereNull('variant_id');
    }

    return query.update({
      quantity_reserved: db.raw('quantity_reserved + ?', [quantity]),
      updated_at: new Date(),
    });
  }

  async releaseStock(warehouseId, productId, variantId = null, quantity, trx) {
    const db = trx || this.db;
    let query = db('stock_levels').where({ warehouse_id: warehouseId, product_id: productId, deleted_at: null });
    if (variantId) {
      query = query.where('variant_id', variantId);
    } else {
      query = query.whereNull('variant_id');
    }

    return query.update({
      quantity_reserved: db.raw('GREATEST(0, quantity_reserved - ?)', [quantity]),
      updated_at: new Date(),
    });
  }

  async adjustStockOnHand(warehouseId, productId, variantId = null, quantityChange, trx = null) {
    const db = trx || this.db;
    let existing = await this.findByWarehouseAndProduct(warehouseId, productId, variantId, db);

    if (!existing) {
      const payload = {
        warehouse_id: warehouseId,
        product_id: productId,
        variant_id: variantId || null,
        quantity_on_hand: Math.max(0, quantityChange),
        quantity_reserved: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };
      const [id] = await db('stock_levels').insert(payload).returning('id');
      return id;
    }

    let query = db('stock_levels').where({ id: existing.id });
    await query.update({
      quantity_on_hand: db.raw('GREATEST(0, quantity_on_hand + ?)', [quantityChange]),
      updated_at: new Date(),
    });

    return existing.id;
  }
}

export class FulfillmentSplitRepository extends BaseRepository {
  constructor(db) {
    super(db, 'fulfillment_splits');
  }

  async findByLine(quotationLineId, trx = null) {
    const db = trx || this.db;
    return db('fulfillment_splits as fs')
      .join('warehouses as w', 'fs.warehouse_id', 'w.id')
      .where({ 'fs.quotation_line_id': quotationLineId, 'fs.deleted_at': null })
      .select('fs.*', 'w.name as warehouse_name', 'w.code as warehouse_code')
      .orderBy('fs.created_at', 'asc');
  }

  async findPendingBackorders(trx = null) {
    const db = trx || this.db;
    return db('quotation_lines as ql')
      .join('quotations as q', 'ql.quotation_id', 'q.id')
      .where({ 'ql.deleted_at': null, 'q.deleted_at': null })
      .whereIn('q.status', ['approved', 'pending_approval'])
      .where('ql.quantity', '>', 0)
      .select('ql.*', 'q.quotation_number');
  }

  async deleteByLine(quotationLineId, trx = null) {
    const db = trx || this.db;
    return db('fulfillment_splits')
      .where({ quotation_line_id: quotationLineId })
      .update({ deleted_at: new Date(), updated_at: new Date() });
  }
}

export default {
  WarehouseRepository,
  StockLevelRepository,
  FulfillmentSplitRepository,
};
