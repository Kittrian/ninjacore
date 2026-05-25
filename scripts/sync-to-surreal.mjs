/**
 * sync-to-surreal.mjs
 *
 * Reads from both MySQL databases and upserts into SurrealDB.
 * Run once for full migration, then as a daemon (--daemon) for ongoing sync.
 *
 * Usage:
 *   node sync-to-surreal.mjs            # one-time full sync
 *   node sync-to-surreal.mjs --daemon   # poll every 15s forever
 */

import mysql from 'mysql2/promise';
import crypto from 'crypto';
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from 'fs';

// ── Config ────────────────────────────────────────────────────────────────────

const SURREAL_URL  = 'http://127.0.0.1:8000';
const SURREAL_NS   = 'ninja';
const SURREAL_DB   = 'dispute';
const SURREAL_USER = 'root';
const SURREAL_PASS = 'Malachi77';

// Cloudflare R2 (S3-compatible) — credit-reports bucket for OLDER/archived reports
const R2_ACCOUNT_ID     = '48aaa54206fe7ece5d8d40bb78eed4fd';
const R2_ACCESS_KEY     = process.env.R2_ACCESS_KEY || '06b0ca893b34ba104d7966623d0dc7b7';
const R2_SECRET_KEY     = process.env.R2_SECRET_KEY || '7deef66dabd6ff921ba373811914b207f4360f8173cf2fd8485ca35cf9a59475';
const R2_ENDPOINT       = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_REGION         = 'auto';
const R2_BUCKET_REPORTS = 'credit-reports';

// Local disk storage — latest report JSON per client stored here for fast access.
// Older reports (superseded by a newer pull) are archived to R2.
const LOCAL_REPORTS_DIR = '/var/lib/ninjadispute/reports';

// Ensure local dirs exist at startup
mkdirSync(`${LOCAL_REPORTS_DIR}/ninjatools`, { recursive: true });
mkdirSync(`${LOCAL_REPORTS_DIR}/api`,        { recursive: true });

const NINJATOOLS_DB = {
  host: '127.0.0.1', port: 3306,
  database: 'ninjatools', user: 'ninjacore', password: 'Malachi77',
};

const API_DB = {
  host: '147.93.190.166', port: 3306,
  database: 'api', user: 'api', password: '21Agustus123!!!',
};

// AES-256-GCM key derived from a fixed secret — change NINJA_SURREAL_KEY env var to rotate
const ENC_KEY = crypto.scryptSync(
  process.env.NINJA_SURREAL_KEY || 'NinjaDisputeSurrealKey2026!Secure',
  'ninjasalt',
  32
);

const DAEMON_MODE   = process.argv.includes('--daemon');
const POLL_INTERVAL = 15_000; // 15 seconds

// ── Crypto helpers ────────────────────────────────────────────────────────────

function encryptSSN(ssn) {
  if (!ssn) return { ciphertext: Buffer.alloc(32), iv: Buffer.alloc(12), tag: Buffer.alloc(16) };
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const enc    = Buffer.concat([cipher.update(ssn, 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  // pad/truncate to 32 bytes
  const out = Buffer.alloc(32);
  enc.copy(out, 0, 0, Math.min(enc.length, 32));
  return { ciphertext: out, iv, tag };
}

// ── Binary packer ─────────────────────────────────────────────────────────────
// Layout matches Rust struct:
// first_name[32] | last_name[32] | address[64] | dob[10] | ssn_enc[32]  = 170 bytes
// Padded to 192 (next multiple of 32) for alignment

function packClientBin(first, last, addr, dob, ssnEnc) {
  const buf = Buffer.alloc(192, 0); // zero-filled, 192 bytes (aligned to 32)
  const write = (str, offset, len) => {
    const b = Buffer.from((str || '').slice(0, len), 'utf8');
    b.copy(buf, offset);
  };
  write(first,  0,   32);
  write(last,   32,  32);
  write(addr,   64,  64);
  write(dob,    128, 10);
  if (ssnEnc) ssnEnc.copy(buf, 138, 0, 32);
  return buf;
}

// ── SurrealDB HTTP helper ─────────────────────────────────────────────────────

async function surql(query) {
  const res = await fetch(`${SURREAL_URL}/sql`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/surrealql',
      'Accept':        'application/json',
      'Surreal-NS':    SURREAL_NS,
      'Surreal-DB':    SURREAL_DB,
      Authorization: 'Basic ' + Buffer.from(`${SURREAL_USER}:${SURREAL_PASS}`).toString('base64'),
    },
    body: query,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SurrealDB HTTP ${res.status}: ${txt}`);
  }
  const data = await res.json();
  // SurrealDB returns 200 even for statement-level errors — check each result
  if (Array.isArray(data)) {
    for (const r of data) {
      if (r.status === 'ERR') throw new Error(`SurrealDB ERR: ${r.result}`);
    }
  }
  return data;
}

// ── Cloudflare R2 upload (native AWS SigV4 — no extra deps) ──────────────────

function _hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}
function _sha256hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Upload content to a Cloudflare R2 bucket via S3-compatible PUT.
 * Returns the object key (bucket/key) on success.
 */
async function uploadToR2(bucket, key, content) {
  const body       = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  const now        = new Date();
  const dateStr    = now.toISOString().slice(0, 10).replace(/-/g, '');          // YYYYMMDD
  const dateTime   = dateStr + 'T' + now.toISOString().slice(11, 19).replace(/:/g, '') + 'Z'; // YYYYMMDDTHHmmssZ
  const host       = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const payHash    = _sha256hex(body);
  const ctype      = 'application/json';

  // Canonical headers must be sorted alphabetically by header name
  const canHeaders = `content-type:${ctype}\nhost:${host}\nx-amz-content-sha256:${payHash}\nx-amz-date:${dateTime}\n`;
  const signedHdrs = 'content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalReq = ['PUT', `/${bucket}/${key}`, '', canHeaders, signedHdrs, payHash].join('\n');
  const credScope    = `${dateStr}/${R2_REGION}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', dateTime, credScope, _sha256hex(canonicalReq)].join('\n');

  const signingKey = _hmac(
    _hmac(_hmac(_hmac(`AWS4${R2_SECRET_KEY}`, dateStr), R2_REGION), 's3'),
    'aws4_request'
  );
  const signature  = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authHeader = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY}/${credScope}, SignedHeaders=${signedHdrs}, Signature=${signature}`;

  const res = await fetch(`${R2_ENDPOINT}/${bucket}/${key}`, {
    method: 'PUT',
    headers: {
      'Content-Type':          ctype,
      'Host':                  host,
      'x-amz-content-sha256': payHash,
      'x-amz-date':           dateTime,
      'Authorization':         authHeader,
    },
    body,
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`R2 PUT ${res.status}: ${txt.slice(0, 300)}`);
  }

  return `${bucket}/${key}`;
}

// ── Upsert helpers ────────────────────────────────────────────────────────────

// Upsert a single client record — captures EVERY field from both MySQL sources
async function upsertClient(row, sourceDb) {
  const { ciphertext, iv, tag } = encryptSSN(row.ssn || row.SSN);
  const firstName = row.first_name || '';
  const lastName  = row.last_name  || '';

  // Street address: normalize newlines to space so it reads as one line
  const rawAddr = row.address || row.currentAddress || '';
  const streetAddress = rawAddr.replace(/\r?\n/g, ', ').replace(/,\s*,/g, ',').trim();

  // dob may be a JS Date object (mysql2 date type) or a string
  let dob = '';
  if (row.dob) {
    const d = row.dob instanceof Date ? row.dob : new Date(row.dob);
    if (!isNaN(d.getTime())) {
      dob = d.toISOString().slice(0, 10); // always 'YYYY-MM-DD'
    } else {
      dob = String(row.dob).slice(0, 10); // already a string like '01-24-1977'
    }
  }

  // Binary pack uses clean single-line address for SIMD injection
  const bin = packClientBin(firstName, lastName, streetAddress, dob, ciphertext);

  // Escape helper for short strings embedded in SurrealQL
  const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '').slice(0, 5000);
  // b64field: stores large/JSON strings safely as base64-decoded bytes cast to string
  // SurrealDB: type::string(encoding::base64::decode(...)) roundtrips correctly for option<string> fields
  const b64field = (s) => {
    const str = (!s) ? '' : (typeof s === 'string' ? s : JSON.stringify(s));
    return `type::string(encoding::base64::decode("${Buffer.from(str, 'utf8').toString('base64')}"))`;
  };

  const clientId = String(row.client_id || row.id || '');
  const recordId = `clients:${clientId.replace(/[^a-zA-Z0-9_]/g, '_')}_${sourceDb}`;
  const now      = new Date().toISOString();
  const updatedAt = row.updated_at || row.updatedAt || now;

  // ── documents_json ──────────────────────────────────────────────────────────
  // ninjatools stores full JSON blob; api DB stores individual file key fields
  let docsJson = '';
  if (row.documents_json) {
    docsJson = esc(row.documents_json);
  } else if (sourceDb === 'api') {
    // Reconstruct documents array from api DB individual key fields
    const docs = [
      { id: 'sync-id-document',            type: 'ID Document',              storageKey: row.dl_id     || '', fileName: row.dl_id     ? row.dl_id.split('/').pop()     : '' },
      { id: 'sync-ssn-document',           type: 'SSN Document',             storageKey: row.ssn_id    || '', fileName: row.ssn_id    ? row.ssn_id.split('/').pop()    : '' },
      { id: 'sync-poa-document',           type: 'POA Document',             storageKey: row.poa_id    || '', fileName: row.poa_id    ? row.poa_id.split('/').pop()    : '' },
      { id: 'sync-poa2-document',          type: 'POA2 Document',            storageKey: row.poa2_id   || '', fileName: row.poa2_id   ? row.poa2_id.split('/').pop()   : '' },
      { id: 'sync-poa3-document',          type: 'POA3 Document',            storageKey: row.poa3_id   || '', fileName: row.poa3_id   ? row.poa3_id.split('/').pop()   : '' },
      { id: 'sync-limited-power-of-attorney', type: 'Limited Power of Attorney', storageKey: row.cover_sheet || '', fileName: row.cover_sheet ? row.cover_sheet.split('/').pop() : '' },
    ];
    docsJson = esc(JSON.stringify(docs));
  }

  await surql(`
    UPSERT ${recordId} CONTENT {
      client_id:          "${esc(clientId)}",
      external_client_id: "${esc(row.external_client_id || '')}",
      source_db:          "${sourceDb}",

      first_name:         "${esc(firstName)}",
      last_name:          "${esc(lastName)}",
      email:              "${esc(row.email || '')}",
      phone:              "${esc(row.phone || '')}",
      address:            "${esc(streetAddress)}",
      current_address:    "${esc((row.currentAddress || row.address || '').replace(/\r?\n/g, ', ').trim())}",
      dob:                "${esc(dob)}",
      ssn_iv:             encoding::base64::decode("${iv.toString('base64')}"),
      ssn_tag:            encoding::base64::decode("${tag.toString('base64')}"),
      client_bin:         encoding::base64::decode("${bin.toString('base64')}"),

      status:             "${esc(row.status || '')}",
      phase:              "${esc(row.phase || '')}",
      language:           "${esc(row.language || '')}",

      documents_json:     ${b64field(docsJson)},
      dl_id:              "${esc(row.dl_id || '')}",
      ssn_id:             "${esc(row.ssn_id || '')}",
      poa_id:             "${esc(row.poa_id || '')}",
      poa2_id:            "${esc(row.poa2_id || '')}",
      poa3_id:            "${esc(row.poa3_id || '')}",
      cover_sheet:        "${esc(row.cover_sheet || '')}",

      next_import_int:               "${esc(row.next_import_int || '')}",
      next_import_label:             "${esc(row.next_import_label || '')}",
      next_import_mode:              "${esc(row.next_import_mode || '')}",
      manual_next_import_start_days: "${esc(row.manual_next_import_start_days || '')}",
      manual_next_import_set_date:   "${esc(row.manual_next_import_set_date || '')}",
      refresh_next_import_start_date:"${esc(row.refresh_next_import_start_date || '')}",
      report_date:                   "${esc(row.report_date || '')}",
      next_reminder:                 "${esc(String(row.nextReminder || ''))}",
      create_pdf:                    "${esc(String(row.createPdf || ''))}",
      has_file:                      ${row.hasFile ? 'true' : 'false'},

      yearly_income:       "${esc(row.yearly_income || '')}",
      housing_payment:     "${esc(row.housing_payment || '')}",
      debt_monthly_payments: "${esc(row.debt_monthly_payments || '')}",

      spouse_client_id:    "${esc(row.spouse_client_id || '')}",
      spouse_client_label: "${esc(row.spouse_client_label || '')}",
      portal_password:     "${esc(row.portal_password || '')}",
      portal_enabled:      ${row.portal_enabled ? 'true' : 'false'},

      addresses_json:      ${b64field(row.addresses)},
      names_json:          ${b64field(row.names)},
      employers_json:      ${b64field(row.employers)},
      secret_question_name:"${esc(row.secret_question_name || '')}",

      monitoring_agency:   "${esc(row.monitoring_agency || '')}",
      monitoring_username: "${esc(row.monitoring_username || '')}",
      monitoring_token:    "${esc(row.monitoring_token || '')}",
      secret_key:          "${esc(row.secret_key || '')}",

      assigned_to:         "${esc(row.assigned_to || '')}",
      ninja_assigned:      "${esc(row.ninja_assigned || '')}",
      affiliate_assigned:  "${esc(row.affiliate_assigned || '')}",
      owner_key:           "${esc(row.owner_key || '')}",
      notes:               ${b64field(row.notes)},
      goal:                ${b64field(row.goal)},

      updated_at:  "${esc(String(updatedAt))}",
      created_at:  "${esc(String(row.created_at || row.createdAt || now))}",
      synced_at:   time::now()
    };
  `);
}

async function upsertReport(row, sourceDb) {
  // Handle JS Date objects (mysql2 returns datetime columns as Date)
  const toStr = (v) => (v instanceof Date) ? v.toISOString() : String(v || '');
  const esc   = (v) => toStr(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '').slice(0, 500);
  // b64f for metadata-sized JSON fields (accounts, deletions, progress) — these are small
  const b64f  = (v, maxBytes = 500_000) => {
    let str = (!v) ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
    if (str.length > maxBytes) str = str.slice(0, maxBytes);
    return `type::string(encoding::base64::decode("${Buffer.from(str, 'utf8').toString('base64')}"))`;
  };

  const reportId = String(row.id || row.report_id || '');
  const clientId = String(row.client_id || row.ClientId || '');
  const recordId = `reports:${reportId}_${sourceDb}`;
  const now      = new Date().toISOString();

  // ── Full report_json — ALWAYS stored on local disk (no inline, no size cap) ─
  // report_html (raw HTML up to 1.5MB) is skipped — not needed for letter generation
  const rawReportJson = row.report_json
    ? (typeof row.report_json === 'object' ? JSON.stringify(row.report_json) : String(row.report_json))
    : '';

  let reportLocalPath = '';
  let reportR2Key     = '';

  if (rawReportJson) {
    const localDir  = `${LOCAL_REPORTS_DIR}/${sourceDb}`;
    const localPath = `${localDir}/${reportId}.json`;

    try {
      // Check if this SAME report record already exists in SurrealDB
      const authHeader = 'Basic ' + Buffer.from(`${SURREAL_USER}:${SURREAL_PASS}`).toString('base64');
      const existingRes = await fetch(`${SURREAL_URL}/sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/surrealql', Accept: 'application/json', 'Surreal-NS': SURREAL_NS, 'Surreal-DB': SURREAL_DB, Authorization: authHeader },
        body: `SELECT report_local_path, report_r2_key, report_date FROM ${recordId};`,
      });
      const existingData = await existingRes.json();
      const existing = existingData?.[0]?.result?.[0];

      if (existing?.report_local_path && existsSync(existing.report_local_path)) {
        // Same report already has a local file — just overwrite to keep content fresh
        reportLocalPath = existing.report_local_path;
        writeFileSync(reportLocalPath, rawReportJson, 'utf8');
      } else if (existing?.report_r2_key) {
        // This report is already archived in R2 (older report that was superseded) — keep it in R2
        // Re-upload to update content, but don't change it to local
        const r2Key = `reports/${sourceDb}/${reportId}.json`;
        try {
          await uploadToR2(R2_BUCKET_REPORTS, r2Key, rawReportJson);
          reportR2Key = `${R2_BUCKET_REPORTS}/${r2Key}`;
        } catch (e2) { reportR2Key = existing.report_r2_key; } // keep existing key on failure
      } else {
        // New report — write to local disk
        // Also check: does another report for this client currently have a local file?
        // If so, archive THAT one to R2 (it's being superseded by this newer report)
        const currentLatestRes = await fetch(`${SURREAL_URL}/sql`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/surrealql', Accept: 'application/json', 'Surreal-NS': SURREAL_NS, 'Surreal-DB': SURREAL_DB, Authorization: authHeader },
          body: `SELECT id, report_id, report_local_path, report_date FROM reports WHERE client_id = "${clientId}" AND source_db = "${sourceDb}" AND report_local_path != NONE AND report_local_path != "";`,
        });
        const latestData = await currentLatestRes.json();
        const currentLatest = latestData?.[0]?.result?.[0];

        if (currentLatest?.report_local_path && existsSync(currentLatest.report_local_path)) {
          const oldDate   = String(currentLatest.report_date || '');
          const newDate   = String(row.report_date || row.createdAt || '');
          const newIsNewer = newDate > oldDate;
          if (newIsNewer) {
            // Archive the current "latest" local file to R2
            const oldR2Key  = `reports/${sourceDb}/${currentLatest.report_id}.json`;
            const oldFullKey = `${R2_BUCKET_REPORTS}/${oldR2Key}`;
            try {
              const oldContent = await import('fs').then(f => f.default.readFileSync(currentLatest.report_local_path, 'utf8'));
              await uploadToR2(R2_BUCKET_REPORTS, oldR2Key, oldContent);
              // Update the old record: clear local path, set R2 key
              await surql(`UPDATE reports:${currentLatest.report_id}_${sourceDb} SET report_local_path = "", report_r2_key = "${oldFullKey}";`);
              // Delete old local file
              unlinkSync(currentLatest.report_local_path);
            } catch (archiveErr) {
              console.warn(`  Archive old report ${currentLatest.report_id} failed:`, archiveErr.message?.slice(0, 60));
            }
          }
        }

        // Write new report to local disk
        writeFileSync(localPath, rawReportJson, 'utf8');
        reportLocalPath = localPath;
      }
    } catch (e) {
      console.warn(`  Local write failed report ${reportId}:`, e.message?.slice(0, 80));
      // Fall back to R2 if local write fails
      try {
        const r2Key = `reports/${sourceDb}/${reportId}.json`;
        await uploadToR2(R2_BUCKET_REPORTS, r2Key, rawReportJson);
        reportR2Key = `${R2_BUCKET_REPORTS}/${r2Key}`;
      } catch (e2) {
        console.warn(`  R2 fallback also failed:`, e2.message?.slice(0, 80));
      }
    }
  }

  await surql(`
    UPSERT ${recordId} CONTENT {
      report_id:          "${esc(reportId)}",
      client_id:          "${esc(clientId)}",
      source_db:          "${sourceDb}",
      source:             "${esc(row.source || row.reportType || '')}",
      report_date:        "${esc(String(row.report_date || row.createdAt || ''))}",
      report_type:        "${esc(row.reportType || row.source || '')}",
      snapshot_checksum:  "${esc(row.snapshot_checksum || '')}",
      accounts_json:      ${b64f(row.accounts)},
      deletions_json:     ${b64f(row.deletetionsLists || row.deletions_json)},
      progress_json:      ${b64f(row.progress || row.progress_json)},
      metadata_json:      ${b64f(row.metadata_json)},
      report_json:        "",
      report_local_path:  "${esc(reportLocalPath)}",
      report_r2_key:      "${esc(reportR2Key)}",
      created_at:         "${esc(String(row.createdAt || row.created_at || now))}",
      synced_at:          time::now()
    };
  `);
}

async function upsertTemplate(row) {
  const esc   = (s) => (s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').slice(0, 2000);
  const trunc = (s) => (s || '').slice(0, 100_000).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const id    = String(row.id);
  const now   = new Date().toISOString();

  await surql(`
    UPSERT templates:${id} CONTENT {
      template_id:    "${id}",
      name:           "${esc(row.name)}",
      file_name:      "${esc(row.file_name)}",
      file_html:      "${trunc(row.file_html)}",
      tu_json:        "${esc(typeof row.tu === 'object' ? JSON.stringify(row.tu) : (row.tu || ''))}",
      ex_json:        "${esc(typeof row.ex === 'object' ? JSON.stringify(row.ex) : (row.ex || ''))}",
      eq_json:        "${esc(typeof row.eq === 'object' ? JSON.stringify(row.eq) : (row.eq || ''))}",
      paragraphs_json:"${esc(typeof row.paraghraphs === 'object' ? JSON.stringify(row.paraghraphs) : (row.paraghraphs || ''))}",
      created_at:     "${esc(String(row.createdAt || now))}",
      updated_at:     "${esc(String(row.updatedAt || now))}",
      synced_at:      time::now()
    };
  `);
}

async function upsertParagraph(row) {
  const esc = (s) => (s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').slice(0, 5000);
  const id  = String(row.id);
  const now = new Date().toISOString();

  await surql(`
    UPSERT paragraphs:${id} CONTENT {
      paragraph_id: "${id}",
      key_name:     "${esc(row.key)}",
      value:        "${esc(row.value)}",
      created_at:   "${esc(String(row.createdAt || now))}",
      updated_at:   "${esc(String(row.updatedAt || now))}",
      synced_at:    time::now()
    };
  `);
}

// ── Sync functions ────────────────────────────────────────────────────────────

async function syncNinjatools(conn, since) {
  let clientCount = 0, reportCount = 0, errCount = 0;

  // No ORDER BY — avoids sort buffer exhaustion on large tables
  const [clients] = await conn.execute(
    `SELECT * FROM client_profiles WHERE updated_at > ? LIMIT 500`,
    [since]
  );
  for (const row of clients) {
    try { await upsertClient(row, 'ninjatools'); clientCount++; }
    catch (e) { errCount++; console.warn('  skip client:', row.client_id, e.message?.slice(0, 80)); }
  }

  const [reports] = await conn.execute(
    `SELECT * FROM report_history WHERE created_at > ? LIMIT 200`,
    [since]
  );
  for (const row of reports) {
    try { await upsertReport(row, 'ninjatools'); reportCount++; }
    catch (e) { errCount++; console.warn('  skip report:', row.id, e.message?.slice(0, 80)); }
  }

  return { clientCount, reportCount, errCount };
}

async function syncApi(conn, since) {
  let clientCount = 0, reportCount = 0, templateCount = 0, paragraphCount = 0, errCount = 0;

  // Set sort buffer per-connection to avoid OOM on old Contabo server
  await conn.execute(`SET SESSION sort_buffer_size = 8388608`);

  const [clients] = await conn.execute(
    `SELECT * FROM Clients WHERE updatedAt > ? LIMIT 500`,
    [since]
  );
  for (const row of clients) {
    try { await upsertClient({ ...row, client_id: String(row.id) }, 'api'); clientCount++; }
    catch (e) { errCount++; console.warn('  skip client:', row.id, e.message?.slice(0, 80)); }
  }

  const [reports] = await conn.execute(
    `SELECT * FROM Reports WHERE updatedAt > ? LIMIT 200`,
    [since]
  );
  for (const row of reports) {
    try { await upsertReport({ ...row, client_id: String(row.ClientId) }, 'api'); reportCount++; }
    catch (e) { errCount++; console.warn('  skip report:', row.id, e.message?.slice(0, 80)); }
  }

  const [templates] = await conn.execute(
    `SELECT * FROM Templates WHERE updatedAt > ? LIMIT 100`,
    [since]
  );
  for (const row of templates) {
    try { await upsertTemplate(row); templateCount++; }
    catch (e) { errCount++; console.warn('  skip template:', row.id, e.message?.slice(0, 80)); }
  }

  const [paragraphs] = await conn.execute(
    `SELECT * FROM Paraghraphs WHERE updatedAt > ? LIMIT 100`,
    [since]
  );
  for (const row of paragraphs) {
    try { await upsertParagraph(row); paragraphCount++; }
    catch (e) { errCount++; console.warn('  skip paragraph:', row.id, e.message?.slice(0, 80)); }
  }

  return { clientCount, reportCount, templateCount, paragraphCount, errCount };
}

async function getSyncState(source, tableName) {
  try {
    const result = await surql(
      `SELECT last_synced_at FROM sync_state WHERE source = "${source}" AND table_name = "${tableName}" LIMIT 1;`
    );
    const rows = result?.[0]?.result;
    if (rows?.length) return rows[0].last_synced_at;
  } catch (_) {}
  return '1970-01-01 00:00:00';
}

async function setSyncState(source, tableName, ts) {
  await surql(`
    UPSERT sync_state:⟨${source}_${tableName}⟩ CONTENT {
      source:         "${source}",
      table_name:     "${tableName}",
      last_synced_at: "${ts}"
    };
  `);
}

// ── Full migration (paginated, no date filter) ────────────────────────────────

async function runFullMigration() {
  const PAGE = 200;
  let nt, apiConn;
  try {
    nt      = await mysql.createConnection(NINJATOOLS_DB);
    apiConn = await mysql.createConnection(API_DB);
    await apiConn.execute(`SET SESSION sort_buffer_size = 8388608`);

    let total = { ntClients: 0, ntReports: 0, apiClients: 0, apiReports: 0, templates: 0, paragraphs: 0, errs: 0 };

    // ninjatools clients (paginated)
    for (let offset = 0; ; offset += PAGE) {
      const [rows] = await nt.execute(`SELECT * FROM client_profiles LIMIT ? OFFSET ?`, [PAGE, offset]);
      if (!rows.length) break;
      for (const row of rows) {
        try { await upsertClient(row, 'ninjatools'); total.ntClients++; }
        catch (e) { total.errs++; console.warn('  skip nt-client:', row.client_id, e.message?.slice(0,60)); }
      }
      process.stdout.write(`\r  ninjatools clients: ${total.ntClients}...`);
    }
    console.log();

    // ninjatools reports (paginated)
    for (let offset = 0; ; offset += PAGE) {
      const [rows] = await nt.execute(`SELECT * FROM report_history LIMIT ? OFFSET ?`, [PAGE, offset]);
      if (!rows.length) break;
      for (const row of rows) {
        try { await upsertReport(row, 'ninjatools'); total.ntReports++; }
        catch (e) { total.errs++; }
      }
    }

    // api clients (paginated — use query() not execute() for integer LIMIT/OFFSET)
    for (let offset = 0; ; offset += PAGE) {
      const [rows] = await apiConn.query(`SELECT * FROM Clients LIMIT ${PAGE} OFFSET ${offset}`);
      if (!rows.length) break;
      for (const row of rows) {
        try { await upsertClient({ ...row, client_id: String(row.id) }, 'api'); total.apiClients++; }
        catch (e) { total.errs++; console.warn('  skip api-client:', row.id, e.message?.slice(0,60)); }
      }
      process.stdout.write(`\r  api clients: ${total.apiClients}...`);
    }
    console.log();

    // api reports (paginated)
    for (let offset = 0; ; offset += PAGE) {
      const [rows] = await apiConn.query(`SELECT * FROM Reports LIMIT ${PAGE} OFFSET ${offset}`);
      if (!rows.length) break;
      for (const row of rows) {
        try { await upsertReport({ ...row, client_id: String(row.ClientId) }, 'api'); total.apiReports++; }
        catch (e) { total.errs++; }
      }
    }

    // templates + paragraphs (small tables, no pagination needed)
    const [templates] = await apiConn.execute(`SELECT * FROM Templates`);
    for (const row of templates) {
      try { await upsertTemplate(row); total.templates++; } catch (e) { total.errs++; }
    }
    const [paragraphs] = await apiConn.execute(`SELECT * FROM Paraghraphs`);
    for (const row of paragraphs) {
      try { await upsertParagraph(row); total.paragraphs++; } catch (e) { total.errs++; }
    }

    // Mark sync state with current time
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await setSyncState('ninjatools', 'client_profiles', now);
    await setSyncState('ninjatools', 'report_history',  now);
    await setSyncState('api', 'Clients',     now);
    await setSyncState('api', 'Reports',     now);
    await setSyncState('api', 'Templates',   now);
    await setSyncState('api', 'Paraghraphs', now);

    console.log(`\n[${new Date().toISOString()}] Full migration complete:`);
    console.log(`  ninjatools → clients:${total.ntClients} reports:${total.ntReports}`);
    console.log(`  api        → clients:${total.apiClients} reports:${total.apiReports} templates:${total.templates} paragraphs:${total.paragraphs}`);
    console.log(`  errors skipped: ${total.errs}`);
  } finally {
    try { await nt?.end();      } catch (_) {}
    try { await apiConn?.end(); } catch (_) {}
  }
}

// ── Incremental sync loop (daemon) ────────────────────────────────────────────

async function runSync() {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  let nt, apiConn;
  try {
    nt      = await mysql.createConnection(NINJATOOLS_DB);
    apiConn = await mysql.createConnection(API_DB);

    // ninjatools uses ISO 8601 varchar dates — compare using that epoch format
    const ninjaSince = await getSyncState('ninjatools', 'client_profiles');
    const ntResult   = await syncNinjatools(nt, ninjaSince);
    await setSyncState('ninjatools', 'client_profiles', now);
    await setSyncState('ninjatools', 'report_history',  now);

    const apiSince  = await getSyncState('api', 'Clients');
    const apiResult = await syncApi(apiConn, apiSince);
    await setSyncState('api', 'Clients',     now);
    await setSyncState('api', 'Reports',     now);
    await setSyncState('api', 'Templates',   now);
    await setSyncState('api', 'Paraghraphs', now);

    const changed = ntResult.clientCount + ntResult.reportCount +
                    apiResult.clientCount + apiResult.reportCount +
                    apiResult.templateCount + apiResult.paragraphCount;
    if (changed > 0) {
      console.log(`[${new Date().toISOString()}] Sync — ${changed} records updated`);
      console.log(`  ninjatools → clients:${ntResult.clientCount} reports:${ntResult.reportCount}`);
      console.log(`  api        → clients:${apiResult.clientCount} reports:${apiResult.reportCount}`);
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Sync error:`, err.message);
  } finally {
    try { await nt?.end();      } catch (_) {}
    try { await apiConn?.end(); } catch (_) {}
  }
}

// ── Schema migration (idempotent — safe to run on every startup) ──────────────

async function ensureSchema() {
  // Idempotent field migrations — DEFINE FIELD OVERWRITE is safe to run on every startup
  const fields = [
    `DEFINE FIELD OVERWRITE report_r2_key      ON reports TYPE option<string>;`,
    `DEFINE FIELD OVERWRITE report_local_path  ON reports TYPE option<string>;`,
    // report_json stays defined but will be stored as empty string going forward
    // (full JSON now lives on local disk or R2)
  ];
  for (const f of fields) {
    try {
      await surql(`USE NS ${SURREAL_NS} DB ${SURREAL_DB}; ${f}`);
    } catch (e) {
      console.warn('[SurrealSync] Schema notice:', e.message?.slice(0, 80));
    }
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

await ensureSchema();

if (DAEMON_MODE) {
  console.log(`[SurrealSync] Daemon started — polling every ${POLL_INTERVAL / 1000}s`);
  await runSync();
  setInterval(runSync, POLL_INTERVAL);
} else {
  console.log('[SurrealSync] Running full paginated migration…');
  await runFullMigration();
  process.exit(0);
}
