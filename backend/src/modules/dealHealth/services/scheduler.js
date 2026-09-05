/**
 * Deal Health Scheduled Job (node-cron)
 *
 * Runs all three detectors on a configurable schedule.
 * Default: every 30 minutes.
 *
 * Environment variables:
 *   DEAL_HEALTH_CRON          - Cron expression (default: '0,30 * * * *')
 *   STALLED_DEAL_DAYS         - Days before a deal is considered stalled (default: 7)
 *   ANOMALY_STDDEV_MULTIPLIER - Std-dev multiplier for discount anomaly (default: 1.5)
 *   MIN_HISTORICAL_QUOTATIONS - Min approved quotations to establish a rep baseline (default: 3)
 */
import cron from 'node-cron';

const DEFAULT_CRON = '0,30 * * * *'; // Every 30 minutes

export function startDealHealthJob(dealHealthService, logger, appConfig = {}) {
  const cronExpression = appConfig.DEAL_HEALTH_CRON || process.env.DEAL_HEALTH_CRON || DEFAULT_CRON;

  if (!cron.validate(cronExpression)) {
    logger.error({ cronExpression }, 'Invalid DEAL_HEALTH_CRON expression — job not started');
    return null;
  }

  const task = cron.schedule(cronExpression, async () => {
    logger.info({ cronExpression }, 'Deal health job started');
    const start = Date.now();

    try {
      const results = await dealHealthService.runAllDetectors();
      const duration = Date.now() - start;
      logger.info({ ...results, durationMs: duration }, 'Deal health job completed');
    } catch (err) {
      logger.error({ err: err.message }, 'Deal health job failed unexpectedly');
    }
  });

  // Run once immediately at startup so the dashboard isn't empty on first load
  setImmediate(async () => {
    logger.info('Deal health job: running initial scan at startup');
    try {
      await dealHealthService.runAllDetectors();
    } catch (err) {
      logger.warn({ err: err.message }, 'Initial deal health scan failed');
    }
  });

  logger.info({ cronExpression }, 'Deal health scheduled job started');
  return task;
}

export default startDealHealthJob;
