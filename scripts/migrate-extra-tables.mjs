// migrate-extra-tables.mjs
// Migrates the remaining MySQL tables to SurrealDB:
//   app_users        → users
//   app_settings     → settings
//   payment_merchants→ merchants
//   payment_products → products
//   payment_autopay  → autopay
//   failed_payment_events → payment_events
// Also:
//   - Extends clients table with missing fields from client_profiles
//   - Adds report_file_name + response_url to reports table
// Run: node scripts/migrate-extra-tables.mjs
import mysql from 'mysql2/promise';

const SURREAL_AUTH = 'Basic ' + Buffer.from('root:Malachi77').toString('base64');
const SURREAL_URL = 'http://127.0.0.1:8000/sql';

async function surql(query) {
  const res = await fetch(SURREAL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/surrealql',
      Accept: 'application/json',
      'Surreal-NS': 'ninja',
      'Surreal-DB': 'dispute',
      Authorization: SURREAL_AUTH,
    },
    body: query,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 400)}`);
  }
  const d = await res.json();
  // Return array of results for multi-statement queries
  return d;
}

async function surqlOne(query) {
  const d = await surql(query);
  if (d[0]?.status === 'ERR') throw new Error(`SurrealDB ERR: ${d[0].result}`);
  return d[0]?.result;
}

function esc(v) {
  return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escId(v) {
  // For use inside ⟨⟩ SurrealDB record ID escaping
  return String(v == null ? '' : v).replace(/[⟨⟩]/g, '_');
}

// ── Connect to MySQL ────────────────────────────────────────────────────────
const conn = await mysql.createConnection({
  host: '127.0.0.1', port: 3306, database: 'ninjatools',
  user: 'ninjacore', password: 'Malachi77', multipleStatements: true,
});

console.log('Connected to MySQL ninjatools');

// ── Step 1: Extend Schema with DEFINE FIELD OVERWRITE ──────────────────────
console.log('\n── Step 1: Extending SurrealDB schema ──');
await surqlOne(`
  -- Make client_bin optional (was required bytes)
  DEFINE FIELD OVERWRITE client_bin ON clients TYPE option<bytes>;

  -- Missing client_profiles fields
  DEFINE FIELD OVERWRITE ssn                        ON clients TYPE option<string>;
  DEFINE FIELD OVERWRITE spouse_client_id           ON clients TYPE option<string>;
  DEFINE FIELD OVERWRITE spouse_client_label        ON clients TYPE option<string>;
  DEFINE FIELD OVERWRITE ninja_assigned             ON clients TYPE option<string>;
  DEFINE FIELD OVERWRITE affiliate_assigned         ON clients TYPE option<string>;
  DEFINE FIELD OVERWRITE monitoring_username        ON clients TYPE option<string>;
  DEFINE FIELD OVERWRITE monitoring_password        ON clients TYPE option<string>;
  DEFINE FIELD OVERWRITE secret_key                 ON clients TYPE option<string>;
  DEFINE FIELD OVERWRITE monitoring_token           ON clients TYPE option<string>;
  DEFINE FIELD OVERWRITE portal_password            ON clients TYPE option<string>;
  DEFINE FIELD OVERWRITE language                   ON clients TYPE option<string>;
  DEFINE FIELD OVERWRITE yearly_income              ON clients TYPE option<string>;
  DEFINE FIELD OVERWRITE housing_payment            ON clients TYPE option<string>;
  DEFINE FIELD OVERWRITE debt_monthly_payments      ON clients TYPE option<string>;
  DEFINE FIELD OVERWRITE next_import_int            ON clients TYPE option<string>;
  DEFINE FIELD OVERWRITE next_import_label          ON clients TYPE option<string>;
  DEFINE FIELD OVERWRITE next_import_mode           ON clients TYPE option<string>;
  DEFINE FIELD OVERWRITE manual_next_import_start_days ON clients TYPE option<string>;
  DEFINE FIELD OVERWRITE manual_next_import_set_date   ON clients TYPE option<string>;
  DEFINE FIELD OVERWRITE refresh_next_import_start_date ON clients TYPE option<string>;
  DEFINE FIELD OVERWRITE report_date                ON clients TYPE option<string>;
  DEFINE FIELD OVERWRITE external_client_id         ON clients TYPE option<string>;

  -- Missing reports fields
  DEFINE FIELD OVERWRITE report_file_name           ON reports TYPE option<string>;
  DEFINE FIELD OVERWRITE response_url               ON reports TYPE option<string>;
  DEFINE FIELD OVERWRITE monitoring_agency          ON reports TYPE option<string>;
  DEFINE FIELD OVERWRITE source_db                  ON reports TYPE option<string>;
`);
console.log('  ✓ clients + reports fields extended');

await surqlOne(`
  -- users table (app_users)
  DEFINE TABLE OVERWRITE users SCHEMAFULL;
  DEFINE FIELD OVERWRITE username       ON users TYPE string;
  DEFINE FIELD OVERWRITE password_hash  ON users TYPE string;
  DEFINE FIELD OVERWRITE password_salt  ON users TYPE string;
  DEFINE FIELD OVERWRITE created_at     ON users TYPE string;
  DEFINE FIELD OVERWRITE updated_at     ON users TYPE string;
  DEFINE INDEX OVERWRITE idx_users_username ON users FIELDS username UNIQUE;
`);
console.log('  ✓ users table defined');

await surqlOne(`
  -- settings table (app_settings)
  DEFINE TABLE OVERWRITE settings SCHEMAFULL;
  DEFINE FIELD OVERWRITE setting_key ON settings TYPE string;
  DEFINE FIELD OVERWRITE value_json  ON settings TYPE string;
  DEFINE FIELD OVERWRITE updated_at  ON settings TYPE string;
  DEFINE INDEX OVERWRITE idx_settings_key ON settings FIELDS setting_key UNIQUE;
`);
console.log('  ✓ settings table defined');

await surqlOne(`
  -- merchants table (payment_merchants)
  DEFINE TABLE OVERWRITE merchants SCHEMAFULL;
  DEFINE FIELD OVERWRITE owner_key             ON merchants TYPE string;
  DEFINE FIELD OVERWRITE merchant_name         ON merchants TYPE string;
  DEFINE FIELD OVERWRITE gateway               ON merchants TYPE string;
  DEFINE FIELD OVERWRITE api_id                ON merchants TYPE option<string>;
  DEFINE FIELD OVERWRITE transaction_key       ON merchants TYPE option<string>;
  DEFINE FIELD OVERWRITE is_default            ON merchants TYPE bool DEFAULT false;
  DEFINE FIELD OVERWRITE status                ON merchants TYPE string DEFAULT 'Active';
  DEFINE FIELD OVERWRITE allowed_retries       ON merchants TYPE int DEFAULT 3;
  DEFINE FIELD OVERWRITE retry_frequency_days  ON merchants TYPE int DEFAULT 7;
  DEFINE FIELD OVERWRITE metadata_json         ON merchants TYPE option<string>;
  DEFINE FIELD OVERWRITE created_at            ON merchants TYPE string;
  DEFINE FIELD OVERWRITE updated_at            ON merchants TYPE string;
  DEFINE INDEX OVERWRITE idx_merchants_owner   ON merchants FIELDS owner_key;
`);
console.log('  ✓ merchants table defined');

await surqlOne(`
  -- products table (payment_products)
  DEFINE TABLE OVERWRITE products SCHEMAFULL;
  DEFINE FIELD OVERWRITE owner_key           ON products TYPE string;
  DEFINE FIELD OVERWRITE product_name        ON products TYPE string;
  DEFINE FIELD OVERWRITE product_type        ON products TYPE string DEFAULT 'Service';
  DEFINE FIELD OVERWRITE price_cents         ON products TYPE int DEFAULT 0;
  DEFINE FIELD OVERWRITE billing_frequency   ON products TYPE string DEFAULT 'monthly';
  DEFINE FIELD OVERWRITE status              ON products TYPE string DEFAULT 'Active';
  DEFINE FIELD OVERWRITE metadata_json       ON products TYPE option<string>;
  DEFINE FIELD OVERWRITE created_at          ON products TYPE string;
  DEFINE FIELD OVERWRITE updated_at          ON products TYPE string;
  DEFINE INDEX OVERWRITE idx_products_owner  ON products FIELDS owner_key;
`);
console.log('  ✓ products table defined');

await surqlOne(`
  -- autopay table (payment_autopay)
  DEFINE TABLE OVERWRITE autopay SCHEMAFULL;
  DEFINE FIELD OVERWRITE owner_key              ON autopay TYPE string;
  DEFINE FIELD OVERWRITE client_id              ON autopay TYPE option<string>;
  DEFINE FIELD OVERWRITE merchant_id            ON autopay TYPE option<string>;
  DEFINE FIELD OVERWRITE product_id             ON autopay TYPE option<string>;
  DEFINE FIELD OVERWRITE amount_cents           ON autopay TYPE int DEFAULT 0;
  DEFINE FIELD OVERWRITE frequency_type         ON autopay TYPE string DEFAULT 'monthly';
  DEFINE FIELD OVERWRITE frequency_interval     ON autopay TYPE int DEFAULT 1;
  DEFINE FIELD OVERWRITE next_charge_at         ON autopay TYPE option<string>;
  DEFINE FIELD OVERWRITE status                 ON autopay TYPE string DEFAULT 'Active';
  DEFINE FIELD OVERWRITE retry_limit            ON autopay TYPE int DEFAULT 3;
  DEFINE FIELD OVERWRITE retry_frequency_days   ON autopay TYPE int DEFAULT 7;
  DEFINE FIELD OVERWRITE failure_count          ON autopay TYPE int DEFAULT 0;
  DEFINE FIELD OVERWRITE last_error             ON autopay TYPE option<string>;
  DEFINE FIELD OVERWRITE last_charge_at         ON autopay TYPE option<string>;
  DEFINE FIELD OVERWRITE metadata_json          ON autopay TYPE option<string>;
  DEFINE FIELD OVERWRITE created_at             ON autopay TYPE string;
  DEFINE FIELD OVERWRITE updated_at             ON autopay TYPE string;
  DEFINE INDEX OVERWRITE idx_autopay_owner      ON autopay FIELDS owner_key;
`);
console.log('  ✓ autopay table defined');

await surqlOne(`
  -- payment_events table (failed_payment_events)
  DEFINE TABLE OVERWRITE payment_events SCHEMAFULL;
  DEFINE FIELD OVERWRITE owner_key           ON payment_events TYPE string;
  DEFINE FIELD OVERWRITE transaction_id      ON payment_events TYPE string;
  DEFINE FIELD OVERWRITE event_at            ON payment_events TYPE option<string>;
  DEFINE FIELD OVERWRITE client_name         ON payment_events TYPE option<string>;
  DEFINE FIELD OVERWRITE email               ON payment_events TYPE option<string>;
  DEFINE FIELD OVERWRITE phone               ON payment_events TYPE option<string>;
  DEFINE FIELD OVERWRITE amount_cents        ON payment_events TYPE int DEFAULT 0;
  DEFINE FIELD OVERWRITE card_last4          ON payment_events TYPE option<string>;
  DEFINE FIELD OVERWRITE payment_method      ON payment_events TYPE option<string>;
  DEFINE FIELD OVERWRITE failure_reason      ON payment_events TYPE option<string>;
  DEFINE FIELD OVERWRITE retry_label         ON payment_events TYPE option<string>;
  DEFINE FIELD OVERWRITE notes               ON payment_events TYPE option<string>;
  DEFINE FIELD OVERWRITE status              ON payment_events TYPE string DEFAULT 'Failed';
  DEFINE FIELD OVERWRITE next_action         ON payment_events TYPE option<string>;
  DEFINE FIELD OVERWRITE completed           ON payment_events TYPE string DEFAULT 'No';
  DEFINE FIELD OVERWRITE processor           ON payment_events TYPE option<string>;
  DEFINE FIELD OVERWRITE customer_id         ON payment_events TYPE option<string>;
  DEFINE FIELD OVERWRITE retry_eligible      ON payment_events TYPE bool DEFAULT false;
  DEFINE FIELD OVERWRITE occurrence_count    ON payment_events TYPE int DEFAULT 1;
  DEFINE FIELD OVERWRITE webhook_synced_at   ON payment_events TYPE option<string>;
  DEFINE FIELD OVERWRITE webhook_last_status ON payment_events TYPE option<int>;
  DEFINE FIELD OVERWRITE raw_json            ON payment_events TYPE option<string>;
  DEFINE FIELD OVERWRITE created_at          ON payment_events TYPE string;
  DEFINE FIELD OVERWRITE updated_at          ON payment_events TYPE string;
  DEFINE FIELD OVERWRITE last_seen_at        ON payment_events TYPE string;
  DEFINE INDEX OVERWRITE idx_pe_owner_tx ON payment_events FIELDS owner_key, transaction_id UNIQUE;
  DEFINE INDEX OVERWRITE idx_pe_owner    ON payment_events FIELDS owner_key;
`);
console.log('  ✓ payment_events table defined');

// ── Step 2: Migrate client_profiles missing fields ─────────────────────────
console.log('\n── Step 2: Updating clients with missing fields from client_profiles ──');
const [cpRows] = await conn.query(`
  SELECT
    client_id, ssn, spouse_client_id, spouse_client_label,
    ninja_assigned, affiliate_assigned,
    monitoring_username, monitoring_password, secret_key, monitoring_token,
    portal_password, language, yearly_income, housing_payment,
    debt_monthly_payments, next_import_int, next_import_label, next_import_mode,
    manual_next_import_start_days, manual_next_import_set_date,
    refresh_next_import_start_date, report_date
  FROM client_profiles
  WHERE owner_key = 'admin'
`);
console.log(`  ${cpRows.length} client_profiles rows to update`);

let cpUpdated = 0, cpSkipped = 0;
for (const row of cpRows) {
  const clientId = String(row.client_id || '').trim();
  if (!clientId) { cpSkipped++; continue; }
  const safeId = clientId.replace(/[^a-zA-Z0-9_]/g, '_');
  const recordId = `clients:${safeId}_ninjatools`;

  const q = `UPDATE ${recordId} SET
    ssn = "${esc(row.ssn)}",
    spouse_client_id = "${esc(row.spouse_client_id)}",
    spouse_client_label = "${esc(row.spouse_client_label)}",
    ninja_assigned = "${esc(row.ninja_assigned)}",
    affiliate_assigned = "${esc(row.affiliate_assigned)}",
    monitoring_username = "${esc(row.monitoring_username)}",
    monitoring_password = "${esc(row.monitoring_password)}",
    secret_key = "${esc(row.secret_key)}",
    monitoring_token = "${esc(row.monitoring_token)}",
    portal_password = "${esc(row.portal_password)}",
    language = "${esc(row.language)}",
    yearly_income = "${esc(row.yearly_income)}",
    housing_payment = "${esc(row.housing_payment)}",
    debt_monthly_payments = "${esc(row.debt_monthly_payments)}",
    next_import_int = "${esc(row.next_import_int)}",
    next_import_label = "${esc(row.next_import_label)}",
    next_import_mode = "${esc(row.next_import_mode)}",
    manual_next_import_start_days = "${esc(row.manual_next_import_start_days)}",
    manual_next_import_set_date = "${esc(row.manual_next_import_set_date)}",
    refresh_next_import_start_date = "${esc(row.refresh_next_import_start_date)}",
    report_date = "${esc(row.report_date)}"`;
  try {
    await surqlOne(q);
    cpUpdated++;
  } catch (e) {
    // Record may not exist in SurrealDB (different client ID mapping) — skip
    cpSkipped++;
  }
  if ((cpUpdated + cpSkipped) % 100 === 0) {
    process.stdout.write(`\r  updated:${cpUpdated} skipped:${cpSkipped}`);
  }
}
console.log(`\r  ✓ clients updated: ${cpUpdated}, skipped: ${cpSkipped}`);

// ── Step 3: Update reports with missing fields (report_file_name, response_url) ──
console.log('\n── Step 3: Updating reports with missing fields ──');
const [rhRows] = await conn.query(`
  SELECT id, report_file_name, response_url, monitoring_agency
  FROM report_history
  WHERE report_file_name IS NOT NULL OR response_url IS NOT NULL OR monitoring_agency IS NOT NULL
`);
console.log(`  ${rhRows.length} report_history rows with extra fields`);

let rhUpdated = 0;
for (const row of rhRows) {
  if (!row.report_file_name && !row.response_url && !row.monitoring_agency) continue;
  const recordId = `reports:${row.id}_ninjatools`;
  try {
    await surqlOne(`UPDATE ${recordId} SET
      report_file_name = "${esc(row.report_file_name)}",
      response_url = "${esc(row.response_url)}",
      monitoring_agency = "${esc(row.monitoring_agency)}"`);
    rhUpdated++;
  } catch {
    // Record might not exist
  }
}
console.log(`  ✓ reports updated: ${rhUpdated}`);

// ── Step 4: Migrate app_users ──────────────────────────────────────────────
console.log('\n── Step 4: Migrating app_users → users ──');
const [userRows] = await conn.query(`SELECT * FROM app_users`);
console.log(`  ${userRows.length} users to migrate`);
let usersOk = 0;
for (const row of userRows) {
  const username = String(row.username || '').trim().toLowerCase();
  if (!username) continue;
  const safeUsername = escId(username);
  await surqlOne(`UPSERT users:⟨${safeUsername}⟩ SET
    username = "${esc(username)}",
    password_hash = "${esc(row.password_hash)}",
    password_salt = "${esc(row.password_salt)}",
    created_at = "${esc(row.created_at)}",
    updated_at = "${esc(row.updated_at)}"`);
  usersOk++;
}
console.log(`  ✓ ${usersOk} users migrated`);

// ── Step 5: Migrate app_settings ──────────────────────────────────────────
console.log('\n── Step 5: Migrating app_settings → settings ──');
const [settingRows] = await conn.query(`SELECT * FROM app_settings`);
console.log(`  ${settingRows.length} settings to migrate`);
let settingsOk = 0;
for (const row of settingRows) {
  const key = String(row.setting_key || '').trim();
  if (!key) continue;
  const safeKey = escId(key);
  await surqlOne(`UPSERT settings:⟨${safeKey}⟩ SET
    setting_key = "${esc(key)}",
    value_json = "${esc(row.value_json)}",
    updated_at = "${esc(row.updated_at)}"`);
  settingsOk++;
}
console.log(`  ✓ ${settingsOk} settings migrated`);

// ── Step 6: Migrate payment_merchants ─────────────────────────────────────
console.log('\n── Step 6: Migrating payment_merchants → merchants ──');
const [merchantRows] = await conn.query(`SELECT * FROM payment_merchants`);
console.log(`  ${merchantRows.length} merchants to migrate`);
let merchantsOk = 0;
for (const row of merchantRows) {
  const id = Number(row.id);
  await surqlOne(`UPSERT merchants:${id} SET
    owner_key = "admin",
    merchant_name = "${esc(row.merchant_name)}",
    gateway = "${esc(row.gateway)}",
    api_id = "${esc(row.api_id)}",
    transaction_key = "${esc(row.transaction_key)}",
    is_default = ${Number(row.is_default) === 1 ? 'true' : 'false'},
    status = "${esc(row.status || 'Active')}",
    allowed_retries = ${Number(row.allowed_retries || 3)},
    retry_frequency_days = ${Number(row.retry_frequency_days || 7)},
    metadata_json = "${esc(row.metadata_json)}",
    created_at = "${esc(row.created_at)}",
    updated_at = "${esc(row.updated_at)}"`);
  merchantsOk++;
}
console.log(`  ✓ ${merchantsOk} merchants migrated`);

// ── Step 7: Migrate payment_products ──────────────────────────────────────
console.log('\n── Step 7: Migrating payment_products → products ──');
const [productRows] = await conn.query(`SELECT * FROM payment_products`);
console.log(`  ${productRows.length} products to migrate`);
let productsOk = 0;
for (const row of productRows) {
  const id = Number(row.id);
  await surqlOne(`UPSERT products:${id} SET
    owner_key = "admin",
    product_name = "${esc(row.product_name)}",
    product_type = "${esc(row.product_type || 'Service')}",
    price_cents = ${Number(row.price_cents || 0)},
    billing_frequency = "${esc(row.billing_frequency || 'monthly')}",
    status = "${esc(row.status || 'Active')}",
    metadata_json = "${esc(row.metadata_json)}",
    created_at = "${esc(row.created_at)}",
    updated_at = "${esc(row.updated_at)}"`);
  productsOk++;
}
console.log(`  ✓ ${productsOk} products migrated`);

// ── Step 8: Migrate payment_autopay ───────────────────────────────────────
console.log('\n── Step 8: Migrating payment_autopay → autopay ──');
const [autopayRows] = await conn.query(`SELECT * FROM payment_autopay`);
console.log(`  ${autopayRows.length} autopay records to migrate`);
let autopayOk = 0;
for (const row of autopayRows) {
  const id = Number(row.id);
  // merchant_id and product_id stored as raw integers matching merchants:N and products:N
  const merchantId = row.merchant_id == null ? 'NONE' : `"merchants:${Number(row.merchant_id)}"`;
  const productId = row.product_id == null ? 'NONE' : `"products:${Number(row.product_id)}"`;
  await surqlOne(`UPSERT autopay:${id} SET
    owner_key = "admin",
    client_id = "${esc(row.client_id)}",
    merchant_id = ${merchantId},
    product_id = ${productId},
    amount_cents = ${Number(row.amount_cents || 0)},
    frequency_type = "${esc(row.frequency_type || 'monthly')}",
    frequency_interval = ${Number(row.frequency_interval || 1)},
    next_charge_at = "${esc(row.next_charge_at)}",
    status = "${esc(row.status || 'Active')}",
    retry_limit = ${Number(row.retry_limit || 3)},
    retry_frequency_days = ${Number(row.retry_frequency_days || 7)},
    failure_count = ${Number(row.failure_count || 0)},
    last_error = "${esc(row.last_error)}",
    last_charge_at = "${esc(row.last_charge_at)}",
    metadata_json = "${esc(row.metadata_json)}",
    created_at = "${esc(row.created_at)}",
    updated_at = "${esc(row.updated_at)}"`);
  autopayOk++;
}
console.log(`  ✓ ${autopayOk} autopay records migrated`);

// ── Step 9: Migrate failed_payment_events ─────────────────────────────────
console.log('\n── Step 9: Migrating failed_payment_events → payment_events ──');
const [peRows] = await conn.query(`SELECT * FROM failed_payment_events ORDER BY id ASC`);
console.log(`  ${peRows.length} failed_payment_events to migrate`);
let peOk = 0, peFail = 0;
for (const row of peRows) {
  const safeOwner = escId(String(row.owner_key || 'admin'));
  const safeTxId = escId(String(row.transaction_id || '').replace(/\s+/g, '_'));
  const recordId = `payment_events:⟨${safeOwner}_${safeTxId}⟩`;
  try {
    await surqlOne(`UPSERT ${recordId} SET
      owner_key = "${esc(row.owner_key || 'admin')}",
      transaction_id = "${esc(row.transaction_id)}",
      event_at = "${esc(row.event_at)}",
      client_name = "${esc(row.client_name)}",
      email = "${esc(row.email)}",
      phone = "${esc(row.phone)}",
      amount_cents = ${Number(row.amount_cents || 0)},
      card_last4 = "${esc(row.card_last4)}",
      payment_method = "${esc(row.payment_method)}",
      failure_reason = "${esc(row.failure_reason)}",
      retry_label = "${esc(row.retry_label)}",
      notes = "${esc(row.notes)}",
      status = "${esc(row.status || 'Failed')}",
      next_action = "${esc(row.next_action)}",
      completed = "${esc(row.completed || 'No')}",
      processor = "${esc(row.processor)}",
      customer_id = "${esc(row.customer_id)}",
      retry_eligible = ${Number(row.retry_eligible) === 1 ? 'true' : 'false'},
      occurrence_count = ${Number(row.occurrence_count || 1)},
      webhook_synced_at = "${esc(row.webhook_synced_at)}",
      webhook_last_status = ${row.webhook_last_status == null ? 'NONE' : Number(row.webhook_last_status)},
      raw_json = "${esc(row.raw_json)}",
      created_at = "${esc(row.created_at)}",
      updated_at = "${esc(row.updated_at)}",
      last_seen_at = "${esc(row.last_seen_at)}"`);
    peOk++;
  } catch (e) {
    peFail++;
    if (peFail <= 3) console.warn(`\n  warn: ${recordId}: ${e.message.slice(0, 80)}`);
  }
  if ((peOk + peFail) % 100 === 0) {
    process.stdout.write(`\r  ok:${peOk} fail:${peFail}`);
  }
}
console.log(`\r  ✓ ${peOk} payment_events migrated, ${peFail} failed`);

// ── Verify ─────────────────────────────────────────────────────────────────
console.log('\n── Verify counts ──');
const verifyQ = await surql(`
  SELECT COUNT() AS n FROM users GROUP ALL;
  SELECT COUNT() AS n FROM settings GROUP ALL;
  SELECT COUNT() AS n FROM merchants GROUP ALL;
  SELECT COUNT() AS n FROM products GROUP ALL;
  SELECT COUNT() AS n FROM autopay GROUP ALL;
  SELECT COUNT() AS n FROM payment_events GROUP ALL
`);
console.log(`  users:          ${verifyQ[0]?.result?.[0]?.n ?? 0}`);
console.log(`  settings:       ${verifyQ[1]?.result?.[0]?.n ?? 0}`);
console.log(`  merchants:      ${verifyQ[2]?.result?.[0]?.n ?? 0}`);
console.log(`  products:       ${verifyQ[3]?.result?.[0]?.n ?? 0}`);
console.log(`  autopay:        ${verifyQ[4]?.result?.[0]?.n ?? 0}`);
console.log(`  payment_events: ${verifyQ[5]?.result?.[0]?.n ?? 0}`);

await conn.end();
console.log('\nMigration complete!');
