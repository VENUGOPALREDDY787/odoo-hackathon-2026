import { negotiate } from './negotiate.js';
import { recalculateQuotationTotals } from '../../quotations/services/recalculator.js';
import { calculateBlendedRisk, routeApproval } from '../../discounts/services/riskScorer.js';
import { NotFoundError, ValidationError, AuthorizationError } from '../../../errors/AppError.js';

/**
 * NegotiationService
 *
 * Orchestrates the negotiation workflow:
 *  1. Customer isolation enforcement (hard security boundary)
 *  2. Run negotiate() pure function
 *  3. Persist negotiation_logs per round
 *  4. On DEAL: re-evaluate blended risk → auto-resubmit for approval if threshold crossed
 *  5. On FAILED: flag quotation for manual escalation via deal_health_alerts
 *  6. Immutable audit_trails entry for every outcome
 */
export class NegotiationService {
  constructor(db, logger, io = null) {
    this.db = db;
    this.logger = logger;
    this.io = io;
  }

  /**
   * Run a negotiation session for the authenticated customer.
   *
   * SECURITY: Verifies that the quotation belongs to the authenticated customer.
   * Cross-customer access is rejected with 403 — never 404 (to prevent enumeration).
   *
   * @param {string}  quotationId
   * @param {Object}  params              - { sellerMin, sellerMax, buyerMin, buyerMax, stepPercent, maxRounds, convergenceThreshold, message }
   * @param {Object}  customerUser        - req.user (role='customer')
   * @param {Object}  [reqMeta={}]        - { ip, userAgent }
   * @returns {Promise<Object>}
   */
  async runNegotiation(quotationId, params, customerUser, reqMeta = {}) {
    // -------------------------------------------------------------------------
    // 1. SECURITY: Resolve customer record from the JWT user and assert ownership
    // -------------------------------------------------------------------------
    const customer = await this._resolveCustomerForUser(customerUser.id);

    await this._assertOwnsQuotation(quotationId, customer.id);

    // -------------------------------------------------------------------------
    // 2. Load quotation with full line detail for risk re-evaluation
    // -------------------------------------------------------------------------
    const quotation = await this._loadQuotationWithLines(quotationId);

    // Only 'sent' or 'approved' quotations can be negotiated by the customer portal
    const negotiableStatuses = ['sent', 'approved'];
    if (!negotiableStatuses.includes(quotation.status)) {
      throw new ValidationError(
        `Negotiation is only available for quotations in 'sent' or 'approved' status. Current status: '${quotation.status}'.`
      );
    }

    // -------------------------------------------------------------------------
    // 3. Run the pure negotiate() function — no side effects
    // -------------------------------------------------------------------------
    const {
      sellerMin, sellerMax, buyerMin, buyerMax,
      stepPercent = 5, maxRounds = 10, convergenceThreshold = 0.02,
      message = null,
    } = params;

    const negotiationResult = negotiate({
      sellerMin, sellerMax, buyerMin, buyerMax, stepPercent, maxRounds, convergenceThreshold,
    });

    // -------------------------------------------------------------------------
    // 4. Persist everything in a single transaction
    // -------------------------------------------------------------------------
    const trx = await this.db.transaction();
    try {
      const now = new Date();

      // 4a. Create the parent negotiation log entry
      const logPayload = {
        quotation_id: quotationId,
        initiated_by: customerUser.id,
        counterparty_type: 'customer',
        counterparty_id: customer.id,
        status: negotiationResult.result === 'DEAL' ? 'accepted' : 'rejected',
        previous_version: JSON.stringify({
          seller_ask: sellerMax,
          buyer_offer: buyerMin,
          quotation_status: quotation.status,
          grand_total: quotation.grand_total,
        }),
        proposed_version: JSON.stringify({
          seller_min: sellerMin,
          buyer_max: buyerMax,
          negotiation_result: negotiationResult.result,
          final_price: negotiationResult.finalPrice,
          rounds: negotiationResult.totalRounds,
        }),
        message: message,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        resolved_at: now,
        resolved_by: customerUser.id,
        created_at: now,
        updated_at: now,
      };

      await trx('negotiation_logs').insert(logPayload);

      // 4b. Persist per-round detail rows for audit/replay
      for (const round of negotiationResult.rounds) {
        await trx('negotiation_logs').insert({
          quotation_id: quotationId,
          initiated_by: customerUser.id,
          counterparty_type: 'customer',
          counterparty_id: customer.id,
          status: round.status === 'DEAL' || round.status === 'DEAL_CONVERGENCE' ? 'accepted' : 'countered',
          previous_version: JSON.stringify({ seller_offer: round.seller_offer }),
          proposed_version: JSON.stringify({
            buyer_offer: round.buyer_offer,
            gap: round.gap,
            round_status: round.status,
            agreed_price: round.agreed_price,
          }),
          message: `Round ${round.round}: seller=${round.seller_offer}, buyer=${round.buyer_offer}, gap=${round.gap}`,
          created_at: new Date(now.getTime() + round.round * 100), // offset for ordering
          updated_at: now,
        });
      }

      let outcomeDetails;

      if (negotiationResult.result === 'DEAL') {
        outcomeDetails = await this._handleDeal({
          trx, quotation, negotiationResult, customerUser, reqMeta, now,
        });
      } else {
        outcomeDetails = await this._handleFailed({
          trx, quotation, negotiationResult, customerUser, reqMeta, now,
        });
      }

      // 4c. Immutable audit trail entry
      await trx('audit_trails').insert({
        table_name: 'negotiation_logs',
        record_id: quotationId,
        operation: 'INSERT',
        changed_by: customerUser.id,
        changed_by_role: 'customer',
        old_values: JSON.stringify({ status: quotation.status }),
        new_values: JSON.stringify({
          negotiation_result: negotiationResult.result,
          final_price: negotiationResult.finalPrice,
          outcome: outcomeDetails.quotation_new_status,
        }),
        changed_fields: JSON.stringify(['negotiation_result', 'final_price', 'quotation_status']),
        ip_address: reqMeta.ip || null,
        user_agent: reqMeta.userAgent || null,
        created_at: now,
      });

      await trx.commit();

      this.logger.info(
        {
          quotationId,
          customerId: customer.id,
          result: negotiationResult.result,
          finalPrice: negotiationResult.finalPrice,
          rounds: negotiationResult.totalRounds,
          newStatus: outcomeDetails.quotation_new_status,
        },
        'Negotiation session completed'
      );

      const responsePayload = {
        negotiation_result: negotiationResult.result,
        final_price: negotiationResult.finalPrice,
        rounds: negotiationResult.rounds,
        total_rounds: negotiationResult.totalRounds,
        quotation_id: quotationId,
        ...outcomeDetails,
      };

      if (this.io) {
        this.io.to(`quote:${quotationId}`).emit('negotiation:update', {
          quotationId,
          result: responsePayload
        });
      }

      return responsePayload;
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Retrieve negotiation history for a quotation (customer-scoped)
  // ---------------------------------------------------------------------------

  async getNegotiationHistory(quotationId, customerUser) {
    const customer = await this._resolveCustomerForUser(customerUser.id);
    await this._assertOwnsQuotation(quotationId, customer.id);

    const logs = await this.db('negotiation_logs')
      .where({ quotation_id: quotationId, deleted_at: null })
      .orderBy('created_at', 'asc');

    return { quotation_id: quotationId, logs };
  }

  // ---------------------------------------------------------------------------
  // DEAL handler: re-evaluate risk, resubmit for approval if threshold crossed
  // ---------------------------------------------------------------------------

  async _handleDeal({ trx, quotation, negotiationResult, customerUser, reqMeta, now }) {
    const finalPrice = negotiationResult.finalPrice;

    // Calculate the price change ratio to apply to all lines proportionally
    const originalGrandTotal = Number(quotation.grand_total) || 1;
    const priceRatio = finalPrice / originalGrandTotal;

    // Load lines for risk re-evaluation
    const lines = await trx('quotation_lines as ql')
      .leftJoin('products as p', 'ql.product_id', 'p.id')
      .where({ 'ql.quotation_id': quotation.id, 'ql.deleted_at': null })
      .select(
        'ql.*',
        'p.cost_price as product_cost_price',
        'p.category_id as product_category_id'
      );

    // Simulate updated discount percents based on the negotiated price ratio
    const adjustedLines = lines.map((line) => {
      const originalNetUnit = Number(line.net_unit_price || line.list_price || 0);
      const newNetUnit = originalNetUnit * priceRatio;
      const listPrice = Number(line.list_price || 0);
      const newDiscountPct = listPrice > 0 ? Math.max(0, ((listPrice - newNetUnit) / listPrice) * 100) : 0;
      return {
        ...line,
        cost_price: Number(line.product_cost_price || 0),
        discount_percent: newDiscountPct,
        category_id: line.product_category_id,
      };
    });

    // Reload discount tiers and approval chains for risk evaluation
    const [discountTiers, approvalChains] = await Promise.all([
      trx('discount_tiers').where({ is_active: 1 }).whereNull('deleted_at'),
      trx('approval_chains').where({ is_active: 1 }).whereNull('deleted_at'),
    ]);

    const riskResult = calculateBlendedRisk(adjustedLines, discountTiers, quotation.customer_tier || 'Bronze');
    const routing = routeApproval(riskResult.blendedScore, approvalChains);

    // *** KEY REQUIREMENT: if the negotiated price re-crosses the risk threshold,
    //     resubmit for approval instead of auto-confirming ***
    let newStatus;
    let approvalRequired = false;

    if (routing.requires_approval) {
      // Risk threshold crossed → must go back through approval
      newStatus = 'pending_approval';
      approvalRequired = true;
      this.logger.warn(
        { quotationId: quotation.id, blendedScore: riskResult.blendedScore },
        'Negotiated DEAL re-crosses risk threshold — resubmitting for approval'
      );
    } else {
      // Clean deal, no approval needed → auto-accept
      newStatus = 'accepted';
    }

    // Update quotation status + store final negotiated price in metadata
    const updatedMetadata = {
      ...(typeof quotation.metadata === 'string' ? JSON.parse(quotation.metadata || '{}') : (quotation.metadata || {})),
      negotiated_final_price: finalPrice,
      negotiated_at: now.toISOString(),
      negotiated_by_customer_id: customerUser.id,
      pre_negotiation_total: originalGrandTotal,
    };

    await trx('quotations').where({ id: quotation.id }).update({
      status: newStatus,
      metadata: JSON.stringify(updatedMetadata),
      blended_risk_score: riskResult.blendedScore,
      updated_at: now,
      ...(newStatus === 'accepted' ? { approved_at: now } : {}),
    });

    return {
      quotation_new_status: newStatus,
      approval_required: approvalRequired,
      blended_risk_score: riskResult.blendedScore,
      routing: routing.requires_approval ? routing : null,
      message: approvalRequired
        ? `Negotiated price accepted but re-crosses the blended risk threshold (score: ${riskResult.blendedScore}). Resubmitted for approval.`
        : `Deal accepted at ${finalPrice}. Quotation confirmed.`,
    };
  }

  // ---------------------------------------------------------------------------
  // FAILED handler: flag for manual escalation
  // ---------------------------------------------------------------------------

  async _handleFailed({ trx, quotation, negotiationResult, customerUser, reqMeta, now }) {
    // Flag as needing manual escalation — do NOT silently leave it stuck
    await trx('deal_health_alerts').insert({
      quotation_id: quotation.id,
      alert_type: 'negotiation_failed',
      severity: 'high',
      title: 'Negotiation Failed — Manual Escalation Required',
      description: negotiationResult.reason ||
        `Automated negotiation exhausted ${negotiationResult.totalRounds} rounds without convergence. ` +
        `Final gap: seller=${negotiationResult.finalSellerOffer}, buyer=${negotiationResult.finalBuyerOffer}.`,
      metric_name: 'negotiation_rounds',
      metric_value: negotiationResult.totalRounds,
      threshold_value: null,
      is_acknowledged: 0,
      metadata: JSON.stringify({
        final_seller_offer: negotiationResult.finalSellerOffer,
        final_buyer_offer: negotiationResult.finalBuyerOffer,
        customer_user_id: customerUser.id,
        reason: negotiationResult.reason,
      }),
      created_at: now,
    });

    // Keep the quotation in its current status (don't auto-reject)
    // so the rep can manually intervene
    this.logger.warn(
      { quotationId: quotation.id, reason: negotiationResult.reason },
      'Negotiation FAILED — deal_health_alert raised for manual escalation'
    );

    return {
      quotation_new_status: quotation.status, // unchanged
      approval_required: false,
      blended_risk_score: null,
      routing: null,
      message: `Negotiation failed to converge. A manual escalation alert has been raised for your account rep.`,
      escalation_raised: true,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Resolve the customers record for a given user id.
   * Throws 403 if the user has no associated customer record (should never happen
   * if requireCustomer() middleware is in place, but defence-in-depth).
   */
  async _resolveCustomerForUser(userId) {
    const customer = await this.db('customers')
      .where({ user_id: userId, deleted_at: null })
      .first();

    if (!customer) {
      throw new AuthorizationError('No customer profile associated with this account.');
    }
    return customer;
  }

  /**
   * Assert that the quotation belongs to the resolved customer.
   * Returns 403 — never 404 — to prevent quotation ID enumeration.
   *
   * This is the hard security boundary: a customer token for quotation A
   * cannot touch quotation B.
   */
  async _assertOwnsQuotation(quotationId, customerId) {
    const quotation = await this.db('quotations')
      .where({ id: quotationId, deleted_at: null })
      .select('id', 'customer_id', 'status')
      .first();

    if (!quotation) {
      // Do NOT reveal whether the quotation exists — return 403 not 404
      throw new AuthorizationError(
        'You are not authorized to negotiate this quotation.'
      );
    }

    if (quotation.customer_id !== customerId) {
      // Cross-customer access attempt — return 403, not 404
      this.logger.warn(
        { attemptedQuotationId: quotationId, requestingCustomerId: customerId, ownerCustomerId: quotation.customer_id },
        'SECURITY: Cross-customer quotation access attempt blocked'
      );
      throw new AuthorizationError(
        'You are not authorized to negotiate this quotation.'
      );
    }
  }

  async _loadQuotationWithLines(quotationId) {
    const quotation = await this.db('quotations as q')
      .join('customers as c', 'q.customer_id', 'c.id')
      .where({ 'q.id': quotationId, 'q.deleted_at': null })
      .select('q.*', 'c.tier as customer_tier')
      .first();

    if (!quotation) throw new NotFoundError('Quotation');

    const lines = await this.db('quotation_lines as ql')
      .leftJoin('products as p', 'ql.product_id', 'p.id')
      .where({ 'ql.quotation_id': quotationId, 'ql.deleted_at': null })
      .select('ql.*', 'p.cost_price as product_cost_price', 'p.category_id as product_category_id');

    return { ...quotation, lines };
  }
}

export default NegotiationService;
