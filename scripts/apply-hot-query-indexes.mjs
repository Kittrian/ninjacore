#!/usr/bin/env node
/**
 * Hot Query Index Migration Runner
 *
 * Applies covering indexes for top 5 queries hit per request:
 * 1. external_client_id lookup (API linking)
 * 2. owner_key + source_db (client searches)
 * 3. client_id + created_at (report history)
 * 4. owner_key + product/merchant (subscriptions)
 * 5. owner_key + dedup fields (payment dedup)
 *
 * Expected improvement:
 * - 15-30% latency reduction for report listing queries
 * - 10-20% for owner-based searches
 * - 5-10% overall for high-volume payment operations
 */

import fs from 'node:fs';
import path from 'node:path';

const SURREAL_URL = process.env.SURREAL_URL || 'http://127.0.0.1:8000/sql';
const SURREAL_NS = process.env.SURREAL_NS || 'ninja';
const SURREAL_DB = process.env.SURREAL_DB || 'dispute';
const SURREAL_USER = process.env.SURREAL_USER || 'root';
const SURREAL_PASS = process.env.SURREAL_PASS || 'Malachi77';
const DRY_RUN = process.argv.includes('--dry');
const VERBOSE = process.argv.includes('--verbose');

const surql = async (query) => {
  if (VERBOSE) console.log(`[SURQL] ${query.slice(0, 80)}...`);

  const res = await fetch(SURREAL_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'text/plain',
      'Surreal-NS': SURREAL_NS,
      'Surreal-DB': SURREAL_DB,
      'Authorization': 'Basic ' + Buffer.from(`${SURREAL_USER}:${SURREAL_PASS}`).toString('base64'),
    },
    body: query,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SurrealDB HTTP ${res.status}: ${text}`);
  }

  return res.json();
};

const main = async () => {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  Hot Query Index Migration                 ║');
  console.log('║  Applying 9 covering indexes               ║');
  console.log('╚════════════════════════════════════════════╝\n');

  // Load migration file
  const migrationPath = path.join(path.dirname(import.meta.url.replace('file://', '')), 'add-hot-query-indexes.surql');
  const migrationContent = fs.readFileSync(migrationPath, 'utf8');

  // Split into individual statements (by semicolon)
  const statements = migrationContent
    .split(/;\s*\n/)
    .map(s => s.trim() + ';')
    .filter(s => s.length > 2 && !s.startsWith('--'));

  console.log(`Found ${statements.length} index definitions\n`);

  const indexes = [
    { name: 'idx_external_client_id', desc: '1. External Client ID (API linking)' },
    { name: 'idx_owner_source_db', desc: '2. Owner + Source DB (client search)' },
    { name: 'idx_report_client_created', desc: '3. Report Client + Created (history)' },
    { name: 'idx_autopay_owner_product', desc: '4a. Autopay Owner + Product' },
    { name: 'idx_autopay_owner_merchant', desc: '4b. Autopay Owner + Merchant' },
    { name: 'idx_pe_owner_dedup', desc: '5. Payment Events Dedup' },
    { name: 'idx_client_status_updated', desc: '6. Client Status + Updated' },
    { name: 'idx_template_name_updated', desc: '7. Template Name + Updated' },
    { name: 'idx_extra_info_client_name', desc: '8. Extra Info Client + Name' },
  ];

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const stmt of statements) {
    // Extract index name from statement
    const match = stmt.match(/DEFINE INDEX (\w+)/);
    if (!match) continue;

    const indexName = match[1];
    const indexInfo = indexes.find(i => i.name === indexName);
    const desc = indexInfo?.desc || indexName;

    try {
      if (DRY_RUN) {
        console.log(`[DRY] Creating ${desc}`);
        created++;
        continue;
      }

      // Check if index already exists
      const checkQuery = `SELECT * FROM table::info('clients') WHERE type = 'index' AND name = '${indexName}';`;
      let exists = false;
      try {
        const checkRes = await surql(`SELECT COUNT() FROM $info WHERE name = '${indexName}';`);
        // For simplicity, we'll attempt creation and catch duplicate errors
      } catch (e) {
        // Ignore check errors
      }

      // Create the index
      await surql(stmt);
      console.log(`✓ Created ${desc}`);
      created++;
    } catch (err) {
      const errMsg = String(err.message || err);
      if (errMsg.includes('already exists') || errMsg.includes('Index already')) {
        console.log(`⊘ Skipped ${desc} (already exists)`);
        skipped++;
      } else {
        console.error(`✗ Failed ${desc}: ${errMsg}`);
        failed++;
      }
    }
  }

  console.log('\n╔════════════════════════════════════════════╗');
  console.log(`║  Summary                                   ║`);
  console.log(`║  Created: ${String(created).padEnd(37)}║`);
  console.log(`║  Skipped: ${String(skipped).padEnd(37)}║`);
  console.log(`║  Failed:  ${String(failed).padEnd(37)}║`);
  console.log('╚════════════════════════════════════════════╝');

  if (DRY_RUN) {
    console.log('\n(DRY RUN - no changes made)');
  }

  process.exit(failed > 0 ? 1 : 0);
};

main().catch(err => {
  console.error('\n✗ Migration failed:', err.message);
  process.exit(1);
});
