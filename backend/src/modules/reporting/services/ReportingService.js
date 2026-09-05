import { ReportBuilder } from './ReportBuilder.js';
import { Transform } from 'stream';
import { AsyncParser } from 'json2csv';
import ExcelJS from 'exceljs';

/**
 * ReportingService
 * 
 * Orchestrates report generation and streaming exports.
 */
export class ReportingService {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
    this.builder = new ReportBuilder(db);
  }

  /**
   * Retrieves aggregated stats and a paginated list for the sales report UI.
   */
  async getSalesReport(filters, pagination) {
    try {
      const [aggregates, listResult] = await Promise.all([
        this.builder.buildAggregateQuery(filters),
        this.builder.buildListQuery(filters, pagination),
      ]);

      return {
        summary: aggregates,
        data: listResult.data,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: listResult.total,
          totalPages: Math.ceil(listResult.total / pagination.limit) || 0,
        },
      };
    } catch (err) {
      this.logger.error({ err, filters }, 'Failed to generate sales report');
      throw err;
    }
  }

  /**
   * Streams a CSV export directly to the HTTP response.
   * Uses json2csv AsyncParser to pipe the Knex stream to the response stream.
   * 
   * @param {Object} filters 
   * @param {stream.Writable} outputStream (typically Express res)
   */
  async exportCsv(filters, outputStream) {
    return new Promise((resolve, reject) => {
      try {
        const queryStream = this.builder.buildStreamQuery(filters);
        
        // json2csv AsyncParser converts the stream of objects into a stream of CSV text
        const parser = new AsyncParser();
        
        queryStream
          .pipe(parser.processor)
          .pipe(outputStream)
          .on('finish', () => resolve())
          .on('error', (err) => {
            this.logger.error({ err }, 'CSV stream error');
            reject(err);
          });
          
      } catch (err) {
        this.logger.error({ err }, 'Failed to initiate CSV export');
        reject(err);
      }
    });
  }

  /**
   * Streams an XLSX export directly to the HTTP response.
   * Uses exceljs stream writer to avoid buffering the entire file in memory.
   * 
   * @param {Object} filters 
   * @param {stream.Writable} outputStream (typically Express res)
   */
  async exportXlsx(filters, outputStream) {
    return new Promise((resolve, reject) => {
      try {
        const options = {
          stream: outputStream,
          useStyles: true,
          useSharedStrings: true,
        };
        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter(options);
        const worksheet = workbook.addWorksheet('Sales Report');

        // Set columns (this also acts as the header row)
        worksheet.columns = [
          { header: 'Quotation Number', key: 'Quotation Number', width: 20 },
          { header: 'Customer Name', key: 'Customer Name', width: 30 },
          { header: 'Customer Tier', key: 'Customer Tier', width: 15 },
          { header: 'Sales Rep', key: 'Sales Rep', width: 20 },
          { header: 'Status', key: 'Status', width: 15 },
          { header: 'Currency', key: 'Currency', width: 10 },
          { header: 'Grand Total', key: 'Grand Total', width: 15, style: { numFmt: '#,##0.00' } },
          { header: 'Discount Total', key: 'Discount Total', width: 15, style: { numFmt: '#,##0.00' } },
          { header: 'Margin %', key: 'Margin %', width: 15, style: { numFmt: '0.00%' } },
          { header: 'Created Date', key: 'Created Date', width: 20 },
          { header: 'Expiry Date', key: 'Expiry Date', width: 20 },
        ];

        // Style header row
        worksheet.getRow(1).font = { bold: true };

        const queryStream = this.builder.buildStreamQuery(filters);

        queryStream.on('data', (row) => {
          // Format specific fields if needed
          if (row['Margin %']) {
            row['Margin %'] = Number(row['Margin %']) / 100; // Excel formats as %
          }
          if (row['Created Date']) {
            row['Created Date'] = new Date(row['Created Date']);
          }
          if (row['Expiry Date']) {
            row['Expiry Date'] = new Date(row['Expiry Date']);
          }
          
          worksheet.addRow(row).commit();
        });

        queryStream.on('end', async () => {
          try {
            worksheet.commit();
            await workbook.commit();
            resolve();
          } catch (err) {
            reject(err);
          }
        });

        queryStream.on('error', (err) => {
          this.logger.error({ err }, 'XLSX query stream error');
          reject(err);
        });

      } catch (err) {
        this.logger.error({ err }, 'Failed to initiate XLSX export');
        reject(err);
      }
    });
  }
}
