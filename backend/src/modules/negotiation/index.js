import negotiationRoutes from './routes/index.js';
import NegotiationController from './controllers/NegotiationController.js';
import NegotiationService from './services/NegotiationService.js';

export function registerNegotiationModule(container) {
  container.register('negotiationService', (c) =>
    new NegotiationService(c.get('database'), c.get('logger'))
  );

  container.register('negotiationController', (c) =>
    new NegotiationController(c.get('negotiationService'))
  );

  container.register('negotiationRoutes', () => negotiationRoutes);
}

export default registerNegotiationModule;
