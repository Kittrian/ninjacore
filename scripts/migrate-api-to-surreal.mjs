// migrate-api-to-surreal.mjs
// Migrates all api MySQL tables to SurrealDB on the same server (Contabo)
// Run: node migrate-api-to-surreal.mjs

import mysql from 'mysql2/promise';
import { createHash } from 'crypto';

const SURREAL_URL  = 'http://127.0.0.1:8000/sql';
const SURREAL_AUTH = 'Basic ' + Buffer.from('root:Malachi77').toString('base64');
const SURREAL_NS   = 'ninja';
const SURREAL_DB   = 'dispute';

const DB_CONFIG = {
  host: '127.0.0.1',
  user: 'api',
  password: '21Agustus123!!!',
  database: 'api',
  multipleStatements: true,
};

// ─── SurrealDB helpers ───────────────────────────────────────────────────────

async function surql(query) {
  const res = await fetch(SURREAL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/surrealql',
      Accept: 'application/json',
      'Surreal-NS': SURREAL_NS,
      'Surreal-DB': SURREAL_DB,
      Authorization: SURREAL_AUTH,
    },
    body: query,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SurrealDB HTTP ${res.status}: ${txt.slice(0, 400)}`);
  }
  const d = await res.json();
  const errs = d.filter(r => r.status === 'ERR');
  if (errs.length) throw new Error(`SurrealDB ERR: ${JSON.stringify(errs[0])}`);
  return d;
}

// Escape a value for embedding in SurrealQL string literals
function esc(v) {
  if (v == null) return '';
  return String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// Escape a value for use inside ⟨⟩ record ID
function sId(v) {
  return String(v ?? '').replace(/[⟨⟩]/g, '_');
}

// Format a Date for SurrealDB datetime
function fmtDt(v) {
  if (!v) return null;
  try { return new Date(v).toISOString(); } catch { return null; }
}

// Format a date-only value
function fmtDate(v) {
  if (!v) return null;
  try {
    const d = new Date(v);
    return d.toISOString().split('T')[0];
  } catch { return null; }
}

function j(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

// ─── Migration functions ──────────────────────────────────────────────────────

async function migrateUsers(db) {
  console.log('\n── Migrating Users ──');
  const [rows] = await db.query('SELECT * FROM Users');
  let ok = 0, skip = 0;

  for (const row of rows) {
    try {
      const dt = fmtDt(row.lastLogin) || 'time::now()';
      const lastLoginField = dt !== 'time::now()' ? `d"${dt}"` : 'time::now()';
      await surql(`UPSERT api_users:${row.id} SET
        name         = "${esc(row.name)}",
        email        = "${esc(row.email)}",
        password_hash = "${esc(row.password_hash)}",
        profile      = "${esc(row.profile || 'user')}",
        token_version = ${row.tokenVersion || 0},
        tenant_id    = ${row.tenantId || 0},
        is_online    = false,
        status       = "offline",
        last_login   = ${lastLoginField},
        created_at   = ${fmtDt(row.createdAt) ? `d"${fmtDt(row.createdAt)}"` : 'time::now()'},
        updated_at   = ${fmtDt(row.updatedAt) ? `d"${fmtDt(row.updatedAt)}"` : 'time::now()'}`);
      ok++;
    } catch (e) {
      console.warn(`  WARN user ${row.id}: ${e.message.slice(0, 100)}`);
      skip++;
    }
  }
  console.log(`  ✓ ${ok} users migrated, ${skip} skipped`);
}

async function migrateClients(db) {
  console.log('\n── Migrating Clients ──');
  const [rows] = await db.query('SELECT * FROM Clients');
  let ok = 0, skip = 0;

  for (const row of rows) {
    try {
      const nextReminder = fmtDt(row.nextReminder);
      const createPdf    = fmtDt(row.createPdf);
      const createdAt    = fmtDt(row.createdAt);
      const updatedAt    = fmtDt(row.updatedAt);

      await surql(`UPSERT api_clients:${row.id} SET
        user_id              = ${row.UserId || 'NONE'},
        first_name           = "${esc(row.first_name)}",
        last_name            = "${esc(row.last_name)}",
        phone                = "${esc(row.phone)}",
        email                = "${esc(row.email)}",
        current_address      = "${esc(row.currentAddress)}",
        address              = "${esc(row.address)}",
        addresses            = "${esc(row.addresses)}",
        names                = "${esc(row.names)}",
        ssn                  = "${esc(row.ssn)}",
        dob                  = "${esc(row.dob)}",
        secret_question_name = "${esc(row.secret_question_name)}",
        employers            = "${esc(row.employers)}",
        dl_id                = "${esc(row.dl_id)}",
        ssn_id               = "${esc(row.ssn_id)}",
        poa_id               = "${esc(row.poa_id)}",
        poa2_id              = "${esc(row.poa2_id)}",
        poa3_id              = "${esc(row.poa3_id)}",
        cover_sheet          = "${esc(row.cover_sheet)}",
        next_reminder        = ${nextReminder ? `d"${nextReminder}"` : 'NONE'},
        has_file             = ${row.hasFile ? 'true' : 'false'},
        create_pdf           = ${createPdf ? `d"${createPdf}"` : 'NONE'},
        created_at           = ${createdAt ? `d"${createdAt}"` : 'time::now()'},
        updated_at           = ${updatedAt ? `d"${updatedAt}"` : 'time::now()'}`);
      ok++;
    } catch (e) {
      console.warn(`  WARN client ${row.id}: ${e.message.slice(0, 120)}`);
      skip++;
    }
  }
  console.log(`  ✓ ${ok} clients migrated, ${skip} skipped`);
}

async function migrateReports(db) {
  console.log('\n── Migrating Reports ──');
  const [rows] = await db.query('SELECT * FROM Reports');
  let ok = 0, skip = 0;

  for (const row of rows) {
    try {
      await surql(`UPSERT api_reports:${row.ClientId} SET
        client_id        = ${row.ClientId},
        username         = "${esc(row.username)}",
        password         = "${esc(row.password)}",
        report_type      = "${esc(row.reportType || 'identity')}",
        deletions_lists  = "${esc(j(row.deletetionsLists))}",
        compare          = "${esc(j(row.compare))}",
        progress         = "${esc(j(row.progress))}",
        accounts         = "${esc(j(row.accounts))}",
        alternate_letters = "${esc(j(row.alternateLetters))}",
        new_version      = ${row.newVersion ? 'true' : 'false'},
        created_at       = ${fmtDt(row.createdAt) ? `d"${fmtDt(row.createdAt)}"` : 'time::now()'},
        updated_at       = ${fmtDt(row.updatedAt) ? `d"${fmtDt(row.updatedAt)}"` : 'time::now()'}`);
      ok++;
    } catch (e) {
      console.warn(`  WARN report client=${row.ClientId}: ${e.message.slice(0, 120)}`);
      skip++;
    }
  }
  console.log(`  ✓ ${ok} reports migrated, ${skip} skipped`);
}

async function migrateExtraInfos(db) {
  console.log('\n── Migrating ExtraInfos ──');
  const [rows] = await db.query('SELECT * FROM ExtraInfos');
  let ok = 0, skip = 0;

  for (const row of rows) {
    try {
      await surql(`UPSERT extra_infos:${row.id} SET
        client_id  = ${row.ClientId},
        name       = "${esc(row.name)}",
        value      = "${esc(row.value)}",
        created_at = ${fmtDt(row.createdAt) ? `d"${fmtDt(row.createdAt)}"` : 'time::now()'},
        updated_at = ${fmtDt(row.updatedAt) ? `d"${fmtDt(row.updatedAt)}"` : 'time::now()'}`);
      ok++;
    } catch (e) {
      console.warn(`  WARN extra_info ${row.id}: ${e.message.slice(0, 100)}`);
      skip++;
    }
    if (ok % 1000 === 0 && ok > 0) console.log(`  ... ${ok} extra_infos done`);
  }
  console.log(`  ✓ ${ok} extra_infos migrated, ${skip} skipped`);
}

async function migrateReportData(db) {
  console.log('\n── Migrating ReportData ──');
  const [rows] = await db.query('SELECT * FROM ReportData');
  let ok = 0, skip = 0;

  for (const row of rows) {
    try {
      await surql(`UPSERT report_data_entries:${row.id} SET
        client_id              = ${row.ClientId},
        key_date               = "${esc(fmtDate(row.keyDate) || '')}",
        inquiry_partition      = "${esc(j(row.InquiryPartition))}",
        subscriber             = "${esc(j(row.Subscriber))}",
        trade_line_partition   = "${esc(j(row.TradeLinePartition))}",
        credit_score           = "${esc(j(row.creditScore))}",
        deletions_lists        = "${esc(j(row.deletetionsLists))}",
        public_record_partition = "${esc(j(row.PulblicRecordPartition))}",
        origin                 = "${esc(j(row.origin))}",
        created_at             = ${fmtDt(row.createdAt) ? `d"${fmtDt(row.createdAt)}"` : 'time::now()'},
        updated_at             = ${fmtDt(row.updatedAt) ? `d"${fmtDt(row.updatedAt)}"` : 'time::now()'}`);
      ok++;
    } catch (e) {
      console.warn(`  WARN report_data ${row.id}: ${e.message.slice(0, 120)}`);
      skip++;
    }
    if (ok % 500 === 0 && ok > 0) console.log(`  ... ${ok} report_data done`);
  }
  console.log(`  ✓ ${ok} report_data_entries migrated, ${skip} skipped`);
}

async function migrateTemplates(db) {
  console.log('\n── Migrating Templates ──');
  const [rows] = await db.query('SELECT * FROM Templates');
  let ok = 0, skip = 0;

  for (const row of rows) {
    try {
      await surql(`UPSERT templates:${row.id} SET
        name          = "${esc(row.name)}",
        file_name     = "${esc(row.file_name)}",
        file_html     = "${esc(row.file_html)}",
        tu_json       = "${esc(j(row.tu))}",
        ex_json       = "${esc(j(row.ex))}",
        eq_json       = "${esc(j(row.eq))}",
        paragraphs_json = "${esc(j(row.paraghraphs))}",
        created_at    = "${esc(row.createdAt)}",
        updated_at    = "${esc(row.updatedAt)}"`);
      ok++;
    } catch (e) {
      console.warn(`  WARN template ${row.id}: ${e.message.slice(0, 100)}`);
      skip++;
    }
  }
  console.log(`  ✓ ${ok} templates migrated, ${skip} skipped`);
}

async function migrateParagraphs(db) {
  console.log('\n── Migrating Paragraphs ──');
  const [rows] = await db.query('SELECT * FROM Paraghraphs');
  let ok = 0, skip = 0;

  for (const row of rows) {
    try {
      await surql(`UPSERT paragraphs:${row.id} SET
        key_name   = "${esc(row.key)}",
        value      = "${esc(row.value)}",
        created_at = "${esc(row.createdAt)}",
        updated_at = "${esc(row.updatedAt)}"`);
      ok++;
    } catch (e) {
      console.warn(`  WARN paragraph ${row.id}: ${e.message.slice(0, 100)}`);
      skip++;
    }
  }
  console.log(`  ✓ ${ok} paragraphs migrated, ${skip} skipped`);
}

async function migrateAlternateLetters(db) {
  console.log('\n── Migrating AlternateLetters ──');
  const [rows] = await db.query('SELECT * FROM AlternateLetters');
  let ok = 0, skip = 0;

  for (const row of rows) {
    try {
      await surql(`UPSERT alternate_letters:${row.id} SET
        name      = "${esc(row.name)}",
        file_html = "${esc(row.file_html)}",
        created_at = ${fmtDt(row.createdAt) ? `d"${fmtDt(row.createdAt)}"` : 'time::now()'},
        updated_at = ${fmtDt(row.updatedAt) ? `d"${fmtDt(row.updatedAt)}"` : 'time::now()'}`);
      ok++;
    } catch (e) {
      console.warn(`  WARN alt_letter ${row.id}: ${e.message.slice(0, 100)}`);
      skip++;
    }
  }
  console.log(`  ✓ ${ok} alternate_letters migrated, ${skip} skipped`);
}

async function migrateCreditorContacts(db) {
  console.log('\n── Migrating CreditorContacts ──');
  const [rows] = await db.query('SELECT * FROM CreditorContacts');
  let ok = 0, skip = 0;

  for (const row of rows) {
    try {
      await surql(`UPSERT creditor_contacts:${row.id} SET
        name      = "${esc(row.name)}",
        value     = "${esc(row.value)}",
        created_at = ${fmtDt(row.createdAt) ? `d"${fmtDt(row.createdAt)}"` : 'time::now()'},
        updated_at = ${fmtDt(row.updatedAt) ? `d"${fmtDt(row.updatedAt)}"` : 'time::now()'}`);
      ok++;
    } catch (e) {
      console.warn(`  WARN creditor ${row.id}: ${e.message.slice(0, 100)}`);
      skip++;
    }
  }
  console.log(`  ✓ ${ok} creditor_contacts migrated, ${skip} skipped`);
}

async function migrateGeminiKeys(db) {
  console.log('\n── Migrating GeminiKeys ──');
  const [rows] = await db.query('SELECT * FROM gemini_keys');
  let ok = 0, skip = 0;

  for (const row of rows) {
    try {
      const lastUsed    = fmtDt(row.lastUsedAt);
      const cooldown    = fmtDt(row.cooldownUntil);
      await surql(`UPSERT gemini_keys:${row.id} SET
        key           = "${esc(row.key)}",
        owner         = "${esc(row.owner)}",
        is_active     = ${row.isActive ? 'true' : 'false'},
        last_used_at  = ${lastUsed ? `d"${lastUsed}"` : 'NONE'},
        cooldown_until = ${cooldown ? `d"${cooldown}"` : 'NONE'},
        created_at    = ${fmtDt(row.createdAt) ? `d"${fmtDt(row.createdAt)}"` : 'time::now()'},
        updated_at    = ${fmtDt(row.updatedAt) ? `d"${fmtDt(row.updatedAt)}"` : 'time::now()'}`);
      ok++;
    } catch (e) {
      console.warn(`  WARN gemini_key ${row.id}: ${e.message.slice(0, 100)}`);
      skip++;
    }
  }
  console.log(`  ✓ ${ok} gemini_keys migrated, ${skip} skipped`);
}

async function migrateGeminiUsages(db) {
  console.log('\n── Migrating GeminiUsages ──');
  const [rows] = await db.query('SELECT * FROM gemini_usages');
  let ok = 0, skip = 0;

  for (const row of rows) {
    try {
      await surql(`UPSERT gemini_usages:${row.id} SET
        api_key_id   = ${row.apiKeyId},
        model_name   = "${esc(row.modelName)}",
        usage_date   = "${esc(row.usageDate)}",
        request_count = ${row.requestCount || 0},
        created_at   = time::now(),
        updated_at   = time::now()`);
      ok++;
    } catch (e) {
      console.warn(`  WARN gemini_usage ${row.id}: ${e.message.slice(0, 100)}`);
      skip++;
    }
  }
  console.log(`  ✓ ${ok} gemini_usages migrated, ${skip} skipped`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== api MySQL → SurrealDB Migration ===');
  console.log(`SurrealDB: ${SURREAL_URL}`);

  // verify surreal connectivity
  const res = await fetch('http://127.0.0.1:8000/health');
  if (!res.ok) throw new Error('SurrealDB not reachable at localhost:8000');
  console.log('✓ SurrealDB reachable');

  const db = await mysql.createConnection(DB_CONFIG);
  console.log('✓ MySQL connected');

  await migrateUsers(db);
  await migrateClients(db);
  await migrateReports(db);
  await migrateExtraInfos(db);
  await migrateReportData(db);
  await migrateTemplates(db);
  await migrateParagraphs(db);
  await migrateAlternateLetters(db);
  await migrateCreditorContacts(db);
  await migrateGeminiKeys(db);
  await migrateGeminiUsages(db);

  await db.end();
  console.log('\n=== Migration complete ===');

  // Print final counts
  const AUTH = 'Basic ' + Buffer.from('root:Malachi77').toString('base64');
  const countQuery = `
    SELECT count() as n FROM api_users GROUP ALL;
    SELECT count() as n FROM api_clients GROUP ALL;
    SELECT count() as n FROM api_reports GROUP ALL;
    SELECT count() as n FROM extra_infos GROUP ALL;
    SELECT count() as n FROM report_data_entries GROUP ALL;
    SELECT count() as n FROM templates GROUP ALL;
    SELECT count() as n FROM paragraphs GROUP ALL;
    SELECT count() as n FROM alternate_letters GROUP ALL;
    SELECT count() as n FROM creditor_contacts GROUP ALL;
    SELECT count() as n FROM gemini_keys GROUP ALL;
    SELECT count() as n FROM gemini_usages GROUP ALL;
  `;
  const cr = await fetch(SURREAL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/surrealql', Accept: 'application/json', Authorization: AUTH, 'Surreal-NS': 'ninja', 'Surreal-DB': 'dispute' },
    body: countQuery,
  });
  const cd = await cr.json();
  const tables = ['api_users','api_clients','api_reports','extra_infos','report_data_entries','templates','paragraphs','alternate_letters','creditor_contacts','gemini_keys','gemini_usages'];
  console.log('\nFinal SurrealDB counts:');
  cd.forEach((r, i) => {
    if (r.status === 'OK') console.log(`  ${tables[i]}: ${r.result[0]?.n ?? 0}`);
  });
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
