import warehouseRoutes from './routes/index.js';
import WarehouseController from './controllers/WarehouseController.js';
import WarehouseService from './services/WarehouseService.js';
import {
  WarehouseRepository,
  StockLevelRepository,
  FulfillmentSplitRepository,
} from './repositories/WarehouseRepository.js';

export function registerWarehouseModule(container) {
  container.register('warehouseRepository', (c) => new WarehouseRepository(c.get('database')));
  container.register('stockLevelRepository', (c) => new StockLevelRepository(c.get('database')));
  container.register('fulfillmentSplitRepository', (c) => new FulfillmentSplitRepository(c.get('database')));

  container.register('warehouseService', (c) => new WarehouseService(c.get('database'), c.get('logger'), c.get('io')));
  container.register('warehouseController', (c) => new WarehouseController(c.get('warehouseService')));
  container.register('warehousesRoutes', () => warehouseRoutes);
}

export default registerWarehouseModule;
