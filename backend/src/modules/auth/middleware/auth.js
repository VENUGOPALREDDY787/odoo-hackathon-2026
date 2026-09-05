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

export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } });
    }
    return next();
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

export function requireQuotationAccess(...managerRoles) {
  return async (req, res, next) => {
    if (!req.user) { throw new AuthenticationError('Authentication required'); }
    if (managerRoles.includes(req.user.role)) { return next(); }

    const quotationId = req.params.id || req.params.quotationId || req.body.quotation_id;
    if (!quotationId) { throw new AuthorizationError('Quotation reference required'); }

    const db = container.get('database');
    const quotation = await db('quotations as q')
      .leftJoin('customers as c', 'c.id', 'q.customer_id')
      .where({ 'q.id': quotationId, 'q.deleted_at': null })
      .select('q.assigned_rep_id', 'c.user_id as customer_user_id')
      .first();

    if (!quotation) { throw new AuthorizationError('Quotation not found'); }
    const permitted = req.user.role === 'rep'
      ? quotation.assigned_rep_id === req.user.id
      : req.user.role === 'customer' && quotation.customer_user_id === req.user.id;
    if (!permitted) { throw new AuthorizationError('You cannot access this quotation'); }
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
export const canManageProducts = requireRole('admin');
export const canManageDiscounts = requireRole('admin', 'manager', 'finance');
export const canManageWarehouses = requireRole('admin', 'manager');
export const canManageSubscriptions = requireRole('admin', 'manager', 'finance');
export const canManageUpsell = requireRole('admin', 'manager');
export const canNegotiate = requireRole('admin', 'manager', 'rep');
export const canViewDealHealth = requireRole('admin', 'manager', 'rep');

export default {
  authenticate,
  requireRole,
  authorize,
  requireInternal,
  requireCustomer,
  requireOwnershipOrRole,
  requireQuotationAccess,
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