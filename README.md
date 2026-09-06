# DealFlow360

## Run The Full Review Stack

From the repository root:

```bash
docker compose up --build
```

Open the application at `http://localhost:5173`.

The stack starts:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000`
- MySQL: `localhost:3307`
- Redis: `localhost:6379`

MySQL and Redis data are stored in named Docker volumes, so restarting or rebuilding containers does not remove database data. The MySQL schema and review accounts are initialized automatically on the first database volume creation.

## Demo Data (Automatic)

On every `docker compose up`, a one-shot `db-seed` service runs `backend/src/scripts/seed.js` **before the backend starts**. It populates the database with a full realistic dataset (~150 customers, 120 products, 400 quotations, subscriptions, billing schedules, negotiation history, fulfillment splits, deal-health alerts, and demo accounts), so the application shows real data on a fresh clone.

The seeder is idempotent and safe:

- If the demo data already exists in the volume (e.g. your machine), it **skips** and leaves all data untouched.
- It never deletes user-created records; only its own `[SEED:full_demo_seed_v1]`-marked rows are ever cleared, and only on an explicit dev reseed.

If the seed step fails, the backend will not start — check `docker compose logs db-seed`.

To force a fresh reseed of the demo dataset (development only — this clears previously seeded demo rows and regenerates them):

```bash
docker compose run --rm -e NODE_ENV=development db-seed
```

Customer portal demo accounts (`customer.1@dealflow360.local` … `customer.8@dealflow360.local`) are also created; every demo account uses the password `DemoPass2026`.

Demo worker accounts all use the password `DemoPass2026`:

| Role | Email |
| --- | --- |
| Rep | `rep.demo@dealflow360.local` |
| Manager | `manager.demo@dealflow360.local` |
| Finance | `finance.demo@dealflow360.local` |
| Admin | `admin.demo@dealflow360.local` |
| Customer (portal) | `customer.1@dealflow360.local` … `customer.8@dealflow360.local` |

To stop the stack while preserving data:

```bash
docker compose down
```

To remove the persistent database and Redis data as well, use `docker compose down -v`.