-- DealFlow360 PostgreSQL Database Schema
-- B2B Sales Operations Backend
-- Version: 1.0
-- Generated: 2026-09-05

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- ENUM TYPES (using CHECK constraints per requirements, but domains for reuse)
-- ============================================================================
CREATE DOMAIN user_role AS TEXT CHECK (VALUE IN ('rep', 'manager', 'finance', 'admin', 'customer'));
CREATE DOMAIN customer_tier AS TEXT CHECK (VALUE IN ('Bronze', 'Silver', 'Gold'));
CREATE DOMAIN quotation_status AS TEXT CHECK (VALUE IN ('draft', 'pending_approval', 'approved', 'rejected', 'sent', 'accepted', 'expired', 'cancelled'));
CREATE DOMAIN line_type AS TEXT CHECK (VALUE IN ('one_time', 'recurring'));
CREATE DOMAIN approval_status AS TEXT CHECK (VALUE IN ('pending', 'approved', 'rejected', 'escalated'));
CREATE DOMAIN fulfillment_status AS TEXT CHECK (VALUE IN ('pending', 'partial', 'shipped', 'delivered', 'cancelled'));
CREATE DOMAIN billing_status AS TEXT CHECK (VALUE IN ('pending', 'invoiced', 'paid', 'overdue', 'cancelled'));
CREATE DOMAIN subscription_interval AS TEXT CHECK (VALUE IN ('monthly', 'quarterly', 'yearly'));
CREATE DOMAIN alert_severity AS TEXT CHECK (VALUE IN ('low', 'medium', 'high', 'critical'));
CREATE DOMAIN negotiation_status AS TEXT CHECK (VALUE IN ('active', 'countered', 'accepted', 'rejected', 'expired'));

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table (reps, managers, finance, admins, customers)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role user_role NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_users_deleted ON users(deleted_at) WHERE deleted_at IS NULL;

-- Customers table
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    company_name TEXT NOT NULL,
    legal_name TEXT,
    tax_id TEXT,
    tier customer_tier NOT NULL DEFAULT 'Bronze',
    billing_address JSONB NOT NULL,
    shipping_address JSONB,
    payment_terms_days INT NOT NULL DEFAULT 30,
    credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0,
    credit_used NUMERIC(14,2) NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    primary_contact_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_rep_id UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_customers_tier ON customers(tier);
CREATE INDEX idx_customers_assigned_rep ON customers(assigned_rep_id);
CREATE INDEX idx_customers_company_name ON customers USING gin(company_name gin_trgm_ops);
CREATE INDEX idx_customers_deleted ON customers(deleted_at) WHERE deleted_at IS NULL;

-- Product categories (self-referencing for hierarchy)
CREATE TABLE product_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    parent_id UUID REFERENCES product_categories(id) ON DELETE RESTRICT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_product_categories_parent ON product_categories(parent_id);
CREATE INDEX idx_product_categories_deleted ON product_categories(deleted_at) WHERE deleted_at IS NULL;

-- Products table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category_id UUID REFERENCES product_categories(id) ON DELETE RESTRICT,
    base_price NUMERIC(14,2) NOT NULL,
    cost_price NUMERIC(14,2),
    unit_of_measure TEXT NOT NULL DEFAULT 'EA',
    weight_kg NUMERIC(10,3),
    dimensions_cm JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_recurring_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_products_deleted ON products(deleted_at) WHERE deleted_at IS NULL;

-- Product variants (e.g., size, color, configuration)
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}',
    price_adjustment NUMERIC(14,2) NOT NULL DEFAULT 0,
    cost_adjustment NUMERIC(14,2),
    weight_kg NUMERIC(10,3),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_product_variants_product ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);
CREATE INDEX idx_product_variants_active ON product_variants(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_product_variants_deleted ON product_variants(deleted_at) WHERE deleted_at IS NULL;

-- Warehouses
CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    address JSONB NOT NULL,
    contact_email TEXT,
    contact_phone TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_warehouses_code ON warehouses(code);
CREATE INDEX idx_warehouses_active ON warehouses(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_warehouses_deleted ON warehouses(deleted_at) WHERE deleted_at IS NULL;

-- Stock levels (current inventory per warehouse per product/variant)
CREATE TABLE stock_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
    quantity_on_hand INT NOT NULL DEFAULT 0,
    quantity_reserved INT NOT NULL DEFAULT 0,
    quantity_available INT GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
    reorder_point INT NOT NULL DEFAULT 0,
    reorder_quantity INT NOT NULL DEFAULT 0,
    last_counted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_stock_levels_unique UNIQUE (warehouse_id, product_id, variant_id)
);

CREATE INDEX idx_stock_warehouse_product ON stock_levels(warehouse_id, product_id);
CREATE INDEX idx_stock_variant ON stock_levels(variant_id);
CREATE INDEX idx_stock_available ON stock_levels(quantity_available) WHERE quantity_available > 0;
CREATE INDEX idx_stock_deleted ON stock_levels(deleted_at) WHERE deleted_at IS NULL;

-- Price lists (base pricing per customer tier, product, variant)
CREATE TABLE price_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_price_lists_dates ON price_lists(effective_from, effective_to);
CREATE INDEX idx_price_lists_default ON price_lists(is_default) WHERE is_default = TRUE;
CREATE INDEX idx_price_lists_deleted ON price_lists(deleted_at) WHERE deleted_at IS NULL;

-- Price list items (actual prices)
CREATE TABLE price_list_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
    customer_tier customer_tier,
    min_quantity INT NOT NULL DEFAULT 1,
    max_quantity INT,
    unit_price NUMERIC(14,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_price_list_items_lookup ON price_list_items(price_list_id, product_id, variant_id, customer_tier);
CREATE INDEX idx_price_list_items_deleted ON price_list_items(deleted_at) WHERE deleted_at IS NULL;

-- Discount tiers (per customer tier + per product category)
CREATE TABLE discount_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_tier customer_tier NOT NULL,
    category_id UUID REFERENCES product_categories(id) ON DELETE RESTRICT,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    min_quantity INT NOT NULL DEFAULT 1,
    max_quantity INT,
    discount_percent NUMERIC(5,2) NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
    discount_fixed_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    priority INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_discount_either CHECK (
        (category_id IS NOT NULL AND product_id IS NULL) OR
        (category_id IS NULL AND product_id IS NOT NULL)
    )
);

CREATE INDEX idx_discount_tiers_lookup ON discount_tiers(customer_tier, category_id, product_id, is_active);
CREATE INDEX idx_discount_tiers_dates ON discount_tiers(effective_from, effective_to);
CREATE INDEX idx_discount_tiers_deleted ON discount_tiers(deleted_at) WHERE deleted_at IS NULL;

-- Approval chains (discount range -> required approval levels)
CREATE TABLE approval_chains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    min_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    max_discount_percent NUMERIC(5,2) NOT NULL,
    required_approver_roles user_role[] NOT NULL DEFAULT '{}',
    min_approvals_required INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_approval_chains_discount_range ON approval_chains(min_discount_percent, max_discount_percent);
CREATE INDEX idx_approval_chains_active ON approval_chains(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_approval_chains_deleted ON approval_chains(deleted_at) WHERE deleted_at IS NULL;

-- Subscription plans
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    interval subscription_interval NOT NULL,
    interval_count INT NOT NULL DEFAULT 1,
    base_price NUMERIC(14,2) NOT NULL,
    setup_fee NUMERIC(14,2) NOT NULL DEFAULT 0,
    trial_days INT NOT NULL DEFAULT 0,
    proration_rule TEXT CHECK (proration_rule IN ('none', 'full', 'partial', 'day_based')) NOT NULL DEFAULT 'day_based',
    max_users INT,
    features JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_subscription_plans_active ON subscription_plans(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_subscription_plans_deleted ON subscription_plans(deleted_at) WHERE deleted_at IS NULL;

-- Upsell rules
CREATE TABLE upsell_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    trigger_product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    trigger_category_id UUID REFERENCES product_categories(id) ON DELETE RESTRICT,
    recommended_product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    recommended_variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
    condition_type TEXT CHECK (condition_type IN ('always', 'quantity_threshold', 'customer_tier', 'custom')) NOT NULL DEFAULT 'always',
    condition_config JSONB DEFAULT '{}',
    discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    priority INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_upsell_trigger CHECK (
        (trigger_product_id IS NOT NULL AND trigger_category_id IS NULL) OR
        (trigger_product_id IS NULL AND trigger_category_id IS NOT NULL)
    )
);

CREATE INDEX idx_upsell_rules_trigger ON upsell_rules(trigger_product_id, trigger_category_id);
CREATE INDEX idx_upsell_rules_active ON upsell_rules(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_upsell_rules_deleted ON upsell_rules(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- QUOTATION & ORDER TABLES
-- ============================================================================

-- Quotations (main document)
CREATE TABLE quotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_number TEXT NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    assigned_rep_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status quotation_status NOT NULL DEFAULT 'draft',
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    exchange_rate NUMERIC(10,6) NOT NULL DEFAULT 1.0,
    
    -- Pricing totals (denormalized for read performance)
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    discount_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    shipping_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    
    -- Computed blended risk score (denormalized for reporting/dashboard performance)
    -- Justification: Frequently used in deal health dashboards, executive reports,
    -- and real-time rep notifications. Computing on-the-fly requires joining
    -- quotation_lines, approval_logs, customer credit, and negotiation history.
    -- Materializing here avoids expensive joins on high-traffic reads.
    blended_risk_score NUMERIC(5,2) CHECK (blended_risk_score >= 0 AND blended_risk_score <= 100),
    
    -- Dates
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until DATE NOT NULL,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    sent_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    -- Terms & notes
    payment_terms_days INT,
    terms_and_conditions TEXT,
    internal_notes TEXT,
    customer_notes TEXT,
    
    -- Metadata
    source TEXT CHECK (source IN ('manual', 'api', 'portal', 'import')) DEFAULT 'manual',
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_quotations_customer ON quotations(customer_id);
CREATE INDEX idx_quotations_rep ON quotations(assigned_rep_id);
CREATE INDEX idx_quotations_status ON quotations(status);
CREATE INDEX idx_quotations_date_range ON quotations(created_at);
CREATE INDEX idx_quotations_valid_until ON quotations(valid_until);
CREATE INDEX idx_quotations_risk_score ON quotations(blended_risk_score) WHERE blended_risk_score IS NOT NULL;
CREATE INDEX idx_quotations_number ON quotations(quotation_number);
CREATE INDEX idx_quotations_deleted ON quotations(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotations_composite_lookup ON quotations(customer_id, status, assigned_rep_id);

-- Quotation lines (support both one-time and recurring on same quotation)
CREATE TABLE quotation_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    line_number INT NOT NULL,
    line_type line_type NOT NULL,
    
    -- Product reference (nullable for custom line items)
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
    
    -- Custom line item fields (when product_id is null)
    custom_name TEXT,
    custom_description TEXT,
    
    quantity NUMERIC(14,3) NOT NULL DEFAULT 1,
    unit_of_measure TEXT NOT NULL DEFAULT 'EA',
    
    -- Pricing
    list_price NUMERIC(14,2) NOT NULL,
    discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
    discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    net_unit_price NUMERIC(14,2) GENERATED ALWAYS AS (
        list_price * (1 - discount_percent / 100) - discount_amount / NULLIF(quantity, 0)
    ) STORED,
    line_subtotal NUMERIC(14,2) GENERATED ALWAYS AS (net_unit_price * quantity) STORED,
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(14,2) GENERATED ALWAYS AS (line_subtotal * tax_rate / 100) STORED,
    line_total NUMERIC(14,2) GENERATED ALWAYS AS (line_subtotal + tax_amount) STORED,
    
    -- Recurring specific fields
    subscription_plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
    billing_cycle_anchor DATE,
    billing_day_of_month INT CHECK (billing_day_of_month >= 1 AND billing_day_of_month <= 31),
    proration_behavior TEXT CHECK (proration_behavior IN ('none', 'full', 'partial')) DEFAULT 'partial',
    min_commitment_cycles INT,
    auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Fulfillment
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    requested_delivery_date DATE,
    
    -- Metadata
    sort_order INT NOT NULL DEFAULT 0,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT uq_quotation_line_number UNIQUE (quotation_id, line_number)
);

CREATE INDEX idx_quotation_lines_quotation ON quotation_lines(quotation_id);
CREATE INDEX idx_quotation_lines_product ON quotation_lines(product_id);
CREATE INDEX idx_quotation_lines_type ON quotation_lines(line_type);
CREATE INDEX idx_quotation_lines_deleted ON quotation_lines(deleted_at) WHERE deleted_at IS NULL;

-- Approval logs (audit trail for approval workflow)
CREATE TABLE approval_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    approval_chain_id UUID REFERENCES approval_chains(id) ON DELETE SET NULL,
    approver_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    role_at_approval user_role NOT NULL,
    action approval_status NOT NULL,
    discount_percent_at_review NUMERIC(5,2),
    comments TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_approval_logs_quotation ON approval_logs(quotation_id);
CREATE INDEX idx_approval_logs_approver ON approval_logs(approver_id);
CREATE INDEX idx_approval_logs_action ON approval_logs(action);
CREATE INDEX idx_approval_logs_created ON approval_logs(created_at);
CREATE INDEX idx_approval_logs_deleted ON approval_logs(deleted_at) WHERE deleted_at IS NULL;

-- Fulfillment splits (single line can split across warehouses/shipments)
CREATE TABLE fulfillment_splits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_line_id UUID NOT NULL REFERENCES quotation_lines(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    quantity NUMERIC(14,3) NOT NULL,
    status fulfillment_status NOT NULL DEFAULT 'pending',
    tracking_number TEXT,
    carrier TEXT,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_fulfillment_splits_line ON fulfillment_splits(quotation_line_id);
CREATE INDEX idx_fulfillment_splits_warehouse ON fulfillment_splits(warehouse_id);
CREATE INDEX idx_fulfillment_splits_status ON fulfillment_splits(status);
CREATE INDEX idx_fulfillment_splits_deleted ON fulfillment_splits(deleted_at) WHERE deleted_at IS NULL;

-- Billing schedules (for recurring lines)
CREATE TABLE billing_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_line_id UUID NOT NULL REFERENCES quotation_lines(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    subscription_plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
    
    cycle_number INT NOT NULL DEFAULT 1,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    status billing_status NOT NULL DEFAULT 'pending',
    
    invoice_id UUID,
    invoice_number TEXT,
    invoiced_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    due_date DATE NOT NULL,
    
    proration_details JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_billing_schedules_line ON billing_schedules(quotation_line_id);
CREATE INDEX idx_billing_schedules_customer ON billing_schedules(customer_id);
CREATE INDEX idx_billing_schedules_status ON billing_schedules(status);
CREATE INDEX idx_billing_schedules_due_date ON billing_schedules(due_date);
CREATE INDEX idx_billing_schedules_period ON billing_schedules(period_start, period_end);
CREATE INDEX idx_billing_schedules_deleted ON billing_schedules(deleted_at) WHERE deleted_at IS NULL;

-- Negotiation logs (track back-and-forth on quotations)
CREATE TABLE negotiation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    initiated_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    counterparty_type TEXT CHECK (counterparty_type IN ('customer', 'internal')) NOT NULL,
    counterparty_id UUID,
    status negotiation_status NOT NULL DEFAULT 'active',
    previous_version JSONB,
    proposed_version JSONB,
    message TEXT,
    expires_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_negotiation_logs_quotation ON negotiation_logs(quotation_id);
CREATE INDEX idx_negotiation_logs_initiator ON negotiation_logs(initiated_by);
CREATE INDEX idx_negotiation_logs_status ON negotiation_logs(status);
CREATE INDEX idx_negotiation_logs_deleted ON negotiation_logs(deleted_at) WHERE deleted_at IS NULL;

-- Deal health alerts
CREATE TABLE deal_health_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL,
    severity alert_severity NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    metric_name TEXT,
    metric_value NUMERIC(14,4),
    threshold_value NUMERIC(14,4),
    is_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_deal_health_alerts_quotation ON deal_health_alerts(quotation_id);
CREATE INDEX idx_deal_health_alerts_severity ON deal_health_alerts(severity);
CREATE INDEX idx_deal_health_alerts_acknowledged ON deal_health_alerts(is_acknowledged) WHERE is_acknowledged = FALSE;
CREATE INDEX idx_deal_health_alerts_created ON deal_health_alerts(created_at);
CREATE INDEX idx_deal_health_alerts_deleted ON deal_health_alerts(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- AUDIT TRAIL (immutable, append-only)
-- ============================================================================

CREATE TABLE audit_trails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    operation TEXT CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE', 'SOFT_DELETE', 'RESTORE')) NOT NULL,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    changed_by_role user_role,
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    ip_address INET,
    user_agent TEXT,
    request_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partition by month for performance (PostgreSQL 12+ native partitioning)
-- Note: Actual partition creation would be done via pg_partman or manual maintenance
CREATE INDEX idx_audit_trails_table_record ON audit_trails(table_name, record_id);
CREATE INDEX idx_audit_trails_changed_by ON audit_trails(changed_by);
CREATE INDEX idx_audit_trails_created ON audit_trails(created_at);
CREATE INDEX idx_audit_trails_operation ON audit_trails(operation);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all mutable business tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_categories_updated_at BEFORE UPDATE ON product_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_warehouses_updated_at BEFORE UPDATE ON warehouses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stock_levels_updated_at BEFORE UPDATE ON stock_levels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_price_lists_updated_at BEFORE UPDATE ON price_lists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_price_list_items_updated_at BEFORE UPDATE ON price_list_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_discount_tiers_updated_at BEFORE UPDATE ON discount_tiers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_approval_chains_updated_at BEFORE UPDATE ON approval_chains FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_upsell_rules_updated_at BEFORE UPDATE ON upsell_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quotations_updated_at BEFORE UPDATE ON quotations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quotation_lines_updated_at BEFORE UPDATE ON quotation_lines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fulfillment_splits_updated_at BEFORE UPDATE ON fulfillment_splits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_billing_schedules_updated_at BEFORE UPDATE ON billing_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_negotiation_logs_updated_at BEFORE UPDATE ON negotiation_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deal_health_alerts_updated_at BEFORE UPDATE ON deal_health_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TRIGGERS FOR AUDIT TRAIL
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    v_old JSONB;
    v_new JSONB;
    v_changed TEXT[];
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_old = to_jsonb(OLD);
        v_new = '{}'::JSONB;
        v_changed = ARRAY(SELECT jsonb_object_keys(to_jsonb(OLD)));
    ELSIF TG_OP = 'UPDATE' THEN
        v_old = to_jsonb(OLD);
        v_new = to_jsonb(NEW);
        v_changed = ARRAY(
            SELECT key FROM jsonb_each_text(to_jsonb(NEW))
            WHERE value IS DISTINCT FROM (SELECT value FROM jsonb_each_text(to_jsonb(OLD)) WHERE key = jsonb_each_text.key)
        );
    ELSIF TG_OP = 'INSERT' THEN
        v_old = '{}'::JSONB;
        v_new = to_jsonb(NEW);
        v_changed = ARRAY(SELECT jsonb_object_keys(to_jsonb(NEW)));
    END IF;
    
    INSERT INTO audit_trails (table_name, record_id, operation, changed_by, changed_by_role, old_values, new_values, changed_fields)
    VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        current_setting('app.current_user_id', TRUE)::UUID,
        current_setting('app.current_user_role', TRUE)::user_role,
        v_old,
        v_new,
        v_changed
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to all business tables
CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_customers AFTER INSERT OR UPDATE OR DELETE ON customers FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_products AFTER INSERT OR UPDATE OR DELETE ON products FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_product_variants AFTER INSERT OR UPDATE OR DELETE ON product_variants FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_stock_levels AFTER INSERT OR UPDATE OR DELETE ON stock_levels FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_price_list_items AFTER INSERT OR UPDATE OR DELETE ON price_list_items FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_discount_tiers AFTER INSERT OR UPDATE OR DELETE ON discount_tiers FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_quotations AFTER INSERT OR UPDATE OR DELETE ON quotations FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_quotation_lines AFTER INSERT OR UPDATE OR DELETE ON quotation_lines FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_approval_logs AFTER INSERT OR UPDATE OR DELETE ON approval_logs FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_fulfillment_splits AFTER INSERT OR UPDATE OR DELETE ON fulfillment_splits FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_billing_schedules AFTER INSERT OR UPDATE OR DELETE ON billing_schedules FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_negotiation_logs AFTER INSERT OR UPDATE OR DELETE ON negotiation_logs FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_deal_health_alerts AFTER INSERT OR UPDATE OR DELETE ON deal_health_alerts FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ============================================================================
-- VIEWS FOR COMMON REPORTING QUERIES
-- ============================================================================

-- Active quotations with computed fields
CREATE VIEW v_active_quotations AS
SELECT 
    q.*,
    c.company_name AS customer_name,
    c.tier AS customer_tier,
    u.full_name AS rep_name,
    COUNT(ql.id) AS line_count,
    SUM(CASE WHEN ql.line_type = 'recurring' THEN 1 ELSE 0 END) AS recurring_line_count,
    SUM(CASE WHEN ql.line_type = 'one_time' THEN 1 ELSE 0 END) AS onetime_line_count
FROM quotations q
JOIN customers c ON q.customer_id = c.id
LEFT JOIN users u ON q.assigned_rep_id = u.id
LEFT JOIN quotation_lines ql ON ql.quotation_id = q.id AND ql.deleted_at IS NULL
WHERE q.deleted_at IS NULL
  AND c.deleted_at IS NULL
GROUP BY q.id, c.company_name, c.tier, u.full_name;

-- Stock availability view
CREATE VIEW v_stock_availability AS
SELECT 
    sl.warehouse_id,
    w.code AS warehouse_code,
    w.name AS warehouse_name,
    sl.product_id,
    p.sku,
    p.name AS product_name,
    sl.variant_id,
    pv.sku AS variant_sku,
    sl.quantity_on_hand,
    sl.quantity_reserved,
    sl.quantity_available,
    sl.reorder_point,
    CASE 
        WHEN sl.quantity_available <= sl.reorder_point THEN 'reorder'
        WHEN sl.quantity_available <= sl.reorder_point * 2 THEN 'low'
        ELSE 'ok'
    END AS stock_status
FROM stock_levels sl
JOIN warehouses w ON sl.warehouse_id = w.id
JOIN products p ON sl.product_id = p.id
LEFT JOIN product_variants pv ON sl.variant_id = pv.id
WHERE sl.deleted_at IS NULL
  AND w.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND (pv.deleted_at IS NULL OR pv.id IS NULL);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_levels ENABLE ROW LEVEL SECURITY;

-- Users can see their own record, admins/managers see all
CREATE POLICY users_select_policy ON users FOR SELECT USING (
    id = current_setting('app.current_user_id', TRUE)::UUID
    OR current_setting('app.current_user_role', TRUE) IN ('admin', 'manager')
);

-- Customers: reps see assigned, managers see all, customers see own
CREATE POLICY customers_select_policy ON customers FOR SELECT USING (
    assigned_rep_id = current_setting('app.current_user_id', TRUE)::UUID
    OR user_id = current_setting('app.current_user_id', TRUE)::UUID
    OR current_setting('app.current_user_role', TRUE) IN ('admin', 'manager', 'finance')
);

-- Quotations: rep sees own, manager sees team, finance/admin see all
CREATE POLICY quotations_select_policy ON quotations FOR SELECT USING (
    assigned_rep_id = current_setting('app.current_user_id', TRUE)::UUID
    OR current_setting('app.current_user_role', TRUE) IN ('admin', 'manager', 'finance')
);

-- Quotation lines follow quotation visibility
CREATE POLICY quotation_lines_select_policy ON quotation_lines FOR SELECT USING (
    quotation_id IN (SELECT id FROM quotations WHERE assigned_rep_id = current_setting('app.current_user_id', TRUE)::UUID)
    OR current_setting('app.current_user_role', TRUE) IN ('admin', 'manager', 'finance')
);

-- Stock: finance, admin, warehouse managers see all
CREATE POLICY stock_levels_select_policy ON stock_levels FOR SELECT USING (
    current_setting('app.current_user_role', TRUE) IN ('admin', 'finance', 'manager')
);