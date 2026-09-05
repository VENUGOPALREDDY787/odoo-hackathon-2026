# DealFlow360 Backend

B2B Sales Operations Backend - Node.js + Express + MySQL (InnoDB)

## Architecture

Layered architecture with dependency injection:

```
src/
├── app.js                 # Express app factory
├── server.js              # Bootstrap entry point
├── config/
│   └── index.js           # Validated config (Zod, fail-fast)
├── middleware/
│   ├── errorHandler.js    # Central error handling
│   └── requestId.js       # Request ID correlation
├── errors/
│   └── AppError.js        # Error classes
├── utils/
│   ├── logger.js          # Pino structured logger
│   ├── database.js        # Knex MySQL connection
│   └── BaseRepository.js  # Base repository class
├── container/
│   └── index.js           # Service container (DI)
└── modules/
    ├── auth/
    ├── products/
    ├── discounts/
    ├── quotations/
    ├── approvals/
    ├── warehouses/
    ├── subscriptions/
    ├── upsell/
    ├── negotiation/
    ├── dealHealth/
    └── reporting/
        ├── routes/
        ├── controllers/
        ├── services/
        ├── repositories/
        ├── models/
        └── validators/
```

## Key Features

- **Dependency Injection**: Services don't instantiate DB clients; container provides them
- **Central Error Handling**: Consistent JSON responses `{ error: { code, message, details } }`
- **Fail-Fast Config**: Zod-validated env vars at boot
- **Structured Logging**: Pino with request-id correlation
- **Soft Delete**: All mutable tables use `deleted_at`
- **Row-Level Locking**: MySQL InnoDB for inventory reservation

## Quick Start

```bash
cd backend
cp .env.example .env
# Edit .env with your values
npm install
npm run dev
```

## Environment Variables

See `.env.example` for all required variables. Key ones:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET` (min 32 chars), `JWT_REFRESH_SECRET` (min 32 chars)
- `NODE_ENV=development|production|test`

## Module Pattern

Each feature module follows the same structure:

```
modules/products/
├── index.js              # registerProductModule(container)
├── routes/index.js       # Express router
├── controllers/          # Request/response handling
├── services/             # Business logic
├── repositories/         # Data access (extends BaseRepository)
├── models/               # Domain models (optional)
└── validators/           # Zod/Joi schemas
```

Register in `server.js`:
```js
import { registerProductModule } from './modules/products/index.js';
registerProductModule(container);
```

## Testing

```bash
npm test
```

Uses Jest with mocked container (see `jest.setup.js`).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with file watcher |
| `npm start` | Production start |
| `npm test` | Run tests with coverage |
| `npm run lint` | ESLint check |