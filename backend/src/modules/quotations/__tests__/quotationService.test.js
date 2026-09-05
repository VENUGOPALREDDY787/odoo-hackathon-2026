import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { QuotationService } from '../services/QuotationService.js';
import { ConflictError, NotFoundError } from '../../../errors/AppError.js';

describe('QuotationService Unit Tests (Optimistic Locking & Idempotency)', () => {
  let mockDb;
  let mockLogger;
  let service;
  let queryBuilderMock;

  const sampleCustomer = {
    id: 'cust-uuid-1',
    company_name: 'Acme Corp',
    tier: 'Gold',
    currency: 'USD',
    payment_terms_days: 30,
  };

  const sampleQuotation = {
    id: 'quote-uuid-1',
    quotation_number: 'QT-2026-00001',
    customer_id: 'cust-uuid-1',
    customer_tier: 'Gold',
    assigned_rep_id: 'rep-uuid-1',
    status: 'draft',
    currency: 'USD',
    subtotal: 1000.0,
    discount_total: 0.0,
    tax_total: 100.0,
    shipping_total: 0.0,
    grand_total: 1100.0,
    margin_total: 400.0,
    margin_percentage: 40.0,
    version: 1,
    lines: [],
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    queryBuilderMock = {
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      whereRaw: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      orWhereNull: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockResolvedValue(1),
      delete: jest.fn().mockResolvedValue(1),
      returning: jest.fn().mockResolvedValue(['quote-uuid-1']),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
      max: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnThis(),
      join: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      raw: jest.fn((str) => str),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
    };

    const trxMock = jest.fn(() => queryBuilderMock);

    queryBuilderMock.transaction = jest.fn(async (cb) => {
      if (cb) return cb(trxMock);
      return trxMock;
    });

    mockDb = jest.fn(() => queryBuilderMock);
    Object.assign(mockDb, queryBuilderMock);
    Object.assign(trxMock, queryBuilderMock);

    service = new QuotationService(mockDb, mockLogger);
  });

  describe('createQuotation', () => {
    it('creates draft quotation with version 1', async () => {
      queryBuilderMock.first
        .mockResolvedValueOnce(sampleCustomer) // customer check
        .mockResolvedValueOnce({ count: 0 }) // count for quotation number
        .mockResolvedValueOnce(sampleQuotation); // findWithDetails

      const result = await service.createQuotation({
        customer_id: 'cust-uuid-1',
        valid_until: '2026-12-31',
      });

      expect(result).toBeDefined();
      expect(result.version).toBe(1);
      expect(queryBuilderMock.insert).toHaveBeenCalled();
    });
  });

  describe('Optimistic Locking Enforcement', () => {
    it('throws ConflictError (409) when expectedVersion does not match current version', async () => {
      queryBuilderMock.first.mockResolvedValueOnce({ ...sampleQuotation, version: 2 });

      await expect(
        service.addLine(
          'quote-uuid-1',
          { quantity: 1, list_price: 100 },
          1 // expectedVersion 1 (stale!)
        )
      ).rejects.toThrow('Quotation version mismatch');
    });
  });

  describe('Idempotency Key Support', () => {
    it('returns cached response when submitted with identical idempotency key', async () => {
      const cachedRecord = {
        key: 'idempotency-key-xyz-123',
        request_path: '/api/quotations/quote-uuid-1/submit',
        response_code: 200,
        response_body: JSON.stringify({
          from_cache: false,
          quotation_id: 'quote-uuid-1',
          status: 'pending_approval',
          blended_risk_score: 12.0,
        }),
        expires_at: new Date(Date.now() + 100000),
      };

      queryBuilderMock.first.mockResolvedValueOnce(cachedRecord);

      const result = await service.submitForApproval(
        'quote-uuid-1',
        { id: 'user-rep-1', role: 'rep' },
        'idempotency-key-xyz-123'
      );

      expect(result.from_cache).toBe(true);
      expect(result.data.status).toBe('pending_approval');
      expect(queryBuilderMock.update).not.toHaveBeenCalled();
    });
  });
});
