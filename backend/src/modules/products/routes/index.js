import { Router } from 'express';
import { container } from '../../../container/index.js';
import { validateBody, validateQuery, validateParams } from '../../../middleware/validate.js';
import { cacheMiddleware } from '../../../middleware/cacheMiddleware.js';
import { authenticate, canManageProducts } from '../../auth/middleware/auth.js';
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
router.use(authenticate());

function getController() {
  return container.get('productController');
}

router.get('/price-lists', validateQuery(priceListQuerySchema), (req, res, next) => getController().listPriceLists(req, res, next));
router.post('/price-lists', canManageProducts, validateBody(priceListSchema), (req, res, next) => getController().createPriceList(req, res, next));
router.get('/price-lists/:priceListId', validateParams(priceListIdParamSchema), (req, res, next) => getController().getPriceList(req, res, next));
router.put('/price-lists/:priceListId', canManageProducts, validateParams(priceListIdParamSchema), validateBody(priceListUpdateSchema), (req, res, next) => getController().updatePriceList(req, res, next));
router.delete('/price-lists/:priceListId', canManageProducts, validateParams(priceListIdParamSchema), (req, res, next) => getController().deletePriceList(req, res, next));
router.post('/price-lists/:priceListId/items', canManageProducts, validateParams(priceListIdParamSchema), validateBody(priceListItemSchema), (req, res, next) => getController().addPriceListItem(req, res, next));
router.put('/price-lists/items/:itemId', canManageProducts, validateParams(priceListItemIdParamSchema), validateBody(priceListItemUpdateSchema), (req, res, next) => getController().updatePriceListItem(req, res, next));
router.delete('/price-lists/items/:itemId', canManageProducts, validateParams(priceListItemIdParamSchema), (req, res, next) => getController().deletePriceListItem(req, res, next));

router.get('/', validateQuery(productListQuerySchema), cacheMiddleware({ key: (req) => `products:list:${new URLSearchParams(req.query).toString()}`, ttl: 3600 }), (req, res, next) => getController().list(req, res, next));
// NOTE: must stay registered above GET /:id so 'categories' is not captured as an id param.
router.get('/categories', (req, res, next) => getController().listCategories(req, res, next));
router.post('/', canManageProducts, validateBody(productSchema), (req, res, next) => getController().create(req, res, next));
router.get('/:id', validateParams(idParamSchema), cacheMiddleware({ key: (req) => `products:item:${req.params.id}`, ttl: 3600 }), (req, res, next) => getController().getById(req, res, next));
router.put('/:id', canManageProducts, validateParams(idParamSchema), validateBody(productUpdateSchema), (req, res, next) => getController().update(req, res, next));
router.delete('/:id', canManageProducts, validateParams(idParamSchema), (req, res, next) => getController().delete(req, res, next));
router.get('/:id/with-price-lists', validateParams(idParamSchema), (req, res, next) => getController().getWithPriceLists(req, res, next));
router.get('/:id/price', validateParams(idParamSchema), validateQuery(priceResolutionQuerySchema), (req, res, next) => getController().getPrice(req, res, next));
router.get('/:id/variants', validateParams(idParamSchema), (req, res, next) => getController().getVariants(req, res, next));
router.post('/:id/variants', canManageProducts, validateParams(idParamSchema), validateBody(productVariantSchema), (req, res, next) => getController().createVariant(req, res, next));
router.get('/:id/variants/:variantId', validateParams(variantIdParamSchema), (req, res, next) => getController().getVariant(req, res, next));
router.put('/:id/variants/:variantId', canManageProducts, validateParams(variantIdParamSchema), validateBody(productVariantUpdateSchema), (req, res, next) => getController().updateVariant(req, res, next));
router.delete('/:id/variants/:variantId', canManageProducts, validateParams(variantIdParamSchema), (req, res, next) => getController().deleteVariant(req, res, next));

export default router;
