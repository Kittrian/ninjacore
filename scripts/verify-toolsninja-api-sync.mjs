#!/usr/bin/env node

import mysql from 'mysql2/promise';
import 'dotenv/config';

const OWNER_KEY = (process.env.NINJA_SYNC_OWNER_KEY || 'admin').trim() || 'admin';

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

const FIXED_DOC_TYPES = [
  ['ID Document', 'dl_id'],
  ['SSN Document', 'ssn_id'],
  ['POA Document', 'poa_id'],
  ['POA2 Document', 'poa2_id'],
  ['POA3 Document', 'poa3_id'],
  ['Limited Power of Attorney', 'cover_sheet'],
];

const text = (v) => String(v ?? '').trim();
const digits = (v) => String(v || '').replace(/\D/g, '');
const normalizeLine = (value) => text(value).replace(/\s+/g, ' ').trim();
const splitApiAddressLines = (value) => String(value || '')
  .replace(/\r/g, '\n')
  .replace(/\t/g, ' ')
  .split('\n')
  .map((line) => normalizeLine(line))
  .filter(Boolean);
const splitToolsAddressParts = (value) => {
  const raw = text(value);
  if (!raw) return [];
  if (raw.includes('|')) {
    return raw.split('|').map((part) => normalizeLine(part)).filter(Boolean);
  }
  return splitApiAddressLines(raw);
};
const toToolsAddress = (line1, line2 = '') => {
  const first = normalizeLine(line1);
  const second = normalizeLine(line2);
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

const extractDocValue = (documents, type) => {
  if (!Array.isArray(documents)) return '';
  const found = documents.find((doc) => text(doc?.type) === type);
  return text(found?.storageKey || found?.fileDataUrl || found?.fileName || '');
};

const main = async () => {
  const tools = await mysql.createConnection(toolsCfg);
  const api = await mysql.createConnection(apiCfg);

  try {
    const [toolRows] = await tools.query(
      `SELECT client_id, external_client_id, first_name, last_name, email, phone, ssn, address,
              monitoring_username, monitoring_password, secret_key, documents_json
         FROM client_profiles
        WHERE owner_key = ?
          AND TRIM(COALESCE(external_client_id, '')) REGEXP '^[0-9]+$'`,
      [OWNER_KEY],
    );
    const [apiRows] = await api.query(
      `SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.ssn, c.currentAddress, c.address, c.addresses,
              c.secret_question_name, c.dl_id, c.ssn_id, c.poa_id, c.poa2_id, c.poa3_id, c.cover_sheet,
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
         ) r
           ON r.ClientId = c.id`,
    );

    const apiById = new Map(apiRows.map((row) => [text(row.id), row]));
    const results = {
      linked_rows_checked: 0,
      missing_api_match: 0,
      profile: {
        first_name_mismatch: 0,
        last_name_mismatch: 0,
        email_mismatch: 0,
        phone_mismatch: 0,
        phone_format_only_mismatch: 0,
        ssn_mismatch: 0,
        ssn_blank_tools_api_present: 0,
        ssn_format_only_mismatch: 0,
      },
      credentials: {
        username_mismatch: 0,
        password_mismatch: 0,
        secret_mismatch: 0,
        username_tools_blank_api_present: 0,
        password_tools_blank_api_present: 0,
        secret_tools_blank_api_present: 0,
      },
      address: {
        exact_normalized_match: 0,
        mismatch: 0,
        tools_blank_api_present: 0,
        api_blank_tools_present: 0,
      },
      documents: {
        rows_with_doc_mismatch: 0,
        mismatches_by_type: Object.fromEntries(FIXED_DOC_TYPES.map(([label]) => [label, 0])),
        tools_blank_api_present_by_type: Object.fromEntries(FIXED_DOC_TYPES.map(([label]) => [label, 0])),
      },
      samples: {
        profile: [],
        credential: [],
        address: [],
        document: [],
      },
    };

    for (const toolRow of toolRows) {
      results.linked_rows_checked += 1;
      const apiRow = apiById.get(text(toolRow.external_client_id));
      if (!apiRow) {
        results.missing_api_match += 1;
        continue;
      }

      const apiUsername = text(apiRow.report_username);
      const apiPassword = text(apiRow.report_password);
      const apiSecret = text(apiRow.secret_question_name);
      const apiFirstName = text(apiRow.first_name);
      const apiLastName = text(apiRow.last_name);
      const apiEmail = text(apiRow.email);
      const apiPhone = text(apiRow.phone);
      const apiSsn = text(apiRow.ssn);
      const toolFirstName = text(toolRow.first_name);
      const toolLastName = text(toolRow.last_name);
      const toolEmail = text(toolRow.email);
      const toolPhone = text(toolRow.phone);
      const toolSsn = text(toolRow.ssn);
      const toolUsername = text(toolRow.monitoring_username);
      const toolPassword = text(toolRow.monitoring_password);
      const toolSecret = text(toolRow.secret_key);

      if (toolFirstName !== apiFirstName) results.profile.first_name_mismatch += 1;
      if (toolLastName !== apiLastName) results.profile.last_name_mismatch += 1;
      if (toolEmail !== apiEmail) results.profile.email_mismatch += 1;
      if (toolPhone !== apiPhone) results.profile.phone_mismatch += 1;
      if (toolSsn !== apiSsn) results.profile.ssn_mismatch += 1;
      if (toolPhone !== apiPhone && digits(toolPhone) && digits(toolPhone) === digits(apiPhone)) {
        results.profile.phone_format_only_mismatch += 1;
      }
      if (!toolSsn && apiSsn) results.profile.ssn_blank_tools_api_present += 1;
      if (toolSsn !== apiSsn && digits(toolSsn) && digits(toolSsn) === digits(apiSsn)) {
        results.profile.ssn_format_only_mismatch += 1;
      }

      if (
        results.samples.profile.length < 5
        && (
          toolFirstName !== apiFirstName
          || toolLastName !== apiLastName
          || toolEmail !== apiEmail
          || toolPhone !== apiPhone
          || toolSsn !== apiSsn
        )
      ) {
        results.samples.profile.push({
          client_id: toolRow.client_id,
          external_client_id: toolRow.external_client_id,
          name: `${toolFirstName} ${toolLastName}`.trim(),
          tools: {
            first_name: toolFirstName,
            last_name: toolLastName,
            email: toolEmail,
            phone: toolPhone,
            ssn: toolSsn,
          },
          api: {
            first_name: apiFirstName,
            last_name: apiLastName,
            email: apiEmail,
            phone: apiPhone,
            ssn: apiSsn,
          },
        });
      }

      if (apiUsername && !toolUsername) results.credentials.username_tools_blank_api_present += 1;
      if (apiPassword && !toolPassword) results.credentials.password_tools_blank_api_present += 1;
      if (apiSecret && !toolSecret) results.credentials.secret_tools_blank_api_present += 1;
      if (toolUsername !== apiUsername) results.credentials.username_mismatch += 1;
      if (toolPassword !== apiPassword) results.credentials.password_mismatch += 1;
      if (toolSecret !== apiSecret) results.credentials.secret_mismatch += 1;

      if (
        results.samples.credential.length < 5
        && (toolUsername !== apiUsername || toolPassword !== apiPassword || toolSecret !== apiSecret)
      ) {
        results.samples.credential.push({
          client_id: toolRow.client_id,
          external_client_id: toolRow.external_client_id,
          name: `${text(toolRow.first_name)} ${text(toolRow.last_name)}`.trim(),
          tools: { username: toolUsername, password: toolPassword, secret: toolSecret },
          api: { username: apiUsername, password: apiPassword, secret: apiSecret },
        });
      }

      const desiredToolsAddress = apiAddressPairToTools(apiRow.currentAddress, apiRow.address, apiRow.addresses);
      const currentToolsAddress = toToolsAddress(...splitToolsAddressParts(toolRow.address));
      if (desiredToolsAddress && !currentToolsAddress) results.address.tools_blank_api_present += 1;
      if (!desiredToolsAddress && currentToolsAddress) results.address.api_blank_tools_present += 1;
      if (desiredToolsAddress === currentToolsAddress) {
        results.address.exact_normalized_match += 1;
      } else {
        results.address.mismatch += 1;
        if (results.samples.address.length < 5) {
          results.samples.address.push({
            client_id: toolRow.client_id,
            external_client_id: toolRow.external_client_id,
            name: `${text(toolRow.first_name)} ${text(toolRow.last_name)}`.trim(),
            tools_address: currentToolsAddress,
            api_normalized_address: desiredToolsAddress,
            api_currentAddress: text(apiRow.currentAddress),
            api_address: text(apiRow.address),
            api_addresses: text(apiRow.addresses),
          });
        }
      }

      let documents = [];
      try {
        documents = JSON.parse(String(toolRow.documents_json || '[]'));
      } catch {
        documents = [];
      }

      let rowHasDocMismatch = false;
      for (const [label, apiField] of FIXED_DOC_TYPES) {
        const toolDoc = extractDocValue(documents, label);
        const apiDoc = text(apiRow[apiField]);
        if (apiDoc && !toolDoc) results.documents.tools_blank_api_present_by_type[label] += 1;
        if (toolDoc !== apiDoc) {
          results.documents.mismatches_by_type[label] += 1;
          rowHasDocMismatch = true;
          if (results.samples.document.length < 5) {
            results.samples.document.push({
              client_id: toolRow.client_id,
              external_client_id: toolRow.external_client_id,
              name: `${text(toolRow.first_name)} ${text(toolRow.last_name)}`.trim(),
              type: label,
              tools_document: toolDoc,
              api_document: apiDoc,
            });
          }
        }
      }
      if (rowHasDocMismatch) results.documents.rows_with_doc_mismatch += 1;
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
