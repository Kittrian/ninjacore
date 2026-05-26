-- NinjaDispute SurrealDB Schema
-- Namespace: ninja  |  Database: dispute

DEFINE NAMESPACE ninja;
USE NS ninja;
DEFINE DATABASE dispute;
USE NS ninja DB dispute;

-- ─────────────────────────────────────────────
-- clients table
-- Merged from ninjatools.client_profiles + api.Clients
-- Binary payload stored for SIMD injection
-- ─────────────────────────────────────────────
DEFINE TABLE clients SCHEMAFULL;

-- identity & linkage
DEFINE FIELD client_id         ON clients TYPE string;
DEFINE FIELD external_client_id ON clients TYPE option<string>;
DEFINE FIELD source_db         ON clients TYPE string;   -- 'ninjatools' | 'api' | 'merged'

-- personal (plaintext for search)
DEFINE FIELD first_name        ON clients TYPE string;
DEFINE FIELD last_name         ON clients TYPE string;
DEFINE FIELD email             ON clients TYPE option<string>;
DEFINE FIELD phone             ON clients TYPE option<string>;
DEFINE FIELD address           ON clients TYPE option<string>;
DEFINE FIELD dob               ON clients TYPE option<string>;
DEFINE FIELD status            ON clients TYPE option<string>;

-- packed binary blob  (170 bytes, aligned for Rust SIMD)
-- layout: first_name[32] | last_name[32] | address[64] | dob[10] | ssn_enc[32]
DEFINE FIELD client_bin        ON clients TYPE bytes;
DEFINE FIELD ssn_iv            ON clients TYPE option<bytes>;  -- AES-GCM IV (12 bytes)
DEFINE FIELD ssn_tag           ON clients TYPE option<bytes>;  -- AES-GCM auth tag (16 bytes)

-- metadata
DEFINE FIELD assigned_to       ON clients TYPE option<string>;
DEFINE FIELD owner_key         ON clients TYPE option<string>;
DEFINE FIELD notes             ON clients TYPE option<string>;
DEFINE FIELD goal              ON clients TYPE option<string>;
DEFINE FIELD documents_json    ON clients TYPE option<string>;
DEFINE FIELD portal_enabled    ON clients TYPE option<bool>;
DEFINE FIELD phase             ON clients TYPE option<string>;
DEFINE FIELD monitoring_agency ON clients TYPE option<string>;
DEFINE FIELD updated_at        ON clients TYPE string;
DEFINE FIELD created_at        ON clients TYPE string;
DEFINE FIELD synced_at         ON clients TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_client_id     ON clients FIELDS client_id UNIQUE;
DEFINE INDEX idx_status        ON clients FIELDS status;
DEFINE INDEX idx_name_search   ON clients FIELDS first_name, last_name
  SEARCH ANALYZER ascii BM25;

-- ─────────────────────────────────────────────
-- reports table
-- Merged from ninjatools.report_history + api.Reports
-- ─────────────────────────────────────────────
DEFINE TABLE reports SCHEMAFULL;

DEFINE FIELD report_id         ON reports TYPE string;
DEFINE FIELD client_id         ON reports TYPE string;
DEFINE FIELD source_db         ON reports TYPE string;
DEFINE FIELD source            ON reports TYPE option<string>;
DEFINE FIELD report_date       ON reports TYPE option<string>;
DEFINE FIELD report_type       ON reports TYPE option<string>;
DEFINE FIELD report_html       ON reports TYPE option<string>;
DEFINE FIELD report_json       ON reports TYPE option<string>;   -- empty string; full JSON lives on disk or R2
DEFINE FIELD report_local_path ON reports TYPE option<string>;   -- abs path on Hetzner server for latest report per client
DEFINE FIELD report_r2_key     ON reports TYPE option<string>;   -- R2 key for archived/older reports
DEFINE FIELD accounts_json     ON reports TYPE option<string>;
DEFINE FIELD deletions_json    ON reports TYPE option<string>;
DEFINE FIELD progress_json     ON reports TYPE option<string>;
DEFINE FIELD snapshot_checksum ON reports TYPE option<string>;
DEFINE FIELD metadata_json     ON reports TYPE option<string>;
DEFINE FIELD created_at        ON reports TYPE string;
DEFINE FIELD synced_at         ON reports TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_report_id     ON reports FIELDS report_id UNIQUE;
DEFINE INDEX idx_report_client ON reports FIELDS client_id;

-- ─────────────────────────────────────────────
-- templates table  (from api.Templates)
-- ─────────────────────────────────────────────
DEFINE TABLE templates SCHEMAFULL;

DEFINE FIELD template_id       ON templates TYPE string;
DEFINE FIELD name              ON templates TYPE string;
DEFINE FIELD file_name         ON templates TYPE option<string>;
DEFINE FIELD file_html         ON templates TYPE option<string>;
DEFINE FIELD tu_json           ON templates TYPE option<string>;
DEFINE FIELD ex_json           ON templates TYPE option<string>;
DEFINE FIELD eq_json           ON templates TYPE option<string>;
DEFINE FIELD paragraphs_json   ON templates TYPE option<string>;
DEFINE FIELD created_at        ON templates TYPE string;
DEFINE FIELD updated_at        ON templates TYPE string;
DEFINE FIELD synced_at         ON templates TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_template_id   ON templates FIELDS template_id UNIQUE;
DEFINE INDEX idx_template_name ON templates FIELDS name UNIQUE;

-- ─────────────────────────────────────────────
-- paragraphs table  (from api.Paraghraphs)
-- ─────────────────────────────────────────────
DEFINE TABLE paragraphs SCHEMAFULL;

DEFINE FIELD paragraph_id      ON paragraphs TYPE string;
DEFINE FIELD key_name          ON paragraphs TYPE string;
DEFINE FIELD value             ON paragraphs TYPE option<string>;
DEFINE FIELD created_at        ON paragraphs TYPE string;
DEFINE FIELD updated_at        ON paragraphs TYPE string;
DEFINE FIELD synced_at         ON paragraphs TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_paragraph_id  ON paragraphs FIELDS paragraph_id UNIQUE;
DEFINE INDEX idx_paragraph_key ON paragraphs FIELDS key_name UNIQUE;

-- ─────────────────────────────────────────────
-- clients table — extended fields (added 2026-05-25)
-- ─────────────────────────────────────────────
DEFINE FIELD OVERWRITE client_bin                   ON clients TYPE option<bytes>;
DEFINE FIELD OVERWRITE ssn                          ON clients TYPE option<string>;
DEFINE FIELD OVERWRITE spouse_client_id             ON clients TYPE option<string>;
DEFINE FIELD OVERWRITE spouse_client_label          ON clients TYPE option<string>;
DEFINE FIELD OVERWRITE ninja_assigned               ON clients TYPE option<string>;
DEFINE FIELD OVERWRITE affiliate_assigned           ON clients TYPE option<string>;
DEFINE FIELD OVERWRITE monitoring_username          ON clients TYPE option<string>;
DEFINE FIELD OVERWRITE monitoring_password          ON clients TYPE option<string>;
DEFINE FIELD OVERWRITE secret_key                   ON clients TYPE option<string>;
DEFINE FIELD OVERWRITE monitoring_token             ON clients TYPE option<string>;
DEFINE FIELD OVERWRITE portal_password              ON clients TYPE option<string>;
DEFINE FIELD OVERWRITE language                     ON clients TYPE option<string>;
DEFINE FIELD OVERWRITE yearly_income                ON clients TYPE option<string>;
DEFINE FIELD OVERWRITE housing_payment              ON clients TYPE option<string>;
DEFINE FIELD OVERWRITE debt_monthly_payments        ON clients TYPE option<string>;
DEFINE FIELD OVERWRITE next_import_int              ON clients TYPE option<string>;
DEFINE FIELD OVERWRITE next_import_label            ON clients TYPE option<string>;
DEFINE FIELD OVERWRITE next_import_mode             ON clients TYPE option<string>;
DEFINE FIELD OVERWRITE manual_next_import_start_days   ON clients TYPE option<string>;
DEFINE FIELD OVERWRITE manual_next_import_set_date     ON clients TYPE option<string>;
DEFINE FIELD OVERWRITE refresh_next_import_start_date  ON clients TYPE option<string>;
DEFINE FIELD OVERWRITE report_date                  ON clients TYPE option<string>;

-- ─────────────────────────────────────────────
-- reports table — extended fields (added 2026-05-25)
-- ─────────────────────────────────────────────
DEFINE FIELD OVERWRITE report_file_name   ON reports TYPE option<string>;
DEFINE FIELD OVERWRITE response_url       ON reports TYPE option<string>;
DEFINE FIELD OVERWRITE monitoring_agency  ON reports TYPE option<string>;
DEFINE FIELD OVERWRITE source_db          ON reports TYPE option<string>;

-- ─────────────────────────────────────────────
-- users table  (from ninjatools app_users)
-- ─────────────────────────────────────────────
DEFINE TABLE users SCHEMAFULL;
DEFINE FIELD username       ON users TYPE string;
DEFINE FIELD password_hash  ON users TYPE string;
DEFINE FIELD password_salt  ON users TYPE string;
DEFINE FIELD created_at     ON users TYPE string;
DEFINE FIELD updated_at     ON users TYPE string;
DEFINE INDEX idx_users_username ON users FIELDS username UNIQUE;

-- ─────────────────────────────────────────────
-- settings table  (from ninjatools app_settings)
-- ─────────────────────────────────────────────
DEFINE TABLE settings SCHEMAFULL;
DEFINE FIELD setting_key ON settings TYPE string;
DEFINE FIELD value_json  ON settings TYPE string;
DEFINE FIELD updated_at  ON settings TYPE string;
DEFINE INDEX idx_settings_key ON settings FIELDS setting_key UNIQUE;

-- ─────────────────────────────────────────────
-- merchants table  (from ninjatools payment_merchants)
-- ─────────────────────────────────────────────
DEFINE TABLE merchants SCHEMAFULL;
DEFINE FIELD owner_key             ON merchants TYPE string;
DEFINE FIELD merchant_name         ON merchants TYPE string;
DEFINE FIELD gateway               ON merchants TYPE string;
DEFINE FIELD api_id                ON merchants TYPE option<string>;
DEFINE FIELD transaction_key       ON merchants TYPE option<string>;
DEFINE FIELD is_default            ON merchants TYPE bool DEFAULT false;
DEFINE FIELD status                ON merchants TYPE string DEFAULT 'Active';
DEFINE FIELD allowed_retries       ON merchants TYPE int DEFAULT 3;
DEFINE FIELD retry_frequency_days  ON merchants TYPE int DEFAULT 7;
DEFINE FIELD metadata_json         ON merchants TYPE option<string>;
DEFINE FIELD created_at            ON merchants TYPE string;
DEFINE FIELD updated_at            ON merchants TYPE string;
DEFINE INDEX idx_merchants_owner   ON merchants FIELDS owner_key;

-- ─────────────────────────────────────────────
-- products table  (from ninjatools payment_products)
-- ─────────────────────────────────────────────
DEFINE TABLE products SCHEMAFULL;
DEFINE FIELD owner_key           ON products TYPE string;
DEFINE FIELD product_name        ON products TYPE string;
DEFINE FIELD product_type        ON products TYPE string DEFAULT 'Service';
DEFINE FIELD price_cents         ON products TYPE int DEFAULT 0;
DEFINE FIELD billing_frequency   ON products TYPE string DEFAULT 'monthly';
DEFINE FIELD status              ON products TYPE string DEFAULT 'Active';
DEFINE FIELD metadata_json       ON products TYPE option<string>;
DEFINE FIELD created_at          ON products TYPE string;
DEFINE FIELD updated_at          ON products TYPE string;
DEFINE INDEX idx_products_owner  ON products FIELDS owner_key;

-- ─────────────────────────────────────────────
-- autopay table  (from ninjatools payment_autopay)
-- ─────────────────────────────────────────────
DEFINE TABLE autopay SCHEMAFULL;
DEFINE FIELD owner_key              ON autopay TYPE string;
DEFINE FIELD client_id              ON autopay TYPE option<string>;
DEFINE FIELD merchant_id            ON autopay TYPE option<string>;
DEFINE FIELD product_id             ON autopay TYPE option<string>;
DEFINE FIELD amount_cents           ON autopay TYPE int DEFAULT 0;
DEFINE FIELD frequency_type         ON autopay TYPE string DEFAULT 'monthly';
DEFINE FIELD frequency_interval     ON autopay TYPE int DEFAULT 1;
DEFINE FIELD next_charge_at         ON autopay TYPE option<string>;
DEFINE FIELD status                 ON autopay TYPE string DEFAULT 'Active';
DEFINE FIELD retry_limit            ON autopay TYPE int DEFAULT 3;
DEFINE FIELD retry_frequency_days   ON autopay TYPE int DEFAULT 7;
DEFINE FIELD failure_count          ON autopay TYPE int DEFAULT 0;
DEFINE FIELD last_error             ON autopay TYPE option<string>;
DEFINE FIELD last_charge_at         ON autopay TYPE option<string>;
DEFINE FIELD metadata_json          ON autopay TYPE option<string>;
DEFINE FIELD created_at             ON autopay TYPE string;
DEFINE FIELD updated_at             ON autopay TYPE string;
DEFINE INDEX idx_autopay_owner      ON autopay FIELDS owner_key;

-- ─────────────────────────────────────────────
-- payment_events table  (from ninjatools failed_payment_events)
-- ─────────────────────────────────────────────
DEFINE TABLE payment_events SCHEMAFULL;
DEFINE FIELD owner_key           ON payment_events TYPE string;
DEFINE FIELD transaction_id      ON payment_events TYPE string;
DEFINE FIELD event_at            ON payment_events TYPE option<string>;
DEFINE FIELD client_name         ON payment_events TYPE option<string>;
DEFINE FIELD email               ON payment_events TYPE option<string>;
DEFINE FIELD phone               ON payment_events TYPE option<string>;
DEFINE FIELD amount_cents        ON payment_events TYPE int DEFAULT 0;
DEFINE FIELD card_last4          ON payment_events TYPE option<string>;
DEFINE FIELD payment_method      ON payment_events TYPE option<string>;
DEFINE FIELD failure_reason      ON payment_events TYPE option<string>;
DEFINE FIELD retry_label         ON payment_events TYPE option<string>;
DEFINE FIELD notes               ON payment_events TYPE option<string>;
DEFINE FIELD status              ON payment_events TYPE string DEFAULT 'Failed';
DEFINE FIELD next_action         ON payment_events TYPE option<string>;
DEFINE FIELD completed           ON payment_events TYPE string DEFAULT 'No';
DEFINE FIELD processor           ON payment_events TYPE option<string>;
DEFINE FIELD customer_id         ON payment_events TYPE option<string>;
DEFINE FIELD retry_eligible      ON payment_events TYPE bool DEFAULT false;
DEFINE FIELD occurrence_count    ON payment_events TYPE int DEFAULT 1;
DEFINE FIELD webhook_synced_at   ON payment_events TYPE option<string>;
DEFINE FIELD webhook_last_status ON payment_events TYPE option<int>;
DEFINE FIELD raw_json            ON payment_events TYPE option<string>;
DEFINE FIELD created_at          ON payment_events TYPE string;
DEFINE FIELD updated_at          ON payment_events TYPE string;
DEFINE FIELD last_seen_at        ON payment_events TYPE string;
DEFINE INDEX idx_pe_owner_tx ON payment_events FIELDS owner_key, transaction_id UNIQUE;
DEFINE INDEX idx_pe_owner    ON payment_events FIELDS owner_key;

-- ─────────────────────────────────────────────
-- sync_state  (tracks last sync timestamps)
-- ─────────────────────────────────────────────
DEFINE TABLE sync_state SCHEMAFULL;
DEFINE FIELD source            ON sync_state TYPE string;
DEFINE FIELD table_name        ON sync_state TYPE string;
DEFINE FIELD last_synced_at    ON sync_state TYPE string;

DEFINE INDEX idx_sync_key      ON sync_state FIELDS source, table_name UNIQUE;

-- ─────────────────────────────────────────────
-- api_users table  (from api.Users)
-- Kept separate from ninjatools users until auth is intentionally unified.
-- ─────────────────────────────────────────────
DEFINE TABLE api_users SCHEMAFULL;
DEFINE FIELD api_user_id       ON api_users TYPE int;
DEFINE FIELD name              ON api_users TYPE option<string>;
DEFINE FIELD email             ON api_users TYPE string;
DEFINE FIELD password_hash     ON api_users TYPE string;
DEFINE FIELD profile           ON api_users TYPE option<string>;
DEFINE FIELD token_version     ON api_users TYPE int DEFAULT 0;
DEFINE FIELD tenant_id         ON api_users TYPE option<int>;
DEFINE FIELD is_online         ON api_users TYPE bool DEFAULT false;
DEFINE FIELD status            ON api_users TYPE option<string>;
DEFINE FIELD last_login        ON api_users TYPE option<datetime>;
DEFINE FIELD created_at        ON api_users TYPE option<datetime>;
DEFINE FIELD updated_at        ON api_users TYPE option<datetime>;
DEFINE INDEX idx_api_users_email ON api_users FIELDS email UNIQUE;
DEFINE INDEX idx_api_users_api_id ON api_users FIELDS api_user_id UNIQUE;

-- ─────────────────────────────────────────────
-- api_reports table  (from api.Reports)
-- Holds saved dispute/report arrays without touching merged clients yet.
-- ─────────────────────────────────────────────
DEFINE TABLE api_reports SCHEMAFULL;
DEFINE FIELD client_id               ON api_reports TYPE int;
DEFINE FIELD username                ON api_reports TYPE option<string>;
DEFINE FIELD password                ON api_reports TYPE option<string>;
DEFINE FIELD report_type             ON api_reports TYPE option<string>;
DEFINE FIELD deletions_lists         ON api_reports TYPE option<array>;
DEFINE FIELD compare                 ON api_reports TYPE option<array>;
DEFINE FIELD progress                ON api_reports TYPE option<array>;
DEFINE FIELD accounts                ON api_reports TYPE option<array>;
DEFINE FIELD alternate_letters       ON api_reports TYPE option<array>;
DEFINE FIELD new_version             ON api_reports TYPE bool DEFAULT true;
DEFINE FIELD created_at              ON api_reports TYPE option<datetime>;
DEFINE FIELD updated_at              ON api_reports TYPE option<datetime>;
DEFINE INDEX idx_api_reports_client_id ON api_reports FIELDS client_id UNIQUE;

-- ─────────────────────────────────────────────
-- report_data_entries table  (from api.ReportData)
-- Stores dated imported report payload partitions and credit score blobs.
-- ─────────────────────────────────────────────
DEFINE TABLE report_data_entries SCHEMAFULL;
DEFINE FIELD client_id               ON report_data_entries TYPE int;
DEFINE FIELD key_date                ON report_data_entries TYPE option<string>;
DEFINE FIELD inquiry_partition       ON report_data_entries TYPE option<array>;
DEFINE FIELD subscriber              ON report_data_entries TYPE option<array>;
DEFINE FIELD trade_line_partition    ON report_data_entries TYPE option<array>;
DEFINE FIELD credit_score            ON report_data_entries TYPE option<object>;
DEFINE FIELD deletions_lists         ON report_data_entries TYPE option<array>;
DEFINE FIELD public_record_partition ON report_data_entries TYPE option<array>;
DEFINE FIELD origin                  ON report_data_entries TYPE option<object>;
DEFINE FIELD created_at              ON report_data_entries TYPE option<datetime>;
DEFINE FIELD updated_at              ON report_data_entries TYPE option<datetime>;
DEFINE INDEX idx_report_data_client_key ON report_data_entries FIELDS client_id, key_date UNIQUE;
DEFINE INDEX idx_report_data_client_date ON report_data_entries FIELDS client_id, key_date;

-- ─────────────────────────────────────────────
-- extra_infos table  (from api.ExtraInfos)
-- Name/value client extras kept separate from merged clients for now.
-- ─────────────────────────────────────────────
DEFINE TABLE extra_infos SCHEMAFULL;
DEFINE FIELD client_id               ON extra_infos TYPE int;
DEFINE FIELD name                    ON extra_infos TYPE string;
DEFINE FIELD value                   ON extra_infos TYPE option<string>;
DEFINE FIELD created_at              ON extra_infos TYPE option<datetime>;
DEFINE FIELD updated_at              ON extra_infos TYPE option<datetime>;
DEFINE INDEX idx_extra_infos_client  ON extra_infos FIELDS client_id;

-- ─────────────────────────────────────────────
-- alternate_letters table  (from api.AlternateLetters)
-- ─────────────────────────────────────────────
DEFINE TABLE alternate_letters SCHEMAFULL;
DEFINE FIELD name                    ON alternate_letters TYPE string;
DEFINE FIELD file_html               ON alternate_letters TYPE option<string>;
DEFINE FIELD created_at              ON alternate_letters TYPE option<datetime>;
DEFINE FIELD updated_at              ON alternate_letters TYPE option<datetime>;
DEFINE INDEX idx_alternate_letters_name ON alternate_letters FIELDS name;

-- ─────────────────────────────────────────────
-- creditor_contacts table  (from api.CreditorContacts)
-- ─────────────────────────────────────────────
DEFINE TABLE creditor_contacts SCHEMAFULL;
DEFINE FIELD name                    ON creditor_contacts TYPE string;
DEFINE FIELD value                   ON creditor_contacts TYPE option<string>;
DEFINE FIELD created_at              ON creditor_contacts TYPE option<datetime>;
DEFINE FIELD updated_at              ON creditor_contacts TYPE option<datetime>;
DEFINE INDEX idx_creditor_contacts_name ON creditor_contacts FIELDS name;

-- ─────────────────────────────────────────────
-- gemini_keys table  (from api.gemini_keys)
-- ─────────────────────────────────────────────
DEFINE TABLE gemini_keys SCHEMAFULL;
DEFINE FIELD key                     ON gemini_keys TYPE string;
DEFINE FIELD owner                   ON gemini_keys TYPE option<string>;
DEFINE FIELD is_active               ON gemini_keys TYPE bool DEFAULT true;
DEFINE FIELD last_used_at            ON gemini_keys TYPE option<datetime>;
DEFINE FIELD cooldown_until          ON gemini_keys TYPE option<datetime>;
DEFINE FIELD created_at              ON gemini_keys TYPE option<datetime>;
DEFINE FIELD updated_at              ON gemini_keys TYPE option<datetime>;
DEFINE INDEX idx_gemini_keys_key     ON gemini_keys FIELDS key UNIQUE;

-- ─────────────────────────────────────────────
-- gemini_usages table  (from api.gemini_usages)
-- ─────────────────────────────────────────────
DEFINE TABLE gemini_usages SCHEMAFULL;
DEFINE FIELD api_key_id              ON gemini_usages TYPE int;
DEFINE FIELD model_name              ON gemini_usages TYPE option<string>;
DEFINE FIELD usage_date              ON gemini_usages TYPE option<string>;
DEFINE FIELD request_count           ON gemini_usages TYPE int DEFAULT 0;
DEFINE FIELD created_at              ON gemini_usages TYPE option<datetime>;
DEFINE FIELD updated_at              ON gemini_usages TYPE option<datetime>;
DEFINE INDEX idx_gemini_usages_key_date ON gemini_usages FIELDS api_key_id, usage_date;

-- seed initial sync_state rows
INSERT INTO sync_state [
  { source: 'ninjatools', table_name: 'client_profiles', last_synced_at: '1970-01-01 00:00:00' },
  { source: 'ninjatools', table_name: 'report_history',  last_synced_at: '1970-01-01 00:00:00' },
  { source: 'api',        table_name: 'Clients',         last_synced_at: '1970-01-01 00:00:00' },
  { source: 'api',        table_name: 'Reports',         last_synced_at: '1970-01-01 00:00:00' },
  { source: 'api',        table_name: 'ReportData',      last_synced_at: '1970-01-01 00:00:00' },
  { source: 'api',        table_name: 'ExtraInfos',      last_synced_at: '1970-01-01 00:00:00' },
  { source: 'api',        table_name: 'Templates',       last_synced_at: '1970-01-01 00:00:00' },
  { source: 'api',        table_name: 'Paraghraphs',     last_synced_at: '1970-01-01 00:00:00' },
  { source: 'api',        table_name: 'AlternateLetters', last_synced_at: '1970-01-01 00:00:00' },
  { source: 'api',        table_name: 'CreditorContacts', last_synced_at: '1970-01-01 00:00:00' },
  { source: 'api',        table_name: 'Users',           last_synced_at: '1970-01-01 00:00:00' },
  { source: 'api',        table_name: 'gemini_keys',     last_synced_at: '1970-01-01 00:00:00' },
  { source: 'api',        table_name: 'gemini_usages',   last_synced_at: '1970-01-01 00:00:00' }
];
