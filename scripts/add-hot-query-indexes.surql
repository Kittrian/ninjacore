-- Hot Query Indexing Migration
-- Adds covering indexes for the top 5 queries hit per request
-- Generated: 2026-05-27
--
-- Target Queries:
-- 1. external_client_id lookup (API client linking)
-- 2. owner_key + source_db (owner-specific client searches)
-- 3. client_id + created_at (report history ordering)
-- 4. owner_key + product/merchant (subscription lookups)
-- 5. owner_key dedup (payment_events distinct fields)

USE NS ninja DB dispute;

-- ─────────────────────────────────────────────
-- 1. External Client ID Index (API linking bridge)
-- ─────────────────────────────────────────────
-- Query: SELECT ... FROM clients WHERE external_client_id = ?
-- Used by: backfill-credentials-surreal.mjs, API sync operations
-- Impact: Critical for external system integration
DEFINE INDEX idx_external_client_id ON clients FIELDS external_client_id;

-- ─────────────────────────────────────────────
-- 2. Owner Key + Source DB Compound Index
-- ─────────────────────────────────────────────
-- Query: SELECT ... FROM clients WHERE owner_key = ? AND source_db = ?
-- Used by: Merchant, autopay, product operations (high volume)
-- Impact: Eliminates secondary filter after index scan
DEFINE INDEX idx_owner_source_db ON clients FIELDS owner_key, source_db;

-- ─────────────────────────────────────────────
-- 3. Report Client ID + Created At (Covering Index)
-- ─────────────────────────────────────────────
-- Query: SELECT * FROM reports WHERE client_id = ? ORDER BY created_at DESC LIMIT ?
-- Used by: Report history listing, audit trails
-- Impact: Avoids filesort by including ordering column
DEFINE INDEX idx_report_client_created ON reports FIELDS client_id, created_at;

-- ─────────────────────────────────────────────
-- 4. Autopay Owner + Product/Merchant Indexes
-- ─────────────────────────────────────────────
-- Query: SELECT * FROM autopay WHERE owner_key = ? AND (product_id|merchant_id) = ?
-- Used by: Subscription cancellation, payment method changes
-- Impact: Composite filter without second index scan
DEFINE INDEX idx_autopay_owner_product ON autopay FIELDS owner_key, product_id;
DEFINE INDEX idx_autopay_owner_merchant ON autopay FIELDS owner_key, merchant_id;

-- ─────────────────────────────────────────────
-- 5. Payment Events Dedup Index (Covering)
-- ─────────────────────────────────────────────
-- Query: SELECT DISTINCT email, customer_id FROM payment_events WHERE owner_key = ?
-- Used by: Payment reconciliation, dedup operations
-- Impact: Covers owner_key filter + dedup fields without table lookup
DEFINE INDEX idx_pe_owner_dedup ON payment_events FIELDS owner_key, email, customer_id;

-- ─────────────────────────────────────────────
-- Additional Supporting Indexes
-- ─────────────────────────────────────────────

-- Status lookups with date filtering (monitoring, phase changes)
DEFINE INDEX idx_client_status_updated ON clients FIELDS status, updated_at;

-- Template lookups with file tracking
DEFINE INDEX idx_template_name_updated ON templates FIELDS name, updated_at;

-- Extra info lookups (configuration, metadata)
DEFINE INDEX idx_extra_info_client_name ON extra_infos FIELDS client_id, name;
