import { container } from '../../../container/index.js';
import { AuthenticationError, AuthorizationError } from '../../../errors/AppError.js';

export function authenticate() {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AuthenticationError('Authorization header required');
    }

    const token = authHeader.slice(7);
    const authService = container.get('authService');

    try {
      const decoded = authService.verifyAccessToken(token);
      const user = await authService.getProfile(decoded.sub);
      req.user = user;
      req.token = token;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new AuthenticationError('Access token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new AuthenticationError('Invalid access token');
      }
      throw error;
    }
  };
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AuthorizationError(`Requires one of roles: ${allowedRoles.join(', ')}`);
    }

    next();
  };
}

export function requireInternal() {
  return (req, res, next) => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    if (req.user.role === 'customer') {
      throw new AuthorizationError('Internal access required');
    }

    next();
  };
}

export function requireCustomer() {
  return (req, res, next) => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    if (req.user.role !== 'customer') {
      throw new AuthorizationError('Customer access required');
    }

    next();
  };
}

export function requireOwnershipOrRole(resourceUserIdField = 'assigned_rep_id', ...allowedRoles) {
  return async (req, res, next) => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    if (req.user.role === 'rep') {
      const resourceId = req.params.id || req.params.quotationId || req.body.quotation_id;
      if (!resourceId) {
        return next();
      }

      const db = container.get('database');
      const resource = await db('quotations')
        .where({ id: resourceId, deleted_at: null })
        .select(resourceUserIdField)
        .first();

      if (!resource) {
        throw new AuthorizationError('Resource not found');
      }

      if (resource[resourceUserIdField] !== req.user.id) {
        throw new AuthorizationError('You can only access your own resources');
      }
    }

    next();
  };
}

export function optionalAuth() {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.slice(7);
    const authService = container.get('authService');

    try {
      const decoded = authService.verifyAccessToken(token);
      const user = await authService.getProfile(decoded.sub);
      req.user = user;
      req.token = token;
    } catch (error) {
    }

    next();
  };
}

export const canManageUsers = requireRole('admin');
export const canManageFinance = requireRole('admin', 'finance');
export const canManageApprovals = requireRole('admin', 'manager', 'finance');
export const canViewReports = requireRole('admin', 'manager', 'finance');
export const canManageProducts = requireRole('admin', 'manager');
export const canManageDiscounts = requireRole('admin', 'manager', 'finance');
export const canManageWarehouses = requireRole('admin', 'manager');
export const canManageSubscriptions = requireRole('admin', 'manager', 'finance');
export const canManageUpsell = requireRole('admin', 'manager');
export const canNegotiate = requireRole('admin', 'manager', 'rep');
export const canViewDealHealth = requireRole('admin', 'manager', 'rep');

export default {
  authenticate,
  requireRole,
  requireInternal,
  requireCustomer,
  requireOwnershipOrRole,
  optionalAuth,
  canManageUsers,
  canManageFinance,
  canManageApprovals,
  canViewReports,
  canManageProducts,
  canManageDiscounts,
  canManageWarehouses,
  canManageSubscriptions,
  canManageUpsell,
  canNegotiate,
  canViewDealHealth,
};