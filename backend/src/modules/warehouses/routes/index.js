import { Router } from 'express';
import { container } from '../../../container/index.js';
import { validateBody, validateQuery, validateParams } from '../../../middleware/validate.js';
import { z } from 'zod';
import {
  warehouseSchema,
  warehouseUpdateSchema,
  stockAdjustmentSchema,
  splitOverrideSchema,
} from '../validators/warehouseSchemas.js';

const router = Router();

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const lineIdParamSchema = z.object({
  lineId: z.string().uuid(),
});

function getController() {
  return container.get('warehouseController');
}

// ==================== WAREHOUSE CRUD ====================

router.get('/', (req, res, next) => getController().listWarehouses(req, res, next));
router.post('/', validateBody(warehouseSchema), (req, res, next) => getController().createWarehouse(req, res, next));
router.get('/:id', validateParams(idParamSchema), (req, res, next) => getController().getWarehouse(req, res, next));
router.put('/:id', validateParams(idParamSchema), validateBody(warehouseUpdateSchema), (req, res, next) =>
  getController().updateWarehouse(req, res, next)
);
router.delete('/:id', validateParams(idParamSchema), (req, res, next) =>
  getController().deleteWarehouse(req, res, next)
);

// ==================== STOCK LEVELS & RESERVATIONS ====================

router.get('/:id/stock-levels', validateParams(idParamSchema), (req, res, next) =>
  getController().listStockLevels(req, res, next)
);

router.post('/stock/adjust', validateBody(stockAdjustmentSchema), (req, res, next) =>
  getController().adjustStock(req, res, next)
);

router.post('/lines/:lineId/reserve-stock', validateParams(lineIdParamSchema), (req, res, next) =>
  getController().reserveStockForLine(req, res, next)
);

router.post('/fulfillment-splits/override', validateBody(splitOverrideSchema), (req, res, next) =>
  getController().overrideSplits(req, res, next)
);

router.post('/backorders/consolidate', (req, res, next) =>
  getController().consolidateBackorders(req, res, next)
);

export default router;
