#!/usr/bin/env node
// One-shot: encrypt every clients.ssn into ssn_ct + ssn_hash.
// Dual-write phase: leaves the plaintext `ssn` column intact so reads keep
// working until the read-path is patched and verified.
//
// Idempotent: clients that already have a v1: ssn_ct are skipped.
//
// Usage:
//   SSN_ENCRYPTION_KEY=... SSN_HMAC_KEY=... node backfill-encrypt-ssn.mjs [--dry]

import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'node:crypto';

const SURREAL_URL = process.env.SURREAL_URL || 'http://127.0.0.1:8000/sql';
const SURREAL_NS = process.env.SURREAL_NS || 'ninja';
const SURREAL_DB = process.env.SURREAL_DB || 'dispute';
const SURREAL_USER = process.env.SURREAL_USER || 'root';
const SURREAL_PASS = process.env.SURREAL_PASS || 'Malachi77';
const DRY_RUN = process.argv.includes('--dry');

const KEY = Buffer.from(process.env.SSN_ENCRYPTION_KEY || '', 'base64');
const HMAC_KEY = Buffer.from(process.env.SSN_HMAC_KEY || '', 'base64');
if (KEY.length !== 32 || HMAC_KEY.length !== 32) {
  console.error('SSN_ENCRYPTION_KEY and SSN_HMAC_KEY env vars must each decode to 32 bytes');
  process.exit(1);
}

const encryptSsn = (plain) => {
  if (!plain) return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64url')}:${ct.toString('base64url')}:${tag.toString('base64url')}`;
};

const decryptSsn = (ct) => {
  if (!ct || !String(ct).startsWith('v1:')) return null;
  const [, ivB64, ctB64, tagB64] = String(ct).split(':');
  const decipher = createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64url')), decipher.final()]).toString('utf8');
};

const hashSsn = (plain) => {
  const n = String(plain || '').replace(/\D/g, '');
  if (!n) return '';
  return createHmac('sha256', HMAC_KEY).update(n).digest('base64url');
};

const sqlEsc = (v) => String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

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
  const result = await sql('SELECT id, ssn, ssn_ct, ssn_hash FROM clients;');
  const clients = result?.[0]?.result || [];
  console.log(`Fetched ${clients.length} SurrealDB clients`);

  const candidates = [];
  let alreadyEncrypted = 0;
  let noSsn = 0;
  for (const c of clients) {
    const hasCt = c.ssn_ct && String(c.ssn_ct).startsWith('v1:');
    const plain = String(c.ssn || '').trim();
    if (hasCt) { alreadyEncrypted++; continue; }
    if (!plain) { noSsn++; continue; }
    candidates.push({ id: c.id, plain });
  }
  console.log(`Plan: encrypt ${candidates.length} | already done ${alreadyEncrypted} | no ssn ${noSsn}`);

  // Sanity: roundtrip a sample
  if (candidates.length > 0) {
    const sample = candidates[0];
    const ct = encryptSsn(sample.plain);
    const back = decryptSsn(ct);
    if (back !== sample.plain) {
      console.error(`Roundtrip failed: in=${JSON.stringify(sample.plain)} out=${JSON.stringify(back)}`);
      process.exit(1);
    }
    console.log(`Roundtrip ok for sample (${sample.id})`);
  }

  if (DRY_RUN) {
    console.log('--dry: not writing. Sample patches:');
    for (const c of candidates.slice(0, 3)) {
      console.log(` ${c.id}: ct=${encryptSsn(c.plain).slice(0, 40)}... hash=${hashSsn(c.plain)}`);
    }
    return;
  }

  const BATCH = 40;
  let done = 0;
  for (let i = 0; i < candidates.length; i += BATCH) {
    const slice = candidates.slice(i, i + BATCH);
    const stmts = slice.map((c) => {
      const ct = encryptSsn(c.plain);
      const hash = hashSsn(c.plain);
      return `UPDATE ${c.id} SET ssn_ct = "${sqlEsc(ct)}", ssn_hash = "${sqlEsc(hash)}";`;
    }).join('\n');
    await sql(stmts);
    done += slice.length;
    if (done % 200 === 0 || done === candidates.length) {
      console.log(`  encrypted ${done}/${candidates.length}`);
    }
  }
  console.log('Done.');
};

main().catch((err) => { console.error(err); process.exit(1); });
