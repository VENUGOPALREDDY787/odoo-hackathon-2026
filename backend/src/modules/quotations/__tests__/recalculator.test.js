import { jest, describe, it, expect } from '@jest/globals';
import { recalculateQuotationTotals, calculateMarginDelta } from '../services/recalculator.js';

describe('recalculator - Real-time Quotation Recalculation Engine', () => {
  const sampleQuotation = {
    id: 'quote-100',
    shipping_total: 50.0,
  };

  const sampleLines = [
    {
      id: 'line-1',
      line_number: 1,
      quantity: 2,
      list_price: 1000.0,
      discount_percent: 10.0, // Net unit price = 900. Subtotal = 1800.
      tax_rate: 10.0, // Tax = 180. Line total = 1980.
      cost_price: 600.0, // Unit cost = 600. Cost = 1200. Margin = 600.
    },
    {
      id: 'line-2',
      line_number: 2,
      quantity: 1,
      list_price: 500.0,
      discount_percent: 0.0, // Net unit price = 500. Subtotal = 500.
      tax_rate: 10.0, // Tax = 50. Line total = 550.
      cost_price: 300.0, // Unit cost = 300. Cost = 300. Margin = 200.
    },
  ];

  describe('recalculateQuotationTotals', () => {
    it('recalculates line-level prices, subtotals, tax, and margins correctly', () => {
      const result = recalculateQuotationTotals({
        quotation: sampleQuotation,
        lines: sampleLines,
        customerTier: 'Bronze',
      });

      expect(result.computed_lines).toHaveLength(2);
      
      // Line 1
      expect(result.computed_lines[0].net_unit_price).toBe(900.0);
      expect(result.computed_lines[0].line_subtotal).toBe(1800.0);
      expect(result.computed_lines[0].tax_amount).toBe(180.0);
      expect(result.computed_lines[0].line_total).toBe(1980.0);
      expect(result.computed_lines[0].line_margin).toBe(600.0);
      expect(result.computed_lines[0].line_margin_percentage).toBe(33.33);

      // Line 2
      expect(result.computed_lines[1].net_unit_price).toBe(500.0);
      expect(result.computed_lines[1].line_subtotal).toBe(500.0);
      expect(result.computed_lines[1].tax_amount).toBe(50.0);
      expect(result.computed_lines[1].line_total).toBe(550.0);
      expect(result.computed_lines[1].line_margin).toBe(200.0);

      // Order totals
      expect(result.subtotal).toBe(2300.0);
      expect(result.tax_total).toBe(230.0);
      expect(result.shipping_total).toBe(50.0);
      expect(result.grand_total).toBe(2580.0);
      expect(result.margin_total).toBe(800.0);
      expect(result.margin_percentage).toBe(34.78);
    });
  });

  describe('calculateMarginDelta', () => {
    it('calculates live margin delta when an upsell line is added', () => {
      const previousTotals = {
        margin_total: 800.0,
        margin_percentage: 34.78,
      };

      const newTotals = {
        margin_total: 1100.0,
        margin_percentage: 39.29,
      };

      const delta = calculateMarginDelta(previousTotals, newTotals);

      expect(delta.margin_before).toBe(800.0);
      expect(delta.margin_after).toBe(1100.0);
      expect(delta.margin_delta_amount).toBe(300.0);
      expect(delta.margin_pct_before).toBe(34.78);
      expect(delta.margin_pct_after).toBe(39.29);
      expect(delta.margin_pct_delta).toBe(4.51);
    });
  });
});
