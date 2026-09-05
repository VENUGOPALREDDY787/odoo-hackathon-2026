-- DealFlow360 MySQL Database Schema (InnoDB)
-- B2B Sales Operations Backend
-- Version: 1.0
-- Generated: 2026-09-05
-- Engine: InnoDB (required for FKs, transactions, row-level locking)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table (reps, managers, finance, admins, customers)
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `full_name` VARCHAR(255) NOT NULL,
    `role` ENUM('rep','manager','finance','admin','customer') NOT NULL,
    `phone` VARCHAR(50),
    `avatar_url` VARCHAR(500),
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `last_login_at` DATETIME,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_users_role` ON `users` (`role`);
CREATE INDEX `idx_users_active` ON `users` (`is_active`) WHERE `is_active` = 1;
CREATE INDEX `idx_users_deleted` ON `users` (`deleted_at`) WHERE `deleted_at` IS NULL;

-- Customers table
CREATE TABLE `customers` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `user_id` CHAR(36),
    `company_name` VARCHAR(255) NOT NULL,
    `legal_name` VARCHAR(255),
    `tax_id` VARCHAR(100),
    `tier` ENUM('Bronze','Silver','Gold') NOT NULL DEFAULT 'Bronze',
    `billing_address` JSON NOT NULL,
    `shipping_address` JSON,
    `payment_terms_days` INT NOT NULL DEFAULT 30,
    `credit_limit` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    `credit_used` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    `currency` CHAR(3) NOT NULL DEFAULT 'USD',
    `primary_contact_id` CHAR(36),
    `assigned_rep_id` CHAR(36),
    `notes` TEXT,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_customers_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_customers_primary_contact` FOREIGN KEY (`primary_contact_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_customers_assigned_rep` FOREIGN KEY (`assigned_rep_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_customers_tier` ON `customers` (`tier`);
CREATE INDEX `idx_customers_assigned_rep` ON `customers` (`assigned_rep_id`);
CREATE INDEX `idx_customers_company_name` ON `customers` (`company_name`);
CREATE INDEX `idx_customers_deleted` ON `customers` (`deleted_at`) WHERE `deleted_at` IS NULL;

-- Product categories (self-referencing for hierarchy)
CREATE TABLE `product_categories` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `name` VARCHAR(255) NOT NULL,
    `parent_id` CHAR(36),
    `description` TEXT,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_product_categories_name` (`name`),
    CONSTRAINT `fk_product_categories_parent` FOREIGN KEY (`parent_id`) REFERENCES `product_categories`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_product_categories_parent` ON `product_categories` (`parent_id`);
CREATE INDEX `idx_product_categories_deleted` ON `product_categories` (`deleted_at`) WHERE `deleted_at` IS NULL;

-- Products table
CREATE TABLE `products` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `sku` VARCHAR(100) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT,
    `category_id` CHAR(36) NOT NULL,
    `base_price` DECIMAL(14,2) NOT NULL,
    `cost_price` DECIMAL(14,2),
    `unit_of_measure` VARCHAR(50) NOT NULL DEFAULT 'EA',
    `weight_kg` DECIMAL(10,3),
    `dimensions_cm` JSON,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `is_recurring_eligible` TINYINT(1) NOT NULL DEFAULT 0,
    `metadata` JSON DEFAULT (JSON_OBJECT()),
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_products_sku` (`sku`),
    CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_products_category` ON `products` (`category_id`);
CREATE INDEX `idx_products_active` ON `products` (`is_active`) WHERE `is_active` = 1;
CREATE INDEX `idx_products_deleted` ON `products` (`deleted_at`) WHERE `deleted_at` IS NULL;

-- Product variants (e.g., size, color, configuration)
CREATE TABLE `product_variants` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `product_id` CHAR(36) NOT NULL,
    `sku` VARCHAR(100) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `attributes` JSON NOT NULL DEFAULT (JSON_OBJECT()),
    `price_adjustment` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    `cost_adjustment` DECIMAL(14,2),
    `weight_kg` DECIMAL(10,3),
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_product_variants_sku` (`sku`),
    CONSTRAINT `fk_product_variants_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_product_variants_product` ON `product_variants` (`product_id`);
CREATE INDEX `idx_product_variants_active` ON `product_variants` (`is_active`) WHERE `is_active` = 1;
CREATE INDEX `idx_product_variants_deleted` ON `product_variants` (`deleted_at`) WHERE `deleted_at` IS NULL;

-- Warehouses
CREATE TABLE `warehouses` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `address` JSON NOT NULL,
    `contact_email` VARCHAR(255),
    `contact_phone` VARCHAR(50),
    `is_default` TINYINT(1) NOT NULL DEFAULT 0,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_warehouses_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_warehouses_active` ON `warehouses` (`is_active`) WHERE `is_active` = 1;
CREATE INDEX `idx_warehouses_deleted` ON `warehouses` (`deleted_at`) WHERE `deleted_at` IS NULL;

-- Stock levels (current inventory per warehouse per product/variant)
CREATE TABLE `stock_levels` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `warehouse_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `variant_id` CHAR(36),
    `quantity_on_hand` INT NOT NULL DEFAULT 0,
    `quantity_reserved` INT NOT NULL DEFAULT 0,
    `quantity_available` INT GENERATED ALWAYS AS (`quantity_on_hand` - `quantity_reserved`) STORED,
    `reorder_point` INT NOT NULL DEFAULT 0,
    `reorder_quantity` INT NOT NULL DEFAULT 0,
    `last_counted_at` DATETIME,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_stock_levels_unique` (`warehouse_id`, `product_id`, `variant_id`),
    CONSTRAINT `fk_stock_levels_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_stock_levels_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_stock_levels_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_stock_warehouse_product` ON `stock_levels` (`warehouse_id`, `product_id`);
CREATE INDEX `idx_stock_variant` ON `stock_levels` (`variant_id`);
CREATE INDEX `idx_stock_available` ON `stock_levels` (`quantity_available`) WHERE `quantity_available` > 0;
CREATE INDEX `idx_stock_deleted` ON `stock_levels` (`deleted_at`) WHERE `deleted_at` IS NULL;

-- Price lists (base pricing per customer tier, product, variant)
CREATE TABLE `price_lists` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT,
    `currency` CHAR(3) NOT NULL DEFAULT 'USD',
    `is_default` TINYINT(1) NOT NULL DEFAULT 0,
    `effective_from` DATE NOT NULL,
    `effective_to` DATE,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_price_lists_dates` ON `price_lists` (`effective_from`, `effective_to`);
CREATE INDEX `idx_price_lists_default` ON `price_lists` (`is_default`) WHERE `is_default` = 1;
CREATE INDEX `idx_price_lists_deleted` ON `price_lists` (`deleted_at`) WHERE `deleted_at` IS NULL;

-- Price list items (actual prices)
CREATE TABLE `price_list_items` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `price_list_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `variant_id` CHAR(36),
    `customer_tier` ENUM('Bronze','Silver','Gold'),
    `min_quantity` INT NOT NULL DEFAULT 1,
    `max_quantity` INT,
    `unit_price` DECIMAL(14,2) NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_price_list_items_price_list` FOREIGN KEY (`price_list_id`) REFERENCES `price_lists`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_price_list_items_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_price_list_items_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_price_list_items_lookup` ON `price_list_items` (`price_list_id`, `product_id`, `variant_id`, `customer_tier`);
CREATE INDEX `idx_price_list_items_deleted` ON `price_list_items` (`deleted_at`) WHERE `deleted_at` IS NULL;

-- Discount tiers (per customer tier + per product category)
CREATE TABLE `discount_tiers` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `customer_tier` ENUM('Bronze','Silver','Gold') NOT NULL,
    `category_id` CHAR(36),
    `product_id` CHAR(36),
    `min_quantity` INT NOT NULL DEFAULT 1,
    `max_quantity` INT,
    `discount_percent` DECIMAL(5,2) NOT NULL CHECK (`discount_percent` >= 0 AND `discount_percent` <= 100),
    `discount_fixed_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    `priority` INT NOT NULL DEFAULT 0,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `effective_from` DATE NOT NULL,
    `effective_to` DATE,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_discount_tiers_category` FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_discount_tiers_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `chk_discount_either` CHECK (
        (`category_id` IS NOT NULL AND `product_id` IS NULL) OR
        (`category_id` IS NULL AND `product_id` IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_discount_tiers_lookup` ON `discount_tiers` (`customer_tier`, `category_id`, `product_id`, `is_active`);
CREATE INDEX `idx_discount_tiers_dates` ON `discount_tiers` (`effective_from`, `effective_to`);
CREATE INDEX `idx_discount_tiers_deleted` ON `discount_tiers` (`deleted_at`) WHERE `deleted_at` IS NULL;

-- Approval chains (discount range -> required approval levels)
CREATE TABLE `approval_chains` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT,
    `min_discount_percent` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    `max_discount_percent` DECIMAL(5,2) NOT NULL,
    `required_approver_roles` JSON NOT NULL DEFAULT (JSON_ARRAY()),
    `min_approvals_required` INT NOT NULL DEFAULT 1,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_approval_chains_discount_range` ON `approval_chains` (`min_discount_percent`, `max_discount_percent`);
CREATE INDEX `idx_approval_chains_active` ON `approval_chains` (`is_active`) WHERE `is_active` = 1;
CREATE INDEX `idx_approval_chains_deleted` ON `approval_chains` (`deleted_at`) WHERE `deleted_at` IS NULL;

-- Subscription plans
CREATE TABLE `subscription_plans` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT,
    `interval_type` ENUM('monthly','quarterly','yearly') NOT NULL,
    `interval_count` INT NOT NULL DEFAULT 1,
    `base_price` DECIMAL(14,2) NOT NULL,
    `setup_fee` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    `trial_days` INT NOT NULL DEFAULT 0,
    `proration_rule` ENUM('none','full','partial','day_based') NOT NULL DEFAULT 'day_based',
    `max_users` INT,
    `features` JSON DEFAULT (JSON_OBJECT()),
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_subscription_plans_active` ON `subscription_plans` (`is_active`) WHERE `is_active` = 1;
CREATE INDEX `idx_subscription_plans_deleted` ON `subscription_plans` (`deleted_at`) WHERE `deleted_at` IS NULL;

-- Upsell rules
CREATE TABLE `upsell_rules` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT,
    `trigger_product_id` CHAR(36),
    `trigger_category_id` CHAR(36),
    `recommended_product_id` CHAR(36) NOT NULL,
    `recommended_variant_id` CHAR(36),
    `condition_type` ENUM('always','quantity_threshold','customer_tier','custom') NOT NULL DEFAULT 'always',
    `condition_config` JSON DEFAULT (JSON_OBJECT()),
    `discount_percent` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    `priority` INT NOT NULL DEFAULT 0,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_upsell_trigger_product` FOREIGN KEY (`trigger_product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_upsell_trigger_category` FOREIGN KEY (`trigger_category_id`) REFERENCES `product_categories`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_upsell_recommended_product` FOREIGN KEY (`recommended_product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_upsell_recommended_variant` FOREIGN KEY (`recommended_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `chk_upsell_trigger` CHECK (
        (`trigger_product_id` IS NOT NULL AND `trigger_category_id` IS NULL) OR
        (`trigger_product_id` IS NULL AND `trigger_category_id` IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_upsell_rules_trigger` ON `upsell_rules` (`trigger_product_id`, `trigger_category_id`);
CREATE INDEX `idx_upsell_rules_active` ON `upsell_rules` (`is_active`) WHERE `is_active` = 1;
CREATE INDEX `idx_upsell_rules_deleted` ON `upsell_rules` (`deleted_at`) WHERE `deleted_at` IS NULL;

-- ============================================================================
-- QUOTATION & ORDER TABLES
-- ============================================================================

-- Quotations (main document)
CREATE TABLE `quotations` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `quotation_number` VARCHAR(100) NOT NULL,
    `customer_id` CHAR(36) NOT NULL,
    `assigned_rep_id` CHAR(36),
    `status` ENUM('draft','pending_approval','approved','rejected','sent','accepted','expired','cancelled') NOT NULL DEFAULT 'draft',
    `currency` CHAR(3) NOT NULL DEFAULT 'USD',
    `exchange_rate` DECIMAL(10,6) NOT NULL DEFAULT 1.000000,
    
    -- Pricing totals (denormalized for read performance)
    `subtotal` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    `discount_total` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    `tax_total` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    `shipping_total` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    `grand_total` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    
    -- Computed blended risk score (denormalized for reporting/dashboard performance)
    -- Justification: Frequently used in deal health dashboards, executive reports,
    -- and real-time rep notifications. Computing on-the-fly requires joining
    -- quotation_lines, approval_logs, customer credit, and negotiation history.
    -- Materializing here avoids expensive joins on high-traffic reads.
    `blended_risk_score` DECIMAL(5,2) CHECK (`blended_risk_score` >= 0 AND `blended_risk_score` <= 100),
    
    -- Dates
    `valid_from` DATE NOT NULL DEFAULT (CURRENT_DATE),
    `valid_until` DATE NOT NULL,
    `approved_at` DATETIME,
    `approved_by` CHAR(36),
    `sent_at` DATETIME,
    `accepted_at` DATETIME,
    `expires_at` DATETIME,
    
    -- Terms & notes
    `payment_terms_days` INT,
    `terms_and_conditions` TEXT,
    `internal_notes` TEXT,
    `customer_notes` TEXT,
    
    -- Metadata
    `source` ENUM('manual','api','portal','import') DEFAULT 'manual',
    `tags` JSON DEFAULT (JSON_ARRAY()),
    `metadata` JSON DEFAULT (JSON_OBJECT()),
    
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_quotations_number` (`quotation_number`),
    CONSTRAINT `fk_quotations_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_quotations_assigned_rep` FOREIGN KEY (`assigned_rep_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_quotations_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_quotations_customer` ON `quotations` (`customer_id`);
CREATE INDEX `idx_quotations_rep` ON `quotations` (`assigned_rep_id`);
CREATE INDEX `idx_quotations_status` ON `quotations` (`status`);
CREATE INDEX `idx_quotations_date_range` ON `quotations` (`created_at`);
CREATE INDEX `idx_quotations_valid_until` ON `quotations` (`valid_until`);
CREATE INDEX `idx_quotations_risk_score` ON `quotations` (`blended_risk_score`) WHERE `blended_risk_score` IS NOT NULL;
CREATE INDEX `idx_quotations_composite_lookup` ON `quotations` (`customer_id`, `status`, `assigned_rep_id`);
CREATE INDEX `idx_quotations_deleted` ON `quotations` (`deleted_at`) WHERE `deleted_at` IS NULL;

-- Quotation lines (support both one-time and recurring on same quotation)
CREATE TABLE `quotation_lines` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `quotation_id` CHAR(36) NOT NULL,
    `line_number` INT NOT NULL,
    `line_type` ENUM('one_time','recurring') NOT NULL,
    
    -- Product reference (nullable for custom line items)
    `product_id` CHAR(36),
    `variant_id` CHAR(36),
    
    -- Custom line item fields (when product_id is null)
    `custom_name` VARCHAR(255),
    `custom_description` TEXT,
    
    `quantity` DECIMAL(14,3) NOT NULL DEFAULT 1.000,
    `unit_of_measure` VARCHAR(50) NOT NULL DEFAULT 'EA',
    
    -- Pricing
    `list_price` DECIMAL(14,2) NOT NULL,
    `discount_percent` DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (`discount_percent` >= 0 AND `discount_percent` <= 100),
    `discount_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    `net_unit_price` DECIMAL(14,2) GENERATED ALWAYS AS (
        `list_price` * (1 - `discount_percent` / 100) - `discount_amount` / NULLIF(`quantity`, 0)
    ) STORED,
    `line_subtotal` DECIMAL(14,2) GENERATED ALWAYS AS (`net_unit_price` * `quantity`) STORED,
    `tax_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    `tax_amount` DECIMAL(14,2) GENERATED ALWAYS AS (`line_subtotal` * `tax_rate` / 100) STORED,
    `line_total` DECIMAL(14,2) GENERATED ALWAYS AS (`line_subtotal` + `tax_amount`) STORED,
    
    -- Recurring specific fields
    `subscription_plan_id` CHAR(36),
    `billing_cycle_anchor` DATE,
    `billing_day_of_month` TINYINT CHECK (`billing_day_of_month` >= 1 AND `billing_day_of_month` <= 31),
    `proration_behavior` ENUM('none','full','partial') DEFAULT 'partial',
    `min_commitment_cycles` INT,
    `auto_renew` TINYINT(1) NOT NULL DEFAULT 1,
    
    -- Fulfillment
    `warehouse_id` CHAR(36),
    `requested_delivery_date` DATE,
    
    -- Metadata
    `sort_order` INT NOT NULL DEFAULT 0,
    `notes` TEXT,
    `metadata` JSON DEFAULT (JSON_OBJECT()),
    
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_quotation_line_number` (`quotation_id`, `line_number`),
    CONSTRAINT `fk_quotation_lines_quotation` FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_quotation_lines_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_quotation_lines_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_quotation_lines_subscription_plan` FOREIGN KEY (`subscription_plan_id`) REFERENCES `subscription_plans`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_quotation_lines_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_quotation_lines_quotation` ON `quotation_lines` (`quotation_id`);
CREATE INDEX `idx_quotation_lines_product` ON `quotation_lines` (`product_id`);
CREATE INDEX `idx_quotation_lines_type` ON `quotation_lines` (`line_type`);
CREATE INDEX `idx_quotation_lines_deleted` ON `quotation_lines` (`deleted_at`) WHERE `deleted_at` IS NULL;

-- Approval logs (audit trail for approval workflow)
CREATE TABLE `approval_logs` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `quotation_id` CHAR(36) NOT NULL,
    `approval_chain_id` CHAR(36),
    `approver_id` CHAR(36) NOT NULL,
    `role_at_approval` ENUM('rep','manager','finance','admin','customer') NOT NULL,
    `action` ENUM('pending','approved','rejected','escalated') NOT NULL,
    `discount_percent_at_review` DECIMAL(5,2),
    `comments` TEXT,
    `ip_address` VARCHAR(45),
    `user_agent` VARCHAR(500),
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `deleted_at` DATETIME,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_approval_logs_quotation` FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_approval_logs_approval_chain` FOREIGN KEY (`approval_chain_id`) REFERENCES `approval_chains`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_approval_logs_approver` FOREIGN KEY (`approver_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_approval_logs_quotation` ON `approval_logs` (`quotation_id`);
CREATE INDEX `idx_approval_logs_approver` ON `approval_logs` (`approver_id`);
CREATE INDEX `idx_approval_logs_action` ON `approval_logs` (`action`);
CREATE INDEX `idx_approval_logs_created` ON `approval_logs` (`created_at`);
CREATE INDEX `idx_approval_logs_deleted` ON `approval_logs` (`deleted_at`) WHERE `deleted_at` IS NULL;

-- Fulfillment splits (single line can split across warehouses/shipments)
CREATE TABLE `fulfillment_splits` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `quotation_line_id` CHAR(36) NOT NULL,
    `warehouse_id` CHAR(36) NOT NULL,
    `quantity` DECIMAL(14,3) NOT NULL,
    `status` ENUM('pending','partial','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
    `tracking_number` VARCHAR(255),
    `carrier` VARCHAR(255),
    `shipped_at` DATETIME,
    `delivered_at` DATETIME,
    `notes` TEXT,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_fulfillment_splits_line` FOREIGN KEY (`quotation_line_id`) REFERENCES `quotation_lines`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_fulfillment_splits_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_fulfillment_splits_line` ON `fulfillment_splits` (`quotation_line_id`);
CREATE INDEX `idx_fulfillment_splits_warehouse` ON `fulfillment_splits` (`warehouse_id`);
CREATE INDEX `idx_fulfillment_splits_status` ON `fulfillment_splits` (`status`);
CREATE INDEX `idx_fulfillment_splits_deleted` ON `fulfillment_splits` (`deleted_at`) WHERE `deleted_at` IS NULL;

-- Billing schedules (for recurring lines)
CREATE TABLE `billing_schedules` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `quotation_line_id` CHAR(36) NOT NULL,
    `customer_id` CHAR(36) NOT NULL,
    `subscription_plan_id` CHAR(36),
    
    `cycle_number` INT NOT NULL DEFAULT 1,
    `period_start` DATE NOT NULL,
    `period_end` DATE NOT NULL,
    `amount` DECIMAL(14,2) NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'USD',
    `status` ENUM('pending','invoiced','paid','overdue','cancelled') NOT NULL DEFAULT 'pending',
    
    `invoice_id` CHAR(36),
    `invoice_number` VARCHAR(100),
    `invoiced_at` DATETIME,
    `paid_at` DATETIME,
    `due_date` DATE NOT NULL,
    
    `proration_details` JSON,
    `notes` TEXT,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_billing_schedules_line` FOREIGN KEY (`quotation_line_id`) REFERENCES `quotation_lines`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_billing_schedules_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_billing_schedules_subscription_plan` FOREIGN KEY (`subscription_plan_id`) REFERENCES `subscription_plans`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_billing_schedules_line` ON `billing_schedules` (`quotation_line_id`);
CREATE INDEX `idx_billing_schedules_customer` ON `billing_schedules` (`customer_id`);
CREATE INDEX `idx_billing_schedules_status` ON `billing_schedules` (`status`);
CREATE INDEX `idx_billing_schedules_due_date` ON `billing_schedules` (`due_date`);
CREATE INDEX `idx_billing_schedules_period` ON `billing_schedules` (`period_start`, `period_end`);
CREATE INDEX `idx_billing_schedules_deleted` ON `billing_schedules` (`deleted_at`) WHERE `deleted_at` IS NULL;

-- Negotiation logs (track back-and-forth on quotations)
CREATE TABLE `negotiation_logs` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `quotation_id` CHAR(36) NOT NULL,
    `initiated_by` CHAR(36) NOT NULL,
    `counterparty_type` ENUM('customer','internal') NOT NULL,
    `counterparty_id` CHAR(36),
    `status` ENUM('active','countered','accepted','rejected','expired') NOT NULL DEFAULT 'active',
    `previous_version` JSON,
    `proposed_version` JSON,
    `message` TEXT,
    `expires_at` DATETIME,
    `resolved_at` DATETIME,
    `resolved_by` CHAR(36),
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_negotiation_logs_quotation` FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_negotiation_logs_initiated_by` FOREIGN KEY (`initiated_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_negotiation_logs_resolved_by` FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_negotiation_logs_quotation` ON `negotiation_logs` (`quotation_id`);
CREATE INDEX `idx_negotiation_logs_initiator` ON `negotiation_logs` (`initiated_by`);
CREATE INDEX `idx_negotiation_logs_status` ON `negotiation_logs` (`status`);
CREATE INDEX `idx_negotiation_logs_deleted` ON `negotiation_logs` (`deleted_at`) WHERE `deleted_at` IS NULL;

-- Deal health alerts
CREATE TABLE `deal_health_alerts` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `quotation_id` CHAR(36) NOT NULL,
    `alert_type` VARCHAR(100) NOT NULL,
    `severity` ENUM('low','medium','high','critical') NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT,
    `metric_name` VARCHAR(100),
    `metric_value` DECIMAL(14,4),
    `threshold_value` DECIMAL(14,4),
    `is_acknowledged` TINYINT(1) NOT NULL DEFAULT 0,
    `acknowledged_by` CHAR(36),
    `acknowledged_at` DATETIME,
    `resolved_at` DATETIME,
    `metadata` JSON DEFAULT (JSON_OBJECT()),
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `deleted_at` DATETIME,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_deal_health_alerts_quotation` FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_deal_health_alerts_acknowledged_by` FOREIGN KEY (`acknowledged_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_deal_health_alerts_quotation` ON `deal_health_alerts` (`quotation_id`);
CREATE INDEX `idx_deal_health_alerts_severity` ON `deal_health_alerts` (`severity`);
CREATE INDEX `idx_deal_health_alerts_acknowledged` ON `deal_health_alerts` (`is_acknowledged`) WHERE `is_acknowledged` = 0;
CREATE INDEX `idx_deal_health_alerts_created` ON `deal_health_alerts` (`created_at`);
CREATE INDEX `idx_deal_health_alerts_deleted` ON `deal_health_alerts` (`deleted_at`) WHERE `deleted_at` IS NULL;

-- ============================================================================
-- AUDIT TRAIL (immutable, append-only)
-- ============================================================================

CREATE TABLE `audit_trails` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `table_name` VARCHAR(100) NOT NULL,
    `record_id` CHAR(36) NOT NULL,
    `operation` ENUM('INSERT','UPDATE','DELETE','SOFT_DELETE','RESTORE') NOT NULL,
    `changed_by` CHAR(36),
    `changed_by_role` ENUM('rep','manager','finance','admin','customer'),
    `old_values` JSON,
    `new_values` JSON,
    `changed_fields` JSON,
    `ip_address` VARCHAR(45),
    `user_agent` VARCHAR(500),
    `request_id` CHAR(36),
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_audit_trails_changed_by` FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Partition by month for performance (MySQL 8.0+ native partitioning)
-- Note: Partition definition would be added in production via ALTER TABLE
CREATE INDEX `idx_audit_trails_table_record` ON `audit_trails` (`table_name`, `record_id`);
CREATE INDEX `idx_audit_trails_changed_by` ON `audit_trails` (`changed_by`);
CREATE INDEX `idx_audit_trails_created` ON `audit_trails` (`created_at`);
CREATE INDEX `idx_audit_trails_operation` ON `audit_trails` (`operation`);

-- ============================================================================
-- VIEWS FOR COMMON REPORTING QUERIES
-- ============================================================================

-- Active quotations with computed fields
CREATE OR REPLACE VIEW `v_active_quotations` AS
SELECT 
    q.*,
    c.`company_name` AS `customer_name`,
    c.`tier` AS `customer_tier`,
    u.`full_name` AS `rep_name`,
    COUNT(ql.`id`) AS `line_count`,
    SUM(CASE WHEN ql.`line_type` = 'recurring' THEN 1 ELSE 0 END) AS `recurring_line_count`,
    SUM(CASE WHEN ql.`line_type` = 'one_time' THEN 1 ELSE 0 END) AS `onetime_line_count`
FROM `quotations` q
JOIN `customers` c ON q.`customer_id` = c.`id`
LEFT JOIN `users` u ON q.`assigned_rep_id` = u.`id`
LEFT JOIN `quotation_lines` ql ON ql.`quotation_id` = q.`id` AND ql.`deleted_at` IS NULL
WHERE q.`deleted_at` IS NULL
  AND c.`deleted_at` IS NULL
GROUP BY q.`id`, c.`company_name`, c.`tier`, u.`full_name`;

-- Stock availability view
CREATE OR REPLACE VIEW `v_stock_availability` AS
SELECT 
    sl.`warehouse_id`,
    w.`code` AS `warehouse_code`,
    w.`name` AS `warehouse_name`,
    sl.`product_id`,
    p.`sku`,
    p.`name` AS `product_name`,
    sl.`variant_id`,
    pv.`sku` AS `variant_sku`,
    sl.`quantity_on_hand`,
    sl.`quantity_reserved`,
    sl.`quantity_available`,
    sl.`reorder_point`,
    CASE 
        WHEN sl.`quantity_available` <= sl.`reorder_point` THEN 'reorder'
        WHEN sl.`quantity_available` <= sl.`reorder_point` * 2 THEN 'low'
        ELSE 'ok'
    END AS `stock_status`
FROM `stock_levels` sl
JOIN `warehouses` w ON sl.`warehouse_id` = w.`id`
JOIN `products` p ON sl.`product_id` = p.`id`
LEFT JOIN `product_variants` pv ON sl.`variant_id` = pv.`id`
WHERE sl.`deleted_at` IS NULL
  AND w.`deleted_at` IS NULL
  AND p.`deleted_at` IS NULL
  AND (pv.`deleted_at` IS NULL OR pv.`id` IS NULL);

SET FOREIGN_KEY_CHECKS = 1;