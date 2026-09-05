import { Router } from 'express';
import { container } from '../../../container/index.js';
import { hasPermission } from '../permissions.js';

const router = Router();

function getController() {
  return container.get('authController');
}

router.post('/register', (req, res, next) => getController().register(req, res, next));
router.post('/login', (req, res, next) => getController().login(req, res, next));
router.post('/refresh', (req, res, next) => getController().refresh(req, res, next));

router.get('/profile', authenticate(), (req, res, next) => getController().profile(req, res, next));
router.put('/profile', authenticate(), (req, res, next) => getController().updateProfile(req, res, next));
router.post('/change-password', authenticate(), (req, res, next) => getController().changePassword(req, res, next));

export default router;

export function authenticate() {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        error: { code: 'AUTHENTICATION_ERROR', message: 'Authorization header required', details: null },
      });
    }

    const token = authHeader.slice(7);
    const authService = container.get('authService');

    try {
      const decoded = authService.verifyAccessToken(token);
      const user = await authService.getProfile(decoded.sub);
      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({
        error: { code: 'AUTHENTICATION_ERROR', message: 'Invalid or expired token', details: null },
      });
    }
  };
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: 'AUTHENTICATION_ERROR', message: 'Authentication required', details: null },
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: { code: 'AUTHORIZATION_ERROR', message: 'Insufficient permissions', details: null },
      });
    }

    next();
  };
}

export function authorizePermission(resource, action) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: 'AUTHENTICATION_ERROR', message: 'Authentication required', details: null },
      });
    }

    if (!hasPermission(req.user.role, resource, action)) {
      return res.status(403).json({
        error: { code: 'AUTHORIZATION_ERROR', message: 'Insufficient permissions', details: { resource, action } },
      });
    }

    next();
  };
}