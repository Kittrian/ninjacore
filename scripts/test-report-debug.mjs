// Quick debug script to find what's causing api report failures
import mysql from 'mysql2/promise';

const auth = 'Basic ' + Buffer.from('root:Malachi77').toString('base64');

const surql = async (q) => {
  const res = await fetch('http://127.0.0.1:8000/sql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/surrealql',
      'Accept': 'application/json',
      'Surreal-NS': 'ninja',
      'Surreal-DB': 'dispute',
      Authorization: auth
    },
    body: q
  });
  const d = await res.json();
  return Array.isArray(d) ? d.find(r => r.status === 'ERR') : null;
};

const b64f = (v, max = 200000) => {
  let str = (!v) ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
  if (str.length > max) str = str.slice(0, max);
  return 'type::string(encoding::base64::decode("' + Buffer.from(str, 'utf8').toString('base64') + '"))';
};

// Safe esc — handle Date objects properly
const esc = (v) => {
  let s;
  if (v instanceof Date) s = v.toISOString();
  else s = String(v || '');
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '').slice(0, 500);
};

const conn = await mysql.createConnection({
  host: '147.93.190.166', port: 3306,
  database: 'api', user: 'api', password: '21Agustus123!!!'
});
await conn.execute('SET SESSION sort_buffer_size = 8388608');

// Test a batch of reports
const [rows] = await conn.query('SELECT * FROM Reports LIMIT 30 OFFSET 850');

let pass = 0, fail = 0;
for (const row of rows) {
  const rid = String(row.id);
  const cid = String(row.ClientId || '');

  // Check Date object issue
  const createdAtStr = row.createdAt instanceof Date
    ? row.createdAt.toISOString()
    : String(row.createdAt || '');
  const updatedAtStr = row.updatedAt instanceof Date
    ? row.updatedAt.toISOString()
    : String(row.updatedAt || '');

  const q = [
    `UPSERT reports:${rid}_apidebug CONTENT {`,
    `  report_id: "${esc(rid)}",`,
    `  client_id: "${esc(cid)}",`,
    `  source_db: "api",`,
    `  source: "${esc(row.reportType || '')}",`,
    `  report_date: "${esc(createdAtStr)}",`,
    `  report_type: "${esc(row.reportType || '')}",`,
    `  snapshot_checksum: "",`,
    `  accounts_json: ${b64f(row.accounts)},`,
    `  deletions_json: ${b64f(row.deletetionsLists)},`,
    `  progress_json: ${b64f(row.progress)},`,
    `  metadata_json: ${b64f(null)},`,
    `  report_json: ${b64f(null)},`,
    `  created_at: "${esc(createdAtStr)}",`,
    `  synced_at: time::now()`,
    `};`
  ].join('\n');

  const err = await surql(q);
  if (err) {
    fail++;
    console.log(`FAIL id=${row.id} createdAt=${typeof row.createdAt}:`, err.result?.slice(0, 200));
  } else {
    pass++;
    process.stdout.write('.');
  }
}
console.log(`\npass=${pass} fail=${fail}`);
await conn.end();
