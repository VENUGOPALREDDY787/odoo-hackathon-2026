# Why MySQL (InnoDB) Over MongoDB for DealFlow360

## Executive Summary

**MySQL/InnoDB is the correct choice** for DealFlow360 because the domain is fundamentally **relational with complex integrity constraints**, not document-centric. The discount/approval logic, multi-entity workflows, and audit requirements demand ACID transactions, referential integrity, and complex joins that document databases handle poorly or require application-level workarounds.

This is the **MERN stack's one deliberate substitution** (MySQL replacing MongoDB) — explicitly documented here for the architecture write-up.

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

**Why this fails in MongoDB:**
- **Multi-collection joins are mandatory**: A single "best price" query touches 5+ entities
- **Range-based lookups**: `discount_percent BETWEEN min AND max` on approval_chains
- **Priority resolution**: `ORDER BY priority DESC, discount_percent DESC` across tiers
- **Conditional FKs**: discount_tiers uses XOR constraint (category_id XOR product_id)
- **Cascade validation**: Changing a product category must revalidate all discount tiers

In MongoDB, you'd either:
- **Embed everything** → massive duplication, update anomalies when discount rules change
- **Reference & join in application** → loses ACID, eventual consistency risks, N+1 queries

### 2. Quotation Lines: Mixed One-Time + Recurring on SAME Document

```sql
-- Single quotation with BOTH line types
SELECT * FROM quotation_lines WHERE quotation_id = ?;
-- Returns: 3 one_time lines + 2 recurring lines (different billing schedules)
```

**MongoDB problem:**
- Recurring lines need `subscription_plan_id`, `billing_cycle_anchor`, `proration_behavior`
- One-time lines need `warehouse_id`, `requested_delivery_date`
- **Polymorphic schema** in one collection = sparse documents, validation complexity
- Billing schedules are **separate entities** with own lifecycle (invoiced/paid/overdue)
- Fulfillment splits reference **warehouse + line** (many-to-many resolved via junction)

Relational model handles this naturally with:
- Shared `quotation_lines` table + `line_type` ENUM discriminator
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

**MySQL/InnoDB:** Single transaction, row-level locks, FK validation, CHECK constraints
**MongoDB:** Requires distributed transaction emulation (multi-document transactions added in 4.0 but limited), application-level saga pattern, eventual consistency window where quotation shows wrong status

### 4. Inventory & Fulfillment: Reservation Logic Needs Locking

```sql
-- Atomic stock reservation (prevents oversell)
UPDATE stock_levels 
SET quantity_reserved = quantity_reserved + ?
WHERE warehouse_id = ? 
  AND product_id = ? 
  AND quantity_available >= ?
  AND deleted_at IS NULL
RETURNING quantity_available;
```

**MySQL/InnoDB:** `SELECT ... FOR UPDATE`, row-level locking, atomic check-and-update
**MongoDB:** No equivalent row-level locking, no `SELECT FOR UPDATE`, race conditions on high-concurrency reservation. FindAndModify is single-document only.

### 5. Audit Trail: Immutable, Append-Only, Polymorphic

```sql
-- Single audit table covers ALL entities
INSERT INTO audit_trails (table_name, record_id, operation, old_values, new_values, ...)
```

**MySQL advantages:**
- JSON columns for flexible old/new values
- Native partitioning by month (MySQL 8.0+)
- FK to `users` for accountability
- **Query across all entities**: "Show all changes by user X last week"
- `ON DELETE CASCADE` on child audit records when parent deleted (soft-delete)

**MongoDB:** Either separate collection per entity (no cross-entity queries) or single massive collection (sharding complexity, no FK validation).

---

## MySQL/InnoDB-Specific Features Leveraged

| Feature | Used In | Benefit |
|---------|---------|---------|
| **Native ENUM** | role, tier, status, line_type, interval_type | Storage-efficient, validated at engine level, self-documenting |
| **GENERATED STORED columns** | stock_levels.quantity_available, quotation_lines totals | Computed values indexed, no app-layer drift, queryable |
| **CHECK constraints** | All ranges, discount_percent 0-100, XOR on discount_tiers | Data integrity at storage layer (MySQL 8.0.16+) |
| **Partial indexes** | `WHERE deleted_at IS NULL`, `WHERE is_active = 1` | Smaller indexes, faster scans on active data (MySQL 8.0+) |
| **JSON type** | addresses, metadata, pricing details, audit values, role arrays | Flexible attributes without schema changes, indexable via virtual columns |
| **Row-level locking** | Stock reservation, approval workflow | `SELECT FOR UPDATE`, `LOCK IN SHARE MODE` for concurrency control |
| **Native partitioning** | audit_trails (by RANGE on created_at) | Automatic partition pruning, easy retention policy |
| **Triggers** | updated_at (via ON UPDATE), audit_trails, quotient totals | Cross-cutting concerns without app code |
| **Foreign keys** | All relationships | Declarative referential integrity, CASCADE/RESTRICT/SET NULL |
| **ACID transactions** | Approval workflow, stock reservation, billing | All-or-nothing multi-table operations |

---

## When MongoDB Would Be Better (Not This Case)

| Scenario | MongoDB Win |
|----------|-------------|
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

## Cost of Wrong Choice (MongoDB)

| Risk | Impact |
|------|--------|
| Discount calculation bugs | Revenue leakage, customer disputes |
| Approval workflow race conditions | Unauthorized discounts approved |
| Oversell on inventory | Failed deliveries, SLA breaches |
| Audit trail gaps | Compliance failures (SOX, GDPR) |
| Reporting query complexity | 10x dev time, slow dashboards |
| Schema migration pain | No ALTER TABLE, manual migrations |

---

## Architecture Write-Up Excerpt

> **Database Selection: MySQL (InnoDB) over MongoDB**
>
> While the MERN stack traditionally pairs with MongoDB, DealFlow360 deliberately substitutes MySQL for the following reasons:
>
> 1. **Relational Discount/Approval Engine**: The core pricing logic requires joining customers → tiers → discount_tiers → price_lists → approval_chains in a single atomic query. MongoDB's lack of JOINs and limited transaction support would push this logic to the application layer, sacrificing correctness.
>
> 2. **Transactional Inventory**: Stock reservation demands `SELECT FOR UPDATE` row-level locking to prevent oversell under concurrency. MongoDB cannot lock individual documents across collections atomically.
>
> 3. **Audit & Compliance**: Immutable audit trails with polymorphic references (`table_name` + `record_id`) and FK-enforced accountability are native to relational models. MongoDB would require separate collections per entity, losing cross-entity queryability.
>
> 4. **Mixed Line Types**: Quotations containing both one-time and recurring lines with different attribute sets map cleanly to a single table with an ENUM discriminator and generated columns — avoiding MongoDB's sparse document anti-pattern.
>
> 5. **Operational Maturity**: MySQL 8.0 provides native partitioning, CTEs, window functions, JSON indexing, and battle-tested HA (InnoDB Cluster) — reducing operational burden vs. MongoDB sharding/replica sets.
>
> MongoDB remains in the stack for **non-transactional, high-volume event streams** (clickstream, email opens, webhook deliveries) where its write throughput and flexible schema excel. The transactional core stays on MySQL.

---

## Conclusion

**MySQL/InnoDB provides:**
1. **Declarative integrity** (FKs, CHECK, ENUM, NOT NULL)
2. **Atomic multi-table transactions** (approval + quotation + logs)
3. **Row-level locking** for inventory reservation
4. **Mature tooling** (mysqldump, mysqlbinlog, Performance Schema, EXPLAIN ANALYZE)
5. **Operational simplicity** (single binary, mature HA, logical replication)
6. **JSON when needed** (best of both worlds)

The domain is **relational to its core**. Using MongoDB for the transactional layer would mean reimplementing a relational engine in application code — poorly.