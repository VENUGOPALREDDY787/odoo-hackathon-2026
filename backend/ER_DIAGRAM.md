# DealFlow360 - Entity Relationship Diagram Description (PostgreSQL)

## Overview
This document describes the complete ER diagram for the DealFlow360 PostgreSQL database schema in `schema.sql`, showing all tables, their relationships, and cardinalities.

---

## Core Entity Relationships

### 1. Users & Customers
```
users (1) ──────< (0..1) customers
    │                    │
    │                    └── assigned_rep_id → users (rep)
    │                    └── primary_contact_id → users (customer portal user)
    └── role: rep/manager/finance/admin/customer
```

**Cardinality:**
- One user can be linked to at most one customer record (as portal user)
- One customer has exactly one assigned rep (users.role = 'rep')
- One customer has zero or one primary contact (users.role = 'customer')

---

### 2. Products Hierarchy
```
product_categories (1) ──────< (0..N) product_categories (self-ref, parent_id)
    │
    └──< (0..N) products
            │
            └──< (0..N) product_variants
```

**Cardinality:**
- Category hierarchy: unlimited depth via parent_id self-reference
- One category contains many products
- One product has many variants (size, color, config)
- All FKs: ON DELETE RESTRICT (prevent orphaned products)

---

### 3. Pricing & Discounts
```
price_lists (1) ──────< (0..N) price_list_items
    │                          │
    │                          ├── product_id → products (RESTRICT)
    │                          └── variant_id → product_variants (RESTRICT)
    │
discount_tiers (N) ──────────> customer_tier + category_id/product_id
    │
    ├── customer_tier: Bronze/Silver/Gold
    ├── category_id → product_categories (RESTRICT) [XOR]
    └── product_id → products (RESTRICT) [XOR]
```

**Cardinality:**
- One price list has many items (product/variant + tier + qty breaks)
- Discount tiers: M:N resolved via two nullable FKs with CHECK constraint
  - Either category_id OR product_id is set (never both)
- Price list items: unique per (price_list, product, variant, tier, qty_range)

---

### 4. Approval Workflow
```
approval_chains (1) ──────< (0..N) approval_logs
    │                           │
    │                           ├── quotation_id → quotations (CASCADE)
    │                           ├── approver_id → users (RESTRICT)
    │                           └── approval_chain_id → approval_chains (SET NULL)
    │
quotations (1) ───────────────< (0..N) approval_logs
```

**Cardinality:**
- One approval chain defines rules for a discount range
- One quotation can have many approval log entries (workflow steps)
- Approval chain: required_approver_roles array + min_approvals_required

---

### 5. Quotations & Lines (Core Transactional)
```
customers (1) ────────────────< (0..N) quotations
    │                              │
    │                              ├── assigned_rep_id → users (SET NULL)
    │                              ├── approved_by → users (SET NULL)
    │                              └── status: draft→pending_approval→approved→sent→accepted/expired/cancelled
    │
quotations (1) ─────────────────< (0..N) quotation_lines
    │                                   │
    │                                   ├── product_id → products (RESTRICT)
    │                                   ├── variant_id → product_variants (RESTRICT)
    │                                   ├── subscription_plan_id → subscription_plans (SET NULL)
    │                                   ├── warehouse_id → warehouses (SET NULL)
    │                                   └── line_type: one_time | recurring
    │
quotation_lines (1) ──────────────< (0..N) fulfillment_splits
    │                                   │
    │                                   ├── warehouse_id → warehouses (RESTRICT)
    │                                   └── status: pending→partial→shipped→delivered/cancelled
    │
quotation_lines (1) ──────────────< (0..N) billing_schedules
    │                                   │
    │                                   ├── customer_id → customers (RESTRICT)
    │                                   ├── subscription_plan_id → subscription_plans (SET NULL)
    │                                   └── status: pending→invoiced→paid/overdue/cancelled
```

**Key Design Decisions:**
- **quotation_lines supports mixed line types**: `line_type` column distinguishes one_time vs recurring on same quotation
- **Recurring lines** link to `subscription_plans` for billing cadence
- **Fulfillment splits**: one line → multiple warehouses/shipments
- **Billing schedules**: generated per recurring line per cycle

---

### 6. Inventory & Fulfillment
```
warehouses (1) ───────────────< (0..N) stock_levels
    │                                 │
    │                                 ├── product_id → products (RESTRICT)
    │                                 └── variant_id → product_variants (RESTRICT)
    │
    └── unique(warehouse_id, product_id, variant_id)

stock_levels (1) ───────────────< (0..N) fulfillment_splits
    (via warehouse_id + product_id/variant_id)
```

**Cardinality:**
- Stock levels track on_hand, reserved, available (computed)
- Fulfillment splits reference warehouse directly for shipping

---

### 7. Subscription & Recurring Revenue
```
subscription_plans (1) ────────< (0..N) quotation_lines (recurring)
    │                                │
    │                                └── subscription_plan_id → subscription_plans (SET NULL)
    │
    └── interval: monthly/quarterly/yearly
        proration_rule: none/full/partial/day_based
```

**Cardinality:**
- Plans define billing interval, pricing, trial, proration
- Quotation lines reference plan for recurring revenue

---

### 8. Negotiation & Deal Health
```
quotations (1) ────────────────< (0..N) negotiation_logs
    │                                │
    │                                ├── initiated_by → users (RESTRICT)
    │                                ├── resolved_by → users (SET NULL)
    │                                └── status: active→countered→accepted/rejected/expired
    │
quotations (1) ────────────────< (0..N) deal_health_alerts
    │                                │
    │                                ├── acknowledged_by → users (SET NULL)
    │                                └── severity: low/medium/high/critical
```

**Cardinality:**
- Negotiation logs track full back-and-forth history
- Deal health alerts auto-generated from rules (risk score, stale, discount depth, etc.)

---

### 9. Upsell Rules
```
upsell_rules (1) ───────────────> trigger: product_id XOR category_id
    │                                │
    │                                └── recommended_product_id → products (RESTRICT)
    │                                └── recommended_variant_id → product_variants (RESTRICT)
    │
    └── condition_type: always/quantity_threshold/customer_tier/custom
```

---

### 10. Audit Trail (Immutable, Append-Only)
```
audit_trails (N) ───────────────> ALL TABLES
    │
    ├── table_name + record_id (polymorphic reference)
    ├── operation: INSERT/UPDATE/DELETE/SOFT_DELETE/RESTORE
    ├── changed_by → users (SET NULL)
    ├── old_values/new_values (JSONB)
    └── changed_fields (TEXT[])
```

**Cardinality:**
- One audit record per mutation on any business table
- Partitioned by month for performance
- Never deleted (no deleted_at column)

---

## Relationship Summary Matrix

| Parent Table | Child Table | FK Column(s) | On Delete | Cardinality |
|--------------|-------------|--------------|-----------|-------------|
| users | customers | assigned_rep_id, primary_contact_id, user_id | SET NULL | 1:N |
| users | quotations | assigned_rep_id, approved_by | SET NULL | 1:N |
| users | approval_logs | approver_id | RESTRICT | 1:N |
| users | negotiation_logs | initiated_by, resolved_by | RESTRICT/SET NULL | 1:N |
| users | audit_trails | changed_by | SET NULL | 1:N |
| product_categories | product_categories | parent_id | RESTRICT | 1:N (self) |
| product_categories | products | category_id | RESTRICT | 1:N |
| product_categories | discount_tiers | category_id | RESTRICT | 1:N |
| products | product_variants | product_id | CASCADE | 1:N |
| products | price_list_items | product_id | RESTRICT | 1:N |
| products | discount_tiers | product_id | RESTRICT | 1:N |
| products | quotation_lines | product_id | RESTRICT | 1:N |
| products | upsell_rules | trigger_product_id, recommended_product_id | RESTRICT | 1:N |
| product_variants | price_list_items | variant_id | RESTRICT | 1:N |
| product_variants | quotation_lines | variant_id | RESTRICT | 1:N |
| product_variants | stock_levels | variant_id | RESTRICT | 1:N |
| product_variants | upsell_rules | recommended_variant_id | RESTRICT | 1:N |
| warehouses | stock_levels | warehouse_id | RESTRICT | 1:N |
| warehouses | quotation_lines | warehouse_id | SET NULL | 1:N |
| warehouses | fulfillment_splits | warehouse_id | RESTRICT | 1:N |
| price_lists | price_list_items | price_list_id | CASCADE | 1:N |
| customers | quotations | customer_id | RESTRICT | 1:N |
| customers | billing_schedules | customer_id | RESTRICT | 1:N |
| quotations | quotation_lines | quotation_id | CASCADE | 1:N |
| quotations | approval_logs | quotation_id | CASCADE | 1:N |
| quotations | negotiation_logs | quotation_id | CASCADE | 1:N |
| quotations | deal_health_alerts | quotation_id | CASCADE | 1:N |
| quotation_lines | fulfillment_splits | quotation_line_id | CASCADE | 1:N |
| quotation_lines | billing_schedules | quotation_line_id | CASCADE | 1:N |
| subscription_plans | quotation_lines | subscription_plan_id | SET NULL | 1:N |
| subscription_plans | billing_schedules | subscription_plan_id | SET NULL | 1:N |
| approval_chains | approval_logs | approval_chain_id | SET NULL | 1:N |

---

## Denormalization Notes (Read Performance)

| Table | Denormalized Column | Justification |
|-------|---------------------|---------------|
| quotations | subtotal, discount_total, tax_total, shipping_total, grand_total | Avoid SUM() over quotation_lines on every dashboard load |
| quotations | blended_risk_score | Complex computation joining lines, approvals, customer credit, negotiation history; used in real-time rep alerts & executive dashboards |
| stock_levels | quantity_available (GENERATED) | Frequent filter in availability checks; stored for index efficiency |
| quotation_lines | net_unit_price, line_subtotal, tax_amount, line_total (GENERATED) | Line totals used in quotation totals, PDF generation, and reporting |
| customers | credit_used | Updated on invoice/billing; avoids SUM() over billing_schedules |

All denormalized columns are maintained via:
- Application-layer updates on write
- Generated columns where purely computational
- Triggers for cross-table aggregates (quotation totals)

---

## Index Strategy for Reporting Filters

| Query Pattern | Index |
|---------------|-------|
| Quotations by customer + status + rep | `idx_quotations_composite_lookup (customer_id, status, assigned_rep_id)` |
| Quotations by rep + date range | `idx_quotations_rep + idx_quotations_date_range` |
| Quotations by risk score (dashboards) | `idx_quotations_risk_score (blended_risk_score) WHERE NOT NULL` |
| Discount tiers by tier + category | `idx_discount_tiers_lookup (customer_tier, category_id, product_id, is_active)` |
| Stock by warehouse + product | `idx_stock_warehouse_product (warehouse_id, product_id)` |
| Billing by customer + due date | `idx_billing_schedules_customer + idx_billing_schedules_due_date` |
| Approval logs by quotation | `idx_approval_logs_quotation` |
| Full-text customer search | `idx_customers_company_name (gin_trgm_ops)` |
| Product SKU lookup | `idx_products_sku, idx_product_variants_sku` |
| Quotation number lookup | `idx_quotations_number` |

---

## Soft-Delete Pattern

All mutable business tables implement:
```sql
deleted_at TIMESTAMPTZ  -- NULL = active, timestamp = soft deleted
```

Partial indexes filter active records:
```sql
CREATE INDEX idx_table_deleted ON table(deleted_at) WHERE deleted_at IS NULL;
```

Application queries MUST include `WHERE deleted_at IS NULL` (enforced via RLS policies where applicable).

Hard deletes are NEVER used - audit_trails preserves full history.