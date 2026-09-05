import dealHealthRoutes from './routes/index.js';
import DealHealthController from './controllers/DealHealthController.js';
import DealHealthService from './services/DealHealthService.js';
import { startDealHealthJob } from './services/scheduler.js';

/**
 * Bootstrap the deal health module.
 */
export default function registerDealHealthModule(container) {
  container.register('dealHealthService', (c) => {
    const db = c.get('database');
    const logger = c.get('logger');
    const cache = c.get('cache');
    const io = safeGet(c, 'io');
    const config = c.get('config');

    return new DealHealthService(db, logger, cache, io, {
      stalledDaysThreshold: Number(process.env.STALLED_DEAL_DAYS) || 7,
      anomalyStdDevMultiplier: Number(process.env.ANOMALY_STDDEV_MULTIPLIER) || 1.5,
      minHistoricalQuotations: Number(process.env.MIN_HISTORICAL_QUOTATIONS) || 3,
    });
  });

  container.register('dealHealthController', (c) =>
    new DealHealthController(c.get('dealHealthService'))
  );

  container.register('dealHealthRoutes', () => dealHealthRoutes);

  // Start the scheduled job (deferred so container is fully built first)
  setImmediate(() => {
    try {
      const service = container.get('dealHealthService');
      const logger = container.get('logger');
      startDealHealthJob(service, logger);
    } catch (err) {
      try {
        container.get('logger').error({ err: err.message }, 'Failed to start deal health scheduler');
      } catch { /* */ }
    }
  });
}

/** Safely attempt to get a service that may not be registered */
function safeGet(container, name) {
  try {
    return container.get(name);
  } catch {
    return null;
  }
}
