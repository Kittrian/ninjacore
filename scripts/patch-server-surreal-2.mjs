// patch-server-surreal-2.mjs
// Fixes remaining db.query() calls missed by the first patch.
import { readFileSync, writeFileSync } from 'fs';

const serverPath = '/home/ninja/ninjadispute-backend/server.mjs';
let code = readFileSync(serverPath, 'utf8');
let patchCount = 0;

function replace(label, oldText, newText) {
  if (!code.includes(oldText)) {
    console.warn(`  WARN [${label}]: text not found`);
    return;
  }
  code = code.replace(oldText, newText);
  patchCount++;
  console.log(`  ✓ [${label}]`);
}

// Fix saveAffiliateSection — replace db.query with surql
replace('saveAffiliateSection',
  `  const db = await getReportsDb();
  await db.query(\`
    INSERT INTO app_settings (setting_key, value_json, updated_at)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      value_json = VALUES(value_json),
      updated_at = VALUES(updated_at)
  \`, [
    \`affiliate.\${normalizedSection}\`,
    JSON.stringify(normalizedRows),
    new Date().toISOString(),
  ]);`,
  `  const _affKey = \`affiliate.\${normalizedSection}\`;
  const _affNow = new Date().toISOString();
  await surql(\`UPSERT settings:⟨\${sId(_affKey)}⟩ SET
    setting_key = "\${sEsc(_affKey)}",
    value_json = "\${sEsc(JSON.stringify(normalizedRows))}",
    updated_at = "\${_affNow}"\`);`
);

// Remove any leftover standalone `const db = await getReportsDb();` lines
// that precede a surql() call (orphaned db variable)
// We can leave them — getReportsDb() returns the shim object which is harmless.
// But let's check if any db.query() calls remain outside comments.

writeFileSync(serverPath, code, 'utf8');
console.log(`\n✓ Applied ${patchCount} patches`);

// Verify no live db.query calls remain outside of block comments
const lines = code.split('\n');
let inBlockComment = false;
const remaining = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('/*') && !line.includes('*/')) inBlockComment = true;
  if (inBlockComment && line.includes('*/')) { inBlockComment = false; continue; }
  if (!inBlockComment && line.includes('await db.query(') || (!inBlockComment && line.includes('await reportsDb.query('))) {
    remaining.push(`  line ${i + 1}: ${line.trim().slice(0, 80)}`);
  }
}
if (remaining.length > 0) {
  console.warn('\nRemaining db.query() calls outside comments:');
  remaining.forEach(l => console.warn(l));
} else {
  console.log('\n✓ No remaining db.query() calls outside block comments');
}
