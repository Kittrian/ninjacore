#!/usr/bin/env node

import mysql from 'mysql2/promise';
import 'dotenv/config';

const VERIFY_VERSION = 'v2.0.0';
const OWNER_KEY = (process.env.NINJA_SYNC_OWNER_KEY || 'admin').trim() || 'admin';
const VERIFY_TARGETS = String(process.env.VERIFY_TARGETS || 'Will Medsger,Andrew Johnson')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);

const toolsCfg = {
  host: (process.env.TOOLSNINJA_DB_HOST || '127.0.0.1').trim(),
  port: Number.parseInt(process.env.TOOLSNINJA_DB_PORT || '3306', 10) || 3306,
  user: (process.env.TOOLSNINJA_DB_USER || 'ninjacore').trim(),
  password: (process.env.TOOLSNINJA_DB_PASSWORD || '').trim(),
  database: (process.env.TOOLSNINJA_DB_NAME || 'TOOLSNINJA').trim(),
};

const apiCfg = {
  host: (process.env.API_DB_HOST || '127.0.0.1').trim(),
  port: Number.parseInt(process.env.API_DB_PORT || '3306', 10) || 3306,
  user: (process.env.API_DB_USER || 'api').trim(),
  password: (process.env.API_DB_PASSWORD || '').trim(),
  database: (process.env.API_DB_NAME || 'api').trim(),
};

if (!toolsCfg.password || !apiCfg.password) {
  console.error('Missing DB password(s): TOOLSNINJA_DB_PASSWORD and/or API_DB_PASSWORD.');
  process.exit(1);
}

const DOC_FIELDS = [
  ['ID Document', 'dl_id'],
  ['SSN Document', 'ssn_id'],
  ['POA Document', 'poa_id'],
  ['POA2 Document', 'poa2_id'],
  ['POA3 Document', 'poa3_id'],
  ['Limited Power of Attorney', 'cover_sheet'],
];

const text = (value) => String(value ?? '').trim();
const lower = (value) => text(value).toLowerCase();
const digits = (value) => String(value || '').replace(/\D/g, '');
const nameKey = (first, last) => `${lower(first)}|${lower(last)}`;
const fullName = (first, last) => `${text(first)} ${text(last)}`.replace(/\s+/g, ' ').trim();
const isNumericId = (value) => /^\d+$/.test(text(value));
const isNonEmpty = (value) => text(value).length > 0;

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
    .map((line) => text(line).replace(/\s+/g, ' '))
    .filter(Boolean);

  if (lines.length >= 2) {
    const line1 = lines[0].replace(/,$/, '');
    const line2 = lines.slice(1).join(' ').replace(/\s+/g, ' ').trim();
    return `${line1}\n${line2}`.trim();
  }

  const one = lines[0] || '';
  const commaMatch = one.match(/^(.*?),\s*([^,]+),\s*([A-Za-z]{2}|[A-Za-z][A-Za-z .'-]+)\s+(\d{5}(?:-\d{4})?)$/);
  if (commaMatch) {
    const line1 = text(commaMatch[1]).replace(/,$/, '');
    const line2 = `${text(commaMatch[2]).replace(/,$/, '')}, ${text(commaMatch[3])} ${text(commaMatch[4])}`.replace(/\s+/g, ' ').trim();
    return `${line1}\n${line2}`.trim();
  }

  return one;
};

const apiAddressToTwoLine = (apiRow) => {
  const values = [apiRow.currentAddress, apiRow.address, apiRow.addresses];
  for (const value of values) {
    const normalized = normalizeTwoLineAddress(value);
    if (normalized) return normalized;
  }
  return '';
};

const normalizeDocValue = (value) => text(value);

const extractDocFromTools = (documents, type) => {
  if (!Array.isArray(documents)) return '';
  const doc = documents.find((entry) => text(entry?.type) === type);
  return normalizeDocValue(doc?.storageKey || doc?.fileDataUrl || doc?.fileName || '');
};

const parseToolsDocuments = (jsonValue) => {
  try {
    const parsed = JSON.parse(String(jsonValue || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const pushSample = (bucket, payload, max = 10) => {
  if (bucket.length < max) bucket.push(payload);
};

const inc = (obj, key) => {
  obj[key] = Number(obj[key] || 0) + 1;
};

const mapMulti = (rows, keyFn) => {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
};

const main = async () => {
  const tools = await mysql.createConnection(toolsCfg);
  const api = await mysql.createConnection(apiCfg);

  try {
    const [toolsRows] = await tools.query(`
      SELECT
        client_id, first_name, last_name, email, phone, ssn, address,
        monitoring_username, monitoring_password, secret_key, documents_json
      FROM client_profiles
      WHERE owner_key = ?
    `, [OWNER_KEY]);

    const [apiRows] = await api.query(`
      SELECT
        c.id, c.first_name, c.last_name, c.email, c.phone, c.ssn,
        c.currentAddress, c.address, c.addresses,
        c.secret_question_name,
        c.dl_id, c.ssn_id, c.poa_id, c.poa2_id, c.poa3_id, c.cover_sheet,
        r.username AS report_username, r.password AS report_password
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
    `);

    const apiById = new Map(apiRows.map((row) => [text(row.id), row]));
    const apiBySsn = mapMulti(apiRows, (row) => digits(row.ssn).slice(0, 9));
    const toolsBySsn = mapMulti(toolsRows, (row) => digits(row.ssn).slice(0, 9));
    const apiByEmail = mapMulti(apiRows, (row) => lower(row.email));
    const toolsByEmail = mapMulti(toolsRows, (row) => lower(row.email));
    const apiByName = mapMulti(apiRows, (row) => nameKey(row.first_name, row.last_name));
    const toolsByName = mapMulti(toolsRows, (row) => nameKey(row.first_name, row.last_name));

    const results = {
      verifier_version: VERIFY_VERSION,
      owner_key: OWNER_KEY,
      totals: {
        tools_rows: toolsRows.length,
        api_rows: apiRows.length,
        matched_tools_rows: 0,
        unmatched_tools_rows: 0,
        unmatched_api_rows: 0,
      },
      match_reasons: {
        by_numeric_client_id: 0,
        by_unique_ssn: 0,
        by_unique_email: 0,
        by_unique_name: 0,
        unmatched: 0,
      },
      profile: {
        first_name_mismatch: 0,
        last_name_mismatch: 0,
        email_mismatch: 0,
        phone_mismatch: 0,
        phone_format_only_mismatch: 0,
        ssn_mismatch: 0,
        ssn_format_only_mismatch: 0,
      },
      credentials: {
        username_mismatch: 0,
        password_mismatch: 0,
        secret_mismatch: 0,
        username_blank_in_tools_but_present_in_api: 0,
        password_blank_in_tools_but_present_in_api: 0,
        secret_blank_in_tools_but_present_in_api: 0,
      },
      address: {
        exact_match: 0,
        mismatch: 0,
        blank_in_tools_but_present_in_api: 0,
        blank_in_api_but_present_in_tools: 0,
      },
      documents: {
        rows_with_any_doc_mismatch: 0,
        mismatches_by_type: Object.fromEntries(DOC_FIELDS.map(([label]) => [label, 0])),
        blank_in_tools_but_present_in_api_by_type: Object.fromEntries(DOC_FIELDS.map(([label]) => [label, 0])),
      },
      samples: {
        unmatched_tools: [],
        unmatched_api: [],
        profile: [],
        credentials: [],
        address: [],
        documents: [],
      },
      targeted_checks: [],
    };

    const matchedApiIds = new Set();
    const toolMatches = new Map();

    for (const toolRow of toolsRows) {
      const clientId = text(toolRow.client_id);
      const ssn9 = digits(toolRow.ssn).slice(0, 9);
      const email = lower(toolRow.email);
      const nKey = nameKey(toolRow.first_name, toolRow.last_name);

      let apiRow = null;
      let reason = 'unmatched';

      if (isNumericId(clientId) && apiById.has(clientId)) {
        apiRow = apiById.get(clientId);
        reason = 'by_numeric_client_id';
      } else if (ssn9 && (apiBySsn.get(ssn9)?.length || 0) === 1 && (toolsBySsn.get(ssn9)?.length || 0) === 1) {
        apiRow = apiBySsn.get(ssn9)[0];
        reason = 'by_unique_ssn';
      } else if (email && (apiByEmail.get(email)?.length || 0) === 1 && (toolsByEmail.get(email)?.length || 0) === 1) {
        apiRow = apiByEmail.get(email)[0];
        reason = 'by_unique_email';
      } else if (nKey && (apiByName.get(nKey)?.length || 0) === 1 && (toolsByName.get(nKey)?.length || 0) === 1) {
        apiRow = apiByName.get(nKey)[0];
        reason = 'by_unique_name';
      }

      if (!apiRow) {
        results.totals.unmatched_tools_rows += 1;
        inc(results.match_reasons, 'unmatched');
        pushSample(results.samples.unmatched_tools, {
          client_id: clientId,
          name: fullName(toolRow.first_name, toolRow.last_name),
          email: text(toolRow.email),
          phone: text(toolRow.phone),
          ssn: text(toolRow.ssn),
        });
        continue;
      }

      results.totals.matched_tools_rows += 1;
      inc(results.match_reasons, reason);
      matchedApiIds.add(text(apiRow.id));
      toolMatches.set(clientId, { api_id: text(apiRow.id), reason });

      const toolFirst = text(toolRow.first_name);
      const toolLast = text(toolRow.last_name);
      const toolEmail = text(toolRow.email);
      const toolPhone = text(toolRow.phone);
      const toolSsn = text(toolRow.ssn);
      const toolUser = text(toolRow.monitoring_username);
      const toolPass = text(toolRow.monitoring_password);
      const toolSecret = text(toolRow.secret_key);

      const apiFirst = text(apiRow.first_name);
      const apiLast = text(apiRow.last_name);
      const apiEmailValue = text(apiRow.email);
      const apiPhone = text(apiRow.phone);
      const apiSsn = text(apiRow.ssn);
      const apiUser = text(apiRow.report_username);
      const apiPass = text(apiRow.report_password);
      const apiSecret = text(apiRow.secret_question_name);

      if (toolFirst !== apiFirst) inc(results.profile, 'first_name_mismatch');
      if (toolLast !== apiLast) inc(results.profile, 'last_name_mismatch');
      if (toolEmail !== apiEmailValue) inc(results.profile, 'email_mismatch');
      if (toolPhone !== apiPhone) {
        inc(results.profile, 'phone_mismatch');
        if (digits(toolPhone) && digits(toolPhone) === digits(apiPhone)) inc(results.profile, 'phone_format_only_mismatch');
      }
      if (toolSsn !== apiSsn) {
        inc(results.profile, 'ssn_mismatch');
        if (digits(toolSsn) && digits(toolSsn) === digits(apiSsn)) inc(results.profile, 'ssn_format_only_mismatch');
      }

      if (
        toolFirst !== apiFirst
        || toolLast !== apiLast
        || toolEmail !== apiEmailValue
        || toolPhone !== apiPhone
        || toolSsn !== apiSsn
      ) {
        pushSample(results.samples.profile, {
          client_id: clientId,
          api_id: text(apiRow.id),
          reason,
          name: fullName(toolRow.first_name, toolRow.last_name),
          tools: { first_name: toolFirst, last_name: toolLast, email: toolEmail, phone: toolPhone, ssn: toolSsn },
          api: { first_name: apiFirst, last_name: apiLast, email: apiEmailValue, phone: apiPhone, ssn: apiSsn },
        });
      }

      if (isNonEmpty(apiUser) && !isNonEmpty(toolUser)) inc(results.credentials, 'username_blank_in_tools_but_present_in_api');
      if (isNonEmpty(apiPass) && !isNonEmpty(toolPass)) inc(results.credentials, 'password_blank_in_tools_but_present_in_api');
      if (isNonEmpty(apiSecret) && !isNonEmpty(toolSecret)) inc(results.credentials, 'secret_blank_in_tools_but_present_in_api');
      if (toolUser !== apiUser) inc(results.credentials, 'username_mismatch');
      if (toolPass !== apiPass) inc(results.credentials, 'password_mismatch');
      if (toolSecret !== apiSecret) inc(results.credentials, 'secret_mismatch');

      if (toolUser !== apiUser || toolPass !== apiPass || toolSecret !== apiSecret) {
        pushSample(results.samples.credentials, {
          client_id: clientId,
          api_id: text(apiRow.id),
          reason,
          name: fullName(toolRow.first_name, toolRow.last_name),
          tools: { username: toolUser, password: toolPass, secret: toolSecret },
          api: { username: apiUser, password: apiPass, secret: apiSecret },
        });
      }

      const toolsAddress = normalizeTwoLineAddress(toolRow.address);
      const apiAddress = apiAddressToTwoLine(apiRow);
      if (apiAddress && !toolsAddress) inc(results.address, 'blank_in_tools_but_present_in_api');
      if (!apiAddress && toolsAddress) inc(results.address, 'blank_in_api_but_present_in_tools');
      if (toolsAddress === apiAddress) {
        inc(results.address, 'exact_match');
      } else {
        inc(results.address, 'mismatch');
        pushSample(results.samples.address, {
          client_id: clientId,
          api_id: text(apiRow.id),
          reason,
          name: fullName(toolRow.first_name, toolRow.last_name),
          tools_address: toolsAddress,
          api_address: apiAddress,
        });
      }

      const docs = parseToolsDocuments(toolRow.documents_json);
      let rowHasDocMismatch = false;
      for (const [docType, apiField] of DOC_FIELDS) {
        const toolsDoc = extractDocFromTools(docs, docType);
        const apiDoc = normalizeDocValue(apiRow[apiField]);
        if (apiDoc && !toolsDoc) inc(results.documents.blank_in_tools_but_present_in_api_by_type, docType);
        if (toolsDoc !== apiDoc) {
          inc(results.documents.mismatches_by_type, docType);
          rowHasDocMismatch = true;
          pushSample(results.samples.documents, {
            client_id: clientId,
            api_id: text(apiRow.id),
            reason,
            name: fullName(toolRow.first_name, toolRow.last_name),
            type: docType,
            tools_document: toolsDoc,
            api_document: apiDoc,
          });
        }
      }
      if (rowHasDocMismatch) inc(results.documents, 'rows_with_any_doc_mismatch');
    }

    for (const apiRow of apiRows) {
      if (!matchedApiIds.has(text(apiRow.id))) {
        results.totals.unmatched_api_rows += 1;
        pushSample(results.samples.unmatched_api, {
          api_id: text(apiRow.id),
          name: fullName(apiRow.first_name, apiRow.last_name),
          email: text(apiRow.email),
          phone: text(apiRow.phone),
          ssn: text(apiRow.ssn),
        });
      }
    }

    for (const target of VERIFY_TARGETS) {
      const targetKey = lower(target).replace(/\s+/g, ' ');
      const toolsCandidates = toolsRows.filter((row) => lower(fullName(row.first_name, row.last_name)) === targetKey);
      const apiCandidates = apiRows.filter((row) => lower(fullName(row.first_name, row.last_name)) === targetKey);

      const entry = {
        target,
        tools_count: toolsCandidates.length,
        api_count: apiCandidates.length,
        status: 'PASS',
        details: [],
      };

      if (toolsCandidates.length === 0) {
        entry.status = 'FAIL';
        entry.details.push('missing_in_tools');
      }
      if (apiCandidates.length === 0) {
        entry.status = 'FAIL';
        entry.details.push('missing_in_api');
      }
      if (toolsCandidates.length > 1) {
        entry.status = 'FAIL';
        entry.details.push('multiple_rows_in_tools');
      }
      if (apiCandidates.length > 1) {
        entry.status = 'FAIL';
        entry.details.push('multiple_rows_in_api');
      }

      if (toolsCandidates.length === 1 && apiCandidates.length === 1) {
        const toolRow = toolsCandidates[0];
        const apiRow = apiCandidates[0];
        const matchInfo = toolMatches.get(text(toolRow.client_id));
        if (!matchInfo || text(matchInfo.api_id) !== text(apiRow.id)) {
          entry.status = 'FAIL';
          entry.details.push('not_matched_to_same_record');
        } else {
          entry.details.push(`matched_by_${matchInfo.reason}`);
        }

        const addressMatch = normalizeTwoLineAddress(toolRow.address) === apiAddressToTwoLine(apiRow);
        const ssnMatch = digits(toolRow.ssn) === digits(apiRow.ssn);
        if (!addressMatch) {
          entry.status = 'FAIL';
          entry.details.push('address_mismatch');
        }
        if (!ssnMatch) {
          entry.status = 'FAIL';
          entry.details.push('ssn_mismatch');
        }
      }

      results.targeted_checks.push(entry);
    }

    console.log(JSON.stringify(results, null, 2));
  } finally {
    await tools.end();
    await api.end();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

