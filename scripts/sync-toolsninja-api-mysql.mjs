#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';
import 'dotenv/config';

const OWNER_KEY = (process.env.NINJA_SYNC_OWNER_KEY || 'admin').trim() || 'admin';
const API_DEFAULT_USER_ID = Number.parseInt(process.env.API_DEFAULT_USER_ID || '1', 10) || 1;
const SYNC_INTERVAL_MS = Math.max(5000, Number.parseInt(process.env.NINJA_SYNC_INTERVAL_MS || '5000', 10) || 5000);
const DRIFT_MS = 1500;
const RUN_ONCE = String(process.env.NINJA_SYNC_RUN_ONCE || '').trim().toLowerCase() === '1'
  || String(process.env.NINJA_SYNC_RUN_ONCE || '').trim().toLowerCase() === 'true';

const toolsCfg = {
  host: (process.env.TOOLSNINJA_DB_HOST || '127.0.0.1').trim(),
  port: Number.parseInt(process.env.TOOLSNINJA_DB_PORT || '3306', 10) || 3306,
  user: (process.env.TOOLSNINJA_DB_USER || 'ninjacore').trim(),
  password: (process.env.TOOLSNINJA_DB_PASSWORD || '').trim(),
  database: (process.env.TOOLSNINJA_DB_NAME || 'TOOLSNINJA').trim(),
  dateStrings: true,
  connectionLimit: 4,
};

const apiCfg = {
  host: (process.env.API_DB_HOST || '127.0.0.1').trim(),
  port: Number.parseInt(process.env.API_DB_PORT || '3306', 10) || 3306,
  user: (process.env.API_DB_USER || 'api').trim(),
  password: (process.env.API_DB_PASSWORD || '').trim(),
  database: (process.env.API_DB_NAME || 'api').trim(),
  dateStrings: true,
  connectionLimit: 4,
};

if (!toolsCfg.password || !apiCfg.password) {
  console.error('Missing DB password(s): TOOLSNINJA_DB_PASSWORD and/or API_DB_PASSWORD.');
  process.exit(1);
}

const FIXED_DOC_TYPES = [
  'ID Document',
  'SSN Document',
  'POA Document',
  'POA2 Document',
  'POA3 Document',
  'Limited Power of Attorney',
];

const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');
const normalizeSsn = (value) => {
  const digits = normalizeDigits(value);
  if (digits.length < 9) return String(value || '').trim();
  const nine = digits.slice(0, 9);
  return `${nine.slice(0, 3)}-${nine.slice(3, 5)}-${nine.slice(5)}`;
};
const ssnLast4 = (value) => {
  const digits = normalizeDigits(value);
  return digits.length >= 4 ? digits.slice(-4) : '';
};
const dobMySqlToUi = (value) => {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return raw;
  return `${match[2]}-${match[3]}-${match[1]}`;
};
const dobUiToMySql = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ui = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (ui) return `${ui[3]}-${ui[1]}-${ui[2]}`;
  return raw;
};
const parseMs = (value) => {
  if (!value) return 0;
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : 0;
};
const msToMysqlDateTime = (ms) => {
  const d = new Date(ms || Date.now());
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
};
const msToIso = (ms) => new Date(ms || Date.now()).toISOString();
const safeText = (v) => String(v ?? '').trim();
const fit = (v, max) => {
  const s = safeText(v);
  if (!max || s.length <= max) return s;
  return s.slice(0, max);
};
const safeNameKey = (first, last) => `${safeText(first).toLowerCase()}|${safeText(last).toLowerCase()}`;
const same = (a, b) => safeText(a) === safeText(b);
const selectBestValue = (...values) => {
  for (const value of values) {
    const text = safeText(value);
    if (text) return text;
  }
  return '';
};
const normalizeAddressLine = (value) => safeText(value).replace(/\s+/g, ' ').trim();
const splitApiAddressLines = (value) => String(value || '')
  .replace(/\r/g, '\n')
  .replace(/\t/g, ' ')
  .split('\n')
  .map((line) => normalizeAddressLine(line))
  .filter(Boolean);
const splitToolsAddressParts = (value) => {
  const raw = safeText(value);
  if (!raw) return [];
  if (raw.includes('|')) {
    return raw.split('|').map((part) => normalizeAddressLine(part)).filter(Boolean);
  }
  const lines = splitApiAddressLines(raw);
  if (lines.length > 0) return lines.slice(0, 2);
  return [normalizeAddressLine(raw)].filter(Boolean);
};
const toToolsAddress = (line1, line2 = '') => {
  const first = normalizeAddressLine(line1);
  const second = normalizeAddressLine(line2);
  if (first && second) return `${first} | ${second}`;
  return first || second || '';
};
const apiAddressPairToTools = (currentAddress, address, addresses) => {
  const currentLines = splitApiAddressLines(currentAddress);
  if (currentLines.length >= 2) return toToolsAddress(currentLines[0], currentLines[1]);
  if (currentLines.length === 1) return toToolsAddress(currentLines[0], '');

  const addressLines = splitApiAddressLines(address);
  if (addressLines.length >= 2) return toToolsAddress(addressLines[0], addressLines[1]);
  if (addressLines.length === 1) return toToolsAddress(addressLines[0], '');

  const groupedLines = splitApiAddressLines(addresses);
  if (groupedLines.length >= 2) return toToolsAddress(groupedLines[0], groupedLines[1]);
  if (groupedLines.length === 1) return toToolsAddress(groupedLines[0], '');

  return '';
};
const toolsAddressToApiMultiLine = (toolsAddress) => {
  const parts = splitToolsAddressParts(toolsAddress);
  if (parts.length >= 2) return `${parts[0]}\n${parts[1]}`;
  if (parts.length === 1) return parts[0];
  return '';
};
const normalizeAddressCompare = (value) => {
  const normalized = apiAddressPairToTools(value, value, value);
  return safeText(normalized).toLowerCase();
};

const reportTypeFromAgency = (agency) => {
  const v = String(agency || '').trim().toLowerCase();
  if (v.includes('identity')) return 'identity';
  if (v.includes('myfree') || v.includes('freescorenow')) return 'myfreescorenow';
  if (v.includes('smart')) return 'smartcreadit';
  return 'identity';
};
const agencyFromReportType = (reportType) => {
  const v = String(reportType || '').trim().toLowerCase();
  if (v === 'identity') return 'IdentityIQ';
  if (v === 'myfreescorenow') return 'MyFreeScoreNow';
  if (v === 'smartcreadit') return 'SmartCredit';
  return '';
};

const extractDocByType = (documents, type) => {
  if (!Array.isArray(documents)) return '';
  const found = documents.find((doc) => String(doc?.type || '').trim() === type);
  if (!found) return '';
  return safeText(found.storageKey || found.fileDataUrl || found.fileName || '');
};

const buildDocsFromApi = (apiClientRow, existingDocs) => {
  const keep = Array.isArray(existingDocs)
    ? existingDocs.filter((doc) => !FIXED_DOC_TYPES.includes(String(doc?.type || '').trim()))
    : [];
  const fixed = [
    { type: 'ID Document', value: apiClientRow.dl_id },
    { type: 'SSN Document', value: apiClientRow.ssn_id },
    { type: 'POA Document', value: apiClientRow.poa_id },
    { type: 'POA2 Document', value: apiClientRow.poa2_id },
    { type: 'POA3 Document', value: apiClientRow.poa3_id },
    { type: 'Limited Power of Attorney', value: apiClientRow.cover_sheet },
  ].map((entry) => {
    const payload = safeText(entry.value);
    const parts = payload.split('/');
    return {
      id: `sync-${entry.type.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      type: entry.type,
      includeInPrintLetters: entry.type === 'Limited Power of Attorney',
      printSide: 'front',
      fileName: payload ? parts[parts.length - 1] : '',
      fileDataUrl: payload,
      storageKey: payload,
    };
  });

  return [...fixed, ...keep];
};

const assertLegacyBridgeSchema = async (toolsPool) => {
  const [columns] = await toolsPool.query(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = 'client_profiles'
  `, [toolsCfg.database]);
  const columnSet = new Set((columns || []).map((row) => safeText(row.COLUMN_NAME)));
  if (!columnSet.has('external_client_id')) {
    throw new Error(
      'Legacy tools-api-bridge is incompatible with the current TOOLSNINJA schema: client_profiles.external_client_id is missing. Rewrite the bridge for the OLD-grandfather merge model before restarting it.',
    );
  }
};

const run = async () => {
  const toolsPool = mysql.createPool(toolsCfg);
  const apiPool = mysql.createPool(apiCfg);
  await assertLegacyBridgeSchema(toolsPool);
  console.log(`[bridge] started owner=${OWNER_KEY} tools=${toolsCfg.host}:${toolsCfg.port}/${toolsCfg.database} api=${apiCfg.host}:${apiCfg.port}/${apiCfg.database} intervalMs=${SYNC_INTERVAL_MS}`);

  let running = false;
  const runPass = async () => {
    if (running) return;
    running = true;
    const started = Date.now();
    let apiToToolsInsert = 0;
    let apiToToolsUpdate = 0;
    let apiToToolsBackfill = 0;
    let toolsToApiInsert = 0;
    let toolsToApiUpdate = 0;
    let toolsToApiBackfill = 0;

    try {
      const [apiRows] = await apiPool.query(`
        SELECT
          c.id, c.UserId, c.first_name, c.last_name, c.phone, c.email, c.currentAddress, c.address, c.addresses,
          c.ssn, c.dob, c.secret_question_name, c.employers, c.dl_id, c.ssn_id, c.poa_id, c.poa2_id, c.poa3_id, c.cover_sheet,
          c.createdAt, c.updatedAt,
          r.username AS report_username, r.password AS report_password, r.reportType, r.updatedAt AS reportUpdatedAt,
          UNIX_TIMESTAMP(GREATEST(c.updatedAt, IFNULL(r.updatedAt, c.updatedAt))) * 1000 AS sync_ts_ms
        FROM Clients c
        LEFT JOIN (
          SELECT r1.*
          FROM Reports r1
          INNER JOIN (
            SELECT ClientId, MAX(updatedAt) AS max_updated
            FROM Reports
            GROUP BY ClientId
          ) latest
            ON latest.ClientId = r1.ClientId
           AND latest.max_updated = r1.updatedAt
        ) r ON r.ClientId = c.id
        ORDER BY c.id DESC
      `);

      const [toolsRows] = await toolsPool.query(`
        SELECT
          owner_key, client_id, external_client_id, first_name, last_name, email, phone, address, dob, ssn,
          monitoring_agency, monitoring_username, monitoring_password, secret_key, documents_json, updated_at
        FROM client_profiles
        WHERE owner_key = ?
        ORDER BY updated_at DESC
      `, [OWNER_KEY]);

      // API is master for canonical numeric IDs on TOOLSNINJA side.
      // If a profile is linked to an API id via external_client_id, normalize client_id to that value.
      // Keep this collision-safe and update dependent tables that reference client_id.
      for (const row of toolsRows) {
        const currentClientId = safeText(row.client_id);
        const externalId = safeText(row.external_client_id);
        if (!externalId || currentClientId === externalId) continue;
        if (!/^\d+$/.test(externalId)) continue;

        const [targetExists] = await toolsPool.query(
          'SELECT client_id FROM client_profiles WHERE owner_key = ? AND client_id = ? LIMIT 1',
          [OWNER_KEY, externalId],
        );
        if (Array.isArray(targetExists) && targetExists.length > 0) {
          // Collision; keep existing row untouched to avoid accidental overwrite.
          continue;
        }

        await toolsPool.query('START TRANSACTION');
        try {
          await toolsPool.query(
            'UPDATE client_profiles SET spouse_client_id = ? WHERE owner_key = ? AND spouse_client_id = ?',
            [externalId, OWNER_KEY, currentClientId],
          );
          await toolsPool.query(
            'UPDATE payment_autopay SET client_id = ? WHERE owner_key = ? AND client_id = ?',
            [externalId, OWNER_KEY, currentClientId],
          );
          await toolsPool.query(
            'UPDATE report_history SET client_id = ? WHERE client_id = ?',
            [externalId, currentClientId],
          );
          await toolsPool.query(
            'UPDATE client_profiles SET client_id = ? WHERE owner_key = ? AND client_id = ?',
            [externalId, OWNER_KEY, currentClientId],
          );
          await toolsPool.query('COMMIT');
          row.client_id = externalId;
        } catch (txError) {
          await toolsPool.query('ROLLBACK');
          throw txError;
        }
      }

      const toolsByExternal = new Map();
      const toolsBySsn = new Map();
      const toolsByName = new Map();
      const toolsByEmail = new Map();
      const toolsNameCounts = new Map();
      const toolsEmailCounts = new Map();
      for (const row of toolsRows) {
        const ext = safeText(row.external_client_id);
        if (ext) toolsByExternal.set(ext, row);
        const ssnDigits = normalizeDigits(row.ssn);
        if (ssnDigits.length >= 9) toolsBySsn.set(ssnDigits.slice(0, 9), row);
        const key = safeNameKey(row.first_name, row.last_name);
        toolsByName.set(key, row);
        toolsNameCounts.set(key, Number(toolsNameCounts.get(key) || 0) + 1);
        const emailKey = safeText(row.email).toLowerCase();
        if (emailKey) {
          toolsByEmail.set(emailKey, row);
          toolsEmailCounts.set(emailKey, Number(toolsEmailCounts.get(emailKey) || 0) + 1);
        }
      }
      const apiNameCounts = new Map();
      const apiEmailCounts = new Map();
      for (const row of apiRows) {
        const key = safeNameKey(row.first_name, row.last_name);
        apiNameCounts.set(key, Number(apiNameCounts.get(key) || 0) + 1);
        const emailKey = safeText(row.email).toLowerCase();
        if (emailKey) {
          apiEmailCounts.set(emailKey, Number(apiEmailCounts.get(emailKey) || 0) + 1);
        }
      }

      for (const apiRow of apiRows) {
        const apiId = String(apiRow.id);
        const apiSsn9 = normalizeDigits(apiRow.ssn).slice(0, 9);
        const directExternalMatch = toolsByExternal.get(apiId) || null;
        const ssnMatch = (apiSsn9 ? toolsBySsn.get(apiSsn9) : null) || null;
        const nameKey = safeNameKey(apiRow.first_name, apiRow.last_name);
        const nameMatch = toolsByName.get(nameKey) || null;
        const emailKey = safeText(apiRow.email).toLowerCase();
        const emailMatch = (emailKey ? toolsByEmail.get(emailKey) : null) || null;
        const uniqueEmailFallback =
          !directExternalMatch
          && !ssnMatch
          && emailKey
          && Number(toolsEmailCounts.get(emailKey) || 0) === 1
          && Number(apiEmailCounts.get(emailKey) || 0) === 1;
        const uniqueNameFallback =
          !directExternalMatch
          && !ssnMatch
          && !uniqueEmailFallback
          && Number(toolsNameCounts.get(nameKey) || 0) === 1
          && Number(apiNameCounts.get(nameKey) || 0) === 1;
        const toolsMatch = directExternalMatch
          || ssnMatch
          || (uniqueEmailFallback ? emailMatch : null)
          || (uniqueNameFallback ? nameMatch : null);
        const apiUpdatedMs = Number(apiRow.sync_ts_ms || 0);

        if (!toolsMatch) {
          const newClientId = `client-${randomUUID().slice(0, 8)}`;
          const reportType = safeText(apiRow.reportType || 'identity');
          await toolsPool.query(`
            INSERT INTO client_profiles (
              owner_key, client_id, external_client_id, first_name, last_name, email, phone, address, dob, ssn, status, phase,
              monitoring_agency, monitoring_username, monitoring_password, secret_key, monitoring_token, goal, notes,
              portal_password, portal_enabled, language, next_import_mode, manual_next_import_start_days, manual_next_import_set_date,
              refresh_next_import_start_date, documents_json, yearly_income, housing_payment, debt_monthly_payments, spouse_client_id,
              spouse_client_label, assigned_to, ninja_assigned, affiliate_assigned, report_date, next_import_int, next_import_label, pid, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Client', 'None', ?, ?, ?, ?, '', '', '', '', 1, 'English', 'manual', '', '', '', ?, '', '', '', '', '', '', '', 'None', '', '', '', '35540', ?)
          `, [
            OWNER_KEY,
            newClientId,
            apiId,
            fit(apiRow.first_name, 255),
              fit(apiRow.last_name, 255),
              fit(apiRow.email, 191),
              fit(apiRow.phone, 64),
              apiAddressPairToTools(apiRow.currentAddress, apiRow.address, apiRow.addresses),
              dobMySqlToUi(apiRow.dob),
              normalizeSsn(apiRow.ssn),
              fit(agencyFromReportType(reportType), 128),
            fit(apiRow.report_username, 320),
            safeText(apiRow.report_password),
            safeText(apiRow.secret_question_name) || ssnLast4(apiRow.ssn),
            JSON.stringify(buildDocsFromApi(apiRow, [])),
            msToIso(apiUpdatedMs || Date.now()),
          ]);
          apiToToolsInsert += 1;
          continue;
        }

        const toolsUpdatedMs = parseMs(toolsMatch.updated_at);

        const currentToolsExternalId = safeText(toolsMatch.external_client_id);
        const currentToolsAgency = safeText(toolsMatch.monitoring_agency);
        const currentToolsUsername = fit(toolsMatch.monitoring_username, 320);
        const currentToolsPassword = safeText(toolsMatch.monitoring_password);
        const currentToolsSecret = safeText(toolsMatch.secret_key);

        const apiAgency = fit(agencyFromReportType(apiRow.reportType || 'identity'), 128);
        const apiUsername = fit(apiRow.report_username, 320);
        const apiPassword = safeText(apiRow.report_password);
        const apiSecret = safeText(apiRow.secret_question_name) || ssnLast4(apiRow.ssn);

        const staleExternalId = Boolean(currentToolsExternalId && currentToolsExternalId !== apiId && !directExternalMatch);
        const fillExternalIdFromApi = (!currentToolsExternalId || staleExternalId) && Boolean(apiId);
        const fillAgencyFromApi = !currentToolsAgency && Boolean(apiAgency);
        const fillUsernameFromApi = !currentToolsUsername && Boolean(apiUsername);
        const fillPasswordFromApi = !currentToolsPassword && Boolean(apiPassword);
        const fillSecretFromApi = !currentToolsSecret && Boolean(apiSecret);

        // Address rescue: if Tools address is blank but API has address data, fill regardless of timestamp drift.
        const toolsAddressCurrent = toToolsAddress(...splitToolsAddressParts(toolsMatch.address));
        const apiAddressCandidate = apiAddressPairToTools(apiRow.currentAddress, apiRow.address, apiRow.addresses);
        const fillAddressFromApi = !toolsAddressCurrent && Boolean(apiAddressCandidate);

        if (fillExternalIdFromApi || fillAgencyFromApi || fillUsernameFromApi || fillPasswordFromApi || fillSecretFromApi || fillAddressFromApi) {
          await toolsPool.query(`
            UPDATE client_profiles
            SET
              external_client_id = ?,
              address = ?,
              monitoring_agency = ?,
              monitoring_username = ?,
              monitoring_password = ?,
              secret_key = ?,
              updated_at = ?
            WHERE owner_key = ? AND client_id = ?
          `, [
            fillExternalIdFromApi ? apiId : currentToolsExternalId,
            fillAddressFromApi ? apiAddressCandidate : toolsMatch.address,
            fillAgencyFromApi ? apiAgency : currentToolsAgency,
            fillUsernameFromApi ? apiUsername : currentToolsUsername,
            fillPasswordFromApi ? apiPassword : currentToolsPassword,
            fillSecretFromApi ? apiSecret : currentToolsSecret,
            msToIso(Math.max(apiUpdatedMs, toolsUpdatedMs, Date.now())),
            OWNER_KEY,
            toolsMatch.client_id,
          ]);

          if (fillExternalIdFromApi) toolsMatch.external_client_id = apiId;
          if (fillAgencyFromApi) toolsMatch.monitoring_agency = apiAgency;
          if (fillUsernameFromApi) toolsMatch.monitoring_username = apiUsername;
          if (fillPasswordFromApi) toolsMatch.monitoring_password = apiPassword;
          if (fillSecretFromApi) toolsMatch.secret_key = apiSecret;
          if (fillAddressFromApi) toolsMatch.address = apiAddressCandidate;
          apiToToolsBackfill += 1;
        }

        if (apiUpdatedMs > toolsUpdatedMs + DRIFT_MS) {
          let existingDocs = [];
          try {
            existingDocs = JSON.parse(String(toolsMatch.documents_json || '[]'));
          } catch {
            existingDocs = [];
          }
          await toolsPool.query(`
            UPDATE client_profiles
            SET
              external_client_id = ?,
              first_name = ?,
              last_name = ?,
              email = ?,
              phone = ?,
              address = ?,
              dob = ?,
              ssn = ?,
              monitoring_agency = ?,
              monitoring_username = ?,
              monitoring_password = ?,
              secret_key = ?,
              documents_json = ?,
              updated_at = ?
            WHERE owner_key = ? AND client_id = ?
          `, [
            apiId,
            fit(apiRow.first_name, 255),
              fit(apiRow.last_name, 255),
              fit(apiRow.email, 191),
              fit(apiRow.phone, 64),
              apiAddressPairToTools(apiRow.currentAddress, apiRow.address, apiRow.addresses),
              dobMySqlToUi(apiRow.dob),
              normalizeSsn(apiRow.ssn),
              fit(agencyFromReportType(apiRow.reportType), 128),
            fit(apiRow.report_username, 320),
            safeText(apiRow.report_password),
            safeText(apiRow.secret_question_name) || ssnLast4(apiRow.ssn),
            JSON.stringify(buildDocsFromApi(apiRow, existingDocs)),
            msToIso(apiUpdatedMs),
            OWNER_KEY,
            toolsMatch.client_id,
          ]);
          apiToToolsUpdate += 1;
        }
      }

      const apiById = new Map(apiRows.map((row) => [String(row.id), row]));
      const apiBySsn = new Map(apiRows
        .map((row) => [normalizeDigits(row.ssn).slice(0, 9), row])
        .filter(([ssn]) => ssn));
      const apiByName = new Map(apiRows.map((row) => [safeNameKey(row.first_name, row.last_name), row]));

      for (const toolsRow of toolsRows) {
        const ext = safeText(toolsRow.external_client_id);
        const ssn9 = normalizeDigits(toolsRow.ssn).slice(0, 9);
        const nameKey = safeNameKey(toolsRow.first_name, toolsRow.last_name);
        const uniqueApiNameFallback =
          !ext
          && !ssn9
          && Number(toolsNameCounts.get(nameKey) || 0) === 1
          && Number(apiNameCounts.get(nameKey) || 0) === 1;
        const apiMatch = (ext && apiById.get(ext))
          || (ssn9 && apiBySsn.get(ssn9))
          || (uniqueApiNameFallback ? apiByName.get(nameKey) : null);
        const toolsUpdatedMs = parseMs(toolsRow.updated_at);

        let docArray = [];
        try {
          docArray = JSON.parse(String(toolsRow.documents_json || '[]'));
        } catch {
          docArray = [];
        }

        if (!apiMatch) {
          const first = safeText(toolsRow.first_name);
          const last = safeText(toolsRow.last_name);
          const ssnNorm = normalizeSsn(toolsRow.ssn);
          const dobSql = dobUiToMySql(toolsRow.dob);
          if (!first || !last) continue;

          const updatedAtSql = msToMysqlDateTime(toolsUpdatedMs || Date.now());
          let newApiId = 0;
          try {
            const [insertResult] = await apiPool.query(`
              INSERT INTO Clients (
                UserId, first_name, last_name, phone, email, currentAddress, address, addresses, names, ssn, dob,
                secret_question_name, employers, dl_id, ssn_id, poa_id, poa2_id, poa3_id, cover_sheet, nextReminder,
                hasFile, createPdf, createdAt, updatedAt
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, ?, ?)
            `, [
              API_DEFAULT_USER_ID,
              fit(first, 255),
              fit(last, 255),
              fit(toolsRow.phone, 20),
              fit(toolsRow.email, 50),
              toolsAddressToApiMultiLine(toolsRow.address),
              toolsAddressToApiMultiLine(toolsRow.address),
              '[]',
              '[]',
              ssnNorm || '000-00-0000',
              dobSql || '1900-01-01',
              safeText(toolsRow.secret_key) || ssnLast4(ssnNorm),
              '[]',
              extractDocByType(docArray, 'ID Document'),
              extractDocByType(docArray, 'SSN Document'),
              extractDocByType(docArray, 'POA Document'),
              extractDocByType(docArray, 'POA2 Document'),
              extractDocByType(docArray, 'POA3 Document'),
              extractDocByType(docArray, 'Limited Power of Attorney'),
              updatedAtSql,
              updatedAtSql,
            ]);
            newApiId = Number(insertResult.insertId || 0);
          } catch (error) {
            if (!String(error?.message || '').includes('Duplicate entry')) throw error;
            const [existing] = ssnNorm
              ? await apiPool.query('SELECT id FROM Clients WHERE ssn = ? LIMIT 1', [ssnNorm])
              : await apiPool.query(
                'SELECT id FROM Clients WHERE first_name = ? AND last_name = ? AND IFNULL(email,\"\") = IFNULL(?,\"\") LIMIT 1',
                [fit(first, 255), fit(last, 255), fit(toolsRow.email, 50)],
              );
            if (existing.length) newApiId = Number(existing[0].id || 0);
          }
          if (!newApiId) continue;

          await apiPool.query(`
            INSERT INTO Reports (ClientId, username, password, reportType, deletetionsLists, compare, progress, accounts, alternateLetters, newVersion, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, 1, ?, ?)
            ON DUPLICATE KEY UPDATE
              username = VALUES(username),
              password = VALUES(password),
              reportType = VALUES(reportType),
              updatedAt = VALUES(updatedAt)
          `, [
            newApiId,
            fit(toolsRow.monitoring_username, 320),
            safeText(toolsRow.monitoring_password),
            reportTypeFromAgency(toolsRow.monitoring_agency),
            updatedAtSql,
            updatedAtSql,
          ]);

          const newApiIdText = String(newApiId);
          const [newIdTaken] = await toolsPool.query(
            'SELECT client_id FROM client_profiles WHERE owner_key = ? AND client_id = ? LIMIT 1',
            [OWNER_KEY, newApiIdText],
          );
          if (Array.isArray(newIdTaken) && newIdTaken.length > 0) {
            // Canonical API id row already exists in TOOLSNINJA.
            // Merge references and remove duplicate source row.
            await toolsPool.query(
              'UPDATE client_profiles SET spouse_client_id = ? WHERE owner_key = ? AND spouse_client_id = ?',
              [newApiIdText, OWNER_KEY, toolsRow.client_id],
            );
            await toolsPool.query(
              'UPDATE payment_autopay SET client_id = ? WHERE owner_key = ? AND client_id = ?',
              [newApiIdText, OWNER_KEY, toolsRow.client_id],
            );
            await toolsPool.query(`
              DELETE h_old
              FROM report_history h_old
              JOIN report_history h_new
                ON h_new.client_id = ?
               AND h_new.snapshot_checksum = h_old.snapshot_checksum
              WHERE h_old.client_id = ?
            `, [newApiIdText, toolsRow.client_id]);
            await toolsPool.query(
              'UPDATE report_history SET client_id = ? WHERE client_id = ?',
              [newApiIdText, toolsRow.client_id],
            );
            await toolsPool.query('DELETE FROM client_profiles WHERE owner_key = ? AND client_id = ?', [
              OWNER_KEY,
              toolsRow.client_id,
            ]);
          } else {
            await toolsPool.query(`
              UPDATE client_profiles
              SET client_id = ?, external_client_id = ?, updated_at = ?
              WHERE owner_key = ? AND client_id = ?
            `, [
              newApiIdText,
              newApiIdText,
              msToIso(toolsUpdatedMs || Date.now()),
              OWNER_KEY,
              toolsRow.client_id,
            ]);
          }

          toolsToApiInsert += 1;
          continue;
        }

        const apiUpdatedMs = Number(apiMatch.sync_ts_ms || 0);

        const apiSecretCurrent = safeText(apiMatch.secret_question_name);
        const toolsSecretCandidate = selectBestValue(toolsRow.secret_key, ssnLast4(selectBestValue(toolsRow.ssn, apiMatch.ssn)));
        const fillApiSecretFromTools = !apiSecretCurrent && Boolean(toolsSecretCandidate);

        const apiReportTypeCurrent = safeText(apiMatch.reportType);
        const apiReportUsernameCurrent = fit(apiMatch.report_username, 320);
        const apiReportPasswordCurrent = safeText(apiMatch.report_password);
        const toolsReportTypeCandidate = reportTypeFromAgency(toolsRow.monitoring_agency);
        const toolsReportUsernameCandidate = fit(toolsRow.monitoring_username, 320);
        const toolsReportPasswordCandidate = safeText(toolsRow.monitoring_password);

        const fillApiReportTypeFromTools = !apiReportTypeCurrent && Boolean(toolsReportTypeCandidate);
        const fillApiReportUsernameFromTools = !apiReportUsernameCurrent && Boolean(toolsReportUsernameCandidate);
        const fillApiReportPasswordFromTools = !apiReportPasswordCurrent && Boolean(toolsReportPasswordCandidate);
        const toolsAddressCandidate = toToolsAddress(...splitToolsAddressParts(toolsRow.address));
        const apiAddressCurrentToolsFormat = toToolsAddress(
          ...splitToolsAddressParts(apiAddressPairToTools(apiMatch.currentAddress, apiMatch.address, apiMatch.addresses)),
        );
        const fillApiAddressFromTools = !apiAddressCurrentToolsFormat && Boolean(toolsAddressCandidate);

        if (fillApiSecretFromTools) {
          const stamp = msToMysqlDateTime(Math.max(toolsUpdatedMs, apiUpdatedMs, Date.now()));
          await apiPool.query(`
            UPDATE Clients
            SET secret_question_name = ?, updatedAt = ?
            WHERE id = ?
          `, [toolsSecretCandidate, stamp, apiMatch.id]);
          apiMatch.secret_question_name = toolsSecretCandidate;
          toolsToApiBackfill += 1;
        }

        if (fillApiReportTypeFromTools || fillApiReportUsernameFromTools || fillApiReportPasswordFromTools) {
          const stamp = msToMysqlDateTime(Math.max(toolsUpdatedMs, apiUpdatedMs, Date.now()));
          await apiPool.query(`
            INSERT INTO Reports (ClientId, username, password, reportType, deletetionsLists, compare, progress, accounts, alternateLetters, newVersion, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, 1, ?, ?)
            ON DUPLICATE KEY UPDATE
              username = VALUES(username),
              password = VALUES(password),
              reportType = VALUES(reportType),
              updatedAt = VALUES(updatedAt)
          `, [
            apiMatch.id,
            selectBestValue(apiReportUsernameCurrent, toolsReportUsernameCandidate),
            selectBestValue(apiReportPasswordCurrent, toolsReportPasswordCandidate),
            selectBestValue(apiReportTypeCurrent, toolsReportTypeCandidate, 'identity'),
            stamp,
            stamp,
          ]);
          apiMatch.report_username = selectBestValue(apiReportUsernameCurrent, toolsReportUsernameCandidate);
          apiMatch.report_password = selectBestValue(apiReportPasswordCurrent, toolsReportPasswordCandidate);
          apiMatch.reportType = selectBestValue(apiReportTypeCurrent, toolsReportTypeCandidate, 'identity');
          toolsToApiBackfill += 1;
        }

        if (fillApiAddressFromTools) {
          const stamp = msToMysqlDateTime(Math.max(toolsUpdatedMs, apiUpdatedMs, Date.now()));
          const toolsAddressMultiline = toolsAddressToApiMultiLine(toolsRow.address);
          await apiPool.query(`
            UPDATE Clients
            SET currentAddress = ?, address = ?, updatedAt = ?
            WHERE id = ?
          `, [
            toolsAddressMultiline,
            toolsAddressMultiline,
            stamp,
            apiMatch.id,
          ]);
          apiMatch.currentAddress = toolsAddressMultiline;
          apiMatch.address = toolsAddressMultiline;
          toolsToApiBackfill += 1;
        }

        if (toolsUpdatedMs > apiUpdatedMs + DRIFT_MS) {
          const desiredFirst = fit(toolsRow.first_name, 255) || fit(apiMatch.first_name, 255);
          const desiredLast = fit(toolsRow.last_name, 255) || fit(apiMatch.last_name, 255);
          const desiredPhone = fit(toolsRow.phone, 20);
          const desiredEmail = fit(toolsRow.email, 50);
          const desiredAddressTools = toToolsAddress(...splitToolsAddressParts(toolsRow.address));
          const desiredAddressApi = toolsAddressToApiMultiLine(toolsRow.address);
          const apiAddressCurrent = toolsAddressToApiMultiLine(
            apiAddressPairToTools(apiMatch.currentAddress, apiMatch.address, apiMatch.addresses),
          );
          // Address precedence rule:
          // - API keeps its current address if populated (prevents stale TOOLSNINJA overwrite).
          // - TOOLSNINJA may only fill API address when API is blank.
          const safeApiAddressToWrite = apiAddressCurrent || desiredAddressApi;
          const expectedApiAddressTools = toToolsAddress(...splitToolsAddressParts(safeApiAddressToWrite));
          const desiredSsn = normalizeSsn(toolsRow.ssn) || normalizeSsn(apiMatch.ssn);
          const desiredDob = dobUiToMySql(toolsRow.dob) || dobUiToMySql(apiMatch.dob);
          const desiredSecret = safeText(toolsRow.secret_key) || ssnLast4(toolsRow.ssn);
          const desiredIdDoc = extractDocByType(docArray, 'ID Document');
          const desiredSsnDoc = extractDocByType(docArray, 'SSN Document');
          const desiredPoaDoc = extractDocByType(docArray, 'POA Document');
          const desiredPoa2Doc = extractDocByType(docArray, 'POA2 Document');
          const desiredPoa3Doc = extractDocByType(docArray, 'POA3 Document');
          const desiredLpoa = extractDocByType(docArray, 'Limited Power of Attorney');
          const desiredReportUsername = fit(toolsRow.monitoring_username, 320);
          const desiredReportPassword = safeText(toolsRow.monitoring_password);
          const desiredReportType = reportTypeFromAgency(toolsRow.monitoring_agency);

          const clientAlreadySynced =
            same(desiredFirst, apiMatch.first_name)
            && same(desiredLast, apiMatch.last_name)
            && same(desiredPhone, apiMatch.phone)
            && same(desiredEmail, apiMatch.email)
            && same(
              expectedApiAddressTools.toLowerCase(),
              apiAddressPairToTools(apiMatch.currentAddress, apiMatch.address, apiMatch.addresses).toLowerCase(),
            )
            && same(desiredSsn, apiMatch.ssn)
            && same(desiredDob, String(apiMatch.dob || '').slice(0, 10))
            && same(desiredSecret, apiMatch.secret_question_name)
            && same(desiredIdDoc, apiMatch.dl_id)
            && same(desiredSsnDoc, apiMatch.ssn_id)
            && same(desiredPoaDoc, apiMatch.poa_id)
            && same(desiredPoa2Doc, apiMatch.poa2_id)
            && same(desiredPoa3Doc, apiMatch.poa3_id)
            && same(desiredLpoa, apiMatch.cover_sheet)
            && same(desiredReportUsername, apiMatch.report_username)
            && same(desiredReportPassword, apiMatch.report_password)
            && same(desiredReportType, apiMatch.reportType);

          if (clientAlreadySynced) {
            continue;
          }

          const updatedAtSql = msToMysqlDateTime(toolsUpdatedMs || Date.now());
          let nextSsn = normalizeSsn(toolsRow.ssn) || normalizeSsn(apiMatch.ssn);
          if (nextSsn) {
            const [ssnOwner] = await apiPool.query('SELECT id FROM Clients WHERE ssn = ? LIMIT 1', [nextSsn]);
            if (ssnOwner.length && Number(ssnOwner[0].id) !== Number(apiMatch.id)) {
              nextSsn = normalizeSsn(apiMatch.ssn);
            }
          }
          try {
            await apiPool.query(`
              UPDATE Clients
              SET
                first_name = ?, last_name = ?, phone = ?, email = ?, currentAddress = ?, address = ?,
                ssn = ?, dob = ?, secret_question_name = ?, dl_id = ?, ssn_id = ?, poa_id = ?, poa2_id = ?, poa3_id = ?, cover_sheet = ?,
                updatedAt = ?
              WHERE id = ?
            `, [
              fit(toolsRow.first_name, 255) || fit(apiMatch.first_name, 255),
              fit(toolsRow.last_name, 255) || fit(apiMatch.last_name, 255),
              fit(toolsRow.phone, 20),
              fit(toolsRow.email, 50),
              safeApiAddressToWrite,
              safeApiAddressToWrite,
              nextSsn,
              dobUiToMySql(toolsRow.dob) || dobUiToMySql(apiMatch.dob),
              safeText(toolsRow.secret_key) || ssnLast4(toolsRow.ssn),
              extractDocByType(docArray, 'ID Document'),
              extractDocByType(docArray, 'SSN Document'),
              extractDocByType(docArray, 'POA Document'),
              extractDocByType(docArray, 'POA2 Document'),
              extractDocByType(docArray, 'POA3 Document'),
              extractDocByType(docArray, 'Limited Power of Attorney'),
              updatedAtSql,
              apiMatch.id,
            ]);
          } catch (error) {
            if (String(error?.message || '').includes('Duplicate entry') && String(error?.message || '').includes('clients_ssn')) {
              continue;
            }
            throw error;
          }
          await apiPool.query(`
            INSERT INTO Reports (ClientId, username, password, reportType, deletetionsLists, compare, progress, accounts, alternateLetters, newVersion, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, 1, ?, ?)
            ON DUPLICATE KEY UPDATE
              username = VALUES(username),
              password = VALUES(password),
              reportType = VALUES(reportType),
              updatedAt = VALUES(updatedAt)
          `, [
            apiMatch.id,
            fit(toolsRow.monitoring_username, 320),
            safeText(toolsRow.monitoring_password),
            reportTypeFromAgency(toolsRow.monitoring_agency),
            updatedAtSql,
            updatedAtSql,
          ]);
          toolsToApiUpdate += 1;
        }
      }

      console.log(`[bridge] pass done in ${Date.now() - started}ms | api->tools +${apiToToolsInsert} ~${apiToToolsUpdate} fill=${apiToToolsBackfill} | tools->api +${toolsToApiInsert} ~${toolsToApiUpdate} fill=${toolsToApiBackfill}`);
    } catch (error) {
      console.error('[bridge] pass failed:', error?.message || error);
    } finally {
      running = false;
    }
  };

  await runPass();
  if (RUN_ONCE) {
    await toolsPool.end();
    await apiPool.end();
    return;
  }
  setInterval(runPass, SYNC_INTERVAL_MS);
};

run().catch((error) => {
  console.error('[bridge] fatal:', error?.message || error);
  process.exit(1);
});
