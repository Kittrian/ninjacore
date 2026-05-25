// migrate-api-reports-final.mjs
// Final approach: store small fields in SurrealDB, large JSON fields on disk
// Large fields (accounts, compare, progress, alternateLetters, deletionslists)
// written to /var/lib/ninjadispute/reports/api/{clientId}.json

import mysql from 'mysql2/promise';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const SURREAL_BASE = 'http://127.0.0.1:8000';
const SURREAL_AUTH = 'Basic ' + Buffer.from('root:Malachi77').toString('base64');
const NS = 'ninja', DB = 'dispute';
const REPORT_DIR = '/var/lib/ninjadispute/reports/api';

function parseJson(v, fallback) {
  if (v == null) return fallback;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return fallback; }
}

function fmtDt(v) {
  if (!v) return null;
  try { return new Date(v).toISOString(); } catch { return null; }
}

async function putSmallRecord(clientId, data) {
  const res = await fetch(`${SURREAL_BASE}/key/api_reports/${clientId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json', Accept: 'application/json',
      'Surreal-NS': NS, 'Surreal-DB': DB, Authorization: SURREAL_AUTH,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  return await res.json();
}

async function main() {
  console.log('=== Final api_reports migration: small→SurrealDB, large→disk ===');
  mkdirSync(REPORT_DIR, { recursive: true });

  const db = await mysql.createConnection({
    host: '127.0.0.1', user: 'api', password: '21Agustus123!!!', database: 'api'
  });

  const [rows] = await db.query('SELECT * FROM Reports');
  console.log(`Found ${rows.length} reports to migrate`);

  let ok = 0, skip = 0, diskWrites = 0;
  for (const row of rows) {
    try {
      const clientId = row.ClientId;

      // Small fields → SurrealDB (always fits in 16KB)
      await putSmallRecord(clientId, {
        client_id: clientId,
        username: row.username || '',
        password: row.password || '',
        report_type: row.reportType || 'identity',
        new_version: !!row.newVersion,
        has_local_data: true,  // signal that disk file exists
        created_at: fmtDt(row.createdAt) || new Date().toISOString(),
        updated_at: fmtDt(row.updatedAt) || new Date().toISOString(),
      });

      // Large fields → disk
      const large = {
        deletions_lists: parseJson(row.deletetionsLists, []),
        compare: parseJson(row.compare, []),
        progress: parseJson(row.progress, []),
        accounts: parseJson(row.accounts, []),
        alternate_letters: parseJson(row.alternateLetters, []),
      };
      writeFileSync(join(REPORT_DIR, `${clientId}.json`), JSON.stringify(large));
      diskWrites++;

      ok++;
    } catch (e) {
      console.warn(`  WARN report client=${row.ClientId}: ${e.message.slice(0, 120)}`);
      skip++;
    }
  }

  await db.end();
  console.log(`\n✓ ${ok} reports: SurrealDB + disk, ${skip} skipped`);
  console.log(`✓ ${diskWrites} JSON files written to ${REPORT_DIR}/`);

  // Count SurrealDB records
  const r = await fetch(`${SURREAL_BASE}/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/surrealql', Authorization: SURREAL_AUTH, 'Surreal-NS': NS, 'Surreal-DB': DB },
    body: 'SELECT count() FROM api_reports GROUP ALL;'
  });
  const d = await r.json();
  console.log(`api_reports in SurrealDB: ${d[0]?.result?.[0]?.count ?? '?'}`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
