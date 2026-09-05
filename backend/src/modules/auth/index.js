import authRoutes, { authenticate, authorize } from './routes/index.js';
import AuthController from './controllers/AuthController.js';
import AuthService from './services/AuthService.js';

export function registerAuthModule(container) {
  container.register('authService', (c) => new AuthService(c.get('database'), c.get('logger'), c.get('config')));
  container.register('authController', (c) => new AuthController(c.get('authService')));
  container.register('authRoutes', () => authRoutes);
}

export { authenticate, authorize };

export default registerAuthModule;