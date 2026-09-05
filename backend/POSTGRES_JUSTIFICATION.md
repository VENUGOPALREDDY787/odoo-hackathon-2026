# Why PostgreSQL Over a Document Database for DealFlow360

## Executive Summary

**PostgreSQL is the correct choice** for DealFlow360 because the domain is fundamentally **relational with complex integrity constraints**, not document-centric. The discount/approval logic, multi-entity workflows, and audit requirements demand ACID transactions, referential integrity, and complex joins that document databases handle poorly or require application-level workarounds.

---

## Domain Characteristics Favoring Relational Model

### 1. Discount & Approval Logic is Inherently Relational

```
Discount Resolution Path:
Customer (tier) 
  → Discount Tiers (tier + category/product + qty breaks)
  → Price Lists (tier + product + variant + dates)
  → Approval Chains (discount % range → required roles + min approvals)
  → Approval Logs (quotation → chain → approver → action)
```

**Why this fails in document DBs:**
- **Multi-table joins are mandatory**: A single "best price" query touches 5+ entities
- **Range-based lookups**: `discount_percent BETWEEN min AND max` on approval_chains
- **Priority resolution**: `ORDER BY priority DESC, discount_percent DESC` across tiers
- **Conditional FKs**: discount_tiers uses XOR constraint (category_id XOR product_id)
- **Cascade validation**: Changing a product category must revalidate all discount tiers

In a document DB, you'd either:
- **Embed everything** → massive duplication, update anomalies when discount rules change
- **Reference & join in application** → loses ACID, eventual consistency risks, N+1 queries

### 2. Quotation Lines: Mixed One-Time + Recurring on SAME Document

```sql
-- Single quotation with BOTH line types
SELECT * FROM quotation_lines WHERE quotation_id = $1;
-- Returns: 3 one_time lines + 2 recurring lines (different billing schedules)
```

**Document DB problem:**
- Recurring lines need `subscription_plan_id`, `billing_cycle_anchor`, `proration_behavior`
- One-time lines need `warehouse_id`, `requested_delivery_date`
- **Polymorphic schema** in one collection = sparse documents, validation complexity
- Billing schedules are **separate entities** with own lifecycle (invoiced/paid/overdue)
- Fulfillment splits reference **warehouse + line** (many-to-many resolved via junction)

Relational model handles this naturally with:
- Shared `quotation_lines` table + `line_type` discriminator
- Generated columns for computed totals
- FK to `subscription_plans` only for recurring lines
- Separate `billing_schedules` and `fulfillment_splits` tables

### 3. Approval Workflow Requires Transactional Integrity

```
Quotation enters approval:
1. Calculate max discount across all lines
2. Find matching approval_chain (range lookup)
3. Create approval_log entries for EACH required approver (role-based)
4. Lock quotation status = 'pending_approval'
5. ALL must succeed or NONE (atomic)
```

**PostgreSQL:** Single transaction, row-level locks, FK validation, CHECK constraints
**Document DB:** Requires distributed transaction emulation, application-level saga pattern, eventual consistency window where quotation shows wrong status

### 4. Inventory & Fulfillment: Reservation Logic Needs Locking

```sql
-- Atomic stock reservation (prevents oversell)
UPDATE stock_levels 
SET quantity_reserved = quantity_reserved + $qty
WHERE warehouse_id = $wid 
  AND product_id = $pid 
  AND quantity_available >= $qty
  AND deleted_at IS NULL
RETURNING quantity_available;
```

**Document DB:** No `SELECT FOR UPDATE` equivalent, no row-level locking, race conditions on high-concurrency reservation.

### 5. Audit Trail: Immutable, Append-Only, Polymorphic

```sql
-- Single audit table covers ALL entities
INSERT INTO audit_trails (table_name, record_id, operation, old_values, new_values, ...)
```

**PostgreSQL advantages:**
- JSONB for flexible old/new values
- Native partitioning by month (pg_partman)
- BRIN indexes on `created_at` for time-series scans
- FK to `users` for accountability
- **Query across all entities**: "Show all changes by user X last week"

**Document DB:** Either separate collection per entity (no cross-entity queries) or single massive collection (sharding complexity, no FK validation).

---

## PostgreSQL-Specific Features Leveraged

| Feature | Used In | Benefit |
|---------|---------|---------|
| **DOMAIN types** | user_role, customer_tier, status enums | Centralized CHECK constraints, self-documenting |
| **GENERATED columns** | stock_levels.quantity_available, quotation_lines totals | Computed values indexed, no app-layer drift |
| **CHECK constraints** | All enums, discount_percent 0-100, XOR on discount_tiers | Data integrity at storage layer |
| **Partial indexes** | `WHERE deleted_at IS NULL`, `WHERE is_active = TRUE` | Smaller indexes, faster scans on active data |
| **JSONB** | addresses, metadata, pricing details, audit values | Flexible attributes without schema changes |
| **Array types** | approval_chains.required_approver_roles, quotation.tags | Native storage for multi-value attributes |
| **Row Level Security** | users, customers, quotations, stock | Multi-tenant security at DB layer |
| **Native partitioning** | audit_trails (by month) | Automatic partition pruning, easy retention |
| **TRIGGERS** | updated_at, audit_trails | Cross-cutting concerns without app code |
| **EXCLUSION constraints** | (future) pricing date overlaps | Prevent conflicting price list effective ranges |
| **Materialized views** | (future) reporting aggregates | Pre-computed dashboards with refresh scheduling |

---

## When Document DB Would Be Better (Not This Case)

| Scenario | Document DB Win |
|----------|-----------------|
| Highly variable schemas per customer | ✓ |
| Write-once, read-many logs/events | ✓ |
| Geo-distributed eventual consistency | ✓ |
| Rapid prototyping with no schema | ✓ |

**DealFlow360 has NONE of these.** It has:
- Fixed, well-defined schema
- Complex multi-entity transactions
- Strict consistency requirements (financial data)
- Regulatory audit requirements
- Relational discount/approval/fulfillment logic

---

## Cost of Wrong Choice

If built on MongoDB/DynamoDB:

| Risk | Impact |
|------|--------|
| Discount calculation bugs | Revenue leakage, customer disputes |
| Approval workflow race conditions | Unauthorized discounts approved |
| Oversell on inventory | Failed deliveries, SLA breaches |
| Audit trail gaps | Compliance failures (SOX, GDPR) |
| Reporting query complexity | 10x dev time, slow dashboards |
| Schema migration pain | No ALTER TABLE, manual migrations |

---

## Conclusion

**PostgreSQL provides:**
1. **Declarative integrity** (FKs, CHECK, EXCLUSION, NOT NULL)
2. **Atomic multi-table transactions** (approval + quotation + logs)
3. **Mature tooling** (pg_dump, pg_basebackup, pg_stat_statements, EXPLAIN ANALYZE)
4. **Operational simplicity** (single binary, mature HA, logical replication)
5. **JSONB when needed** (best of both worlds)

The domain is **relational to its core**. Using a document database would mean reimplementing a relational engine in application code—poorly.