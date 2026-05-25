// Migrate report JSONs to local disk storage.
// Architecture:
//   Latest report per client → /var/lib/ninjadispute/reports/ninjatools/{report_id}.json
//   Older reports per client → R2 credit-reports/reports/ninjatools/{report_id}.json
//   SurrealDB stores:
//     report_local_path  — absolute path on this server (latest only)
//     report_r2_key      — R2 object key (archived/older reports)
//     report_json        — CLEARED to empty string (no more inline storage)
// Run from /home/ninja/ninjadispute-backend: node scripts/migrate-reports-local.mjs
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import { mkdirSync, writeFileSync, existsSync } from 'fs';

const LOCAL_DIR    = '/var/lib/ninjadispute/reports/ninjatools';
const R2_ACCOUNT_ID= '48aaa54206fe7ece5d8d40bb78eed4fd';
const R2_ACCESS_KEY= process.env.R2_ACCESS_KEY || '06b0ca893b34ba104d7966623d0dc7b7';
const R2_SECRET_KEY= process.env.R2_SECRET_KEY || '7deef66dabd6ff921ba373811914b207f4360f8173cf2fd8485ca35cf9a59475';
const R2_ENDPOINT  = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_BUCKET    = 'credit-reports';
const SURREAL_AUTH = 'Basic ' + Buffer.from('root:Malachi77').toString('base64');

// Ensure local directory exists
mkdirSync(LOCAL_DIR, { recursive: true });
console.log(`Local storage: ${LOCAL_DIR}`);

// ── R2 helpers ────────────────────────────────────────────────────────────────
function hmac(k, d) { return crypto.createHmac('sha256', k).update(d).digest(); }
function sha256hex(d) { return crypto.createHash('sha256').update(d).digest('hex'); }

async function r2put(key, content) {
  const body  = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  const now   = new Date();
  const ds    = now.toISOString().slice(0, 10).replace(/-/g, '');
  const dt    = ds + 'T' + now.toISOString().slice(11, 19).replace(/:/g, '') + 'Z';
  const host  = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const ph    = sha256hex(body);
  const ch    = `content-type:application/json\nhost:${host}\nx-amz-content-sha256:${ph}\nx-amz-date:${dt}\n`;
  const sh    = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const cr    = ['PUT', `/${R2_BUCKET}/${key}`, '', ch, sh, ph].join('\n');
  const cs    = `${ds}/auto/s3/aws4_request`;
  const s2s   = ['AWS4-HMAC-SHA256', dt, cs, sha256hex(cr)].join('\n');
  const sk    = hmac(hmac(hmac(hmac(`AWS4${R2_SECRET_KEY}`, ds), 'auto'), 's3'), 'aws4_request');
  const sig   = crypto.createHmac('sha256', sk).update(s2s).digest('hex');
  const authH = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY}/${cs}, SignedHeaders=${sh}, Signature=${sig}`;
  const res   = await fetch(`${R2_ENDPOINT}/${R2_BUCKET}/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Host: host, 'x-amz-content-sha256': ph, 'x-amz-date': dt, Authorization: authH },
    body,
  });
  await res.text(); // drain
  if (!res.ok) throw new Error(`R2 ${res.status}`);
}

// ── SurrealDB helpers ─────────────────────────────────────────────────────────
async function surqlUpdate(recordId, fields) {
  const setClause = Object.entries(fields)
    .map(([k, v]) => `${k} = "${v.replace(/"/g, '\\"')}"`)
    .join(', ');
  const q = `UPDATE ${recordId} SET ${setClause};`;
  const res = await fetch('http://127.0.0.1:8000/sql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/surrealql', Accept: 'application/json', 'Surreal-NS': 'ninja', 'Surreal-DB': 'dispute', Authorization: SURREAL_AUTH },
    body: q,
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`SurrealDB ${res.status}: ${t.slice(0, 150)}`); }
  await res.text(); // drain without parsing large response
}

// ── Main ──────────────────────────────────────────────────────────────────────
const conn = await mysql.createConnection({
  host: '127.0.0.1', port: 3306, database: 'ninjatools', user: 'ninjacore', password: 'Malachi77',
});

// For each client, get ALL reports ordered by report_date DESC (newest first)
// report_date DESC, id DESC — if same date, higher id = newer
const [allReports] = await conn.query(`
  SELECT id, client_id, report_date, CHAR_LENGTH(report_json) sz, report_json
  FROM report_history
  WHERE report_json IS NOT NULL AND report_json != ''
  ORDER BY client_id ASC, report_date DESC, id DESC
`);
console.log(`Total reports with JSON: ${allReports.length}`);

// Group by client_id to identify latest vs older
const byClient = new Map();
for (const r of allReports) {
  const cid = String(r.client_id);
  if (!byClient.has(cid)) byClient.set(cid, []);
  byClient.get(cid).push(r);
}

let localOk = 0, r2Ok = 0, localFail = 0, r2Fail = 0, total = 0;
const totalClients = byClient.size;
let ci = 0;

for (const [clientId, reports] of byClient) {
  ci++;
  // reports[0] is the latest (ORDER BY report_date DESC, id DESC)
  const [latest, ...older] = reports;

  // Write latest to local disk
  const localPath = `${LOCAL_DIR}/${latest.id}.json`;
  try {
    writeFileSync(localPath, latest.report_json, 'utf8');
    await surqlUpdate(`reports:${latest.id}_ninjatools`, {
      report_local_path: localPath,
      report_r2_key: '',
    });
    localOk++;
  } catch (e) {
    localFail++;
    console.error(`\nFAIL local id=${latest.id}: ${e.message?.slice(0, 100)}`);
  }

  // Archive older reports to R2
  for (const old of older) {
    const r2Key = `reports/ninjatools/${old.id}.json`;
    const fullKey = `${R2_BUCKET}/${r2Key}`;
    try {
      await r2put(r2Key, old.report_json);
      await surqlUpdate(`reports:${old.id}_ninjatools`, {
        report_local_path: '',
        report_r2_key: fullKey,
      });
      r2Ok++;
    } catch (e) {
      r2Fail++;
      console.error(`\nFAIL r2 id=${old.id}: ${e.message?.slice(0, 100)}`);
    }
  }

  total++;
  if (total % 50 === 0 || total === totalClients) {
    process.stdout.write(`\r  clients: ${total}/${totalClients} | local:${localOk} r2:${r2Ok} fails:${localFail + r2Fail}  `);
  }
}

console.log(`\n\nDone:`);
console.log(`  Latest reports → local disk: ${localOk} (${localFail} failed)`);
console.log(`  Older reports  → R2:         ${r2Ok} (${r2Fail} failed)`);
console.log(`  Local dir: ${LOCAL_DIR}`);
await conn.end();
