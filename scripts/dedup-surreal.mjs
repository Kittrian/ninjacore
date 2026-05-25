// Deduplicates SurrealDB clients table.
// Strategy: for each (name+phone) group with multiple records,
// keep the lowest numeric client_id as canonical, delete the rest.
// Does NOT touch MySQL databases.
// Run from /home/ninja/ninjadispute-backend: node scripts/dedup-surreal.mjs
import { readFileSync } from 'fs';

const SURREAL_AUTH = 'Basic ' + Buffer.from('root:Malachi77').toString('base64');

async function surql(query) {
  const res = await fetch('http://127.0.0.1:8000/sql', {
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
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  const d = await res.json();
  if (d[0]?.status === 'ERR') throw new Error(`SurrealDB ERR: ${d[0].result}`);
  return d[0]?.result;
}

// Read dedup map produced by dedup-analysis.mjs
const map = JSON.parse(readFileSync('/tmp/dedup-map.json', 'utf8'));
console.log(`Dedup map loaded: ${map.length} groups, removing ${map.reduce((s, g) => s + g.dupes.length, 0)} duplicate records`);

let deleted = 0, skipped = 0;

for (const group of map) {
  const { canonical, dupes, name, phone } = group;

  for (const dupeId of dupes) {
    // Each dupe may exist in SurrealDB as both _ninjatools and _api source records
    const sources = ['ninjatools', 'api'];
    for (const src of sources) {
      // Must match the same escaping used in upsertClient: non-alphanumeric/underscore → _
      const safeId = String(dupeId).replace(/[^a-zA-Z0-9_]/g, '_');
      const recordId = `clients:${safeId}_${src}`;
      try {
        await surql(`DELETE ${recordId};`);
        deleted++;
        process.stdout.write('.');
      } catch (e) {
        // Record might not exist for this source — that's fine
        if (!e.message.includes('not found') && !e.message.includes('does not exist')) {
          skipped++;
          console.warn(`\n  warn: ${recordId}: ${e.message.slice(0, 60)}`);
        }
      }
    }
  }
  console.log(`\n  ✓ ${name} (${phone}) — kept canonical:${canonical}, removed ${dupes.length} dupes`);
}

console.log(`\nDone: ${deleted} records deleted, ${skipped} warnings`);

// Verify Carroll is clean
const carrolls = await surql(`
  SELECT id, client_id, first_name, last_name, phone, source_db
  FROM clients
  WHERE last_name = "Carroll" AND first_name = "Lawerance";
`);
console.log('\nLawerance Carroll records remaining:', JSON.stringify(carrolls, null, 2));
