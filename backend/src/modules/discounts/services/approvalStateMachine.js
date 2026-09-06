import { ValidationError, ForbiddenError } from '../../../errors/AppError.js';

export const QUOTATION_STATUSES = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SENT: 'sent',
  ACCEPTED: 'accepted',
};

export const APPROVAL_ACTIONS = {
  APPROVE: 'approve',
  REJECT: 'reject',
  RETURN_FOR_REVISION: 'return_for_revision',
};

/**
 * Explicit state machine transition table for quotation lifecycle.
 * Format:
 * [currentStatus]: {
 *   [action]: {
 *     targetStatus: '...',
 *     allowedUserRoles: ['...'],
 *   }
 * }
 */
export const APPROVAL_TRANSITION_MATRIX = {
  [QUOTATION_STATUSES.PENDING_APPROVAL]: {
    [APPROVAL_ACTIONS.APPROVE]: {
      allowedUserRoles: ['manager', 'finance', 'admin'],
      // Target status is dynamically calculated based on multi-step approval progression
    },
    [APPROVAL_ACTIONS.REJECT]: {
      targetStatus: QUOTATION_STATUSES.REJECTED,
      allowedUserRoles: ['manager', 'finance', 'admin'],
    },
    [APPROVAL_ACTIONS.RETURN_FOR_REVISION]: {
      targetStatus: QUOTATION_STATUSES.DRAFT,
      allowedUserRoles: ['manager', 'finance', 'admin'],
    },
  },
  [QUOTATION_STATUSES.REJECTED]: {
    revise: {
      targetStatus: QUOTATION_STATUSES.DRAFT,
      allowedUserRoles: ['rep', 'manager', 'finance', 'admin'],
    },
  },
  [QUOTATION_STATUSES.APPROVED]: {
    fulfill: {
      targetStatus: 'fulfillment',
      allowedUserRoles: ['rep', 'manager', 'finance', 'admin'],
    },
    send: {
      targetStatus: QUOTATION_STATUSES.SENT,
      allowedUserRoles: ['rep', 'manager', 'finance', 'admin'],
    },
  },
};

/**
 * Validates and calculates the state transition for an approval action.
 * Enforces legal transitions, role restrictions, and multi-step approval routing (manager -> finance).
 * 
 * @param {Object} params
 * @param {string} params.currentStatus - Current quotation status
 * @param {string} params.action - Action requested ('approve', 'reject', 'return_for_revision')
 * @param {Object} params.user - User performing the action { id, role }
 * @param {Object} params.routingRequirements - Output of routeApproval { requiredRoles, minApprovals }
 * @param {Array<Object>} params.existingApprovalLogs - Array of approval_logs rows for this quotation
 * @returns {Object} { targetStatus, isFinalApproval, approvedRole }
 */
export function validateApprovalTransition({
  currentStatus,
  action,
  user,
  routingRequirements = { requiredRoles: ['manager'] },
  existingApprovalLogs = [],
}) {
  const normalizedRole = (user?.role || '').toLowerCase();
  let normalizedAction = (action || '').toLowerCase();
  if (normalizedAction === 'approved') normalizedAction = APPROVAL_ACTIONS.APPROVE;
  if (normalizedAction === 'rejected') normalizedAction = APPROVAL_ACTIONS.REJECT;
  if (normalizedAction === 'returned') normalizedAction = APPROVAL_ACTIONS.RETURN_FOR_REVISION;
  const normalizedStatus = (currentStatus || '').toLowerCase();

  // 1. Verify current status has handlers for requested action
  const statusTransitions = APPROVAL_TRANSITION_MATRIX[normalizedStatus];
  if (!statusTransitions) {
    throw new ValidationError(
      `Illegal transition attempt: Cannot perform action '${normalizedAction}' on quotation in status '${currentStatus}'.`
    );
  }

  const transitionRule = statusTransitions[normalizedAction];
  if (!transitionRule) {
    throw new ValidationError(
      `Illegal transition attempt: Action '${normalizedAction}' is not permitted for quotation in status '${currentStatus}'.`
    );
  }

  // 2. Verify user role permissions
  if (normalizedRole !== 'admin' && !transitionRule.allowedUserRoles.includes(normalizedRole)) {
    throw new ForbiddenError(
      `User with role '${user?.role}' is not authorized to perform action '${normalizedAction}'. Required roles: ${transitionRule.allowedUserRoles.join(', ')}.`
    );
  }

  // 3. Special handling for REJECT and RETURN_FOR_REVISION
  if (normalizedAction === APPROVAL_ACTIONS.REJECT) {
    return {
      targetStatus: QUOTATION_STATUSES.REJECTED,
      isFinalApproval: true,
      approvedRole: normalizedRole,
    };
  }

  if (normalizedAction === APPROVAL_ACTIONS.RETURN_FOR_REVISION) {
    return {
      targetStatus: QUOTATION_STATUSES.DRAFT,
      isFinalApproval: true,
      approvedRole: normalizedRole,
    };
  }

  // 4. APPROVE action logic with multi-step & route reachability checks
  const requiredRoles = (routingRequirements.requiredRoles || ['manager']).map(r => r.toLowerCase());
  const needsManager = requiredRoles.includes('manager');
  const needsFinance = requiredRoles.includes('finance');

  // Check if role is required in the routing. Finance counts as senior to
  // manager, so finance may cover a manager-only quotation; a genuine
  // dual-signoff chain (manager + finance) still requires BOTH steps below.
  if (normalizedRole !== 'admin' && !requiredRoles.includes(normalizedRole)) {
    const canCoverWithSeniority = normalizedRole === 'finance' && !needsFinance;
    if (!canCoverWithSeniority) {
      throw new ForbiddenError(
        `Finance/Manager approval is unreachable for this quotation: Role '${user?.role}' is not required by approval routing rules (${requiredRoles.join(', ')}).`
      );
    }
  }

  // Check existing approved logs for this quotation
  const safeLogs = Array.isArray(existingApprovalLogs) ? existingApprovalLogs : [];
  const previousApprovals = safeLogs
    .filter(log => log.action === 'approved' && !log.deleted_at)
    .map(log => (log.role_at_approval || '').toLowerCase());

  const managerAlreadyApproved = previousApprovals.includes('manager') || previousApprovals.includes('admin');
  const financeAlreadyApproved = previousApprovals.includes('finance');

  // Multi-step rule: on dual-signoff quotations finance CANNOT skip the
  // manager step — manager must sign off first.
  if (needsFinance && needsManager && normalizedRole === 'finance' && !managerAlreadyApproved) {
    throw new ValidationError(
      `Illegal step sequence: Finance approval cannot skip the required Manager approval step. Manager must approve first.`
    );
  }

  // Determine if this approval completes all requirements
  let isFinalApproval = false;
  let targetStatus = QUOTATION_STATUSES.PENDING_APPROVAL;

  if (normalizedRole === 'admin') {
    // Admin can complete any step or final approval
    isFinalApproval = true;
    targetStatus = QUOTATION_STATUSES.APPROVED;
  } else if (needsManager && needsFinance) {
    if (normalizedRole === 'manager') {
      if (financeAlreadyApproved) {
        isFinalApproval = true;
        targetStatus = QUOTATION_STATUSES.APPROVED;
      } else {
        isFinalApproval = false;
        targetStatus = QUOTATION_STATUSES.PENDING_APPROVAL; // Still pending finance
      }
    } else if (normalizedRole === 'finance') {
      if (managerAlreadyApproved) {
        isFinalApproval = true;
        targetStatus = QUOTATION_STATUSES.APPROVED;
      } else {
        throw new ValidationError(`Manager approval is required before finance approval.`);
      }
    }
  } else {
    // Single-step required role (only manager OR only finance)
    isFinalApproval = true;
    targetStatus = QUOTATION_STATUSES.APPROVED;
  }

  return {
    targetStatus,
    isFinalApproval,
    approvedRole: normalizedRole,
    managerAlreadyApproved,
    financeAlreadyApproved,
  };
}

export default {
  QUOTATION_STATUSES,
  APPROVAL_ACTIONS,
  APPROVAL_TRANSITION_MATRIX,
  validateApprovalTransition,
};
