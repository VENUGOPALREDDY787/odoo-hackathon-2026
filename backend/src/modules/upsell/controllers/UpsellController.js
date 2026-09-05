import { validate } from '../../../middleware/validate.js';
import {
  createUpsellRuleSchema,
  updateUpsellRuleSchema,
  getSuggestionsQuerySchema,
  listRulesQuerySchema,
} from '../validators/upsellSchemas.js';

export class UpsellController {
  constructor(upsellService) {
    this.upsellService = upsellService;
  }

  // ---------------------------------------------------------------------------
  // READ-ONLY: Upsell suggestions for a quotation
  // ---------------------------------------------------------------------------

  /**
   * GET /api/upsell/quotations/:quotationId/suggestions
   *
   * Returns ranked upsell suggestions for the given quotation.
   * This endpoint is READ-ONLY and has zero side effects.
   * "Dismiss" requires no backend action at all.
   * "Add to Quote" must POST to /api/quotations/:id/lines.
   */
  getSuggestions = async (req, res, next) => {
    try {
      const { error, value } = getSuggestionsQuerySchema.validate(req.query, { abortEarly: false });
      if (error) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: error.details },
        });
      }

      const result = await this.upsellService.getSuggestionsForQuotation(
        req.params.quotationId,
        { minMarginPercent: value.min_margin_percent, limit: value.limit }
      );

      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  // ---------------------------------------------------------------------------
  // CRUD: Upsell rule management (admin/ops)
  // ---------------------------------------------------------------------------

  listRules = async (req, res, next) => {
    try {
      const { error, value } = listRulesQuerySchema.validate(req.query, { abortEarly: false });
      if (error) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: error.details },
        });
      }

      const { page, limit, order_by, order_dir, ...filters } = value;
      const result = await this.upsellService.listRules(filters, {
        page, limit, orderBy: order_by, orderDir: order_dir,
      });

      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  getRuleById = async (req, res, next) => {
    try {
      const rule = await this.upsellService.getRuleById(req.params.id);
      return res.json({ success: true, data: rule });
    } catch (err) {
      next(err);
    }
  };

  createRule = async (req, res, next) => {
    try {
      const { error, value } = createUpsellRuleSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: error.details },
        });
      }
      const rule = await this.upsellService.createRule(value);
      return res.status(201).json({ success: true, data: rule });
    } catch (err) {
      next(err);
    }
  };

  updateRule = async (req, res, next) => {
    try {
      const { error, value } = updateUpsellRuleSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: error.details },
        });
      }
      const rule = await this.upsellService.updateRule(req.params.id, value);
      return res.json({ success: true, data: rule });
    } catch (err) {
      next(err);
    }
  };

  deleteRule = async (req, res, next) => {
    try {
      const result = await this.upsellService.deleteRule(req.params.id);
      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };
}

export default UpsellController;
