/**
 * report.export job handler — generates sales-report exports off the request
 * path and stores them on a shared Docker volume, recording metadata in the
 * `job_exports` SQL table so any replica can serve the download.
 */
import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger.js';
import config from '../../config/index.js';
import { getDatabase } from '../../utils/database.js';

const EXPORT_DIR = config.EXPORT_DIR;

/**
 * Build a CSV or XLSX sales export.
 * @param {object} payload { format: 'csv'|'xlsx', filters: {...} }
 * @returns {object} result summary incl. export id + download path
 */
export async function buildExport(payload = {}) {
  const format = payload.format === 'xlsx' ? 'xlsx' : 'csv';
  const filters = payload.filters || {};
  const db = getDatabase();

  fs.mkdirSync(EXPORT_DIR, { recursive: true });
  const exportId = uuidv4();
  const filename = `sales_report_${exportId}.${format}`;
  const filePath = path.join(EXPORT_DIR, filename);

  await db('job_exports').insert({
    id: exportId,
    job_type: 'report.export',
    format,
    filters: JSON.stringify(filters),
    file_path: filePath,
    status: 'processing',
    created_at: db.fn.now(),
  });

  try {
    const { ReportingService } = await import('../../modules/reporting/services/ReportingService.js');
    const service = new ReportingService(db, logger);
    const stream = fs.createWriteStream(filePath);
    if (format === 'csv') {
      await service.exportCsv(filters, stream);
    } else {
      await service.exportXlsx(filters, stream);
    }

    const stats = fs.statSync(filePath);
    await db('job_exports').where({ id: exportId }).update({
      status: 'ready',
      file_size_bytes: stats.size,
      completed_at: db.fn.now(),
    });
    logger.info({ exportId, format, sizeBytes: stats.size }, 'Export job finished');
    return { exportId, format, path: filePath, sizeBytes: stats.size };
  } catch (error) {
    await db('job_exports').where({ id: exportId }).update({
      status: 'failed',
      error_message: error.message,
      completed_at: db.fn.now(),
    });
    throw error;
  }
}

export default buildExport;
