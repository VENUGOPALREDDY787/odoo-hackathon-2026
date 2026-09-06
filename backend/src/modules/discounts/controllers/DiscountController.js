import { asyncHandler } from '../../../middleware/errorHandler.js';

export class DiscountController {
  constructor(discountService) {
    this.service = discountService;
  }

  // ==================== DISCOUNT TIERS ====================

  createDiscountTier = asyncHandler(async (req, res) => {
    const reqMeta = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const tier = await this.service.createDiscountTier(req.body, req.user, reqMeta);
    res.status(201).json({ data: tier });
  });

  listDiscountTiers = asyncHandler(async (req, res) => {
    const filters = {
      customer_tier: req.query.customer_tier,
      category_id: req.query.category_id,
      product_id: req.query.product_id,
      is_active: req.query.is_active,
    };
    const options = {
      page: req.query.page || 1,
      limit: req.query.limit || 20,
    };
    const result = await this.service.listDiscountTiers(filters, options);
    res.json(result);
  });

  getDiscountTier = asyncHandler(async (req, res) => {
    const tier = await this.service.getDiscountTier(req.params.id);
    res.json({ data: tier });
  });

  updateDiscountTier = asyncHandler(async (req, res) => {
    const reqMeta = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const tier = await this.service.updateDiscountTier(req.params.id, req.body, req.user, reqMeta);
    res.json({ data: tier });
  });

  deleteDiscountTier = asyncHandler(async (req, res) => {
    const reqMeta = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const result = await this.service.deleteDiscountTier(req.params.id, req.user, reqMeta);
    res.json({ data: result });
  });

  // ==================== APPROVAL CHAINS ====================

  createApprovalChain = asyncHandler(async (req, res) => {
    const reqMeta = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const chain = await this.service.createApprovalChain(req.body, req.user, reqMeta);
    res.status(201).json({ data: chain });
  });

  listApprovalChains = asyncHandler(async (req, res) => {
    const filters = {
      is_active: req.query.is_active,
    };
    const options = {
      page: req.query.page || 1,
      limit: req.query.limit || 20,
    };
    const result = await this.service.listApprovalChains(filters, options);
    res.json(result);
  });

  getApprovalChain = asyncHandler(async (req, res) => {
    const chain = await this.service.getApprovalChain(req.params.id);
    res.json({ data: chain });
  });

  updateApprovalChain = asyncHandler(async (req, res) => {
    const reqMeta = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const chain = await this.service.updateApprovalChain(req.params.id, req.body, req.user, reqMeta);
    res.json({ data: chain });
  });

  deleteApprovalChain = asyncHandler(async (req, res) => {
    const reqMeta = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const result = await this.service.deleteApprovalChain(req.params.id, req.user, reqMeta);
    res.json({ data: result });
  });

  // ==================== RISK EVALUATION & APPROVALS ====================

  evaluateLinesRisk = asyncHandler(async (req, res) => {
    const result = await this.service.evaluateLinesRisk({
      customerTier: req.body.customer_tier,
      lines: req.body.lines,
    });
    res.json({ data: result });
  });

  evaluateQuotationRisk = asyncHandler(async (req, res) => {
    const reqMeta = {
      user: req.user,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
    const result = await this.service.evaluateQuotationRisk(req.params.quotationId, reqMeta);
    res.json({ data: result });
  });

  processApprovalDecision = asyncHandler(async (req, res) => {
    const reqMeta = {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
    const user = req.user || { id: req.body.user_id || 'system-user', role: req.body.role || 'manager' };
    const result = await this.service.processApprovalAction({
      quotationId: req.params.quotationId || req.params.id,
      action: req.body.action,
      user,
      comments: req.body.comments,
      expectedVersion: req.body.expected_version,
      reqMeta,
    });
    res.json({ data: result });
  });

  handleApprovalAction = asyncHandler(async (req, res) => {
    const reqMeta = {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
    const user = req.user || { id: req.body.user_id || 'system-user', role: req.body.role || 'manager' };
    const result = await this.service.processApprovalAction({
      quotationId: req.params.quotationId || req.params.id,
      action: req.body.action,
      user,
      comments: req.body.comments,
      expectedVersion: req.body.expected_version,
      reqMeta,
    });
    res.json({ data: result });
  });

  getApprovalLogs = asyncHandler(async (req, res) => {
    const logs = await this.service.getApprovalLogs(req.params.quotationId || req.params.id);
    res.json({ data: logs });
  });
}

export default DiscountController;
