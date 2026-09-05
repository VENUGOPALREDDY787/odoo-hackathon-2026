import { getDatabase } from '../utils/database.js';
import { up } from '../database/migrations/20260905_reporting_indexes.js';
import { logger } from '../utils/logger.js';
import config from '../config/index.js';

async function run() {
  const db = getDatabase();
  try {
    await up(db);
    logger.info('Reporting indexes migration applied successfully');
  } catch (error) {
    if (error.code === 'ER_DUP_KEYNAME') {
      logger.info('Indexes already exist, skipping');
    } else {
      logger.error({ err: error.message }, 'Migration failed');
      process.exit(1);
    }
  } finally {
    db.destroy();
  }
}

run();
