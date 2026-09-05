import { negotiate } from '../services/negotiate.js';

describe('negotiate - Pure Negotiation Engine', () => {
  it('fails immediately if buyerMax is below sellerMin', () => {
    const result = negotiate({
      sellerMin: 1000,
      sellerMax: 1500,
      buyerMin: 500,
      buyerMax: 900,
    });

    expect(result.result).toBe('FAILED');
    expect(result.reason).toContain('Buyer ceiling is below seller floor');
    expect(result.totalRounds).toBe(0);
  });

  it('reaches DEAL when offers converge within maxRounds', () => {
    // Both move 5% per round
    const result = negotiate({
      sellerMin: 1000,
      sellerMax: 1200,
      buyerMin: 800,
      buyerMax: 1100,
      stepPercent: 5,
      maxRounds: 10,
    });

    expect(result.result).toBe('DEAL');
    expect(result.finalPrice).toBeGreaterThanOrEqual(1000);
    expect(result.finalPrice).toBeLessThanOrEqual(1100);
    expect(result.totalRounds).toBeGreaterThan(0);
    expect(result.totalRounds).toBeLessThan(10);
    expect(result.rounds.length).toBeGreaterThan(0);
  });

  it('reaches FAILED if maxRounds exhausted without convergence', () => {
    const result = negotiate({
      sellerMin: 1000,
      sellerMax: 1200,
      buyerMin: 800,
      buyerMax: 1100,
      stepPercent: 1, // Moves very slowly, won't converge in 2 rounds
      maxRounds: 2,
    });

    expect(result.result).toBe('FAILED');
    expect(result.finalPrice).toBeNull();
    expect(result.totalRounds).toBe(2);
    expect(result.rounds).toHaveLength(2);
    expect(result.finalSellerOffer).toBeLessThan(1200);
    expect(result.finalBuyerOffer).toBeGreaterThan(800);
  });

  it('accepts deal via convergenceThreshold even before exact cross', () => {
    const result = negotiate({
      sellerMin: 1000, // floor is 1000
      sellerMax: 1100,
      buyerMin: 1000,
      buyerMax: 1080,
      stepPercent: 0, // No movement to isolate threshold behavior
      convergenceThreshold: 0.1, // 10% of 1000 = 100.
      maxRounds: 5,
    });

    // Initial gap is 1100 - 1000 = 100. Gap <= threshold (100 <= 100).
    // Should deal immediately on round 1.
    expect(result.result).toBe('DEAL');
    expect(result.totalRounds).toBe(1);
    expect(result.rounds[0].status).toBe('DEAL_CONVERGENCE');
    expect(result.finalPrice).toBe(1050); // (1100 + 1000) / 2
  });
});
