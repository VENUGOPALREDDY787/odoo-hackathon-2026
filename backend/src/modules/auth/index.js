import authRoutes, {
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
} from './routes/index.js';
import AuthController from './controllers/AuthController.js';
import AuthService from './services/AuthService.js';

export function registerAuthModule(container) {
  container.register('authService', (c) => new AuthService(c.get('database'), c.get('logger'), c.get('config'), c.get('emailService')));
  container.register('authController', (c) => new AuthController(c.get('authService')));
  container.register('authRoutes', () => authRoutes);
}

export {
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

export default registerAuthModule;