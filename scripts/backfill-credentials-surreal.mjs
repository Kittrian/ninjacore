#!/usr/bin/env node
// One-shot: backfill empty credential fields on Hetzner SurrealDB clients.
// Only fills slots that are currently empty/NONE. Never overwrites existing values.
//
// Sources (preferred order):
//   1. Contabo api.Reports → monitoring_username, monitoring_password (most reliable)
//   2. Contabo TOOLSNINJA.client_profiles → all 5 fields
//
// Join key: external_client_id (string) ↔ api.Reports.id (int) ↔ client_profiles.client_id

import fs from 'node:fs';

const SURREAL_URL = process.env.SURREAL_URL || 'http://127.0.0.1:8000/sql';
const SURREAL_NS = process.env.SURREAL_NS || 'ninja';
const SURREAL_DB = process.env.SURREAL_DB || 'dispute';
const SURREAL_USER = process.env.SURREAL_USER || 'root';
const SURREAL_PASS = process.env.SURREAL_PASS || 'Malachi77';
const API_FILE = process.argv[2] || '/tmp/api_creds.tsv';
const TOOLS_FILE = process.argv[3] || '/tmp/tools_creds.tsv';
const DRY_RUN = process.argv.includes('--dry');

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

// Escape for SurrealQL double-quoted string
const esc = (v) => String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const trimOrEmpty = (v) => String(v ?? '').trim();

// Load api.Reports map: api_id → { user, pw }
const apiRaw = fs.readFileSync(API_FILE, 'utf8').split('\n').filter(Boolean);
const apiMap = new Map();
for (const line of apiRaw) {
  const [id, u, p] = line.split('\t');
  apiMap.set(String(id).trim(), { user: trimOrEmpty(u), pw: trimOrEmpty(p) });
}

// Load TOOLSNINJA map: client_id → { user, pw, secret, token, agency }
const toolsRaw = fs.readFileSync(TOOLS_FILE, 'utf8').split('\n').filter(Boolean);
const toolsMap = new Map();
for (const line of toolsRaw) {
  const [id, u, p, s, t, a] = line.split('\t');
  toolsMap.set(String(id).trim(), {
    user: trimOrEmpty(u),
    pw: trimOrEmpty(p),
    secret: trimOrEmpty(s),
    token: trimOrEmpty(t),
    agency: trimOrEmpty(a),
  });
}

console.log(`Loaded api.Reports: ${apiMap.size} | TOOLSNINJA: ${toolsMap.size}`);

const main = async () => {
  // Pull all SurrealDB clients with their current credential state + external_client_id
  const res = await sql(`SELECT id, external_client_id, client_id, monitoring_username, monitoring_password, secret_key, monitoring_token, monitoring_agency FROM clients;`);
  const clients = res?.[0]?.result || [];
  console.log(`Fetched ${clients.length} SurrealDB clients`);

  const empty = (v) => !v || String(v).trim() === '' || v === 'NONE';

  const updates = [];
  const stats = { user: 0, pw: 0, secret: 0, token: 0, agency: 0 };

  for (const c of clients) {
    const apiId = trimOrEmpty(c.external_client_id);
    const toolsId = trimOrEmpty(c.client_id);
    const apiRow = apiId ? apiMap.get(apiId) : null;
    const toolsRow = toolsId ? toolsMap.get(toolsId) : null;
    if (!apiRow && !toolsRow) continue;

    const patch = {};
    // user: prefer api.Reports, fallback TOOLSNINJA
    if (empty(c.monitoring_username)) {
      const v = (apiRow && apiRow.user) || (toolsRow && toolsRow.user) || '';
      if (v) { patch.monitoring_username = v; stats.user++; }
    }
    if (empty(c.monitoring_password)) {
      const v = (apiRow && apiRow.pw) || (toolsRow && toolsRow.pw) || '';
      if (v) { patch.monitoring_password = v; stats.pw++; }
    }
    if (empty(c.secret_key) && toolsRow && toolsRow.secret) {
      patch.secret_key = toolsRow.secret; stats.secret++;
    }
    if (empty(c.monitoring_token) && toolsRow && toolsRow.token) {
      patch.monitoring_token = toolsRow.token; stats.token++;
    }
    if (empty(c.monitoring_agency) && toolsRow && toolsRow.agency) {
      patch.monitoring_agency = toolsRow.agency; stats.agency++;
    }
    if (Object.keys(patch).length) updates.push({ id: c.id, patch });
  }

  console.log(`Plan: ${updates.length} clients to update`);
  console.log(`  +monitoring_username: ${stats.user}`);
  console.log(`  +monitoring_password: ${stats.pw}`);
  console.log(`  +secret_key:          ${stats.secret}`);
  console.log(`  +monitoring_token:    ${stats.token}`);
  console.log(`  +monitoring_agency:   ${stats.agency}`);

  if (DRY_RUN) {
    console.log('--dry: not writing. Samples:', updates.slice(0, 3));
    return;
  }

  const BATCH = 40;
  let done = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const slice = updates.slice(i, i + BATCH);
    const stmts = slice.map(({ id, patch }) => {
      const sets = Object.entries(patch)
        .map(([k, v]) => `${k} = "${esc(v)}"`)
        .join(', ');
      return `UPDATE ${id} SET ${sets};`;
    }).join('\n');
    await sql(stmts);
    done += slice.length;
    if (done % 200 === 0 || done === updates.length) {
      console.log(`  updated ${done}/${updates.length}`);
    }
  }
  console.log('Done.');
};

main().catch((err) => { console.error(err); process.exit(1); });
