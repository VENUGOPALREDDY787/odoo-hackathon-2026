import queueAdminRoutes from './routes/index.js';
import { QueueAdminController } from './controllers/QueueAdminController.js';
import { QueueAdminService } from './services/QueueAdminService.js';

export function registerQueueAdminModule(container) {
  container.register('queueAdminService', (c) => new QueueAdminService(c.get('database'), c.get('logger')));
  container.register('queueAdminController', (c) => new QueueAdminController(c.get('queueAdminService')));
  container.register('queueAdminRoutes', () => queueAdminRoutes);
}

export default registerQueueAdminModule;
