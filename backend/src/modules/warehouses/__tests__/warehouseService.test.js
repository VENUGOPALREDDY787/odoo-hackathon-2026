import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { WarehouseService } from '../services/WarehouseService.js';
import { ValidationError, NotFoundError } from '../../../errors/AppError.js';

describe('WarehouseService Unit Tests', () => {
  let mockDb;
  let mockLogger;
  let service;
  let queryBuilderMock;

  const sampleQuotationLine = {
    id: 'line-uuid-1',
    quotation_id: 'quote-uuid-1',
    product_id: 'prod-uuid-1',
    variant_id: null,
    quantity: 15,
  };

  const sampleStockLevels = [
    { warehouse_id: 'wh-1', warehouse_name: 'DC North', quantity_on_hand: 20, quantity_reserved: 5, quantity_available: 15 },
    { warehouse_id: 'wh-2', warehouse_name: 'DC South', quantity_on_hand: 10, quantity_reserved: 0, quantity_available: 10 },
  ];

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
      orWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockResolvedValue(1),
      delete: jest.fn().mockResolvedValue(1),
      returning: jest.fn().mockResolvedValue(['id-uuid-1']),
      orderBy: jest.fn().mockResolvedValue([]),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
      join: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      forUpdate: jest.fn().mockReturnThis(),
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

    service = new WarehouseService(mockDb, mockLogger);
  });

  describe('reserveStockForLine', () => {
    it('reserves stock using FOR UPDATE row locks and creates fulfillment splits', async () => {
      queryBuilderMock.first.mockResolvedValueOnce(sampleQuotationLine);
      queryBuilderMock.forUpdate.mockResolvedValueOnce(sampleStockLevels);

      const user = { id: 'usr-rep-1', role: 'rep' };
      const result = await service.reserveStockForLine('line-uuid-1', user);

      expect(result.quotation_line_id).toBe('line-uuid-1');
      expect(result.total_allocated).toBe(15);
      expect(result.backorder_quantity).toBe(0);
      expect(result.splits).toHaveLength(1);
      expect(queryBuilderMock.forUpdate).toHaveBeenCalled();
      expect(queryBuilderMock.insert).toHaveBeenCalled();
    });
  });

  describe('overrideFulfillmentSplits', () => {
    it('applies ops manual split override and logs reason to audit_trails', async () => {
      const existingSplits = [
        { id: 'split-1', warehouse_id: 'wh-1', quantity: 15 },
      ];

      queryBuilderMock.first.mockResolvedValueOnce(sampleQuotationLine);
      queryBuilderMock.orderBy.mockResolvedValueOnce(existingSplits); // existing splits
      queryBuilderMock.forUpdate.mockResolvedValueOnce(sampleStockLevels); // locked stocks

      const customSplits = [
        { warehouse_id: 'wh-1', quantity: 10 },
        { warehouse_id: 'wh-2', quantity: 5 },
      ];

      const user = { id: 'usr-ops-1', role: 'manager' };
      const result = await service.overrideFulfillmentSplits(
        {
          quotation_line_id: 'line-uuid-1',
          custom_splits: customSplits,
          override_reason: 'Customer requested split shipments from regional hubs for faster delivery.',
        },
        user,
        { ip: '127.0.0.1', userAgent: 'Jest' }
      );

      expect(result.quotation_line_id).toBe('line-uuid-1');
      expect(result.total_allocated).toBe(15);
      expect(result.override_reason).toContain('regional hubs');
      // Verify audit trail insert
      expect(queryBuilderMock.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          table_name: 'fulfillment_splits',
          record_id: 'line-uuid-1',
          operation: 'UPDATE',
        })
      );
    });

    it('rejects manual split override if requested quantity exceeds available stock', async () => {
      queryBuilderMock.first.mockResolvedValueOnce(sampleQuotationLine);
      queryBuilderMock.orderBy.mockResolvedValueOnce([]); // existing splits
      queryBuilderMock.forUpdate.mockResolvedValueOnce(sampleStockLevels);

      const customSplits = [
        { warehouse_id: 'wh-1', quantity: 999 }, // 999 exceeds 15 available stock!
      ];

      const user = { id: 'usr-ops-1', role: 'manager' };

      await expect(
        service.overrideFulfillmentSplits(
          {
            quotation_line_id: 'line-uuid-1',
            custom_splits: customSplits,
            override_reason: 'Testing oversell rejection',
          },
          user
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('consolidateBackorders', () => {
    it('scans pending backorders and triggers replenishment allocation check', async () => {
      const pendingBackorders = [
        { id: 'line-backorder-1', product_id: 'prod-uuid-1', quantity: 50, quotation_number: 'QT-2026-00001' },
      ];

      queryBuilderMock.select.mockResolvedValueOnce(pendingBackorders);

      const result = await service.consolidateBackorders();
      expect(result.checked_lines).toBe(1);
    });
  });
});
