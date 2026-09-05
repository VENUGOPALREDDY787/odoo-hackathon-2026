import reportingRoutes from './routes/index.js';
import ReportingController from './controllers/ReportingController.js';
import { ReportingService } from './services/ReportingService.js';

export function registerReportingModule(container) {
  container.register('reportingService', (c) =>
    new ReportingService(c.get('database'), c.get('logger'))
  );

  container.register('reportingController', (c) =>
    new ReportingController(c.get('reportingService'))
  );

  container.register('reportingRoutes', () => reportingRoutes);
}

export default registerReportingModule;
