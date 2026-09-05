import { Router } from 'express';
import { container } from '../../container/index.js';

const router = Router();

function getController() {
  return container.get('productController');
}

router.get('/', (req, res, next) => getController().list(req, res, next));
router.post('/', (req, res, next) => getController().create(req, res, next));
router.get('/:id', (req, res, next) => getController().getById(req, res, next));
router.put('/:id', (req, res, next) => getController().update(req, res, next));
router.delete('/:id', (req, res, next) => getController().delete(req, res, next));

router.get('/:id/variants', (req, res, next) => getController().getVariants(req, res, next));
router.post('/:id/variants', (req, res, next) => getController().createVariant(req, res, next));
router.put('/:id/variants/:variantId', (req, res, next) => getController().updateVariant(req, res, next));

export default router;