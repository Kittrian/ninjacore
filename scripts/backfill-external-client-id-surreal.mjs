#!/usr/bin/env node
// One-shot: backfill external_client_id on Hetzner SurrealDB clients table.
// Source of truth: old Contabo MySQL api.Clients (id ↔ ssn).
// Match by normalized SSN (digits only). Skips clients already linked.

import fs from 'node:fs';
import path from 'node:path';

const SURREAL_URL = process.env.SURREAL_URL || 'http://127.0.0.1:8000/sql';
const SURREAL_NS = process.env.SURREAL_NS || 'ninja';
const SURREAL_DB = process.env.SURREAL_DB || 'dispute';
const SURREAL_USER = process.env.SURREAL_USER || 'root';
const SURREAL_PASS = process.env.SURREAL_PASS || 'Malachi77';
const SSN_MAP_FILE = process.argv[2] || '/tmp/ssn_to_apiid.tsv';
const DRY_RUN = process.argv.includes('--dry');

const digits = (s) => String(s || '').replace(/\D/g, '');

const sql = async (query) => {
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
  if (!res.ok) throw new Error(`SurrealDB HTTP ${res.status}: ${await res.text()}`);
  return res.json();
};

const main = async () => {
  // Load ssn→apiId map from TSV (digits-only ssn already)
  const raw = fs.readFileSync(SSN_MAP_FILE, 'utf8').split('\n').filter(Boolean);
  const ssnToApi = new Map();
  const dupes = new Set();
  for (const line of raw) {
    const [ssn, id] = line.split('\t');
    const key = digits(ssn);
    if (!key || key === '000000000' || key.length < 9) continue;
    if (ssnToApi.has(key)) { dupes.add(key); continue; }
    ssnToApi.set(key, String(id).trim());
  }
  for (const d of dupes) ssnToApi.delete(d);
  console.log(`Loaded ${ssnToApi.size} unique SSN→api_id mappings (skipped ${dupes.size} dupes)`);

  // Pull SurrealDB clients
  const result = await sql('SELECT id, ssn, external_client_id FROM clients;');
  const clients = result?.[0]?.result || [];
  console.log(`Fetched ${clients.length} SurrealDB clients`);

  const candidates = [];
  let alreadyLinked = 0;
  let noSsn = 0;
  let noMatch = 0;
  for (const c of clients) {
    if (c.external_client_id && String(c.external_client_id).trim() !== '') { alreadyLinked++; continue; }
    const key = digits(c.ssn);
    if (!key || key.length < 9) { noSsn++; continue; }
    const apiId = ssnToApi.get(key);
    if (!apiId) { noMatch++; continue; }
    candidates.push({ id: c.id, apiId });
  }
  console.log(`Plan: link ${candidates.length} | already linked ${alreadyLinked} | no/short ssn ${noSsn} | no api match ${noMatch}`);

  if (DRY_RUN) {
    console.log('--dry: not writing. Sample:', candidates.slice(0, 5));
    return;
  }

  // Batch updates — 50 per query for speed
  const BATCH = 50;
  let done = 0;
  for (let i = 0; i < candidates.length; i += BATCH) {
    const slice = candidates.slice(i, i + BATCH);
    const stmts = slice.map(c => `UPDATE ${c.id} SET external_client_id = "${c.apiId}";`).join('\n');
    await sql(stmts);
    done += slice.length;
    if (done % 200 === 0 || done === candidates.length) {
      console.log(`  updated ${done}/${candidates.length}`);
    }
  }
  console.log('Done.');
};

main().catch((err) => { console.error(err); process.exit(1); });
