import { asyncHandler } from '../../../middleware/errorHandler.js';

export class QuotationController {
  constructor(quotationService) {
    this.service = quotationService;
  }

  create = asyncHandler(async (req, res) => {
    const user = req.user || { id: req.body.assigned_rep_id || 'system-user', role: 'rep' };
    const quotation = await this.service.createQuotation(req.body, user);
    res.status(201).json({ data: quotation });
  });

  getById = asyncHandler(async (req, res) => {
    const quotation = await this.service.getQuotation(req.params.id);
    res.json({ data: quotation });
  });

  list = asyncHandler(async (req, res) => {
    const filters = {
      customer_id: req.query.customer_id,
      assigned_rep_id: req.query.assigned_rep_id,
      status: req.query.status,
    };
    if (req.user?.role === 'rep') { filters.assigned_rep_id = req.user.id; }
    if (req.user?.role === 'customer') {
      // Scope to every customer record owned by this user (an account can be
      // linked to more than one row). With no owned rows, fall back to a
      // sentinel id that matches nothing so an empty scope stays empty.
      const owned = await this.service.db('customers').where({ user_id: req.user.id, deleted_at: null }).select('id');
      filters.customer_ids = owned.length ? owned.map((row) => row.id) : ['00000000-0000-0000-0000-000000000000'];
    }
    const options = {
      page: req.query.page || 1,
      limit: req.query.limit || 20,
      orderBy: req.query.order_by || 'created_at',
      orderDir: req.query.order_dir || 'desc',
    };
    const result = await this.service.listQuotations(filters, options);
    res.json(result);
  });

  addLine = asyncHandler(async (req, res) => {
    const reqMeta = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const expectedVersion = req.body.expected_version !== undefined
      ? Number(req.body.expected_version)
      : req.headers['if-match']
      ? Number(req.headers['if-match'])
      : null;

    const result = await this.service.addLine(req.params.id, req.body, expectedVersion, req.user, reqMeta);
    res.status(201).json({ data: result });
  });

  updateLine = asyncHandler(async (req, res) => {
    const reqMeta = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const expectedVersion = req.body.expected_version !== undefined
      ? Number(req.body.expected_version)
      : req.headers['if-match']
      ? Number(req.headers['if-match'])
      : null;

    const result = await this.service.updateLine(req.params.id, req.params.lineId, req.body, expectedVersion, req.user, reqMeta);
    res.json({ data: result });
  });

  removeLine = asyncHandler(async (req, res) => {
    const reqMeta = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const expectedVersion = req.query.expected_version !== undefined
      ? Number(req.query.expected_version)
      : req.headers['if-match']
      ? Number(req.headers['if-match'])
      : null;

    const result = await this.service.removeLine(req.params.id, req.params.lineId, expectedVersion, req.user, reqMeta);
    res.json({ data: result });
  });

  submitForApproval = asyncHandler(async (req, res) => {
    const reqMeta = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const user = req.user || { id: 'system-user', role: 'rep' };
    const idempotencyKey = req.headers['x-idempotency-key'] || req.body?.idempotency_key || null;
    const expectedVersion = req.body?.expected_version !== undefined
      ? Number(req.body.expected_version)
      : req.headers['if-match']
      ? Number(req.headers['if-match'])
      : null;

    const result = await this.service.submitForApproval(req.params.id, user, idempotencyKey, expectedVersion, reqMeta);
    res.json({ data: result });
  });

  accept = asyncHandler(async (req, res) => {
    const quotation = await this.service.acceptQuotation(req.params.id, req.user);
    res.json({ data: quotation });
  });
}

export default QuotationController;
