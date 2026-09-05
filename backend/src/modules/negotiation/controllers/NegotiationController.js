import { runNegotiationSchema } from '../validators/negotiationSchemas.js';

export class NegotiationController {
  constructor(negotiationService) {
    this.negotiationService = negotiationService;
  }

  /**
   * POST /api/negotiation/quotations/:quotationId/negotiate
   *
   * Customer-portal-only endpoint.
   * Runs the negotiate() pure function against the given quotation,
   * persists the outcome, and triggers re-approval if risk threshold is crossed.
   *
   * Auth: magic-link session (role=customer), scoped to customer's own quotations.
   */
  runNegotiation = async (req, res, next) => {
    try {
      const { error, value } = runNegotiationSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid negotiation parameters',
            details: error.details.map((d) => ({ field: d.path.join('.'), message: d.message })),
          },
        });
      }

      const reqMeta = {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const result = await this.negotiationService.runNegotiation(
        req.params.quotationId,
        {
          sellerMin: value.seller_min,
          sellerMax: value.seller_max,
          buyerMin: value.buyer_min,
          buyerMax: value.buyer_max,
          stepPercent: value.step_percent,
          maxRounds: value.max_rounds,
          convergenceThreshold: value.convergence_threshold,
          message: value.message,
        },
        req.user,
        reqMeta
      );

      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/negotiation/quotations/:quotationId/history
   *
   * Returns negotiation_logs for this quotation, scoped to the customer.
   */
  getNegotiationHistory = async (req, res, next) => {
    try {
      const result = await this.negotiationService.getNegotiationHistory(
        req.params.quotationId,
        req.user
      );
      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };
}

export default NegotiationController;
