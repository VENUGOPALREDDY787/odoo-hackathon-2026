import { NotFoundError, ValidationError, ConflictError } from '../../../errors/AppError.js';
import {
  SubscriptionPlanRepository,
  BillingScheduleRepository,
} from '../repositories/SubscriptionRepository.js';
import { AuditTrailRepository } from '../../discounts/repositories/DiscountRepository.js';
import { calculateProration } from './prorationCalculator.js';
import { generateBillingSchedules } from './scheduleGenerator.js';

export class SubscriptionService {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger || { info: () => {}, warn: () => {}, error: () => {} };
    this.planRepo = new SubscriptionPlanRepository(db);
    this.scheduleRepo = new BillingScheduleRepository(db);
    this.auditTrailRepo = new AuditTrailRepository(db);
  }

  // ==================== SUBSCRIPTION PLANS CRUD ====================

  async createPlan(data) {
    const payload = {
      ...data,
      features: typeof data.features === 'object' ? JSON.stringify(data.features) : data.features,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const [id] = await this.db('subscription_plans').insert(payload).returning('id');
    const createdId = typeof id === 'object' ? id.id : id;
    const plan = await this.planRepo.findById(createdId || data.id);

    this.logger.info({ planId: plan?.id }, 'Subscription plan created');
    return plan;
  }

  async getPlan(id) {
    const plan = await this.planRepo.findById(id);
    if (!plan) throw new NotFoundError('Subscription plan');
    return plan;
  }

  async updatePlan(id, data) {
    await this.getPlan(id);
    const updatePayload = { ...data, updated_at: new Date() };
    if (data.features && typeof data.features === 'object') {
      updatePayload.features = JSON.stringify(data.features);
    }

    await this.db('subscription_plans').where({ id, deleted_at: null }).update(updatePayload);
    return this.planRepo.findById(id);
  }

  async deletePlan(id) {
    await this.getPlan(id);
    await this.planRepo.softDelete(id);
    return { success: true };
  }

  async listPlans(filters = {}, options = {}) {
    return this.planRepo.listWithFilters(filters, options);
  }

  // ==================== BILLING SCHEDULE GENERATOR ====================

  async generateSchedulesForQuotation(quotationId, startDate = new Date(), defaultCycles = 12) {
    const quotation = await this.db('quotations').where({ id: quotationId, deleted_at: null }).first();
    if (!quotation) throw new NotFoundError('Quotation');

    const lines = await this.db('quotation_lines as ql')
      .leftJoin('subscription_plans as sp', 'ql.subscription_plan_id', 'sp.id')
      .where({ 'ql.quotation_id': quotationId, 'ql.deleted_at': null })
      .select('ql.*', 'sp.interval_type as sp_interval_type', 'sp.interval_count as sp_interval_count');

    const formattedLines = lines.map(l => ({
      ...l,
      interval_type: l.sp_interval_type || 'monthly',
      interval_count: l.sp_interval_count || 1,
    }));

    const schedules = generateBillingSchedules({
      quotation,
      lines: formattedLines,
      startDate,
      defaultCycles,
    });

    // Save generated schedules to database
    if (schedules.length > 0) {
      await this.db.transaction(async (trx) => {
        const lineIds = lines.map(l => l.id);
        await trx('billing_schedules').whereIn('quotation_line_id', lineIds).where({ status: 'pending' }).update({ deleted_at: new Date() });
        await trx('billing_schedules').insert(schedules);
      });
    }

    this.logger.info({ quotationId, count: schedules.length }, 'Billing schedules generated');
    return schedules;
  }

  async getLineSchedules(quotationLineId) {
    return this.scheduleRepo.findByQuotationLine(quotationLineId);
  }

  // ==================== CANCELLATION FLOW & CREDIT NOTE GENERATION ====================

  /**
   * Cancels a recurring quotation line mid-cycle.
   * Calculates integer-cents proration for unused days remaining in current cycle,
   * generates a credit_note billing_schedules row, cancels future cycles, and logs to audit_trails.
   */
  async cancelRecurringLine({ quotation_line_id, cancellation_date = new Date(), cancellation_reason }, user = null, reqMeta = {}) {
    const cancelDate = new Date(cancellation_date);
    const cancelDateStr = cancelDate.toISOString().split('T')[0];

    const trx = await this.db.transaction();
    try {
      const line = await trx('quotation_lines as ql')
        .leftJoin('products as p', 'ql.product_id', 'p.id')
        .leftJoin('subscription_plans as sp', 'ql.subscription_plan_id', 'sp.id')
        .where({ 'ql.id': quotation_line_id, 'ql.deleted_at': null })
        .select('ql.*', 'p.base_price', 'sp.interval_type', 'sp.interval_count')
        .first();

      if (!line) throw new NotFoundError('Quotation line');
      if (line.line_type !== 'recurring') {
        throw new ValidationError('Only recurring subscription lines can be cancelled with prorated credit notes');
      }

      // Find current active billing cycle row covering cancellation date
      let activeCycle = await this.scheduleRepo.findActiveCycle(quotation_line_id, cancelDateStr, trx);

      let totalDaysInCycle = 30;
      let daysRemainingInCycle = 15;
      let unitPrice = Number(line.net_unit_price || line.list_price || 0);

      if (activeCycle) {
        const periodStart = new Date(activeCycle.period_start);
        const periodEnd = new Date(activeCycle.period_end);

        totalDaysInCycle = Math.max(1, Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24)) + 1);
        daysRemainingInCycle = Math.max(0, Math.ceil((periodEnd - cancelDate) / (1000 * 60 * 60 * 24)));
        unitPrice = Number(activeCycle.amount || unitPrice);
      }

      // 1. Calculate integer-cents proration (newQty = 0 for cancellation)
      const proration = calculateProration(
        Number(line.quantity || 1),
        0,
        unitPrice,
        daysRemainingInCycle,
        totalDaysInCycle
      );

      // 2. Insert credit_note billing_schedules row
      let creditNoteId = null;
      if (proration.is_credit_note && Math.abs(proration.prorated_amount) > 0) {
        const creditPayload = {
          quotation_line_id,
          customer_id: line.customer_id || activeCycle?.customer_id || 'system-customer',
          subscription_plan_id: line.subscription_plan_id || null,
          cycle_number: activeCycle ? activeCycle.cycle_number : 1,
          period_start: cancelDateStr,
          period_end: activeCycle ? activeCycle.period_end : cancelDateStr,
          amount: proration.prorated_amount, // Negative dollar credit amount
          currency: activeCycle?.currency || 'USD',
          status: 'credit_note',
          due_date: cancelDateStr,
          notes: `Credit Note for mid-cycle cancellation: ${cancellation_reason}`,
          proration_details: JSON.stringify(proration),
          created_at: new Date(),
          updated_at: new Date(),
        };

        const [id] = await trx('billing_schedules').insert(creditPayload).returning('id');
        creditNoteId = typeof id === 'object' ? id.id : id;
      }

      // 3. Cancel future pending billing cycles for this line
      const cancelledFutureCount = await this.scheduleRepo.cancelFutureCycles(quotation_line_id, cancelDateStr, trx);

      // 4. Update quotation line status / metadata
      await trx('quotation_lines')
        .where({ id: quotation_line_id })
        .update({
          deleted_at: new Date(),
          updated_at: new Date(),
        });

      // 5. Write immutable audit trail entry detailing cancellation and credit note
      await this.auditTrailRepo.logChange({
        tableName: 'billing_schedules',
        recordId: quotation_line_id,
        operation: 'UPDATE',
        changedBy: user?.id || null,
        changedByRole: user?.role || null,
        oldValues: { status: 'active', line_id: quotation_line_id },
        newValues: {
          status: 'cancelled',
          credit_note_id: creditNoteId,
          prorated_credit: proration.prorated_amount,
          cancelled_future_cycles: cancelledFutureCount,
          reason: cancellation_reason,
        },
        changedFields: ['status', 'credit_note', 'cancellation_reason'],
        ipAddress: reqMeta.ip || null,
        userAgent: reqMeta.userAgent || null,
      });

      await trx.commit();

      this.logger.info(
        { quotation_line_id, creditNoteId, proratedAmount: proration.prorated_amount },
        'Subscription line cancelled mid-cycle with prorated credit note'
      );

      return {
        quotation_line_id,
        cancelled_at: cancelDateStr,
        cancellation_reason,
        proration,
        credit_note_created: creditNoteId !== null,
        credit_note_id: creditNoteId,
        cancelled_future_cycles: cancelledFutureCount,
      };
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }
}

export default SubscriptionService;
