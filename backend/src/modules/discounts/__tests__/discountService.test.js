import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { DiscountService } from '../services/DiscountService.js';
import { NotFoundError } from '../../../errors/AppError.js';

describe('DiscountService Unit Tests & Audit Trail Verification', () => {
  let mockDb;
  let mockLogger;
  let service;

  const sampleQuotation = {
    id: 'quote-uuid-1',
    quotation_number: 'QT-2026-0001',
    customer_id: 'cust-uuid-1',
    customer_tier: 'Gold',
    status: 'pending_approval',
    blended_risk_score: null,
    approved_by: null,
    approved_at: null,
  };

  const sampleQuotationLine = {
    id: 'qline-uuid-1',
    quotation_id: 'quote-uuid-1',
    line_number: 1,
    product_id: 'prod-uuid-1',
    product_category_id: 'cat-service',
    discount_percent: 23.0,
  };

  const sampleDiscountTier = {
    id: 'tier-uuid-1',
    customer_tier: 'Gold',
    category_id: 'cat-service',
    discount_percent: 15.0,
    priority: 0,
    is_active: 1,
  };

  const sampleApprovalChain = {
    id: 'chain-uuid-1',
    name: 'Manager & Finance Approval',
    min_discount_percent: 0.01,
    max_discount_percent: 50.0,
    required_approver_roles: ['manager', 'finance'],
    min_approvals_required: 2,
    is_active: 1,
  };

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const queryBuilderMock = {
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      orWhereNull: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockResolvedValue(1),
      delete: jest.fn().mockResolvedValue(1),
      returning: jest.fn().mockResolvedValue(['id-1']),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnThis(),
      join: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      raw: jest.fn((str) => str),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
    };

    const trxMock = jest.fn(() => queryBuilderMock);
    Object.assign(trxMock, queryBuilderMock);

    queryBuilderMock.transaction = jest.fn(async (cb) => {
      if (cb) return cb(trxMock);
      return trxMock;
    });

    mockDb = jest.fn(() => queryBuilderMock);
    Object.assign(mockDb, queryBuilderMock);
    Object.assign(trxMock, queryBuilderMock);

    service = new DiscountService(mockDb, mockLogger);
  });

  describe('Discount Tiers CRUD', () => {
    it('creates discount tier successfully', async () => {
      mockDb.first.mockResolvedValueOnce(sampleDiscountTier);

      const result = await service.createDiscountTier({
        customer_tier: 'Gold',
        category_id: 'cat-service',
        discount_percent: 15.0,
      });

      expect(result).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('Approval Chains CRUD', () => {
    it('creates approval chain successfully', async () => {
      mockDb.first.mockResolvedValueOnce(sampleApprovalChain);

      const result = await service.createApprovalChain({
        name: 'Manager & Finance Approval',
        min_discount_percent: 0.01,
        max_discount_percent: 50.0,
        required_approver_roles: ['manager', 'finance'],
      });

      expect(result).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('processApprovalDecision & Immutable Audit Trail Logging', () => {
    it('writes an immutable audit_trails row upon approval decision', async () => {
      mockDb.first.mockResolvedValueOnce(sampleQuotation);

      const user = { id: 'user-manager-1', role: 'manager' };

      const result = await service.processApprovalDecision(
        'quote-uuid-1',
        user,
        { action: 'approved', comments: 'Discount approved after review' },
        { ip: '127.0.0.1', userAgent: 'JestTest' }
      );

      expect(result.status).toBe('approved');
      expect(result.action).toBe('approved');

      // Verify quotation update call
      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'approved',
          approved_by: 'user-manager-1',
        })
      );

      // Verify audit_trails insert was called
      expect(mockDb.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          table_name: 'quotations',
          record_id: 'quote-uuid-1',
          operation: 'UPDATE',
          changed_by: 'user-manager-1',
          changed_by_role: 'manager',
        })
      );
    });

    it('writes an immutable audit_trails row upon rejection decision', async () => {
      mockDb.first.mockResolvedValueOnce(sampleQuotation);

      const user = { id: 'user-finance-1', role: 'finance' };

      const result = await service.processApprovalDecision(
        'quote-uuid-1',
        user,
        { action: 'rejected', comments: 'Discount exceeds margin limit' }
      );

      expect(result.status).toBe('rejected');
      expect(result.action).toBe('rejected');

      expect(mockDb.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          table_name: 'quotations',
          record_id: 'quote-uuid-1',
          operation: 'UPDATE',
          changed_by: 'user-finance-1',
          changed_by_role: 'finance',
        })
      );
    });
  });
});
