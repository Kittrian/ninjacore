// Analyze and deduplicate client records in SurrealDB.
// Does NOT touch MySQL databases.
// Run from /home/ninja/ninjadispute-backend: node scripts/dedup-analysis.mjs
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '127.0.0.1', port: 3306, database: 'ninjatools', user: 'ninjacore', password: 'Malachi77',
});

// 1. Overview
const [[total]]   = await conn.query('SELECT COUNT(*) cnt FROM client_profiles');
const [[hiRange]] = await conn.query("SELECT COUNT(*) cnt FROM client_profiles WHERE client_id REGEXP '^[0-9]+$' AND CAST(client_id AS UNSIGNED) >= 63000");
const [[clientFmt]]= await conn.query("SELECT COUNT(*) cnt FROM client_profiles WHERE client_id LIKE 'client-%'");
console.log(`Total ninjatools clients: ${total.cnt}`);
console.log(`  client_id >= 63000 (bulk range): ${hiRange.cnt}`);
console.log(`  client-xxxx format: ${clientFmt.cnt}`);

// 2. Duplicate groups — same first_name + last_name + phone where phone not empty
const [groups] = await conn.query(`
  SELECT first_name, last_name, phone,
         COUNT(*) cnt,
         GROUP_CONCAT(client_id ORDER BY
           CASE WHEN client_id REGEXP '^[0-9]+$' THEN CAST(client_id AS UNSIGNED) ELSE 999999999 END
         ) ids
  FROM client_profiles
  WHERE phone != '' AND phone IS NOT NULL
  GROUP BY LOWER(first_name), LOWER(last_name), phone
  HAVING cnt > 1
  ORDER BY cnt DESC
  LIMIT 50
`);
console.log(`\nDuplicate groups (name+phone): ${groups.length}`);
groups.slice(0, 10).forEach(g => {
  const ids = g.ids.split(',');
  console.log(`  ${g.first_name} ${g.last_name} (${g.phone}) → ${g.cnt} records. Canonical: ${ids[0]}, Dupes: ${ids.slice(1).join(',')}`);
});

// 3. Count total duplicate records to remove
const totalDupes = groups.reduce((sum, g) => sum + g.cnt - 1, 0);
console.log(`\nTotal duplicate records to remove from SurrealDB: ${totalDupes}`);
console.log(`Canonical records to keep: ${groups.length}`);

// 4. Write the canonical→dupes map to a JSON file for the dedup script
import { writeFileSync } from 'fs';
const map = groups.map(g => {
  const ids = g.ids.split(',');
  return { canonical: ids[0], dupes: ids.slice(1), name: `${g.first_name} ${g.last_name}`, phone: g.phone };
});
writeFileSync('/tmp/dedup-map.json', JSON.stringify(map, null, 2));
console.log('\nDedup map written to /tmp/dedup-map.json');

await conn.end();
