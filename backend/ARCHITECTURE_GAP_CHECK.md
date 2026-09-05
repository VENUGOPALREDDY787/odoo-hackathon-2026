# DealFlow360 Backend Architecture and Problem-Statement Gap Check

## 1. One-page architecture description

```text
                                  +-----------------------------+
                                  |        External clients     |
                                  |  Frontend / API consumers   |
                                  +--------------+--------------+
                                                 |
                                      HTTPS JSON + JWT
                                                 v
+--------------------------------------------------------------------------------+
| API layer: Express                                                            |
|                                                                              |
| request-id -> CORS/security -> rate limits -> JSON parsing -> validation      |
|                                                                              |
| /api/auth       /api/products       /api/quotations       /api/discounts      |
| /api/warehouses /api/subscriptions  /api/negotiation     /api/upsell         |
| /api/dealHealth /api/reporting      /health              /ready              |
+-------------------------------+----------------------------------------------+
                                |
                                v
+--------------------------------------------------------------------------------+
| Service layer: dependency-injected controllers and domain services            |
|                                                                              |
| AuthService       ProductService       QuotationService                       |
| DiscountService   WarehouseService    SubscriptionService                     |
| NegotiationService  UpsellService     DealHealthService  ReportingService    |
|                                                                              |
| Pure engines: riskScorer, recalculator, priceResolver, fulfillmentSplitter,  |
| prorationCalculator, negotiation engine, upsellRanker                         |
+-------------------+---------------------------+------------------------------+
                    |                           |
                    | Knex repositories         | cache/event side effects
                    v                           v
+--------------------------------+       +-------------------------------------+
| MySQL 8 / InnoDB               |       | Redis                               |
|                                |       |                                     |
| users, customers, products,   |       | cache keys for products, discounts,|
| quotations, approval_logs,    |       | quotations and deal-health summary |
| warehouses, stock_levels,     |       |                                     |
| fulfillment_splits, plans,   |       | Socket.IO pub/sub adapter          |
| billing_schedules, audit data |       +------------------+------------------+
+--------------------------------+                          |
                                                            v
                                             +-------------------------------+
                                             | Socket.IO                      |
                                             | quote rooms and live events:  |
                                             | quotation updates, fulfillment |
                                             | negotiation and deal health   |
                                             +-------------------------------+
```

### Create quotation -> auto-approval -> negotiation -> confirm flow

1. `POST /api/quotations` enters the Express API, validates the request, and `QuotationService` writes a draft quotation through Knex to MySQL.
2. `POST /api/quotations/:id/lines` resolves product pricing, recalculates totals, margin, and blended discount risk using the pure engines, then invalidates quotation cache and emits a quotation update to the Socket.IO quote room.
3. `POST /api/quotations/:id/submit` reloads discount tiers and approval chains from MySQL. `riskScorer` calculates the blended score and `routeApproval` determines whether the quotation is auto-approved or moves to `pending_approval`.
4. The approval action endpoint under `/api/discounts/quotations/:quotationId/approve` executes the approval state machine, persists approval/audit rows in MySQL, invalidates related cache entries, and emits the quotation update.
5. Warehouse reservation endpoints call `fulfillmentSplitter`, lock stock rows in MySQL, create fulfillment splits, reserve inventory, and emit fulfillment events. Redis is used for cache invalidation; it is not the source of inventory truth.
6. Subscription endpoints create plans and generate billing schedules for recurring lines. A quotation containing one-time and recurring lines is represented as mixed billing through quotation lines plus `billing_schedules` rows.
7. Customer negotiation uses `/api/negotiation/quotations/:quotationId/negotiate`. `NegotiationService` runs the pure negotiation engine, persists round logs, recalculates risk, and sends a DEAL back to `pending_approval` when the negotiated price crosses the configured risk threshold.
8. The current backend stops at billing schedules. Payment capture, invoice creation, invoice status transitions, and payment webhooks are not implemented as HTTP modules yet; therefore the final payment -> invoice-status leg is a documented gap rather than a passing endpoint flow.

## 2. Module gap-check

The prompt identifiers are mapped to the backend domain areas below. Where the original problem statement uses a business label rather than a source-code module name, the corresponding implementation and endpoint are listed.

| Requirement | Backend implementation | Corresponding endpoint(s) | Status / gap |
|---|---|---|---|
| A1 - Authentication and role-based access | `auth` module, JWT access/refresh tokens, internal/customer registration, role middleware | `POST /api/auth/register/internal`, `POST /api/auth/register/customer`, `POST /api/auth/login`, magic-link, refresh, profile, logout | **Implemented**. Customer password login is intentionally rejected; customers use magic links. |
| A2 - Product catalog and price resolution | `products` module, price lists, variants, pure `resolvePrice` engine | `GET/POST /api/products`, product detail/update/delete, `/with-price-lists`, `/price`, `/variants`, `/price-lists` | **Implemented**. |
| A3 - Quotations and quotation lines | `quotations` module, totals recalculation, margin/risk integration, idempotency/version handling | `GET/POST /api/quotations`, `GET /:id`, line create/update/delete, `POST /:id/submit` | **Implemented**. |
| A4 - Discount governance and approval routing | `discounts` module, `riskScorer`, `approvalStateMachine`, approval/audit repositories | `/api/discounts/tiers`, `/approval-chains`, `/evaluate-risk`, `/quotations/:id/evaluate-risk`, `/quotations/:id/approval`, `/approve`, `/reject`, `/return` | **Implemented**, with approval actions hosted under the discounts route family rather than a separate approvals router. |
| A5 - Warehouse fulfillment and stock reservation | `warehouses` module, row locks, pure `fulfillmentSplitter`, backorder handling | `/api/warehouses`, stock levels, `/stock/adjust`, `/lines/:lineId/reserve-stock`, `/fulfillment-splits/override`, `/backorders/consolidate` | **Implemented**. |
| A6 - Subscriptions and recurring billing schedules | `subscriptions` module, pure proration and schedule generation | `/api/subscriptions/plans`, `/schedules/generate`, line schedules, cancellation endpoints | **Partially implemented**. Plan, proration, schedule, and cancellation logic exist. Payment capture and invoice lifecycle endpoints are absent. |
| A7 - Reporting and operational visibility | `reporting` and `dealHealth` modules, detectors, scheduled scan, CSV/XLSX exports | `/api/reporting/sales`, `/export/csv`, `/export/xlsx`, `/api/dealHealth/dashboard`, `/alerts`, acknowledge/resolve actions | **Implemented** for reporting and deal-health visibility. |
| B3 - Approval workflow | Approval transition state machine is integrated with discount routes and audit logs | `/api/discounts/quotations/:id/approval`, `/approve`, `/reject`, `/return`, approval logs | **Implemented**. No standalone `/api/approvals` route family is required by the current design. |
| B4 - Fulfillment split | Warehouse service plus `splitFulfillment` pure engine and stock reservation transaction | `/api/warehouses/lines/:lineId/reserve-stock`, `/fulfillment-splits/override` | **Implemented**. |
| B6 - Subscription/proration logic | Subscription service, `calculateProration`, schedule generator | `/api/subscriptions/plans`, `/schedules/generate`, line schedules, cancellation | **Partially implemented**. Recurring schedule state exists; external payment/invoice state does not. |
| B7 - Upsell recommendations | `upsell` module and pure `upsellRanker` | Upsell suggestion/rule routes under `/api/upsell` | **Implemented**. |
| B8 - Negotiation and re-approval business logic | Pure negotiation engine plus `NegotiationService` risk re-evaluation and customer isolation | `POST /api/negotiation/quotations/:quotationId/negotiate`, history endpoint | **Implemented**. A DEAL that re-crosses risk becomes `pending_approval`. |
| B9 - Payment and invoice status | No payment/invoice module, controller, repository, or route; only billing-schedule invoice metadata exists in MySQL | No `/api/payments` or `/api/invoices` endpoint exists | **Gap**. Needs payment intent/capture, invoice creation, status transitions, idempotency, and webhook handling. |

### Explicit missing surface

The current backend does **not** implement:

- `POST /api/payments/...` or payment provider integration
- `GET/POST /api/invoices/...`
- invoice generation from accepted quotations or billing schedules
- payment status webhooks and reconciliation
- invoice status transitions such as `issued`, `paid`, `overdue`, and `cancelled` through an API

The schema's `billing_schedules` table contains `status`, `invoice_id`, `invoice_number`, and `invoiced_at`, but those fields are persistence placeholders without an exposed payment/invoice workflow.

## 3. What we would build next

1. Add payment and invoice modules with provider-neutral payment intents, invoice records, status transition validation, idempotency keys, webhook signature verification, and reconciliation jobs.
2. Add MySQL primary/replica topology and Redis replication/sentinel or managed Redis for crash durability and high availability; keep MySQL as the source of truth for financial and inventory state.
3. Replace scattered audit rows with a versioned event-sourced audit stream while retaining query-friendly projections for quotation, approval, fulfillment, and billing views.
4. Add true multi-currency pricing, tax calculation, FX snapshots, and currency-aware invoice totals.
5. Add contract tests generated from the backend OpenAPI description so frontend/API field drift is caught in CI.
6. Expand the critical-path integration test through payment and invoice status once those modules exist, then add provider sandbox tests and failure/retry scenarios.
