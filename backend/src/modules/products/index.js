import productRoutes from './routes/index.js';
import ProductController from './controllers/ProductController.js';
import ProductService from './services/ProductService.js';
import ProductRepository from './repositories/ProductRepository.js';

export function registerProductModule(container) {
  container.register('productRepository', (c) => new ProductRepository(c.get('database')));
  container.register('productService', (c) => new ProductService(c.get('database'), c.get('logger'), c.get('cache')));
  container.register('productController', (c) => new ProductController(c.get('productService')));
  container.register('productRoutes', () => productRoutes);
}

export default registerProductModule;