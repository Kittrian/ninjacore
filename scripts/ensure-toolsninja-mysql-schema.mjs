#!/usr/bin/env node

import mysql from 'mysql2/promise';
import 'dotenv/config';

const cfg = {
  host: (process.env.TOOLSNINJA_DB_HOST || process.env.MYSQL_HOST || '127.0.0.1').trim(),
  port: Number.parseInt(process.env.TOOLSNINJA_DB_PORT || process.env.MYSQL_PORT || '3306', 10) || 3306,
  user: (process.env.TOOLSNINJA_DB_USER || process.env.MYSQL_USER || 'ninjacore').trim(),
  password: (process.env.TOOLSNINJA_DB_PASSWORD || process.env.MYSQL_PASSWORD || '').trim(),
  database: (process.env.TOOLSNINJA_DB_NAME || process.env.MYSQL_DATABASE || 'TOOLSNINJA').trim(),
};

if (!cfg.user || !cfg.password) {
  console.error('Missing TOOLSNINJA DB credentials (TOOLSNINJA_DB_USER/TOOLSNINJA_DB_PASSWORD).');
  process.exit(1);
}

const run = async () => {
  const conn = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    multipleStatements: true,
  });

  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${cfg.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${cfg.database}\``);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS report_history (
        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        client_id VARCHAR(128) NOT NULL,
        source VARCHAR(128) NOT NULL,
        monitoring_agency VARCHAR(255) NULL,
        report_date VARCHAR(64) NULL,
        report_file_name VARCHAR(512) NULL,
        report_html LONGTEXT NULL,
        report_json LONGTEXT NULL,
        response_url TEXT NULL,
        snapshot_checksum VARCHAR(128) NOT NULL,
        metadata_json LONGTEXT NULL,
        created_at VARCHAR(64) NOT NULL,
        UNIQUE KEY idx_report_history_client_checksum (client_id, snapshot_checksum),
        KEY idx_report_history_client_created_at (client_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS client_profiles (
        owner_key VARCHAR(191) NOT NULL DEFAULT 'admin',
        client_id VARCHAR(128) NOT NULL,
        first_name VARCHAR(255) NULL,
        last_name VARCHAR(255) NULL,
        email VARCHAR(320) NULL,
        dob VARCHAR(64) NULL,
        ssn VARCHAR(64) NULL,
        address TEXT NULL,
        phone VARCHAR(64) NULL,
        spouse_client_id VARCHAR(128) NULL,
        spouse_client_label VARCHAR(255) NULL,
        assigned_to VARCHAR(255) NULL,
        ninja_assigned VARCHAR(255) NULL,
        affiliate_assigned VARCHAR(255) NULL,
        status VARCHAR(128) NULL,
        phase VARCHAR(128) NULL,
        monitoring_agency VARCHAR(128) NULL,
        monitoring_username VARCHAR(320) NULL,
        monitoring_password TEXT NULL,
        secret_key TEXT NULL,
        monitoring_token TEXT NULL,
        portal_password VARCHAR(255) NULL,
        portal_enabled TINYINT(1) NULL,
        language VARCHAR(64) NULL,
        goal LONGTEXT NULL,
        notes LONGTEXT NULL,
        yearly_income VARCHAR(64) NULL,
        housing_payment VARCHAR(64) NULL,
        debt_monthly_payments TEXT NULL,
        next_import_int VARCHAR(64) NULL,
        next_import_label VARCHAR(128) NULL,
        next_import_mode VARCHAR(64) NULL,
        manual_next_import_start_days VARCHAR(64) NULL,
        manual_next_import_set_date VARCHAR(64) NULL,
        refresh_next_import_start_date VARCHAR(64) NULL,
        documents_json LONGTEXT NULL,
        report_date VARCHAR(64) NULL,
        updated_at VARCHAR(64) NOT NULL,
        PRIMARY KEY (owner_key, client_id),
        UNIQUE KEY ux_client_profiles_owner_client (owner_key, client_id),
        KEY idx_client_profiles_owner_name (owner_key, last_name, first_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const ensureColumn = async (tableName, columnName, definitionSql) => {
      const [rows] = await conn.query(
        `SELECT COUNT(*) AS c
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [cfg.database, tableName, columnName],
      );
      const exists = Number(rows?.[0]?.c || 0) > 0;
      if (exists) return;
      await conn.query(`ALTER TABLE ${tableName} ADD COLUMN ${definitionSql}`);
    };

    await ensureColumn('client_profiles', 'owner_key', "owner_key VARCHAR(191) NOT NULL DEFAULT 'admin' FIRST");
    await ensureColumn('client_profiles', 'ninja_assigned', 'ninja_assigned VARCHAR(255) NULL AFTER assigned_to');
    await ensureColumn('client_profiles', 'affiliate_assigned', 'affiliate_assigned VARCHAR(255) NULL AFTER ninja_assigned');
    await ensureColumn('client_profiles', 'debt_monthly_payments', 'debt_monthly_payments TEXT NULL AFTER housing_payment');
    await ensureColumn('client_profiles', 'documents_json', 'documents_json LONGTEXT NULL AFTER refresh_next_import_start_date');

    await conn.query(`
      ALTER TABLE client_profiles
      DROP PRIMARY KEY,
      ADD PRIMARY KEY (owner_key, client_id)
    `).catch(() => {});

    await conn.query('CREATE UNIQUE INDEX ux_client_profiles_owner_client ON client_profiles (owner_key, client_id)').catch(() => {});
    await conn.query('CREATE INDEX idx_client_profiles_owner_name ON client_profiles (owner_key, last_name, first_name)').catch(() => {});

    await conn.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        username VARCHAR(255) NOT NULL PRIMARY KEY,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        setting_key VARCHAR(255) NOT NULL PRIMARY KEY,
        value_json LONGTEXT NOT NULL,
        updated_at VARCHAR(64) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS payment_merchants (
        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        owner_key VARCHAR(191) NOT NULL,
        merchant_name VARCHAR(255) NOT NULL,
        gateway VARCHAR(128) NOT NULL,
        api_id TEXT NULL,
        transaction_key TEXT NULL,
        is_default TINYINT(1) NOT NULL DEFAULT 0,
        status VARCHAR(128) NOT NULL DEFAULT 'Active',
        allowed_retries INT NOT NULL DEFAULT 3,
        retry_frequency_days INT NOT NULL DEFAULT 7,
        metadata_json LONGTEXT NULL,
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL,
        KEY idx_payment_merchants_owner (owner_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS payment_products (
        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        owner_key VARCHAR(191) NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        product_type VARCHAR(128) NOT NULL DEFAULT 'Service',
        price_cents INT NOT NULL DEFAULT 0,
        billing_frequency VARCHAR(64) NOT NULL DEFAULT 'monthly',
        status VARCHAR(128) NOT NULL DEFAULT 'Active',
        metadata_json LONGTEXT NULL,
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL,
        KEY idx_payment_products_owner (owner_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS payment_autopay (
        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        owner_key VARCHAR(191) NOT NULL,
        client_id VARCHAR(128) NULL,
        merchant_id BIGINT NULL,
        product_id BIGINT NULL,
        amount_cents INT NOT NULL DEFAULT 0,
        frequency_type VARCHAR(64) NOT NULL DEFAULT 'monthly',
        frequency_interval INT NOT NULL DEFAULT 1,
        next_charge_at VARCHAR(64) NULL,
        status VARCHAR(128) NOT NULL DEFAULT 'Active',
        retry_limit INT NOT NULL DEFAULT 3,
        retry_frequency_days INT NOT NULL DEFAULT 7,
        failure_count INT NOT NULL DEFAULT 0,
        last_error TEXT NULL,
        last_charge_at VARCHAR(64) NULL,
        metadata_json LONGTEXT NULL,
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL,
        KEY idx_payment_autopay_owner_next_charge (owner_key, next_charge_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS failed_payment_events (
        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        owner_key VARCHAR(191) NOT NULL,
        transaction_id VARCHAR(255) NOT NULL,
        event_at VARCHAR(64) NULL,
        client_name VARCHAR(255) NULL,
        email VARCHAR(320) NULL,
        phone VARCHAR(64) NULL,
        amount_cents INT NOT NULL DEFAULT 0,
        card_last4 VARCHAR(16) NULL,
        payment_method VARCHAR(128) NULL,
        failure_reason TEXT NULL,
        retry_label VARCHAR(128) NULL,
        notes TEXT NULL,
        status VARCHAR(128) NOT NULL DEFAULT 'Failed',
        next_action VARCHAR(255) NULL,
        completed VARCHAR(16) NOT NULL DEFAULT 'No',
        processor VARCHAR(128) NULL,
        customer_id VARCHAR(255) NULL,
        retry_eligible TINYINT(1) NOT NULL DEFAULT 0,
        occurrence_count INT NOT NULL DEFAULT 1,
        webhook_synced_at VARCHAR(64) NULL,
        webhook_last_status INT NULL,
        raw_json LONGTEXT NULL,
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL,
        last_seen_at VARCHAR(64) NOT NULL,
        UNIQUE KEY ux_failed_payment_owner_tx (owner_key, transaction_id),
        KEY idx_failed_payment_events_owner_event (owner_key, event_at, id),
        KEY idx_failed_payment_events_owner_name (owner_key, client_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`UPDATE client_profiles SET owner_key = 'admin' WHERE owner_key IS NULL OR TRIM(owner_key) = ''`);

    console.log(`[schema] ensured for ${cfg.host}:${cfg.port}/${cfg.database}`);
  } finally {
    await conn.end();
  }
};

run().catch((error) => {
  console.error(`[schema] failed: ${error?.message || error}`);
  process.exit(1);
});
