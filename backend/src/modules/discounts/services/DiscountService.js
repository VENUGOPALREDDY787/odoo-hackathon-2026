import { NotFoundError, ValidationError, AuthorizationError, ConflictError } from '../../../errors/AppError.js';
import {
  DiscountTierRepository,
  ApprovalChainRepository,
  ApprovalLogRepository,
  AuditTrailRepository,
  DealHealthAlertRepository,
} from '../repositories/DiscountRepository.js';
import { calculateBlendedRisk, routeApproval } from './riskScorer.js';
import { validateApprovalTransition, APPROVAL_ACTIONS } from './approvalStateMachine.js';

export class DiscountService {
  constructor(db, logger, cache) {
    this.db = db;
    this.logger = logger || { info: () => {}, warn: () => {}, error: () => {} };
    this.cache = cache;
    this.discountTierRepo = new DiscountTierRepository(db);
    this.approvalChainRepo = new ApprovalChainRepository(db);
    this.approvalLogRepo = new ApprovalLogRepository(db);
    this.auditTrailRepo = new AuditTrailRepository(db);
    this.dealHealthAlertRepo = new DealHealthAlertRepository(db);
  }

  // ==================== DISCOUNT TIERS CRUD ====================

  async createDiscountTier(data, user = null, reqMeta = {}) {
    const payload = {
      ...data,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const [id] = await this.db('discount_tiers').insert(payload).returning('id');
    const createdId = typeof id === 'object' ? id.id : id;
    const tier = await this.discountTierRepo.findById(createdId || data.id);

    // Role-attributed audit entry: discount policy created
    await this.auditTrailRepo.logChange({
      tableName: 'discount_tiers',
      recordId: createdId || data.id,
      operation: 'INSERT',
      changedBy: user?.id || null,
      changedByRole: user?.role || null,
      oldValues: null,
      newValues: { customer_tier: data.customer_tier, discount_percent: data.discount_percent, is_active: data.is_active },
      changedFields: ['customer_tier', 'discount_percent'],
      ipAddress: reqMeta?.ip || null,
      userAgent: reqMeta?.userAgent || null,
    });

    this.logger.info({ discountTierId: tier?.id }, 'Discount tier created');
    if (this.cache) await this.cache.delPattern('discounts:tiers:*');
    return tier || { id: createdId, ...data };
  }

  async getDiscountTier(id) {
    const tier = await this.discountTierRepo.findById(id);
    if (!tier) {
      throw new NotFoundError('Discount tier');
    }
    return tier;
  }

  async updateDiscountTier(id, data, user = null, reqMeta = {}) {
    const existingTier = await this.getDiscountTier(id);
    await this.db('discount_tiers')
      .where({ id, deleted_at: null })
      .update({ ...data, updated_at: new Date() });

    // Role-attributed audit entry: ceiling change recorded with old → new values
    await this.auditTrailRepo.logChange({
      tableName: 'discount_tiers',
      recordId: id,
      operation: 'UPDATE',
      changedBy: user?.id || null,
      changedByRole: user?.role || null,
      oldValues: { discount_percent: existingTier.discount_percent, is_active: existingTier.is_active },
      newValues: {
        discount_percent: data.discount_percent !== undefined ? data.discount_percent : existingTier.discount_percent,
        is_active: data.is_active !== undefined ? data.is_active : existingTier.is_active,
      },
      changedFields: Object.keys(data).filter((key) => key !== 'updated_at'),
      ipAddress: reqMeta?.ip || null,
      userAgent: reqMeta?.userAgent || null,
    });

    if (this.cache) await this.cache.delPattern('discounts:tiers:*');
    return this.discountTierRepo.findById(id);
  }

  async deleteDiscountTier(id, user = null, reqMeta = {}) {
    const existingTier = await this.getDiscountTier(id);
    await this.discountTierRepo.softDelete(id);
    // Role-attributed audit entry: policy rule removed
    await this.auditTrailRepo.logChange({
      tableName: 'discount_tiers',
      recordId: id,
      operation: 'DELETE',
      changedBy: user?.id || null,
      changedByRole: user?.role || null,
      oldValues: { discount_percent: existingTier.discount_percent, customer_tier: existingTier.customer_tier },
      newValues: { deleted_at: new Date().toISOString() },
      changedFields: ['deleted_at'],
      ipAddress: reqMeta?.ip || null,
      userAgent: reqMeta?.userAgent || null,
    });
    if (this.cache) await this.cache.delPattern('discounts:tiers:*');
    return { success: true };
  }

  async listDiscountTiers(filters = {}, options = {}) {
    return this.discountTierRepo.listWithFilters(filters, options);
  }

  // ==================== APPROVAL CHAINS CRUD ====================

  async createApprovalChain(data, user = null, reqMeta = {}) {
    const payload = {
      ...data,
      required_approver_roles: Array.isArray(data.required_approver_roles)
        ? JSON.stringify(data.required_approver_roles)
        : data.required_approver_roles,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const [id] = await this.db('approval_chains').insert(payload).returning('id');
    const createdId = typeof id === 'object' ? id.id : id;
    const chain = await this.approvalChainRepo.findById(createdId || data.id);

    // Role-attributed audit entry: approval chain created
    await this.auditTrailRepo.logChange({
      tableName: 'approval_chains',
      recordId: createdId || data.id,
      operation: 'INSERT',
      changedBy: user?.id || null,
      changedByRole: user?.role || null,
      oldValues: null,
      newValues: { min_discount_percent: data.min_discount_percent, max_discount_percent: data.max_discount_percent, is_active: data.is_active },
      changedFields: ['min_discount_percent', 'max_discount_percent'],
      ipAddress: reqMeta?.ip || null,
      userAgent: reqMeta?.userAgent || null,
    });

    this.logger.info({ approvalChainId: chain?.id }, 'Approval chain created');
    if (this.cache) await this.cache.delPattern('discounts:chains:*');
    return chain || { id: createdId, ...data };
  }

  async getApprovalChain(id) {
    const chain = await this.approvalChainRepo.findById(id);
    if (!chain) {
      throw new NotFoundError('Approval chain');
    }
    return chain;
  }

  async updateApprovalChain(id, data, user = null, reqMeta = {}) {
    const existingChain = await this.getApprovalChain(id);
    const updatePayload = { ...data, updated_at: new Date() };
    if (Array.isArray(data.required_approver_roles)) {
      updatePayload.required_approver_roles = JSON.stringify(data.required_approver_roles);
    }

    await this.db('approval_chains')
      .where({ id, deleted_at: null })
      .update(updatePayload);

    // Role-attributed audit entry: sign-off threshold change recorded
    await this.auditTrailRepo.logChange({
      tableName: 'approval_chains',
      recordId: id,
      operation: 'UPDATE',
      changedBy: user?.id || null,
      changedByRole: user?.role || null,
      oldValues: { min_discount_percent: existingChain.min_discount_percent, max_discount_percent: existingChain.max_discount_percent, is_active: existingChain.is_active },
      newValues: {
        min_discount_percent: data.min_discount_percent !== undefined ? data.min_discount_percent : existingChain.min_discount_percent,
        max_discount_percent: data.max_discount_percent !== undefined ? data.max_discount_percent : existingChain.max_discount_percent,
        is_active: data.is_active !== undefined ? data.is_active : existingChain.is_active,
      },
      changedFields: Object.keys(data).filter((key) => key !== 'updated_at'),
      ipAddress: reqMeta?.ip || null,
      userAgent: reqMeta?.userAgent || null,
    });

    if (this.cache) await this.cache.delPattern('discounts:chains:*');
    return this.approvalChainRepo.findById(id);
  }

  async deleteApprovalChain(id, user = null, reqMeta = {}) {
    const existingChain = await this.getApprovalChain(id);
    await this.approvalChainRepo.softDelete(id);
    // Role-attributed audit entry: approval chain removed
    await this.auditTrailRepo.logChange({
      tableName: 'approval_chains',
      recordId: id,
      operation: 'DELETE',
      changedBy: user?.id || null,
      changedByRole: user?.role || null,
      oldValues: { min_discount_percent: existingChain.min_discount_percent, max_discount_percent: existingChain.max_discount_percent },
      newValues: { deleted_at: new Date().toISOString() },
      changedFields: ['deleted_at'],
      ipAddress: reqMeta?.ip || null,
      userAgent: reqMeta?.userAgent || null,
    });
    if (this.cache) await this.cache.delPattern('discounts:chains:*');
    return { success: true };
  }

  async listApprovalChains(filters = {}, options = {}) {
    return this.approvalChainRepo.listWithFilters(filters, options);
  }

  // ==================== RISK EVALUATION & WORKFLOW ====================

  async evaluateLinesRisk({ customerTier = 'Bronze', lines = [] }) {
    const activeDiscountTiers = await this.discountTierRepo.findActiveTiers(customerTier);
    const activeApprovalChains = await this.approvalChainRepo.findActiveChains();

    const riskResult = calculateBlendedRisk(lines, activeDiscountTiers, customerTier);
    const routingResult = routeApproval(riskResult.blendedScore, activeApprovalChains);

    return {
      ...riskResult,
      routing: routingResult,
    };
  }

  async evaluateQuotationRisk(quotationId, reqMeta = {}) {
    const quotation = await this.db('quotations as q')
      .join('customers as c', 'q.customer_id', 'c.id')
      .where({ 'q.id': quotationId, 'q.deleted_at': null })
      .select('q.*', 'c.tier as customer_tier')
      .first();

    if (!quotation) {
      throw new NotFoundError('Quotation');
    }

    const lines = await this.db('quotation_lines as ql')
      .leftJoin('products as p', 'ql.product_id', 'p.id')
      .where({ 'ql.quotation_id': quotationId, 'ql.deleted_at': null })
      .select('ql.*', 'p.category_id as product_category_id');

    const customerTier = quotation.customer_tier || 'Bronze';
    const activeDiscountTiers = await this.discountTierRepo.findActiveTiers(customerTier);
    const activeApprovalChains = await this.approvalChainRepo.findActiveChains();

    const risk = calculateBlendedRisk(lines, activeDiscountTiers, customerTier);
    const routing = routeApproval(risk.blendedScore, activeApprovalChains);

    const oldStatus = quotation.status;
    const oldScore = quotation.blended_risk_score;
    const newStatus = routing.requires_approval ? 'pending_approval' : 'approved';

    // Update quotation status & score
    await this.db('quotations')
      .where({ id: quotationId })
      .update({
        blended_risk_score: risk.blendedScore,
        status: newStatus,
        updated_at: new Date(),
      });

    // Write immutable audit trail
    await this.auditTrailRepo.logChange({
      tableName: 'quotations',
      recordId: quotationId,
      operation: 'UPDATE',
      changedBy: reqMeta.user?.id || null,
      changedByRole: reqMeta.user?.role || null,
      oldValues: { status: oldStatus, blended_risk_score: oldScore },
      newValues: { status: newStatus, blended_risk_score: risk.blendedScore, routing },
      changedFields: ['status', 'blended_risk_score'],
      ipAddress: reqMeta.ip || null,
      userAgent: reqMeta.userAgent || null,
    });

    this.logger.info(
      { quotationId, blendedScore: risk.blendedScore, status: newStatus },
      'Quotation risk evaluated & status updated'
    );

    return {
      quotation_id: quotationId,
      blended_risk_score: risk.blendedScore,
      max_single_violation: risk.maxSingleViolation,
      requires_approval: routing.requires_approval,
      status: newStatus,
      line_breakdown: risk.lineDetails,
      routing,
    };
  }

  // ==================== STATE MACHINE APPROVAL ACTIONS ====================

  async processApprovalAction({ quotationId, action, user, comments, expectedVersion = null, reqMeta = {} }) {
    const trx = await this.db.transaction();
    try {
      const quotation = await trx('quotations as q')
        .join('customers as c', 'q.customer_id', 'c.id')
        .where({ 'q.id': quotationId, 'q.deleted_at': null })
        .select('q.*', 'c.tier as customer_tier')
        .first();

      if (!quotation) {
        throw new NotFoundError('Quotation');
      }

      // Optimistic locking check
      if (expectedVersion !== null && expectedVersion !== undefined) {
        if (quotation.version !== expectedVersion) {
          throw new ConflictError(
            `Quotation version mismatch. Current version is ${quotation.version}, expected ${expectedVersion}.`,
            { currentVersion: quotation.version, expectedVersion }
          );
        }
      }

      // Get active approval chains and evaluate risk routing
      const activeApprovalChains = await this.approvalChainRepo.findActiveChains();
      const routing = routeApproval(quotation.blended_risk_score || 0, activeApprovalChains);

      // Get existing approval logs for multi-step progress tracking
      const existingLogs = await trx('approval_logs')
        .where({ quotation_id: quotationId, deleted_at: null })
        .orderBy('created_at', 'asc');

      // Validate transition against state machine rules
      const transition = validateApprovalTransition({
        currentStatus: quotation.status,
        action,
        user,
        routingRequirements: routing,
        existingApprovalLogs: existingLogs,
      });

      const oldStatus = quotation.status;
      const newStatus = transition.targetStatus;
      const now = new Date();

      const updatePayload = {
        status: newStatus,
        version: this.db.raw('version + 1'),
        updated_at: now,
      };

      if (newStatus === 'approved') {
        updatePayload.approved_at = now;
        updatePayload.approved_by = user.id;
      }

      // 1. Perform update on quotation
      await trx('quotations')
        .where({ id: quotationId })
        .update(updatePayload);

      // 2. Insert approval log. The DB column is
      // ENUM('pending','approved','rejected','returned','escalated') while the
      // state machine uses its own action names, so map them explicitly —
      // passing 'approve'/'reject' through raw triggers
      // "Data truncated for column 'action'" and fails the whole transaction.
      const APPROVAL_LOG_ACTIONS = {
        approve: 'approved',
        approved: 'approved',
        reject: 'rejected',
        rejected: 'rejected',
        return_for_revision: 'returned',
        returned: 'returned',
      };
      const logAction = APPROVAL_LOG_ACTIONS[action] || action;
      const [logId] = await trx('approval_logs').insert({
        quotation_id: quotationId,
        approver_id: user.id,
        role_at_approval: user.role,
        action: logAction,
        discount_percent_at_review: quotation.blended_risk_score,
        comments: comments || null,
        ip_address: reqMeta.ip || null,
        user_agent: reqMeta.userAgent || null,
        created_at: now,
      }).returning('id');

      // 3. Write immutable audit trail entry
      await this.auditTrailRepo.logChange({
        tableName: 'quotations',
        recordId: quotationId,
        operation: 'UPDATE',
        changedBy: user.id,
        changedByRole: user.role,
        oldValues: { status: oldStatus, approved_by: quotation.approved_by, version: quotation.version },
        newValues: { status: newStatus, approved_by: updatePayload.approved_by || quotation.approved_by, version: quotation.version + 1, comments },
        changedFields: ['status', 'approved_by', 'approved_at', 'version'],
        ipAddress: reqMeta.ip || null,
        userAgent: reqMeta.userAgent || null,
      });

      // 4. Trigger Deal Health Alert check (e.g. check return count)
      let alertCreated = null;
      if (action === 'return_for_revision' || action === 'returned') {
        const returnCount = (await this.dealHealthAlertRepo.countReturnedForRevision(quotationId, trx)) + 1;
        if (returnCount >= 2) {
          alertCreated = await this.dealHealthAlertRepo.createAlert({
            quotationId,
            alertType: 'EXCESSIVE_RETURNS',
            severity: 'high',
            title: 'Quotation Returned Multiple Times for Revision',
            description: `Quotation ${quotation.quotation_number} has been returned for revision ${returnCount} times. Flagged as high risk.`,
            metricName: 'return_count',
            metricValue: returnCount,
            thresholdValue: 2,
            metadata: { returned_by: user.id, comments },
          }, trx);
          this.logger.warn({ quotationId, returnCount, alertId: alertCreated }, 'Deal health alert created for excessive returns');
        }
      }

      await trx.commit();

      this.logger.info(
        { quotationId, approverId: user.id, action, newStatus },
        'Approval action completed successfully'
      );

      return {
        quotation_id: quotationId,
        action,
        previous_status: oldStatus,
        status: newStatus,
        approval_log_id: typeof logId === 'object' ? logId.id : logId,
        health_alert_created: alertCreated !== null,
      };
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async processApprovalDecision(quotationId, user, { action, comments }, reqMeta = {}) {
    return this.processApprovalAction({
      quotationId,
      action,
      user,
      comments,
      reqMeta,
    });
  }

  async getApprovalLogs(quotationId) {
    return this.approvalLogRepo.findByQuotation(quotationId);
  }
}

export default DiscountService;
