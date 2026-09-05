import { asyncHandler } from '../../../middleware/errorHandler.js';

export class WarehouseController {
  constructor(warehouseService) {
    this.service = warehouseService;
  }

  // ==================== WAREHOUSE CRUD ====================

  createWarehouse = asyncHandler(async (req, res) => {
    const warehouse = await this.service.createWarehouse(req.body);
    res.status(201).json({ data: warehouse });
  });

  listWarehouses = asyncHandler(async (req, res) => {
    const filters = {
      is_active: req.query.is_active,
      search: req.query.search,
    };
    const options = {
      page: req.query.page || 1,
      limit: req.query.limit || 20,
    };
    const result = await this.service.listWarehouses(filters, options);
    res.json(result);
  });

  getWarehouse = asyncHandler(async (req, res) => {
    const warehouse = await this.service.getWarehouse(req.params.id);
    res.json({ data: warehouse });
  });

  updateWarehouse = asyncHandler(async (req, res) => {
    const warehouse = await this.service.updateWarehouse(req.params.id, req.body);
    res.json({ data: warehouse });
  });

  deleteWarehouse = asyncHandler(async (req, res) => {
    const result = await this.service.deleteWarehouse(req.params.id);
    res.json({ data: result });
  });

  // ==================== STOCK & FULFILLMENT SPLITS ====================

  adjustStock = asyncHandler(async (req, res) => {
    const result = await this.service.adjustStockOnHand(req.body);
    res.json({ data: result });
  });

  listStockLevels = asyncHandler(async (req, res) => {
    const stocks = await this.service.listStockLevels(req.params.id);
    res.json({ data: stocks });
  });

  reserveStockForLine = asyncHandler(async (req, res) => {
    const reqMeta = {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
    const user = req.user || { id: req.body.user_id || 'system-user', role: req.body.role || 'rep' };
    const result = await this.service.reserveStockForLine(req.params.lineId, user, reqMeta);
    res.json({ data: result });
  });

  overrideSplits = asyncHandler(async (req, res) => {
    const reqMeta = {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
    const user = req.user || { id: req.body.user_id || 'ops-user', role: req.body.role || 'manager' };
    const result = await this.service.overrideFulfillmentSplits(
      {
        quotation_line_id: req.body.quotation_line_id || req.params.lineId,
        custom_splits: req.body.custom_splits,
        override_reason: req.body.override_reason,
      },
      user,
      reqMeta
    );
    res.json({ data: result });
  });

  consolidateBackorders = asyncHandler(async (req, res) => {
    const result = await this.service.consolidateBackorders();
    res.json({ data: result });
  });
}

export default WarehouseController;
