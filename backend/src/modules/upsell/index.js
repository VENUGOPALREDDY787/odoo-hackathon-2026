import upsellRoutes from './routes/index.js';
import UpsellController from './controllers/UpsellController.js';
import UpsellService from './services/UpsellService.js';

export function registerUpsellModule(container) {
  container.register('upsellService', (c) =>
    new UpsellService(c.get('database'), c.get('logger'))
  );

  container.register('upsellController', (c) =>
    new UpsellController(c.get('upsellService'))
  );

  container.register('upsellRoutes', () => upsellRoutes);
}

export default registerUpsellModule;
