import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, ValidationError, ConflictError, AuthorizationError } from '../../../errors/AppError.js';
import {
  QuotationRepository,
  QuotationLineRepository,
  IdempotencyKeyRepository,
} from '../repositories/QuotationRepository.js';
import { DiscountTierRepository, ApprovalChainRepository, AuditTrailRepository } from '../../discounts/repositories/DiscountRepository.js';
import { ProductRepository, ProductVariantRepository } from '../../products/repositories/ProductRepository.js';
import { recalculateQuotationTotals, calculateMarginDelta } from './recalculator.js';

export class QuotationService {
  constructor(db, logger, cache, io = null) {
    this.db = db;
    this.logger = logger || { info: () => {}, warn: () => {}, error: () => {} };
    this.cache = cache;
    this.io = io;
    this.quotationRepo = new QuotationRepository(db);
    this.lineRepo = new QuotationLineRepository(db);
    this.idempotencyRepo = new IdempotencyKeyRepository(db);
    this.discountTierRepo = new DiscountTierRepository(db);
    this.approvalChainRepo = new ApprovalChainRepository(db);
    this.auditTrailRepo = new AuditTrailRepository(db);
    this.productRepo = new ProductRepository(db);
    this.variantRepo = new ProductVariantRepository(db);
  }

  // ==================== QUOTATION CRUD ====================

  async createQuotation(data, user = null) {
    const customer = await this.resolveQuotationCustomer(data);
    if (!customer) {
      throw new ValidationError('Invalid customer ID');
    }

    const quotationNumber = await this.quotationRepo.generateNextQuotationNumber();

    const payload = {
      id: uuidv4(),
      quotation_number: quotationNumber,
      customer_id: customer.id,
      assigned_rep_id: data.assigned_rep_id || user?.id || null,
      status: 'draft',
      currency: data.currency || customer.currency || 'USD',
      payment_terms_days: data.payment_terms_days || customer.payment_terms_days || 30,
      valid_from: new Date(),
      valid_until: new Date(data.valid_until),
      terms_and_conditions: data.terms_and_conditions || null,
      internal_notes: data.internal_notes || null,
      customer_notes: data.customer_notes || null,
      tags: data.tags ? JSON.stringify(data.tags) : JSON.stringify([]),
      metadata: data.metadata ? JSON.stringify(data.metadata) : JSON.stringify({}),
      version: 1,
      subtotal: 0,
      discount_total: 0,
      tax_total: 0,
      shipping_total: 0,
      grand_total: 0,
      margin_total: 0,
      margin_percentage: 0,
      blended_risk_score: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await this.db('quotations').insert(payload);

    // Role-attributed audit entry: who created this quotation (CREATE op)
    await this.auditTrailRepo.logChange({
      tableName: 'quotations',
      recordId: payload.id,
      operation: 'CREATE',
      changedBy: user?.id || null,
      changedByRole: user?.role || null,
      oldValues: null,
      newValues: { quotation_number: quotationNumber, customer_id: customer.id, status: 'draft' },
      changedFields: ['quotation_number', 'customer_id', 'status'],
    });

    const created = await this.quotationRepo.findWithDetails(payload.id);
    this.logger.info({ quotationId: created?.id, quotationNumber }, 'Draft quotation created');
    return created;
  }

  async resolveQuotationCustomer(data) {
    if (data.customer_id) {
      return this.db('customers').where({ id: data.customer_id, deleted_at: null }).first();
    }

    const customerName = data.customer_name || data.metadata?.customer_name;
    if (!customerName) {
      return null;
    }

    const existing = await this.db('customers')
      .where({ company_name: customerName, deleted_at: null })
      .first();
    if (existing) {
      return existing;
    }

    const payload = {
      id: uuidv4(),
      company_name: customerName,
      tier: data.customer_tier || 'Bronze',
      currency: data.currency || 'USD',
      payment_terms_days: data.payment_terms_days || 30,
      billing_address: JSON.stringify({}),
      shipping_address: JSON.stringify({}),
      created_at: new Date(),
      updated_at: new Date(),
    };

    await this.db('customers').insert(payload);
    return this.db('customers').where({ id: payload.id }).first();
  }

  async getQuotation(id) {
    const quotation = await this.quotationRepo.findWithDetails(id);
    if (!quotation) {
      throw new NotFoundError('Quotation');
    }
    return quotation;
  }

  async listQuotations(filters = {}, options = {}) {
    return this.quotationRepo.listWithFilters(filters, options);
  }

  // ==================== LINE MANAGEMENT & LIVE MARGIN DELTAS ====================

  async addLine(quotationId, lineData, expectedVersion = null, user = null, reqMeta = {}) {
    const trx = await this.db.transaction();
    try {
      const quotation = await this.quotationRepo.findWithDetails(quotationId, trx);
      if (!quotation) {
        throw new NotFoundError('Quotation');
      }

      // Optimistic locking check
      if (expectedVersion !== null && expectedVersion !== undefined) {
        if (quotation.version !== expectedVersion) {
          throw new ConflictError(
            `Quotation version mismatch. Current version is ${quotation.version}, expected ${expectedVersion}. Please reload.`,
            { currentVersion: quotation.version, expectedVersion }
          );
        }
      }

      let costPrice = 0;
      let defaultListPrice = 0;
      let productId = lineData.product_id || null;
      let variantId = lineData.variant_id || null;

      if (productId) {
        const product = await this.productRepo.findById(productId);
        if (!product) throw new ValidationError('Invalid product_id');
        costPrice = Number(product.cost_price || 0);
        defaultListPrice = Number(product.base_price || 0);

        if (variantId) {
          const variant = await this.variantRepo.findById(variantId);
          if (variant) {
            costPrice += Number(variant.cost_adjustment || 0);
            defaultListPrice += Number(variant.price_adjustment || 0);
          }
        }
      }

      const listPrice = lineData.list_price !== undefined ? Number(lineData.list_price) : defaultListPrice;
      const nextLineNum = await this.lineRepo.getNextLineNumber(quotationId, trx);

      const linePayload = {
        id: uuidv4(),
        quotation_id: quotationId,
        line_number: nextLineNum,
        line_type: lineData.line_type || 'one_time',
        product_id: productId,
        variant_id: variantId,
        subscription_plan_id: lineData.subscription_plan_id || null,
        custom_name: lineData.custom_name || null,
        custom_description: lineData.custom_description || null,
        quantity: Number(lineData.quantity) || 1,
        unit_of_measure: lineData.unit_of_measure || 'EA',
        list_price: listPrice,
        discount_percent: Number(lineData.discount_percent) || 0,
        discount_amount: Number(lineData.discount_amount) || 0,
        tax_rate: Number(lineData.tax_rate) || 0,
        sort_order: nextLineNum,
        created_at: new Date(),
        updated_at: new Date(),
      };

      await trx('quotation_lines').insert(linePayload);
      const createdLineId = linePayload.id;

      // Fetch all current lines including new line & product cost prices
      const currentLines = await trx('quotation_lines as ql')
        .leftJoin('products as p', 'ql.product_id', 'p.id')
        .leftJoin('product_variants as pv', 'ql.variant_id', 'pv.id')
        .where({ 'ql.quotation_id': quotationId, 'ql.deleted_at': null })
        .select('ql.*', 'p.cost_price as product_cost_price', 'p.category_id as product_category_id', 'pv.cost_adjustment');

      const formattedLines = currentLines.map(l => ({
        ...l,
        cost_price: Number(l.product_cost_price || 0) + Number(l.cost_adjustment || 0),
      }));

      const activeDiscountTiers = await this.discountTierRepo.findActiveTiers(quotation.customer_tier);
      const activeApprovalChains = await this.approvalChainRepo.findActiveChains();

      const previousTotals = {
        margin_total: quotation.margin_total,
        margin_percentage: quotation.margin_percentage,
      };

      const newTotals = recalculateQuotationTotals({
        quotation,
        lines: formattedLines,
        discountTiers: activeDiscountTiers,
        customerTier: quotation.customer_tier,
        approvalChains: activeApprovalChains,
      });

      const marginDelta = calculateMarginDelta(previousTotals, newTotals);

      // Perform optimistic update on quotation
      await this.quotationRepo.updateWithVersion(
        quotationId,
        quotation.version,
        {
          subtotal: newTotals.subtotal,
          discount_total: newTotals.discount_total,
          tax_total: newTotals.tax_total,
          grand_total: newTotals.grand_total,
          margin_total: newTotals.margin_total,
          margin_percentage: newTotals.margin_percentage,
          blended_risk_score: newTotals.blended_risk_score,
        },
        trx
      );

      // Write audit trail
      await this.auditTrailRepo.logChange({
        tableName: 'quotations',
        recordId: quotationId,
        operation: 'UPDATE',
        changedBy: user?.id || null,
        changedByRole: user?.role || null,
        oldValues: { version: quotation.version, margin_total: previousTotals.margin_total },
        newValues: { version: quotation.version + 1, margin_total: newTotals.margin_total, line_added_id: createdLineId },
        changedFields: ['line_added', 'margin_total', 'version'],
        ipAddress: reqMeta.ip || null,
        userAgent: reqMeta.userAgent || null,
      });

      await trx.commit();

      const updatedQuotation = await this.quotationRepo.findWithDetails(quotationId);
      const addedLine = updatedQuotation.lines.find(l => l.id === createdLineId || l.line_number === nextLineNum);

      if (this.cache) await this.cache.delPattern(`quotations:item:${quotationId}`);

      if (this.io) {
        this.io.to(`quote:${quotationId}`).emit('quotation:updated', {
          quotationId,
          totals: newTotals,
          marginDelta
        });
      }

      return {
        line: addedLine,
        quotation: updatedQuotation,
        margin_delta: marginDelta,
      };
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async updateLine(quotationId, lineId, lineData, expectedVersion = null, user = null, reqMeta = {}) {
    const trx = await this.db.transaction();
    try {
      const quotation = await this.quotationRepo.findWithDetails(quotationId, trx);
      if (!quotation) throw new NotFoundError('Quotation');

      if (expectedVersion !== null && expectedVersion !== undefined && quotation.version !== expectedVersion) {
        throw new ConflictError(
          `Quotation version mismatch. Current version is ${quotation.version}, expected ${expectedVersion}.`,
          { currentVersion: quotation.version, expectedVersion }
        );
      }

      const existingLine = await trx('quotation_lines')
        .where({ id: lineId, quotation_id: quotationId, deleted_at: null })
        .first();

      if (!existingLine) throw new NotFoundError('Quotation line');

      const updateLinePayload = { ...lineData, updated_at: new Date() };
      delete updateLinePayload.expected_version;
      delete updateLinePayload.is_upsell;

      await trx('quotation_lines')
        .where({ id: lineId })
        .update(updateLinePayload);

      // Role-attributed audit entry: which fields the actor changed on the line
      await this.auditTrailRepo.logChange({
        tableName: 'quotation_lines',
        recordId: lineId,
        operation: 'UPDATE',
        changedBy: user?.id || null,
        changedByRole: user?.role || null,
        oldValues: { quantity: existingLine.quantity, list_price: existingLine.list_price, discount_percent: existingLine.discount_percent },
        newValues: {
          quantity: updateLinePayload.quantity !== undefined ? Number(updateLinePayload.quantity) : existingLine.quantity,
          list_price: updateLinePayload.list_price !== undefined ? Number(updateLinePayload.list_price) : existingLine.list_price,
          discount_percent: updateLinePayload.discount_percent !== undefined ? Number(updateLinePayload.discount_percent) : existingLine.discount_percent,
        },
        changedFields: Object.keys(lineData).filter((key) => !['expected_version', 'is_upsell'].includes(key)),
        ipAddress: reqMeta.ip || null,
        userAgent: reqMeta.userAgent || null,
      });

      const currentLines = await trx('quotation_lines as ql')
        .leftJoin('products as p', 'ql.product_id', 'p.id')
        .leftJoin('product_variants as pv', 'ql.variant_id', 'pv.id')
        .where({ 'ql.quotation_id': quotationId, 'ql.deleted_at': null })
        .select('ql.*', 'p.cost_price as product_cost_price', 'p.category_id as product_category_id', 'pv.cost_adjustment');

      const formattedLines = currentLines.map(l => ({
        ...l,
        cost_price: Number(l.product_cost_price || 0) + Number(l.cost_adjustment || 0),
      }));

      const activeDiscountTiers = await this.discountTierRepo.findActiveTiers(quotation.customer_tier);
      const activeApprovalChains = await this.approvalChainRepo.findActiveChains();

      const previousTotals = {
        margin_total: quotation.margin_total,
        margin_percentage: quotation.margin_percentage,
      };

      const newTotals = recalculateQuotationTotals({
        quotation,
        lines: formattedLines,
        discountTiers: activeDiscountTiers,
        customerTier: quotation.customer_tier,
        approvalChains: activeApprovalChains,
      });

      const marginDelta = calculateMarginDelta(previousTotals, newTotals);

      await this.quotationRepo.updateWithVersion(
        quotationId,
        quotation.version,
        {
          subtotal: newTotals.subtotal,
          discount_total: newTotals.discount_total,
          tax_total: newTotals.tax_total,
          grand_total: newTotals.grand_total,
          margin_total: newTotals.margin_total,
          margin_percentage: newTotals.margin_percentage,
          blended_risk_score: newTotals.blended_risk_score,
        },
        trx
      );

      await trx.commit();

      const updatedQuotation = await this.quotationRepo.findWithDetails(quotationId);
      if (this.cache) await this.cache.delPattern(`quotations:item:${quotationId}`);

      if (this.io) {
        this.io.to(`quote:${quotationId}`).emit('quotation:updated', {
          quotationId,
          totals: newTotals,
          marginDelta
        });
      }

      return {
        quotation: updatedQuotation,
        margin_delta: marginDelta,
      };
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async removeLine(quotationId, lineId, expectedVersion = null, user = null, reqMeta = {}) {
    const trx = await this.db.transaction();
    try {
      const quotation = await this.quotationRepo.findWithDetails(quotationId, trx);
      if (!quotation) throw new NotFoundError('Quotation');

      if (expectedVersion !== null && expectedVersion !== undefined && quotation.version !== expectedVersion) {
        throw new ConflictError(
          `Quotation version mismatch. Current version is ${quotation.version}, expected ${expectedVersion}.`,
          { currentVersion: quotation.version, expectedVersion }
        );
      }

      const lineToDelete = await trx('quotation_lines')
        .where({ id: lineId, quotation_id: quotationId, deleted_at: null })
        .first();

      await trx('quotation_lines')
        .where({ id: lineId, quotation_id: quotationId })
        .update({ deleted_at: new Date(), updated_at: new Date() });

      // Role-attributed audit entry: soft delete of a quotation line
      await this.auditTrailRepo.logChange({
        tableName: 'quotation_lines',
        recordId: lineId,
        operation: 'DELETE',
        changedBy: user?.id || null,
        changedByRole: user?.role || null,
        oldValues: { quantity: lineToDelete ? lineToDelete.quantity : null, custom_name: lineToDelete ? lineToDelete.custom_name : null, quotation_id: quotationId },
        newValues: { deleted_at: new Date().toISOString() },
        changedFields: ['deleted_at'],
        ipAddress: reqMeta.ip || null,
        userAgent: reqMeta.userAgent || null,
      });

      const currentLines = await trx('quotation_lines as ql')
        .leftJoin('products as p', 'ql.product_id', 'p.id')
        .leftJoin('product_variants as pv', 'ql.variant_id', 'pv.id')
        .where({ 'ql.quotation_id': quotationId, 'ql.deleted_at': null })
        .select('ql.*', 'p.cost_price as product_cost_price', 'p.category_id as product_category_id', 'pv.cost_adjustment');

      const formattedLines = currentLines.map(l => ({
        ...l,
        cost_price: Number(l.product_cost_price || 0) + Number(l.cost_adjustment || 0),
      }));

      const activeDiscountTiers = await this.discountTierRepo.findActiveTiers(quotation.customer_tier);
      const activeApprovalChains = await this.approvalChainRepo.findActiveChains();

      const previousTotals = {
        margin_total: quotation.margin_total,
        margin_percentage: quotation.margin_percentage,
      };

      const newTotals = recalculateQuotationTotals({
        quotation,
        lines: formattedLines,
        discountTiers: activeDiscountTiers,
        customerTier: quotation.customer_tier,
        approvalChains: activeApprovalChains,
      });

      const marginDelta = calculateMarginDelta(previousTotals, newTotals);

      await this.quotationRepo.updateWithVersion(
        quotationId,
        quotation.version,
        {
          subtotal: newTotals.subtotal,
          discount_total: newTotals.discount_total,
          tax_total: newTotals.tax_total,
          grand_total: newTotals.grand_total,
          margin_total: newTotals.margin_total,
          margin_percentage: newTotals.margin_percentage,
          blended_risk_score: newTotals.blended_risk_score,
        },
        trx
      );

      await trx.commit();

      const updatedQuotation = await this.quotationRepo.findWithDetails(quotationId);
      if (this.cache) await this.cache.delPattern(`quotations:item:${quotationId}`);

      if (this.io) {
        this.io.to(`quote:${quotationId}`).emit('quotation:updated', {
          quotationId,
          totals: newTotals,
          marginDelta
        });
      }

      return {
        quotation: updatedQuotation,
        margin_delta: marginDelta,
      };
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // ==================== SUBMIT FOR APPROVAL & IDEMPOTENCY ====================

  async submitForApproval(quotationId, user, idempotencyKey = null, expectedVersion = null, reqMeta = {}) {
    const requestPath = `/api/quotations/${quotationId}/submit`;

    // 1. Idempotency Check
    if (idempotencyKey) {
      const cached = await this.idempotencyRepo.findKey(idempotencyKey, requestPath);
      if (cached) {
        this.logger.info({ quotationId, idempotencyKey }, 'Idempotent request recognized, returning cached result');
        const parsedBody = typeof cached.response_body === 'string' ? JSON.parse(cached.response_body) : cached.response_body;
        return {
          from_cache: true,
          status_code: cached.response_code,
          data: parsedBody,
        };
      }
    }

    const trx = await this.db.transaction();
    try {
      const quotation = await this.quotationRepo.findWithDetails(quotationId, trx);
      if (!quotation) throw new NotFoundError('Quotation');

      // Defense in depth: Verify authorization at service level
      if (user && user.role !== 'admin' && user.role !== 'manager' && quotation.assigned_rep_id !== user.id) {
        throw new AuthorizationError('You are not authorized to submit this quotation for approval.');
      }

      if (expectedVersion !== null && expectedVersion !== undefined && quotation.version !== expectedVersion) {
        throw new ConflictError(
          `Quotation version mismatch. Current version is ${quotation.version}, expected ${expectedVersion}.`,
          { currentVersion: quotation.version, expectedVersion }
        );
      }

      // Re-evaluate risk score & routing
      const activeDiscountTiers = await this.discountTierRepo.findActiveTiers(quotation.customer_tier);
      const activeApprovalChains = await this.approvalChainRepo.findActiveChains();

      const totals = recalculateQuotationTotals({
        quotation,
        lines: quotation.lines || [],
        discountTiers: activeDiscountTiers,
        customerTier: quotation.customer_tier,
        approvalChains: activeApprovalChains,
      });

      const newStatus = totals.requires_approval ? 'pending_approval' : 'approved';
      const now = new Date();

      const updatePayload = {
        subtotal: totals.subtotal,
        discount_total: totals.discount_total,
        tax_total: totals.tax_total,
        grand_total: totals.grand_total,
        margin_total: totals.margin_total,
        margin_percentage: totals.margin_percentage,
        blended_risk_score: totals.blended_risk_score,
        status: newStatus,
      };

      if (newStatus === 'approved') {
        updatePayload.approved_at = now;
        updatePayload.approved_by = user.id;
      }

      // Optimistic update
      const updatedQuotation = await this.quotationRepo.updateWithVersion(
        quotationId,
        quotation.version,
        updatePayload,
        trx
      );

      // Audit trail
      await this.auditTrailRepo.logChange({
        tableName: 'quotations',
        recordId: quotationId,
        operation: 'UPDATE',
        changedBy: user.id,
        changedByRole: user.role,
        oldValues: { status: quotation.status, blended_risk_score: quotation.blended_risk_score },
        newValues: { status: newStatus, blended_risk_score: totals.blended_risk_score, routing: totals.routing },
        changedFields: ['status', 'blended_risk_score', 'version'],
        ipAddress: reqMeta.ip || null,
        userAgent: reqMeta.userAgent || null,
      });

      const responsePayload = {
        from_cache: false,
        quotation_id: quotationId,
        status: newStatus,
        blended_risk_score: totals.blended_risk_score,
        requires_approval: totals.requires_approval,
        routing: totals.routing,
        quotation: updatedQuotation,
      };

      // 2. Save Idempotency Cache if key provided
      if (idempotencyKey) {
        await this.idempotencyRepo.saveKey(idempotencyKey, requestPath, 200, responsePayload);
      }

      if (this.io) {
        this.io.to(`quote:${quotationId}`).emit('approval:statusChanged', {
          quotationId,
          status: newStatus,
          routing: totals.routing,
        });
        
        if (quotation.assigned_rep_id) {
          this.io.to(`dashboard:${quotation.assigned_rep_id}`).emit('approval:statusChanged', {
            quotationId,
            status: newStatus
          });
        }
      }

      await trx.commit();
      if (this.cache) await this.cache.delPattern(`quotations:item:${quotationId}`);
      return responsePayload;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async acceptQuotation(quotationId, user) {
    if (user?.role !== 'customer') { throw new AuthorizationError('Only the quotation customer can accept this quotation.'); }
    const customer = await this.db('customers').where({ user_id: user.id, deleted_at: null }).select('id').first();
    if (!customer) { throw new AuthorizationError('Customer profile not found.'); }
    const quotation = await this.db('quotations').where({ id: quotationId, customer_id: customer.id, deleted_at: null }).first();
    if (!quotation) { throw new AuthorizationError('You cannot accept this quotation.'); }
    if (!['approved', 'sent', 'negotiation'].includes(quotation.status)) {
      throw new ValidationError(`Quotation cannot be accepted from status '${quotation.status}'.`);
    }
    await this.db('quotations').where({ id: quotationId }).update({ status: 'accepted', updated_at: new Date(), version: this.db.raw('version + 1') });

    // Role-attributed audit entry: customer formally accepted the offer
    await this.auditTrailRepo.logChange({
      tableName: 'quotations',
      recordId: quotationId,
      operation: 'UPDATE',
      changedBy: user.id,
      changedByRole: user.role,
      oldValues: { status: quotation.status },
      newValues: { status: 'accepted' },
      changedFields: ['status', 'version'],
    });

    return this.quotationRepo.findWithDetails(quotationId);
  }
}

export default QuotationService;
