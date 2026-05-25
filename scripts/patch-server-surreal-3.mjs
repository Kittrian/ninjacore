// patch-server-surreal-3.mjs
// Fix: SurrealDB distinguishes integer IDs (merchants:1) vs string IDs (merchants:⟨1⟩).
// Migrated records have integer IDs; new records have string UUIDs.
// We need mkRef() to choose the right form.
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

// Add mkRef helper next to extractSurrealId
replace('add-mkRef-helper',
  `/** Extract the ID portion from a SurrealDB record ID string (e.g. "merchants:42" → "42") */
const extractSurrealId = (recordId) => {
  const str = String(recordId || '');
  const idx = str.indexOf(':');
  return idx >= 0 ? str.slice(idx + 1) : str;
};`,
  `/** Extract the ID portion from a SurrealDB record ID string (e.g. "merchants:42" → "42") */
const extractSurrealId = (recordId) => {
  const str = String(recordId || '');
  const idx = str.indexOf(':');
  return idx >= 0 ? str.slice(idx + 1) : str;
};

/** Build a SurrealDB record reference: integer IDs use bare form, strings use ⟨⟩ escaping */
const mkRef = (table, id) => {
  const s = String(id ?? '');
  return /^\\d+$/.test(s) ? \`\${table}:\${s}\` : \`\${table}:⟨\${sId(s)}⟩\`;
};`
);

// Fix updatePaymentMerchant: use mkRef instead of merchants:⟨safeId⟩
replace('fix-updateMerchant-lookups',
  `  const safeId = sId(String(merchantId));
  const existingRows = await surql(\`SELECT * FROM merchants:⟨\${safeId}⟩\`);
  const row = existingRows?.[0] || null;
  if (!row) throw new Error('Merchant not found.');
  const now = new Date().toISOString();
  const merchantName = String(payload.merchantName ?? row.merchant_name ?? '').trim();
  if (!merchantName) throw new Error('Merchant name is required.');
  const gateway = String(payload.gateway ?? row.gateway ?? '').trim();
  if (!gateway) throw new Error('Gateway is required.');
  const nextIsDefault = payload.isDefault === undefined
    ? row.is_default === true
    : payload.isDefault === true || payload.isDefault === 'true';
  if (nextIsDefault) {
    await surql(\`UPDATE merchants SET is_default = false, updated_at = "\${now}" WHERE owner_key = "admin"\`);
  }
  const mdata = JSON.stringify(payload.metadata && typeof payload.metadata === 'object'
    ? payload.metadata : parseJsonField(row.metadata_json, {}));
  await surql(\`UPDATE merchants:⟨\${safeId}⟩ SET
    merchant_name = "\${sEsc(merchantName)}",
    gateway = "\${sEsc(gateway)}",
    api_id = "\${sEsc(String(payload.apiId ?? row.api_id ?? '').trim())}",
    transaction_key = "\${sEsc(String(payload.transactionKey ?? row.transaction_key ?? '').trim())}",
    is_default = \${nextIsDefault},
    status = "\${sEsc(normalizePaymentStatus(payload.status ?? row.status, 'Active'))}",
    allowed_retries = \${clampInteger(payload.allowedRetries ?? row.allowed_retries, 3, 0, 999)},
    retry_frequency_days = \${clampInteger(payload.retryFrequencyDays ?? row.retry_frequency_days, 7, 1, 365)},
    metadata_json = "\${sEsc(mdata)}",
    updated_at = "\${now}"\`);
  const updatedRows = await surql(\`SELECT * FROM merchants:⟨\${safeId}⟩\`);
  return formatMerchantRow(updatedRows?.[0] || null);`,
  `  const _mref = mkRef('merchants', merchantId);
  const existingRows = await surql(\`SELECT * FROM \${_mref}\`);
  const row = existingRows?.[0] || null;
  if (!row) throw new Error('Merchant not found.');
  const now = new Date().toISOString();
  const merchantName = String(payload.merchantName ?? row.merchant_name ?? '').trim();
  if (!merchantName) throw new Error('Merchant name is required.');
  const gateway = String(payload.gateway ?? row.gateway ?? '').trim();
  if (!gateway) throw new Error('Gateway is required.');
  const nextIsDefault = payload.isDefault === undefined
    ? row.is_default === true
    : payload.isDefault === true || payload.isDefault === 'true';
  if (nextIsDefault) {
    await surql(\`UPDATE merchants SET is_default = false, updated_at = "\${now}" WHERE owner_key = "admin"\`);
  }
  const mdata = JSON.stringify(payload.metadata && typeof payload.metadata === 'object'
    ? payload.metadata : parseJsonField(row.metadata_json, {}));
  await surql(\`UPDATE \${_mref} SET
    merchant_name = "\${sEsc(merchantName)}",
    gateway = "\${sEsc(gateway)}",
    api_id = "\${sEsc(String(payload.apiId ?? row.api_id ?? '').trim())}",
    transaction_key = "\${sEsc(String(payload.transactionKey ?? row.transaction_key ?? '').trim())}",
    is_default = \${nextIsDefault},
    status = "\${sEsc(normalizePaymentStatus(payload.status ?? row.status, 'Active'))}",
    allowed_retries = \${clampInteger(payload.allowedRetries ?? row.allowed_retries, 3, 0, 999)},
    retry_frequency_days = \${clampInteger(payload.retryFrequencyDays ?? row.retry_frequency_days, 7, 1, 365)},
    metadata_json = "\${sEsc(mdata)}",
    updated_at = "\${now}"\`);
  const updatedRows = await surql(\`SELECT * FROM \${_mref}\`);
  return formatMerchantRow(updatedRows?.[0] || null);`
);

// Fix deletePaymentMerchant
replace('fix-deleteMerchant',
  `const deletePaymentMerchant = async (ownerKey, merchantId) => {
  const safeId = sId(String(merchantId));
  const now = new Date().toISOString();
  await surql(\`UPDATE autopay SET merchant_id = NONE, updated_at = "\${now}" WHERE merchant_id = "merchants:\${safeId}"\`);
  await surql(\`DELETE merchants:⟨\${safeId}⟩\`);
  return true;
};`,
  `const deletePaymentMerchant = async (ownerKey, merchantId) => {
  const _mref = mkRef('merchants', merchantId);
  const now = new Date().toISOString();
  await surql(\`UPDATE autopay SET merchant_id = NONE, updated_at = "\${now}" WHERE merchant_id = "\${_mref}"\`);
  await surql(\`DELETE \${_mref}\`);
  return true;
};`
);

// Fix createPaymentMerchant — fetch by record ref
replace('fix-createMerchant-fetch',
  `  const rows = await surql(\`SELECT * FROM merchants:⟨\${newId}⟩\`);
  return formatMerchantRow(rows?.[0] || null);
};`,
  `  const rows = await surql(\`SELECT * FROM \${mkRef('merchants', newId)}\`);
  return formatMerchantRow(rows?.[0] || null);
};`
);

// Fix updatePaymentProduct
replace('fix-updateProduct',
  `  const safeId = sId(String(productId));
  const existingRows = await surql(\`SELECT * FROM products:⟨\${safeId}⟩\`);
  const row = existingRows?.[0] || null;
  if (!row) throw new Error('Product not found.');`,
  `  const _pref = mkRef('products', productId);
  const existingRows = await surql(\`SELECT * FROM \${_pref}\`);
  const row = existingRows?.[0] || null;
  if (!row) throw new Error('Product not found.');`
);

replace('fix-updateProduct-queries',
  `  await surql(\`UPDATE products:⟨\${safeId}⟩ SET
    product_name = "\${sEsc(productName)}",
    product_type = "\${sEsc(String(payload.productType ?? row.product_type ?? 'Service').trim() || 'Service')}",
    price_cents = \${priceCents},
    billing_frequency = "\${sEsc(normalizeFrequencyType(payload.billingFrequency ?? row.billing_frequency, 'monthly'))}",
    status = "\${sEsc(normalizePaymentStatus(payload.status ?? row.status, 'Active'))}",
    metadata_json = "\${sEsc(mdata)}",
    updated_at = "\${now}"\`);
  const updatedRows = await surql(\`SELECT * FROM products:⟨\${safeId}⟩\`);
  return formatProductRow(updatedRows?.[0] || null);`,
  `  await surql(\`UPDATE \${_pref} SET
    product_name = "\${sEsc(productName)}",
    product_type = "\${sEsc(String(payload.productType ?? row.product_type ?? 'Service').trim() || 'Service')}",
    price_cents = \${priceCents},
    billing_frequency = "\${sEsc(normalizeFrequencyType(payload.billingFrequency ?? row.billing_frequency, 'monthly'))}",
    status = "\${sEsc(normalizePaymentStatus(payload.status ?? row.status, 'Active'))}",
    metadata_json = "\${sEsc(mdata)}",
    updated_at = "\${now}"\`);
  const updatedRows = await surql(\`SELECT * FROM \${_pref}\`);
  return formatProductRow(updatedRows?.[0] || null);`
);

// Fix deletePaymentProduct
replace('fix-deleteProduct',
  `const deletePaymentProduct = async (ownerKey, productId) => {
  const safeId = sId(String(productId));
  const now = new Date().toISOString();
  await surql(\`UPDATE autopay SET product_id = NONE, updated_at = "\${now}" WHERE product_id = "products:\${safeId}"\`);
  await surql(\`DELETE products:⟨\${safeId}⟩\`);
  return true;
};`,
  `const deletePaymentProduct = async (ownerKey, productId) => {
  const _pref = mkRef('products', productId);
  const now = new Date().toISOString();
  await surql(\`UPDATE autopay SET product_id = NONE, updated_at = "\${now}" WHERE product_id = "\${_pref}"\`);
  await surql(\`DELETE \${_pref}\`);
  return true;
};`
);

// Fix createPaymentProduct fetch
replace('fix-createProduct-fetch',
  `  const rows = await surql(\`SELECT * FROM products:⟨\${newId}⟩\`);
  return formatProductRow(rows?.[0] || null);`,
  `  const rows = await surql(\`SELECT * FROM \${mkRef('products', newId)}\`);
  return formatProductRow(rows?.[0] || null);`
);

// Fix updatePaymentAutopay
replace('fix-updateAutopay-ref',
  `  const safeId = sId(String(autopayId));
  const existingRows = await surql(\`SELECT * FROM autopay:⟨\${safeId}⟩\`);
  const row = existingRows?.[0] || null;
  if (!row) {
    throw new Error('Autopay row not found.');
  }`,
  `  const _aref = mkRef('autopay', autopayId);
  const existingRows = await surql(\`SELECT * FROM \${_aref}\`);
  const row = existingRows?.[0] || null;
  if (!row) {
    throw new Error('Autopay row not found.');
  }`
);

replace('fix-updateAutopay-queries',
  `  await surql(\`UPDATE autopay:⟨\${safeId}⟩ SET`,
  `  await surql(\`UPDATE \${_aref} SET`
);

replace('fix-updateAutopay-fetch',
  `  const updatedRows = await surql(\`SELECT * FROM autopay:⟨\${safeId}⟩\`);
  return formatAutopayRow(updatedRows?.[0] || null);
};`,
  `  const updatedRows = await surql(\`SELECT * FROM \${_aref}\`);
  return formatAutopayRow(updatedRows?.[0] || null);
};`
);

// Fix deletePaymentAutopay
replace('fix-deleteAutopay',
  `const deletePaymentAutopay = async (ownerKey, autopayId) => {
  const safeId = sId(String(autopayId));
  await surql(\`DELETE autopay:⟨\${safeId}⟩\`);
  return true;
};`,
  `const deletePaymentAutopay = async (ownerKey, autopayId) => {
  await surql(\`DELETE \${mkRef('autopay', autopayId)}\`);
  return true;
};`
);

// Fix createPaymentAutopay fetch
replace('fix-createAutopay-fetch',
  `  const rows = await surql(\`SELECT * FROM autopay:⟨\${newId}⟩\`);
  return formatAutopayRow(rows?.[0] || null);
};`,
  `  const rows = await surql(\`SELECT * FROM \${mkRef('autopay', newId)}\`);
  return formatAutopayRow(rows?.[0] || null);
};`
);

// Also fix createPaymentAutopay merchant_id and product_id references to use mkRef
replace('fix-createAutopay-refs',
  `  const midRef = payload.merchantId ? \`"merchants:\${sId(String(payload.merchantId))}"\` : 'NONE';
  const pidRef = payload.productId ? \`"products:\${sId(String(payload.productId))}"\` : 'NONE';`,
  `  const midRef = payload.merchantId ? \`"\${mkRef('merchants', payload.merchantId)}"\` : 'NONE';
  const pidRef = payload.productId ? \`"\${mkRef('products', payload.productId)}"\` : 'NONE';`
);

// Fix updatePaymentAutopay merchant/product refs
replace('fix-updateAutopay-midpid',
  `  const midRef = payload.merchantId !== undefined
    ? (payload.merchantId ? \`"merchants:\${sId(String(payload.merchantId))}"\` : 'NONE')
    : (row.merchant_id != null ? \`"\${sEsc(String(row.merchant_id))}"\` : 'NONE');
  const pidRef = payload.productId !== undefined
    ? (payload.productId ? \`"products:\${sId(String(payload.productId))}"\` : 'NONE')
    : (row.product_id != null ? \`"\${sEsc(String(row.product_id))}"\` : 'NONE');`,
  `  const midRef = payload.merchantId !== undefined
    ? (payload.merchantId ? \`"\${mkRef('merchants', payload.merchantId)}"\` : 'NONE')
    : (row.merchant_id != null ? \`"\${sEsc(String(row.merchant_id))}"\` : 'NONE');
  const pidRef = payload.productId !== undefined
    ? (payload.productId ? \`"\${mkRef('products', payload.productId)}"\` : 'NONE')
    : (row.product_id != null ? \`"\${sEsc(String(row.product_id))}"\` : 'NONE');`
);

// Also fix the route ID matching — merchants/products/autopay routes use (\d+) regex.
// New records will have UUID hex IDs which won't match \d+.
// Update to also match hex UUIDs.
replace('fix-merchantMatch-regex',
  `  const merchantMatch = pathname.match(/^\\/api\\/payments\\/merchants\\/(\\d+)$/);`,
  `  const merchantMatch = pathname.match(/^\\/api\\/payments\\/merchants\\/([a-zA-Z0-9]+)$/);`
);

replace('fix-productMatch-regex',
  `  const productMatch = pathname.match(/^\\/api\\/payments\\/products\\/(\\d+)$/);`,
  `  const productMatch = pathname.match(/^\\/api\\/payments\\/products\\/([a-zA-Z0-9]+)$/);`
);

replace('fix-autopayMatch-regex',
  `  const autopayMatch = pathname.match(/^\\/api\\/payments\\/autopay\\/(\\d+)$/);`,
  `  const autopayMatch = pathname.match(/^\\/api\\/payments\\/autopay\\/([a-zA-Z0-9]+)$/);`
);

// Fix merchantId/productId/autopayId to not force Number() conversion
replace('fix-merchantId-number',
  `      const merchantId = Number(merchantMatch[1]);`,
  `      const merchantId = merchantMatch[1]; // string ID (numeric or UUID)`
);

replace('fix-merchantId-number-delete',
  `      const merchantId = Number(merchantMatch[1]);`,
  `      const merchantId = merchantMatch[1];`
);

replace('fix-productId-number',
  `      const productId = Number(productMatch[1]);`,
  `      const productId = productMatch[1];`
);

replace('fix-productId-number-delete',
  `      const productId = Number(productMatch[1]);`,
  `      const productId = productMatch[1];`
);

replace('fix-autopayId-number',
  `      const autopayId = Number(autopayMatch[1]);`,
  `      const autopayId = autopayMatch[1];`
);

replace('fix-autopayId-number-delete',
  `      const autopayId = Number(autopayMatch[1]);`,
  `      const autopayId = autopayMatch[1];`
);

writeFileSync(serverPath, code, 'utf8');
console.log(`\n✓ Applied ${patchCount} patches`);
