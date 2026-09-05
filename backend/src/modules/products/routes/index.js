import { Router } from 'express';
import { container } from '../../../container/index.js';
import { authenticate, authorizePermission } from '../../auth/routes/index.js';

const router = Router();

function getController() {
  return container.get('productController');
}

router.get('/', authenticate(), authorizePermission('products', 'read'), (req, res, next) => getController().list(req, res, next));
router.post('/', authenticate(), authorizePermission('products', 'create'), (req, res, next) => getController().create(req, res, next));
router.get('/:id', authenticate(), authorizePermission('products', 'read'), (req, res, next) => getController().getById(req, res, next));
router.put('/:id', authenticate(), authorizePermission('products', 'update'), (req, res, next) => getController().update(req, res, next));
router.delete('/:id', authenticate(), authorizePermission('products', 'delete'), (req, res, next) => getController().delete(req, res, next));

router.get('/:id/variants', authenticate(), authorizePermission('productVariants', 'read'), (req, res, next) => getController().getVariants(req, res, next));
router.post('/:id/variants', authenticate(), authorizePermission('productVariants', 'create'), (req, res, next) => getController().createVariant(req, res, next));
router.put('/:id/variants/:variantId', authenticate(), authorizePermission('productVariants', 'update'), (req, res, next) => getController().updateVariant(req, res, next));
router.delete('/:id/variants/:variantId', authenticate(), authorizePermission('productVariants', 'delete'), (req, res, next) => getController().deleteVariant(req, res, next));

export default router;