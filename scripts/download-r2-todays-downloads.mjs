#!/usr/bin/env node
/**
 * Download "today's" objects from a Cloudflare R2 bucket (S3-compatible).
 *
 * Usage:
 *   node scripts/download-r2-todays-downloads.mjs --bucket clients-docs
 *   node scripts/download-r2-todays-downloads.mjs --bucket credit-reports --prefix reports/
 *   node scripts/download-r2-todays-downloads.mjs --bucket letter-assets --date 2026-05-27 --out ./_downloads
 *
 * Env:
 *   R2_ENDPOINT     e.g. https://<account>.r2.cloudflarestorage.com
 *   R2_ACCESS_KEY
 *   R2_SECRET_KEY
 *   R2_REGION       default: auto
 *
 * Notes:
 * - "Today" is computed in America/Chicago unless --tz is provided.
 * - Filters by LastModified (UTC) date compared against "today" in the chosen tz.
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const VERSION = 'v.002';

const usage = () => {
  console.log(`
download-r2-todays-downloads ${VERSION}

Required:
  --bucket <name>          R2 bucket name

Optional:
  --prefix <prefix>        Key prefix filter (default: "")
  --date <YYYY-MM-DD>      Date in the chosen tz (default: today)
  --tz <IANA tz>           Timezone for "today" (default: America/Chicago)
  --out <dir>              Output dir (default: ./_downloads)
  --since-minutes <n>      Only include objects modified in the last N minutes
  --match <regex>          Only include keys matching this JS regex (e.g. "\\\\.pdf$")
  --dry-run                Only list; do not download
  --limit <n>              Max objects to download (default: 0 = no limit)
  --concurrency <n>         Concurrent downloads (default: 6)
  --null                   When --dry-run, print keys separated by NULs
  --out-mode <mode>        "dated" (default) or "direct" (write keys under --out)

Env:
  R2_ENDPOINT, R2_ACCESS_KEY, R2_SECRET_KEY, R2_REGION
`.trim());
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const out = {
    prefix: '',
    tz: 'America/Chicago',
    outDir: './_downloads',
    dryRun: false,
    limit: 0,
    concurrency: 6,
    sinceMinutes: 0,
    match: '',
    nullSeparated: false,
    outMode: 'dated',
  };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--bucket') out.bucket = args[++i];
    else if (a === '--prefix') out.prefix = args[++i] || '';
    else if (a === '--date') out.date = args[++i];
    else if (a === '--tz') out.tz = args[++i] || out.tz;
    else if (a === '--out') out.outDir = args[++i] || out.outDir;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--limit') out.limit = Number.parseInt(args[++i] || '0', 10) || 0;
    else if (a === '--concurrency') out.concurrency = Math.max(1, Number.parseInt(args[++i] || '6', 10) || 6);
    else if (a === '--since-minutes') out.sinceMinutes = Math.max(0, Number.parseInt(args[++i] || '0', 10) || 0);
    else if (a === '--match') out.match = args[++i] || '';
    else if (a === '--null') out.nullSeparated = true;
    else if (a === '--out-mode') out.outMode = (args[++i] || 'dated').trim().toLowerCase();
    else if (a === '--help' || a === '-h') out.help = true;
    else {
      console.error(`Unknown arg: ${a}`);
      out.help = true;
    }
  }
  return out;
};

const formatDateInTz = (date, timeZone) => {
  // en-CA yields YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);
};

const envFirst = (keys) => {
  for (const key of keys) {
    const val = String(process.env[key] || '').trim();
    if (val) return val;
  }
  return '';
};

const sha256Hex = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data, encoding) => crypto.createHmac('sha256', key).update(data).digest(encoding);

const deriveSigningKey = (secretKey, dateStamp, region, service) => {
  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
};

const encodeRfc3986 = (value) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

const canonicalQueryString = (params) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => [encodeRfc3986(k), encodeRfc3986(String(v))])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

const signRequest = ({ method, url, accessKey, secretKey, region, service = 's3', extraHeaders = {} }) => {
  const u = new URL(url);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);

  const host = u.host;
  const canonicalUri = u.pathname || '/';
  const queryParams = Object.fromEntries(u.searchParams.entries());
  const canonicalQuery = canonicalQueryString(queryParams);

  // For GET/HEAD, use UNSIGNED-PAYLOAD (works for S3/R2).
  // Cloudflare R2 requires x-amz-content-sha256 to be present and signed.
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const headers = {
    host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    ...Object.fromEntries(Object.entries(extraHeaders).map(([k, v]) => [k.toLowerCase(), String(v)])),
  };
  const sortedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderKeys.map((k) => `${k}:${String(headers[k]).trim()}\n`).join('');
  const signedHeaders = sortedHeaderKeys.join(';');

  const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = deriveSigningKey(secretKey, dateStamp, region, service);
  const signature = hmac(signingKey, stringToSign, 'hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { headers: { ...headers, authorization } };
};

const parseListObjectsV2Xml = (xml) => {
  const text = String(xml || '');
  const contents = [];
  const contentBlocks = text.match(/<Contents>[\s\S]*?<\/Contents>/g) || [];
  for (const block of contentBlocks) {
    const key = block.match(/<Key>([\s\S]*?)<\/Key>/)?.[1] || '';
    const lastModified = block.match(/<LastModified>([\s\S]*?)<\/LastModified>/)?.[1] || '';
    const size = block.match(/<Size>([\s\S]*?)<\/Size>/)?.[1] || '';
    if (key) {
      contents.push({
        key: key.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
        lastModified,
        size: Number.parseInt(size, 10) || 0,
      });
    }
  }

  const isTruncated = /<IsTruncated>true<\/IsTruncated>/i.test(text);
  const nextToken = text.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] || '';
  return { contents, isTruncated, nextToken: nextToken.trim() };
};

const listObjectsToday = async ({ endpoint, bucket, prefix, accessKey, secretKey, region, today, tz, sinceMinutes, matchRe }) => {
  let continuationToken = '';
  const results = [];
  const nowMs = Date.now();
  const sinceMs = sinceMinutes && sinceMinutes > 0 ? (sinceMinutes * 60_000) : 0;
  for (;;) {
    const qs = {
      'list-type': '2',
      prefix: prefix || undefined,
      'continuation-token': continuationToken || undefined,
      'max-keys': '1000',
    };
    const url = `${endpoint.replace(/\/$/, '')}/${encodeRfc3986(bucket)}?${canonicalQueryString(qs)}`;
    const signed = signRequest({ method: 'GET', url, accessKey, secretKey, region });
    const res = await fetch(url, { method: 'GET', headers: signed.headers });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`List failed HTTP ${res.status}: ${body.slice(0, 500)}`);
    }
    const xml = await res.text();
    const page = parseListObjectsV2Xml(xml);

    for (const obj of page.contents) {
      if (matchRe && !matchRe.test(obj.key)) continue;
      const lm = obj.lastModified ? new Date(obj.lastModified) : null;
      if (!lm || Number.isNaN(lm.getTime())) continue;
      if (sinceMs > 0 && (nowMs - lm.getTime()) > sinceMs) continue;
      const lmDay = formatDateInTz(lm, tz);
      if (lmDay === today) results.push(obj);
    }

    if (!page.isTruncated || !page.nextToken) break;
    continuationToken = page.nextToken;
  }
  return results;
};

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

const pLimit = (limit) => {
  let active = 0;
  const queue = [];
  const next = () => {
    if (!queue.length || active >= limit) return;
    active += 1;
    const { fn, resolve, reject } = queue.shift();
    Promise.resolve()
      .then(fn)
      .then(resolve, reject)
      .finally(() => {
        active -= 1;
        next();
      });
  };
  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
};

const downloadObject = async ({ endpoint, bucket, key, accessKey, secretKey, region, outPath }) => {
  const url = `${endpoint.replace(/\/$/, '')}/${encodeRfc3986(bucket)}/${key.split('/').map(encodeRfc3986).join('/')}`;
  const signed = signRequest({ method: 'GET', url, accessKey, secretKey, region });
  const res = await fetch(url, { method: 'GET', headers: signed.headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GET ${bucket}/${key} failed HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await ensureDir(path.dirname(outPath));
  await fs.writeFile(outPath, buf);
  return { bytes: buf.length };
};

const main = async () => {
  const args = parseArgs();
  if (args.help || !args.bucket) {
    usage();
    process.exit(args.help ? 0 : 2);
  }
  const quietStdout = Boolean(args.dryRun && args.nullSeparated);
  const logInfo = (...parts) => {
    if (quietStdout) console.error(...parts);
    else console.log(...parts);
  };

  const endpoint = envFirst(['R2_ENDPOINT', 'CONTABO_S3_ENDPOINT']) || '';
  const accessKey = envFirst(['R2_ACCESS_KEY', 'CONTABO_S3_ACCESS_KEY']) || '';
  const secretKey = envFirst(['R2_SECRET_KEY', 'CONTABO_S3_SECRET_KEY']) || '';
  const region = envFirst(['R2_REGION', 'CONTABO_S3_REGION']) || 'auto';

  if (!endpoint || !accessKey || !secretKey) {
    console.error('Missing env: R2_ENDPOINT / R2_ACCESS_KEY / R2_SECRET_KEY (or CONTABO_* fallbacks).');
    process.exit(2);
  }

  const tz = args.tz || 'America/Chicago';
  const today = args.date || formatDateInTz(new Date(), tz);
  const outMode = args.outMode === 'direct' ? 'direct' : 'dated';
  const outRoot = outMode === 'direct'
    ? path.resolve(args.outDir || './_downloads')
    : path.resolve(args.outDir || './_downloads', today, args.bucket);
  const matchRe = args.match ? new RegExp(args.match) : null;

  logInfo(`[download-r2-todays-downloads ${VERSION}] bucket=${args.bucket} prefix=${args.prefix || ''} date=${today} tz=${tz}`);
  logInfo(`endpoint=${endpoint}`);

  let objects = await listObjectsToday({
    endpoint,
    bucket: args.bucket,
    prefix: args.prefix || '',
    accessKey,
    secretKey,
    region,
    today,
    tz,
    sinceMinutes: args.sinceMinutes,
    matchRe,
  });

  objects.sort((a, b) => (a.lastModified < b.lastModified ? -1 : a.lastModified > b.lastModified ? 1 : 0));
  logInfo(`Found ${objects.length} object(s) modified on ${today}.`);

  const limited = args.limit > 0 ? objects.slice(0, args.limit) : objects;
  if (args.dryRun) {
    if (args.nullSeparated) {
      const chunks = [];
      for (const obj of limited) chunks.push(obj.key, '\0');
      process.stdout.write(chunks.join(''));
      return;
    }
    for (const obj of limited) {
      console.log(`${obj.lastModified}  ${String(obj.size).padStart(10)}  ${obj.key}`);
    }
    return;
  }

  const limiter = pLimit(args.concurrency);
  let downloaded = 0;
  let bytesTotal = 0;
  const startedAt = Date.now();

  await Promise.all(
    limited.map((obj) =>
      limiter(async () => {
        const outPath = path.join(outRoot, obj.key);
        const result = await downloadObject({
          endpoint,
          bucket: args.bucket,
          key: obj.key,
          accessKey,
          secretKey,
          region,
          outPath,
        });
        downloaded += 1;
        bytesTotal += result.bytes;
        if (downloaded % 25 === 0 || downloaded === limited.length) {
          console.log(`Downloaded ${downloaded}/${limited.length}...`);
        }
      }),
    ),
  );

  const secs = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  console.log(`Done. Downloaded ${downloaded} file(s), ${bytesTotal} bytes in ${secs}s.`);
  console.log(`Output: ${outRoot}`);
};

main().catch((err) => {
  console.error(`ERROR: ${err?.message || err}`);
  process.exit(1);
});
