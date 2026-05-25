// patch-server-surreal.mjs
// Patches /home/ninja/ninjadispute-backend/server.mjs to use SurrealDB instead of MySQL.
// Creates a backup at server.mjs.mysql-bak before modifying.
// Run: node scripts/patch-server-surreal.mjs
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';

const serverPath = '/home/ninja/ninjadispute-backend/server.mjs';
const backupPath = serverPath + '.mysql-bak';

if (!existsSync(serverPath)) {
  console.error('server.mjs not found at', serverPath);
  process.exit(1);
}

// Only take backup once
if (!existsSync(backupPath)) {
  copyFileSync(serverPath, backupPath);
  console.log('Backup created:', backupPath);
} else {
  console.log('Backup already exists:', backupPath);
}

let code = readFileSync(serverPath, 'utf8');
let patchCount = 0;

function replace(label, oldText, newText) {
  if (!code.includes(oldText)) {
    console.warn(`  WARN [${label}]: text not found — skipping`);
    return;
  }
  code = code.replace(oldText, newText);
  patchCount++;
  console.log(`  ✓ [${label}]`);
}

// ────────────────────────────────────────────────────────────────────────────
// PATCH 1: Remove mysql import, add SurrealDB helpers
// ────────────────────────────────────────────────────────────────────────────
replace('remove-mysql-import',
  `import mysql from 'mysql2/promise';`,
  `// mysql removed — using SurrealDB
const _SURREAL_AUTH = 'Basic ' + Buffer.from('root:Malachi77').toString('base64');
const _SURREAL_URL  = 'http://127.0.0.1:8000/sql';
const _LOCAL_REPORTS_DIR = '/var/lib/ninjadispute/reports/ninjatools';

/** Execute a single SurrealQL statement; returns the result array. */
const surql = async (query) => {
  const res = await fetch(_SURREAL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/surrealql',
      Accept: 'application/json',
      'Surreal-NS': 'ninja',
      'Surreal-DB': 'dispute',
      Authorization: _SURREAL_AUTH,
    },
    body: query,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(\`SurrealDB HTTP \${res.status}: \${txt.slice(0, 300)}\`);
  }
  const d = await res.json();
  if (d[0]?.status === 'ERR') throw new Error(\`SurrealDB ERR: \${d[0].result}\`);
  return Array.isArray(d[0]?.result) ? d[0].result : [];
};

/** Extract the ID portion from a SurrealDB record ID string (e.g. "merchants:42" → "42") */
const extractSurrealId = (recordId) => {
  const str = String(recordId || '');
  const idx = str.indexOf(':');
  return idx >= 0 ? str.slice(idx + 1) : str;
};

/** Escape a value for safe inline embedding in a SurrealQL string literal. */
const sEsc = (v) => String(v == null ? '' : v).replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"');

/** Escape a value for use inside ⟨⟩ record ID syntax. */
const sId = (v) => String(v == null ? '' : v).replace(/[⟨⟩]/g, '_');`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 2: Remove toolsNinjaDbConfig block (and getReportSavePaths reference)
// ────────────────────────────────────────────────────────────────────────────
replace('remove-toolsNinjaDbConfig',
  `const toolsNinjaDbConfig = {
  host: String(process.env.TOOLSNINJA_DB_HOST || process.env.MYSQL_HOST || '127.0.0.1').trim(),
  port: Number.parseInt(process.env.TOOLSNINJA_DB_PORT || process.env.MYSQL_PORT || '3306', 10) || 3306,
  user: String(process.env.TOOLSNINJA_DB_USER || process.env.MYSQL_USER || 'ninjacore').trim(),
  password: String(process.env.TOOLSNINJA_DB_PASSWORD || process.env.MYSQL_PASSWORD || '').trim(),
  database: String(process.env.TOOLSNINJA_DB_NAME || process.env.MYSQL_DATABASE || 'TOOLSNINJA').trim(),
};`,
  `// toolsNinjaDbConfig removed — SurrealDB used instead`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 3: Fix getReportSavePaths to not reference toolsNinjaDbConfig
// ────────────────────────────────────────────────────────────────────────────
replace('fix-getReportSavePaths',
  `  reportHistoryDbPath: \`mysql://\${toolsNinjaDbConfig.host}:\${toolsNinjaDbConfig.port}/\${toolsNinjaDbConfig.database}\`,`,
  `  reportHistoryDbPath: 'surrealdb://127.0.0.1:8000/ninja/dispute',`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 4: Replace getUserByUsername() — queries SurrealDB users table
// ────────────────────────────────────────────────────────────────────────────
replace('getUserByUsername',
  `const getUserByUsername = async (username = '') => {
  const normalized = normalizeUsername(username);
  if (!normalized) {
    return null;
  }
  const db = await getReportsDb();
  const [rows] = await db.query(\`
    SELECT username, password_hash AS passwordHash, password_salt AS passwordSalt, created_at AS createdAt
    FROM app_users
    WHERE username = ?
  \`, [normalized]);
  return rows?.[0] || null;
};`,
  `const getUserByUsername = async (username = '') => {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;
  const rows = await surql(
    \`SELECT username, password_hash AS passwordHash, password_salt AS passwordSalt, created_at AS createdAt
     FROM users WHERE username = "\${sEsc(normalized)}" LIMIT 1\`
  );
  return rows?.[0] || null;
};`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 5: Replace createAppUser() — uses SurrealDB users table
// ────────────────────────────────────────────────────────────────────────────
replace('createAppUser',
  `const createAppUser = async (username = '', password = '') => {
  const normalized = normalizeUsername(username);
  const nextPassword = String(password || '').trim();
  if (!normalized || !nextPassword) {
    throw new Error('Username and password are required.');
  }
  const db = await getReportsDb();
  const [existingRows] = await db.query('SELECT username FROM app_users WHERE username = ?', [normalized]);
  const existing = existingRows?.[0] || null;
  if (existing) {
    throw new Error('That username is already in use.');
  }
  const salt = randomUUID();
  const passwordHash = hashUserPassword(nextPassword, salt);
  const now = new Date().toISOString();
  await db.query(\`
    INSERT INTO app_users (username, password_hash, password_salt, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  \`, [normalized, passwordHash, salt, now, now]);
  dynamicUsernames.add(normalized);
  await ensureDataFile(normalized);
  void mirrorBusinessControlPlaneToS3('admin').catch((error) => {
    console.warn(\`[S3 Mirror] app user export failed: \${error.message}\`);
  });
  return { username: normalized, createdAt: now };
};`,
  `const createAppUser = async (username = '', password = '') => {
  const normalized = normalizeUsername(username);
  const nextPassword = String(password || '').trim();
  if (!normalized || !nextPassword) throw new Error('Username and password are required.');
  const existing = await getUserByUsername(normalized);
  if (existing) throw new Error('That username is already in use.');
  const salt = randomUUID();
  const passwordHash = hashUserPassword(nextPassword, salt);
  const now = new Date().toISOString();
  await surql(\`CREATE users:⟨\${sId(normalized)}⟩ SET
    username = "\${sEsc(normalized)}",
    password_hash = "\${sEsc(passwordHash)}",
    password_salt = "\${sEsc(salt)}",
    created_at = "\${now}",
    updated_at = "\${now}"\`);
  dynamicUsernames.add(normalized);
  await ensureDataFile(normalized);
  void mirrorBusinessControlPlaneToS3('admin').catch((error) => {
    console.warn(\`[S3 Mirror] app user export failed: \${error.message}\`);
  });
  return { username: normalized, createdAt: now };
};`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 6: Replace getReportsDb() — replace with surreal schema ensurer
// ────────────────────────────────────────────────────────────────────────────
replace('getReportsDb-body',
  `const getReportsDb = async () => {
  if (!reportsDb) {
    reportsDb = mysql.createPool({
      host: toolsNinjaDbConfig.host,
      port: toolsNinjaDbConfig.port,
      user: toolsNinjaDbConfig.user,
      password: toolsNinjaDbConfig.password,
      database: toolsNinjaDbConfig.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      multipleStatements: true,
    });
  }`,
  `const getReportsDb = async () => {
  if (!reportsDb) {
    reportsDb = { _surreal: true }; // SurrealDB shim — legacy handle, no longer used for queries
  }`
);

// Replace everything from CREATE TABLE IF NOT EXISTS to end of getReportsDb
replace('getReportsDb-tables',
  `  if (!reportsDbReady) {
    await reportsDb.query(\`
      CREATE TABLE IF NOT EXISTS report_history (`,
  `  if (!reportsDbReady) {
    // SurrealDB schema is defined at migration time (migrate-extra-tables.mjs).
    // Ensure default app credentials exist in SurrealDB users table.
    try {
      const now = new Date().toISOString();
      for (const credential of getAllowedLoginCredentials()) {
        const username = normalizeUsername(credential.username);
        const password = String(credential.password || '');
        if (!username || !password) continue;
        const salt = \`seed:\${username}\`;
        const hash = hashUserPassword(password, salt);
        await surql(\`UPSERT users:⟨\${sId(username)}⟩ SET
          username = "\${sEsc(username)}",
          password_hash = "\${sEsc(hash)}",
          password_salt = "\${sEsc(salt)}",
          created_at = "\${now}",
          updated_at = "\${now}"\`);
        dynamicUsernames.add(username);
      }
      // Load all existing users into dynamicUsernames
      const allUsers = await surql('SELECT username FROM users');
      for (const row of allUsers) {
        const uname = normalizeUsername(row?.username || '');
        if (uname) dynamicUsernames.add(uname);
      }
    } catch (e) {
      console.warn('[SurrealDB] init error:', e.message);
    }
    // Ensure local reports dir exists
    try {
      const { mkdirSync } = await import('node:fs');
      mkdirSync(_LOCAL_REPORTS_DIR, { recursive: true });
    } catch {}
    reportsDbReady = true;
    if (!initialS3MirrorQueued) {
      initialS3MirrorQueued = true;
      void mirrorBusinessControlPlaneToS3('admin').catch((error) => {
        console.warn(\`[S3 Mirror] initial control-plane export failed: \${error.message}\`);
      });
    }
  }
  return reportsDb;
};
/* --- BEGIN DELETED MySQL TABLE CREATION CODE --- `
);

// Remove the giant block from CREATE TABLE IF NOT EXISTS report_history down to end of old getReportsDb
replace('getReportsDb-tail',
  `      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    \`);
    try {
      await reportsDb.query('ALTER TABLE report_history MODIFY COLUMN id BIGINT NOT NULL AUTO_INCREMENT');
    } catch {}
    try {
      await reportsDb.query('ALTER TABLE payment_merchants MODIFY COLUMN id BIGINT NOT NULL AUTO_INCREMENT');
    } catch {}
    try {
      await reportsDb.query('ALTER TABLE payment_products MODIFY COLUMN id BIGINT NOT NULL AUTO_INCREMENT');
    } catch {}
    try {
      await reportsDb.query('ALTER TABLE payment_autopay MODIFY COLUMN id BIGINT NOT NULL AUTO_INCREMENT');
    } catch {}
    try {
      await reportsDb.query('ALTER TABLE failed_payment_events MODIFY COLUMN id BIGINT NOT NULL AUTO_INCREMENT');
    } catch {}
    // Shared-business cutover safety:
    // 1) if admin row already exists for a client_id, remove non-admin duplicates first
    // 2) collapse remaining cross-owner duplicates down to one row per client_id
    // 3) then normalize everything to owner_key=admin
    await reportsDb.query(\`
      DELETE cp
      FROM client_profiles cp
      INNER JOIN client_profiles ap
        ON ap.client_id = cp.client_id
       AND ap.owner_key = 'admin'
      WHERE cp.owner_key <> 'admin'
    \`);
    await reportsDb.query(\`
      DELETE older
      FROM client_profiles older
      INNER JOIN client_profiles newer
        ON newer.client_id = older.client_id
       AND newer.owner_key <> older.owner_key
       AND older.owner_key <> 'admin'
       AND newer.owner_key <> 'admin'
       AND COALESCE(newer.updated_at, '') >= COALESCE(older.updated_at, '')
    \`);
    await reportsDb.query(\`UPDATE client_profiles SET owner_key = 'admin' WHERE owner_key IS NULL OR TRIM(owner_key) = '' OR owner_key <> 'admin'\`);
    await reportsDb.query(\`UPDATE payment_merchants SET owner_key = 'admin' WHERE owner_key IS NULL OR TRIM(owner_key) = '' OR owner_key <> 'admin'\`);
    await reportsDb.query(\`UPDATE payment_products SET owner_key = 'admin' WHERE owner_key IS NULL OR TRIM(owner_key) = '' OR owner_key <> 'admin'\`);
    await reportsDb.query(\`UPDATE payment_autopay SET owner_key = 'admin' WHERE owner_key IS NULL OR TRIM(owner_key) = '' OR owner_key <> 'admin'\`);
    await reportsDb.query(\`UPDATE failed_payment_events SET owner_key = 'admin' WHERE owner_key IS NULL OR TRIM(owner_key) = '' OR owner_key <> 'admin'\`);

    const now = new Date().toISOString();
    for (const credential of getAllowedLoginCredentials()) {
      const username = normalizeUsername(credential.username);
      const password = String(credential.password || '');
      if (!username || !password) continue;
      const salt = \`seed:\${username}\`;
      await reportsDb.query(
        \`INSERT INTO app_users (username, password_hash, password_salt, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE username = username\`,
        [username, hashUserPassword(password, salt), salt, now, now],
      );
      dynamicUsernames.add(username);
    }

    const [allUsers] = await reportsDb.query('SELECT username FROM app_users');
    for (const row of allUsers) {
      const username = normalizeUsername(row?.username || '');
      if (username) dynamicUsernames.add(username);
    }
    reportsDbReady = true;
    if (!initialS3MirrorQueued) {
      initialS3MirrorQueued = true;
      void mirrorBusinessControlPlaneToS3('admin').catch((error) => {
        console.warn(\`[S3 Mirror] initial control-plane export failed: \${error.message}\`);
      });
    }
  }

  return reportsDb;
};`,
  `/* --- END DELETED MySQL TABLE CREATION CODE --- */`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 7: Replace saveReport() MySQL queries
// The function saves a credit report to report_history.
// New: write JSON to local disk, UPSERT to SurrealDB reports table.
// ────────────────────────────────────────────────────────────────────────────
replace('saveReport-mysql',
  `  const db = await getReportsDb();
  const reportHtml = String(payload.reportHtml || client.creditReportHtml || '');
  const reportJson = stringifyJsonValue(payload.reportJsonRaw || payload.reportJson || client.creditReportJson || '');
  const reportDate = String(payload.reportDate || client.reportDate || '');
  const reportFileName = String(payload.reportFileName || client.creditReportFileName || '');
  const source = String(payload.source || client.creditReportSource || 'html-upload');
  const monitoringAgency = String(payload.monitoringAgency || '');
  const responseUrl = String(payload.responseUrl || '');
  const metadataJson = stringifyJsonValue(payload.metadata || '');
  const createdAt = String(payload.createdAt || new Date().toISOString());
  const snapshotChecksum = buildSnapshotChecksum({
    clientId: client.id,
    source,
    reportDate,
    reportFileName,
    reportHtml,
    reportJson,
  });

  await db.query(\`
    INSERT INTO report_history (
      client_id,
      source,
      monitoring_agency,
      report_date,
      report_file_name,
      report_html,
      report_json,
      response_url,
      snapshot_checksum,
      metadata_json,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE id = id
  \`, [
    client.id,
    source,
    monitoringAgency,
    reportDate,
    reportFileName,
    reportHtml,
    reportJson,
    responseUrl,
    snapshotChecksum,
    metadataJson,
    createdAt,
  ]);

  const [rows] = await db.query(\`
    SELECT id, client_id AS clientId, source, report_date AS reportDate, report_file_name AS reportFileName, created_at AS createdAt
    FROM report_history
    WHERE client_id = ? AND snapshot_checksum = ?
  \`, [client.id, snapshotChecksum]);
  const snapshot = rows?.[0] || null;`,
  `  const reportHtml = String(payload.reportHtml || client.creditReportHtml || '');
  const reportJson = stringifyJsonValue(payload.reportJsonRaw || payload.reportJson || client.creditReportJson || '');
  const reportDate = String(payload.reportDate || client.reportDate || '');
  const reportFileName = String(payload.reportFileName || client.creditReportFileName || '');
  const source = String(payload.source || client.creditReportSource || 'html-upload');
  const monitoringAgency = String(payload.monitoringAgency || '');
  const responseUrl = String(payload.responseUrl || '');
  const metadataJson = stringifyJsonValue(payload.metadata || '');
  const createdAt = String(payload.createdAt || new Date().toISOString());
  const snapshotChecksum = buildSnapshotChecksum({
    clientId: client.id,
    source,
    reportDate,
    reportFileName,
    reportHtml,
    reportJson,
  });

  // Check if report with this checksum already exists in SurrealDB
  const safeClientId = String(client.id).replace(/[^a-zA-Z0-9_]/g, '_');
  const existingByChecksum = await surql(
    \`SELECT id, client_id AS clientId, source, report_date AS reportDate,
             report_file_name AS reportFileName, created_at AS createdAt
     FROM reports WHERE client_id = "\${sEsc(client.id)}" AND snapshot_checksum = "\${sEsc(snapshotChecksum)}" LIMIT 1\`
  );
  if (existingByChecksum.length > 0) {
    const snapshot = existingByChecksum[0];
    snapshot.id = extractSurrealId(snapshot.id || '').replace('_ninjatools', '');
    return snapshot;
  }

  // Generate a new report ID and write JSON to local disk
  const newReportId = randomUUID().replace(/-/g, '');
  const reportLocalPath = \`\${_LOCAL_REPORTS_DIR}/\${newReportId}.json\`;
  let reportLocalPathFinal = '';
  let reportR2Key = '';
  try {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(reportLocalPath, reportJson || reportHtml || '', 'utf8');
    reportLocalPathFinal = reportLocalPath;
  } catch (e) {
    console.warn('[saveReport] could not write local file:', e.message);
  }

  const recordId = \`reports:\${newReportId}_ninjatools\`;
  await surql(\`UPSERT \${recordId} SET
    report_id = "\${newReportId}",
    client_id = "\${sEsc(client.id)}",
    source_db = "ninjatools",
    source = "\${sEsc(source)}",
    report_date = "\${sEsc(reportDate)}",
    report_file_name = "\${sEsc(reportFileName)}",
    report_html = "\${sEsc(reportHtml.slice(0, 4096))}",
    report_json = "",
    report_local_path = "\${sEsc(reportLocalPathFinal)}",
    report_r2_key = "\${sEsc(reportR2Key)}",
    monitoring_agency = "\${sEsc(monitoringAgency)}",
    response_url = "\${sEsc(responseUrl)}",
    snapshot_checksum = "\${sEsc(snapshotChecksum)}",
    metadata_json = "\${sEsc(metadataJson)}",
    created_at = "\${sEsc(createdAt)}",
    synced_at = time::now()\`);

  const snapshot = {
    id: newReportId,
    clientId: client.id,
    source,
    reportDate,
    reportFileName,
    createdAt,
  };`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 8: Replace loadClientProfilesMap() — reads from SurrealDB clients table
// ────────────────────────────────────────────────────────────────────────────
replace('loadClientProfilesMap',
  `const loadClientProfilesMap = async (ownerKey = getCurrentOwnerKey()) => {
  const db = await getReportsDb();
  const normalizedOwner = normalizeOwnerKey(ownerKey);
  const [rows] = await db.query(\`
    SELECT
      client_id AS clientId,
      first_name AS firstName,
      last_name AS lastName,
      email,
      dob,
      ssn,
      address,
      phone,
      spouse_client_id AS spouseClientId,
      spouse_client_label AS spouseClientLabel,
      assigned_to AS assignedTo,
      ninja_assigned AS ninjaAssigned,
      affiliate_assigned AS affiliateAssigned,
      status,
      phase,
      monitoring_agency AS monitoringAgency,
      monitoring_username AS monitoringUsername,
      monitoring_password AS monitoringPassword,
      secret_key AS secretKey,
      monitoring_token AS monitoringToken,
      portal_password AS portalPassword,
      portal_enabled AS portalEnabled,
      language,
      goal,
      notes,`,
  `const loadClientProfilesMap = async (ownerKey = getCurrentOwnerKey()) => {
  const rows = await surql(\`
    SELECT
      client_id AS clientId,
      first_name AS firstName,
      last_name AS lastName,
      email,
      dob,
      ssn,
      address,
      phone,
      spouse_client_id AS spouseClientId,
      spouse_client_label AS spouseClientLabel,
      assigned_to AS assignedTo,
      ninja_assigned AS ninjaAssigned,
      affiliate_assigned AS affiliateAssigned,
      status,
      phase,
      monitoring_agency AS monitoringAgency,
      monitoring_username AS monitoringUsername,
      monitoring_password AS monitoringPassword,
      secret_key AS secretKey,
      monitoring_token AS monitoringToken,
      portal_password AS portalPassword,
      portal_enabled AS portalEnabled,
      language,
      goal,
      notes,`
);

replace('loadClientProfilesMap-tail',
  `      documents_json AS documentsJson,
      report_date AS reportDate
    FROM client_profiles
    WHERE owner_key = ?
  \`, [normalizedOwner]);`,
  `      documents_json AS documentsJson,
      report_date AS reportDate
    FROM clients WHERE source_db = 'ninjatools' LIMIT 20000\`);`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 9: Replace syncClientProfilesToDb() — upserts to SurrealDB clients
// ────────────────────────────────────────────────────────────────────────────
replace('syncClientProfilesToDb',
  `const syncClientProfilesToDb = async (clients = [], ownerKey = getCurrentOwnerKey()) => {
  const db = await getReportsDb();
  const normalizedOwner = normalizeOwnerKey(ownerKey);
  const [existingRows] = await db.query(\`
    SELECT client_id, first_name, last_name, email, ssn
    FROM client_profiles
    WHERE owner_key = ?
  \`, [normalizedOwner]);
  const canonicalBySsn = new Map();
  const canonicalByEmailName = new Map();
  for (const row of existingRows) {
    const rowClientId = String(row.client_id || '').trim();
    const canonicalId = (/^\\d+$/.test(rowClientId) && rowClientId) || '';
    if (!canonicalId) continue;
    const ssnDigits = String(row.ssn || '').replace(/\\D/g, '');
    if (ssnDigits.length >= 9) canonicalBySsn.set(ssnDigits.slice(0, 9), canonicalId);
    const emailNameKey = \`\${String(row.email || '').trim().toLowerCase()}|\${String(row.first_name || '').trim().toLowerCase()}|\${String(row.last_name || '').trim().toLowerCase()}\`;
    if (String(row.email || '').trim()) canonicalByEmailName.set(emailNameKey, canonicalId);
  }
  const upsertSql = \`
    INSERT INTO client_profiles (
      owner_key,
      client_id,`,
  `const syncClientProfilesToDb = async (clients = [], ownerKey = getCurrentOwnerKey()) => {
  // Load existing clients from SurrealDB for SSN/email dedup
  const existingRows = await surql(\`
    SELECT client_id AS clientId, first_name AS firstName, last_name AS lastName, email, ssn
    FROM clients WHERE source_db = 'ninjatools' LIMIT 20000\`);
  const canonicalBySsn = new Map();
  const canonicalByEmailName = new Map();
  for (const row of existingRows) {
    const rowClientId = String(row.clientId || '').trim();
    const canonicalId = (/^\\d+$/.test(rowClientId) && rowClientId) || '';
    if (!canonicalId) continue;
    const ssnDigits = String(row.ssn || '').replace(/\\D/g, '');
    if (ssnDigits.length >= 9) canonicalBySsn.set(ssnDigits.slice(0, 9), canonicalId);
    const emailNameKey = \`\${String(row.email || '').trim().toLowerCase()}|\${String(row.firstName || '').trim().toLowerCase()}|\${String(row.lastName || '').trim().toLowerCase()}\`;
    if (String(row.email || '').trim()) canonicalByEmailName.set(emailNameKey, canonicalId);
  }
  const _UNUSED_upsertSql = \`PLACEHOLDER — replaced by SurrealDB upserts below
    INSERT INTO client_profiles (
      owner_key,
      client_id,`
);

// Replace the rest of syncClientProfilesToDb up to the closing brace
replace('syncClientProfilesToDb-body',
  `    await db.query(upsertSql, [
      normalizedOwner,
      targetClientId,
      ...params,
    ]);
    syncedTargetIdsInPass.add(targetClientId);
  }
};`,
  `    // Upsert to SurrealDB clients table
    const safeId = String(targetClientId).replace(/[^a-zA-Z0-9_]/g, '_');
    const recordId = \`clients:\${safeId}_ninjatools\`;
    const docsJson = JSON.stringify(normalizeClientDocumentsInput(client.documents));
    try {
      await surql(\`UPSERT \${recordId} SET
        client_id = "\${sEsc(targetClientId)}",
        source_db = "ninjatools",
        first_name = "\${sEsc(params[0])}",
        last_name = "\${sEsc(params[1])}",
        email = "\${sEsc(params[2])}",
        dob = "\${sEsc(params[3])}",
        ssn = "\${sEsc(params[4])}",
        address = "\${sEsc(params[5])}",
        phone = "\${sEsc(params[6])}",
        spouse_client_id = "\${sEsc(params[7])}",
        spouse_client_label = "\${sEsc(params[8])}",
        assigned_to = "\${sEsc(params[9])}",
        ninja_assigned = "\${sEsc(params[10])}",
        affiliate_assigned = "\${sEsc(params[11])}",
        status = "\${sEsc(params[12])}",
        phase = "\${sEsc(params[13])}",
        monitoring_agency = "\${sEsc(params[14])}",
        monitoring_username = "\${sEsc(params[15])}",
        monitoring_password = "\${sEsc(params[16])}",
        secret_key = "\${sEsc(params[17])}",
        monitoring_token = "\${sEsc(params[18])}",
        portal_password = "\${sEsc(params[19])}",
        portal_enabled = \${params[20] ? 'true' : 'false'},
        language = "\${sEsc(params[21])}",
        goal = "\${sEsc(params[22])}",
        notes = "\${sEsc(params[23])}",
        yearly_income = "\${sEsc(params[24])}",
        housing_payment = "\${sEsc(params[25])}",
        debt_monthly_payments = "\${sEsc(params[26])}",
        next_import_int = "\${sEsc(params[27])}",
        next_import_label = "\${sEsc(params[28])}",
        next_import_mode = "\${sEsc(params[29])}",
        manual_next_import_start_days = "\${sEsc(params[30])}",
        manual_next_import_set_date = "\${sEsc(params[31])}",
        refresh_next_import_start_date = "\${sEsc(params[32])}",
        documents_json = "\${sEsc(docsJson)}",
        report_date = "\${sEsc(params[34])}",
        updated_at = "\${sEsc(params[35])}",
        synced_at = time::now()\`);
    } catch (e) {
      console.warn(\`[syncClients] failed \${recordId}: \${e.message?.slice(0, 80)}\`);
    }
    syncedTargetIdsInPass.add(targetClientId);
  }
};`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 10: Replace deleteClientProfile()
// ────────────────────────────────────────────────────────────────────────────
replace('deleteClientProfile',
  `const deleteClientProfile = async (clientId, ownerKey = getCurrentOwnerKey()) => {
  const db = await getReportsDb();
  await db.query('DELETE FROM client_profiles WHERE owner_key = ? AND client_id = ?', [normalizeOwnerKey(ownerKey), clientId]);
};`,
  `const deleteClientProfile = async (clientId, ownerKey = getCurrentOwnerKey()) => {
  const safeId = String(clientId).replace(/[^a-zA-Z0-9_]/g, '_');
  await surql(\`DELETE clients:\${safeId}_ninjatools\`);
};`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 11: Replace loadIntegrations() — reads from SurrealDB settings table
// ────────────────────────────────────────────────────────────────────────────
replace('loadIntegrations',
  `const loadIntegrations = async () => {
  const db = await getReportsDb();
  const [rows] = await db.query(\`
    SELECT setting_key AS settingKey, value_json AS valueJson
    FROM app_settings
    WHERE setting_key IN ('integration.smartcredit', 'integration.smartcredit35540', 'integration.smartcredit68951', 'integration.myfreescorenow', 'integration.gohighlevel', 'integration.billing', 'integration.ninjadispute', 'integration.contabo')
  \`);`,
  `const loadIntegrations = async () => {
  const rows = await surql(\`
    SELECT setting_key AS settingKey, value_json AS valueJson FROM settings
    WHERE setting_key IN ["integration.smartcredit","integration.smartcredit35540","integration.smartcredit68951","integration.myfreescorenow","integration.gohighlevel","integration.billing","integration.ninjadispute","integration.contabo"]\`);`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 12: Replace saveIntegration() MySQL write
// ────────────────────────────────────────────────────────────────────────────
replace('saveIntegration-mysql',
  `  const normalized = normalizeIntegrationPayload(payload, normalizedService);
  const db = await getReportsDb();
  await db.query(\`
    INSERT INTO app_settings (setting_key, value_json, updated_at)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      value_json = VALUES(value_json),
      updated_at = VALUES(updated_at)
  \`, [
    \`integration.\${normalizedService}\`,
    JSON.stringify(normalized),
    new Date().toISOString(),
  ]);`,
  `  const normalized = normalizeIntegrationPayload(payload, normalizedService);
  const settingKey = \`integration.\${normalizedService}\`;
  const now = new Date().toISOString();
  await surql(\`UPSERT settings:⟨\${sId(settingKey)}⟩ SET
    setting_key = "\${sEsc(settingKey)}",
    value_json = "\${sEsc(JSON.stringify(normalized))}",
    updated_at = "\${now}"\`);`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 13: Replace mirrorBusinessControlPlaneToS3() queries
// ────────────────────────────────────────────────────────────────────────────
replace('mirrorBusinessControlPlane-queries',
  `  const db = await getReportsDb();
  const normalizedOwner = normalizeOwnerKey(ownerKey);
  const [appUsers] = await db.query(\`
    SELECT username, created_at AS createdAt, updated_at AS updatedAt
    FROM app_users
    ORDER BY username ASC
  \`);
  const [appSettings] = await db.query(\`
    SELECT setting_key AS settingKey, value_json AS valueJson, updated_at AS updatedAt
    FROM app_settings
    ORDER BY setting_key ASC
  \`);
  const [clientProfiles] = await db.query(\`
    SELECT *
    FROM client_profiles
    WHERE owner_key = ?
    ORDER BY client_id ASC
  \`, [normalizedOwner]);`,
  `  const normalizedOwner = normalizeOwnerKey(ownerKey);
  const appUsers = await surql('SELECT username, created_at AS createdAt, updated_at AS updatedAt FROM users ORDER BY username ASC');
  const appSettings = await surql('SELECT setting_key AS settingKey, value_json AS valueJson, updated_at AS updatedAt FROM settings ORDER BY setting_key ASC');
  const clientProfiles = await surql('SELECT * FROM clients WHERE source_db = "ninjatools" ORDER BY client_id ASC LIMIT 20000');`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 14: Replace loadAffiliateLinks()
// ────────────────────────────────────────────────────────────────────────────
replace('loadAffiliateLinks-query',
  `  const [rows] = await db.query(\`
    SELECT setting_key AS settingKey, value_json AS valueJson
    FROM app_settings
    WHERE setting_key IN ('affiliate.creditBuilder', 'affiliate.creditMonitoring')
  \`);`,
  `  const rows = await surql('SELECT setting_key AS settingKey, value_json AS valueJson FROM settings WHERE setting_key IN ["affiliate.creditBuilder","affiliate.creditMonitoring"]');`
);

// Remove the now-unused `const db = await getReportsDb();` in loadAffiliateLinks
replace('loadAffiliateLinks-db',
  `const loadAffiliateLinks = async () => {
  const db = await getReportsDb();
  const [rows] = await db.query(\`
    SELECT setting_key AS settingKey, value_json AS valueJson
    FROM app_settings
    WHERE setting_key IN ('affiliate.creditBuilder', 'affiliate.creditMonitoring')
  \`);`,
  `const loadAffiliateLinks = async () => {
  const rows = await surql('SELECT setting_key AS settingKey, value_json AS valueJson FROM settings WHERE setting_key IN ["affiliate.creditBuilder","affiliate.creditMonitoring"]');`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 15: Replace loadPaymentConfig()
// ────────────────────────────────────────────────────────────────────────────
replace('loadPaymentConfig',
  `const loadPaymentConfig = async (ownerKey) => {
  const db = await getReportsDb();
  const key = getPaymentConfigKey(ownerKey);
  const [rows] = await db.query('SELECT value_json AS valueJson FROM app_settings WHERE setting_key = ?', [key]);
  const row = rows?.[0] || null;`,
  `const loadPaymentConfig = async (ownerKey) => {
  const key = getPaymentConfigKey(ownerKey);
  const rows = await surql(\`SELECT value_json AS valueJson FROM settings WHERE setting_key = "\${sEsc(key)}" LIMIT 1\`);
  const row = rows?.[0] || null;`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 16: Replace savePaymentConfig()
// ────────────────────────────────────────────────────────────────────────────
replace('savePaymentConfig-mysql',
  `  await db.query(\`
    INSERT INTO app_settings (setting_key, value_json, updated_at)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      value_json = VALUES(value_json),
      updated_at = VALUES(updated_at)
  \`, [key, JSON.stringify(next), now]);`,
  `  await surql(\`UPSERT settings:⟨\${sId(key)}⟩ SET
    setting_key = "\${sEsc(key)}",
    value_json = "\${sEsc(JSON.stringify(next))}",
    updated_at = "\${now}"\`);`
);

replace('savePaymentConfig-db',
  `const savePaymentConfig = async (ownerKey, payload = {}) => {
  const db = await getReportsDb();
  const key = getPaymentConfigKey(ownerKey);`,
  `const savePaymentConfig = async (ownerKey, payload = {}) => {
  const key = getPaymentConfigKey(ownerKey);`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 17: Replace formatMerchantRow — use extractSurrealId for id
// ────────────────────────────────────────────────────────────────────────────
replace('formatMerchantRow-id',
  `const formatMerchantRow = (row = {}) => ({
  id: Number(row.id),`,
  `const formatMerchantRow = (row = {}) => ({
  id: extractSurrealId(row.id),`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 18: Replace listPaymentMerchants()
// ────────────────────────────────────────────────────────────────────────────
replace('listPaymentMerchants',
  `const listPaymentMerchants = async (ownerKey) => {
  const db = await getReportsDb();
  const [rows] = await db.query(\`
    SELECT *
    FROM payment_merchants
    WHERE owner_key = ?
    ORDER BY is_default DESC, merchant_name ASC
  \`, [ownerKey]);
  return rows.map(formatMerchantRow);
};`,
  `const listPaymentMerchants = async (ownerKey) => {
  const rows = await surql(\`SELECT * FROM merchants WHERE owner_key = "admin" ORDER BY is_default DESC, merchant_name ASC\`);
  return rows.map(formatMerchantRow);
};`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 19: Replace createPaymentMerchant()
// ────────────────────────────────────────────────────────────────────────────
replace('createPaymentMerchant',
  `const createPaymentMerchant = async (ownerKey, payload = {}) => {
  const db = await getReportsDb();
  const now = new Date().toISOString();
  const merchantName = String(payload.merchantName || '').trim();
  if (!merchantName) {
    throw new Error('Merchant name is required.');
  }
  const gateway = String(payload.gateway || '').trim();
  if (!gateway) {
    throw new Error('Gateway is required.');
  }
  const isDefault = payload.isDefault === true || payload.isDefault === 'true';
  if (isDefault) {
    await db.query('UPDATE payment_merchants SET is_default = 0, updated_at = ? WHERE owner_key = ?', [now, ownerKey]);
  }
  const [result] = await db.query(\`
    INSERT INTO payment_merchants (
      owner_key, merchant_name, gateway, api_id, transaction_key, is_default,
      status, allowed_retries, retry_frequency_days, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  \`, [
    ownerKey,
    merchantName,
    gateway,
    String(payload.apiId || '').trim(),
    String(payload.transactionKey || '').trim(),
    isDefault ? 1 : 0,
    normalizePaymentStatus(payload.status, 'Active'),
    clampInteger(payload.allowedRetries, 3, 0, 999),
    clampInteger(payload.retryFrequencyDays, 7, 1, 365),
    JSON.stringify(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
    now,
    now,
  ]);
  const [rows] = await db.query('SELECT * FROM payment_merchants WHERE id = ? AND owner_key = ?', [result.insertId, ownerKey]);
  const row = rows?.[0] || null;
  return formatMerchantRow(row);
};`,
  `const createPaymentMerchant = async (ownerKey, payload = {}) => {
  const now = new Date().toISOString();
  const merchantName = String(payload.merchantName || '').trim();
  if (!merchantName) throw new Error('Merchant name is required.');
  const gateway = String(payload.gateway || '').trim();
  if (!gateway) throw new Error('Gateway is required.');
  const isDefault = payload.isDefault === true || payload.isDefault === 'true';
  if (isDefault) {
    await surql(\`UPDATE merchants SET is_default = false, updated_at = "\${now}" WHERE owner_key = "admin"\`);
  }
  const newId = randomUUID().replace(/-/g, '');
  const mdata = JSON.stringify(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {});
  await surql(\`CREATE merchants:⟨\${newId}⟩ SET
    owner_key = "admin",
    merchant_name = "\${sEsc(merchantName)}",
    gateway = "\${sEsc(gateway)}",
    api_id = "\${sEsc(String(payload.apiId || '').trim())}",
    transaction_key = "\${sEsc(String(payload.transactionKey || '').trim())}",
    is_default = \${isDefault},
    status = "\${sEsc(normalizePaymentStatus(payload.status, 'Active'))}",
    allowed_retries = \${clampInteger(payload.allowedRetries, 3, 0, 999)},
    retry_frequency_days = \${clampInteger(payload.retryFrequencyDays, 7, 1, 365)},
    metadata_json = "\${sEsc(mdata)}",
    created_at = "\${now}",
    updated_at = "\${now}"\`);
  const rows = await surql(\`SELECT * FROM merchants:⟨\${newId}⟩\`);
  return formatMerchantRow(rows?.[0] || null);
};`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 20: Replace updatePaymentMerchant()
// ────────────────────────────────────────────────────────────────────────────
replace('updatePaymentMerchant',
  `const updatePaymentMerchant = async (ownerKey, merchantId, payload = {}) => {
  const db = await getReportsDb();
  const [existingRows] = await db.query('SELECT * FROM payment_merchants WHERE id = ? AND owner_key = ?', [merchantId, ownerKey]);
  const row = existingRows?.[0] || null;
  if (!row) {
    throw new Error('Merchant not found.');
  }
  const now = new Date().toISOString();
  const merchantName = String(payload.merchantName ?? row.merchant_name ?? '').trim();
  if (!merchantName) {
    throw new Error('Merchant name is required.');
  }
  const gateway = String(payload.gateway ?? row.gateway ?? '').trim();
  if (!gateway) {
    throw new Error('Gateway is required.');
  }
  const nextIsDefault = payload.isDefault === undefined
    ? Number(row.is_default || 0) === 1
    : payload.isDefault === true || payload.isDefault === 'true';
  if (nextIsDefault) {
    await db.query('UPDATE payment_merchants SET is_default = 0, updated_at = ? WHERE owner_key = ?', [now, ownerKey]);
  }
  await db.query(\`
    UPDATE payment_merchants
    SET merchant_name = ?,
        gateway = ?,
        api_id = ?,
        transaction_key = ?,
        is_default = ?,
        status = ?,
        allowed_retries = ?,
        retry_frequency_days = ?,
        metadata_json = ?,
        updated_at = ?
    WHERE id = ? AND owner_key = ?
  \`, [
    merchantName,
    gateway,
    String(payload.apiId ?? row.api_id ?? '').trim(),
    String(payload.transactionKey ?? row.transaction_key ?? '').trim(),
    nextIsDefault ? 1 : 0,
    normalizePaymentStatus(payload.status ?? row.status, 'Active'),
    clampInteger(payload.allowedRetries ?? row.allowed_retries, 3, 0, 999),
    clampInteger(payload.retryFrequencyDays ?? row.retry_frequency_days, 7, 1, 365),
    JSON.stringify(payload.metadata && typeof payload.metadata === 'object'
      ? payload.metadata
      : parseJsonField(row.metadata_json, {})),
    now,
    merchantId,
    ownerKey,
  ]);
  const [updatedRows] = await db.query('SELECT * FROM payment_merchants WHERE id = ? AND owner_key = ?', [merchantId, ownerKey]);
  const updated = updatedRows?.[0] || null;
  return formatMerchantRow(updated);
};`,
  `const updatePaymentMerchant = async (ownerKey, merchantId, payload = {}) => {
  const safeId = sId(String(merchantId));
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
  return formatMerchantRow(updatedRows?.[0] || null);
};`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 21: Replace deletePaymentMerchant()
// ────────────────────────────────────────────────────────────────────────────
replace('deletePaymentMerchant',
  `const deletePaymentMerchant = async (ownerKey, merchantId) => {
  const db = await getReportsDb();
  await db.query('UPDATE payment_autopay SET merchant_id = NULL, updated_at = ? WHERE owner_key = ? AND merchant_id = ?',
    [new Date().toISOString(), ownerKey, merchantId]);
  const [result] = await db.query('DELETE FROM payment_merchants WHERE id = ? AND owner_key = ?', [merchantId, ownerKey]);
  return Number(result?.affectedRows || 0) > 0;
};`,
  `const deletePaymentMerchant = async (ownerKey, merchantId) => {
  const safeId = sId(String(merchantId));
  const now = new Date().toISOString();
  await surql(\`UPDATE autopay SET merchant_id = NONE, updated_at = "\${now}" WHERE merchant_id = "merchants:\${safeId}"\`);
  await surql(\`DELETE merchants:⟨\${safeId}⟩\`);
  return true;
};`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 22: Replace formatProductRow id
// ────────────────────────────────────────────────────────────────────────────
replace('formatProductRow-id',
  `const formatProductRow = (row = {}) => ({
  id: Number(row.id),`,
  `const formatProductRow = (row = {}) => ({
  id: extractSurrealId(row.id),`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 23: Replace listPaymentProducts()
// ────────────────────────────────────────────────────────────────────────────
replace('listPaymentProducts',
  `const listPaymentProducts = async (ownerKey) => {
  const db = await getReportsDb();
  const [rows] = await db.query(\`
    SELECT *
    FROM payment_products
    WHERE owner_key = ?
    ORDER BY product_name ASC
  \`, [ownerKey]);
  return rows.map(formatProductRow);
};`,
  `const listPaymentProducts = async (ownerKey) => {
  const rows = await surql('SELECT * FROM products WHERE owner_key = "admin" ORDER BY product_name ASC');
  return rows.map(formatProductRow);
};`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 24: Replace createPaymentProduct()
// ────────────────────────────────────────────────────────────────────────────
replace('createPaymentProduct',
  `const createPaymentProduct = async (ownerKey, payload = {}) => {
  const db = await getReportsDb();
  const now = new Date().toISOString();
  const productName = String(payload.productName || '').trim();
  if (!productName) {
    throw new Error('Product name is required.');
  }
  const [result] = await db.query(\`
    INSERT INTO payment_products (
      owner_key, product_name, product_type, price_cents, billing_frequency,
      status, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  \`, [
    ownerKey,
    productName,
    String(payload.productType || 'Service').trim() || 'Service',
    parseMoneyToCents(payload.price, 0),
    normalizeFrequencyType(payload.billingFrequency, 'monthly'),
    normalizePaymentStatus(payload.status, 'Active'),
    JSON.stringify(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
    now,
    now,
  ]);
  const [rows] = await db.query('SELECT * FROM payment_products WHERE id = ? AND owner_key = ?', [result.insertId, ownerKey]);
  const row = rows?.[0] || null;
  return formatProductRow(row);
};`,
  `const createPaymentProduct = async (ownerKey, payload = {}) => {
  const now = new Date().toISOString();
  const productName = String(payload.productName || '').trim();
  if (!productName) throw new Error('Product name is required.');
  const newId = randomUUID().replace(/-/g, '');
  const mdata = JSON.stringify(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {});
  await surql(\`CREATE products:⟨\${newId}⟩ SET
    owner_key = "admin",
    product_name = "\${sEsc(productName)}",
    product_type = "\${sEsc(String(payload.productType || 'Service').trim() || 'Service')}",
    price_cents = \${parseMoneyToCents(payload.price, 0)},
    billing_frequency = "\${sEsc(normalizeFrequencyType(payload.billingFrequency, 'monthly'))}",
    status = "\${sEsc(normalizePaymentStatus(payload.status, 'Active'))}",
    metadata_json = "\${sEsc(mdata)}",
    created_at = "\${now}",
    updated_at = "\${now}"\`);
  const rows = await surql(\`SELECT * FROM products:⟨\${newId}⟩\`);
  return formatProductRow(rows?.[0] || null);
};`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 25: Replace updatePaymentProduct()
// ────────────────────────────────────────────────────────────────────────────
replace('updatePaymentProduct',
  `const updatePaymentProduct = async (ownerKey, productId, payload = {}) => {
  const db = await getReportsDb();
  const [existingRows] = await db.query('SELECT * FROM payment_products WHERE id = ? AND owner_key = ?', [productId, ownerKey]);
  const row = existingRows?.[0] || null;
  if (!row) {
    throw new Error('Product not found.');
  }
  const now = new Date().toISOString();
  const productName = String(payload.productName ?? row.product_name ?? '').trim();
  if (!productName) {
    throw new Error('Product name is required.');
  }
  await db.query(\`
    UPDATE payment_products
    SET product_name = ?,
        product_type = ?,
        price_cents = ?,
        billing_frequency = ?,
        status = ?,
        metadata_json = ?,
        updated_at = ?
    WHERE id = ? AND owner_key = ?
  \`, [
    productName,
    String(payload.productType ?? row.product_type ?? 'Service').trim() || 'Service',
    payload.price !== undefined ? parseMoneyToCents(payload.price, Number(row.price_cents || 0)) : Number(row.price_cents || 0),
    normalizeFrequencyType(payload.billingFrequency ?? row.billing_frequency, 'monthly'),
    normalizePaymentStatus(payload.status ?? row.status, 'Active'),
    JSON.stringify(payload.metadata && typeof payload.metadata === 'object'
      ? payload.metadata
      : parseJsonField(row.metadata_json, {})),
    now,
    productId,
    ownerKey,
  ]);
  const [updatedRows] = await db.query('SELECT * FROM payment_products WHERE id = ? AND owner_key = ?', [productId, ownerKey]);
  const updated = updatedRows?.[0] || null;
  return formatProductRow(updated);
};`,
  `const updatePaymentProduct = async (ownerKey, productId, payload = {}) => {
  const safeId = sId(String(productId));
  const existingRows = await surql(\`SELECT * FROM products:⟨\${safeId}⟩\`);
  const row = existingRows?.[0] || null;
  if (!row) throw new Error('Product not found.');
  const now = new Date().toISOString();
  const productName = String(payload.productName ?? row.product_name ?? '').trim();
  if (!productName) throw new Error('Product name is required.');
  const mdata = JSON.stringify(payload.metadata && typeof payload.metadata === 'object'
    ? payload.metadata : parseJsonField(row.metadata_json, {}));
  const priceCents = payload.price !== undefined
    ? parseMoneyToCents(payload.price, Number(row.price_cents || 0))
    : Number(row.price_cents || 0);
  await surql(\`UPDATE products:⟨\${safeId}⟩ SET
    product_name = "\${sEsc(productName)}",
    product_type = "\${sEsc(String(payload.productType ?? row.product_type ?? 'Service').trim() || 'Service')}",
    price_cents = \${priceCents},
    billing_frequency = "\${sEsc(normalizeFrequencyType(payload.billingFrequency ?? row.billing_frequency, 'monthly'))}",
    status = "\${sEsc(normalizePaymentStatus(payload.status ?? row.status, 'Active'))}",
    metadata_json = "\${sEsc(mdata)}",
    updated_at = "\${now}"\`);
  const updatedRows = await surql(\`SELECT * FROM products:⟨\${safeId}⟩\`);
  return formatProductRow(updatedRows?.[0] || null);
};`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 26: Replace deletePaymentProduct()
// ────────────────────────────────────────────────────────────────────────────
replace('deletePaymentProduct',
  `const deletePaymentProduct = async (ownerKey, productId) => {
  const db = await getReportsDb();
  await db.query('UPDATE payment_autopay SET product_id = NULL, updated_at = ? WHERE owner_key = ? AND product_id = ?',
    [new Date().toISOString(), ownerKey, productId]);
  const [result] = await db.query('DELETE FROM payment_products WHERE id = ? AND owner_key = ?', [productId, ownerKey]);
  return Number(result?.affectedRows || 0) > 0;
};`,
  `const deletePaymentProduct = async (ownerKey, productId) => {
  const safeId = sId(String(productId));
  const now = new Date().toISOString();
  await surql(\`UPDATE autopay SET product_id = NONE, updated_at = "\${now}" WHERE product_id = "products:\${safeId}"\`);
  await surql(\`DELETE products:⟨\${safeId}⟩\`);
  return true;
};`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 27: Replace formatAutopayRow — use extractSurrealId
// ────────────────────────────────────────────────────────────────────────────
replace('formatAutopayRow-ids',
  `  id: Number(row.id),
  clientId: String(row.client_id || '').trim(),
  merchantId: row.merchant_id === null || row.merchant_id === undefined ? null : Number(row.merchant_id),
  productId: row.product_id === null || row.product_id === undefined ? null : Number(row.product_id),`,
  `  id: extractSurrealId(row.id),
  clientId: String(row.client_id || '').trim(),
  merchantId: row.merchant_id == null ? null : extractSurrealId(row.merchant_id),
  productId: row.product_id == null ? null : extractSurrealId(row.product_id),`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 28: Replace listPaymentAutopay()
// ────────────────────────────────────────────────────────────────────────────
replace('listPaymentAutopay',
  `const listPaymentAutopay = async (ownerKey) => {
  const db = await getReportsDb();
  const [rows] = await db.query(\`
    SELECT *
    FROM payment_autopay
    WHERE owner_key = ?
    ORDER BY
      CASE WHEN next_charge_at IS NULL OR next_charge_at = '' THEN 1 ELSE 0 END ASC,
      next_charge_at ASC,
      id DESC
  \`, [ownerKey]);
  return rows.map(formatAutopayRow);
};`,
  `const listPaymentAutopay = async (ownerKey) => {
  // SurrealDB: sort nulls last by ordering on next_charge_at (empty string sorts before non-empty)
  const rows = await surql('SELECT * FROM autopay WHERE owner_key = "admin" ORDER BY next_charge_at ASC');
  return rows.map(formatAutopayRow);
};`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 29: Replace createPaymentAutopay()
// ────────────────────────────────────────────────────────────────────────────
replace('createPaymentAutopay',
  `const createPaymentAutopay = async (ownerKey, payload = {}) => {
  const db = await getReportsDb();
  const now = new Date().toISOString();
  const [result] = await db.query(\`
    INSERT INTO payment_autopay (
      owner_key, client_id, merchant_id, product_id, amount_cents, frequency_type,
      frequency_interval, next_charge_at, status, retry_limit, retry_frequency_days,
      failure_count, last_error, last_charge_at, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  \`, [
    ownerKey,
    String(payload.clientId || '').trim(),
    payload.merchantId ? Number(payload.merchantId) : null,
    payload.productId ? Number(payload.productId) : null,
    parseMoneyToCents(payload.amount, 0),
    normalizeFrequencyType(payload.frequencyType, 'monthly'),
    clampInteger(payload.frequencyInterval, 1, 1, 365),
    normalizeNextChargeAt(payload.nextChargeAt),
    normalizePaymentStatus(payload.status, 'Active'),
    clampInteger(payload.retryLimit, 3, 0, 999),
    clampInteger(payload.retryFrequencyDays, 7, 1, 365),
    clampInteger(payload.failureCount, 0, 0, 999999),
    String(payload.lastError || '').trim(),
    normalizeNextChargeAt(payload.lastChargeAt),
    JSON.stringify(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
    now,
    now,
  ]);
  const [rows] = await db.query('SELECT * FROM payment_autopay WHERE id = ? AND owner_key = ?', [result.insertId, ownerKey]);
  const row = rows?.[0] || null;
  return formatAutopayRow(row);
};`,
  `const createPaymentAutopay = async (ownerKey, payload = {}) => {
  const now = new Date().toISOString();
  const newId = randomUUID().replace(/-/g, '');
  const mdata = JSON.stringify(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {});
  const midRef = payload.merchantId ? \`"merchants:\${sId(String(payload.merchantId))}"\` : 'NONE';
  const pidRef = payload.productId ? \`"products:\${sId(String(payload.productId))}"\` : 'NONE';
  await surql(\`CREATE autopay:⟨\${newId}⟩ SET
    owner_key = "admin",
    client_id = "\${sEsc(String(payload.clientId || '').trim())}",
    merchant_id = \${midRef},
    product_id = \${pidRef},
    amount_cents = \${parseMoneyToCents(payload.amount, 0)},
    frequency_type = "\${sEsc(normalizeFrequencyType(payload.frequencyType, 'monthly'))}",
    frequency_interval = \${clampInteger(payload.frequencyInterval, 1, 1, 365)},
    next_charge_at = "\${sEsc(normalizeNextChargeAt(payload.nextChargeAt))}",
    status = "\${sEsc(normalizePaymentStatus(payload.status, 'Active'))}",
    retry_limit = \${clampInteger(payload.retryLimit, 3, 0, 999)},
    retry_frequency_days = \${clampInteger(payload.retryFrequencyDays, 7, 1, 365)},
    failure_count = \${clampInteger(payload.failureCount, 0, 0, 999999)},
    last_error = "\${sEsc(String(payload.lastError || '').trim())}",
    last_charge_at = "\${sEsc(normalizeNextChargeAt(payload.lastChargeAt))}",
    metadata_json = "\${sEsc(mdata)}",
    created_at = "\${now}",
    updated_at = "\${now}"\`);
  const rows = await surql(\`SELECT * FROM autopay:⟨\${newId}⟩\`);
  return formatAutopayRow(rows?.[0] || null);
};`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 30: Replace updatePaymentAutopay()
// ────────────────────────────────────────────────────────────────────────────
replace('updatePaymentAutopay',
  `const updatePaymentAutopay = async (ownerKey, autopayId, payload = {}) => {
  const db = await getReportsDb();
  const [existingRows] = await db.query('SELECT * FROM payment_autopay WHERE id = ? AND owner_key = ?', [autopayId, ownerKey]);
  const row = existingRows?.[0] || null;
  if (!row) {
    throw new Error('Autopay row not found.');
  }`,
  `const updatePaymentAutopay = async (ownerKey, autopayId, payload = {}) => {
  const safeId = sId(String(autopayId));
  const existingRows = await surql(\`SELECT * FROM autopay:⟨\${safeId}⟩\`);
  const row = existingRows?.[0] || null;
  if (!row) {
    throw new Error('Autopay row not found.');
  }`
);

replace('updatePaymentAutopay-query',
  `  await db.query(\`
    UPDATE payment_autopay
    SET client_id = ?,
        merchant_id = ?,
        product_id = ?,
        amount_cents = ?,
        frequency_type = ?,
        frequency_interval = ?,
        next_charge_at = ?,
        status = ?,
        retry_limit = ?,
        retry_frequency_days = ?,
        failure_count = ?,
        last_error = ?,
        last_charge_at = ?,
        metadata_json = ?,
        updated_at = ?
    WHERE id = ? AND owner_key = ?
  \`, [
    String(payload.clientId ?? row.client_id ?? '').trim(),
    payload.merchantId !== undefined ? (payload.merchantId ? Number(payload.merchantId) : null) : row.merchant_id,
    payload.productId !== undefined ? (payload.productId ? Number(payload.productId) : null) : row.product_id,
    payload.amount !== undefined ? parseMoneyToCents(payload.amount, Number(row.amount_cents || 0)) : Number(row.amount_cents || 0),
    normalizeFrequencyType(payload.frequencyType ?? row.frequency_type, 'monthly'),
    clampInteger(payload.frequencyInterval ?? row.frequency_interval, 1, 1, 365),
    payload.nextChargeAt !== undefined ? normalizeNextChargeAt(payload.nextChargeAt) : String(row.next_charge_at || ''),
    normalizePaymentStatus(payload.status ?? row.status, 'Active'),
    clampInteger(payload.retryLimit ?? row.retry_limit, 3, 0, 999),
    clampInteger(payload.retryFrequencyDays ?? row.retry_frequency_days, 7, 1, 365),
    clampInteger(payload.failureCount ?? row.failure_count, 0, 0, 999999),
    String(payload.lastError ?? row.last_error ?? '').trim(),
    payload.lastChargeAt !== undefined ? normalizeNextChargeAt(payload.lastChargeAt) : String(row.last_charge_at || ''),
    JSON.stringify(payload.metadata && typeof payload.metadata === 'object'
      ? payload.metadata
      : parseJsonField(row.metadata_json, {})),
    now,
    autopayId,
    ownerKey,
  ]);
  const [updatedRows] = await db.query('SELECT * FROM payment_autopay WHERE id = ? AND owner_key = ?', [autopayId, ownerKey]);
  const updated = updatedRows?.[0] || null;
  return formatAutopayRow(updated);
};`,
  `  const midRef = payload.merchantId !== undefined
    ? (payload.merchantId ? \`"merchants:\${sId(String(payload.merchantId))}"\` : 'NONE')
    : (row.merchant_id != null ? \`"\${sEsc(String(row.merchant_id))}"\` : 'NONE');
  const pidRef = payload.productId !== undefined
    ? (payload.productId ? \`"products:\${sId(String(payload.productId))}"\` : 'NONE')
    : (row.product_id != null ? \`"\${sEsc(String(row.product_id))}"\` : 'NONE');
  const priceCents = payload.amount !== undefined
    ? parseMoneyToCents(payload.amount, Number(row.amount_cents || 0))
    : Number(row.amount_cents || 0);
  const mdata = JSON.stringify(payload.metadata && typeof payload.metadata === 'object'
    ? payload.metadata : parseJsonField(row.metadata_json, {}));
  await surql(\`UPDATE autopay:⟨\${safeId}⟩ SET
    client_id = "\${sEsc(String(payload.clientId ?? row.client_id ?? '').trim())}",
    merchant_id = \${midRef},
    product_id = \${pidRef},
    amount_cents = \${priceCents},
    frequency_type = "\${sEsc(normalizeFrequencyType(payload.frequencyType ?? row.frequency_type, 'monthly'))}",
    frequency_interval = \${clampInteger(payload.frequencyInterval ?? row.frequency_interval, 1, 1, 365)},
    next_charge_at = "\${sEsc(payload.nextChargeAt !== undefined ? normalizeNextChargeAt(payload.nextChargeAt) : String(row.next_charge_at || ''))}",
    status = "\${sEsc(normalizePaymentStatus(payload.status ?? row.status, 'Active'))}",
    retry_limit = \${clampInteger(payload.retryLimit ?? row.retry_limit, 3, 0, 999)},
    retry_frequency_days = \${clampInteger(payload.retryFrequencyDays ?? row.retry_frequency_days, 7, 1, 365)},
    failure_count = \${clampInteger(payload.failureCount ?? row.failure_count, 0, 0, 999999)},
    last_error = "\${sEsc(String(payload.lastError ?? row.last_error ?? '').trim())}",
    last_charge_at = "\${sEsc(payload.lastChargeAt !== undefined ? normalizeNextChargeAt(payload.lastChargeAt) : String(row.last_charge_at || ''))}",
    metadata_json = "\${sEsc(mdata)}",
    updated_at = "\${now}"\`);
  const updatedRows = await surql(\`SELECT * FROM autopay:⟨\${safeId}⟩\`);
  return formatAutopayRow(updatedRows?.[0] || null);
};`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 31: Replace deletePaymentAutopay()
// ────────────────────────────────────────────────────────────────────────────
replace('deletePaymentAutopay',
  `const deletePaymentAutopay = async (ownerKey, autopayId) => {
  const db = await getReportsDb();
  const [result] = await db.query('DELETE FROM payment_autopay WHERE id = ? AND owner_key = ?', [autopayId, ownerKey]);
  return Number(result?.affectedRows || 0) > 0;
};`,
  `const deletePaymentAutopay = async (ownerKey, autopayId) => {
  const safeId = sId(String(autopayId));
  await surql(\`DELETE autopay:⟨\${safeId}⟩\`);
  return true;
};`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 32: Replace formatFailedPaymentEventRow — use extractSurrealId
// ────────────────────────────────────────────────────────────────────────────
replace('formatFailedPaymentEventRow-id',
  `  id: Number(row.id || 0),`,
  `  id: extractSurrealId(row.id),`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 33: Replace calculateFailedPaymentOccurrenceCount()
// ────────────────────────────────────────────────────────────────────────────
replace('calculateFailedPaymentOccurrenceCount',
  `const calculateFailedPaymentOccurrenceCount = async (db, ownerKey, row = {}) => {
  const baseSql = 'SELECT COUNT(*) AS total FROM failed_payment_events WHERE owner_key = ?';
  const id = Number(row.id || 0);
  const email = String(row.email || '').trim();
  const customerId = String(row.customer_id || '').trim();
  const name = normalizeFailedPaymentName(row.client_name || '');

  if (email) {
    const [rows] = await db.query(\`\${baseSql} AND id != ? AND LOWER(COALESCE(email, '')) = LOWER(?)\`, [ownerKey, id, email]);
    return Number(rows?.[0]?.total || 0) + 1;
  }
  if (customerId) {
    const [rows] = await db.query(\`\${baseSql} AND id != ? AND customer_id = ?\`, [ownerKey, id, customerId]);
    return Number(rows?.[0]?.total || 0) + 1;
  }
  if (name) {
    const [rows] = await db.query(\`\${baseSql} AND id != ? AND LOWER(COALESCE(client_name, '')) = LOWER(?)\`, [ownerKey, id, name]);
    return Number(rows?.[0]?.total || 0) + 1;
  }
  return 1;
};`,
  `const calculateFailedPaymentOccurrenceCount = async (_db, ownerKey, row = {}) => {
  const recordId = String(row.id || '');
  const email = String(row.email || '').trim().toLowerCase();
  const customerId = String(row.customer_id || '').trim();
  const name = normalizeFailedPaymentName(row.client_name || '').toLowerCase();

  if (email) {
    const res = await surql(\`SELECT COUNT() AS total FROM payment_events WHERE owner_key = "admin" AND id != \${recordId || 'NONE'} AND string::lowercase(email ?? '') = "\${sEsc(email)}" GROUP ALL\`);
    return Number(res?.[0]?.total || 0) + 1;
  }
  if (customerId) {
    const res = await surql(\`SELECT COUNT() AS total FROM payment_events WHERE owner_key = "admin" AND id != \${recordId || 'NONE'} AND customer_id = "\${sEsc(customerId)}" GROUP ALL\`);
    return Number(res?.[0]?.total || 0) + 1;
  }
  if (name) {
    const res = await surql(\`SELECT COUNT() AS total FROM payment_events WHERE owner_key = "admin" AND id != \${recordId || 'NONE'} AND string::lowercase(client_name ?? '') = "\${sEsc(name)}" GROUP ALL\`);
    return Number(res?.[0]?.total || 0) + 1;
  }
  return 1;
};`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 34: Replace upsertFailedPaymentEvent()
// ────────────────────────────────────────────────────────────────────────────
replace('upsertFailedPaymentEvent',
  `const upsertFailedPaymentEvent = async (ownerKey, event = {}) => {
  const normalizedOwnerKey = normalizeOwnerKey(ownerKey);
  const db = await getReportsDb();
  const next = normalizeFailedPaymentEventInput(event);
  if (!next.transactionId) {
    return { upserted: false, reason: 'missing-transaction-id', row: null };
  }

  await db.query(\`
    INSERT INTO failed_payment_events (
      owner_key, transaction_id, event_at, client_name, email, phone, amount_cents, card_last4,
      payment_method, failure_reason, retry_label, notes, status, next_action, completed,
      processor, customer_id, retry_eligible, occurrence_count, raw_json,
      webhook_synced_at, webhook_last_status, created_at, updated_at, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      event_at = VALUES(event_at),
      client_name = VALUES(client_name),
      email = VALUES(email),
      phone = VALUES(phone),
      amount_cents = VALUES(amount_cents),
      card_last4 = VALUES(card_last4),
      payment_method = VALUES(payment_method),
      failure_reason = VALUES(failure_reason),
      retry_label = VALUES(retry_label),
      notes = VALUES(notes),
      status = VALUES(status),
      next_action = VALUES(next_action),
      completed = VALUES(completed),
      processor = VALUES(processor),
      customer_id = VALUES(customer_id),
      retry_eligible = VALUES(retry_eligible),
      raw_json = VALUES(raw_json),
      updated_at = VALUES(updated_at),
      last_seen_at = VALUES(last_seen_at)
  \`, [
    normalizedOwnerKey,
    next.transactionId,
    next.eventAt,
    next.clientName,
    next.email,
    next.phone,
    next.amountCents,
    next.cardLast4,
    next.paymentMethod,
    next.failureReason,
    next.retryLabel,
    next.notes,
    next.status,
    next.nextAction,
    next.completed,
    next.processor,
    next.customerId,
    next.retryEligible ? 1 : 0,
    1,
    JSON.stringify(next.rawJson),
    next.createdAt,
    next.updatedAt,
    next.lastSeenAt,
  ]);

  const [rows] = await db.query(\`
    SELECT *
    FROM failed_payment_events
    WHERE owner_key = ? AND transaction_id = ?
  \`, [normalizedOwnerKey, next.transactionId]);
  const row = rows?.[0] || null;

  if (!row) {
    return { upserted: false, reason: 'not-found-after-upsert', row: null };
  }

  const occurrenceCount = await calculateFailedPaymentOccurrenceCount(db, normalizedOwnerKey, row);
  const statusLabel = toFailedStatusLabel(occurrenceCount);
  await db.query(\`
    UPDATE failed_payment_events
    SET occurrence_count = ?, status = ?, retry_eligible = ?, next_action = ?, updated_at = ?
    WHERE id = ?
  \`, [
    occurrenceCount,
    statusLabel,
    next.retryEligible ? 1 : 0,
    next.nextAction,
    new Date().toISOString(),
    row.id,
  ]);

  const [updatedRows] = await db.query('SELECT * FROM failed_payment_events WHERE id = ?', [row.id]);
  const updatedRow = updatedRows?.[0] || null;
  return { upserted: true, reason: 'ok', row: formatFailedPaymentEventRow(updatedRow) };
};`,
  `const upsertFailedPaymentEvent = async (ownerKey, event = {}) => {
  const next = normalizeFailedPaymentEventInput(event);
  if (!next.transactionId) return { upserted: false, reason: 'missing-transaction-id', row: null };

  const safeTxId = String(next.transactionId).replace(/[^a-zA-Z0-9_]/g, '_');
  const recordId = \`payment_events:⟨admin_\${safeTxId}⟩\`;

  await surql(\`UPSERT \${recordId} SET
    owner_key = "admin",
    transaction_id = "\${sEsc(next.transactionId)}",
    event_at = "\${sEsc(next.eventAt)}",
    client_name = "\${sEsc(next.clientName)}",
    email = "\${sEsc(next.email)}",
    phone = "\${sEsc(next.phone)}",
    amount_cents = \${next.amountCents},
    card_last4 = "\${sEsc(next.cardLast4)}",
    payment_method = "\${sEsc(next.paymentMethod)}",
    failure_reason = "\${sEsc(next.failureReason)}",
    retry_label = "\${sEsc(next.retryLabel)}",
    notes = "\${sEsc(next.notes)}",
    status = "\${sEsc(next.status)}",
    next_action = "\${sEsc(next.nextAction)}",
    completed = "\${sEsc(next.completed)}",
    processor = "\${sEsc(next.processor)}",
    customer_id = "\${sEsc(next.customerId)}",
    retry_eligible = \${next.retryEligible ? 'true' : 'false'},
    occurrence_count = 1,
    raw_json = "\${sEsc(JSON.stringify(next.rawJson))}",
    created_at = "\${sEsc(next.createdAt)}",
    updated_at = "\${sEsc(next.updatedAt)}",
    last_seen_at = "\${sEsc(next.lastSeenAt)}"\`);

  const rows = await surql(\`SELECT * FROM \${recordId}\`);
  const row = rows?.[0] || null;
  if (!row) return { upserted: false, reason: 'not-found-after-upsert', row: null };

  const occurrenceCount = await calculateFailedPaymentOccurrenceCount(null, 'admin', row);
  const statusLabel = toFailedStatusLabel(occurrenceCount);
  const now = new Date().toISOString();
  await surql(\`UPDATE \${recordId} SET
    occurrence_count = \${occurrenceCount},
    status = "\${sEsc(statusLabel)}",
    retry_eligible = \${next.retryEligible ? 'true' : 'false'},
    next_action = "\${sEsc(next.nextAction)}",
    updated_at = "\${now}"\`);

  const updatedRows = await surql(\`SELECT * FROM \${recordId}\`);
  return { upserted: true, reason: 'ok', row: formatFailedPaymentEventRow(updatedRows?.[0] || null) };
};`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 35: Replace listFailedPaymentEvents()
// ────────────────────────────────────────────────────────────────────────────
replace('listFailedPaymentEvents',
  `const listFailedPaymentEvents = async (ownerKey, options = {}) => {
  const normalizedOwnerKey = normalizeOwnerKey(ownerKey);
  const db = await getReportsDb();
  const query = String(options.query || '').trim().toLowerCase();
  const limit = clampInteger(options.limit, 500, 1, 2000);

  if (!query) {
    const [rows] = await db.query(\`
      SELECT *
      FROM failed_payment_events
      WHERE owner_key = ?
      ORDER BY event_at DESC, id DESC
      LIMIT ?
    \`, [normalizedOwnerKey, limit]);
    return rows.map(formatFailedPaymentEventRow);
  }

  const like = \`%\${query}%\`;
  const [rows] = await db.query(\`
    SELECT *
    FROM failed_payment_events
    WHERE owner_key = ?
      AND (
        LOWER(COALESCE(transaction_id, '')) LIKE ?
        OR LOWER(COALESCE(client_name, '')) LIKE ?
        OR LOWER(COALESCE(email, '')) LIKE ?
        OR LOWER(COALESCE(phone, '')) LIKE ?
        OR LOWER(COALESCE(failure_reason, '')) LIKE ?
        OR LOWER(COALESCE(status, '')) LIKE ?
        OR LOWER(COALESCE(processor, '')) LIKE ?
        OR LOWER(COALESCE(notes, '')) LIKE ?
      )`,
  `const listFailedPaymentEvents = async (ownerKey, options = {}) => {
  const query = String(options.query || '').trim().toLowerCase();
  const limit = clampInteger(options.limit, 500, 1, 2000);

  if (!query) {
    const rows = await surql(\`SELECT * FROM payment_events WHERE owner_key = "admin" ORDER BY event_at DESC LIMIT \${limit}\`);
    return rows.map(formatFailedPaymentEventRow);
  }

  // Search using string::contains on each field
  const q = sEsc(query);
  const rows = await surql(\`
    SELECT * FROM payment_events WHERE owner_key = "admin"
    AND (
      string::contains(string::lowercase(transaction_id ?? ''), "\${q}")
      OR string::contains(string::lowercase(client_name ?? ''), "\${q}")
      OR string::contains(string::lowercase(email ?? ''), "\${q}")
      OR string::contains(string::lowercase(phone ?? ''), "\${q}")
      OR string::contains(string::lowercase(failure_reason ?? ''), "\${q}")
      OR string::contains(string::lowercase(status ?? ''), "\${q}")
      OR string::contains(string::lowercase(processor ?? ''), "\${q}")
      OR string::contains(string::lowercase(notes ?? ''), "\${q}")
    )
    ORDER BY event_at DESC LIMIT \${limit}\`);
  return rows.map(formatFailedPaymentEventRow);
  // DELETED: old query tail below — replaced above
  const _UNUSED = \``
);

// Close the deleted code block
replace('listFailedPaymentEvents-tail',
  `    ORDER BY event_at DESC, id DESC
    LIMIT ?
  \`, [normalizedOwnerKey, like, like, like, like, like, like, like, like, limit]);
  return rows.map(formatFailedPaymentEventRow);
};`,
  `  \`; // end _UNUSED placeholder
};`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 36: Replace listReportHistory()
// ────────────────────────────────────────────────────────────────────────────
replace('listReportHistory',
  `const listReportHistory = async (clientId) => {
  const db = await getReportsDb();
  const [rows] = await db.query(\`
    SELECT
      id,
      client_id AS clientId,
      source,
      monitoring_agency AS monitoringAgency,
      report_date AS reportDate,
      report_file_name AS reportFileName,
      response_url AS responseUrl,
      created_at AS createdAt
    FROM report_history
    WHERE client_id = ?
    ORDER BY created_at DESC, id DESC
  \`, [clientId]);
  return rows;
};`,
  `const listReportHistory = async (clientId) => {
  const rows = await surql(\`
    SELECT
      report_id AS id,
      client_id AS clientId,
      source,
      monitoring_agency AS monitoringAgency,
      report_date AS reportDate,
      report_file_name AS reportFileName,
      response_url AS responseUrl,
      created_at AS createdAt
    FROM reports WHERE client_id = "\${sEsc(clientId)}"
    ORDER BY created_at DESC LIMIT 500\`);
  return rows;
};`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 37: Replace deleteReportHistory()
// ────────────────────────────────────────────────────────────────────────────
replace('deleteReportHistory',
  `const deleteReportHistory = async (clientId) => {
  const db = await getReportsDb();
  await db.query('DELETE FROM report_history WHERE client_id = ?', [clientId]);
};`,
  `const deleteReportHistory = async (clientId) => {
  await surql(\`DELETE reports WHERE client_id = "\${sEsc(clientId)}" AND source_db = "ninjatools"\`);
};`
);

// ────────────────────────────────────────────────────────────────────────────
// PATCH 38: Replace webhook update query at end of file
// ────────────────────────────────────────────────────────────────────────────
replace('webhook-update-query',
  `            await db.query(\`
              UPDATE failed_payment_events
              SET webhook_synced_at = ?, webhook_last_status = ?, updated_at = ?
              WHERE owner_key = ? AND transaction_id = ?
            \`, [
              hookResult.ok ? new Date().toISOString() : null,
              Number(hookResult.status || 0),
              new Date().toISOString(),
              normalizeOwnerKey(ownerKey),
              event.transactionId,
            ]);`,
  `            {
              const _now = new Date().toISOString();
              const _safeTx = String(event.transactionId || '').replace(/[^a-zA-Z0-9_]/g, '_');
              const _recId = \`payment_events:⟨admin_\${_safeTx}⟩\`;
              const _syncedAt = hookResult.ok ? \`"\${_now}"\` : 'NONE';
              await surql(\`UPDATE \${_recId} SET
                webhook_synced_at = \${_syncedAt},
                webhook_last_status = \${Number(hookResult.status || 0)},
                updated_at = "\${_now}"\`).catch(() => {});
            }`
);

// ────────────────────────────────────────────────────────────────────────────
// Write the patched file
// ────────────────────────────────────────────────────────────────────────────
writeFileSync(serverPath, code, 'utf8');
console.log(`\n✓ Applied ${patchCount} patches to server.mjs`);
console.log('  Backup: server.mjs.mysql-bak');
console.log('  Restart: pm2 restart ninja-backend');
