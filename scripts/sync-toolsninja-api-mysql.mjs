#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';
import 'dotenv/config';

const BRIDGE_VERSION = 'v2.0.0';
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

const DOC_FIELD_PAIRS = [
  ['ID Document', 'dl_id'],
  ['SSN Document', 'ssn_id'],
  ['POA Document', 'poa_id'],
  ['POA2 Document', 'poa2_id'],
  ['POA3 Document', 'poa3_id'],
  ['Limited Power of Attorney', 'cover_sheet'],
];

const text = (value) => String(value ?? '').trim();
const fit = (value, max) => {
  const normalized = text(value);
  if (!max || normalized.length <= max) return normalized;
  return normalized.slice(0, max);
};
const digits = (value) => String(value || '').replace(/\D/g, '');
const isNumericId = (value) => /^\d+$/.test(text(value));
const same = (a, b) => text(a) === text(b);
const nameKey = (first, last) => `${text(first).toLowerCase()}|${text(last).toLowerCase()}`;
const parseMs = (value) => {
  if (!value) return 0;
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : 0;
};
const toIso = (ms = Date.now()) => new Date(ms).toISOString();
const toApiDateTime = (ms = Date.now()) => {
  const date = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
};

const normalizeSsn = (value) => {
  const onlyDigits = digits(value);
  if (onlyDigits.length < 9) return text(value);
  const ssn = onlyDigits.slice(0, 9);
  return `${ssn.slice(0, 3)}-${ssn.slice(3, 5)}-${ssn.slice(5)}`;
};

const normalizeDobForApi = (value, fallback = '1900-01-01') => {
  const raw = text(value);
  if (!raw) return fallback;
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  const mdy = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1]}-${mdy[2]}`;
  const parsedMs = Date.parse(raw);
  if (!Number.isFinite(parsedMs)) return fallback;
  const d = new Date(parsedMs);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

const ssnLast4 = (value) => {
  const onlyDigits = digits(value);
  return onlyDigits.length >= 4 ? onlyDigits.slice(-4) : '';
};

const normalizeAddressLine = (value) => text(value).replace(/\s+/g, ' ').trim();

const parseLocality = (line) => {
  const normalized = normalizeAddressLine(line).replace(/,\s*(United States(?: of America)?|USA)\s*$/i, '');
  if (!normalized) return { city: '', state: '', zip: '' };
  const withZip = normalized.match(/^(.*?)[,\s]+([A-Za-z]{2}|[A-Za-z][A-Za-z .'-]+)\s+(\d{5}(?:-\d{4})?)$/);
  if (withZip) {
    return {
      city: text(withZip[1]).replace(/,$/, ''),
      state: text(withZip[2]),
      zip: text(withZip[3]),
    };
  }
  const stateOnly = normalized.match(/^(.*?)[,\s]+([A-Za-z]{2}|[A-Za-z][A-Za-z .'-]+)$/);
  if (stateOnly) {
    return {
      city: text(stateOnly[1]).replace(/,$/, ''),
      state: text(stateOnly[2]),
      zip: '',
    };
  }
  return { city: normalized.replace(/,$/, ''), state: '', zip: '' };
};

const normalizeTwoLineAddress = (rawValue) => {
  const raw = String(rawValue || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\|/g, '\n')
    .replace(/\t/g, ' ')
    .trim();
  if (!raw) return '';

  const lines = raw
    .split('\n')
    .map((line) => normalizeAddressLine(line))
    .filter(Boolean);

  if (lines.length >= 2) {
    const street = lines[0].replace(/,$/, '');
    const locality = parseLocality(lines.slice(1).join(' '));
    const second = [locality.city && locality.state ? `${locality.city}, ${locality.state}` : (locality.city || locality.state), locality.zip]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    return second ? `${street}\n${second}` : street;
  }

  const one = lines[0] || normalizeAddressLine(raw);
  const commaMatch = one.match(/^(.*?),\s*([^,]+),\s*([A-Za-z]{2}|[A-Za-z][A-Za-z .'-]+)\s+(\d{5}(?:-\d{4})?)$/);
  if (commaMatch) {
    const street = text(commaMatch[1]).replace(/,$/, '');
    const city = text(commaMatch[2]).replace(/,$/, '');
    const state = text(commaMatch[3]);
    const zip = text(commaMatch[4]);
    return `${street}\n${city}, ${state} ${zip}`.trim();
  }

  return one;
};

const apiAddressToTwoLine = (apiRow) => {
  const candidates = [apiRow.currentAddress, apiRow.address, apiRow.addresses];
  for (const value of candidates) {
    const normalized = normalizeTwoLineAddress(value);
    if (normalized) return normalized;
  }
  return '';
};

const extractDocValue = (documents, type) => {
  if (!Array.isArray(documents)) return '';
  const found = documents.find((doc) => text(doc?.type) === type);
  return text(found?.storageKey || found?.fileDataUrl || found?.fileName || '');
};

const mergeDocsFromApi = (apiRow, existingDocs) => {
  const keep = Array.isArray(existingDocs)
    ? existingDocs.filter((doc) => !DOC_FIELD_PAIRS.some(([docType]) => docType === text(doc?.type)))
    : [];
  const fixed = DOC_FIELD_PAIRS.map(([docType, apiField]) => {
    const storageValue = text(apiRow[apiField]);
    return {
      id: `sync-${docType.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      type: docType,
      includeInPrintLetters: docType === 'Limited Power of Attorney',
      printSide: 'front',
      fileName: storageValue ? storageValue.split('/').pop() : '',
      fileDataUrl: storageValue,
      storageKey: storageValue,
    };
  });
  return [...fixed, ...keep];
};

const toReportType = (agency) => {
  const normalized = text(agency).toLowerCase();
  if (normalized.includes('identity')) return 'identity';
  if (normalized.includes('myfree') || normalized.includes('freescorenow')) return 'myfreescorenow';
  if (normalized.includes('smart')) return 'smartcreadit';
  return 'identity';
};

const toAgency = (reportType) => {
  const normalized = text(reportType).toLowerCase();
  if (normalized === 'identity') return 'IdentityIQ';
  if (normalized === 'myfreescorenow') return 'MyFreeScoreNow';
  if (normalized === 'smartcreadit') return 'SmartCredit';
  return '';
};

const parseDocsJson = (rawJson) => {
  try {
    const parsed = JSON.parse(String(rawJson || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const countBy = (rows, keyFn) => {
  const counts = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    counts.set(key, Number(counts.get(key) || 0) + 1);
  }
  return counts;
};

const upsertLatestReport = async (apiPool, clientId, payload, stampSql) => {
  const [latest] = await apiPool.query(
    'SELECT id FROM Reports WHERE ClientId = ? ORDER BY updatedAt DESC, id DESC LIMIT 1',
    [clientId],
  );
  if (Array.isArray(latest) && latest.length > 0) {
    await apiPool.query(
      `UPDATE Reports
       SET username = ?, password = ?, reportType = ?, updatedAt = ?
       WHERE id = ?`,
      [payload.username, payload.password, payload.reportType, stampSql, latest[0].id],
    );
    return;
  }

  await apiPool.query(
    `INSERT INTO Reports
      (ClientId, username, password, reportType, deletetionsLists, compare, progress, accounts, alternateLetters, newVersion, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, 1, ?, ?)`,
    [clientId, payload.username, payload.password, payload.reportType, stampSql, stampSql],
  );
};

const rekeyToolsClientId = async (toolsPool, oldClientId, newClientId) => {
  if (!oldClientId || !newClientId || oldClientId === newClientId) return false;
  await toolsPool.query('START TRANSACTION');
  try {
    await toolsPool.query(
      'UPDATE client_profiles SET spouse_client_id = ? WHERE owner_key = ? AND spouse_client_id = ?',
      [newClientId, OWNER_KEY, oldClientId],
    );
    await toolsPool.query(
      'UPDATE payment_autopay SET client_id = ? WHERE owner_key = ? AND client_id = ?',
      [newClientId, OWNER_KEY, oldClientId],
    );
    await toolsPool.query(
      'UPDATE report_history SET client_id = ? WHERE client_id = ?',
      [newClientId, oldClientId],
    );
    await toolsPool.query(
      'UPDATE client_profiles SET client_id = ? WHERE owner_key = ? AND client_id = ?',
      [newClientId, OWNER_KEY, oldClientId],
    );
    await toolsPool.query('COMMIT');
    return true;
  } catch (error) {
    await toolsPool.query('ROLLBACK');
    throw error;
  }
};

const run = async () => {
  const toolsPool = mysql.createPool(toolsCfg);
  const apiPool = mysql.createPool(apiCfg);

  let running = false;
  console.log(`[bridge ${BRIDGE_VERSION}] started owner=${OWNER_KEY} tools=${toolsCfg.host}:${toolsCfg.port}/${toolsCfg.database} api=${apiCfg.host}:${apiCfg.port}/${apiCfg.database} intervalMs=${SYNC_INTERVAL_MS}`);

  const runPass = async () => {
    if (running) return;
    running = true;
    const started = Date.now();
    const counters = {
      apiToToolsInsert: 0,
      apiToToolsUpdate: 0,
      apiToToolsBackfill: 0,
      toolsToApiInsert: 0,
      toolsToApiUpdate: 0,
      toolsToApiBackfill: 0,
      rekeyed: 0,
    };

    try {
      const [apiRows] = await apiPool.query(`
        SELECT
          c.id, c.UserId, c.first_name, c.last_name, c.phone, c.email,
          c.currentAddress, c.address, c.addresses, c.ssn, c.dob,
          c.secret_question_name, c.dl_id, c.ssn_id, c.poa_id, c.poa2_id, c.poa3_id, c.cover_sheet,
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
        ) r
          ON r.ClientId = c.id
        ORDER BY c.id DESC
      `);

      const [toolsRows] = await toolsPool.query(`
        SELECT
          owner_key, client_id, first_name, last_name, email, phone, address, dob, ssn,
          status, monitoring_agency, monitoring_username, monitoring_password, secret_key,
          documents_json, report_date, updated_at
        FROM client_profiles
        WHERE owner_key = ?
        ORDER BY updated_at DESC
      `, [OWNER_KEY]);

      const toolsById = new Map();
      for (const row of toolsRows) {
        if (isNumericId(row.client_id)) toolsById.set(text(row.client_id), row);
      }
      const apiById = new Map(apiRows.map((row) => [text(row.id), row]));

      const toolsBySsn = new Map();
      for (const row of toolsRows) {
        const ssn = digits(row.ssn).slice(0, 9);
        if (ssn) toolsBySsn.set(ssn, row);
      }
      const apiBySsn = new Map();
      for (const row of apiRows) {
        const ssn = digits(row.ssn).slice(0, 9);
        if (ssn) apiBySsn.set(ssn, row);
      }

      const toolsByName = new Map(toolsRows.map((row) => [nameKey(row.first_name, row.last_name), row]));
      const apiByName = new Map(apiRows.map((row) => [nameKey(row.first_name, row.last_name), row]));
      const toolsByEmail = new Map(toolsRows.map((row) => [text(row.email).toLowerCase(), row]));
      const apiByEmail = new Map(apiRows.map((row) => [text(row.email).toLowerCase(), row]));
      const toolsNameCounts = countBy(toolsRows, (row) => nameKey(row.first_name, row.last_name));
      const apiNameCounts = countBy(apiRows, (row) => nameKey(row.first_name, row.last_name));
      const toolsEmailCounts = countBy(toolsRows, (row) => text(row.email).toLowerCase());
      const apiEmailCounts = countBy(apiRows, (row) => text(row.email).toLowerCase());

      // OLD (api) -> NEW (tools): keep grandfather fields canonical unless tools has newer data.
      for (const apiRow of apiRows) {
        const apiId = text(apiRow.id);
        const apiSsn9 = digits(apiRow.ssn).slice(0, 9);
        const apiName = nameKey(apiRow.first_name, apiRow.last_name);
        const apiEmail = text(apiRow.email).toLowerCase();

        const directIdMatch = toolsById.get(apiId) || null;
        const ssnMatch = (apiSsn9 ? toolsBySsn.get(apiSsn9) : null) || null;
        const uniqueEmailMatch = (
          !directIdMatch
          && !ssnMatch
          && apiEmail
          && Number(toolsEmailCounts.get(apiEmail) || 0) === 1
          && Number(apiEmailCounts.get(apiEmail) || 0) === 1
        ) ? (toolsByEmail.get(apiEmail) || null) : null;
        const uniqueNameMatch = (
          !directIdMatch
          && !ssnMatch
          && !uniqueEmailMatch
          && Number(toolsNameCounts.get(apiName) || 0) === 1
          && Number(apiNameCounts.get(apiName) || 0) === 1
        ) ? (toolsByName.get(apiName) || null) : null;

        let toolsMatch = directIdMatch || ssnMatch || uniqueEmailMatch || uniqueNameMatch;
        const apiUpdatedMs = Number(apiRow.sync_ts_ms || 0);

        if (!toolsMatch) {
          const clientId = apiId;
          const mergedDocs = mergeDocsFromApi(apiRow, []);
          await toolsPool.query(`
            INSERT INTO client_profiles (
              owner_key, client_id, first_name, last_name, email, phone, address, dob, ssn, status, phase,
              monitoring_agency, monitoring_username, monitoring_password, secret_key, monitoring_token,
              goal, notes, portal_password, portal_enabled, language,
              next_import_mode, manual_next_import_start_days, manual_next_import_set_date, refresh_next_import_start_date,
              documents_json, yearly_income, housing_payment, debt_monthly_payments,
              spouse_client_id, spouse_client_label, assigned_to, ninja_assigned, affiliate_assigned,
              report_date, next_import_int, next_import_label, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Client', 'None', ?, ?, ?, ?, '', '', '', '', 1, 'English', 'manual', '', '', '', ?, '', '', '', '', '', '', '', 'None', '', '', '', ?)
          `, [
            OWNER_KEY,
            clientId,
            fit(apiRow.first_name, 255),
            fit(apiRow.last_name, 255),
            fit(apiRow.email, 320),
            fit(apiRow.phone, 64),
            apiAddressToTwoLine(apiRow),
            text(apiRow.dob),
            normalizeSsn(apiRow.ssn),
            fit(toAgency(apiRow.reportType), 128),
            fit(apiRow.report_username, 320),
            text(apiRow.report_password),
            text(apiRow.secret_question_name) || ssnLast4(apiRow.ssn),
            JSON.stringify(mergedDocs),
            toIso(apiUpdatedMs || Date.now()),
          ]);
          counters.apiToToolsInsert += 1;
          continue;
        }

        const toolsClientId = text(toolsMatch.client_id);
        if (apiId !== toolsClientId && isNumericId(apiId)) {
          const [taken] = await toolsPool.query(
            'SELECT client_id FROM client_profiles WHERE owner_key = ? AND client_id = ? LIMIT 1',
            [OWNER_KEY, apiId],
          );
          if (!Array.isArray(taken) || taken.length === 0) {
            const rekeyed = await rekeyToolsClientId(toolsPool, toolsClientId, apiId);
            if (rekeyed) {
              counters.rekeyed += 1;
              toolsMatch.client_id = apiId;
            }
          }
        }

        const toolsUpdatedMs = parseMs(toolsMatch.updated_at);
        const toolsAddress = normalizeTwoLineAddress(toolsMatch.address);
        const apiAddress = apiAddressToTwoLine(apiRow);
        const fillMissing = {
          status: !text(toolsMatch.status),
          address: !toolsAddress && !!apiAddress,
          agency: !text(toolsMatch.monitoring_agency) && !!text(apiRow.reportType),
          username: !text(toolsMatch.monitoring_username) && !!text(apiRow.report_username),
          password: !text(toolsMatch.monitoring_password) && !!text(apiRow.report_password),
          secret: !text(toolsMatch.secret_key) && !!(text(apiRow.secret_question_name) || ssnLast4(apiRow.ssn)),
        };

        if (fillMissing.status || fillMissing.address || fillMissing.agency || fillMissing.username || fillMissing.password || fillMissing.secret) {
          await toolsPool.query(`
            UPDATE client_profiles
            SET
              status = ?,
              address = ?,
              monitoring_agency = ?,
              monitoring_username = ?,
              monitoring_password = ?,
              secret_key = ?,
              updated_at = ?
            WHERE owner_key = ? AND client_id = ?
          `, [
            fillMissing.status ? 'Client' : toolsMatch.status,
            fillMissing.address ? apiAddress : toolsMatch.address,
            fillMissing.agency ? fit(toAgency(apiRow.reportType), 128) : toolsMatch.monitoring_agency,
            fillMissing.username ? fit(apiRow.report_username, 320) : toolsMatch.monitoring_username,
            fillMissing.password ? text(apiRow.report_password) : toolsMatch.monitoring_password,
            fillMissing.secret ? (text(apiRow.secret_question_name) || ssnLast4(apiRow.ssn)) : toolsMatch.secret_key,
            toIso(Math.max(apiUpdatedMs, toolsUpdatedMs, Date.now())),
            OWNER_KEY,
            text(toolsMatch.client_id),
          ]);
          counters.apiToToolsBackfill += 1;
        }

        if (apiUpdatedMs > toolsUpdatedMs + DRIFT_MS) {
          const currentDocs = parseDocsJson(toolsMatch.documents_json);
          const mergedDocs = mergeDocsFromApi(apiRow, currentDocs);
          await toolsPool.query(`
            UPDATE client_profiles
            SET
              first_name = ?, last_name = ?, email = ?, phone = ?, address = ?, dob = ?, ssn = ?,
              status = ?, monitoring_agency = ?, monitoring_username = ?, monitoring_password = ?, secret_key = ?,
              documents_json = ?, updated_at = ?
            WHERE owner_key = ? AND client_id = ?
          `, [
            fit(apiRow.first_name, 255),
            fit(apiRow.last_name, 255),
            fit(apiRow.email, 320),
            fit(apiRow.phone, 64),
            apiAddress,
            text(apiRow.dob),
            normalizeSsn(apiRow.ssn),
            text(toolsMatch.status) || 'Client',
            fit(toAgency(apiRow.reportType), 128),
            fit(apiRow.report_username, 320),
            text(apiRow.report_password),
            text(apiRow.secret_question_name) || ssnLast4(apiRow.ssn),
            JSON.stringify(mergedDocs),
            toIso(apiUpdatedMs),
            OWNER_KEY,
            text(toolsMatch.client_id),
          ]);
          counters.apiToToolsUpdate += 1;
        }
      }

      // NEW (tools) -> OLD (api): create missing records and push newer edits.
      for (const toolsRow of toolsRows) {
        const toolsClientId = text(toolsRow.client_id);
        const toolsSsn9 = digits(toolsRow.ssn).slice(0, 9);
        const toolsName = nameKey(toolsRow.first_name, toolsRow.last_name);
        const toolsEmail = text(toolsRow.email).toLowerCase();

        const directIdMatch = (isNumericId(toolsClientId) ? apiById.get(toolsClientId) : null) || null;
        const ssnMatch = (toolsSsn9 ? apiBySsn.get(toolsSsn9) : null) || null;
        const uniqueEmailMatch = (
          !directIdMatch
          && !ssnMatch
          && toolsEmail
          && Number(toolsEmailCounts.get(toolsEmail) || 0) === 1
          && Number(apiEmailCounts.get(toolsEmail) || 0) === 1
        ) ? (apiByEmail.get(toolsEmail) || null) : null;
        const uniqueNameMatch = (
          !directIdMatch
          && !ssnMatch
          && !uniqueEmailMatch
          && Number(toolsNameCounts.get(toolsName) || 0) === 1
          && Number(apiNameCounts.get(toolsName) || 0) === 1
        ) ? (apiByName.get(toolsName) || null) : null;
        let apiMatch = directIdMatch || ssnMatch || uniqueEmailMatch || uniqueNameMatch;

        const toolsUpdatedMs = parseMs(toolsRow.updated_at);
        const stampSql = toApiDateTime(toolsUpdatedMs || Date.now());
        const docs = parseDocsJson(toolsRow.documents_json);

        if (!apiMatch) {
          const firstName = fit(toolsRow.first_name, 255);
          const lastName = fit(toolsRow.last_name, 255);
          if (!firstName || !lastName) continue;

          let newApiId = 0;
          try {
            const [insertResult] = await apiPool.query(`
              INSERT INTO Clients (
                UserId, first_name, last_name, phone, email, currentAddress, address, addresses, names,
                ssn, dob, secret_question_name, employers,
                dl_id, ssn_id, poa_id, poa2_id, poa3_id, cover_sheet,
                nextReminder, hasFile, createPdf, createdAt, updatedAt
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, ?, ?)
            `, [
              API_DEFAULT_USER_ID,
              firstName,
              lastName,
              fit(toolsRow.phone, 20),
              fit(toolsRow.email, 50),
              normalizeTwoLineAddress(toolsRow.address),
              normalizeTwoLineAddress(toolsRow.address),
              '[]',
              '[]',
              normalizeSsn(toolsRow.ssn) || '000-00-0000',
              normalizeDobForApi(toolsRow.dob),
              text(toolsRow.secret_key) || ssnLast4(toolsRow.ssn),
              '[]',
              extractDocValue(docs, 'ID Document'),
              extractDocValue(docs, 'SSN Document'),
              extractDocValue(docs, 'POA Document'),
              extractDocValue(docs, 'POA2 Document'),
              extractDocValue(docs, 'POA3 Document'),
              extractDocValue(docs, 'Limited Power of Attorney'),
              stampSql,
              stampSql,
            ]);
            newApiId = Number(insertResult.insertId || 0);
          } catch (error) {
            const message = String(error?.message || '');
            if (!message.includes('Duplicate entry')) throw error;
            const nextSsn = normalizeSsn(toolsRow.ssn);
            const [existing] = nextSsn
              ? await apiPool.query('SELECT id FROM Clients WHERE ssn = ? LIMIT 1', [nextSsn])
              : await apiPool.query(
                'SELECT id FROM Clients WHERE first_name = ? AND last_name = ? AND IFNULL(email,\"\") = IFNULL(?,\"\") LIMIT 1',
                [firstName, lastName, fit(toolsRow.email, 50)],
              );
            if (Array.isArray(existing) && existing.length > 0) {
              newApiId = Number(existing[0].id || 0);
            }
          }
          if (!newApiId) continue;
          await upsertLatestReport(apiPool, newApiId, {
            username: fit(toolsRow.monitoring_username, 320),
            password: text(toolsRow.monitoring_password),
            reportType: toReportType(toolsRow.monitoring_agency),
          }, stampSql);

          const newApiIdText = String(newApiId);
          if (toolsClientId !== newApiIdText) {
            const [taken] = await toolsPool.query(
              'SELECT client_id FROM client_profiles WHERE owner_key = ? AND client_id = ? LIMIT 1',
              [OWNER_KEY, newApiIdText],
            );
            if (!Array.isArray(taken) || taken.length === 0) {
              const rekeyed = await rekeyToolsClientId(toolsPool, toolsClientId, newApiIdText);
              if (rekeyed) counters.rekeyed += 1;
            }
          }
          counters.toolsToApiInsert += 1;
          continue;
        }

        const apiUpdatedMs = Number(apiMatch.sync_ts_ms || 0);
        const apiAddress = apiAddressToTwoLine(apiMatch);
        const toolsAddress = normalizeTwoLineAddress(toolsRow.address);

        const fillSecret = !text(apiMatch.secret_question_name) && !!text(toolsRow.secret_key);
        const fillAddress = !apiAddress && !!toolsAddress;
        const fillStatus = !text(toolsRow.status);
        const fillReportType = !text(apiMatch.reportType) && !!text(toolsRow.monitoring_agency);
        const fillReportUsername = !text(apiMatch.report_username) && !!text(toolsRow.monitoring_username);
        const fillReportPassword = !text(apiMatch.report_password) && !!text(toolsRow.monitoring_password);

        if (fillSecret || fillAddress) {
          await apiPool.query(`
            UPDATE Clients
            SET
              currentAddress = ?,
              address = ?,
              secret_question_name = ?,
              updatedAt = ?
            WHERE id = ?
          `, [
            fillAddress ? toolsAddress : text(apiMatch.currentAddress),
            fillAddress ? toolsAddress : text(apiMatch.address),
            fillSecret ? text(toolsRow.secret_key) : text(apiMatch.secret_question_name),
            toApiDateTime(Math.max(apiUpdatedMs, toolsUpdatedMs, Date.now())),
            apiMatch.id,
          ]);
          counters.toolsToApiBackfill += 1;
        }

        if (fillStatus) {
          await toolsPool.query(
            'UPDATE client_profiles SET status = ?, updated_at = ? WHERE owner_key = ? AND client_id = ?',
            ['Client', toIso(Date.now()), OWNER_KEY, toolsClientId],
          );
        }

        if (fillReportType || fillReportUsername || fillReportPassword) {
          await upsertLatestReport(apiPool, apiMatch.id, {
            username: fillReportUsername ? fit(toolsRow.monitoring_username, 320) : fit(apiMatch.report_username, 320),
            password: fillReportPassword ? text(toolsRow.monitoring_password) : text(apiMatch.report_password),
            reportType: fillReportType ? toReportType(toolsRow.monitoring_agency) : toReportType(apiMatch.reportType || 'identity'),
          }, toApiDateTime(Math.max(apiUpdatedMs, toolsUpdatedMs, Date.now())));
          counters.toolsToApiBackfill += 1;
        }

        if (toolsUpdatedMs > apiUpdatedMs + DRIFT_MS) {
          const desiredFirst = fit(toolsRow.first_name, 255) || fit(apiMatch.first_name, 255);
          const desiredLast = fit(toolsRow.last_name, 255) || fit(apiMatch.last_name, 255);
          const desiredPhone = fit(toolsRow.phone, 20);
          const desiredEmail = fit(toolsRow.email, 50);
          const desiredAddress = apiAddress || toolsAddress;
          const desiredDob = normalizeDobForApi(text(apiMatch.dob) || text(toolsRow.dob));
          const desiredSecret = text(apiMatch.secret_question_name) || text(toolsRow.secret_key) || ssnLast4(toolsRow.ssn);

          const alreadySynced =
            same(desiredFirst, apiMatch.first_name)
            && same(desiredLast, apiMatch.last_name)
            && same(desiredPhone, apiMatch.phone)
            && same(desiredEmail, apiMatch.email)
            && same(desiredAddress, apiAddressToTwoLine(apiMatch))
            && same(desiredSecret, apiMatch.secret_question_name);

          if (!alreadySynced) {
            await apiPool.query(`
              UPDATE Clients
              SET
                first_name = ?, last_name = ?, phone = ?, email = ?,
                currentAddress = ?, address = ?,
                ssn = ?, dob = ?, secret_question_name = ?,
                dl_id = ?, ssn_id = ?, poa_id = ?, poa2_id = ?, poa3_id = ?, cover_sheet = ?,
                updatedAt = ?
              WHERE id = ?
            `, [
              desiredFirst,
              desiredLast,
              desiredPhone,
              desiredEmail,
              desiredAddress,
              desiredAddress,
              text(apiMatch.ssn),
              desiredDob,
              desiredSecret,
              extractDocValue(docs, 'ID Document'),
              extractDocValue(docs, 'SSN Document'),
              extractDocValue(docs, 'POA Document'),
              extractDocValue(docs, 'POA2 Document'),
              extractDocValue(docs, 'POA3 Document'),
              extractDocValue(docs, 'Limited Power of Attorney'),
              stampSql,
              apiMatch.id,
            ]);

            await upsertLatestReport(apiPool, apiMatch.id, {
              username: fit(toolsRow.monitoring_username, 320),
              password: text(toolsRow.monitoring_password),
              reportType: toReportType(toolsRow.monitoring_agency),
            }, stampSql);
            counters.toolsToApiUpdate += 1;
          }
        }
      }

      const elapsed = Date.now() - started;
      console.log(
        `[bridge ${BRIDGE_VERSION}] pass ${elapsed}ms | api->tools +${counters.apiToToolsInsert} ~${counters.apiToToolsUpdate} fill=${counters.apiToToolsBackfill} | tools->api +${counters.toolsToApiInsert} ~${counters.toolsToApiUpdate} fill=${counters.toolsToApiBackfill} | rekey=${counters.rekeyed}`,
      );
    } catch (error) {
      console.error(`[bridge ${BRIDGE_VERSION}] pass failed:`, error?.stack || error?.message || error);
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
  console.error(`[bridge ${BRIDGE_VERSION}] fatal:`, error?.message || error);
  process.exit(1);
});
