import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { container } from '../../../container/index.js';
import {
  authenticate,
  requireRole,
  authorize,
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
} from '../middleware/auth.js';

const router = Router();

function getController() {
  return container.get('authController');
}

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${req.body?.email || 'unknown'}`,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts. Please try again in 15 minutes.',
        details: null,
      },
    });
  },
});

const magicLinkRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${req.body?.email || 'unknown'}`,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many magic link requests. Please try again in an hour.',
        details: null,
      },
    });
  },
});

router.post('/register/internal', authRateLimiter, authenticate(), canManageUsers, (req, res, next) => getController().registerInternal(req, res, next));
router.post('/register/customer', authRateLimiter, (req, res, next) => getController().registerCustomer(req, res, next));
router.post('/login', authRateLimiter, (req, res, next) => getController().loginInternal(req, res, next));

router.post('/magic-link/request', magicLinkRateLimiter, (req, res, next) => getController().requestMagicLink(req, res, next));
router.post('/magic-link/verify', (req, res, next) => getController().verifyMagicLink(req, res, next));

router.post('/refresh', (req, res, next) => getController().refresh(req, res, next));
router.post('/logout', authenticate(), (req, res, next) => getController().logout(req, res, next));
router.post('/logout-all', authenticate(), (req, res, next) => getController().logoutAll(req, res, next));

router.get('/profile', authenticate(), (req, res, next) => getController().profile(req, res, next));
router.put('/profile', authenticate(), (req, res, next) => getController().updateProfile(req, res, next));
router.post('/change-password', authenticate(), (req, res, next) => getController().changePassword(req, res, next));
router.post('/set-password', authenticate(), (req, res, next) => getController().setPassword(req, res, next));

export {
  authenticate,
  requireRole,
  authorize,
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

export default router;