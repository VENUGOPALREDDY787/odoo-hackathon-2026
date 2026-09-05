import { describe, it, expect } from '@jest/globals';
import { calculateBlendedRisk, routeApproval } from '../services/riskScorer.js';

describe('riskScorer - Pure Discount Governance Scoring & Routing', () => {
  const discountTiers = [
    {
      id: 'tier-1',
      customer_tier: 'Gold',
      category_id: 'cat-hardware',
      discount_percent: 10.0,
      is_active: true,
    },
    {
      id: 'tier-2',
      customer_tier: 'Gold',
      category_id: 'cat-service',
      discount_percent: 15.0,
      is_active: true,
    },
    {
      id: 'tier-3',
      customer_tier: 'Bronze',
      category_id: 'cat-hardware',
      discount_percent: 5.0,
      is_active: true,
    },
  ];

  const approvalChains = [
    {
      id: 'chain-1',
      name: 'Manager Approval Required',
      min_discount_percent: 0.01,
      max_discount_percent: 10.0,
      required_approver_roles: ['manager'],
      min_approvals_required: 1,
      is_active: true,
    },
    {
      id: 'chain-2',
      name: 'Executive & Finance Approval Required',
      min_discount_percent: 10.01,
      max_discount_percent: 50.0,
      required_approver_roles: ['manager', 'finance'],
      min_approvals_required: 2,
      is_active: true,
    },
  ];

  describe('calculateBlendedRisk', () => {
    it('literal test case: Gold customer, Hardware fine, Service line 8pts over', () => {
      const quotationLines = [
        {
          line_number: 1,
          category_id: 'cat-hardware',
          discount_percent: 5.0, // 5% vs 10% ceiling -> 0 violation points
        },
        {
          line_number: 2,
          category_id: 'cat-service',
          discount_percent: 23.0, // 23% vs 15% ceiling -> 8 violation points
        },
      ];

      const result = calculateBlendedRisk(quotationLines, discountTiers, 'Gold');

      expect(result.blendedScore).toBe(8);
      expect(result.maxSingleViolation).toBe(8);
      expect(result.requiresApproval).toBe(true);
      expect(result.lineDetails).toHaveLength(2);
      expect(result.lineDetails[0].violation_points).toBe(0);
      expect(result.lineDetails[0].has_violation).toBe(false);
      expect(result.lineDetails[1].violation_points).toBe(8);
      expect(result.lineDetails[1].has_violation).toBe(true);
    });

    it('returns blendedScore = 0 when all lines are within discount ceilings', () => {
      const quotationLines = [
        { line_number: 1, category_id: 'cat-hardware', discount_percent: 8.0 },
        { line_number: 2, category_id: 'cat-service', discount_percent: 12.0 },
      ];

      const result = calculateBlendedRisk(quotationLines, discountTiers, 'Gold');

      expect(result.blendedScore).toBe(0);
      expect(result.maxSingleViolation).toBe(0);
      expect(result.requiresApproval).toBe(false);
    });

    it('sums violation points across ALL lines and identifies maxSingleViolation', () => {
      const quotationLines = [
        { line_number: 1, category_id: 'cat-hardware', discount_percent: 14.0 }, // 14% - 10% = 4
        { line_number: 2, category_id: 'cat-service', discount_percent: 22.5 },  // 22.5% - 15% = 7.5
      ];

      const result = calculateBlendedRisk(quotationLines, discountTiers, 'Gold');

      expect(result.blendedScore).toBe(11.5);
      expect(result.maxSingleViolation).toBe(7.5);
      expect(result.requiresApproval).toBe(true);
    });
  });

  describe('routeApproval', () => {
    it('returns no approval required when blendedScore = 0', () => {
      const result = routeApproval(0, approvalChains);

      expect(result.requires_approval).toBe(false);
      expect(result.required_roles).toEqual([]);
      expect(result.min_approvals_required).toBe(0);
    });

    it('routes to manager role when blendedScore falls into 0.01 - 10.0 range', () => {
      const result = routeApproval(8, approvalChains);

      expect(result.requires_approval).toBe(true);
      expect(result.blended_score).toBe(8);
      expect(result.required_roles).toEqual(['manager']);
      expect(result.min_approvals_required).toBe(1);
    });

    it('routes to manager and finance when blendedScore is high (e.g. 15)', () => {
      const result = routeApproval(15, approvalChains);

      expect(result.requires_approval).toBe(true);
      expect(result.blended_score).toBe(15);
      expect(result.required_roles).toEqual(['manager', 'finance']);
      expect(result.min_approvals_required).toBe(2);
    });

    it('ignores inactive tiers and parses serialized approver roles', () => {
      const risk = calculateBlendedRisk(
        [{ category_id: 'cat-hardware', discount_percent: 30 }],
        [
          { category_id: 'cat-hardware', customer_tier: 'Gold', discount_percent: 25, is_active: false },
          { category_id: 'cat-hardware', customer_tier: 'Gold', discount_percent: 10, is_active: true },
        ],
        'Gold'
      );
      const result = routeApproval(risk.blendedScore, [{
        id: 'chain-serialized',
        min_discount_percent: 1,
        max_discount_percent: 100,
        required_approver_roles: '["manager"]',
        min_approvals_required: 1,
        is_active: true,
      }]);

      expect(risk.blendedScore).toBe(20);
      expect(result.required_roles).toEqual(['manager']);
    });
  });
});
