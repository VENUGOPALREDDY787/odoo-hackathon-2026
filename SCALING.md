# DealFlow360 — Scaling, Load Balancing & Request Queue

This document describes the horizontal-scaling architecture added to the
existing DealFlow360 stack. **Your existing MySQL database, its schema and all
data are untouched** — scaling only adds/removes stateless backend containers
around it.

---

## 1. What was added

| Component | File(s) | Purpose |
|---|---|---|
| **nginx load balancer** | `docker/nginx/` | Single public entry point; spreads requests across backend replicas |
| **BullMQ request queue** | `backend/src/queue/` | Absorbs request bursts; workers process jobs one-by-one |
| **Queue admin API** | `backend/src/modules/queueAdmin/` | Enqueue jobs, inspect status, view counters (admin-only) |
| **Autoscaler watcher** | `docker/autoscaler/` | Scales backend replicas 2→6 on CPU, back down after 3 min idle |
| **Schema bootstrap** | `backend/src/scripts/ensureScalingSchema.js` | Additive-only `CREATE TABLE IF NOT EXISTS` for two new result tables |

## 2. Architecture

```
                        ┌────────────────────────────────────────────┐
                        │              nginx-lb :8080                │
                        │   /  → SPA   /api → pool   /socket.io → ws │
                        └───────────────┬────────────────────────────┘
                                        │ least_conn (upstream refreshed
                                        │ every 5s from Docker DNS)
              ┌─────────────────────────┼─────────────────────────┐
              ▼                         ▼                         ▼
        ┌──────────┐             ┌──────────┐    ...        ┌──────────┐
        │ backend  │             │ backend  │               │ backend  │   ← 2..6 replicas
        │ API+worker│            │ API+worker│              │ API+worker│     (autoscaled)
        └────┬─────┘             └────┬─────┘               └────┬─────┘
             │      ┌──────────────────┘                          │
             ▼      ▼                                             ▼
        ┌──────────────┐      ┌──────────┐      ┌────────────────────────┐
        │  redis :6379 │      │ mysql DB │      │ exports_data (volume)  │
        │  BullMQ queue│      │ (same as │      │ queued export files    │
        └──────────────┘      │  before) │      └────────────────────────┘
                              └──────────┘
```

Key points:

- **Every backend replica embeds its own BullMQ worker.** There is no separate
  worker service. Replicas pull from ONE shared Redis-backed queue, so a burst
  of requests is absorbed and drained by whichever replicas are idle.
- **The autoscaler** (a watcher container with access to the Docker socket)
  polls per-replica CPU utilization every 10 s:
  - **Scale up**: any replica at **≥ 70 %** of its CPU limit (compose limit:
    1.0 CPU) → add one replica, up to **MAX_REPLICAS (6)**. Cooldown 60 s
    between actions.
  - **Scale down**: when **all** replicas are below 20 % CPU **and** the queue
    is empty continuously for **3 minutes (180 s)** → remove one replica, down
    to **MIN_REPLICAS (2)**.
- **nginx upstream auto-discovery**: Docker's DNS `tasks.backend` returns all
  current replica IPs. A small resolver loop inside the LB container rebuilds
  the upstream block every 5 s and reloads nginx, so scaled replicas join and
  leave the pool automatically.
- **Nothing is lost on scale-down**: jobs live in Redis, results in MySQL /
  the shared `exports_data` volume. On `SIGTERM` a replica stops accepting
  requests, finishes in-flight jobs, then exits — queued work is picked up by
  the remaining replicas.

## 3. Data safety (your existing SQL server)

- Same MySQL server, same `dealflow360` database, same schema.
- The bootstrap script (`ensureScalingSchema.js`) runs on every replica boot
  and only issues:
  - `CREATE TABLE IF NOT EXISTS job_exports` — metadata for queued export files
  - `CREATE TABLE IF NOT EXISTS job_metrics` — results of queued metric jobs
- No `DROP`, `TRUNCATE`, `DELETE` or `ALTER` of existing tables ever runs.
  The script is safe to run concurrently from every replica.
- Frontend port stays `5173`; the recommended entry point is now
  **`http://localhost:8080`** (nginx LB → SPA + API + websockets on one origin).
  Backend replicas no longer claim a fixed host port — with N replicas a fixed
  port would collide — so for direct API debugging use
  `docker compose port backend 3000` to discover a replica's ephemeral host
  port, or just go through `:8080`.

## 4. Running it

```bash
# start the whole stack (2 backend replicas by default)
docker compose up -d --build

# open the app through the load balancer
#   http://localhost:8080          (SPA + API + websockets)

# scale manually at any time
docker compose up -d --no-deps --scale backend=4 backend

# watch the autoscaler decisions
docker compose logs -f autoscaler

# watch the LB upstream refreshes
docker compose logs -f nginx-lb
```

The frontend now talks to `/api` on its own origin (through nginx), so no CORS
or host-port juggling is needed. Scripts like `scripts/audit_roundtrip.mjs`
(plain `npm start` dev) keep using `http://localhost:3000/api` — in Docker,
point them at `http://localhost:8080/api` instead.

## 5. Request queue usage

Job types (all embedded in the backend, results persisted in SQL):

| Type | What it does | Result stored in |
|---|---|---|
| `report.export` | Generates CSV/XLSX sales export off the request path | file on `exports_data` volume + `job_exports` row |
| `metrics.compute` | Aggregates quotation KPIs | `job_metrics` row |
| `maintenance.cleanup` | Token/magic-link/login-attempt retention cleanup | return value only |

Enqueue + inspect via the admin API (admin JWT required):

```bash
# enqueue a heavy export
curl -X POST http://localhost:8080/api/queue/jobs \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"report.export","payload":{"format":"csv","filters":{}}}'

# queue depth counters across all replicas
curl http://localhost:8080/api/queue/stats -H "Authorization: Bearer $ADMIN_TOKEN"

# inspect a job
curl http://localhost:8080/api/queue/jobs/<jobId> -H "Authorization: Bearer $ADMIN_TOKEN"

# list generated exports
curl http://localhost:8080/api/queue/exports -H "Authorization: Bearer $ADMIN_TOKEN"
```

When Redis is not configured (e.g. bare `npm run dev` without redis), the
queue layer transparently falls back to **inline execution**, so existing
single-container development keeps working unchanged.

## 6. Tuning knobs (compose environment)

| Variable | Default | Meaning |
|---|---|---|
| `MIN_REPLICAS` / `MAX_REPLICAS` | 2 / 6 | autoscaler bounds |
| `SCALE_UP_CPU_THRESHOLD` | 0.70 | per-replica CPU-limit utilization that triggers scale-up |
| `SCALE_DOWN_IDLE_CPU` | 0.20 | CPU below which a replica counts as idle |
| `SCALE_DOWN_IDLE_MS` | 180000 | 3-minute idle window before stepping down |
| `SCALE_UP_COOLDOWN_MS` | 60000 | minimum time between two scaling actions |
| `POLL_INTERVAL_MS` | 10000 | metrics polling interval |
| `QUEUE_CONCURRENCY` | 5 | concurrent jobs processed per replica |
| `BACKEND_REPLICAS` | 2 | initial replica count (`deploy.replicas`) |

## 7. Tests

```bash
cd backend
npm test                                    # full suite
node --experimental-vm-modules node_modules/jest/bin/jest.js src/__tests__/queue/queue.test.js
```

The queue test suite verifies: job-type registry, inline fallback without
Redis, SQL-backed result writes, unknown-type rejection and that the schema
bootstrap is strictly additive.
