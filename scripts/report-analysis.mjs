// Analyze report_history: understand multi-report clients and storage scope
import mysql from 'mysql2/promise';

const nt = await mysql.createConnection({
  host: '127.0.0.1', port: 3306, database: 'ninjatools', user: 'ninjacore', password: 'Malachi77',
});

const [[totReports]] = await nt.query("SELECT COUNT(*) cnt FROM report_history WHERE report_json IS NOT NULL AND report_json != ''");
const [[totClients]] = await nt.query("SELECT COUNT(DISTINCT client_id) cnt FROM report_history WHERE report_json IS NOT NULL AND report_json != ''");
console.log(`Total reports with JSON: ${totReports.cnt}`);
console.log(`Unique clients with reports: ${totClients.cnt}`);

const [multi] = await nt.query(`
  SELECT client_id, COUNT(*) cnt,
         MIN(report_date) oldest, MAX(report_date) newest,
         GROUP_CONCAT(id ORDER BY report_date DESC, id DESC) ids
  FROM report_history
  WHERE report_json IS NOT NULL AND report_json != ''
  GROUP BY client_id
  HAVING cnt > 1
  ORDER BY cnt DESC
  LIMIT 20
`);
console.log(`\nClients with multiple reports: ${multi.length}`);
multi.slice(0, 5).forEach(r =>
  console.log(`  client ${r.client_id}: ${r.cnt} reports | oldest:${r.oldest} newest:${r.newest} | ids:${r.ids}`)
);

// Total unique "latest" reports (one per client)
const [latest] = await nt.query(`
  SELECT r.id, r.client_id, r.report_date, CHAR_LENGTH(r.report_json) sz
  FROM report_history r
  INNER JOIN (
    SELECT client_id, MAX(report_date) maxd
    FROM report_history
    WHERE report_json IS NOT NULL AND report_json != ''
    GROUP BY client_id
  ) lv ON r.client_id = lv.client_id AND r.report_date = lv.maxd
  ORDER BY r.client_id
`);
console.log(`\nLatest reports per client: ${latest.length}`);
const totalLatestSz = latest.reduce((s, r) => s + (r.sz || 0), 0);
console.log(`Total size of latest JSONs: ${(totalLatestSz / 1024 / 1024).toFixed(1)} MB`);
console.log(`  Under 200KB: ${latest.filter(r => r.sz <= 200000).length}`);
console.log(`  Over 200KB:  ${latest.filter(r => r.sz > 200000).length}`);

// Older (non-latest) reports
const [older] = await nt.query(`
  SELECT r.id, CHAR_LENGTH(r.report_json) sz
  FROM report_history r
  WHERE report_json IS NOT NULL AND report_json != ''
  AND (r.client_id, r.report_date) NOT IN (
    SELECT client_id, MAX(report_date)
    FROM report_history
    WHERE report_json IS NOT NULL AND report_json != ''
    GROUP BY client_id
  )
`);
console.log(`\nOlder (non-latest) reports: ${older.length}`);
const totalOlderSz = older.reduce((s, r) => s + (r.sz || 0), 0);
console.log(`Total size of older JSONs: ${(totalOlderSz / 1024 / 1024).toFixed(1)} MB`);

await nt.end();
