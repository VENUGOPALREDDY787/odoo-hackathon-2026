import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ReportBuilder } from '../services/ReportBuilder.js';

describe('ReportBuilder', () => {
  let builder;
  let mockDb;

  beforeEach(() => {
    // Create a mock Knex query builder
    const chain = {
      join: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      clone: function() { return this; }, // simple clone for testing
      count: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({ total: 10 }),
      as: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      stream: jest.fn().mockReturnValue('mock-stream'),
    };
    
    // The db function itself returns the chain
    mockDb = jest.fn(() => chain);
    mockDb.countDistinct = jest.fn(() => chain);
    mockDb.from = jest.fn(() => chain);
    mockDb.raw = jest.fn(sql => sql);
    
    builder = new ReportBuilder(mockDb);
  });

  describe('_buildBaseQuery', () => {
    it('applies basic filters correctly', () => {
      const filters = {
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        repId: 'rep-1',
        status: 'approved',
        customerTier: 'Gold'
      };

      const query = builder._buildBaseQuery(filters);
      
      expect(mockDb).toHaveBeenCalledWith('quotations as q');
      expect(query.where).toHaveBeenCalledWith('q.created_at', '>=', '2026-01-01');
      expect(query.where).toHaveBeenCalledWith('q.created_at', '<=', '2026-12-31 23:59:59');
      expect(query.where).toHaveBeenCalledWith('q.assigned_rep_id', 'rep-1');
      expect(query.where).toHaveBeenCalledWith('q.status', 'approved');
      expect(query.where).toHaveBeenCalledWith('c.tier', 'Gold');
    });

    it('joins products table when product filter is used', () => {
      const filters = { productId: 'prod-1' };
      const query = builder._buildBaseQuery(filters);
      
      expect(query.join).toHaveBeenCalledWith('quotation_lines as ql', 'q.id', 'ql.quotation_id');
      expect(query.join).toHaveBeenCalledWith('products as p', 'ql.product_id', 'p.id');
      expect(query.where).toHaveBeenCalledWith('ql.product_id', 'prod-1');
      expect(query.groupBy).toHaveBeenCalledWith('q.id');
    });
    
    it('joins products table when category filter is used', () => {
      const filters = { categoryId: 'cat-1' };
      const query = builder._buildBaseQuery(filters);
      
      expect(query.join).toHaveBeenCalledWith('quotation_lines as ql', 'q.id', 'ql.quotation_id');
      expect(query.where).toHaveBeenCalledWith('p.category_id', 'cat-1');
      expect(query.groupBy).toHaveBeenCalledWith('q.id');
    });
  });

  describe('buildListQuery', () => {
    it('constructs correct paginated list query', async () => {
      // Setup mock to return data from the promise all
      const mockData = [{ id: 'q-1' }, { id: 'q-2' }];
      const chain = mockDb();
      chain.offset = jest.fn().mockResolvedValue(mockData); // offset is the last chained method, so it resolves
      
      const result = await builder.buildListQuery({ status: 'draft' }, { limit: 15, offset: 30, orderBy: 'grand_total', orderDir: 'asc' });
      
      expect(chain.select).toHaveBeenCalled();
      expect(chain.orderBy).toHaveBeenCalledWith('q.grand_total', 'asc');
      expect(chain.limit).toHaveBeenCalledWith(15);
      expect(chain.offset).toHaveBeenCalledWith(30);
      
      expect(result.data).toEqual(mockData);
      expect(result.total).toBe(10); // From the mock first()
    });
  });

  describe('buildAggregateQuery', () => {
    it('constructs correct aggregate query', async () => {
      const mockResult = {
        total_count: 5,
        total_value: 10000.50,
        average_margin: 25.5,
        average_discount_pct: 12.0
      };
      
      const chain = mockDb();
      chain.first = jest.fn().mockResolvedValue(mockResult);
      
      const result = await builder.buildAggregateQuery({ repId: 'rep-2' });
      
      expect(mockDb.from).toHaveBeenCalled();
      expect(chain.select).toHaveBeenCalled(); // Should select the raw aggregates
      
      expect(result).toEqual({
        total_count: 5,
        total_value: 10000.5,
        average_margin: 25.5,
        average_discount_pct: 12
      });
    });
  });
  
  describe('buildStreamQuery', () => {
    it('returns a stream', () => {
      const stream = builder.buildStreamQuery({ status: 'sent' });
      expect(stream).toBe('mock-stream');
      
      const chain = mockDb();
      expect(chain.select).toHaveBeenCalled();
      expect(chain.orderBy).toHaveBeenCalledWith('q.created_at', 'desc');
      expect(chain.stream).toHaveBeenCalled();
    });
  });
});
