import { container } from './src/container/index.js';

const mockDb = {
  select: () => mockDb,
  where: () => mockDb,
  whereIn: () => mockDb,
  whereNotIn: () => mockDb,
  whereNull: () => mockDb,
  whereNotNull: () => mockDb,
  whereExists: () => mockDb,
  whereNotExists: () => mockDb,
  join: () => mockDb,
  leftJoin: () => mockDb,
  rightJoin: () => mockDb,
  innerJoin: () => mockDb,
  on: () => mockDb,
  andOn: () => mockDb,
  orOn: () => mockDb,
  groupBy: () => mockDb,
  orderBy: () => mockDb,
  limit: () => mockDb,
  offset: () => mockDb,
  count: () => mockDb,
  sum: () => mockDb,
  avg: () => mockDb,
  min: () => mockDb,
  max: () => mockDb,
  first: () => Promise.resolve(null),
  insert: () => Promise.resolve([1]),
  update: () => Promise.resolve(1),
  delete: () => Promise.resolve(1),
  returning: () => mockDb,
  clone: () => mockDb,
  raw: () => Promise.resolve([]),
  transaction: (cb) => cb(mockDb),
};

const mockLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  fatal: () => {},
  child: () => mockLogger,
};

const mockConfig = {
  NODE_ENV: 'test',
  PORT: 3000,
  DB_HOST: 'localhost',
  DB_PORT: 3306,
  DB_USER: 'test',
  DB_PASSWORD: 'test',
  DB_NAME: 'test',
  JWT_SECRET: 'test-secret-key-for-testing-only-32-chars',
  JWT_REFRESH_SECRET: 'test-refresh-secret-key-for-testing-only-32-chars',
  JWT_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  BCRYPT_ROUNDS: 4,
};

container.registerSingleton('database', mockDb);
container.registerSingleton('logger', mockLogger);
container.registerSingleton('config', mockConfig);

global.testContainer = container;