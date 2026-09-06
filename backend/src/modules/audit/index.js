import auditRoutes from './routes/index.js';
import AuditController from './controllers/AuditController.js';
import AuditService from './services/AuditService.js';
import { AuditTrailRepository } from '../discounts/repositories/DiscountRepository.js';

export function registerAuditModule(container) {
  container.register('auditTrailRepository', (c) => new AuditTrailRepository(c.get('database')));
  container.register('auditService', (c) => new AuditService(c.get('database'), c.get('logger')));
  container.register('auditController', (c) => new AuditController(c.get('auditService')));
  container.register('auditRoutes', () => auditRoutes);
}

export default registerAuditModule;
