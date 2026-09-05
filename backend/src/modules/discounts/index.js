import discountRoutes from './routes/index.js';
import DiscountController from './controllers/DiscountController.js';
import DiscountService from './services/DiscountService.js';
import {
  DiscountTierRepository,
  ApprovalChainRepository,
  ApprovalLogRepository,
  AuditTrailRepository,
} from './repositories/DiscountRepository.js';

export function registerDiscountModule(container) {
  container.register('discountTierRepository', (c) => new DiscountTierRepository(c.get('database')));
  container.register('approvalChainRepository', (c) => new ApprovalChainRepository(c.get('database')));
  container.register('approvalLogRepository', (c) => new ApprovalLogRepository(c.get('database')));
  container.register('auditTrailRepository', (c) => new AuditTrailRepository(c.get('database')));

  container.register('discountService', (c) => new DiscountService(c.get('database'), c.get('logger')));
  container.register('discountController', (c) => new DiscountController(c.get('discountService')));
  container.register('discountsRoutes', () => discountRoutes);
}

export default registerDiscountModule;
