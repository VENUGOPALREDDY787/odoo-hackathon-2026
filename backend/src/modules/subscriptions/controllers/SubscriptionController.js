import { asyncHandler } from '../../../middleware/errorHandler.js';

export class SubscriptionController {
  constructor(subscriptionService) {
    this.service = subscriptionService;
  }

  // ==================== SUBSCRIPTION PLANS ====================

  createPlan = asyncHandler(async (req, res) => {
    const plan = await this.service.createPlan(req.body);
    res.status(201).json({ data: plan });
  });

  listPlans = asyncHandler(async (req, res) => {
    const filters = {
      interval_type: req.query.interval_type,
      is_active: req.query.is_active,
    };
    const options = {
      page: req.query.page || 1,
      limit: req.query.limit || 20,
    };
    const result = await this.service.listPlans(filters, options);
    res.json(result);
  });

  getPlan = asyncHandler(async (req, res) => {
    const plan = await this.service.getPlan(req.params.id);
    res.json({ data: plan });
  });

  updatePlan = asyncHandler(async (req, res) => {
    const plan = await this.service.updatePlan(req.params.id, req.body);
    res.json({ data: plan });
  });

  deletePlan = asyncHandler(async (req, res) => {
    const result = await this.service.deletePlan(req.params.id);
    res.json({ data: result });
  });

  // ==================== BILLING SCHEDULES & CANCELLATIONS ====================

  generateSchedules = asyncHandler(async (req, res) => {
    const quotationId = req.body.quotation_id || req.params.quotationId;
    const startDate = req.body.start_date || new Date();
    const defaultCycles = req.body.default_cycles || 12;

    const schedules = await this.service.generateSchedulesForQuotation(quotationId, startDate, defaultCycles);
    res.json({ data: schedules });
  });

  getLineSchedules = asyncHandler(async (req, res) => {
    const schedules = await this.service.getLineSchedules(req.params.lineId);
    res.json({ data: schedules });
  });

  cancelSubscriptionLine = asyncHandler(async (req, res) => {
    const reqMeta = {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
    const user = req.user || { id: req.body.user_id || 'system-user', role: req.body.role || 'manager' };

    const result = await this.service.cancelRecurringLine(
      {
        quotation_line_id: req.body.quotation_line_id || req.params.lineId,
        cancellation_date: req.body.cancellation_date || new Date(),
        cancellation_reason: req.body.cancellation_reason,
      },
      user,
      reqMeta
    );

    res.json({ data: result });
  });
}

export default SubscriptionController;
