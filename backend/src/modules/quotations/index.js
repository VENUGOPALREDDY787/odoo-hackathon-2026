import quotationRoutes from './routes/index.js';
import QuotationController from './controllers/QuotationController.js';
import QuotationService from './services/QuotationService.js';
import {
  QuotationRepository,
  QuotationLineRepository,
  IdempotencyKeyRepository,
} from './repositories/QuotationRepository.js';

export function registerQuotationModule(container) {
  container.register('quotationRepository', (c) => new QuotationRepository(c.get('database')));
  container.register('quotationLineRepository', (c) => new QuotationLineRepository(c.get('database')));
  container.register('idempotencyKeyRepository', (c) => new IdempotencyKeyRepository(c.get('database')));

  container.register('quotationService', (c) => new QuotationService(c.get('database'), c.get('logger')));
  container.register('quotationController', (c) => new QuotationController(c.get('quotationService')));
  container.register('quotationsRoutes', () => quotationRoutes);
}

export default registerQuotationModule;
