import { describe, it, expect } from '@jest/globals';
import { calculateProration } from '../services/prorationCalculator.js';

describe('prorationCalculator - Pure Integer-Cents Proration Engine', () => {
  it('calculates mid-cycle cancellation credit note amount correctly (newQty = 0)', () => {
    // 5 units at $10.00/month ($50.00/month). 15 days remaining out of 30 days in cycle.
    // Unused 15/30 = 0.5 cycle. Credit = 5 * 10 * 0.5 = -$25.00
    const result = calculateProration(5, 0, 10.00, 15, 30);

    expect(result.is_credit_note).toBe(true);
    expect(result.prorated_amount).toBe(-25.00);
    expect(result.prorated_cents).toBe(-2500);
    expect(result.delta_quantity).toBe(-5);
  });

  it('handles upgrade mid-cycle with positive charge', () => {
    // Upgrade from 2 to 5 units at $29.99/month. 10 days remaining out of 30.
    // deltaQty = 3. 3 * 29.99 = 89.97. 89.97 * (10/30) = $29.99
    const result = calculateProration(2, 5, 29.99, 10, 30);

    expect(result.is_credit_note).toBe(false);
    expect(result.prorated_amount).toBe(29.99);
    expect(result.prorated_cents).toBe(2999);
  });

  it('avoids floating point arithmetic errors with tricky decimal prices', () => {
    // $19.99 per unit, 10 units, 7 days remaining out of 31 days.
    // $19.99 * 100 = 1999 cents.
    // deltaQty = -10 (cancellation).
    // fullCycleDeltaCents = -19990.
    // proratedCents = round(-19990 * 7 / 31) = round(-4513.87) = -4514 cents (-$45.14).
    const result = calculateProration(10, 0, 19.99, 7, 31);

    expect(result.prorated_cents).toBe(-4514);
    expect(result.prorated_amount).toBe(-45.14);
    expect(Number.isInteger(result.prorated_cents)).toBe(true);
  });

  it('returns 0 when 0 days remaining in cycle', () => {
    const result = calculateProration(5, 0, 100.00, 0, 30);

    expect(result.prorated_amount).toBe(0);
    expect(result.prorated_cents).toBe(0);
  });
});
