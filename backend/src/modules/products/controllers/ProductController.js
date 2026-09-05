import { asyncHandler } from '../../middleware/errorHandler.js';
import { ValidationError } from '../../errors/AppError.js';

export class ProductController {
  constructor(productService) {
    this.service = productService;
  }

  create = asyncHandler(async (req, res) => {
    const product = await this.service.createProduct(req.body);
    res.status(201).json({ data: product });
  });

  getById = asyncHandler(async (req, res) => {
    const product = await this.service.getProduct(req.params.id);
    res.json({ data: product });
  });

  update = asyncHandler(async (req, res) => {
    const product = await this.service.updateProduct(req.params.id, req.body);
    res.json({ data: product });
  });

  delete = asyncHandler(async (req, res) => {
    await this.service.deleteProduct(req.params.id);
    res.status(204).send();
  });

  list = asyncHandler(async (req, res) => {
    const filters = {
      category_id: req.query.category_id,
      is_active: req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
      search: req.query.search,
    };

    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 20, 100),
      orderBy: req.query.order_by || 'created_at',
      orderDir: req.query.order_dir === 'asc' ? 'asc' : 'desc',
    };

    const result = await this.service.listProducts(filters, options);
    res.json(result);
  });

  getVariants = asyncHandler(async (req, res) => {
    const variants = await this.service.getVariants(req.params.id);
    res.json({ data: variants });
  });

  createVariant = asyncHandler(async (req, res) => {
    const variant = await this.service.createVariant(req.params.id, req.body);
    res.status(201).json({ data: variant });
  });

  updateVariant = asyncHandler(async (req, res) => {
    const variant = await this.service.updateVariant(req.params.variantId, req.body);
    res.json({ data: variant });
  });
}

export default ProductController;