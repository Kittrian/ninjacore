// src/lib/ssnCrypto.ts
// Field-level encryption for client SSNs.
//
//   At rest (SurrealDB clients table):
//     ssn       — DEPRECATED plaintext, will be nulled out once dual-write phase ends
//     ssn_ct    — AES-256-GCM ciphertext, format: "v1:<iv_b64u>:<ct_b64u>:<tag_b64u>"
//     ssn_hash  — HMAC-SHA256(key, normalised_ssn) for deterministic lookups
//
//   In flight:
//     decryptSsn() is called in read paths before returning the client object,
//     so the wire format is unchanged — frontend keeps seeing "585-99-4889".
//     Legacy plaintext rows pass through decryptSsn() unchanged during the
//     migration window.
//
//   Keys live in process.env (SSN_ENCRYPTION_KEY, SSN_HMAC_KEY) as base64
//   32-byte values. Generate fresh ones with:
//     node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

import { createCipheriv, createDecipheriv, randomBytes, createHmac } from "node:crypto";
import { logger } from "../utils/logger";

const KEY_B64 = (process.env.SSN_ENCRYPTION_KEY || "").trim();
const HMAC_KEY_B64 = (process.env.SSN_HMAC_KEY || "").trim();

let _key: Buffer | null = null;
let _hmacKey: Buffer | null = null;

function getKey(): Buffer {
  if (_key) return _key;
  if (!KEY_B64) throw new Error("SSN_ENCRYPTION_KEY env var is missing");
  const buf = Buffer.from(KEY_B64, "base64");
  if (buf.length !== 32) {
    throw new Error(`SSN_ENCRYPTION_KEY must decode to 32 bytes (got ${buf.length})`);
  }
  _key = buf;
  return _key;
}

function getHmacKey(): Buffer {
  if (_hmacKey) return _hmacKey;
  if (!HMAC_KEY_B64) throw new Error("SSN_HMAC_KEY env var is missing");
  const buf = Buffer.from(HMAC_KEY_B64, "base64");
  if (buf.length !== 32) {
    throw new Error(`SSN_HMAC_KEY must decode to 32 bytes (got ${buf.length})`);
  }
  _hmacKey = buf;
  return _hmacKey;
}

export function isEnabled(): boolean {
  return Boolean(KEY_B64 && HMAC_KEY_B64);
}

// Normalise to digits only so "585-99-4889", "585994889", " 585 99 4889 " all hash identically.
function normalise(ssn: string): string {
  return String(ssn || "").replace(/\D/g, "");
}

/** Encrypt a plaintext SSN. Returns "" if input is empty so callers can store an empty ssn_ct. */
export function encryptSsn(plain: string): string {
  const s = String(plain || "");
  if (!s) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(s, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${ct.toString("base64url")}:${tag.toString("base64url")}`;
}

/**
 * Decrypt a stored value. Passes through empty strings and legacy plaintext
 * (anything that doesn't start with "v1:") so the read path is safe during
 * the dual-write migration window.
 *
 * On any decryption failure (bad key, corrupted ciphertext) we log and return
 * an empty string rather than throwing, so the response shape is preserved.
 */
export function decryptSsn(stored: string | null | undefined): string {
  const s = String(stored ?? "");
  if (!s) return "";
  if (!s.startsWith("v1:")) return s; // legacy plaintext
  const parts = s.split(":");
  if (parts.length !== 4) {
    logger?.warn(`decryptSsn: malformed envelope (${parts.length} parts)`);
    return "";
  }
  const [, ivB64, ctB64, tagB64] = parts;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getKey(),
      Buffer.from(ivB64, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    const pt = Buffer.concat([
      decipher.update(Buffer.from(ctB64, "base64url")),
      decipher.final(),
    ]);
    return pt.toString("utf8");
  } catch (err: any) {
    logger?.warn(`decryptSsn failed: ${err.message}`);
    return "";
  }
}

/** Deterministic lookup hash. Same input → same output, so it can be indexed. */
export function hashSsn(ssn: string): string {
  const n = normalise(ssn);
  if (!n) return "";
  return createHmac("sha256", getHmacKey()).update(n).digest("base64url");
}

/** Convenience: returns { ssn_ct, ssn_hash } ready to spread into an UPDATE. */
export function buildSsnFields(plain: string): { ssn_ct: string; ssn_hash: string } {
  return { ssn_ct: encryptSsn(plain), ssn_hash: hashSsn(plain) };
}
