import { NotFoundError, ValidationError, ConflictError } from '../../../errors/AppError.js';
import {
  WarehouseRepository,
  StockLevelRepository,
  FulfillmentSplitRepository,
} from '../repositories/WarehouseRepository.js';
import { AuditTrailRepository } from '../../discounts/repositories/DiscountRepository.js';
import { splitFulfillment } from './fulfillmentSplitter.js';

export class WarehouseService {
  constructor(db, logger, io = null) {
    this.db = db;
    this.logger = logger || { info: () => {}, warn: () => {}, error: () => {} };
    this.io = io;
    this.warehouseRepo = new WarehouseRepository(db);
    this.stockLevelRepo = new StockLevelRepository(db);
    this.splitRepo = new FulfillmentSplitRepository(db);
    this.auditTrailRepo = new AuditTrailRepository(db);
  }

  // ==================== WAREHOUSE CRUD ====================

  async createWarehouse(data) {
    const payload = {
      ...data,
      address: typeof data.address === 'object' ? JSON.stringify(data.address) : data.address,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const [id] = await this.db('warehouses').insert(payload).returning('id');
    const createdId = typeof id === 'object' ? id.id : id;
    const warehouse = await this.warehouseRepo.findById(createdId || data.id);

    this.logger.info({ warehouseId: warehouse?.id }, 'Warehouse created');
    return warehouse;
  }

  async getWarehouse(id) {
    const warehouse = await this.warehouseRepo.findById(id);
    if (!warehouse) throw new NotFoundError('Warehouse');
    return warehouse;
  }

  async updateWarehouse(id, data) {
    await this.getWarehouse(id);
    const updatePayload = { ...data, updated_at: new Date() };
    if (data.address && typeof data.address === 'object') {
      updatePayload.address = JSON.stringify(data.address);
    }

    await this.db('warehouses').where({ id, deleted_at: null }).update(updatePayload);
    return this.warehouseRepo.findById(id);
  }

  async deleteWarehouse(id) {
    await this.getWarehouse(id);
    await this.warehouseRepo.softDelete(id);
    return { success: true };
  }

  async listWarehouses(filters = {}, options = {}) {
    return this.warehouseRepo.listWithFilters(filters, options);
  }

  // ==================== STOCK LEVELS & REPLENISHMENT ====================

  async adjustStockOnHand({ warehouse_id, product_id, variant_id = null, quantity_change, reason = 'Replenishment' }) {
    await this.getWarehouse(warehouse_id);
    const stockId = await this.stockLevelRepo.adjustStockOnHand(
      warehouse_id,
      product_id,
      variant_id,
      quantity_change,
      this.db
    );

    this.logger.info({ warehouse_id, product_id, quantity_change, reason }, 'Stock level adjusted');

    // Trigger backorder consolidation check when stock is replenished
    if (quantity_change > 0) {
      setTimeout(() => {
        this.consolidateBackorders().catch(err => {
          this.logger.error({ err }, 'Error running backorder consolidation post-replenishment');
        });
      }, 50);
    }

    return this.stockLevelRepo.findById(stockId);
  }

  async listStockLevels(warehouseId) {
    return this.db('stock_levels as sl')
      .join('products as p', 'sl.product_id', 'p.id')
      .leftJoin('product_variants as pv', 'sl.variant_id', 'pv.id')
      .where({ 'sl.warehouse_id': warehouseId, 'sl.deleted_at': null })
      .select('sl.*', 'p.name as product_name', 'p.sku as product_sku', 'pv.sku as variant_sku');
  }

  // ==================== TRANSACTIONAL STOCK RESERVATION ====================

  /**
   * Performs row-locked (FOR UPDATE) transactional stock reservation for a quotation line item.
   * Splits quantity greedily across warehouses to minimize shipments and creates fulfillment_splits rows.
   */
  async reserveStockForLine(quotationLineId, user = null, reqMeta = {}) {
    const trx = await this.db.transaction();
    try {
      const line = await trx('quotation_lines as ql')
        .join('quotations as q', 'ql.quotation_id', 'q.id')
        .where({ 'ql.id': quotationLineId, 'ql.deleted_at': null })
        .select('ql.*', 'q.status as quotation_status', 'q.quotation_number')
        .first();

      if (!line) throw new NotFoundError('Quotation line');
      if (!line.product_id) {
        throw new ValidationError('Cannot reserve stock for custom line items without a product_id');
      }

      const qtyNeeded = Number(line.quantity || 1);

      // Fetch active stock levels with FOR UPDATE row locks to prevent overselling
      const stockLevelsWithLock = await this.stockLevelRepo.findByProductWithLock(
        line.product_id,
        line.variant_id,
        trx
      );

      // Run greedy split algorithm
      const splitResult = splitFulfillment(line.product_id, qtyNeeded, stockLevelsWithLock);

      // Clean up previous splits for this line if any
      await this.splitRepo.deleteByLine(quotationLineId, trx);

      // Insert new fulfillment_splits & reserve stock_levels
      const createdSplits = [];
      for (const split of splitResult.splits) {
        const splitStatus = 'pending';
        const [splitId] = await trx('fulfillment_splits').insert({
          quotation_line_id: quotationLineId,
          warehouse_id: split.warehouse_id,
          quantity: split.quantity,
          status: splitStatus,
          created_at: new Date(),
          updated_at: new Date(),
        }).returning('id');

        // Decrement available stock by incrementing reserved stock atomically
        await this.stockLevelRepo.reserveStock(
          split.warehouse_id,
          line.product_id,
          line.variant_id,
          split.quantity,
          trx
        );

        createdSplits.push({
          id: typeof splitId === 'object' ? splitId.id : splitId,
          warehouse_id: split.warehouse_id,
          warehouse_name: split.warehouse_name,
          quantity: split.quantity,
          status: splitStatus,
        });
      }

      // Log audit trail for stock reservation
      await this.auditTrailRepo.logChange({
        tableName: 'fulfillment_splits',
        recordId: quotationLineId,
        operation: 'INSERT',
        changedBy: user?.id || null,
        changedByRole: user?.role || null,
        oldValues: null,
        newValues: { splits: createdSplits, total_allocated: splitResult.total_allocated, backorder_quantity: splitResult.backorder_quantity },
        changedFields: ['splits', 'stock_reserved'],
        ipAddress: reqMeta.ip || null,
        userAgent: reqMeta.userAgent || null,
      });

      await trx.commit();

      const responsePayload = {
        quotation_line_id: quotationLineId,
        qty_needed: qtyNeeded,
        total_allocated: splitResult.total_allocated,
        backorder_quantity: splitResult.backorder_quantity,
        is_fully_allocated: splitResult.is_fully_allocated,
        splits: createdSplits,
      };

      if (this.io && line.quotation_id) {
        this.io.to(`quote:${line.quotation_id}`).emit('fulfillment:splitUpdated', {
          quotationId: line.quotation_id,
          splitDetails: responsePayload,
        });
      }

      return responsePayload;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // ==================== MANUAL OPS OVERRIDE ====================

  /**
   * Replaces suggested fulfillment splits with custom ops overrides,
   * validating stock availability with FOR UPDATE row locks and logging reason to audit_trails.
   */
  async overrideFulfillmentSplits({ quotation_line_id, custom_splits, override_reason }, user, reqMeta = {}) {
    const trx = await this.db.transaction();
    try {
      const line = await trx('quotation_lines as ql')
        .where({ 'ql.id': quotation_line_id, 'ql.deleted_at': null })
        .first();

      if (!line) throw new NotFoundError('Quotation line');
      if (!line.product_id) throw new ValidationError('Cannot override splits for custom line items');

      const existingSplits = await this.splitRepo.findByLine(quotation_line_id, trx);

      // Lock stock levels for all target warehouses
      const lockedStocks = await this.stockLevelRepo.findByProductWithLock(
        line.product_id,
        line.variant_id,
        trx
      );

      // Release previously reserved stocks for this line
      for (const oldSplit of existingSplits) {
        await this.stockLevelRepo.releaseStock(
          oldSplit.warehouse_id,
          line.product_id,
          line.variant_id,
          oldSplit.quantity,
          trx
        );
      }

      // Delete existing splits
      await this.splitRepo.deleteByLine(quotation_line_id, trx);

      // Validate and apply custom splits
      const newSplitsCreated = [];
      let totalCustomQty = 0;

      for (const custom of custom_splits) {
        const whStock = lockedStocks.find(s => s.warehouse_id === custom.warehouse_id);
        const stockAvailable = whStock
          ? Number(whStock.quantity_on_hand || 0) - Number(whStock.quantity_reserved || 0) + (existingSplits.find(s => s.warehouse_id === custom.warehouse_id)?.quantity || 0)
          : 0;

        if (custom.quantity > stockAvailable) {
          throw new ValidationError(
            `Warehouse ${whStock?.warehouse_name || custom.warehouse_id} does not have sufficient available stock (${stockAvailable}) for requested split (${custom.quantity}).`
          );
        }

        const [splitId] = await trx('fulfillment_splits').insert({
          quotation_line_id,
          warehouse_id: custom.warehouse_id,
          quantity: custom.quantity,
          status: 'pending',
          created_at: new Date(),
          updated_at: new Date(),
        }).returning('id');

        await this.stockLevelRepo.reserveStock(
          custom.warehouse_id,
          line.product_id,
          line.variant_id,
          custom.quantity,
          trx
        );

        totalCustomQty += custom.quantity;
        newSplitsCreated.push({
          id: typeof splitId === 'object' ? splitId.id : splitId,
          warehouse_id: custom.warehouse_id,
          quantity: custom.quantity,
        });
      }

      // Write immutable audit trail entry detailing ops override reason
      await this.auditTrailRepo.logChange({
        tableName: 'fulfillment_splits',
        recordId: quotation_line_id,
        operation: 'UPDATE',
        changedBy: user?.id || null,
        changedByRole: user?.role || null,
        oldValues: { previous_splits: existingSplits },
        newValues: { custom_splits: newSplitsCreated, total_quantity: totalCustomQty, reason: override_reason },
        changedFields: ['custom_splits', 'override_reason'],
        ipAddress: reqMeta.ip || null,
        userAgent: reqMeta.userAgent || null,
      });

      await trx.commit();

      this.logger.info(
        { quotation_line_id, override_reason, userId: user?.id },
        'Ops manual split override applied successfully'
      );

      const responsePayload = {
        quotation_line_id,
        total_allocated: totalCustomQty,
        override_reason,
        splits: newSplitsCreated,
      };

      if (this.io && line.quotation_id) {
        this.io.to(`quote:${line.quotation_id}`).emit('fulfillment:splitUpdated', {
          quotationId: line.quotation_id,
          splitDetails: responsePayload,
        });
      }

      return responsePayload;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // ==================== BACKORDER CONSOLIDATION JOB ====================

  /**
   * Scans pending backorders and checks if stock replenishment allows them to be fulfilled.
   */
  async consolidateBackorders() {
    const pendingLines = await this.splitRepo.findPendingBackorders();
    let backordersResolved = 0;

    for (const line of pendingLines) {
      if (!line.product_id) continue;

      const existingSplits = await this.splitRepo.findByLine(line.id);
      const safeSplits = Array.isArray(existingSplits) ? existingSplits : [];
      const currentlyAllocated = safeSplits.reduce((acc, s) => acc + Number(s.quantity || 0), 0);
      const backorderQty = Number(line.quantity || 0) - currentlyAllocated;

      if (backorderQty > 0) {
        // Attempt reservation with updated stock levels
        try {
          const res = await this.reserveStockForLine(line.id, { id: 'system-job', role: 'admin' });
          if (res.backorder_quantity < backorderQty) {
            backordersResolved++;
            this.logger.info(
              { quotationLineId: line.id, quotationNumber: line.quotation_number, resolvedQty: backorderQty - res.backorder_quantity },
              'Backorder partially or fully consolidated post-replenishment'
            );
          }
        } catch (e) {
          this.logger.warn({ lineId: line.id, error: e.message }, 'Failed backorder consolidation check for line');
        }
      }
    }

    return {
      checked_lines: pendingLines.length,
      resolved_backorders: backordersResolved,
      timestamp: new Date().toISOString(),
    };
  }
}

export default WarehouseService;
