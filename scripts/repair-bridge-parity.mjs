#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import mysql from 'mysql2/promise';

const OWNER_KEY = 'admin';

const FIXED_DOC_TYPES = [
  'ID Document',
  'SSN Document',
  'POA Document',
  'POA2 Document',
  'POA3 Document',
  'Limited Power of Attorney',
];

const STATE_ABBREVIATIONS = new Map([
  ['alabama', 'AL'], ['alaska', 'AK'], ['arizona', 'AZ'], ['arkansas', 'AR'], ['california', 'CA'],
  ['colorado', 'CO'], ['connecticut', 'CT'], ['delaware', 'DE'], ['florida', 'FL'], ['georgia', 'GA'],
  ['hawaii', 'HI'], ['idaho', 'ID'], ['illinois', 'IL'], ['indiana', 'IN'], ['iowa', 'IA'],
  ['kansas', 'KS'], ['kentucky', 'KY'], ['louisiana', 'LA'], ['maine', 'ME'], ['maryland', 'MD'],
  ['massachusetts', 'MA'], ['michigan', 'MI'], ['minnesota', 'MN'], ['mississippi', 'MS'], ['missouri', 'MO'],
  ['montana', 'MT'], ['nebraska', 'NE'], ['nevada', 'NV'], ['new hampshire', 'NH'], ['new jersey', 'NJ'],
  ['new mexico', 'NM'], ['new york', 'NY'], ['north carolina', 'NC'], ['north dakota', 'ND'], ['ohio', 'OH'],
  ['oklahoma', 'OK'], ['oregon', 'OR'], ['pennsylvania', 'PA'], ['rhode island', 'RI'], ['south carolina', 'SC'],
  ['south dakota', 'SD'], ['tennessee', 'TN'], ['texas', 'TX'], ['utah', 'UT'], ['vermont', 'VT'],
  ['virginia', 'VA'], ['washington', 'WA'], ['west virginia', 'WV'], ['wisconsin', 'WI'], ['wyoming', 'WY'],
  ['district of columbia', 'DC'],
]);

const safeText = (value) => String(value ?? '').trim();
const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');
const ssnLast4 = (value) => {
  const digits = normalizeDigits(value);
  return digits.length >= 4 ? digits.slice(-4) : '';
};

const normalizeState = (value) => {
  const raw = safeText(value).replace(/\./g, '');
  if (!raw) return '';
  if (raw.length === 2) return raw.toUpperCase();
  return STATE_ABBREVIATIONS.get(raw.toLowerCase()) || raw.toUpperCase();
};

const parseLocality = (value) => {
  const locality = safeText(value).replace(/\s+/g, ' ');
  if (!locality) {
    return { city: '', state: '', zip: '' };
  }

  const withZip = locality.match(/^(.*?)[,\s]+([A-Za-z]{2}|[A-Za-z][A-Za-z .'-]+)\s+(\d{5}(?:-\d{4})?)$/);
  if (withZip) {
    return {
      city: safeText(withZip[1]).replace(/,$/, ''),
      state: normalizeState(withZip[2]),
      zip: safeText(withZip[3]),
    };
  }

  const stateOnly = locality.match(/^(.*?)[,\s]+([A-Za-z]{2}|[A-Za-z][A-Za-z .'-]+)$/);
  if (stateOnly) {
    return {
      city: safeText(stateOnly[1]).replace(/,$/, ''),
      state: normalizeState(stateOnly[2]),
      zip: '',
    };
  }

  return { city: locality.replace(/,$/, ''), state: '', zip: '' };
};

const canonicalizeAddress = (value) => {
  const raw = safeText(value);
  if (!raw) return '';
  const cleaned = raw
    .replace(/,\s*(United States(?: of America)?|USA)\s*$/i, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\s{2,}/g, ' ')
    .trim();

  let street = '';
  let city = '';
  let state = '';
  let zip = '';

  if (cleaned.includes('|')) {
    const [streetPart, localityPart] = cleaned.split('|');
    street = safeText(streetPart).replace(/,$/, '');
    const parsed = parseLocality(localityPart || '');
    city = parsed.city;
    state = parsed.state;
    zip = parsed.zip;
  } else {
    const lines = cleaned.split('\n').map((line) => safeText(line)).filter(Boolean);
    if (lines.length >= 2) {
      street = safeText(lines[0]).replace(/,$/, '');
      const parsed = parseLocality(lines.slice(1).join(' '));
      city = parsed.city;
      state = parsed.state;
      zip = parsed.zip;
    } else {
      const one = lines[0] || cleaned;
      const oneLine = one.replace(/\s+/g, ' ').trim();
      const fullMatch = oneLine.match(/^(.*?),\s*([^,]+),\s*([A-Za-z]{2}|[A-Za-z][A-Za-z .'-]+)\s+(\d{5}(?:-\d{4})?)$/)
        || oneLine.match(/^(.*?)\s+([A-Za-z][A-Za-z .'-]+)\s+([A-Za-z]{2}|[A-Za-z][A-Za-z .'-]+)\s+(\d{5}(?:-\d{4})?)$/);
      if (fullMatch) {
        street = safeText(fullMatch[1]).replace(/,$/, '');
        city = safeText(fullMatch[2]).replace(/,$/, '');
        state = normalizeState(fullMatch[3]);
        zip = safeText(fullMatch[4]);
      } else {
        street = oneLine;
      }
    }
  }

  const line1 = safeText(street);
  const line2 = [
    city && state ? `${city}, ${state}` : (city || state),
    zip,
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  if (line1 && line2) return `${line1} | ${line2}`;
  return line1 || line2;
};

const scoreAddress = (value) => {
  const s = safeText(value);
  if (!s) return 0;
  let score = 1;
  if (s.includes('|')) score += 2;
  if (/\d{5}(?:-\d{4})?/.test(s)) score += 2;
  if (/,\s*[A-Z]{2}\b/.test(s)) score += 2;
  if (/\d/.test(s.split('|')[0] || s)) score += 1;
  return score;
};

const reportTypeFromAgency = (agency) => {
  const v = safeText(agency).toLowerCase();
  if (v.includes('identity')) return 'identity';
  if (v.includes('myfree') || v.includes('freescorenow')) return 'myfreescorenow';
  if (v.includes('smart')) return 'smartcreadit';
  return '';
};

const agencyFromReportType = (reportType) => {
  const v = safeText(reportType).toLowerCase();
  if (v === 'identity') return 'IdentityIQ';
  if (v === 'myfreescorenow') return 'MyFreeScoreNow';
  if (v === 'smartcreadit') return 'SmartCredit';
  return '';
};

const selectBestValue = (...values) => {
  for (const value of values) {
    const v = safeText(value);
    if (v) return v;
  }
  return '';
};

const extractDocByType = (documents, type) => {
  if (!Array.isArray(documents)) return '';
  const found = documents.find((doc) => safeText(doc?.type) === type);
  return safeText(found?.storageKey || found?.fileDataUrl || found?.fileName || '');
};

const upsertDocByType = (documents, type, storageValue) => {
  const value = safeText(storageValue);
  const docId = `sync-${type.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const nextDocs = Array.isArray(documents) ? [...documents] : [];
  const idx = nextDocs.findIndex((doc) => safeText(doc?.type) === type);
  const fileName = value.split('/').pop() || value;
  const payload = {
    id: docId,
    type,
    includeInPrintLetters: type === 'Limited Power of Attorney',
    printSide: 'front',
    fileName,
    fileDataUrl: value,
    storageKey: value,
  };
  if (idx >= 0) {
    nextDocs[idx] = { ...nextDocs[idx], ...payload };
  } else {
    nextDocs.push(payload);
  }
  return nextDocs;
};

const getBridgeEnv = () => {
  const pm2Json = execSync('pm2 jlist', { encoding: 'utf8' });
  const apps = JSON.parse(pm2Json);
  const target = apps.find((app) => app.name === 'tools-api-bridge')
    || apps.find((app) => app.name === 'ninjacore');
  if (!target?.pm2_env?.env) {
    throw new Error('Could not find PM2 env for tools-api-bridge or ninjacore.');
  }
  return target.pm2_env.env;
};

const readBackupAddressMap = (dataDir) => {
  const files = fs.readdirSync(dataDir)
    .filter((name) => /^backup_address_recovery_candidates_\d+\.json$/i.test(name))
    .sort();
  if (!files.length) return new Map();
  const latest = path.join(dataDir, files[files.length - 1]);
  const payload = JSON.parse(fs.readFileSync(latest, 'utf8'));
  const rows = Array.isArray(payload?.all) ? payload.all : [];
  const map = new Map();
  for (const row of rows) {
    const id = safeText(row?.id);
    const address = canonicalizeAddress(row?.backup_address || '');
    if (id && address) {
      map.set(id, address);
    }
  }
  return map;
};

const main = async () => {
  const env = getBridgeEnv();
  const owner = safeText(env.NINJA_SYNC_OWNER_KEY || OWNER_KEY) || OWNER_KEY;
  const tools = await mysql.createConnection({
    host: env.TOOLSNINJA_DB_HOST,
    port: Number.parseInt(env.TOOLSNINJA_DB_PORT || '3306', 10),
    user: env.TOOLSNINJA_DB_USER,
    password: env.TOOLSNINJA_DB_PASSWORD,
    database: env.TOOLSNINJA_DB_NAME,
    dateStrings: true,
  });
  const api = await mysql.createConnection({
    host: env.API_DB_HOST,
    port: Number.parseInt(env.API_DB_PORT || '3306', 10),
    user: env.API_DB_USER,
    password: env.API_DB_PASSWORD,
    database: env.API_DB_NAME,
    dateStrings: true,
  });

  try {
    const dataDir = path.resolve(process.cwd(), 'data');
    const backupAddressMap = readBackupAddressMap(dataDir);

    const [toolsRows] = await tools.execute(
      `SELECT
         client_id, external_client_id, first_name, last_name, ssn, address, updated_at,
         monitoring_agency, monitoring_username, monitoring_password, secret_key, documents_json
       FROM client_profiles
       WHERE owner_key = ?
         AND TRIM(COALESCE(external_client_id, '')) REGEXP '^[0-9]+$'`,
      [owner],
    );
    const [apiRows] = await api.execute(
      `SELECT
         c.id, c.currentAddress, c.address, c.updatedAt, c.ssn, c.secret_question_name,
         c.dl_id, c.ssn_id, c.poa_id, c.poa2_id, c.poa3_id, c.cover_sheet,
         r.username AS report_username, r.password AS report_password, r.reportType
       FROM Clients c
       LEFT JOIN (
         SELECT r1.*
         FROM Reports r1
         INNER JOIN (
           SELECT ClientId, MAX(updatedAt) AS max_updated
           FROM Reports
           GROUP BY ClientId
         ) latest ON latest.ClientId = r1.ClientId AND latest.max_updated = r1.updatedAt
       ) r ON r.ClientId = c.id`,
    );

    const apiById = new Map(apiRows.map((row) => [safeText(row.id), row]));

    const nowIso = new Date().toISOString();
    const nowSql = new Date(nowIso).toISOString().slice(0, 19).replace('T', ' ');

    let addressBackfilledFromBackup = 0;
    let addressUpdatedTools = 0;
    let addressUpdatedApi = 0;
    let credsUpdatedTools = 0;
    let credsUpdatedApi = 0;
    let docsUpdatedTools = 0;
    let docsUpdatedApi = 0;
    let secretUpdatedTools = 0;
    let secretUpdatedApi = 0;

    for (const toolsRow of toolsRows) {
      const apiId = safeText(toolsRow.external_client_id);
      const apiRow = apiById.get(apiId);
      if (!apiRow) continue;

      let toolsDocs = [];
      try {
        toolsDocs = JSON.parse(String(toolsRow.documents_json || '[]'));
      } catch {
        toolsDocs = [];
      }

      const tAddr = canonicalizeAddress(toolsRow.address);
      const aAddr = canonicalizeAddress(selectBestValue(apiRow.currentAddress, apiRow.address));
      const bAddr = canonicalizeAddress(backupAddressMap.get(apiId) || '');

      let targetAddress = '';
      if (tAddr && aAddr) {
        targetAddress = scoreAddress(tAddr) >= scoreAddress(aAddr) ? tAddr : aAddr;
      } else {
        targetAddress = selectBestValue(tAddr, aAddr, bAddr);
      }
      if (!tAddr && !aAddr && targetAddress && targetAddress === bAddr) {
        addressBackfilledFromBackup += 1;
      }

      if (targetAddress && tAddr !== targetAddress) {
        await tools.execute(
          `UPDATE client_profiles
           SET address = ?, updated_at = ?
           WHERE owner_key = ? AND client_id = ?`,
          [targetAddress, nowIso, owner, toolsRow.client_id],
        );
        addressUpdatedTools += 1;
      }
      if (targetAddress && aAddr !== targetAddress) {
        await api.execute(
          `UPDATE Clients
           SET currentAddress = ?, address = ?, updatedAt = ?
           WHERE id = ?`,
          [targetAddress, targetAddress, nowSql, apiRow.id],
        );
        addressUpdatedApi += 1;
      }

      const targetReportType = selectBestValue(reportTypeFromAgency(toolsRow.monitoring_agency), apiRow.reportType, 'identity');
      const targetAgency = selectBestValue(agencyFromReportType(targetReportType), toolsRow.monitoring_agency);
      const targetUsername = selectBestValue(toolsRow.monitoring_username, apiRow.report_username);
      const targetPassword = selectBestValue(toolsRow.monitoring_password, apiRow.report_password);

      if (
        safeText(toolsRow.monitoring_agency) !== targetAgency
        || safeText(toolsRow.monitoring_username) !== targetUsername
        || safeText(toolsRow.monitoring_password) !== targetPassword
      ) {
        await tools.execute(
          `UPDATE client_profiles
           SET monitoring_agency = ?, monitoring_username = ?, monitoring_password = ?, updated_at = ?
           WHERE owner_key = ? AND client_id = ?`,
          [targetAgency, targetUsername, targetPassword, nowIso, owner, toolsRow.client_id],
        );
        credsUpdatedTools += 1;
      }

      if (
        safeText(apiRow.reportType) !== targetReportType
        || safeText(apiRow.report_username) !== targetUsername
        || safeText(apiRow.report_password) !== targetPassword
      ) {
        await api.execute(
          `INSERT INTO Reports
             (ClientId, username, password, reportType, deletetionsLists, compare, progress, accounts, alternateLetters, newVersion, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, 1, ?, ?)
           ON DUPLICATE KEY UPDATE
             username = VALUES(username),
             password = VALUES(password),
             reportType = VALUES(reportType),
             updatedAt = VALUES(updatedAt)`,
          [apiRow.id, targetUsername, targetPassword, targetReportType, nowSql, nowSql],
        );
        credsUpdatedApi += 1;
      }

      const docFields = [
        { type: 'ID Document', apiValue: apiRow.dl_id, apiCol: 'dl_id' },
        { type: 'SSN Document', apiValue: apiRow.ssn_id, apiCol: 'ssn_id' },
        { type: 'POA Document', apiValue: apiRow.poa_id, apiCol: 'poa_id' },
        { type: 'POA2 Document', apiValue: apiRow.poa2_id, apiCol: 'poa2_id' },
        { type: 'POA3 Document', apiValue: apiRow.poa3_id, apiCol: 'poa3_id' },
        { type: 'Limited Power of Attorney', apiValue: apiRow.cover_sheet, apiCol: 'cover_sheet' },
      ];

      let toolsDocsChanged = false;
      let apiDocsChanged = false;
      const apiDocPatch = {};
      for (const field of docFields) {
        const toolsValue = extractDocByType(toolsDocs, field.type);
        const apiValue = safeText(field.apiValue);
        const target = selectBestValue(toolsValue, apiValue);
        if (target && toolsValue !== target) {
          toolsDocs = upsertDocByType(toolsDocs, field.type, target);
          toolsDocsChanged = true;
        }
        if (target && apiValue !== target) {
          apiDocPatch[field.apiCol] = target;
          apiDocsChanged = true;
        }
      }

      if (toolsDocsChanged) {
        await tools.execute(
          `UPDATE client_profiles
           SET documents_json = ?, updated_at = ?
           WHERE owner_key = ? AND client_id = ?`,
          [JSON.stringify(toolsDocs), nowIso, owner, toolsRow.client_id],
        );
        docsUpdatedTools += 1;
      }

      if (apiDocsChanged) {
        const setCols = Object.keys(apiDocPatch)
          .map((col) => `${col} = ?`)
          .join(', ');
        const params = [...Object.values(apiDocPatch), nowSql, apiRow.id];
        await api.execute(
          `UPDATE Clients
           SET ${setCols}, updatedAt = ?
           WHERE id = ?`,
          params,
        );
        docsUpdatedApi += 1;
      }

      const targetSecret = selectBestValue(
        toolsRow.secret_key,
        apiRow.secret_question_name,
        targetReportType === 'identity' ? ssnLast4(selectBestValue(toolsRow.ssn, apiRow.ssn)) : '',
      );
      if (targetSecret && safeText(toolsRow.secret_key) !== targetSecret) {
        await tools.execute(
          `UPDATE client_profiles
           SET secret_key = ?, updated_at = ?
           WHERE owner_key = ? AND client_id = ?`,
          [targetSecret, nowIso, owner, toolsRow.client_id],
        );
        secretUpdatedTools += 1;
      }
      if (targetSecret && safeText(apiRow.secret_question_name) !== targetSecret) {
        await api.execute(
          `UPDATE Clients
           SET secret_question_name = ?, updatedAt = ?
           WHERE id = ?`,
          [targetSecret, nowSql, apiRow.id],
        );
        secretUpdatedApi += 1;
      }
    }

    const summary = {
      owner,
      rowsScanned: toolsRows.length,
      backupAddressRowsAvailable: backupAddressMap.size,
      addressBackfilledFromBackup,
      addressUpdatedTools,
      addressUpdatedApi,
      credsUpdatedTools,
      credsUpdatedApi,
      docsUpdatedTools,
      docsUpdatedApi,
      secretUpdatedTools,
      secretUpdatedApi,
    };
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await tools.end();
    await api.end();
  }
};

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
