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

Demo worker accounts all use the password `DemoPass2026`:

| Role | Email |
| --- | --- |
| Rep | `rep.demo@dealflow360.local` |
| Manager | `manager.demo@dealflow360.local` |
| Finance | `finance.demo@dealflow360.local` |
| Admin | `admin.demo@dealflow360.local` |

To stop the stack while preserving data:

```bash
docker compose down
```

To remove the persistent database and Redis data as well, use `docker compose down -v`.