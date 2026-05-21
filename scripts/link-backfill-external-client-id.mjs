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

const text = (v) => String(v ?? '').trim();
const digits = (v) => String(v || '').replace(/\D/g, '');
const nameKey = (first, last) => `${text(first).toLowerCase()}|${text(last).toLowerCase()}`;

const inc = (map, key) => map.set(key, Number(map.get(key) || 0) + 1);

const main = async () => {
  const tools = await mysql.createConnection(toolsCfg);
  const api = await mysql.createConnection(apiCfg);

  try {
    const [toolRows] = await tools.query(
      `SELECT client_id, first_name, last_name, email, ssn
         FROM client_profiles
        WHERE owner_key = ?
          AND COALESCE(TRIM(external_client_id), '') = ''`,
      [OWNER_KEY],
    );
    const [apiRows] = await api.query(
      `SELECT id, first_name, last_name, email, ssn
         FROM Clients`,
    );

    const apiBySsn = new Map();
    const apiSsnCount = new Map();
    const apiByEmail = new Map();
    const apiEmailCount = new Map();
    const apiByName = new Map();
    const apiNameCount = new Map();

    for (const row of apiRows) {
      const ssn = digits(row.ssn);
      if (ssn.length >= 9) {
        const key = ssn.slice(0, 9);
        apiBySsn.set(key, row);
        inc(apiSsnCount, key);
      }
      const email = text(row.email).toLowerCase();
      if (email) {
        apiByEmail.set(email, row);
        inc(apiEmailCount, email);
      }
      const fullName = nameKey(row.first_name, row.last_name);
      if (fullName !== '|') {
        apiByName.set(fullName, row);
        inc(apiNameCount, fullName);
      }
    }

    let updated = 0;
    let linkedBySsn = 0;
    let linkedByEmail = 0;
    let linkedByName = 0;

    await tools.query('START TRANSACTION');
    try {
      for (const row of toolRows) {
        let match = null;
        let source = '';

        const ssn = digits(row.ssn);
        if (ssn.length >= 9) {
          const key = ssn.slice(0, 9);
          if (Number(apiSsnCount.get(key) || 0) === 1) {
            match = apiBySsn.get(key);
            source = 'ssn';
          }
        }

        if (!match) {
          const email = text(row.email).toLowerCase();
          if (email && Number(apiEmailCount.get(email) || 0) === 1) {
            match = apiByEmail.get(email);
            source = 'email';
          }
        }

        if (!match) {
          const fullName = nameKey(row.first_name, row.last_name);
          if (fullName !== '|' && Number(apiNameCount.get(fullName) || 0) === 1) {
            match = apiByName.get(fullName);
            source = 'name';
          }
        }

        if (!match) continue;

        const [res] = await tools.query(
          `UPDATE client_profiles
              SET external_client_id = ?, updated_at = UTC_TIMESTAMP()
            WHERE owner_key = ?
              AND client_id = ?
              AND COALESCE(TRIM(external_client_id), '') = ''`,
          [String(match.id), OWNER_KEY, row.client_id],
        );

        if (Number(res.affectedRows || 0) > 0) {
          updated += 1;
          if (source === 'ssn') linkedBySsn += 1;
          if (source === 'email') linkedByEmail += 1;
          if (source === 'name') linkedByName += 1;
        }
      }
      await tools.query('COMMIT');
    } catch (error) {
      await tools.query('ROLLBACK');
      throw error;
    }

    console.log(
      JSON.stringify(
        {
          owner_key: OWNER_KEY,
          unlinked_before: toolRows.length,
          updated,
          linked_by_ssn: linkedBySsn,
          linked_by_email: linkedByEmail,
          linked_by_name: linkedByName,
        },
        null,
        2,
      ),
    );
  } finally {
    await tools.end();
    await api.end();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
