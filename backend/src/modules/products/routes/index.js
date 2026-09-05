import { Router } from 'express';
import { container } from '../../../container/index.js';
import { validateBody, validateQuery, validateParams } from '../../../middleware/validate.js';
import {
  idParamSchema,
  variantIdParamSchema,
  priceListIdParamSchema,
  priceListItemIdParamSchema,
  productSchema,
  productUpdateSchema,
  productListQuerySchema,
  productVariantSchema,
  productVariantUpdateSchema,
  priceListSchema,
  priceListUpdateSchema,
  priceListQuerySchema,
  priceListItemSchema,
  priceListItemUpdateSchema,
  priceResolutionQuerySchema,
} from '../validators/productSchemas.js';

const router = Router();

function getController() {
  return container.get('productController');
}

// ==================== PRICE LIST ROUTES ====================

router.get('/price-lists', validateQuery(priceListQuerySchema), (req, res, next) =>
  getController().listPriceLists(req, res, next)
);

router.post('/price-lists', validateBody(priceListSchema), (req, res, next) =>
  getController().createPriceList(req, res, next)
);

router.get('/price-lists/:priceListId', validateParams(priceListIdParamSchema), (req, res, next) =>
  getController().getPriceList(req, res, next)
);

router.put(
  '/price-lists/:priceListId',
  validateParams(priceListIdParamSchema),
  validateBody(priceListUpdateSchema),
  (req, res, next) => getController().updatePriceList(req, res, next)
);

router.delete('/price-lists/:priceListId', validateParams(priceListIdParamSchema), (req, res, next) =>
  getController().deletePriceList(req, res, next)
);

router.post(
  '/price-lists/:priceListId/items',
  validateParams(priceListIdParamSchema),
  validateBody(priceListItemSchema),
  (req, res, next) => getController().addPriceListItem(req, res, next)
);

router.put(
  '/price-lists/items/:itemId',
  validateParams(priceListItemIdParamSchema),
  validateBody(priceListItemUpdateSchema),
  (req, res, next) => getController().updatePriceListItem(req, res, next)
);

router.delete('/price-lists/items/:itemId', validateParams(priceListItemIdParamSchema), (req, res, next) =>
  getController().deletePriceListItem(req, res, next)
);

// ==================== PRODUCT LIST & CREATE ROUTES ====================

router.get('/', validateQuery(productListQuerySchema), (req, res, next) =>
  getController().list(req, res, next)
);

router.post('/', validateBody(productSchema), (req, res, next) =>
  getController().create(req, res, next)
);

// ==================== PRODUCT SINGLE & PRICE RESOLUTION ROUTES ====================

router.get('/:id', validateParams(idParamSchema), (req, res, next) =>
  getController().getById(req, res, next)
);

router.put(
  '/:id',
  validateParams(idParamSchema),
  validateBody(productUpdateSchema),
  (req, res, next) => getController().update(req, res, next)
);

router.delete('/:id', validateParams(idParamSchema), (req, res, next) =>
  getController().delete(req, res, next)
);

router.get('/:id/with-price-lists', validateParams(idParamSchema), (req, res, next) =>
  getController().getWithPriceLists(req, res, next)
);

router.get(
  '/:id/price',
  validateParams(idParamSchema),
  validateQuery(priceResolutionQuerySchema),
  (req, res, next) => getController().getPrice(req, res, next)
);

// ==================== PRODUCT VARIANT ROUTES ====================

router.get('/:id/variants', validateParams(idParamSchema), (req, res, next) =>
  getController().getVariants(req, res, next)
);

router.post(
  '/:id/variants',
  validateParams(idParamSchema),
  validateBody(productVariantSchema),
  (req, res, next) => getController().createVariant(req, res, next)
);

router.get(
  '/:id/variants/:variantId',
  validateParams(variantIdParamSchema),
  (req, res, next) => getController().getVariant(req, res, next)
);

router.put(
  '/:id/variants/:variantId',
  validateParams(variantIdParamSchema),
  validateBody(productVariantUpdateSchema),
  (req, res, next) => getController().updateVariant(req, res, next)
);

router.delete(
  '/:id/variants/:variantId',
  validateParams(variantIdParamSchema),
  (req, res, next) => getController().deleteVariant(req, res, next)
);

export default router;