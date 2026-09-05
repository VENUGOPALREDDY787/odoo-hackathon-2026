import subscriptionRoutes from './routes/index.js';
import SubscriptionController from './controllers/SubscriptionController.js';
import SubscriptionService from './services/SubscriptionService.js';
import {
  SubscriptionPlanRepository,
  BillingScheduleRepository,
} from './repositories/SubscriptionRepository.js';

export function registerSubscriptionModule(container) {
  container.register('subscriptionPlanRepository', (c) => new SubscriptionPlanRepository(c.get('database')));
  container.register('billingScheduleRepository', (c) => new BillingScheduleRepository(c.get('database')));

  container.register('subscriptionService', (c) => new SubscriptionService(c.get('database'), c.get('logger')));
  container.register('subscriptionController', (c) => new SubscriptionController(c.get('subscriptionService')));
  container.register('subscriptionsRoutes', () => subscriptionRoutes);
}

export default registerSubscriptionModule;
