import { asyncHandler } from '../../../middleware/errorHandler.js';

export class ProductController {
  constructor(productService) {
    this.service = productService;
  }

  // ==================== PRODUCTS ====================

  create = asyncHandler(async (req, res) => {
    const product = await this.service.createProduct(req.body, req.user);
    res.status(201).json({ data: product });
  });

  getById = asyncHandler(async (req, res) => {
    const product = await this.service.getProduct(req.params.id);
    res.json({ data: product });
  });

  update = asyncHandler(async (req, res) => {
    const product = await this.service.updateProduct(req.params.id, req.body, req.user);
    res.json({ data: product });
  });

  delete = asyncHandler(async (req, res) => {
    const result = await this.service.deleteProduct(req.params.id);
    res.json({ data: result });
  });

  list = asyncHandler(async (req, res) => {
    const filters = {
      category_id: req.query.category_id,
      is_active: req.query.is_active,
      search: req.query.search,
      min_price: req.query.min_price,
      max_price: req.query.max_price,
    };

    const options = {
      page: req.query.page || 1,
      limit: req.query.limit || 20,
      orderBy: req.query.order_by || 'created_at',
      orderDir: req.query.order_dir || 'desc',
    };

    const result = await this.service.listProducts(filters, options);
    res.json(result);
  });

  getWithPriceLists = asyncHandler(async (req, res) => {
    const product = await this.service.getProductWithPriceLists(req.params.id);
    res.json({ data: product });
  });

  getPrice = asyncHandler(async (req, res) => {
    const { customer_tier = 'Bronze', currency = 'USD', quantity = 1, variant_id } = req.query;
    const result = await this.service.getResolvedPrice(
      req.params.id,
      variant_id || null,
      customer_tier,
      currency,
      quantity
    );
    res.json({ data: result });
  });

  // ==================== VARIANTS ====================

  getVariants = asyncHandler(async (req, res) => {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 20, 100),
    };
    const result = await this.service.listVariants(req.params.id, options);
    res.json(result);
  });

  createVariant = asyncHandler(async (req, res) => {
    const variant = await this.service.createVariant(req.params.id, req.body);
    res.status(201).json({ data: variant });
  });

  getVariant = asyncHandler(async (req, res) => {
    const variant = await this.service.getVariant(req.params.variantId);
    res.json({ data: variant });
  });

  updateVariant = asyncHandler(async (req, res) => {
    const variant = await this.service.updateVariant(req.params.variantId, req.body);
    res.json({ data: variant });
  });

  deleteVariant = asyncHandler(async (req, res) => {
    const result = await this.service.deleteVariant(req.params.variantId);
    res.json({ data: result });
  });

  // ==================== PRICE LISTS ====================

  createPriceList = asyncHandler(async (req, res) => {
    const priceList = await this.service.createPriceList(req.body);
    res.status(201).json({ data: priceList });
  });

  getPriceList = asyncHandler(async (req, res) => {
    const priceList = await this.service.getPriceList(req.params.priceListId);
    res.json({ data: priceList });
  });

  updatePriceList = asyncHandler(async (req, res) => {
    const priceList = await this.service.updatePriceList(req.params.priceListId, req.body);
    res.json({ data: priceList });
  });

  deletePriceList = asyncHandler(async (req, res) => {
    const result = await this.service.deletePriceList(req.params.priceListId);
    res.json({ data: result });
  });

  listPriceLists = asyncHandler(async (req, res) => {
    const filters = {
      is_default: req.query.is_default,
      currency: req.query.currency,
      active_only: req.query.active_only,
    };

    const options = {
      page: req.query.page || 1,
      limit: req.query.limit || 20,
      orderBy: req.query.order_by || 'created_at',
      orderDir: req.query.order_dir || 'desc',
    };

    const result = await this.service.listPriceLists(filters, options);
    res.json(result);
  });

  // ==================== PRICE LIST ITEMS ====================

  addPriceListItem = asyncHandler(async (req, res) => {
    const item = await this.service.addPriceListItem({
      ...req.body,
      price_list_id: req.params.priceListId,
    });
    res.status(201).json({ data: item });
  });

  updatePriceListItem = asyncHandler(async (req, res) => {
    const item = await this.service.updatePriceListItem(req.params.itemId, req.body);
    res.json({ data: item });
  });

  deletePriceListItem = asyncHandler(async (req, res) => {
    const result = await this.service.deletePriceListItem(req.params.itemId);
    res.json({ data: result });
  });
}

export default ProductController;