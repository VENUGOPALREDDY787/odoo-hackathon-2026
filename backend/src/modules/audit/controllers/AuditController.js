import { asyncHandler } from '../../../middleware/errorHandler.js';

export class AuditController {
  constructor(auditService) {
    this.service = auditService;
  }

  listAuditTrails = asyncHandler(async (req, res) => {
    const filters = {
      table_name: req.query.table_name,
      record_id: req.query.record_id,
      operation: req.query.operation,
      changed_by: req.query.changed_by,
      changed_by_role: req.query.changed_by_role,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
    };
    const options = {
      page: req.query.page || 1,
      limit: req.query.limit || 20,
      orderBy: 'created_at',
      orderDir: 'desc',
    };
    const result = await this.service.listAuditTrails(filters, options);
    res.json(result);
  });
}

export default AuditController;
