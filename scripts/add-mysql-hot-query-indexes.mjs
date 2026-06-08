#!/usr/bin/env node
/**
 * MySQL Hot Query Index Migration
 *
 * Adds covering indexes to TOOLSNINJA database for top queries:
 * 1. Client profile lookups by owner_key
 * 2. Report history with date sorting
 * 3. Payment merchant/product lookups
 * 4. Payment autopay with product/merchant joins
 * 5. Failed payment event dedup by owner
 *
 * Expected improvement:
 * - 20-35% reduction for owner_key filtered queries
 * - 10-15% for report history queries
 * - 5-10% for payment event aggregations
 */

import mysql from 'mysql2/promise';

const TOOLSNINJA_DB_HOST = process.env.TOOLSNINJA_DB_HOST || process.env.MYSQL_HOST || '127.0.0.1';
const TOOLSNINJA_DB_PORT = Number.parseInt(process.env.TOOLSNINJA_DB_PORT || process.env.MYSQL_PORT || '3306', 10) || 3306;
const TOOLSNINJA_DB_USER = process.env.TOOLSNINJA_DB_USER || process.env.MYSQL_USER || 'ninjacore';
const TOOLSNINJA_DB_PASSWORD = process.env.TOOLSNINJA_DB_PASSWORD || process.env.MYSQL_PASSWORD || '';
const TOOLSNINJA_DB_NAME = process.env.TOOLSNINJA_DB_NAME || process.env.MYSQL_DATABASE || 'TOOLSNINJA';
const DRY_RUN = process.argv.includes('--dry');
const VERBOSE = process.argv.includes('--verbose');

const indexes = [
  {
    name: 'idx_client_profiles_owner_status',
    table: 'client_profiles',
    columns: '(owner_key, status)',
    desc: '1. Client profiles by owner + status',
  },
  {
    name: 'idx_client_profiles_owner_ninja',
    table: 'client_profiles',
    columns: '(owner_key, ninja_assigned)',
    desc: '2. Client profiles by owner + ninja assignment',
  },
  {
    name: 'idx_report_history_client_created',
    table: 'report_history',
    columns: '(client_id, created_at DESC)',
    desc: '3. Report history by client + creation date',
  },
  {
    name: 'idx_report_history_checksum_created',
    table: 'report_history',
    columns: '(snapshot_checksum, created_at DESC)',
    desc: '4. Report history by checksum + date',
  },
  {
    name: 'idx_payment_merchants_owner_default',
    table: 'payment_merchants',
    columns: '(owner_key, is_default DESC)',
    desc: '5. Payment merchants by owner + default status',
  },
  {
    name: 'idx_payment_products_owner_status',
    table: 'payment_products',
    columns: '(owner_key, status)',
    desc: '6. Payment products by owner + status',
  },
  {
    name: 'idx_payment_autopay_owner_status',
    table: 'payment_autopay',
    columns: '(owner_key, status)',
    desc: '7. Autopay by owner + status',
  },
  {
    name: 'idx_payment_autopay_owner_product_status',
    table: 'payment_autopay',
    columns: '(owner_key, product_id, status)',
    desc: '8. Autopay by owner + product + status (covering)',
  },
  {
    name: 'idx_payment_autopay_owner_merchant_status',
    table: 'payment_autopay',
    columns: '(owner_key, merchant_id, status)',
    desc: '9. Autopay by owner + merchant + status (covering)',
  },
  {
    name: 'idx_failed_payment_events_owner_customer',
    table: 'failed_payment_events',
    columns: '(owner_key, customer_id)',
    desc: '10. Failed payment events by owner + customer (dedup)',
  },
  {
    name: 'idx_failed_payment_events_owner_email',
    table: 'failed_payment_events',
    columns: '(owner_key, email)',
    desc: '11. Failed payment events by owner + email (dedup)',
  },
  {
    name: 'idx_failed_payment_events_owner_status',
    table: 'failed_payment_events',
    columns: '(owner_key, status)',
    desc: '12. Failed payment events by owner + status',
  },
];

const main = async () => {
  console.log('╔═════════════════════════════════════════════╗');
  console.log('║  MySQL Hot Query Index Migration            ║');
  console.log('║  Applying 12 covering indexes               ║');
  console.log('╚═════════════════════════════════════════════╝\n');

  if (!TOOLSNINJA_DB_PASSWORD) {
    console.error('✗ Missing TOOLSNINJA_DB_PASSWORD environment variable');
    process.exit(1);
  }

  let conn;
  try {
    conn = await mysql.createConnection({
      host: TOOLSNINJA_DB_HOST,
      port: TOOLSNINJA_DB_PORT,
      user: TOOLSNINJA_DB_USER,
      password: TOOLSNINJA_DB_PASSWORD,
      database: TOOLSNINJA_DB_NAME,
    });

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const idx of indexes) {
      try {
        if (DRY_RUN) {
          console.log(`[DRY] Creating ${idx.desc}`);
          created++;
          continue;
        }

        const sql = `CREATE INDEX \`${idx.name}\` ON \`${idx.table}\` ${idx.columns}`;
        if (VERBOSE) console.log(`[SQL] ${sql}`);

        await conn.query(sql);
        console.log(`✓ ${idx.desc}`);
        created++;
      } catch (err) {
        const msg = err.message || String(err);
        if (msg.includes('Duplicate key name') || msg.includes('already exists')) {
          console.log(`⊘ ${idx.desc} (already exists)`);
          skipped++;
        } else {
          console.error(`✗ ${idx.desc}: ${msg}`);
          failed++;
        }
      }
    }

    console.log('\n╔═════════════════════════════════════════════╗');
    console.log(`║  Summary                                    ║`);
    console.log(`║  Created: ${String(created).padEnd(39)}║`);
    console.log(`║  Skipped: ${String(skipped).padEnd(39)}║`);
    console.log(`║  Failed:  ${String(failed).padEnd(39)}║`);
    console.log('╚═════════════════════════════════════════════╝');

    if (DRY_RUN) {
      console.log('\n(DRY RUN - no changes made)');
    }

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('\n✗ Connection failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
};

main();
