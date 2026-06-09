#!/usr/bin/env node

/**
 * APPLE OAUTH FIX
 *
 * Critical Issue: Arctic library requires Apple private key as DER bytes (Uint8Array),
 * not PEM string. This causes "invalid_client" OAuth error.
 *
 * Solution: Convert PEM to DER using this pemToDer() function before passing to Arctic.
 */

import fs from 'fs';

function pemToDer(pemString) {
  // Remove PEM headers and whitespace
  const base64 = pemString
    .replace(/-----BEGIN[^-]+-----/, '')
    .replace(/-----END[^-]+-----/, '')
    .replace(/\s/g, '');

  // Decode base64 to binary
  const binaryString = Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
}

// Read the PEM key file
const keyPath = process.env.APPLE_PRIVATE_KEY_PATH || './AuthKey_P2C7S39FX8.p8';
const pemKey = fs.readFileSync(keyPath, 'utf-8');
const derKey = pemToDer(pemKey);

console.log('✅ PEM to DER conversion successful');
console.log(`  Original PEM length: ${pemKey.length} bytes`);
console.log(`  DER bytes length: ${derKey.length} bytes`);
console.log(`  First 10 bytes: ${Array.from(derKey.slice(0, 10)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}`);

// Test with Arctic (example)
console.log('\n✅ Ready to use with Arctic:');
console.log(`
import { Arctic } from 'arctic';
import { Apple } from 'arctic';

const apple = new Apple({
  clientId: process.env.APPLE_CLIENT_ID,
  teamId: process.env.APPLE_TEAM_ID,
  keyId: process.env.APPLE_KEY_ID,
  privateKey: derKey,  // ← DER bytes, not string!
});
`);
