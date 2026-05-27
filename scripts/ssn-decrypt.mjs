#!/usr/bin/env node
// Decrypt a client SSN from SurrealDB after plaintext has been nulled out.
//
// Keys are read from /home/api/app/.env (or env vars if set).
//
// Usage:
//   ssh root@5.78.214.176
//   node /root/ssn-decrypt.mjs 1027              # by client_id
//   node /root/ssn-decrypt.mjs --all             # dump all linked clients
//   node /root/ssn-decrypt.mjs --hash 585-99-4889 # find which client has this SSN

import fs from 'node:fs';
import { createDecipheriv, createHmac } from 'node:crypto';

const SURREAL_URL = process.env.SURREAL_URL || 'http://127.0.0.1:8000/sql';
const SURREAL_NS = process.env.SURREAL_NS || 'ninja';
const SURREAL_DB = process.env.SURREAL_DB || 'dispute';
const SURREAL_USER = process.env.SURREAL_USER || 'root';
const SURREAL_PASS = process.env.SURREAL_PASS || 'Malachi77';

// Load keys from env or /home/api/app/.env
let KEY_B64 = process.env.SSN_ENCRYPTION_KEY;
let HMAC_KEY_B64 = process.env.SSN_HMAC_KEY;
if (!KEY_B64 || !HMAC_KEY_B64) {
  const envPaths = ['/home/api/app/.env', './.env'];
  for (const p of envPaths) {
    try {
      const txt = fs.readFileSync(p, 'utf8');
      const e = txt.match(/SSN_ENCRYPTION_KEY=(.+)/);
      const h = txt.match(/SSN_HMAC_KEY=(.+)/);
      if (e) KEY_B64 = KEY_B64 || e[1].trim();
      if (h) HMAC_KEY_B64 = HMAC_KEY_B64 || h[1].trim();
      if (KEY_B64 && HMAC_KEY_B64) break;
    } catch { /* try next */ }
  }
}
if (!KEY_B64 || !HMAC_KEY_B64) {
  console.error('SSN_ENCRYPTION_KEY / SSN_HMAC_KEY not found. Set env vars or run from host with /home/api/app/.env.');
  process.exit(1);
}
const KEY = Buffer.from(KEY_B64, 'base64');
const HMAC_KEY = Buffer.from(HMAC_KEY_B64, 'base64');

const decryptSsn = (ct) => {
  if (!ct) return '';
  const s = String(ct);
  if (!s.startsWith('v1:')) return s; // legacy plaintext
  const [, ivB64, ctB64, tagB64] = s.split(':');
  const decipher = createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64url')), decipher.final()]).toString('utf8');
};

const hashSsn = (plain) => {
  const n = String(plain || '').replace(/\D/g, '');
  return createHmac('sha256', HMAC_KEY).update(n).digest('base64url');
};

const sql = async (query) => {
  const res = await fetch(SURREAL_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'text/plain',
      'Surreal-NS': SURREAL_NS,
      'Surreal-DB': SURREAL_DB,
      Authorization: 'Basic ' + Buffer.from(`${SURREAL_USER}:${SURREAL_PASS}`).toString('base64'),
    },
    body: query,
  });
  if (!res.ok) throw new Error(`SurrealDB ${res.status}: ${await res.text()}`);
  return res.json();
};

const args = process.argv.slice(2);
if (args[0] === '--hash' && args[1]) {
  const target = hashSsn(args[1]);
  const result = await sql(`SELECT id, client_id, first_name, last_name, ssn_ct FROM clients WHERE ssn_hash = "${target}";`);
  const rows = result?.[0]?.result || [];
  if (!rows.length) { console.log('No client found with that SSN.'); process.exit(0); }
  for (const r of rows) {
    console.log(`${r.id}\t${r.client_id}\t${r.first_name} ${r.last_name}\tssn=${decryptSsn(r.ssn_ct)}`);
  }
} else if (args[0] === '--all') {
  const result = await sql(`SELECT id, client_id, first_name, last_name, ssn_ct FROM clients WHERE ssn_ct != NONE;`);
  const rows = result?.[0]?.result || [];
  for (const r of rows) {
    console.log(`${r.client_id}\t${r.first_name} ${r.last_name}\t${decryptSsn(r.ssn_ct)}`);
  }
  console.log(`(${rows.length} clients)`);
} else if (args[0]) {
  const clientId = args[0];
  const result = await sql(`SELECT id, client_id, first_name, last_name, ssn, ssn_ct FROM clients WHERE client_id = "${clientId}" LIMIT 1;`);
  const r = result?.[0]?.result?.[0];
  if (!r) { console.log(`No client with client_id=${clientId}`); process.exit(0); }
  const decrypted = decryptSsn(r.ssn_ct);
  console.log(`id: ${r.id}`);
  console.log(`name: ${r.first_name} ${r.last_name}`);
  console.log(`ssn (decrypted): ${decrypted}`);
  if (r.ssn) console.log(`ssn (legacy plaintext still present): ${r.ssn}`);
} else {
  console.log('Usage:');
  console.log('  ssn-decrypt.mjs <client_id>           # decrypt one client');
  console.log('  ssn-decrypt.mjs --all                 # dump every encrypted client');
  console.log('  ssn-decrypt.mjs --hash <ssn>          # find client by SSN');
}
