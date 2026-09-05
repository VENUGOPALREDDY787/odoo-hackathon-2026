import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { ProductService } from '../services/ProductService.js';
import { ValidationError, NotFoundError } from '../../../errors/AppError.js';

describe('ProductService Unit Tests', () => {
  let mockDb;
  let mockLogger;
  let service;

  const sampleProduct = {
    id: 'prod-uuid-1',
    sku: 'PROD-SKU-001',
    name: 'Sample Widget',
    category_id: 'cat-uuid-1',
    base_price: 99.99,
    is_active: 1,
    deleted_at: null,
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
      returning: jest.fn().mockResolvedValue(['prod-uuid-1']),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnThis(),
      join: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
    };

    mockDb = jest.fn(() => queryBuilderMock);
    Object.assign(mockDb, queryBuilderMock);

    service = new ProductService(mockDb, mockLogger);
  });

  describe('createProduct', () => {
    it('creates a new product when SKU is unique', async () => {
      mockDb.first
        .mockResolvedValueOnce(null) // findBySku returns null
        .mockResolvedValueOnce(sampleProduct); // findById returns product

      const result = await service.createProduct({
        id: 'prod-uuid-1',
        sku: 'PROD-SKU-001',
        name: 'Sample Widget',
        category_id: 'cat-uuid-1',
        base_price: 99.99,
      });

      expect(result).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ sku: 'PROD-SKU-001' }),
        'Product created'
      );
    });

    it('throws ValidationError when product SKU already exists', async () => {
      mockDb.first.mockResolvedValueOnce(sampleProduct);

      await expect(
        service.createProduct({
          sku: 'PROD-SKU-001',
          name: 'Duplicate Widget',
          category_id: 'cat-uuid-1',
          base_price: 99.99,
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getProduct', () => {
    it('returns product when found', async () => {
      mockDb.first.mockResolvedValueOnce(sampleProduct);

      const result = await service.getProduct('prod-uuid-1');
      expect(result).toEqual(sampleProduct);
    });

    it('throws NotFoundError when product does not exist', async () => {
      mockDb.first.mockResolvedValueOnce(null);

      await expect(service.getProduct('non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateProduct', () => {
    it('updates product successfully', async () => {
      mockDb.first
        .mockResolvedValueOnce(sampleProduct) // getProduct
        .mockResolvedValueOnce({ ...sampleProduct, name: 'Updated Widget' }); // findById after update

      const result = await service.updateProduct('prod-uuid-1', { name: 'Updated Widget' });

      expect(result.name).toBe('Updated Widget');
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('deleteProduct (Soft-Delete Logic)', () => {
    it('soft deletes product when referenced by historical quotation lines', async () => {
      mockDb.first
        .mockResolvedValueOnce(sampleProduct) // getProduct
        .mockResolvedValueOnce({ id: 'line-1' }); // hasQuotationLines returns true

      const result = await service.deleteProduct('prod-uuid-1');

      expect(result).toEqual({
        success: true,
        softDeleted: true,
        message: 'Product soft deleted because it is referenced by quotation lines',
      });
      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: expect.any(Date) })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ productId: 'prod-uuid-1' }),
        'Product soft deleted (referenced by quotation lines)'
      );
    });

    it('soft deletes product when NOT referenced by quotation lines', async () => {
      mockDb.first
        .mockResolvedValueOnce(sampleProduct) // getProduct
        .mockResolvedValueOnce(null); // hasQuotationLines returns false

      const result = await service.deleteProduct('prod-uuid-1');

      expect(result).toEqual({ success: true, softDeleted: true });
      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: expect.any(Date) })
      );
    });
  });

  describe('listProducts', () => {
    it('returns bounded paginated product list', async () => {
      const mockProducts = [sampleProduct];
      
      const qb = mockDb();
      qb.select.mockResolvedValueOnce(mockProducts);
      qb.first.mockResolvedValueOnce({ count: 1 });

      const result = await service.listProducts(
        { category_id: 'cat-uuid-1', min_price: 10, max_price: 200 },
        { page: 1, limit: 10 }
      );

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });
  });
});
