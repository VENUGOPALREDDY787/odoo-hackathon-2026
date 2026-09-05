import { getSalesReportSchema, exportReportSchema } from '../validators/reportingSchemas.js';

export class ReportingController {
  constructor(reportingService) {
    this.reportingService = reportingService;
  }

  // Maps snake_case API query params to camelCase internal filters
  _mapFilters(query) {
    return {
      startDate: query.start_date,
      endDate: query.end_date,
      repId: query.rep_id,
      status: query.status,
      productId: query.product_id,
      categoryId: query.category_id,
      customerTier: query.customer_tier,
    };
  }

  /**
   * GET /api/reporting/sales
   * Returns aggregated totals and a paginated list of quotations.
   */
  getSalesReport = async (req, res, next) => {
    try {
      const { error, value } = getSalesReportSchema.validate(req.query, { abortEarly: false });
      if (error) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: error.details },
        });
      }

      const { page, limit, order_by, order_dir } = value;
      const filters = this._mapFilters(value);

      const result = await this.reportingService.getSalesReport(filters, {
        page,
        limit,
        orderBy: order_by,
        orderDir: order_dir,
      });

      return res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/reporting/export/csv
   * Streams a CSV export of the sales report.
   */
  exportCsv = async (req, res, next) => {
    try {
      const { error, value } = exportReportSchema.validate(req.query, { abortEarly: false });
      if (error) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: error.details },
        });
      }

      const filters = this._mapFilters(value);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="sales_report_${timestamp}.csv"`);
      
      // Let the service pipe the data directly to the Express response object
      await this.reportingService.exportCsv(filters, res);
      
    } catch (err) {
      // If streaming has already started and headers sent, we can't send a normal JSON error.
      // Express handles closing the socket if headers are sent.
      if (!res.headersSent) {
        next(err);
      }
    }
  };

  /**
   * GET /api/reporting/export/xlsx
   * Streams an Excel export of the sales report.
   */
  exportXlsx = async (req, res, next) => {
    try {
      const { error, value } = exportReportSchema.validate(req.query, { abortEarly: false });
      if (error) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: error.details },
        });
      }

      const filters = this._mapFilters(value);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="sales_report_${timestamp}.xlsx"`);
      
      // Let the service pipe the data directly to the Express response object
      await this.reportingService.exportXlsx(filters, res);

    } catch (err) {
      if (!res.headersSent) {
        next(err);
      }
    }
  };
}

export default ReportingController;
