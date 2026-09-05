import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  validateApprovalTransition,
  QUOTATION_STATUSES,
  APPROVAL_ACTIONS,
} from '../services/approvalStateMachine.js';
import { DiscountService } from '../services/DiscountService.js';
import { ValidationError, ForbiddenError } from '../../../errors/AppError.js';

describe('Approval State Machine Unit Tests', () => {
  describe('validateApprovalTransition - Legal & Illegal Graph Transitions', () => {
    it('allows manager approval when quotation is pending_approval and manager is required', () => {
      const result = validateApprovalTransition({
        currentStatus: QUOTATION_STATUSES.PENDING_APPROVAL,
        action: APPROVAL_ACTIONS.APPROVE,
        user: { id: 'usr-mgr-1', role: 'manager' },
        routingRequirements: { requiredRoles: ['manager'], minApprovals: 1 },
        existingApprovalLogs: [],
      });

      expect(result.targetStatus).toBe(QUOTATION_STATUSES.APPROVED);
      expect(result.isFinalApproval).toBe(true);
      expect(result.approvedRole).toBe('manager');
    });

    it('rejects approval attempt when quotation is in draft status', () => {
      expect(() =>
        validateApprovalTransition({
          currentStatus: QUOTATION_STATUSES.DRAFT,
          action: APPROVAL_ACTIONS.APPROVE,
          user: { id: 'usr-mgr-1', role: 'manager' },
          routingRequirements: { requiredRoles: ['manager'] },
          existingApprovalLogs: [],
        })
      ).toThrow(ValidationError);
    });

    it('rejects approval attempt when quotation is already approved', () => {
      expect(() =>
        validateApprovalTransition({
          currentStatus: QUOTATION_STATUSES.APPROVED,
          action: APPROVAL_ACTIONS.APPROVE,
          user: { id: 'usr-mgr-1', role: 'manager' },
          routingRequirements: { requiredRoles: ['manager'] },
          existingApprovalLogs: [],
        })
      ).toThrow(ValidationError);
    });

    it('allows rejection from pending_approval to move status to rejected', () => {
      const result = validateApprovalTransition({
        currentStatus: QUOTATION_STATUSES.PENDING_APPROVAL,
        action: APPROVAL_ACTIONS.REJECT,
        user: { id: 'usr-mgr-1', role: 'manager' },
        routingRequirements: { requiredRoles: ['manager'] },
        existingApprovalLogs: [],
      });

      expect(result.targetStatus).toBe(QUOTATION_STATUSES.REJECTED);
      expect(result.isFinalApproval).toBe(true);
    });

    it('allows return_for_revision from pending_approval to move status back to draft', () => {
      const result = validateApprovalTransition({
        currentStatus: QUOTATION_STATUSES.PENDING_APPROVAL,
        action: APPROVAL_ACTIONS.RETURN_FOR_REVISION,
        user: { id: 'usr-mgr-1', role: 'manager' },
        routingRequirements: { requiredRoles: ['manager'] },
        existingApprovalLogs: [],
      });

      expect(result.targetStatus).toBe(QUOTATION_STATUSES.DRAFT);
      expect(result.isFinalApproval).toBe(true);
    });
  });

  describe('Role Reachability & Multi-Step Sequence Enforcement', () => {
    it('rejects finance user trying to approve a manager-only quotation', () => {
      expect(() =>
        validateApprovalTransition({
          currentStatus: QUOTATION_STATUSES.PENDING_APPROVAL,
          action: APPROVAL_ACTIONS.APPROVE,
          user: { id: 'usr-fin-1', role: 'finance' },
          routingRequirements: { requiredRoles: ['manager'], minApprovals: 1 },
          existingApprovalLogs: [],
        })
      ).toThrow(ForbiddenError);
    });

    it('rejects finance user skipping manager step on a multi-step (manager + finance) quotation', () => {
      expect(() =>
        validateApprovalTransition({
          currentStatus: QUOTATION_STATUSES.PENDING_APPROVAL,
          action: APPROVAL_ACTIONS.APPROVE,
          user: { id: 'usr-fin-1', role: 'finance' },
          routingRequirements: { requiredRoles: ['manager', 'finance'], minApprovals: 2 },
          existingApprovalLogs: [], // No manager approval log present!
        })
      ).toThrow(ValidationError);
    });

    it('allows manager approval on multi-step quotation, keeping status pending_approval until finance approves', () => {
      const step1 = validateApprovalTransition({
        currentStatus: QUOTATION_STATUSES.PENDING_APPROVAL,
        action: APPROVAL_ACTIONS.APPROVE,
        user: { id: 'usr-mgr-1', role: 'manager' },
        routingRequirements: { requiredRoles: ['manager', 'finance'], minApprovals: 2 },
        existingApprovalLogs: [],
      });

      expect(step1.targetStatus).toBe(QUOTATION_STATUSES.PENDING_APPROVAL);
      expect(step1.isFinalApproval).toBe(false);

      // Simulate manager approval logged
      const existingLogs = [
        { quotation_id: 'q-1', approver_id: 'usr-mgr-1', role_at_approval: 'manager', action: 'approved' },
      ];

      const step2 = validateApprovalTransition({
        currentStatus: QUOTATION_STATUSES.PENDING_APPROVAL,
        action: APPROVAL_ACTIONS.APPROVE,
        user: { id: 'usr-fin-1', role: 'finance' },
        routingRequirements: { requiredRoles: ['manager', 'finance'], minApprovals: 2 },
        existingApprovalLogs: existingLogs,
      });

      expect(step2.targetStatus).toBe(QUOTATION_STATUSES.APPROVED);
      expect(step2.isFinalApproval).toBe(true);
    });
  });

  describe('DiscountService processApprovalAction - Integration & Health Alerts', () => {
    let mockDb;
    let service;
    let queryBuilderMock;

    beforeEach(() => {
      queryBuilderMock = {
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        first: jest.fn(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue(1),
        returning: jest.fn().mockResolvedValue(['log-uuid-1']),
        orderBy: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
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

      service = new DiscountService(mockDb);
    });

    it('creates deal_health_alerts record when quotation is returned for revision >= 2 times', async () => {
      const sampleQuotation = {
        id: 'q-uuid-123',
        quotation_number: 'QT-2026-00099',
        status: QUOTATION_STATUSES.PENDING_APPROVAL,
        version: 1,
        blended_risk_score: 5.0,
      };

      queryBuilderMock.first
        .mockResolvedValueOnce(sampleQuotation) // quotation check
        .mockResolvedValueOnce({ count: 1 }); // return count before current action (1 existing return)

      const result = await service.processApprovalAction({
        quotationId: 'q-uuid-123',
        action: 'return_for_revision',
        user: { id: 'usr-mgr-1', role: 'manager' },
        comments: 'Discount too high, please reduce line 2 price.',
      });

      expect(result.status).toBe(QUOTATION_STATUSES.DRAFT);
      expect(result.health_alert_created).toBe(true);
      expect(queryBuilderMock.insert).toHaveBeenCalled();
    });
  });
});
