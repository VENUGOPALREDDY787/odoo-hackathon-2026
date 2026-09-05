import { describe, it, expect } from '@jest/globals';
import { splitFulfillment } from '../services/fulfillmentSplitter.js';

describe('fulfillmentSplitter - Pure Greedy Split Algorithm', () => {
  const sampleWarehouses = [
    { warehouse_id: 'wh-main', warehouse_name: 'Main Distribution Center', quantity_available: 50, priority: 10 },
    { warehouse_id: 'wh-east', warehouse_name: 'East Coast Hub', quantity_available: 30, priority: 5 },
    { warehouse_id: 'wh-west', warehouse_name: 'West Coast Hub', quantity_available: 20, priority: 5 },
  ];

  it('case 1: single warehouse exact / sufficient stock match (minimizes shipments to 1)', () => {
    const result = splitFulfillment('prod-1', 40, sampleWarehouses);

    expect(result.is_fully_allocated).toBe(true);
    expect(result.total_allocated).toBe(40);
    expect(result.backorder_quantity).toBe(0);
    expect(result.splits).toHaveLength(1);
    expect(result.splits[0]).toEqual({
      warehouse_id: 'wh-main',
      warehouse_name: 'Main Distribution Center',
      quantity: 40,
    });
  });

  it('case 2: split across two warehouses when no single warehouse has sufficient stock', () => {
    // Requested 70 units. wh-main has 50, wh-east has 30, wh-west has 20. No single warehouse has 70.
    const result = splitFulfillment('prod-1', 70, sampleWarehouses);

    expect(result.is_fully_allocated).toBe(true);
    expect(result.total_allocated).toBe(70);
    expect(result.backorder_quantity).toBe(0);
    expect(result.splits).toHaveLength(2);
    // Greedily takes 50 from wh-main (largest) and 20 from wh-east (second largest)
    expect(result.splits[0]).toEqual({
      warehouse_id: 'wh-main',
      warehouse_name: 'Main Distribution Center',
      quantity: 50,
    });
    expect(result.splits[1]).toEqual({
      warehouse_id: 'wh-east',
      warehouse_name: 'East Coast Hub',
      quantity: 20,
    });
  });

  it('ignores reserved, deleted, and empty stock', () => {
    const result = splitFulfillment('prod-1', 10, [
      { warehouse_id: 'reserved', quantity_on_hand: 20, quantity_reserved: 20 },
      { warehouse_id: 'deleted', quantity_on_hand: 20, quantity_reserved: 0, deleted_at: '2026-01-01' },
      { warehouse_id: 'available', quantity_on_hand: 10, quantity_reserved: 0 },
    ]);

    expect(result.is_fully_allocated).toBe(true);
    expect(result.splits).toEqual([{ warehouse_id: 'available', warehouse_name: 'Warehouse', quantity: 10 }]);
  });

  it('case 3: insufficient stock across all warehouses resulting in backorder quantity', () => {
    // Requested 120 units. Total stock across all warehouses is 50 + 30 + 20 = 100.
    const result = splitFulfillment('prod-1', 120, sampleWarehouses);

    expect(result.is_fully_allocated).toBe(false);
    expect(result.total_allocated).toBe(100);
    expect(result.backorder_quantity).toBe(20);
    expect(result.splits).toHaveLength(3);
    expect(result.splits[0].quantity).toBe(50);
    expect(result.splits[1].quantity).toBe(30);
    expect(result.splits[2].quantity).toBe(20);
  });

  it('handles zero or negative quantity needed gracefully', () => {
    const result = splitFulfillment('prod-1', 0, sampleWarehouses);

    expect(result.is_fully_allocated).toBe(true);
    expect(result.total_allocated).toBe(0);
    expect(result.backorder_quantity).toBe(0);
    expect(result.splits).toHaveLength(0);
  });
});
