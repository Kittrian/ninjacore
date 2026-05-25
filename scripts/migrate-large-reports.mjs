// One-shot: push all ninjatools reports with report_json > 200KB to R2 credit-reports,
// then store the R2 key back in SurrealDB.
// Run from /home/ninja/ninjadispute-backend: node scripts/migrate-large-reports.mjs
import mysql from 'mysql2/promise';
import crypto from 'crypto';

const R2_ACCOUNT_ID = '48aaa54206fe7ece5d8d40bb78eed4fd';
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY || '06b0ca893b34ba104d7966623d0dc7b7';
const R2_SECRET_KEY = process.env.R2_SECRET_KEY || '7deef66dabd6ff921ba373811914b207f4360f8173cf2fd8485ca35cf9a59475';
const R2_ENDPOINT   = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_BUCKET     = 'credit-reports';
const SURREAL_AUTH  = 'Basic ' + Buffer.from('root:Malachi77').toString('base64');

function hmac(k, d) { return crypto.createHmac('sha256', k).update(d).digest(); }
function sha256hex(d) { return crypto.createHash('sha256').update(d).digest('hex'); }

async function r2put(bucket, key, content) {
  const body  = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  const now   = new Date();
  const ds    = now.toISOString().slice(0, 10).replace(/-/g, '');
  const dt    = ds + 'T' + now.toISOString().slice(11, 19).replace(/:/g, '') + 'Z';
  const host  = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const ph    = sha256hex(body);
  const ch    = `content-type:application/json\nhost:${host}\nx-amz-content-sha256:${ph}\nx-amz-date:${dt}\n`;
  const sh    = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const cr    = ['PUT', `/${bucket}/${key}`, '', ch, sh, ph].join('\n');
  const cs    = `${ds}/auto/s3/aws4_request`;
  const s2s   = ['AWS4-HMAC-SHA256', dt, cs, sha256hex(cr)].join('\n');
  const sk    = hmac(hmac(hmac(hmac(`AWS4${R2_SECRET_KEY}`, ds), 'auto'), 's3'), 'aws4_request');
  const sig   = crypto.createHmac('sha256', sk).update(s2s).digest('hex');
  const auth  = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY}/${cs}, SignedHeaders=${sh}, Signature=${sig}`;
  const res = await fetch(`${R2_ENDPOINT}/${bucket}/${key}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Host: host,
      'x-amz-content-sha256': ph,
      'x-amz-date': dt,
      Authorization: auth,
    },
    body,
  });
  // Always drain the body
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`R2 ${res.status}: ${txt.slice(0, 200)}`);
  }
  await res.text(); // drain empty 200 body
}

async function surqlSet(recordId, r2Key) {
  // Build query using template literals — double quotes are required around string values in SurrealQL
  const q = `UPDATE ${recordId} SET report_r2_key = "${r2Key}";`;
  const res = await fetch('http://127.0.0.1:8000/sql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/surrealql',
      Accept: 'application/json',
      'Surreal-NS': 'ninja',
      'Surreal-DB': 'dispute',
      Authorization: SURREAL_AUTH,
    },
    body: q,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SurrealDB HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  // Drain body without storing the full record (can be 200KB+)
  await res.text();
}

// ── Main ──────────────────────────────────────────────────────────────────────

const conn = await mysql.createConnection({
  host: '127.0.0.1', port: 3306, database: 'ninjatools', user: 'ninjacore', password: 'Malachi77',
});

const [rows] = await conn.query(
  'SELECT id, CHAR_LENGTH(report_json) AS sz, report_json FROM report_history WHERE report_json IS NOT NULL AND CHAR_LENGTH(report_json) > 200000 ORDER BY id'
);
console.log(`Found ${rows.length} large reports — uploading to R2 ${R2_BUCKET}...`);

let ok = 0, fail = 0;
for (const row of rows) {
  const key     = `reports/ninjatools/${row.id}.json`;
  const fullKey = `${R2_BUCKET}/${key}`;
  const recId   = `reports:${row.id}_ninjatools`;
  try {
    await r2put(R2_BUCKET, key, row.report_json);
    await surqlSet(recId, fullKey);
    ok++;
    process.stdout.write('.');
    if (ok % 50 === 0) process.stdout.write(` ${ok}\n`);
  } catch (e) {
    fail++;
    console.error(`\nFAIL id=${row.id} sz=${row.sz}: ${(e.message || e).slice(0, 150)}`);
  }
}
console.log(`\n\nDone: ${ok} uploaded to R2, ${fail} failed (total ${rows.length})`);
await conn.end();
