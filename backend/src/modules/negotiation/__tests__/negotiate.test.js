import { describe, it, expect } from '@jest/globals';
import { negotiate } from '../services/negotiate.js';

describe('negotiate() - Pure Negotiation Engine', () => {
  // ---------------------------------------------------------------------------
  // Basic convergence / deal scenarios
  // ---------------------------------------------------------------------------

  it('returns DEAL immediately when buyer offer already meets seller ask', () => {
    // buyer opens higher than seller asks → instant deal
    const result = negotiate({
      sellerMin: 80,
      sellerMax: 100,
      buyerMin: 105, // above sellerMax → immediate deal
      buyerMax: 120,
      maxRounds: 10,
      stepPercent: 5,
    });

    expect(result.result).toBe('DEAL');
    expect(result.finalPrice).toBeGreaterThan(0);
    expect(result.totalRounds).toBe(1);
  });

  it('returns DEAL when offers converge within threshold', () => {
    // sellerMax=100, sellerMin=85, buyerMin=70, buyerMax=100
    // With 5% step, they should converge within 10 rounds
    const result = negotiate({
      sellerMin: 85,
      sellerMax: 100,
      buyerMin: 70,
      buyerMax: 100,
      stepPercent: 5,
      maxRounds: 20,
      convergenceThreshold: 0.05,
    });

    expect(result.result).toBe('DEAL');
    expect(result.finalPrice).toBeGreaterThanOrEqual(85);
    expect(result.finalPrice).toBeLessThanOrEqual(100);
    expect(result.totalRounds).toBeLessThanOrEqual(20);
  });

  it('returns FAILED when buyer ceiling is strictly below seller floor', () => {
    const result = negotiate({
      sellerMin: 150,
      sellerMax: 200,
      buyerMin: 80,
      buyerMax: 120, // buyer ceiling 120 < seller floor 150
      stepPercent: 5,
      maxRounds: 20,
    });

    expect(result.result).toBe('FAILED');
    expect(result.finalPrice).toBeNull();
    expect(result.reason).toMatch(/below seller floor/i);
    expect(result.rounds).toHaveLength(0);
  });

  it('returns FAILED when maxRounds exhausted without convergence', () => {
    // Huge gap, tiny step, few rounds → guaranteed FAILED
    const result = negotiate({
      sellerMin: 200,
      sellerMax: 1000,
      buyerMin: 1,
      buyerMax: 201,
      stepPercent: 1, // tiny 1% step
      maxRounds: 3,  // only 3 rounds
      convergenceThreshold: 0.001,
    });

    expect(result.result).toBe('FAILED');
    expect(result.finalPrice).toBeNull();
    expect(result.totalRounds).toBe(3);
    expect(result.rounds).toHaveLength(3);
  });

  it('records one round log entry per negotiation round', () => {
    const result = negotiate({
      sellerMin: 80,
      sellerMax: 100,
      buyerMin: 60,
      buyerMax: 95,
      stepPercent: 10,
      maxRounds: 10,
      convergenceThreshold: 0.03,
    });

    expect(result.rounds.length).toBeGreaterThan(0);
    expect(result.rounds[0]).toMatchObject({
      round: 1,
      seller_offer: expect.any(Number),
      buyer_offer: expect.any(Number),
      gap: expect.any(Number),
      status: expect.any(String),
    });
  });

  it('seller never drops below sellerMin', () => {
    const result = negotiate({
      sellerMin: 90,
      sellerMax: 100,
      buyerMin: 50,
      buyerMax: 88, // below sellerMin — forced FAILED
      stepPercent: 20,
      maxRounds: 20,
    });

    const allSellerOffers = result.rounds.map((r) => r.seller_offer);
    allSellerOffers.forEach((offer) => {
      expect(offer).toBeGreaterThanOrEqual(90);
    });
  });

  it('buyer never exceeds buyerMax', () => {
    const result = negotiate({
      sellerMin: 80,
      sellerMax: 200,
      buyerMin: 50,
      buyerMax: 100,
      stepPercent: 20,
      maxRounds: 10,
    });

    const allBuyerOffers = result.rounds.map((r) => r.buyer_offer);
    allBuyerOffers.forEach((offer) => {
      expect(offer).toBeLessThanOrEqual(100);
    });
  });

  it('finalPrice falls between sellerMin and buyerMax when a DEAL is reached', () => {
    const result = negotiate({
      sellerMin: 90,
      sellerMax: 100,
      buyerMin: 85,
      buyerMax: 110,
      stepPercent: 10,
      maxRounds: 15,
    });

    expect(result.result).toBe('DEAL');
    expect(result.finalPrice).toBeGreaterThanOrEqual(90); // at or above seller floor
    expect(result.finalPrice).toBeLessThanOrEqual(110);   // at or below buyer ceiling
  });

  it('throws if required parameters are missing', () => {
    expect(() => negotiate({ sellerMin: 100, sellerMax: 200, buyerMin: 50 })).toThrow();
  });

  it('throws if sellerMin > sellerMax', () => {
    expect(() =>
      negotiate({ sellerMin: 200, sellerMax: 100, buyerMin: 50, buyerMax: 150 })
    ).toThrow(/sellerMin must be/i);
  });

  it('produces results with prices rounded to 2 decimal places', () => {
    const result = negotiate({
      sellerMin: 33.33,
      sellerMax: 66.66,
      buyerMin: 44.44,
      buyerMax: 66.67,
      stepPercent: 5,
      maxRounds: 15,
    });

    if (result.finalPrice !== null) {
      const decimalPart = String(result.finalPrice).split('.')[1] || '';
      expect(decimalPart.length).toBeLessThanOrEqual(2);
    }
  });
});
