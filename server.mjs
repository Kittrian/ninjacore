import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { promises as fs } from 'node:fs';
import https from 'node:https';
import path from 'node:path';

import { Server as SocketIOServer } from 'socket.io';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const host = process.env.HOST ?? '127.0.0.1';
const port = Number.parseInt(process.env.PORT ?? '3017', 10);
const ghlWebhookKey = String(process.env.GHL_WEBHOOK_KEY ?? '').trim();
const appLoginUsername = String(process.env.APP_LOGIN_USERNAME || 'admin').trim() || 'admin';
const appLoginPassword = String(process.env.APP_LOGIN_PASSWORD || 'Texas123!').trim() || 'Texas123!';
const legacyLoginUsername = 'admin';
const legacyLoginPassword = 'Texas123!';
const fallbackBridgeUsername = 'abay@gmail.com';
const fallbackBridgePassword = 'Texas123';
const publicDir = path.join(__dirname, 'public');
const dataFile = path.join(__dirname, 'data', 'store.json');
const affiliateUploadsDir = path.join(publicDir, 'uploads', 'affiliate-links');
const textAttachmentUploadsDir = path.join(publicDir, 'uploads', 'text-attachments');
const browserReportScriptFile = path.join(__dirname, 'scripts', 'XxXGetReport-NinjaTools.mjs');
const vantageSimulatorScriptFile = path.join(__dirname, 'scripts', 'models', 'vantagescore_3_pro.py');
const pythonBinary = String(process.env.PYTHON_BIN || 'python3').trim() || 'python3';
const groqApiKey = String(process.env.GROQ_API_KEY || '').trim();
const anthropicApiKey = String(process.env.ANTHROPIC_API_KEY || '').trim();

let initialS3MirrorQueued = false;
const storageReadyByOwner = new Map();
const reportRuns = new Map();
const learningContextByOwner = new Map();
const requestContext = new AsyncLocalStorage();
const dynamicUsernames = new Set();
const defaultCorsOrigins = [
  'https://ninjadispute.com',
  'https://www.ninjadispute.com',
  'https://dashboard.ninjadispute.com',
  'https://api.ninjadispute.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3017',
  'http://127.0.0.1:3017',
];
const configuredCorsOrigins = String(process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);
const allowedCorsOrigins = new Set(
  (configuredCorsOrigins.length ? configuredCorsOrigins : defaultCorsOrigins)
    .map((origin) => origin.toLowerCase()),
);

const resolveCorsOrigin = (originHeader = '') => {
  const origin = String(originHeader || '').trim();
  if (!origin) {
    return '';
  }
  const normalized = origin.toLowerCase();
  if (allowedCorsOrigins.has(normalized)) {
    return origin;
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return origin;
  }
  return '';
};

const toHeaderObject = (headers) => {
  if (!headers) {
    return {};
  }
  if (Array.isArray(headers)) {
    const out = {};
    for (let i = 0; i < headers.length; i += 2) {
      const key = headers[i];
      const value = headers[i + 1];
      if (typeof key === 'string' && value !== undefined) {
        out[key] = value;
      }
    }
    return out;
  }
  if (typeof headers === 'object') {
    return { ...headers };
  }
  return {};
};

const buildCorsHeaders = (origin = '', requestHeaders = '') => {
  const headers = {
    Vary: 'Origin',
  };
  if (!origin) {
    return headers;
  }
  headers['Access-Control-Allow-Origin'] = origin;
  headers['Access-Control-Allow-Credentials'] = 'true';
  headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
  headers['Access-Control-Allow-Headers'] = requestHeaders || 'Content-Type, Authorization, X-Requested-With';
  return headers;
};
// ─── SurrealDB Master (Hetzner) ───────────────────────────────────────────────
const SURREAL_URL  = String(process.env.SURREAL_URL  || 'http://5.78.214.176:8000/sql');
const SURREAL_REST = String(process.env.SURREAL_REST || 'http://5.78.214.176:8000');
const SURREAL_NS   = String(process.env.SURREAL_NS   || 'ninja');
const SURREAL_DB   = String(process.env.SURREAL_DB   || 'dispute');
const SURREAL_AUTH = 'Basic ' + Buffer.from(
  `${process.env.SURREAL_USER || 'root'}:${process.env.SURREAL_PASS || 'Malachi77'}`
).toString('base64');
const SURREAL_HEADERS = {
  Accept: 'application/json',
  Authorization: SURREAL_AUTH,
  'Surreal-NS': SURREAL_NS,
  'Surreal-DB': SURREAL_DB,
};

const sEsc = (v) => String(v ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');

const surql = async (query) => {
  const res = await fetch(SURREAL_URL, {
    method: 'POST',
    headers: { ...SURREAL_HEADERS, 'Content-Type': 'application/surrealql' },
    body: query,
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`SurrealDB ${res.status}: ${t.slice(0, 300)}`); }
  const d = await res.json();
  const errs = d.filter((r) => r.status === 'ERR');
  if (errs.length) throw new Error(`SurrealDB ERR: ${JSON.stringify(errs[0]).slice(0, 300)}`);
  return Array.isArray(d[0]?.result) ? d[0].result : [];
};

const surqlMultiResult = async (query) => {
  const res = await fetch(SURREAL_URL, {
    method: 'POST',
    headers: { ...SURREAL_HEADERS, 'Content-Type': 'application/surrealql' },
    body: query,
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`SurrealDB ${res.status}: ${t.slice(0, 300)}`); }
  const d = await res.json();
  return d.map((r) => Array.isArray(r?.result) ? r.result : []);
};

const surqlRestPut = async (table, id, data) => {
  const res = await fetch(`${SURREAL_REST}/key/${table}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { ...SURREAL_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`SurrealDB PUT ${res.status}: ${t.slice(0, 300)}`); }
  const d = await res.json();
  return Array.isArray(d) ? d[0] : d;
};

const surrealExtractNumId = (surrealId) => {
  const str = String(surrealId ?? '');
  const idx = str.lastIndexOf(':');
  const raw = idx >= 0 ? str.slice(idx + 1) : str;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : raw;
};

const surrealRandIntId = () => Math.floor(Math.random() * 9_000_000) + 1_000_000;

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};
const storageS3EndpointEnv = String(process.env['Storage__S3__Endpoint'] || '').trim();
const storageS3AccessKeyEnv = String(process.env['Storage__S3__AccessKey'] || '').trim();
const storageS3SecretKeyEnv = String(process.env['Storage__S3__SecretKey'] || '').trim();
const storageS3BucketEnv = String(process.env['Storage__S3__BucketName'] || '').trim();

const defaultStatuses = [
  'Client',
  'E-Campaign',
  'Inactive - Completed Credit Repair',
  'Inactive - Needs More Credit Repair',
  'Lead',
  'Not Qualified',
  'Prospect',
  'Canceled',
  'Ghosting',
  'Inactive',
  'IDIQ Issue',
];
const defaultPhases = [
  'Phase 1',
  'Phase 2',
  'Phase 3',
  'Phase 4',
  'Phase 5',
  'Phase 6',
  'Phase 7',
  'None',
];
const paymentGatewayOptions = [
  'Authorize.net',
  'Square',
  'NMI',
  'Square Payments',
  'NMI Payments',
  'PayPal Payments',
  'Global Payments',
  'USAePay Payments',
  'Ecrypt Payments',
];
const paymentFrequencyOptions = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'custom', label: 'Custom Days' },
];

const allowedIntegrationServices = new Set(['smartcredit35540', 'smartcredit68951', 'myfreescorenow', 'gohighlevel', 'billing', 'ninjadispute', 'contabo']);
const defaultIntegrations = {
  smartcredit35540: {
    tokenId: '1c03c715-bb56-4574-b098-97f596a06308',
    apiSecret: '7AvEEVHUTb7Y4j64ilK89a7cLvN3cwp_CR9AyDJeYpg',
  },
  smartcredit68951: {
    tokenId: '1c03c715-bb56-4574-b098-97f596a06308',
    apiSecret: '7AvEEVHUTb7Y4j64ilK89a7cLvN3cwp_CR9AyDJeYpg',
  },
  myfreescorenow: {
    tokenId: 'api@besttexascreditpros.com',
    apiSecret: 'Texas123!',
  },
  gohighlevel: {
    webhookKey: '',
    outboundWebhookUrl: '',
    apiToken: '',
    locationId: '',
  },
  billing: {
    failedPaymentsWebhookUrl: String(process.env.GHL_FAILED_PAYMENTS_WEBHOOK_URL || '').trim(),
    webhookHeaderName: String(process.env.GHL_WEBHOOK_HEADER_NAME || '').trim(),
    webhookHeaderValue: String(process.env.GHL_WEBHOOK_HEADER_VALUE || '').trim(),
    scriptTriggerSecret: String(process.env.GHL_SCRIPT_TRIGGER_SECRET || '').trim(),
  },
  ninjadispute: {
    baseUrl: String(process.env.NINJADISPUTE_API_URL || 'https://api.ninjadispute.com').trim(),
    email: String(process.env.NINJADISPUTE_READONLY_EMAIL || '').trim(),
    password: String(process.env.NINJADISPUTE_READONLY_PASSWORD || '').trim(),
  },
  contabo: {
    apiClientId: String(process.env.CONTABO_API_CLIENT_ID || '').trim(),
    apiClientSecret: String(process.env.CONTABO_API_CLIENT_SECRET || '').trim(),
    s3AccessKey: String(storageS3AccessKeyEnv || process.env.CONTABO_S3_ACCESS_KEY || '').trim(),
    s3SecretKey: String(storageS3SecretKeyEnv || process.env.CONTABO_S3_SECRET_KEY || '').trim(),
    s3StorageName: String(process.env.CONTABO_S3_STORAGE_NAME || '').trim(),
    s3Endpoint: String(storageS3EndpointEnv || process.env.CONTABO_S3_ENDPOINT || 'https://usc1.contabostorage.com').trim(),
    s3Bucket: String(storageS3BucketEnv || process.env.CONTABO_S3_BUCKET || 'id-docs').trim(),
  },
};
const affiliateMonitoringDefaults = [
  {
    id: 'identityiq',
    name: 'IdentityIQ',
    description: '',
    url: '',
    imagePath: '',
    show: false,
    isDefault: false,
  },
  {
    id: 'myscoreiq',
    name: 'mySCOREIQ',
    description: '',
    url: '',
    imagePath: '',
    show: false,
    isDefault: false,
  },
  {
    id: 'smartcredit',
    name: 'SmartCredit',
    description: '',
    url: '',
    imagePath: '/assets/smartcredit-logo.png',
    show: false,
    isDefault: false,
  },
  {
    id: 'myfreescorenow',
    name: 'myFreeScoreNow',
    description: '',
    url: '',
    imagePath: '/assets/myfreescorenow-logo.png',
    show: false,
    isDefault: false,
  },
];
const consumerDirectTargetEntity = String(
  process.env.CONSUMERDIRECT_TARGET_ENTITY
  || 'e6c9113e-48b8-41ef-a87e-87a3c51a5e83',
).trim();
const consumerDirectEnvironments = [
  {
    name: 'production',
    authUrl: 'https://auth.consumerdirect.io/oauth2/token',
    apiBaseUrl: 'https://papi.consumerdirect.io',
    scopeTargetEntity: consumerDirectTargetEntity,
  },
];
const myFreeScoreNowBaseUrl = 'https://api.myfreescorenow.com';
const smartCreditAuthBaseUrl = String(process.env.SMARTCREDIT_AUTH_BASE_URL || 'https://auth.consumerdirect.io').trim()
  || 'https://auth.consumerdirect.io';
const smartCreditPartnerBaseUrl = String(process.env.SMARTCREDIT_PARTNER_BASE_URL || 'https://papi.consumerdirect.io').trim()
  || 'https://papi.consumerdirect.io';
const smartCreditApiBaseUrl = String(process.env.SMARTCREDIT_API_BASE_URL || 'https://api.smartcredit.com').trim()
  || 'https://api.smartcredit.com';
const smartCreditIntegrationBaseUrl = String(process.env.SMARTCREDIT_INTEGRATION_BASE_URL || 'http://127.0.0.1:5215').trim()
  || 'http://127.0.0.1:5215';
const smartCreditTargetEntityId = String(process.env.SMARTCREDIT_TARGET_ENTITY_ID || 'e6c9113e-48b8-41ef-a87e-87a3c51a5e83').trim()
  || 'e6c9113e-48b8-41ef-a87e-87a3c51a5e83';
const smartCreditAgentId = String(process.env.SMARTCREDIT_AGENT_ID || 'Best Texas Credit Pros').trim()
  || 'Best Texas Credit Pros';

const seedData = {
  statuses: defaultStatuses,
  phases: defaultPhases,
  businessSettings: {
    companyName: 'Best Texas Credit Pros',
    companyAddress: '1751 River Run Suite 200',
    companyCity: 'Fort Worth',
    companyState: 'Texas',
    companyZipcode: '77565',
    companyEmail: 'Andrew@BestTexasCreditPros.com',
    companyPhone: '+1 817 668 7797',
    consultationFee: '197.00',
    serviceFee: '97.00',
    clientPortalUrl: 'https://best-texas-credit-pros.com/client-portal',
    selfSignupLink: 'https://best-texas-credit-pros.com/start',
    senderName: 'Andrew',
    emailDomain: '@securecreditclient.com',
    disputeDueDate: '35-Days',
    companyColor: '#0000ff',
    logoDataUrl: '',
  },
  clients: [
    {
      id: 'client-1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      dob: '',
      ssn: '',
      address: '',
      phone: '',
      spouseClientId: '',
      spouseClientLabel: '',
      assignedTo: '',
      status: 'Client',
      phase: 'None',
      monitoringAgency: '',
      yearlyIncome: '',
      housingPayment: '',
      debtMonthlyPayments: '',
      monitoringUsername: '',
      monitoringPassword: '',
      secretKey: '',
      monitoringToken: '',
      portalPassword: '',
      portalEnabled: true,
      language: 'English',
      notes: '',
      reportDate: '',
      creditReportJson: '',
      creditReportSource: '',
      lastSyncedAt: '',
      creditReportFileName: 'credit-report.html',
      creditReportHtml: '<!DOCTYPE html><html><head><title>Credit Report</title></head><body><h1>Jane Doe Credit Report</h1><div>TransUnion Score: 721</div><div>Experian Score: 712</div><div>Equifax Score: 698</div></body></html>',
      createdAt: '2026-04-30T12:00:00.000Z',
    }
  ],
};

const send = (res, statusCode, payload, contentType = 'application/json; charset=utf-8') => {
  const activeOrigin = String(requestContext.getStore()?.requestOrigin || '').trim();
  const requestHeaders = String(requestContext.getStore()?.requestHeaders || '').trim();
  const corsHeaders = buildCorsHeaders(activeOrigin, requestHeaders);
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    ...corsHeaders,
  });
  if (Buffer.isBuffer(payload) || payload instanceof Uint8Array) {
    res.end(payload);
    return;
  }

  res.end(typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));
};

const notFound = (res) => send(res, 404, { error: 'Not found' });

const getAllowedLoginCredentials = () => {
  const candidates = [
    { username: appLoginUsername, password: appLoginPassword },
    { username: legacyLoginUsername, password: legacyLoginPassword },
    { username: fallbackBridgeUsername, password: fallbackBridgePassword },
  ];
  const deduped = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const username = String(candidate?.username || '').trim();
    const password = String(candidate?.password || '').trim();
    if (!username || !password) {
      continue;
    }
    const key = `${username.toLowerCase()}::${password}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push({ username, password });
  }
  return deduped;
};

const isValidAppCredential = (username = '', password = '') => {
  const nextUsername = String(username || '').trim();
  const nextPassword = String(password || '').trim();
  if (!nextUsername || !nextPassword) {
    return false;
  }
  return getAllowedLoginCredentials().some((credential) => (
    credential.username.toLowerCase() === nextUsername.toLowerCase()
    && credential.password === nextPassword
  ));
};

const normalizeUsername = (value = '') => String(value || '').trim().toLowerCase();

// Verify a HS256 JWT signed by api.ninjadispute.com.
// Returns the decoded payload or null if invalid/expired.
const API_JWT_SECRET = process.env.API_JWT_SECRET || 'mad4srsZIISQ0G1MJPoQIeq3PVf25EaR';
const verifyApiJWT = (token) => {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const expected = createHmac('sha256', API_JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');
    if (expected !== sigB64) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
};

const hashUserPassword = (password = '', salt = '') => createHash('sha256')
  .update(`${salt}::${String(password || '')}`)
  .digest('hex');

const getCurrentOwnerKey = () => {
  const scoped = requestContext.getStore()?.ownerKey;
  return normalizeOwnerKey(scoped || appLoginUsername || 'admin');
};

const getOwnerDataFile = (ownerKey = '') => (
  path.join(__dirname, 'data', 'users', normalizeOwnerKey(ownerKey), 'store.json')
);

const getReportSavePaths = (ownerKey = getCurrentOwnerKey()) => ({
  currentClientStorePath: getOwnerDataFile(ownerKey),
  reportHistoryDbPath: `${SURREAL_URL}`,
});

const getUserByUsername = async (username = '') => {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;
  const rows = await surql(`SELECT username, password_hash AS passwordHash, password_salt AS passwordSalt, created_at AS createdAt FROM users WHERE username = "${sEsc(normalized)}" LIMIT 1`);
  return rows[0] ?? null;
};

const verifyUserCredential = async (username = '', password = '') => {
  const user = await getUserByUsername(username);
  if (!user) {
    return false;
  }
  const attemptedHash = hashUserPassword(password, user.passwordSalt || '');
  return attemptedHash === String(user.passwordHash || '');
};

const createAppUser = async (username = '', password = '') => {
  const normalized = normalizeUsername(username);
  const nextPassword = String(password || '').trim();
  if (!normalized || !nextPassword) throw new Error('Username and password are required.');
  const existing = await surql(`SELECT username FROM users WHERE username = "${sEsc(normalized)}" LIMIT 1`);
  if (existing.length) throw new Error('That username is already in use.');
  const salt = randomUUID();
  const passwordHash = hashUserPassword(nextPassword, salt);
  const now = new Date().toISOString();
  await surqlRestPut('users', normalized, { username: normalized, password_hash: passwordHash, password_salt: salt, created_at: now, updated_at: now });
  dynamicUsernames.add(normalized);
  await ensureDataFile(normalized);
  void mirrorBusinessControlPlaneToS3('admin').catch((error) => console.warn(`[S3 Mirror] app user export failed: ${error.message}`));
  return { username: normalized, createdAt: now };
};

const isAllowedAppUsername = (username = '') => {
  const normalized = String(username || '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  const scoped = requestContext.getStore();
  if (scoped?.knownUsers instanceof Set && scoped.knownUsers.has(normalized)) {
    return true;
  }
  if (dynamicUsernames.has(normalized)) {
    return true;
  }
  return getAllowedLoginCredentials().some((credential) => credential.username.toLowerCase() === normalized);
};

const parseCookies = (cookieHeader = '') => {
  const map = new Map();
  String(cookieHeader || '')
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const index = pair.indexOf('=');
      if (index === -1) {
        return;
      }
      const key = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (!key) {
        return;
      }
      try {
        map.set(key, decodeURIComponent(value));
      } catch {
        map.set(key, value);
      }
    });
  return map;
};

const isAppAuthenticated = (req) => {
  const cookies = parseCookies(req?.headers?.cookie || '');
  const txn = String(cookies.get('txn') || '').trim();
  return isAllowedAppUsername(txn);
};

const requireAppAuth = (req, res) => {
  if (isAppAuthenticated(req)) {
    return true;
  }
  send(res, 401, { error: 'Please login first.' });
  return false;
};

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
};

const getAuthenticatedUsername = (req) => normalizeUsername(
  parseCookies(req?.headers?.cookie || '').get('txn')
  || appLoginUsername,
);

const aiTonePromptMap = {
  'initial letter': 'Rewrite this professionally and politely.',
  'response level 1': 'Make it slightly more firm but professional.',
  'response level 3': 'Make it noticeably firmer and assertive.',
  'response level 5': 'Make it strong, confident, and direct.',
  'response level 7': 'Make it very firm and aggressive.',
  'most aggressive': 'Make it extremely aggressive and demanding while staying legally appropriate.',
};

const buildAiRewritePrompt = ({
  level = '',
  selectedText = '',
  context = {},
  customPrompt = '',
} = {}) => {
  const levelText = String(level || '').trim().toLowerCase();
  const toneInstruction = aiTonePromptMap[levelText] || 'Rewrite this professionally with clear, factual language.';
  const userInstruction = String(customPrompt || '').trim();
  const instruction = userInstruction
    ? `${userInstruction}\n\nTone target: ${toneInstruction}`
    : toneInstruction;
  const contextJson = JSON.stringify(context || {}, null, 2);
  return `${instruction}

Use all available context JSON below (client profile, selected account, full bureau datapoints, editor body, and tag values) to keep the rewrite precise.

Context JSON:
${contextJson}

Original Text:
"""
${String(selectedText || '').trim()}
"""

Rewritten Version:`;
};

const callGroqRewrite = async ({ prompt = '' } = {}) => {
  if (!groqApiKey) {
    throw new Error('GROQ_API_KEY is missing on server.');
  }
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a professional credit dispute writer. Keep output actionable, factual, and concise.' },
        { role: 'user', content: String(prompt || '') },
      ],
      temperature: 0.6,
      max_tokens: 1400,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  const text = String(payload?.choices?.[0]?.message?.content || '').trim();
  if (!response.ok || !text) {
    throw new Error(String(payload?.error?.message || payload?.error || `Groq request failed (${response.status})`));
  }
  return text;
};

const callAnthropicRewrite = async ({ prompt = '' } = {}) => {
  if (!anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is missing on server.');
  }
  const models = [
    String(process.env.ANTHROPIC_MODEL || '').trim(),
    'claude-sonnet-4-6',
    'claude-opus-4-7',
    'claude-sonnet-4-5',
    'claude-haiku-4-5',
    'claude-3-7-sonnet-latest',
    'claude-3-5-sonnet-latest',
    'claude-3-5-haiku-latest',
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250514',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-haiku-20240307',
  ].filter(Boolean);

  let lastError = null;
  for (const model of models) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1400,
          temperature: 0.6,
          system: 'You are an expert credit dispute letter writer. Keep output specific and ready to use.',
          messages: [{ role: 'user', content: String(prompt || '') }],
        }),
      });
      const payload = await response.json().catch(() => ({}));
      const text = Array.isArray(payload?.content)
        ? payload.content.map((part) => String(part?.text || '')).join('').trim()
        : '';
      if (!response.ok || !text) {
        throw new Error(String(payload?.error?.message || payload?.error || `Anthropic request failed (${response.status})`));
      }
      return text;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(lastError?.message || 'Claude rewrite failed.');
};

const generateId = () => `client-${Math.random().toString(36).slice(2, 10)}`;

const normalizeIntegrationPayload = (payload = {}, service = '') => {
  const normalizedService = String(service || '').trim().toLowerCase();
  const defaults = defaultIntegrations[normalizedService] || { tokenId: '', apiSecret: '' };
  if (normalizedService === 'gohighlevel') {
    return {
      webhookKey: String(payload.webhookKey ?? defaults.webhookKey ?? '').trim(),
      outboundWebhookUrl: String(payload.outboundWebhookUrl ?? defaults.outboundWebhookUrl ?? '').trim(),
      apiToken: String(payload.apiToken ?? defaults.apiToken ?? '').trim(),
      locationId: String(payload.locationId ?? defaults.locationId ?? '').trim(),
    };
  }
  if (normalizedService === 'billing') {
    return {
      failedPaymentsWebhookUrl: String(payload.failedPaymentsWebhookUrl ?? defaults.failedPaymentsWebhookUrl ?? '').trim(),
      webhookHeaderName: String(payload.webhookHeaderName ?? defaults.webhookHeaderName ?? '').trim(),
      webhookHeaderValue: String(payload.webhookHeaderValue ?? defaults.webhookHeaderValue ?? '').trim(),
      scriptTriggerSecret: String(payload.scriptTriggerSecret ?? defaults.scriptTriggerSecret ?? '').trim(),
    };
  }
  if (normalizedService === 'ninjadispute') {
    return {
      baseUrl: String(payload.baseUrl ?? defaults.baseUrl ?? 'https://api.ninjadispute.com').trim().replace(/\/+$/g, ''),
      email: String(payload.email ?? defaults.email ?? '').trim(),
      password: String(payload.password ?? defaults.password ?? '').trim(),
    };
  }
  if (normalizedService === 'contabo') {
    return {
      apiClientId: String(payload.apiClientId ?? defaults.apiClientId ?? '').trim(),
      apiClientSecret: String(payload.apiClientSecret ?? defaults.apiClientSecret ?? '').trim(),
      s3AccessKey: String(payload.s3AccessKey ?? defaults.s3AccessKey ?? '').trim(),
      s3SecretKey: String(payload.s3SecretKey ?? defaults.s3SecretKey ?? '').trim(),
      s3StorageName: String(payload.s3StorageName ?? defaults.s3StorageName ?? '').trim(),
      s3Endpoint: String(payload.s3Endpoint ?? defaults.s3Endpoint ?? 'https://usc1.contabostorage.com').trim().replace(/\/+$/g, ''),
      s3Bucket: String(payload.s3Bucket ?? defaults.s3Bucket ?? 'id-docs').trim(),
    };
  }
  return {
    tokenId: String(payload.tokenId ?? defaults.tokenId ?? '').trim(),
    apiSecret: String(payload.apiSecret ?? defaults.apiSecret ?? '').trim(),
  };
};

const getIntegrationKeyForAgency = (agency = '') => {
  const normalized = String(agency || '').trim().toLowerCase();
  if (normalized.includes('smart')) {
    return 'smartcredit';
  }
  if (normalized.includes('myfree')) {
    return 'myfreescorenow';
  }
  return '';
};

const normalizeAffiliateFlag = (value) => value === true || value === 'true' || value === '1' || value === 1;

const decodeImageDataUrl = (value) => {
  const match = String(value || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  const mimeType = match[1];
  const payload = match[2];
  const extensionMap = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
  };
  const extension = extensionMap[mimeType] || '';
  if (!extension) {
    return null;
  }

  return {
    mimeType,
    extension,
    bytes: Buffer.from(payload, 'base64'),
  };
};

const decodeBase64DataUrl = (value) => {
  const match = String(value || '').match(/^data:([a-zA-Z0-9][a-zA-Z0-9.+/-]*);base64,(.+)$/);
  if (!match) {
    return null;
  }
  return {
    mimeType: match[1].toLowerCase(),
    bytes: Buffer.from(match[2], 'base64'),
  };
};

const textAttachmentMimeToExt = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
};

const getSafeFileExtension = (fileName = '', mimeType = '') => {
  const byMime = textAttachmentMimeToExt[String(mimeType || '').toLowerCase()] || '';
  if (byMime) {
    return byMime;
  }
  const rawExt = path.extname(String(fileName || '').trim()).toLowerCase();
  if (/^\.[a-z0-9]{1,8}$/i.test(rawExt)) {
    return rawExt;
  }
  return '.bin';
};

const sanitizeBaseName = (value = '') => {
  const cleaned = String(value || '')
    .replace(/\.[^.]+$/, '')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 80);
  return cleaned || 'attachment';
};

const saveAffiliateImage = async (rowId, imageDataUrl) => {
  const decoded = decodeImageDataUrl(imageDataUrl);
  if (!decoded) {
    return '';
  }

  await fs.mkdir(affiliateUploadsDir, { recursive: true });
  const safeId = String(rowId || `affiliate-${Date.now()}`).replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  const fileName = `${safeId}-${Date.now()}${decoded.extension}`;
  const targetPath = path.join(affiliateUploadsDir, fileName);
  await fs.writeFile(targetPath, decoded.bytes);
  return `/uploads/affiliate-links/${fileName}`;
};

const saveTextAttachmentFile = async ({ fileName = '', mimeType = '', dataUrl = '' } = {}) => {
  const decoded = decodeBase64DataUrl(dataUrl);
  if (!decoded || !decoded.bytes?.length) {
    throw new Error('Attachment upload payload is invalid.');
  }

  const maxBytes = 15 * 1024 * 1024;
  if (decoded.bytes.length > maxBytes) {
    throw new Error('Attachment must be 15MB or smaller.');
  }

  const resolvedMime = String(decoded.mimeType || mimeType || '').toLowerCase();
  const extension = getSafeFileExtension(fileName, resolvedMime);
  const safeBase = sanitizeBaseName(fileName);
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const savedFileName = `${safeBase}-${uniqueSuffix}${extension}`;

  await fs.mkdir(textAttachmentUploadsDir, { recursive: true });
  const targetPath = path.join(textAttachmentUploadsDir, savedFileName);
  await fs.writeFile(targetPath, decoded.bytes);

  return {
    fileName: savedFileName,
    mimeType: resolvedMime || 'application/octet-stream',
    fileUrl: `/uploads/text-attachments/${savedFileName}`,
    sizeBytes: decoded.bytes.length,
  };
};

const normalizeAffiliateBuilderRows = async (rows = []) => {
  const normalizedRows = [];
  let hasDefault = false;

  for (const row of Array.isArray(rows) ? rows : []) {
    const id = String(row?.id || `builder-${Math.random().toString(36).slice(2, 10)}`).trim();
    const nextImagePath = row?.imageDataUrl
      ? await saveAffiliateImage(id, row.imageDataUrl)
      : String(row?.imagePath || '').trim();
    const isDefault = !hasDefault && normalizeAffiliateFlag(row?.isDefault);
    if (isDefault) {
      hasDefault = true;
    }
    normalizedRows.push({
      id,
      name: String(row?.name || '').trim(),
      description: String(row?.description || '').trim(),
      url: String(row?.url || '').trim(),
      imagePath: nextImagePath,
      show: normalizeAffiliateFlag(row?.show),
      isDefault,
    });
  }

  return normalizedRows;
};

const normalizeAffiliateMonitoringRows = async (rows = []) => {
  const inputMap = new Map((Array.isArray(rows) ? rows : []).map((row) => [String(row?.id || '').trim().toLowerCase(), row]));
  let hasDefault = false;

  const normalizedRows = [];
  for (const preset of affiliateMonitoringDefaults) {
    const row = inputMap.get(preset.id) || {};
    const nextImagePath = row?.imageDataUrl
      ? await saveAffiliateImage(preset.id, row.imageDataUrl)
      : String(row?.imagePath || preset.imagePath || '').trim();
    const isDefault = !hasDefault && normalizeAffiliateFlag(row?.isDefault);
    if (isDefault) {
      hasDefault = true;
    }
    normalizedRows.push({
      id: preset.id,
      name: preset.name,
      description: String(row?.description ?? preset.description ?? '').trim(),
      url: String(row?.url || '').trim(),
      imagePath: nextImagePath,
      show: normalizeAffiliateFlag(row?.show),
      isDefault,
    });
  }

  return normalizedRows;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const generateReportRunId = () => `report-run-${Math.random().toString(36).slice(2, 10)}`;

const getBrowserRunnerTypeForAgency = (agency = '') => {
  const normalized = String(agency || '').trim().toLowerCase();
  if (normalized.includes('identity') || normalized.includes('iiq')) {
    return 'identityiq';
  }
  if (normalized.includes('smart')) {
    return 'smartcredit';
  }
  return '';
};

const getClientThirdAuthValue = (client = {}) => {
  const token = String(client.monitoringToken || '').trim();
  if (token) {
    return token;
  }
  return String(client.secretKey || '').trim() || getLastFourDigits(client.ssn || '');
};

const looksLikeMonitoringToken = (value = '') => {
  const text = String(value || '').trim();
  if (!text) {
    return false;
  }

  if (/^\d{4}$/.test(text)) {
    return false;
  }

  if (/^[A-Za-z0-9+/#=_:-]{12,}$/.test(text)) {
    return true;
  }

  return text.length >= 12;
};

const chooseReportRefreshMode = (client = {}) => {
  const agency = String(client.monitoringAgency || '').trim().toLowerCase();
  const monitoringToken = String(client.monitoringToken || '').trim();
  const hasMonitoringToken = Boolean(monitoringToken);

  if (agency.includes('identity') || agency.includes('iiq')) {
    return {
      mode: 'browser',
      runnerType: 'identityiq',
      integrationKey: '',
      token: '',
    };
  }

  if (agency.includes('smart')) {
    return hasMonitoringToken
      ? {
        mode: 'direct',
        runnerType: '',
        integrationKey: 'smartcredit',
        token: monitoringToken,
      }
      : {
        mode: 'browser',
        runnerType: 'smartcredit',
        integrationKey: '',
        token: '',
      };
  }

  if (agency.includes('myfree')) {
    return hasMonitoringToken
      ? {
        mode: 'direct',
        runnerType: '',
        integrationKey: 'myfreescorenow',
        token: monitoringToken,
      }
      : {
        mode: 'none',
        runnerType: '',
        integrationKey: '',
        token: '',
      };
  }

  return {
    mode: 'none',
    runnerType: '',
    integrationKey: '',
    token: '',
  };
};

const getReportRunSnapshot = (run) => ({
  id: run.id,
  clientId: run.clientId,
  agency: run.agency,
  status: run.status,
  startedAt: run.startedAt,
  endedAt: run.endedAt,
  exitCode: run.exitCode,
  error: run.error,
  logs: [...run.logs],
  client: run.client || null,
});

const appendReportRunLogs = (run, chunk = '', level = 'info') => {
  const text = String(chunk || '').replace(/\r/g, '');
  if (!text) {
    return;
  }

  const lines = text.split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean);

  if (!lines.length) {
    return;
  }

  for (const line of lines) {
    run.logs.push(`[${level}] ${line}`);
  }

  if (run.logs.length > 250) {
    run.logs.splice(0, run.logs.length - 250);
  }
};

const loadFreshSafeClient = async (clientId) => {
  const store = await readStore();
  const client = store.clients.find((entry) => entry.id === clientId);
  return client ? toSafeClient(client) : null;
};

const normalizeCredentialMatchValue = (value) => String(value || '').trim().toLowerCase();

const hasBrowserCredentials = (client) => (
  Boolean(String(client?.monitoringUsername || '').trim())
  && Boolean(String(client?.monitoringPassword || '').trim())
);

const findCredentialSourceClient = (clients, targetClient) => {
  if (!targetClient || !Array.isArray(clients) || !clients.length) return null;

  const targetId = String(targetClient.id || '').trim();
  const targetEmail = normalizeCredentialMatchValue(targetClient.email);
  const targetMonitoringUsername = normalizeCredentialMatchValue(targetClient.monitoringUsername);
  const targetFirstName = normalizeCredentialMatchValue(targetClient.firstName);
  const targetLastName = normalizeCredentialMatchValue(targetClient.lastName);

  const candidates = clients.filter((entry) => (
    entry
    && String(entry.id || '').trim() !== targetId
    && hasBrowserCredentials(entry)
  ));

  if (!candidates.length) return null;

  if (targetMonitoringUsername) {
    const byMonitoringUsername = candidates.find((entry) => (
      normalizeCredentialMatchValue(entry.monitoringUsername) === targetMonitoringUsername
      || normalizeCredentialMatchValue(entry.email) === targetMonitoringUsername
    ));
    if (byMonitoringUsername) return byMonitoringUsername;
  }

  if (targetEmail) {
    const byEmail = candidates.find((entry) => (
      normalizeCredentialMatchValue(entry.email) === targetEmail
      || normalizeCredentialMatchValue(entry.monitoringUsername) === targetEmail
    ));
    if (byEmail) return byEmail;
  }

  if (targetFirstName && targetLastName) {
    const byName = candidates.find((entry) => (
      normalizeCredentialMatchValue(entry.firstName) === targetFirstName
      && normalizeCredentialMatchValue(entry.lastName) === targetLastName
    ));
    if (byName) return byName;
  }

  return null;
};

const hydrateBrowserCredentialsFromDuplicate = (store, selectedClient) => {
  if (!store || !selectedClient || hasBrowserCredentials(selectedClient)) return null;

  const source = findCredentialSourceClient(store.clients || [], selectedClient);
  if (!source) return null;

  selectedClient.monitoringUsername = String(source.monitoringUsername || '').trim();
  selectedClient.monitoringPassword = String(source.monitoringPassword || '').trim();
  if (!String(selectedClient.secretKey || '').trim() && String(source.secretKey || '').trim()) {
    selectedClient.secretKey = String(source.secretKey || '').trim();
  }

  return source;
};

const startBrowserReportRun = async (client, options = {}) => {
  const agency = getBrowserRunnerTypeForAgency(client.monitoringAgency);
  if (!agency) {
    const agencyValue = String(client.monitoringAgency || '').trim() || '[empty]';
    throw new Error(`This client is not set to an IdentityIQ or SmartCredit browser-run service. Currently set to: ${agencyValue}`);
  }
  const username = String(client.monitoringUsername || '').trim();
  const password = String(client.monitoringPassword || '').trim();
  if (!username || !password) {
    throw new Error(`This client needs monitoring username and password before running a browser report refresh. Username: ${username ? '✓' : '✗'}, Password: ${password ? '✓' : '✗'}`);
  }

  const existingRun = [...reportRuns.values()].find((entry) => (
    entry.clientId === client.id
    && (entry.status === 'queued' || entry.status === 'running')
  ));
  if (existingRun) {
    return getReportRunSnapshot(existingRun);
  }

  const run = {
    id: generateReportRunId(),
    clientId: client.id,
    agency,
    status: 'queued',
    startedAt: new Date().toISOString(),
    endedAt: '',
    exitCode: null,
    error: '',
    logs: [],
    client: null,
  };

  reportRuns.set(run.id, run);
  appendReportRunLogs(run, `Queued browser report runner for ${client.firstName} ${client.lastName}.`);
  for (const line of Array.isArray(options.initialLogs) ? options.initialLogs : []) {
    appendReportRunLogs(run, line);
  }

  const child = spawn(process.execPath, [browserReportScriptFile], {
    cwd: __dirname,
    env: {
      ...process.env,
      TOOLS_NINJA_API_BASE: `http://127.0.0.1:${port}`,
      TOOLS_NINJA_CLIENT: JSON.stringify({
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        monitoringAgency: client.monitoringAgency,
        monitoringUsername: client.monitoringUsername,
        monitoringPassword: client.monitoringPassword,
        secretKey: client.secretKey,
      }),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  run.status = 'running';
  appendReportRunLogs(run, `Started browser report runner with ${path.basename(browserReportScriptFile)}.`);

  child.stdout.on('data', (chunk) => {
    appendReportRunLogs(run, chunk, 'info');
  });

  child.stderr.on('data', (chunk) => {
    appendReportRunLogs(run, chunk, 'error');
  });

  child.on('error', async (error) => {
    run.status = 'failed';
    run.endedAt = new Date().toISOString();
    run.exitCode = 1;
    run.error = error.message;
    appendReportRunLogs(run, error.message, 'error');
    run.client = await loadFreshSafeClient(client.id);
  });

  child.on('close', async (code) => {
    run.exitCode = Number.isFinite(code) ? code : 1;
    run.status = run.exitCode === 0 ? 'completed' : 'failed';
    run.endedAt = new Date().toISOString();
    if (run.exitCode !== 0 && !run.error) {
      run.error = `Browser report runner exited with code ${run.exitCode}.`;
      appendReportRunLogs(run, run.error, 'error');
    }
    run.client = await loadFreshSafeClient(client.id);
  });

  return getReportRunSnapshot(run);
};

const runPythonCommand = async (args = []) => new Promise((resolve, reject) => {
  const child = spawn(pythonBinary, [vantageSimulatorScriptFile, ...args], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += String(chunk || '');
  });
  child.stderr.on('data', (chunk) => {
    stderr += String(chunk || '');
  });
  child.on('error', (error) => {
    reject(error);
  });
  child.on('close', (code) => {
    if (Number(code) === 0) {
      resolve({ stdout, stderr });
      return;
    }
    reject(new Error((stderr || stdout || `Python command failed with code ${code}`).trim()));
  });
});

const clampScore = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Math.min(850, Math.max(300, Math.round(numeric)));
};

const estimateFicoFromVantage = (vantageScore, profile = {}) => {
  const score = Number(vantageScore);
  if (!Number.isFinite(score)) {
    return null;
  }
  let gap = 24;
  if (score >= 760) gap = 12;
  else if (score >= 720) gap = 16;
  else if (score >= 680) gap = 20;
  else if (score >= 640) gap = 24;
  else if (score >= 600) gap = 28;
  else gap = 30;

  const collections = Number(profile.collections_unpaid || 0);
  const bankruptcies = Number(profile.bankruptcies || 0);
  const inquiries = Number(profile.inquiries_last_12m || 0);
  if (Number.isFinite(collections) && collections > 0) {
    gap += Math.min(18, collections * 4);
  }
  if (Number.isFinite(bankruptcies) && bankruptcies > 0) {
    gap += Math.min(40, bankruptcies * 18);
  }
  if (Number.isFinite(inquiries) && inquiries > 2) {
    gap += Math.min(8, (inquiries - 2) * 1.5);
  }

  return clampScore(score - gap);
};

const runVantageSimulation = async (profile = {}, scenario = 'baseline', value = '') => {
  const tempDir = await fs.mkdtemp(path.join(__dirname, 'data', 'sim-'));
  const inputPath = path.join(tempDir, 'profile.json');
  const baselinePath = path.join(tempDir, 'baseline.json');
  const scenarioPath = path.join(tempDir, 'scenario.json');

  try {
    await fs.writeFile(inputPath, JSON.stringify(profile, null, 2), 'utf8');

    await runPythonCommand(['calculate', '--input', inputPath, '--output', baselinePath]);
    const baselineRaw = JSON.parse(await fs.readFile(baselinePath, 'utf8'));
    const baselineScore = clampScore(baselineRaw.estimated_score);

    let scenarioRaw = null;
    let scenarioScore = baselineScore;
    if (scenario && scenario !== 'baseline') {
      const args = ['whatif', '--input', inputPath, '--scenario', String(scenario)];
      const cleanValue = String(value ?? '').trim();
      if (cleanValue) {
        args.push('--value', cleanValue);
      }
      args.push('--output', scenarioPath);
      await runPythonCommand(args);
      scenarioRaw = JSON.parse(await fs.readFile(scenarioPath, 'utf8'));
      scenarioScore = clampScore(scenarioRaw?.after?.estimated_score);
    }

    const baselineFico = estimateFicoFromVantage(baselineScore, profile);
    const scenarioFico = estimateFicoFromVantage(scenarioScore, profile);
    const delta = (
      Number.isFinite(Number(scenarioScore))
      && Number.isFinite(Number(baselineScore))
    )
      ? Math.round(Number(scenarioScore) - Number(baselineScore))
      : null;

    return {
      baseline: {
        vantageScore: baselineScore,
        ficoScore: baselineFico,
        raw: baselineRaw,
      },
      scenario: scenarioRaw
        ? {
          vantageScore: scenarioScore,
          ficoScore: scenarioFico,
          delta,
          raw: scenarioRaw,
        }
        : null,
      model: 'vantagescore_3_pro.py',
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
};

const buildFallbackVantageResult = (profile = {}, scenario = 'baseline', errorMessage = '') => {
  const candidateScores = [
    profile.current_vantage,
    profile.currentVantage,
    profile.vantage,
    profile.score,
    profile.vantage_score,
  ];
  const baselineScore = clampScore(candidateScores.find((value) => Number.isFinite(Number(value))) ?? 650);
  const baselineFico = estimateFicoFromVantage(baselineScore, profile);
  const scenarioName = String(scenario || 'baseline').trim() || 'baseline';
  const scenarioPayload = scenarioName === 'baseline'
    ? null
    : {
      vantageScore: baselineScore,
      ficoScore: baselineFico,
      delta: 0,
      raw: {
        fallback: true,
        reason: errorMessage || 'Simulator fallback mode',
      },
    };
  return {
    baseline: {
      vantageScore: baselineScore,
      ficoScore: baselineFico,
      raw: {
        fallback: true,
        reason: errorMessage || 'Simulator fallback mode',
      },
    },
    scenario: scenarioPayload,
    model: 'fallback',
  };
};

const getReportAgeDays = (reportDate) => {
  const parsed = parseDateValue(reportDate);
  if (!parsed) {
    return null;
  }
  const now = new Date();
  const diff = now.getTime() - parsed.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

const normalizeClientRecord = (client = {}) => ({
  ...client,
  id: client.id || generateId(),
  firstName: client.firstName || '',
  lastName: client.lastName || '',
  email: client.email || '',
  dob: client.dob || '',
  ssn: client.ssn || '',
  address: client.address || '',
  phone: client.phone || '',
  spouseClientId: client.spouseClientId || '',
  spouseClientLabel: client.spouseClientLabel || '',
  assignedTo: client.assignedTo || '',
  ninjaAssigned: client.ninjaAssigned || '',
  affiliateAssigned: client.affiliateAssigned || 'None',
  status: client.status || 'Client',
  phase: client.phase || 'None',
  monitoringAgency: client.monitoringAgency || '',
  yearlyIncome: client.yearlyIncome || '',
  housingPayment: client.housingPayment || '',
  debtMonthlyPayments: client.debtMonthlyPayments || '',
  monitoringUsername: client.monitoringUsername || '',
  monitoringPassword: client.monitoringPassword || '',
  secretKey: client.secretKey || '',
  monitoringToken: client.monitoringToken || '',
  portalPassword: client.portalPassword || buildDefaultPortalPassword(client.lastName || '', client.ssn || ''),
  portalEnabled: client.portalEnabled !== undefined ? Boolean(client.portalEnabled) : true,
  language: client.language || 'English',
  ghlContactId: client.ghlContactId || '',
  ghlLocationId: client.ghlLocationId || '',
  ghlSource: client.ghlSource || '',
  goal: client.goal || '',
  notes: client.notes || '',
  documents: normalizeClientDocumentsInput(Array.isArray(client.documents) ? client.documents : []),
  reportDate: client.reportDate || '',
  nextImportInt: client.nextImportInt || '',
  nextImportLabel: client.nextImportLabel || '',
  nextImportMode: client.nextImportMode || 'manual',
  manualNextImportStartDays: Number.isFinite(Number(client.manualNextImportStartDays))
    ? Number.parseInt(client.manualNextImportStartDays, 10)
    : null,
  manualNextImportSetDate: client.manualNextImportSetDate || '',
  refreshNextImportStartDate: client.refreshNextImportStartDate || '',
  creditReportJson: client.creditReportJson || '',
  creditReportSource: client.creditReportSource || '',
  lastSyncedAt: client.lastSyncedAt || '',
  creditReportFileName: client.creditReportFileName || 'missing-credit-report.html',
  creditReportHtml: client.creditReportHtml || buildPlaceholderCreditReportHtml(client.firstName || 'Client', client.lastName || ''),
  createdAt: client.createdAt || new Date().toISOString(),
});

const uniqueStatuses = (statuses = []) => {
  const seen = new Set();
  return statuses
    .map((status) => String(status || '').trim())
    .filter(Boolean)
    .filter((status) => {
      const normalized = status.toLowerCase();
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
};

const uniquePhases = (phases = []) => {
  const seen = new Set();
  return phases
    .map((phase) => String(phase || '').trim())
    .filter(Boolean)
    .filter((phase) => {
      const normalized = phase.toLowerCase();
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
};

const getTodayIsoDate = () => {
  const now = new Date();
  const local = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
  return local.toISOString().slice(0, 10);
};

const advanceClientPhase = (phaseValue = '') => {
  const raw = String(phaseValue || '').trim();
  const match = raw.match(/^phase\s+([1-7])$/i);
  if (!match) {
    return raw || 'None';
  }
  const current = Number.parseInt(match[1], 10);
  if (!Number.isFinite(current)) {
    return raw || 'None';
  }
  if (current >= 7) {
    return 'Phase 7';
  }
  return `Phase ${current + 1}`;
};

const stripHtml = (html) => String(html)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const buildPlaceholderCreditReportHtml = (firstName, lastName) => `<!DOCTYPE html>
<html>
  <head><title>Credit Report Missing</title></head>
  <body>
    <h1>${firstName} ${lastName}</h1>
    <p>No HTML credit report has been uploaded for this client yet.</p>
  </body>
</html>`;

const isPlaceholderCreditReportHtml = (html) => /No HTML credit report has been uploaded/i.test(String(html || ''));

const hasMeaningfulReportData = (client) => Boolean(
  String(client.creditReportJson || '').trim()
  || (String(client.creditReportHtml || '').trim() && !isPlaceholderCreditReportHtml(client.creditReportHtml)),
);

const normalizeLookupValue = (value) => String(value || '')
  .replace(/[\u200B-\u200D\uFEFF]/g, '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ');

const normalizeLookupPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
};

const getLastFourDigits = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.slice(-4);
};

const normalizeSsnInput = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 9) {
    const nine = digits.slice(0, 9);
    return `${nine.slice(0, 3)}-${nine.slice(3, 5)}-${nine.slice(5)}`;
  }
  return raw;
};

const normalizeDobInput = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[2]}-${isoMatch[3]}-${isoMatch[1]}`;
  }

  const usMatch = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (usMatch) {
    return `${usMatch[1]}-${usMatch[2]}-${usMatch[3]}`;
  }

  const digits = raw.replace(/\D/g, '');
  if (digits.length === 8) {
    if (digits.startsWith('19') || digits.startsWith('20')) {
      return `${digits.slice(4, 6)}-${digits.slice(6, 8)}-${digits.slice(0, 4)}`;
    }
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 8)}`;
  }

  return raw;
};

const hasOwnField = (source, key) => Object.prototype.hasOwnProperty.call(source || {}, key);
const readOptionalStringField = (source, key, fallback = '') => (
  hasOwnField(source, key)
    ? String(source[key] ?? '').trim()
    : String(fallback ?? '').trim()
);

const buildDefaultPortalPassword = (lastName = '', ssn = '') => {
  const safeLastName = String(lastName || '').trim().replace(/\s+/g, '');
  return `${safeLastName}${getLastFourDigits(ssn)}`.trim();
};

const CONTABO_DOCS_BASE_URL = `${String(storageS3EndpointEnv || 'https://usc1.contabostorage.com').trim().replace(/\/+$/g, '')}/${encodeURIComponent(String(storageS3BucketEnv || 'id-docs').trim() || 'id-docs')}`;
const CONTABO_DOCS_PREFIX = 'api-app-public-fullcopy-2026-05-14';
const CONTABO_DEFAULT_REGION = 'usc1';

const normalizeStorageRelativePath = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  let normalized = raw.replace(/^https?:\/\/[^/]+\//i, '');
  normalized = normalized.replace(/^id-docs\//i, '');
  normalized = normalized.replace(/^api-app-public-fullcopy-2026-05-14\//i, '');
  normalized = normalized.replace(/^public\//i, '');
  normalized = normalized.replace(/^\.?\//, '');
  return normalized.trim();
};

const normalizeExistingStorageKey = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  let normalized = raw.replace(/^https?:\/\/[^/]+\//i, '');
  normalized = normalized.replace(/^id-docs\//i, '');
  normalized = normalized.replace(/^public\//i, '');
  normalized = normalized.replace(/^\.?\//, '');
  normalized = normalized.trim();

  if (!normalized) {
    return '';
  }

  if (normalized.startsWith(`${CONTABO_DOCS_PREFIX}/`)) {
    return normalized;
  }

  if (!normalized.includes('/')) {
    return `${CONTABO_DOCS_PREFIX}/${normalized}`;
  }

  return normalized;
};

const safeDecodeUri = (value = '') => {
  const raw = String(value || '');
  if (!raw.includes('%')) {
    return raw;
  }
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const normalizeClientDocumentsInput = (documents) => {
  if (!Array.isArray(documents)) {
    return [];
  }

  return documents
    .filter((doc) => doc && typeof doc === 'object')
    .map((doc) => {
      const normalized = { ...doc };
      const type = String(doc.type || '').trim();
      const fileName = String(doc.fileName || '').trim();
      const storageKeyInput = safeDecodeUri(String(doc.storageKey || '').trim());
      const fileDataUrl = String(doc.fileDataUrl || '').trim();
      const pathHint = String(doc.path || doc.filePath || '').trim();
      const storageKey = normalizeExistingStorageKey(storageKeyInput);

      normalized.type = type;
      normalized.fileName = fileName;
      normalized.storageKey = storageKey;
      normalized.fileDataUrl = fileDataUrl;

      let relativeSource = pathHint;
      if (!relativeSource && /^https?:\/\/[^/]*contabostorage\.com\//i.test(fileDataUrl)) {
        relativeSource = fileDataUrl;
      }
      if (!relativeSource && String(fileDataUrl || '').startsWith('/api/documents/proxy?key=')) {
        relativeSource = safeDecodeUri(String(fileDataUrl || '').split('key=')[1] || '');
      }
      const relativeFromPath = normalizeStorageRelativePath(relativeSource);
      if (!normalized.storageKey && relativeFromPath) {
        normalized.storageKey = `${CONTABO_DOCS_PREFIX}/${relativeFromPath}`;
      }

      if (!normalized.fileName) {
        const source = normalized.storageKey || normalized.fileDataUrl || pathHint;
        const parts = String(source || '').split('/');
        normalized.fileName = String(parts[parts.length - 1] || '').trim();
      }

      if (normalized.storageKey) {
        normalized.fileDataUrl = `/api/documents/proxy?key=${encodeURIComponent(normalized.storageKey)}`;
      }

      if (normalized.includeInPrintLetters === undefined) {
        normalized.includeInPrintLetters = normalized.type === 'Limited Power of Attorney';
      } else {
        normalized.includeInPrintLetters = Boolean(normalized.includeInPrintLetters);
      }

      if (!String(normalized.printSide || '').trim()) {
        normalized.printSide = 'front';
      }

      return normalized;
    })
    .filter((doc) => String(doc.type || '').trim());
};

const decodeDataUrlPayload = (value = '') => {
  const raw = String(value || '').trim();
  const match = raw.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?(?:;(base64))?,([\s\S]*)$/i);
  if (!match) {
    return null;
  }
  const mimeType = String(match[1] || 'application/octet-stream').toLowerCase();
  const isBase64 = String(match[2] || '').toLowerCase() === 'base64';
  const payload = String(match[3] || '');
  try {
    const buffer = isBase64
      ? Buffer.from(payload, 'base64')
      : Buffer.from(decodeURIComponent(payload), 'utf8');
    return { mimeType, buffer };
  } catch {
    return null;
  }
};

const sanitizeStoragePathSegment = (value = '', fallback = 'item') => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '');
  return normalized || fallback;
};

const getExtensionFromMimeType = (mimeType = '') => {
  const normalized = String(mimeType || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return '.jpg';
  if (normalized === 'image/png') return '.png';
  if (normalized === 'image/webp') return '.webp';
  if (normalized === 'image/gif') return '.gif';
  if (normalized === 'application/pdf') return '.pdf';
  return '';
};

const getContentTypeFromFileName = (fileName = '') => {
  const ext = path.extname(String(fileName || '').trim()).toLowerCase();
  return contentTypes[ext] || 'application/octet-stream';
};

const buildClientDocumentStorageKey = ({
  ownerKey,
  clientId,
  documentType,
  fileName,
  mimeType,
  index,
}) => {
  const safeClientId = sanitizeStoragePathSegment(clientId, 'unknown-client');
  const safeType = sanitizeStoragePathSegment(documentType, `document-${index + 1}`);
  const baseName = sanitizeStoragePathSegment(path.basename(String(fileName || '').trim(), path.extname(String(fileName || '').trim())), `file-${index + 1}`);
  const extFromName = path.extname(String(fileName || '').trim()).toLowerCase();
  const ext = extFromName || getExtensionFromMimeType(mimeType) || '.bin';
  return `${ownerBucketPrefix(ownerKey)}/clients/${safeClientId}/documents/${safeType}/${baseName}${ext}`;
};

const persistClientDocumentsToS3 = async (documents = [], { ownerKey, clientId }) => {
  const normalizedOwner = normalizeOwnerKey(ownerKey);
  const normalizedDocs = normalizeClientDocumentsInput(documents);
  const output = [];

  for (let index = 0; index < normalizedDocs.length; index += 1) {
    const doc = { ...normalizedDocs[index] };
    const existingProxyKey = (() => {
      const value = String(doc.fileDataUrl || '').trim();
      if (!value.startsWith('/api/documents/proxy?key=')) return '';
      try {
        return safeDecodeUri(value.split('key=')[1] || '').trim();
      } catch {
        return '';
      }
    })();
    if (!doc.storageKey && existingProxyKey) {
      doc.storageKey = existingProxyKey;
    }

    if (doc.storageKey) {
      doc.storageKey = safeDecodeUri(String(doc.storageKey || '').trim());
      doc.fileDataUrl = `/api/documents/proxy?key=${encodeURIComponent(doc.storageKey)}`;
      output.push(doc);
      continue;
    }

    if (!String(doc.fileDataUrl || '').trim()) {
      output.push(doc);
      continue;
    }

    const decoded = decodeDataUrlPayload(doc.fileDataUrl);
    if (!decoded || !decoded.buffer || decoded.buffer.length === 0) {
      throw new Error(`Document "${doc.type || `#${index + 1}`}" must be uploaded as a valid file before saving.`);
    }

    const storageKey = buildClientDocumentStorageKey({
      ownerKey: normalizedOwner,
      clientId,
      documentType: doc.type || '',
      fileName: doc.fileName || '',
      mimeType: decoded.mimeType,
      index,
    });
    const contentType = String(doc.fileType || '').trim() || decoded.mimeType || getContentTypeFromFileName(doc.fileName || '');
    const upload = await putContaboObject(storageKey, decoded.buffer, contentType);
    if (!upload.ok) {
      throw new Error(`Failed to upload "${doc.type || `Document ${index + 1}`}" to S3 (${upload.status}). ${upload.body || ''}`.trim());
    }

    doc.storageKey = storageKey;
    doc.fileDataUrl = `/api/documents/proxy?key=${encodeURIComponent(storageKey)}`;
    if (!String(doc.fileName || '').trim()) {
      doc.fileName = path.basename(storageKey);
    }
    doc.fileType = contentType;
    doc.fileSize = decoded.buffer.length;
    output.push(doc);
  }

  return output;
};

const splitFullName = (value) => {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
};

const buildAmzDate = (date = new Date()) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return {
    amzDate: `${year}${month}${day}T${hours}${minutes}${seconds}Z`,
    dateStamp: `${year}${month}${day}`,
  };
};

const sha256Hex = (value = '') => createHash('sha256').update(value).digest('hex');

const hmac = (key, value) => createHmac('sha256', key).update(value).digest();

const encodeS3Path = (value = '') => String(value || '')
  .split('/')
  .filter((segment) => segment.length > 0)
  .map((segment) => encodeURIComponent(segment))
  .join('/');

const resolveContaboConfig = async () => {
  const integrations = await loadIntegrations().catch(() => ({}));
  const stored = integrations?.contabo || {};
  let endpoint = String(storageS3EndpointEnv || stored.s3Endpoint || process.env.CONTABO_S3_ENDPOINT || defaultIntegrations.contabo.s3Endpoint || 'https://usc1.contabostorage.com')
    .trim()
    .replace(/\/+$/g, '');
  endpoint = endpoint.replace(/us-central-1\.contabostorage\.com/gi, 'usc1.contabostorage.com');
  const bucket = String(storageS3BucketEnv || stored.s3Bucket || process.env.CONTABO_S3_BUCKET || defaultIntegrations.contabo.s3Bucket || 'id-docs')
    .trim();
  const accessKey = String(storageS3AccessKeyEnv || stored.s3AccessKey || process.env.CONTABO_S3_ACCESS_KEY || defaultIntegrations.contabo.s3AccessKey || '')
    .trim();
  const secretKey = String(storageS3SecretKeyEnv || stored.s3SecretKey || process.env.CONTABO_S3_SECRET_KEY || defaultIntegrations.contabo.s3SecretKey || '')
    .trim();
  const endpointHost = (() => {
    try {
      return new URL(endpoint).host;
    } catch {
      return 'usc1.contabostorage.com';
    }
  })();
  const region = String(process.env.CONTABO_S3_REGION || endpointHost.split('.')[0] || CONTABO_DEFAULT_REGION).trim() || CONTABO_DEFAULT_REGION;
  return {
    endpoint,
    endpointHost,
    bucket,
    accessKey,
    secretKey,
    region,
  };
};

const putContaboObject = async (objectPath = '', body = '', contentType = 'application/json; charset=utf-8') => {
  const key = String(objectPath || '').trim().replace(/^\/+/, '');
  if (!key) return { ok: false, status: 400, body: 'Missing object path.' };

  const config = await resolveContaboConfig();
  if (!config.accessKey || !config.secretKey || !config.bucket) {
    return { ok: false, status: 503, body: 'Contabo credentials are not configured.' };
  }

  const payloadBuffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body || ''), 'utf8');
  const payloadHash = sha256Hex(payloadBuffer);
  const encodedObjectPath = encodeS3Path(key);
  const canonicalUri = `/${encodeURIComponent(config.bucket)}/${encodedObjectPath}`;
  const requestUrl = `${config.endpoint}${canonicalUri}`;
  const method = 'PUT';
  const { amzDate, dateStamp } = buildAmzDate(new Date());
  const canonicalHeaders = `content-type:${contentType}\nhost:${config.endpointHost}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    method,
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmac(`AWS4${config.secretKey}`, dateStamp);
  const kRegion = hmac(kDate, config.region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  let upstream;
  try {
    upstream = await fetch(requestUrl, {
      method,
      headers: {
        'content-type': contentType,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        Authorization: authorization,
      },
      body: payloadBuffer,
    });
  } catch (error) {
    return {
      ok: false,
      status: 599,
      body: `S3 upload transport error: ${error.message}`,
    };
  }

  if (!upstream.ok) {
    return {
      ok: false,
      status: upstream.status,
      body: await upstream.text().catch(() => upstream.statusText || 'S3 upload failed'),
    };
  }

  return { ok: true, status: upstream.status, eTag: upstream.headers.get('etag') || '' };
};

const ownerBucketPrefix = (ownerKey = getCurrentOwnerKey()) => `businesses/${normalizeOwnerKey(ownerKey)}`;

const mirrorBusinessBlobToS3 = async (ownerKey, relativePath, payload, contentType = 'application/json; charset=utf-8') => {
  const fullPath = `${ownerBucketPrefix(ownerKey)}/${String(relativePath || '').replace(/^\/+/, '')}`;
  const result = await putContaboObject(fullPath, payload, contentType);
  if (!result.ok) {
    throw new Error(`S3 mirror failed for ${fullPath}: ${result.status} ${result.body || ''}`.trim());
  }
  return fullPath;
};

const fetchContaboObject = async (storageKey = '') => {
  let key = safeDecodeUri(String(storageKey || '').trim()).replace(/^\/+/, '');
  key = key.replace(/^id-docs\//i, '');
  key = key.replace(/^public\//i, '');
  if (key && !key.startsWith(`${CONTABO_DOCS_PREFIX}/`) && !key.includes('/')) {
    key = `${CONTABO_DOCS_PREFIX}/${key}`;
  }
  if (!key) {
    return { ok: false, status: 400, body: 'Missing storage key.' };
  }

  const config = await resolveContaboConfig();
  if (!config.accessKey || !config.secretKey || !config.bucket) {
    return { ok: false, status: 503, body: 'Contabo credentials are not configured.' };
  }

  const encodedObjectPath = encodeS3Path(key);
  const canonicalUri = `/${encodeURIComponent(config.bucket)}/${encodedObjectPath}`;
  const requestUrl = `${config.endpoint}${canonicalUri}`;
  const method = 'GET';
  const payloadHash = sha256Hex('');
  const { amzDate, dateStamp } = buildAmzDate(new Date());
  const canonicalHeaders = `host:${config.endpointHost}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    method,
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmac(`AWS4${config.secretKey}`, dateStamp);
  const kRegion = hmac(kDate, config.region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  let upstream;
  try {
    upstream = await fetch(requestUrl, {
      method,
      headers: {
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        Authorization: authorization,
      },
    });
  } catch (error) {
    return {
      ok: false,
      status: 599,
      body: `S3 fetch transport error: ${error.message}`,
      contentType: 'text/plain; charset=utf-8',
    };
  }

  if (!upstream.ok) {
    return {
      ok: false,
      status: upstream.status,
      body: await upstream.text().catch(() => upstream.statusText || 'Document fetch failed'),
      contentType: upstream.headers.get('content-type') || 'text/plain; charset=utf-8',
    };
  }

  const arrayBuffer = await upstream.arrayBuffer();
  return {
    ok: true,
    status: 200,
    body: Buffer.from(arrayBuffer),
    contentType: upstream.headers.get('content-type') || 'application/octet-stream',
    contentLength: upstream.headers.get('content-length') || '',
    eTag: upstream.headers.get('etag') || '',
    lastModified: upstream.headers.get('last-modified') || '',
  };
};

const fetchLocalPublicDocument = async (storageKey = '') => {
  const raw = safeDecodeUri(String(storageKey || '').trim()).replace(/^\/+/, '');
  if (!raw) {
    return { ok: false, status: 404, body: 'Local document key is empty.' };
  }

  const candidates = new Set();
  const basename = path.basename(raw);
  if (basename) {
    candidates.add(basename);
  }
  if (!raw.includes('..')) {
    candidates.add(raw);
    const withoutPrefix = raw.replace(/^public\//i, '');
    if (withoutPrefix) {
      candidates.add(withoutPrefix);
    }
  }

  for (const candidate of candidates) {
    const filePath = path.join(publicDir, candidate);
    if (!filePath.startsWith(publicDir)) {
      continue;
    }
    try {
      const [body, stats] = await Promise.all([fs.readFile(filePath), fs.stat(filePath)]);
      const ext = path.extname(filePath).toLowerCase();
      return {
        ok: true,
        status: 200,
        body,
        contentType: contentTypes[ext] || 'application/octet-stream',
        contentLength: Number.isFinite(stats.size) ? stats.size : undefined,
        lastModified: stats.mtime?.toUTCString?.(),
      };
    } catch {
      // Try the next candidate
    }
  }

  return { ok: false, status: 404, body: 'Local fallback document not found.' };
};

const normalizeCustomFieldSlug = (value) => normalizeLookupValue(value)
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const getNestedValue = (source, pathExpression = '') => pathExpression
  .split('.')
  .reduce((current, segment) => (current && current[segment] !== undefined ? current[segment] : undefined), source);

const extractHighLevelCustomFieldMap = (payload = {}) => {
  const map = new Map();
  const candidateCollections = [
    payload?.customFields,
    payload?.custom_fields,
    payload?.customData?.customFields,
    payload?.customData?.custom_fields,
    payload?.contact?.customFields,
    payload?.contact?.custom_fields,
    payload?.contact?.customData?.customFields,
    payload?.contact?.customData?.custom_fields,
  ];

  for (const collection of candidateCollections) {
    if (!collection) {
      continue;
    }

    if (Array.isArray(collection)) {
      for (const row of collection) {
        const key = normalizeCustomFieldSlug(
          row?.key
          || row?.name
          || row?.fieldKey
          || row?.field_key
          || row?.label
          || row?.title
          || row?.id,
        );
        const value = row?.value ?? row?.fieldValue ?? row?.field_value ?? row?.data ?? '';
        if (key && String(value || '').trim()) {
          map.set(key, String(value).trim());
        }
      }
      continue;
    }

    if (typeof collection === 'object') {
      Object.entries(collection).forEach(([key, value]) => {
        const normalizedKey = normalizeCustomFieldSlug(key);
        if (normalizedKey && String(value || '').trim()) {
          map.set(normalizedKey, String(value).trim());
        }
      });
    }
  }

  return map;
};

const getHighLevelPayloadValue = (payload, customFields, ...keys) => {
  for (const key of keys) {
    if (!key) {
      continue;
    }

    if (key.includes('.')) {
      const nestedValue = getNestedValue(payload, key);
      if (String(nestedValue || '').trim()) {
        return String(nestedValue).trim();
      }
    }

    const directValue = payload?.[key];
    if (String(directValue || '').trim()) {
      return String(directValue).trim();
    }

    const normalizedKey = normalizeCustomFieldSlug(key);
    if (normalizedKey && customFields.has(normalizedKey)) {
      return customFields.get(normalizedKey) || '';
    }
  }

  return '';
};

const extractHighLevelContactPayload = (payload = {}) => {
  const customFields = extractHighLevelCustomFieldMap(payload);
  const fullName = getHighLevelPayloadValue(payload, customFields, 'fullName', 'full_name', 'contact.name', 'name');
  const splitName = splitFullName(fullName);
  const firstName = getHighLevelPayloadValue(payload, customFields, 'firstName', 'first_name', 'contact.firstName', 'contact.first_name') || splitName.firstName;
  const lastName = getHighLevelPayloadValue(payload, customFields, 'lastName', 'last_name', 'contact.lastName', 'contact.last_name') || splitName.lastName;

  return {
    ghlContactId: getHighLevelPayloadValue(payload, customFields, 'contact.id', 'contactId', 'contact_id'),
    ghlLocationId: getHighLevelPayloadValue(payload, customFields, 'locationId', 'location_id', 'contact.locationId', 'contact.location_id'),
    firstName,
    lastName,
    email: getHighLevelPayloadValue(payload, customFields, 'contact.email', 'email'),
    phone: getHighLevelPayloadValue(payload, customFields, 'contact.phone', 'phone'),
    status: getHighLevelPayloadValue(payload, customFields, 'status', 'contact.status', 'client_status', 'clientstatus'),
    goal: getHighLevelPayloadValue(payload, customFields, 'goal'),
    notes: getHighLevelPayloadValue(payload, customFields, 'notes', 'contact.notes'),
    monitoringAgency: getHighLevelPayloadValue(payload, customFields, 'monitoringAgency', 'monitoring_agency'),
    monitoringUsername: getHighLevelPayloadValue(payload, customFields, 'monitoringUsername', 'monitoring_username'),
    monitoringPassword: getHighLevelPayloadValue(payload, customFields, 'monitoringPassword', 'monitoring_password'),
    yearlyIncome: getHighLevelPayloadValue(payload, customFields, 'yearlyIncome', 'yearly_income'),
    housingPayment: getHighLevelPayloadValue(payload, customFields, 'housingPayment', 'housing_payment'),
    debtMonthlyPayments: getHighLevelPayloadValue(payload, customFields, 'debtMonthlyPayments', 'debt_monthly_payments'),
    source: getHighLevelPayloadValue(payload, customFields, 'source', 'workflow.name', 'trigger.name') || 'gohighlevel-webhook',
    tags: Array.isArray(payload?.contact?.tags)
      ? payload.contact.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
      : Array.isArray(payload?.tags)
        ? payload.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
        : [],
  };
};

const stringifyJsonValue = (value) => {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string') {
    const text = String(value).replace(/^\uFEFF/, '').trim();
    if (!text) {
      return '';
    }
    const callbackMatch = text.match(/^\s*JSON_CALLBACK\s*\(\s*([\s\S]*?)\s*\)\s*;?\s*$/i);
    if (callbackMatch?.[1]) {
      return callbackMatch[1].trim();
    }
    return text;
  }

  return JSON.stringify(value);
};

const unwrapJsonCallbackPayload = (value) => {
  const text = String(value || '').replace(/^\uFEFF/, '').trim();
  if (!text) {
    return '';
  }

  const strictWrapped = text.match(/^\s*JSON_CALLBACK\s*\(\s*([\s\S]*?)\s*\)\s*;?\s*$/i);
  if (strictWrapped?.[1]) {
    return strictWrapped[1].trim();
  }

  const callbackStart = text.search(/JSON_CALLBACK\s*\(/i);
  if (callbackStart >= 0) {
    const openParen = text.indexOf('(', callbackStart);
    if (openParen >= 0) {
      let depth = 0;
      let inString = false;
      let quoteChar = '';
      let escaping = false;
      for (let i = openParen; i < text.length; i += 1) {
        const ch = text[i];
        if (inString) {
          if (escaping) {
            escaping = false;
          } else if (ch === '\\') {
            escaping = true;
          } else if (ch === quoteChar) {
            inString = false;
            quoteChar = '';
          }
          continue;
        }

        if (ch === '"' || ch === '\'') {
          inString = true;
          quoteChar = ch;
          continue;
        }
        if (ch === '(') depth += 1;
        if (ch === ')') {
          depth -= 1;
          if (depth === 0) {
            return text.slice(openParen + 1, i).trim();
          }
        }
      }
    }
  }

  return text;
};

const parseJsonValue = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(String(value));
  } catch {
    const unwrapped = unwrapJsonCallbackPayload(String(value));
    if (unwrapped && unwrapped !== String(value).trim()) {
      try {
        return JSON.parse(unwrapped);
      } catch {
        // Keep falling back to embedded extraction.
      }
    }

    const extracted = extractEmbeddedJsonString(String(value));
    if (!extracted) {
      return null;
    }

    try {
      return JSON.parse(extracted);
    } catch {
      return null;
    }
  }
};

const extractEmbeddedJsonString = (value) => {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  const candidateStarts = [];
  const bundleIndex = text.indexOf('{"BundleComponents"');
  if (bundleIndex >= 0) {
    candidateStarts.push(bundleIndex);
  }

  const firstBraceIndex = text.indexOf('{');
  if (firstBraceIndex >= 0 && !candidateStarts.includes(firstBraceIndex)) {
    candidateStarts.push(firstBraceIndex);
  }

  const firstBracketIndex = text.indexOf('[');
  if (firstBracketIndex >= 0 && !candidateStarts.includes(firstBracketIndex)) {
    candidateStarts.push(firstBracketIndex);
  }

  const extractBalancedToken = (startIndex) => {
    const opening = text[startIndex];
    const closing = opening === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escaping = false;

    for (let index = startIndex; index < text.length; index += 1) {
      const char = text[index];

      if (inString) {
        if (escaping) {
          escaping = false;
          continue;
        }

        if (char === '\\') {
          escaping = true;
          continue;
        }

        if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === opening) {
        depth += 1;
        continue;
      }

      if (char === closing) {
        depth -= 1;
        if (depth === 0) {
          return text.slice(startIndex, index + 1);
        }
      }
    }

    return '';
  };

  for (const startIndex of candidateStarts) {
    const candidate = extractBalancedToken(startIndex);
    if (candidate) {
      return candidate;
    }
  }

  return '';
};

const extractDateToken = (value) => {
  const match = String(value || '').match(/(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/);
  return match?.[1] || '';
};

const ensureArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  return value === undefined || value === null ? [] : [value];
};

const bureauKeyFromValue = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return '';
  }

  if (normalized.includes('transunion') || normalized === 'tuc') {
    return 'transunion';
  }
  if (normalized.includes('experian') || normalized === 'exp') {
    return 'experian';
  }
  if (normalized.includes('equifax') || normalized === 'eqf') {
    return 'equifax';
  }

  return '';
};

const formatDisplayDate = (value) => {
  if (!value) {
    return '';
  }

  const date = parseDateValue(value);
  if (!date) {
    return String(value).trim();
  }

  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
};

const pickFirstNonEmpty = (...values) => values.find((value) => String(value || '').trim()) || '';

const readJsonAttribute = (value, key) => {
  if (!value || typeof value !== 'object') {
    return '';
  }

  return pickFirstNonEmpty(value[key], value[`@${key}`]);
};

const readJsonScalar = (value) => {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value !== 'object') {
    return String(value).trim();
  }

  return pickFirstNonEmpty(value.$, value['@value'], value.value);
};

const readJsonDescriptor = (value) => pickFirstNonEmpty(
  readJsonAttribute(value, 'description'),
  readJsonAttribute(value, 'abbreviation'),
  readJsonAttribute(value, 'symbol'),
);

const shouldExcludeOpenAccountCandidate = (details = {}) => {
  const combinedAccountType = `${details.accountType || ''} ${details.accountTypeDetail || ''}`.toLowerCase();
  const normalizedStatus = String(details.status || '').toLowerCase();
  const normalizedAccountRating = String(details.accountRating || '').toLowerCase();
  const normalizedPaymentStatus = String(details.paymentStatus || '').toLowerCase();
  const combinedSignals = `${normalizedStatus} ${normalizedAccountRating} ${normalizedPaymentStatus}`.replace(/\s+/g, ' ').trim();

  // Business rule: if account status itself is Closed or Paid, do not include it
  // in the Open Accounts dataset.
  if (/\bclosed\b|\bpaid\b/.test(normalizedStatus)) {
    return true;
  }

  // Explicit business rule: never include derogatory accounts in Open Accounts.
  if (/derog/.test(combinedSignals)) {
    return true;
  }

  const hasNegativeSignal = /closed|charge.?off|chargeoff|collection|repossession|foreclosure|discharged/.test(combinedSignals);
  const hasOpenSignal = /open|current|active|paid as agreed|pays as agreed|paying as agreed|never late/.test(combinedSignals);

  if (combinedAccountType.includes('collection account') || combinedAccountType.includes(' collection ')) {
    return true;
  }

  // Keep open/current accounts even if they contain late-payment signals.
  // Exclude only when negative lifecycle terms are present without any open/current signal.
  if (hasNegativeSignal && !hasOpenSignal) {
    return true;
  }

  return false;
};

const normalizeAccountFingerprintValue = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const normalizeAccountDigits = (value = '') => String(value || '').replace(/[^0-9]/g, '');

const areLikelySameAccountNumber = (leftValue = '', rightValue = '') => {
  const left = normalizeAccountDigits(leftValue);
  const right = normalizeAccountDigits(rightValue);

  if (!left || !right) {
    return false;
  }

  if (left === right) {
    return true;
  }

  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  if (shorter.length < 6) {
    return false;
  }

  return longer.startsWith(shorter) || longer.endsWith(shorter);
};

const choosePreferredBureauValue = (currentValue = '', candidateValue = '') => {
  const current = String(currentValue || '').trim();
  const candidate = String(candidateValue || '').trim();
  if (!current) {
    return candidate;
  }
  if (!candidate) {
    return current;
  }

  const currentAmount = Number.parseFloat(current.replace(/[^0-9.-]/g, ''));
  const candidateAmount = Number.parseFloat(candidate.replace(/[^0-9.-]/g, ''));
  if (Number.isFinite(currentAmount) && Number.isFinite(candidateAmount)) {
    if (currentAmount === 0 && candidateAmount !== 0) {
      return candidate;
    }
    if (candidateAmount === 0 && currentAmount !== 0) {
      return current;
    }
  }

  return current;
};

const scoreOpenAccountQuality = (account = {}) => {
  let score = 0;
  const bureaus = account?.bureaus || {};
  const bureauKeys = ['transunion', 'experian', 'equifax'];
  for (const bureau of bureauKeys) {
    if (bureaus[bureau]) {
      score += 5;
    }
    if (String(account?.balanceByBureau?.[bureau] || '').trim()) {
      score += 2;
    }
    if (String(account?.creditLimitByBureau?.[bureau] || '').trim()) {
      score += 2;
    }
    if (String(account?.dateOpenedByBureau?.[bureau] || '').trim()) {
      score += 1;
    }
  }
  if (String(account?.accountNumber || '').trim()) {
    score += 3;
  }
  if (String(account?.name || '').trim()) {
    score += 2;
  }
  return score;
};

const mergeOpenAccountRecords = (primary = {}, secondary = {}) => {
  const merged = {
    ...primary,
    bureaus: { ...(primary?.bureaus || {}) },
    accountTypeByBureau: { ...(primary?.accountTypeByBureau || {}) },
    accountTypeDetailByBureau: { ...(primary?.accountTypeDetailByBureau || {}) },
    statusByBureau: { ...(primary?.statusByBureau || {}) },
    balanceByBureau: { ...(primary?.balanceByBureau || {}) },
    creditLimitByBureau: { ...(primary?.creditLimitByBureau || {}) },
    highCreditByBureau: { ...(primary?.highCreditByBureau || {}) },
    highBalanceByBureau: { ...(primary?.highBalanceByBureau || {}) },
    dateOpenedByBureau: { ...(primary?.dateOpenedByBureau || {}) },
  };

  for (const bureau of ['transunion', 'experian', 'equifax']) {
    const primaryBureau = Boolean(primary?.bureaus?.[bureau]);
    const secondaryBureau = Boolean(secondary?.bureaus?.[bureau]);
    merged.bureaus[bureau] = primaryBureau || secondaryBureau;

    merged.accountTypeByBureau[bureau] = choosePreferredBureauValue(
      primary?.accountTypeByBureau?.[bureau],
      secondary?.accountTypeByBureau?.[bureau],
    );
    merged.accountTypeDetailByBureau[bureau] = choosePreferredBureauValue(
      primary?.accountTypeDetailByBureau?.[bureau],
      secondary?.accountTypeDetailByBureau?.[bureau],
    );
    merged.statusByBureau[bureau] = choosePreferredBureauValue(
      primary?.statusByBureau?.[bureau],
      secondary?.statusByBureau?.[bureau],
    );
    merged.balanceByBureau[bureau] = choosePreferredBureauValue(
      primary?.balanceByBureau?.[bureau],
      secondary?.balanceByBureau?.[bureau],
    );
    merged.creditLimitByBureau[bureau] = choosePreferredBureauValue(
      primary?.creditLimitByBureau?.[bureau],
      secondary?.creditLimitByBureau?.[bureau],
    );
    merged.highCreditByBureau[bureau] = choosePreferredBureauValue(
      primary?.highCreditByBureau?.[bureau],
      secondary?.highCreditByBureau?.[bureau],
    );
    merged.highBalanceByBureau[bureau] = choosePreferredBureauValue(
      primary?.highBalanceByBureau?.[bureau],
      secondary?.highBalanceByBureau?.[bureau],
    );
    merged.dateOpenedByBureau[bureau] = choosePreferredBureauValue(
      primary?.dateOpenedByBureau?.[bureau],
      secondary?.dateOpenedByBureau?.[bureau],
    );
  }

  merged.accountNumber = choosePreferredBureauValue(primary?.accountNumber, secondary?.accountNumber);
  merged.accountType = choosePreferredBureauValue(primary?.accountType, secondary?.accountType);
  merged.accountTypeDetail = choosePreferredBureauValue(primary?.accountTypeDetail, secondary?.accountTypeDetail);
  merged.status = choosePreferredBureauValue(primary?.status, secondary?.status);
  merged.balance = choosePreferredBureauValue(primary?.balance, secondary?.balance);
  merged.creditLimit = choosePreferredBureauValue(primary?.creditLimit, secondary?.creditLimit);
  merged.highCredit = choosePreferredBureauValue(primary?.highCredit, secondary?.highCredit);
  merged.highBalance = choosePreferredBureauValue(primary?.highBalance, secondary?.highBalance);
  merged.dateOpened = choosePreferredBureauValue(primary?.dateOpened, secondary?.dateOpened);
  merged.dateLastActive = choosePreferredBureauValue(primary?.dateLastActive, secondary?.dateLastActive);
  merged.dateOfLastPayment = choosePreferredBureauValue(primary?.dateOfLastPayment, secondary?.dateOfLastPayment);
  merged.monthlyPayment = choosePreferredBureauValue(primary?.monthlyPayment, secondary?.monthlyPayment);
  merged.creditorAddress = choosePreferredBureauValue(primary?.creditorAddress, secondary?.creditorAddress);
  merged.creditorPhone = choosePreferredBureauValue(primary?.creditorPhone, secondary?.creditorPhone);

  return merged;
};

const areLikelyDuplicateOpenAccounts = (left = {}, right = {}) => {
  const leftName = normalizeAccountFingerprintValue(left?.name);
  const rightName = normalizeAccountFingerprintValue(right?.name);
  if (!leftName || !rightName || leftName !== rightName) {
    return false;
  }

  const leftType = normalizeAccountFingerprintValue(left?.accountTypeDetail || left?.accountType);
  const rightType = normalizeAccountFingerprintValue(right?.accountTypeDetail || right?.accountType);
  if (leftType && rightType && leftType !== rightType) {
    return false;
  }

  if (areLikelySameAccountNumber(left?.accountNumber, right?.accountNumber)) {
    return true;
  }

  const leftOpened = normalizeAccountFingerprintValue(left?.dateOpened);
  const rightOpened = normalizeAccountFingerprintValue(right?.dateOpened);
  if (leftOpened && rightOpened && leftOpened !== rightOpened) {
    return false;
  }

  const leftHighCredit = normalizeAccountFingerprintValue(left?.highCredit || left?.creditLimit);
  const rightHighCredit = normalizeAccountFingerprintValue(right?.highCredit || right?.creditLimit);
  if (leftHighCredit && rightHighCredit && leftHighCredit !== rightHighCredit) {
    return false;
  }

  return Boolean(leftOpened || leftHighCredit);
};

const dedupeOpenAccounts = (accounts = []) => {
  const unique = [];

  for (const account of accounts) {
    const existingIndex = unique.findIndex((entry) => areLikelyDuplicateOpenAccounts(entry, account));
    if (existingIndex === -1) {
      unique.push(account);
      continue;
    }

    const existing = unique[existingIndex];
    const existingScore = scoreOpenAccountQuality(existing);
    const incomingScore = scoreOpenAccountQuality(account);
    const primary = existingScore >= incomingScore ? existing : account;
    const secondary = primary === existing ? account : existing;
    unique[existingIndex] = mergeOpenAccountRecords(primary, secondary);
  }

  return unique;
};

const isChargeAccountTypeText = (value = '') => {
  const type = String(value || '').toLowerCase();
  return type.includes('charge account') || type.includes('charge card');
};

const isClosedOrPaidStatusText = (value = '') => {
  const status = String(value || '').toLowerCase();
  return /\bclosed\b|\bpaid\b/.test(status);
};

const isEligibleForBureauUtilization = (account, bureau) => {
  if (!account?.bureaus?.[bureau]) {
    return false;
  }

  // Account inclusion rule is based on account status at the account level.
  // Bureau-level status text can be noisy/misaligned in merged reports.
  if (isClosedOrPaidStatusText(account?.status)) {
    return false;
  }

  const typeForBureau = pickFirstNonEmpty(
    account?.accountTypeByBureau?.[bureau],
    account?.accountTypeDetailByBureau?.[bureau],
    account?.accountType,
    account?.accountTypeDetail,
  );
  if (isChargeAccountTypeText(typeForBureau)) {
    return false;
  }
  if (!isCreditCardType({ accountType: typeForBureau, accountTypeDetail: typeForBureau })) {
    return false;
  }

  return true;
};

const getSmartCreditReportRoot = (value) => {
  const parsed = parseJsonValue(value);
  if (!parsed) {
    return null;
  }

  const components = ensureArray(parsed?.BundleComponents?.BundleComponent);
  const mergedComponent = components.find((entry) => readJsonScalar(entry?.Type) === 'MergeCreditReports');
  const reportComponents = components.filter((entry) => entry?.TrueLinkCreditReportType);
  const creditReport = mergedComponent?.TrueLinkCreditReportType
    || reportComponents[0]?.TrueLinkCreditReportType
    || parsed?.TrueLinkCreditReportType
    || null;

  if (!creditReport) {
    return null;
  }

  return {
    parsed,
    components: reportComponents.length ? reportComponents : components,
    creditReport,
  };
};

const summarizeJsonPaymentHistory = (history, fallbackPayStatus = '') => {
  const summary = calculatePaymentHistorySummary(0, 0);
  const entries = ensureArray(history?.MonthlyPayStatus);

  const classifyToken = (rawToken) => {
    const token = String(rawToken || '').trim().toUpperCase();
    if (!token) {
      return null;
    }

    const normalized = token.replace(/[^A-Z0-9]/g, '');
    if (!normalized || ['?', 'B', 'NA', 'N/A', 'NR', 'ND', 'UNK', 'UNKNOWN', 'X', 'XX'].includes(normalized)) {
      return null;
    }

    if (
      ['C', 'OK', 'CUR', 'CURRENT', 'PAA', 'PAIDASAGREED', 'NEVERLATE', '0', 'U'].includes(normalized)
      || /^R0$|^I0$|^O0$/i.test(normalized)
    ) {
      return 'good';
    }

    if (/^(30|60|90|120|150|180)$/.test(normalized)) {
      return 'bad';
    }

    if (/^\d+$/.test(normalized)) {
      return Number.parseInt(normalized, 10) > 0 ? 'bad' : 'good';
    }

    if (/^(CO|COL|COLLECTION|CHARGEOFF|CHARGEDOFF|LATE|DELINQ|DELINQUENT|REPO|FORECLOSURE)/.test(normalized)) {
      return 'bad';
    }

    if (/^R[1-9]$|^I[1-9]$|^O[1-9]$/.test(normalized)) {
      return 'bad';
    }

    return null;
  };

  for (const entry of entries) {
    const result = classifyToken(pickFirstNonEmpty(entry?.status, entry?.['@status']));
    if (result === 'good') {
      summary.goodCount += 1;
    } else if (result === 'bad') {
      summary.badCount += 1;
    }
  }

  if (summary.goodCount === 0 && summary.badCount === 0) {
    const fallbackResult = classifyToken(fallbackPayStatus);
    if (fallbackResult === 'good') {
      summary.goodCount = 1;
    } else if (fallbackResult === 'bad') {
      summary.badCount = 1;
    }
  }

  return calculatePaymentHistorySummary(summary.goodCount, summary.badCount);
};

const buildSubscriberContactMaps = (subscribers) => {
  const byCode = new Map();
  const byName = new Map();
  const entries = [];

  const formatAddress = (creditAddressValue) => {
    const creditAddress = Array.isArray(creditAddressValue)
      ? (creditAddressValue.find((entry) => entry && typeof entry === 'object') || {})
      : (creditAddressValue || {});
    const street = pickFirstNonEmpty(
      readJsonAttribute(creditAddress, 'unparsedStreet'),
      [
        readJsonAttribute(creditAddress, 'houseNumber'),
        readJsonAttribute(creditAddress, 'direction'),
        readJsonAttribute(creditAddress, 'streetName'),
        readJsonAttribute(creditAddress, 'streetType'),
        readJsonAttribute(creditAddress, 'postDirection'),
        readJsonAttribute(creditAddress, 'unit'),
        readJsonAttribute(creditAddress, 'line1'),
        readJsonAttribute(creditAddress, 'line2'),
        readJsonAttribute(creditAddress, 'line3'),
      ]
        .filter(Boolean)
        .join(' '),
    ).replace(/\s+/g, ' ').trim();
    const cityStateZip = [
      readJsonAttribute(creditAddress, 'city'),
      readJsonAttribute(creditAddress, 'stateCode'),
      readJsonAttribute(creditAddress, 'postalCode'),
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    return [street, cityStateZip].filter(Boolean).join(', ');
  };

  for (const entry of ensureArray(subscribers)) {
    const code = String(readJsonAttribute(entry, 'subscriberCode') || '').trim();
    const name = String(readJsonAttribute(entry, 'name') || '').trim();
    const contact = {
      address: formatAddress(entry?.CreditAddress || entry?.creditAddress || {}),
      phone: String(pickFirstNonEmpty(
        readJsonAttribute(entry, 'telephone'),
        readJsonAttribute(entry, 'phone'),
        readJsonAttribute(entry?.Phone || {}, 'number'),
        readJsonAttribute(entry?.Telephone || {}, 'number'),
        readJsonAttribute(entry?.TelephoneNumber || {}, 'number'),
        readJsonScalar(entry?.Phone),
        readJsonScalar(entry?.Telephone),
        readJsonScalar(entry?.TelephoneNumber),
      ) || '').trim(),
    };

    if (code) {
      byCode.set(code, contact);
    }

    if (name) {
      byName.set(canonicalCreditorName(name), contact);
      entries.push({ name, canonical: canonicalCreditorName(name), contact, code });
    }
  }

  return { byCode, byName, entries };
};

const extractGenericSubscriberContacts = (input) => {
  const contacts = [];
  const seen = new Set();

  const pushContact = (entry = {}) => {
    if (!entry || typeof entry !== 'object') return;
    const name = String(pickFirstNonEmpty(
      readJsonAttribute(entry, 'name'),
      entry?.creditorName,
      entry?.['@creditorName'],
    ) || '').trim();
    const phone = String(pickFirstNonEmpty(
      readJsonAttribute(entry, 'telephone'),
      readJsonAttribute(entry, 'phone'),
      readJsonScalar(entry?.Phone),
      readJsonScalar(entry?.Telephone),
      readJsonScalar(entry?.TelephoneNumber),
    ) || '').trim();
    const address = String(pickFirstNonEmpty(
      readJsonAttribute(entry?.CreditAddress || {}, 'unparsedStreet'),
      readJsonAttribute(entry?.creditAddress || {}, 'unparsedStreet'),
      readJsonScalar(entry?.CreditAddress),
      readJsonScalar(entry?.creditAddress),
      readJsonScalar(entry?.address),
    ) || '').trim();
    if (!name || (!phone && !address)) return;
    const signature = `${canonicalCreditorName(name)}|${phone}|${address}`;
    if (seen.has(signature)) return;
    seen.add(signature);
    contacts.push({
      '@name': name,
      '@telephone': phone,
      CreditAddress: { '@unparsedStreet': address },
    });
  };

  const walk = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    pushContact(value);
    for (const nested of Object.values(value)) {
      walk(nested);
    }
  };

  walk(input);
  return contacts;
};

const enrichDerogatoryAccountsWithSubscriberContacts = (accounts = [], reportValue = null, htmlSource = '') => {
  if (!Array.isArray(accounts) || !accounts.length || !reportValue) {
    return Array.isArray(accounts) ? accounts : [];
  }

  const reportRoot = getSmartCreditReportRoot(reportValue);
  const parsedReport = parseJsonValue(reportValue);
  const smartCreditSubscribers = reportRoot
    ? [
      reportRoot.creditReport,
      ...reportRoot.components.map((entry) => entry?.TrueLinkCreditReportType).filter(Boolean),
    ].flatMap((creditReport) => ensureArray(creditReport?.Subscriber))
    : [];
  const genericSubscribers = parsedReport ? extractGenericSubscriberContacts(parsedReport) : [];
  const subscribers = [...smartCreditSubscribers, ...genericSubscribers];
  if (!subscribers.length) {
    return accounts;
  }
  const contactMaps = buildSubscriberContactMaps(subscribers);
  const htmlContacts = parseCreditorContacts(String(htmlSource || ''));

  const getBestContactByName = (nameValue) => {
    const name = String(nameValue || '').trim();
    if (!name) return null;
    const direct = contactMaps.byName.get(canonicalCreditorName(name));
    if (direct) return direct;

    let best = null;
    let bestScore = -1;
    for (const entry of contactMaps.entries) {
      const score = scoreCreditorContactMatch(name, entry.name);
      if (score > bestScore) {
        bestScore = score;
        best = entry.contact;
      }
    }
    return bestScore >= 180 ? best : null;
  };

  return accounts.map((account) => {
    const currentAddress = String(account?.creditorAddress || '').trim();
    const currentPhone = String(account?.creditorPhone || '').trim();
    if (currentAddress && currentPhone) {
      return account;
    }

    const codes = [];
    for (const bureau of ['transunion', 'experian', 'equifax']) {
      const raw = account?.bureaus?.[bureau]?.raw;
      const code = String(readJsonAttribute(raw, 'subscriberCode') || '').trim();
      if (code) codes.push(code);
    }
    const contactByCode = codes
      .map((code) => contactMaps.byCode.get(code))
      .find((entry) => entry && (entry.address || entry.phone)) || null;
    const contactByName = getBestContactByName(
      pickFirstNonEmpty(
        account?.creditorName,
        account?.raw?.acc_name,
        account?.raw?.name,
      ),
    );
    let contactFromHtml = null;
    if (htmlContacts.length) {
      let best = null;
      let bestScore = -1;
      const targetName = String(pickFirstNonEmpty(account?.creditorName, account?.raw?.acc_name, account?.raw?.name) || '').trim();
      for (const candidate of htmlContacts) {
        const score = scoreCreditorContactMatch(targetName, candidate?.name || '');
        if (score > bestScore) {
          bestScore = score;
          best = candidate;
        }
      }
      if (best && bestScore >= 180) {
        contactFromHtml = {
          address: String(best.address || '').trim(),
          phone: String(best.phone || '').trim(),
        };
      }
    }
    const contact = contactByCode || contactByName || contactFromHtml || null;
    if (!contact) {
      return account;
    }

    return {
      ...account,
      creditorAddress: currentAddress || String(contact.address || '').trim(),
      creditorPhone: currentPhone || String(contact.phone || '').trim(),
    };
  });
};

const parseCreditScoresFromJson = (value) => {
  const reportRoot = getSmartCreditReportRoot(value);
  const scores = {
    transunion: null,
    experian: null,
    equifax: null,
  };

  if (!reportRoot) {
    return {
      scores,
      foundAll: false,
    };
  }

  const assignScore = (entry, fallbackBureau = '') => {
    const bureau = bureauKeyFromValue(
      readJsonAttribute(entry?.Source?.Bureau, 'abbreviation')
      || readJsonAttribute(entry?.Source?.Bureau, 'description')
      || readJsonAttribute(entry?.Source?.Bureau, 'symbol')
      || fallbackBureau,
    );
    const riskScore = pickFirstNonEmpty(entry?.riskScore, entry?.['@riskScore']);

    if (bureau && riskScore) {
      scores[bureau] = String(riskScore);
    }
  };

  const creditReports = [
    reportRoot.creditReport,
    ...reportRoot.components.map((entry) => entry?.TrueLinkCreditReportType).filter(Boolean),
  ];

  creditReports.forEach((creditReport) => {
    const borrowerScores = ensureArray(creditReport?.Borrower?.CreditScore);
    borrowerScores.forEach((entry) => assignScore(entry));
  });

  reportRoot.components.forEach((component) => {
    if (component?.CreditScoreType) {
      assignScore(component.CreditScoreType, readJsonScalar(component?.Type));
    }
  });

  return {
    scores,
    foundAll: Object.values(scores).every(Boolean),
  };
};

const parseOpenAccountsFromJson = (value) => {
  const reportRoot = getSmartCreditReportRoot(value);
  if (!reportRoot) {
    return [];
  }

  const creditReports = [
    reportRoot.creditReport,
    ...reportRoot.components.map((entry) => entry?.TrueLinkCreditReportType).filter(Boolean),
  ];
  const subscribers = creditReports.flatMap((creditReport) => ensureArray(creditReport?.Subscriber));
  const partitions = creditReports.flatMap((creditReport) => ensureArray(creditReport?.TradeLinePartition));
  const { byCode: subscriberContactByCode, byName: subscriberContactByName } = buildSubscriberContactMaps(subscribers);
  const accounts = [];

  for (const partition of partitions) {
    const tradelines = ensureArray(partition?.Tradeline);
    if (tradelines.length === 0) {
      continue;
    }

    const firstTradeline = tradelines[0];
    const bureauTradelines = {
      transunion: null,
      experian: null,
      equifax: null,
    };

    for (const tradeline of tradelines) {
      const bureau = bureauKeyFromValue(
        readJsonAttribute(tradeline?.Source?.Bureau, 'abbreviation')
        || readJsonAttribute(tradeline?.Source?.Bureau, 'description')
        || readJsonAttribute(tradeline?.Source?.Bureau, 'symbol')
        || tradeline?.bureau,
      );
      if (bureau) {
        bureauTradelines[bureau] = tradeline;
      }
    }

    const bureauTradelineDetails = Object.values(bureauTradelines)
      .filter(Boolean)
      .map((tradeline) => ({
        status: pickFirstNonEmpty(
          readJsonDescriptor(tradeline?.OpenClosed),
          readJsonDescriptor(tradeline?.AccountCondition),
        ),
        accountRating: readJsonDescriptor(tradeline?.AccountCondition),
        paymentStatus: pickFirstNonEmpty(
          readJsonDescriptor(tradeline?.PayStatus),
          readJsonDescriptor(tradeline?.GrantedTrade?.WorstPayStatus),
        ),
        accountType: pickFirstNonEmpty(
          readJsonDescriptor(tradeline?.GrantedTrade?.CreditType),
          readJsonAttribute(partition, 'accountTypeDescription'),
        ),
        accountTypeDetail: readJsonDescriptor(tradeline?.GrantedTrade?.AccountType),
      }));

    const hasAllowedOpenTradeline = bureauTradelineDetails.some((entry) => !shouldExcludeOpenAccountCandidate(entry));

    if (!hasAllowedOpenTradeline) {
      continue;
    }

    const accountTypeByBureau = {};
    const accountTypeDetailByBureau = {};
    const statusByBureau = {};
    const balanceByBureau = {};
    const creditLimitByBureau = {};
    const highCreditByBureau = {};
    const highBalanceByBureau = {};
    const dateOpenedByBureau = {};
    const paymentHistoryByBureau = {};
    const bureauPresence = {};

    for (const bureau of ['transunion', 'experian', 'equifax']) {
      const tradeline = bureauTradelines[bureau];
      bureauPresence[bureau] = Boolean(tradeline);
      if (!tradeline) {
        accountTypeByBureau[bureau] = '';
        accountTypeDetailByBureau[bureau] = '';
        statusByBureau[bureau] = '';
        balanceByBureau[bureau] = '';
        creditLimitByBureau[bureau] = '';
        highCreditByBureau[bureau] = '';
        highBalanceByBureau[bureau] = '';
        dateOpenedByBureau[bureau] = '';
        paymentHistoryByBureau[bureau] = calculatePaymentHistorySummary(0, 0);
        continue;
      }

      accountTypeByBureau[bureau] = pickFirstNonEmpty(
        readJsonDescriptor(tradeline?.GrantedTrade?.CreditType),
        readJsonAttribute(partition, 'accountTypeDescription'),
      );
      accountTypeDetailByBureau[bureau] = readJsonDescriptor(tradeline?.GrantedTrade?.AccountType);
      statusByBureau[bureau] = pickFirstNonEmpty(
        readJsonDescriptor(tradeline?.OpenClosed),
        readJsonDescriptor(tradeline?.AccountCondition),
        readJsonDescriptor(tradeline?.PayStatus),
      );
      const currentBalance = pickFirstNonEmpty(tradeline?.currentBalance, tradeline?.['@currentBalance']);
      const creditLimit = readJsonScalar(tradeline?.GrantedTrade?.CreditLimit);
      const highBalance = pickFirstNonEmpty(tradeline?.highBalance, tradeline?.['@highBalance']);
      balanceByBureau[bureau] = currentBalance ? `$${currentBalance}` : '';
      creditLimitByBureau[bureau] = creditLimit ? `$${creditLimit}` : '';
      highCreditByBureau[bureau] = highBalance ? `$${highBalance}` : '';
      highBalanceByBureau[bureau] = highBalance ? `$${highBalance}` : '';
      dateOpenedByBureau[bureau] = formatDisplayDate(pickFirstNonEmpty(tradeline?.dateOpened, tradeline?.['@dateOpened']));
      paymentHistoryByBureau[bureau] = summarizeJsonPaymentHistory(
        tradeline?.GrantedTrade?.PayStatusHistory,
        readJsonDescriptor(tradeline?.PayStatus) || readJsonDescriptor(tradeline?.GrantedTrade?.WorstPayStatus) || '',
      );
    }

    const contactByCode = subscriberContactByCode.get(String(readJsonAttribute(firstTradeline, 'subscriberCode') || '').trim());
    const creditorName = String(pickFirstNonEmpty(firstTradeline?.creditorName, firstTradeline?.['@creditorName']) || '').trim();
    const contactByName = subscriberContactByName.get(canonicalCreditorName(creditorName));
    const creditorContact = contactByCode || contactByName || null;
    const combinedPaymentHistory = calculatePaymentHistorySummary(
      paymentHistoryByBureau.transunion.goodCount + paymentHistoryByBureau.experian.goodCount + paymentHistoryByBureau.equifax.goodCount,
      paymentHistoryByBureau.transunion.badCount + paymentHistoryByBureau.experian.badCount + paymentHistoryByBureau.equifax.badCount,
    );

    accounts.push({
      name: creditorName,
      status: pickFirstNonEmpty(
        readJsonDescriptor(firstTradeline?.OpenClosed),
        readJsonDescriptor(firstTradeline?.AccountCondition),
        readJsonDescriptor(firstTradeline?.PayStatus),
      ),
      accountType: pickFirstNonEmpty(...Object.values(accountTypeByBureau)),
      accountTypeDetail: pickFirstNonEmpty(...Object.values(accountTypeDetailByBureau)),
      accountTypeByBureau,
      accountTypeDetailByBureau,
      statusByBureau,
      balance: pickFirstNonEmpty(...Object.values(balanceByBureau)),
      creditLimit: pickFirstNonEmpty(...Object.values(creditLimitByBureau)),
      highCredit: pickFirstNonEmpty(...Object.values(highCreditByBureau)),
      highBalance: pickFirstNonEmpty(...Object.values(highBalanceByBureau)),
      highCreditByBureau,
      highBalanceByBureau,
      dateOpened: formatDisplayDate(pickFirstNonEmpty(firstTradeline?.dateOpened, firstTradeline?.['@dateOpened'])),
      dateLastActive: formatDisplayDate(pickFirstNonEmpty(firstTradeline?.dateAccountStatus, firstTradeline?.['@dateAccountStatus'], firstTradeline?.dateReported, firstTradeline?.['@dateReported'])),
      dateOfLastPayment: formatDisplayDate(pickFirstNonEmpty(firstTradeline?.GrantedTrade?.dateLastPayment, firstTradeline?.GrantedTrade?.['@dateLastPayment'])),
      monthlyPayment: pickFirstNonEmpty(firstTradeline?.GrantedTrade?.monthlyPayment, firstTradeline?.GrantedTrade?.['@monthlyPayment']) ? `$${pickFirstNonEmpty(firstTradeline?.GrantedTrade?.monthlyPayment, firstTradeline?.GrantedTrade?.['@monthlyPayment'])}` : '',
      dateOpenedByBureau,
      paymentHistoryByBureau,
      paymentHistorySummary: combinedPaymentHistory,
      accountNumber: String(pickFirstNonEmpty(firstTradeline?.accountNumber, firstTradeline?.['@accountNumber']) || '').trim(),
      creditorAddress: creditorContact?.address || '',
      creditorPhone: creditorContact?.phone || '',
      balanceByBureau,
      creditLimitByBureau,
      bureaus: bureauPresence,
    });
  }

  return dedupeOpenAccounts(accounts);
};

const escapeHtmlText = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const formatMoneyDisplay = (value) => {
  const amount = Number.parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(amount)) {
    return '';
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const getJsonValueType = (value) => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
};

const formatLeafJsonValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const flattenJsonLeaves = (value, path = '$', bucket = []) => {
  const valueType = getJsonValueType(value);
  if (valueType !== 'array' && valueType !== 'object') {
    bucket.push({
      path,
      type: valueType,
      value: formatLeafJsonValue(value),
    });
    return bucket;
  }

  if (Array.isArray(value)) {
    if (!value.length) {
      bucket.push({
        path,
        type: 'array',
        value: '[]',
      });
      return bucket;
    }
    value.forEach((entry, index) => {
      flattenJsonLeaves(entry, `${path}[${index}]`, bucket);
    });
    return bucket;
  }

  const entries = Object.entries(value || {});
  if (!entries.length) {
    bucket.push({
      path,
      type: 'object',
      value: '{}',
    });
    return bucket;
  }
  entries.forEach(([key, entryValue]) => {
    flattenJsonLeaves(entryValue, `${path}.${key}`, bucket);
  });
  return bucket;
};

const summarizeTopLevelJsonCategories = (parsedJson = {}) => {
  if (!parsedJson || typeof parsedJson !== 'object' || Array.isArray(parsedJson)) {
    return [];
  }
  return Object.entries(parsedJson).map(([key, value]) => {
    const type = getJsonValueType(value);
    let count = '';
    if (Array.isArray(value)) {
      count = `${value.length} items`;
    } else if (value && typeof value === 'object') {
      count = `${Object.keys(value).length} keys`;
    }
    const leaves = flattenJsonLeaves(value, `$.${key}`, []);
    return {
      key,
      type,
      count,
      leafCount: leaves.length,
      rawJson: value,
    };
  });
};

const buildCreditReportHtmlFromJson = (client) => {
  const parsed = parseJsonValue(client?.creditReportJson || '');
  if (!parsed) {
    return '';
  }

  const scoreResult = parseCreditScoresFromJson(parsed);
  const accounts = parseOpenAccountsFromJson(parsed);
  const topLevelCategories = summarizeTopLevelJsonCategories(parsed);
  const flattenedLeaves = flattenJsonLeaves(parsed);
  const reportDate = parseReportDateFromJson(parsed) || String(client?.reportDate || '').trim() || 'Unknown';
  const clientName = `${String(client?.firstName || '').trim()} ${String(client?.lastName || '').trim()}`.trim() || 'Client';
  const safeName = escapeHtmlText(clientName);
  const safeDate = escapeHtmlText(reportDate);
  const scoreCell = (label, value) => `
    <div class="score-card score-${label.toLowerCase()}">
      <small>${escapeHtmlText(label)}</small>
      <strong>${escapeHtmlText(value || '---')}</strong>
    </div>
  `;
  const bureauBadge = (present) => (present ? 'Yes' : '—');

  const accountRows = accounts.map((account, index) => {
    const rawBlock = escapeHtmlText(JSON.stringify(account, null, 2));
    const bureaus = account?.bureaus || {};
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtmlText(account?.name || '')}</td>
        <td>${escapeHtmlText(account?.accountNumber || '')}</td>
        <td>${escapeHtmlText(account?.status || '')}</td>
        <td>${escapeHtmlText(account?.accountType || '')}</td>
        <td>${escapeHtmlText(account?.accountTypeDetail || '')}</td>
        <td>${escapeHtmlText(account?.balance || formatMoneyDisplay(account?.balance) || '')}</td>
        <td>${escapeHtmlText(account?.creditLimit || formatMoneyDisplay(account?.creditLimit) || '')}</td>
        <td>${escapeHtmlText(account?.highBalance || formatMoneyDisplay(account?.highBalance) || '')}</td>
        <td>${escapeHtmlText(account?.monthlyPayment || formatMoneyDisplay(account?.monthlyPayment) || '')}</td>
        <td>${escapeHtmlText(account?.dateOpened || '')}</td>
        <td>${escapeHtmlText(account?.dateLastActive || '')}</td>
        <td>${escapeHtmlText(account?.dateOfLastPayment || '')}</td>
        <td>${escapeHtmlText(account?.creditorAddress || '')}</td>
        <td>${escapeHtmlText(account?.creditorPhone || '')}</td>
        <td>${bureauBadge(Boolean(bureaus.transunion))}</td>
        <td>${bureauBadge(Boolean(bureaus.experian))}</td>
        <td>${bureauBadge(Boolean(bureaus.equifax))}</td>
      </tr>
      <tr class="raw-row">
        <td colspan="18">
          <details>
            <summary>Raw account payload</summary>
            <pre>${rawBlock}</pre>
          </details>
        </td>
      </tr>
    `;
  }).join('');

  const categoryRows = topLevelCategories.map((entry, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtmlText(entry.key)}</td>
      <td>${escapeHtmlText(entry.type)}</td>
      <td>${escapeHtmlText(entry.count || '--')}</td>
      <td>${escapeHtmlText(String(entry.leafCount || 0))}</td>
    </tr>
    <tr class="raw-row">
      <td colspan="5">
        <details>
          <summary>Expand ${escapeHtmlText(entry.key)} raw JSON</summary>
          <pre>${escapeHtmlText(JSON.stringify(entry.rawJson, null, 2))}</pre>
        </details>
      </td>
    </tr>
  `).join('');

  const leafRows = flattenedLeaves.map((entry, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtmlText(entry.path || '')}</td>
      <td>${escapeHtmlText(entry.type || '')}</td>
      <td>${escapeHtmlText(entry.value || '')}</td>
    </tr>
  `).join('');

  const fullJson = escapeHtmlText(JSON.stringify(parsed, null, 2));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${safeName} • JSON Report</title>
  <style>
    body { font-family: Inter, Segoe UI, Arial, sans-serif; margin: 0; background: #eef3fb; color: #1e2b3d; }
    .wrap { max-width: 1900px; margin: 0 auto; padding: 1.2rem; }
    .hero { background: linear-gradient(135deg, #17315d, #2a4e8a); color: #fff; border-radius: 12px; padding: 1rem 1.2rem; }
    .hero h1 { margin: 0; font-size: 1.2rem; }
    .hero p { margin: 0.35rem 0 0; opacity: 0.9; font-size: 0.9rem; }
    .scores { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.65rem; margin-top: 0.95rem; }
    .score-card { border-radius: 10px; padding: 0.7rem 0.8rem; background: #fff; border: 1px solid #d4ddee; }
    .score-card small { text-transform: uppercase; letter-spacing: 0.08em; color: #5a6c89; display: block; }
    .score-card strong { display: block; margin-top: 0.2rem; font-size: 1.35rem; }
    .score-transunion strong { color: #0099cc; }
    .score-experian strong { color: #1d4f8d; }
    .score-equifax strong { color: #9b1f4b; }
    .section { margin-top: 1rem; background: #fff; border: 1px solid #d4ddee; border-radius: 12px; padding: 0.85rem; }
    .section h2 { margin: 0 0 0.5rem; font-size: 1rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.83rem; }
    th, td { border: 1px solid #e2e8f5; padding: 0.45rem 0.5rem; text-align: left; vertical-align: top; }
    th { background: #f4f7fd; position: sticky; top: 0; }
    .table-wrap { overflow: auto; max-height: 68vh; border: 1px solid #dbe4f4; border-radius: 10px; }
    .table-wrap-wide { overflow: auto; max-height: 70vh; border: 1px solid #dbe4f4; border-radius: 10px; }
    .table-wide { min-width: 1800px; }
    .table-leaf { min-width: 2200px; font-size: 0.8rem; }
    .section-note { margin: 0 0 0.6rem; color: #54657f; font-size: 0.82rem; }
    .raw-row td { background: #f9fbff; }
    details summary { cursor: pointer; color: #1b4d96; font-weight: 600; }
    pre { white-space: pre-wrap; word-break: break-word; margin: 0.45rem 0 0; background: #09142b; color: #adf6c5; padding: 0.65rem; border-radius: 8px; font-size: 0.75rem; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.79rem; }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <h1>${safeName} • Credit Report (JSON Rendered)</h1>
      <p>Report Date: ${safeDate}</p>
      <div class="scores">
        ${scoreCell('TransUnion', scoreResult?.scores?.transunion)}
        ${scoreCell('Experian', scoreResult?.scores?.experian)}
        ${scoreCell('Equifax', scoreResult?.scores?.equifax)}
      </div>
    </section>

    <section class="section">
      <h2>Open Accounts (${accounts.length})</h2>
      <p class="section-note">Primary parsed tradelines and account metrics discovered from the JSON report payload.</p>
      <div class="table-wrap">
        <table class="table-wide">
          <thead>
            <tr>
              <th>#</th><th>Creditor</th><th>Account #</th><th>Status</th><th>Account Type</th><th>Type Detail</th><th>Balance</th><th>Credit Limit</th><th>High Balance</th><th>Monthly Payment</th><th>Date Opened</th><th>Last Active</th><th>Last Payment</th><th>Address</th><th>Phone</th><th>TU</th><th>EX</th><th>EQ</th>
            </tr>
          </thead>
          <tbody>
            ${accountRows || '<tr><td colspan="18">No account rows were parsed from JSON.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>

    <section class="section">
      <h2>Top-Level JSON Categories (${topLevelCategories.length})</h2>
      <p class="section-note">Every top-level category discovered in report JSON, with type and leaf-field counts.</p>
      <div class="table-wrap-wide">
        <table class="table-wide">
          <thead>
            <tr>
              <th>#</th><th>Category</th><th>Type</th><th>Size</th><th>Leaf Fields</th>
            </tr>
          </thead>
          <tbody>
            ${categoryRows || '<tr><td colspan="5">No top-level JSON categories found.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>

    <section class="section">
      <h2>All Parsed JSON Fields (${flattenedLeaves.length})</h2>
      <p class="section-note">Complete flattened field map of the entire JSON payload. This includes nested arrays, objects, and all scalar values.</p>
      <div class="table-wrap-wide">
        <table class="table-leaf">
          <thead>
            <tr>
              <th>#</th><th>JSON Path</th><th>Type</th><th>Value</th>
            </tr>
          </thead>
          <tbody>
            ${leafRows || '<tr><td colspan="4">No parsed JSON fields found.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>

    <section class="section">
      <h2>Raw Report JSON</h2>
      <details>
        <summary>Expand full JSON payload</summary>
        <pre>${fullJson}</pre>
      </details>
    </section>
  </div>
</body>
</html>`;
};

const isDerogatoryTradelineCandidate = (details = {}) => {
  const status = String(details.status || '').toLowerCase();
  const accountRating = String(details.accountRating || '').toLowerCase();
  const paymentStatus = String(details.paymentStatus || '').toLowerCase();
  const accountType = String(details.accountType || '').toLowerCase();
  const accountTypeDetail = String(details.accountTypeDetail || '').toLowerCase();
  const combined = `${status} ${accountRating} ${paymentStatus} ${accountType} ${accountTypeDetail}`.replace(/\s+/g, ' ').trim();
  if (!combined) {
    return false;
  }
  return /derog|collection|charge.?off|coll\/chargeoff|repossession|foreclosure|late\s*30|late\s*60|late\s*90|late\s*120|delinq|past due|120 delinq|150|180/.test(combined);
};

const buildDerogatoryTradelineView = (tradeline, fallbackAccountTypeDescription = '', options = {}) => {
  const includeNonDerogatory = Boolean(options?.includeNonDerogatory);
  if (!tradeline) {
    return null;
  }
  const details = {
    status: pickFirstNonEmpty(
      readJsonDescriptor(tradeline?.OpenClosed),
      readJsonDescriptor(tradeline?.AccountCondition),
    ),
    accountRating: readJsonDescriptor(tradeline?.AccountCondition),
    paymentStatus: pickFirstNonEmpty(
      readJsonDescriptor(tradeline?.PayStatus),
      readJsonDescriptor(tradeline?.GrantedTrade?.WorstPayStatus),
    ),
    accountType: pickFirstNonEmpty(
      readJsonDescriptor(tradeline?.GrantedTrade?.CreditType),
      fallbackAccountTypeDescription,
    ),
    accountTypeDetail: readJsonDescriptor(tradeline?.GrantedTrade?.AccountType),
  };

  if (!includeNonDerogatory && !isDerogatoryTradelineCandidate(details)) {
    return null;
  }

  const balanceValue = pickFirstNonEmpty(tradeline?.currentBalance, tradeline?.['@currentBalance']);
  const creditLimitValue = readJsonScalar(tradeline?.GrantedTrade?.CreditLimit);
  const highBalanceValue = pickFirstNonEmpty(tradeline?.highBalance, tradeline?.['@highBalance']);

  return {
    ...details,
    accountNumber: String(pickFirstNonEmpty(tradeline?.accountNumber, tradeline?.['@accountNumber']) || '').trim(),
    creditorName: String(pickFirstNonEmpty(tradeline?.creditorName, tradeline?.['@creditorName']) || '').trim(),
    balance: balanceValue ? `$${balanceValue}` : '',
    creditLimit: creditLimitValue ? `$${creditLimitValue}` : '',
    highBalance: highBalanceValue ? `$${highBalanceValue}` : '',
    dateOpened: formatDisplayDate(pickFirstNonEmpty(tradeline?.dateOpened, tradeline?.['@dateOpened'])),
    dateLastActive: formatDisplayDate(pickFirstNonEmpty(
      tradeline?.dateAccountStatus,
      tradeline?.['@dateAccountStatus'],
      tradeline?.dateReported,
      tradeline?.['@dateReported'],
    )),
    dateOfLastPayment: formatDisplayDate(pickFirstNonEmpty(
      tradeline?.GrantedTrade?.dateLastPayment,
      tradeline?.GrantedTrade?.['@dateLastPayment'],
    )),
    raw: tradeline,
  };
};

const parseDerogatoryAccountsFromPartitions = (
  partitions = [],
  subscriberContactByCode = new Map(),
  subscriberContactByName = new Map(),
  options = {},
) => {
  const accounts = [];
  let rowId = 1;

  for (const partition of ensureArray(partitions)) {
    const tradelines = ensureArray(partition?.Tradeline);
    if (tradelines.length === 0) {
      continue;
    }

    const bureauTradelines = {
      transunion: null,
      experian: null,
      equifax: null,
    };

    for (const tradeline of tradelines) {
      const bureau = bureauKeyFromValue(
        readJsonAttribute(tradeline?.Source?.Bureau, 'abbreviation')
        || readJsonAttribute(tradeline?.Source?.Bureau, 'description')
        || readJsonAttribute(tradeline?.Source?.Bureau, 'symbol')
        || tradeline?.bureau,
      );
      if (bureau) {
        bureauTradelines[bureau] = tradeline;
      }
    }

    const fallbackType = String(readJsonAttribute(partition, 'accountTypeDescription') || '').trim();
    const tuView = buildDerogatoryTradelineView(bureauTradelines.transunion, fallbackType, options);
    const exView = buildDerogatoryTradelineView(bureauTradelines.experian, fallbackType, options);
    const eqView = buildDerogatoryTradelineView(bureauTradelines.equifax, fallbackType, options);
    if (!tuView && !exView && !eqView) {
      continue;
    }

    const firstTradeline = tradelines[0] || {};
    const creditorName = pickFirstNonEmpty(
      tuView?.creditorName,
      exView?.creditorName,
      eqView?.creditorName,
      firstTradeline?.creditorName,
      firstTradeline?.['@creditorName'],
    );
    const accountNumber = pickFirstNonEmpty(
      tuView?.accountNumber,
      exView?.accountNumber,
      eqView?.accountNumber,
      firstTradeline?.accountNumber,
      firstTradeline?.['@accountNumber'],
    );
    const accountType = pickFirstNonEmpty(
      tuView?.accountType,
      exView?.accountType,
      eqView?.accountType,
      fallbackType,
    );
    const subscriberCode = String(pickFirstNonEmpty(
      readJsonAttribute(firstTradeline, 'subscriberCode'),
      readJsonAttribute(bureauTradelines.transunion, 'subscriberCode'),
      readJsonAttribute(bureauTradelines.experian, 'subscriberCode'),
      readJsonAttribute(bureauTradelines.equifax, 'subscriberCode'),
    ) || '').trim();
    const contactByCode = subscriberCode ? subscriberContactByCode.get(subscriberCode) : null;
    const contactByName = subscriberContactByName.get(canonicalCreditorName(String(creditorName || '').trim()));
    const creditorContact = contactByCode || contactByName || null;

    accounts.push({
      id: `derog-${rowId++}`,
      creditorName: String(creditorName || '').trim(),
      accountNumber: String(accountNumber || '').trim(),
      accountType: String(accountType || '').trim(),
      creditorAddress: String(creditorContact?.address || '').trim(),
      creditorPhone: String(creditorContact?.phone || '').trim(),
      bureaus: {
        transunion: tuView,
        experian: exView,
        equifax: eqView,
      },
      raw: {
        partition,
        tradelines,
        bureaus: bureauTradelines,
      },
    });
  }

  return accounts;
};

const parseDerogatoryAccountsFromJson = (value) => {
  const reportRoot = getSmartCreditReportRoot(value);
  if (!reportRoot) {
    return [];
  }

  const creditReports = [
    reportRoot.creditReport,
    ...reportRoot.components.map((entry) => entry?.TrueLinkCreditReportType).filter(Boolean),
  ];
  const subscribers = creditReports.flatMap((creditReport) => ensureArray(creditReport?.Subscriber));
  const { byCode: subscriberContactByCode, byName: subscriberContactByName } = buildSubscriberContactMaps(subscribers);
  const partitions = creditReports.flatMap((creditReport) => ensureArray(creditReport?.TradeLinePartition));
  return parseDerogatoryAccountsFromPartitions(partitions, subscriberContactByCode, subscriberContactByName);
};

const parseAllTradelineAccountsFromJson = (value) => {
  const reportRoot = getSmartCreditReportRoot(value);
  if (!reportRoot) {
    return [];
  }
  const creditReports = [
    reportRoot.creditReport,
    ...reportRoot.components.map((entry) => entry?.TrueLinkCreditReportType).filter(Boolean),
  ];
  const subscribers = creditReports.flatMap((creditReport) => ensureArray(creditReport?.Subscriber));
  const { byCode: subscriberContactByCode, byName: subscriberContactByName } = buildSubscriberContactMaps(subscribers);
  const partitions = creditReports.flatMap((creditReport) => ensureArray(creditReport?.TradeLinePartition));
  return parseDerogatoryAccountsFromPartitions(
    partitions,
    subscriberContactByCode,
    subscriberContactByName,
    { includeNonDerogatory: true },
  );
};

const parseDerogatoryAccountsFromNinjaDisputeRows = (rows = []) => {
  const accounts = [];
  let rowId = 1;

  const toBureauView = (entry) => {
    if (!entry || typeof entry !== 'object') {
      return null;
    }
    const status = pickFirstNonEmpty(
      entry?.status,
      entry?.AccountCondition?.description,
      entry?.AccountCondition?.['@description'],
      entry?.classifycations?.dataButton?.paymentStatus,
    );
    const paymentStatus = pickFirstNonEmpty(
      entry?.paymentStatus,
      entry?.PayStatus?.description,
      entry?.PayStatus?.['@description'],
      entry?.classifycations?.dataButton?.paymentStatus,
    );
    const accountType = pickFirstNonEmpty(
      entry?.accountType,
      entry?.classifycations?.dataButton?.accountType,
    );
    const accountTypeDetail = pickFirstNonEmpty(
      entry?.accountTypeDetail,
      entry?.classifycations?.dataButton?.accountTypeDetail,
    );
    const accountRating = pickFirstNonEmpty(
      entry?.accountRating,
      entry?.AccountCondition?.description,
      entry?.AccountCondition?.['@description'],
    );
    const details = {
      status,
      paymentStatus,
      accountType,
      accountTypeDetail,
      accountRating,
    };
    if (!isDerogatoryTradelineCandidate(details)) {
      return null;
    }
    return {
      ...details,
      balance: entry?.balance || '',
      creditLimit: entry?.creditLimit || '',
      highBalance: entry?.highBalance || '',
      dateOpened: entry?.dateOpened || '',
      dateLastActive: entry?.dateLastActive || '',
      dateOfLastPayment: entry?.dateOfLastPayment || '',
      monthlyPayment: entry?.monthlyPayment || '',
      raw: entry,
    };
  };

  for (const row of ensureArray(rows)) {
    const tuView = toBureauView(row?.transunion);
    const exView = toBureauView(row?.experian);
    const eqView = toBureauView(row?.equifax);
    if (!tuView && !exView && !eqView) {
      continue;
    }
    accounts.push({
      id: `derog-${rowId++}`,
      creditorName: String(row?.acc_name || row?.name || '').trim(),
      accountNumber: String(row?.acc_num || row?.accountNumber || '').trim(),
      accountType: String(row?.type || '').trim(),
      bureaus: {
        transunion: tuView,
        experian: exView,
        equifax: eqView,
      },
      raw: row,
    });
  }

  return accounts;
};

const normalizeAccountNumberForMatch = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const mergeDerogatoryBureauView = (primary = null, fallback = null) => {
  if (!primary && !fallback) {
    return null;
  }
  if (!primary) {
    return fallback;
  }
  if (!fallback) {
    return primary;
  }
  return {
    ...fallback,
    ...primary,
    raw: primary.raw || fallback.raw || null,
  };
};

const mergeDerogatoryAccounts = (primaryAccounts = [], fallbackAccounts = []) => {
  if (!Array.isArray(primaryAccounts) || primaryAccounts.length === 0) {
    return Array.isArray(fallbackAccounts) ? fallbackAccounts : [];
  }
  if (!Array.isArray(fallbackAccounts) || fallbackAccounts.length === 0) {
    return primaryAccounts;
  }

  const fallbackPool = [...fallbackAccounts];
  const usedFallbackIds = new Set();

  const scoreMatch = (primary, fallback) => {
    let score = 0;
    const primaryNumber = normalizeAccountNumberForMatch(primary?.accountNumber);
    const fallbackNumber = normalizeAccountNumberForMatch(fallback?.accountNumber);
    if (primaryNumber && fallbackNumber) {
      if (primaryNumber === fallbackNumber) score += 100;
      else if (primaryNumber.endsWith(fallbackNumber) || fallbackNumber.endsWith(primaryNumber)) score += 70;
      else {
        const p4 = primaryNumber.slice(-4);
        const f4 = fallbackNumber.slice(-4);
        if (p4 && f4 && p4 === f4) score += 40;
      }
    }
    const primaryName = canonicalCreditorName(String(primary?.creditorName || ''));
    const fallbackName = canonicalCreditorName(String(fallback?.creditorName || ''));
    if (primaryName && fallbackName) {
      if (primaryName === fallbackName) score += 40;
      else if (primaryName.includes(fallbackName) || fallbackName.includes(primaryName)) score += 20;
    }
    return score;
  };

  const merged = primaryAccounts.map((primary) => {
    let best = null;
    let bestScore = -1;
    for (const fallback of fallbackPool) {
      const fallbackId = String(fallback?.id || '');
      if (fallbackId && usedFallbackIds.has(fallbackId)) continue;
      const score = scoreMatch(primary, fallback);
      if (score > bestScore) {
        bestScore = score;
        best = fallback;
      }
    }
    if (!best || bestScore < 40) {
      return primary;
    }

    const bestId = String(best?.id || '');
    if (bestId) {
      usedFallbackIds.add(bestId);
    }

    return {
      ...best,
      ...primary,
      creditorAddress: String(primary?.creditorAddress || best?.creditorAddress || '').trim(),
      creditorPhone: String(primary?.creditorPhone || best?.creditorPhone || '').trim(),
      bureaus: {
        transunion: mergeDerogatoryBureauView(primary?.bureaus?.transunion, best?.bureaus?.transunion),
        experian: mergeDerogatoryBureauView(primary?.bureaus?.experian, best?.bureaus?.experian),
        equifax: mergeDerogatoryBureauView(primary?.bureaus?.equifax, best?.bureaus?.equifax),
      },
    };
  });

  return merged;
};

const parseIntegerValue = (value) => {
  const numeric = Number.parseInt(String(value ?? '').replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(numeric) ? numeric : 0;
};

const parseBureauHardInquiriesFromHtml = () => ({
  transunion: 0,
  experian: 0,
  equifax: 0,
});

const parseBureauHardInquiriesFromJson = (value) => {
  const reportRoot = getSmartCreditReportRoot(value);
  if (!reportRoot) {
    return parseBureauHardInquiriesFromHtml();
  }

  const inquirySummary = reportRoot.creditReport?.Summary?.InquirySummary;
  const fromSummary = {
    transunion: parseIntegerValue(inquirySummary?.TransUnion?.NumberInLast2Years),
    experian: parseIntegerValue(inquirySummary?.Experian?.NumberInLast2Years),
    equifax: parseIntegerValue(inquirySummary?.Equifax?.NumberInLast2Years),
  };

  if (Object.values(fromSummary).some((count) => count > 0)) {
    return fromSummary;
  }

  const counts = {
    transunion: 0,
    experian: 0,
    equifax: 0,
  };

  const partitions = ensureArray(reportRoot.creditReport?.InquiryPartition);
  for (const partition of partitions) {
    const inquiry = partition?.Inquiry || partition;
    const entries = ensureArray(inquiry);
    for (const entry of entries) {
      const bureau = bureauKeyFromValue(
        entry?.Source?.Bureau?.abbreviation
        || entry?.Source?.Bureau?.description
        || entry?.Source?.Bureau?.symbol
        || entry?.bureau,
      );
      if (bureau) {
        counts[bureau] += 1;
      }
    }
  }

  return counts;
};

const findJsonValueByKey = (input, keyPattern) => {
  const visit = (value) => {
    if (!value || typeof value !== 'object') {
      return '';
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const nested = visit(item);
        if (nested) {
          return nested;
        }
      }
      return '';
    }

    for (const [key, entry] of Object.entries(value)) {
      if (keyPattern.test(key)) {
        const token = extractDateToken(typeof entry === 'string' ? entry : JSON.stringify(entry));
        if (token) {
          return token;
        }
      }

      const nested = visit(entry);
      if (nested) {
        return nested;
      }
    }

    return '';
  };

  return visit(input);
};

const parseReportDateFromJson = (value) => {
  const parsed = parseJsonValue(value);
  if (!parsed) {
    return '';
  }

  return findJsonValueByKey(parsed, /credit.*report.*date|report.*date/i);
};

const formatReportFileName = (reportDate, source = 'report') => {
  const normalized = extractDateToken(reportDate).replaceAll('/', '-');
  return `${source}-${normalized || Date.now()}.html`;
};

const parseScoreTable = (html) => {
  const match = html.match(/Credit Score:[\s\S]{0,800}?<td[^>]*class="info[^"]*"[^>]*>\s*([3-8]\d{2})\s*<\/td>[\s\S]{0,300}?<td[^>]*class="info[^"]*"[^>]*>\s*([3-8]\d{2})\s*<\/td>[\s\S]{0,300}?<td[^>]*class="info[^"]*"[^>]*>\s*([3-8]\d{2})\s*<\/td>/i);
  if (!match) {
    return null;
  }

  return {
    transunion: match[1],
    experian: match[2],
    equifax: match[3],
  };
};

const extractScoreNearLabel = (text, label) => {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`${escaped}[\\s\\S]{0,80}?(?:score|fico)?[\\s:#-]{0,10}(\\b[3-8]\\d{2}\\b)`, 'i'),
    new RegExp(`(\\b[3-8]\\d{2}\\b)[\\s\\S]{0,40}?${escaped}`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
};

const parseCreditScores = (html) => {
  const fromTable = parseScoreTable(html);
  if (fromTable) {
    return {
      scores: fromTable,
      foundAll: true,
    };
  }

  const text = stripHtml(html);
  const scores = {
    transunion: extractScoreNearLabel(text, 'TransUnion') ?? extractScoreNearLabel(text, 'Trans Union'),
    experian: extractScoreNearLabel(text, 'Experian'),
    equifax: extractScoreNearLabel(text, 'Equifax'),
  };

  return {
    scores,
    foundAll: Object.values(scores).every(Boolean),
  };
};

const parseReportDateFromHtml = (html) => {
  const creditReportRow = html.match(/<tr[^>]*>[\s\S]*?<td class="label">\s*Credit Report Date:\s*<\/td>([\s\S]*?)<\/tr>/i);
  if (creditReportRow?.[1]) {
    const rowDate = creditReportRow[1].match(/(\d{2}\/\d{2}\/\d{4})/);
    if (rowDate?.[1]) {
      return rowDate[1];
    }
  }

  const patterns = [
    /Report Date:\s*<\/h3>[\s\S]{0,500}?(\d{2}\/\d{2}\/\d{4})/i,
    /Credit Report Date:\s*<\/td>[\s\S]{0,2500}?(\d{2}\/\d{2}\/\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return '';
};

const parseReportDateFromFilename = (filename) => {
  const match = String(filename || '').match(/(\d{1,2})[-_](\d{1,2})[-_](\d{4})/);
  if (!match) {
    return '';
  }

  const month = match[1].padStart(2, '0');
  const day = match[2].padStart(2, '0');
  return `${month}/${day}/${match[3]}`;
};

const extractFirstBoundValue = (block, label) => {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escaped}:\\s*<\\/td>[\\s\\S]*?<td class="info[^"]*"[^>]*>[\\s\\S]*?(?:class="ng-binding[^"]*"[^>]*>\\s*([^<]+?)\\s*<|<ng[^>]*>\\s*([^<]+?)\\s*<)`, 'i');
  const match = block.match(pattern);
  return match?.[1]?.trim() || match?.[2]?.trim() || '';
};

const extractRenderedCellValue = (block, label) => {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rowPattern = new RegExp(`${escaped}:\\s*<\\/td>[\\s\\S]*?<td class="info[^"]*"[^>]*>([\\s\\S]*?)<\\/td>`, 'i');
  const rowMatch = block.match(rowPattern);
  if (!rowMatch?.[1]) {
    return '';
  }

  const text = rowMatch[1]
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/{{[\s\S]*?}}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text || text === '-') {
    return '';
  }

  return text;
};

const extractRowCellValues = (block, label, options = {}) => {
  const { requireDigits = true } = options;
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rowPattern = new RegExp(`<tr[^>]*>[\\s\\S]*?<td class="label">\\s*${escaped}:\\s*<\\/td>([\\s\\S]*?)<\\/tr>`, 'gi');

  const clean = (value) => {
    if (!value) {
      return '';
    }

    const text = value
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/{{[\s\S]*?}}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return text === '-' ? '' : text;
  };

  const cellPattern = /<td class="info[^"]*"[^>]*>([\s\S]*?)<\/td>/gi;
  const matches = [...block.matchAll(rowPattern)];
  let best = {
    transunion: '',
    experian: '',
    equifax: '',
  };
  let bestScore = -1;

  for (const match of matches) {
    const cells = [...(match?.[1] || '').matchAll(cellPattern)];
    const candidate = {
      transunion: clean(cells[0]?.[1]),
      experian: clean(cells[1]?.[1]),
      equifax: clean(cells[2]?.[1]),
    };

    const score = Object.values(candidate).filter(Boolean).length;
    const hasRequiredContent = requireDigits
      ? Object.values(candidate).some((value) => /[$0-9]/.test(value))
      : Object.values(candidate).some(Boolean);

    if (hasRequiredContent && score >= bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
};

const pickFirstBureauValue = (values) => (
  values.transunion || values.experian || values.equifax || ''
);

const parseMoneyValue = (value) => {
  if (!value) {
    return 0;
  }

  const numeric = Number.parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
};

const parseDateValue = (value) => {
  if (!value) {
    return null;
  }

  const text = String(value).trim();
  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = Number.parseInt(slashMatch[1], 10) - 1;
    const day = Number.parseInt(slashMatch[2], 10);
    const year = Number.parseInt(slashMatch[3], 10);
    const date = new Date(year, month, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const year = Number.parseInt(isoMatch[1], 10);
    const month = Number.parseInt(isoMatch[2], 10) - 1;
    const day = Number.parseInt(isoMatch[3], 10);
    const date = new Date(year, month, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const fallbackDate = new Date(text);
  if (!Number.isNaN(fallbackDate.getTime())) {
    return fallbackDate;
  }

  return null;
};

const toIsoDateOnly = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return local.toISOString().slice(0, 10);
};

const normalizeDateOnlyValue = (value) => toIsoDateOnly(parseDateValue(value));

const normalizeIsoDateTimeValue = (value, fallback = '') => {
  const raw = String(value || '').trim();
  if (!raw) {
    return fallback;
  }
  const asDate = new Date(raw);
  if (Number.isNaN(asDate.getTime())) {
    return fallback;
  }
  return asDate.toISOString();
};

const calculateNextImport = (reportDateValue) => {
  const reportDate = parseDateValue(reportDateValue);
  if (!reportDate) {
    return {
      reportDate: '',
      nextImportDate: null,
      reportAgeDays: null,
      daysUntilNextImport: null,
    };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const reportDay = new Date(reportDate.getTime());
  reportDay.setHours(0, 0, 0, 0);
  const reportTimestamp = reportDate.getTime();
  const nextImportTimestamp = reportTimestamp + (35 * 24 * 60 * 60 * 1000);
  const msPerDay = 24 * 60 * 60 * 1000;
  const reportAgeDays = Math.max(0, Math.floor((now.getTime() - reportDay.getTime()) / msPerDay));
  const daysUntilNextImport = 35 - reportAgeDays;

  return {
    reportDate: toIsoDateOnly(reportDate),
    nextImportDate: new Date(nextImportTimestamp).toISOString(),
    reportAgeDays,
    daysUntilNextImport,
  };
};

const formatNextImportFromDays = (days) => ({
  daysUntilNextImport: days,
  label: `${days} day${Math.abs(days) === 1 ? '' : 's'}`,
});

const calculateManualNextImport = (client) => {
  const startDays = Number.parseInt(String(client.manualNextImportStartDays ?? client.nextImportInt ?? ''), 10);
  if (!Number.isFinite(startDays)) {
    return null;
  }
  const anchorDate = parseDateValue(client.manualNextImportSetDate) || new Date();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const anchor = new Date(anchorDate.getTime());
  anchor.setHours(0, 0, 0, 0);
  const elapsed = Math.max(0, Math.floor((now.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000)));
  const days = startDays - elapsed;
  return {
    reportDate: toIsoDateOnly(anchor),
    nextImportDate: null,
    reportAgeDays: elapsed,
    ...formatNextImportFromDays(days),
  };
};

const calculateRefreshNextImport = (client) => {
  const startDateText = client.refreshNextImportStartDate || client.reportDate || getTodayIsoDate();
  const startDate = parseDateValue(startDateText) || parseDateValue(getTodayIsoDate());
  if (!startDate) {
    return null;
  }
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const anchor = new Date(startDate.getTime());
  anchor.setHours(0, 0, 0, 0);
  const elapsed = Math.max(0, Math.floor((now.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000)));
  const days = 35 - elapsed;
  const nextImportDate = new Date(anchor.getTime());
  nextImportDate.setDate(nextImportDate.getDate() + 35);
  return {
    reportDate: toIsoDateOnly(startDate),
    nextImportDate: nextImportDate.toISOString(),
    reportAgeDays: elapsed,
    ...formatNextImportFromDays(days),
  };
};

const calculateNextImportForClient = (client) => {
  const mode = String(client.nextImportMode || 'manual').toLowerCase();
  if (mode === 'refresh-success') {
    return calculateRefreshNextImport(client) || {
      reportDate: '',
      nextImportDate: null,
      reportAgeDays: null,
      daysUntilNextImport: null,
      label: '',
    };
  }
  return calculateManualNextImport(client) || {
    reportDate: '',
    nextImportDate: null,
    reportAgeDays: null,
    daysUntilNextImport: null,
    label: '',
  };
};

const parseImportedNextImport = (value) => {
  const text = String(value ?? '').trim();
  if (!text) {
    return null;
  }

  const numeric = Number.parseInt(text, 10);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return numeric;
};

const inferMonitoringAgency = (client) => {
  const explicit = String(client.monitoringAgency || '').trim();
  if (explicit) {
    return explicit;
  }

  const source = String(client.creditReportSource || '').toLowerCase();
  if (source.includes('identity')) {
    return 'IdentityIQ';
  }
  if (source.includes('smart')) {
    return 'SmartCredit';
  }
  if (source.includes('myfree') || source.includes('mfsn')) {
    return 'MyFreeScoreNow';
  }

  return '';
};

const formatNextImportValue = (value) => {
  const text = String(value ?? '').trim();
  if (!text) {
    return {
      nextImportInt: '',
      nextImportLabel: '',
    };
  }

  const numeric = Number.parseInt(text, 10);
  if (!Number.isFinite(numeric)) {
    return {
      nextImportInt: text,
      nextImportLabel: text,
    };
  }

  return {
    nextImportInt: String(numeric),
    nextImportLabel: `${numeric} day${Math.abs(numeric) === 1 ? '' : 's'}`,
  };
};

const isCreditCardType = (account) => {
  const type = `${account.accountTypeDetail || ''} ${account.accountType || ''}`.trim().toLowerCase();
  const creditCardTypes = [
    'secured credit card',
    'credit line secured',
    'credit card',
    'charge account',
    'check credit/line of credit',
    'line of credit',
    'flexible spending credit card',
  ];

  return creditCardTypes.some((value) => type.includes(value))
    || type.includes('revolving')
    || type.includes('open-ended')
    || type.includes('open ended');
};

const isMortgageType = (account) => {
  const type = `${account.accountTypeDetail || ''} ${account.accountType || ''}`.trim().toLowerCase();
  return type.includes('mortgage');
};

const isInstallmentType = (account) => {
  const type = `${account.accountTypeDetail || ''} ${account.accountType || ''}`.trim().toLowerCase();
  return type.includes('installment') || type.includes('secured loan');
};

const countsTowardTotalDebt = (account) => {
  const type = `${account.accountTypeDetail || ''} ${account.accountType || ''}`.trim().toLowerCase();
  return isCreditCardType(account)
    || isInstallmentType(account)
    || type.includes('revolving')
    || type.includes('open-ended')
    || type.includes('open ended')
    || type.includes('charge account');
};

const calculatePaymentHistorySummary = (goodCount, badCount) => {
  const totalCount = goodCount + badCount;
  return {
    goodCount,
    badCount,
    totalCount,
    onTimePercent: totalCount > 0 ? (goodCount / totalCount) * 100 : null,
  };
};

const parsePaymentHistoryRow = (block, bureauLabel) => {
  const escaped = bureauLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rowPattern = new RegExp(`<tr[^>]*>[\\s\\S]*?<td[^>]*>\\s*${escaped}\\s*<\\/td>([\\s\\S]*?)<\\/tr>`, 'i');
  const rowMatch = block.match(rowPattern);

  if (!rowMatch?.[1]) {
    return calculatePaymentHistorySummary(0, 0);
  }

  const cellPattern = /<td([^>]*)>([\s\S]*?)<\/td>/gi;
  let goodCount = 0;
  let badCount = 0;

  const classifyToken = (rawToken) => {
    const token = String(rawToken || '').trim().toUpperCase();
    if (!token) {
      return null;
    }

    const normalized = token.replace(/[^A-Z0-9]/g, '');
    if (!normalized || ['?', 'B', 'NA', 'N/A', 'NR', 'ND', 'UNK', 'UNKNOWN', 'X', 'XX'].includes(normalized)) {
      return null;
    }

    if (
      ['OK', 'C', 'CUR', 'CURRENT', 'PAA', 'PAIDASAGREED', 'NEVERLATE', '0', 'U'].includes(normalized)
      || /^R0$|^I0$|^O0$/i.test(normalized)
    ) {
      return 'good';
    }

    if (/^(30|60|90|120|150|180)$/.test(normalized)) {
      return 'bad';
    }

    if (/^\d+$/.test(normalized)) {
      return Number.parseInt(normalized, 10) > 0 ? 'bad' : 'good';
    }

    if (/^(CO|COL|COLLECTION|CHARGEOFF|CHARGEDOFF|LATE|DELINQ|DELINQUENT|REPO|FORECLOSURE)/.test(normalized)) {
      return 'bad';
    }

    if (/^R[1-9]$|^I[1-9]$|^O[1-9]$/.test(normalized)) {
      return 'bad';
    }

    return null;
  };

  for (const match of rowMatch[1].matchAll(cellPattern)) {
    const attrText = match[1] || '';
    const className = (attrText.match(/class\s*=\s*"([^"]*)"/i)?.[1]
      || attrText.match(/class\s*=\s*'([^']*)'/i)?.[1]
      || '').toLowerCase();
    const textValue = stripHtml(match[2] || '').toLowerCase();
    const classToken = className.match(/\bhstry-([a-z0-9-]+)/i)?.[1] || '';
    const token = classToken || textValue;
    const result = classifyToken(token);
    if (result === null) {
      continue;
    }

    if (result === 'good') {
      goodCount += 1;
      continue;
    }

    badCount += 1;
  }

  return calculatePaymentHistorySummary(goodCount, badCount);
};

const parsePaymentHistoryByBureau = (block) => ({
  transunion: parsePaymentHistoryRow(block, 'TransUnion'),
  experian: parsePaymentHistoryRow(block, 'Experian'),
  equifax: parsePaymentHistoryRow(block, 'Equifax'),
});

const normalizeCreditorName = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '');

const creditorAliasMap = new Map([
  ['amex', 'americanexpress'],
  ['americanexpress', 'americanexpress'],
  ['americanexpresscompany', 'americanexpress'],
  ['americanexp', 'americanexpress'],
]);

const canonicalCreditorName = (value) => {
  const normalized = normalizeCreditorName(value);
  if (!normalized) return '';
  return creditorAliasMap.get(normalized) || normalized;
};

const tokenizeCreditorName = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .split(/\s+/)
  .filter((token) => token.length > 1);

const scoreCreditorContactMatch = (accountName, creditorName) => {
  const normalizedAccount = canonicalCreditorName(accountName);
  const normalizedCreditor = canonicalCreditorName(creditorName);
  if (!normalizedAccount || !normalizedCreditor) {
    return -1;
  }

  if (normalizedAccount === normalizedCreditor) {
    return 10_000;
  }

  let score = 0;
  if (normalizedAccount.includes(normalizedCreditor) || normalizedCreditor.includes(normalizedAccount)) {
    score += 3_000 - Math.abs(normalizedAccount.length - normalizedCreditor.length);
  }

  const accountTokens = tokenizeCreditorName(accountName);
  const creditorTokens = new Set(tokenizeCreditorName(creditorName));
  const overlapCount = accountTokens.filter((token) => creditorTokens.has(token)).length;
  score += overlapCount * 180;

  if (accountTokens[0] && creditorTokens.has(accountTokens[0])) {
    score += 250;
  }

  if (normalizedAccount.slice(0, 8) === normalizedCreditor.slice(0, 8)) {
    score += 320;
  }

  return score;
};

const parseCreditorContacts = (html) => {
  const sectionMatch = html.match(/<div class="re-even-odd rpt_content_wrapper" id="CreditorContacts">[\s\S]*?<table class="rpt_content_table rpt_content_header rpt_content_contacts[^"]*"[\s\S]*?<tbody>([\s\S]*?)<\/tbody><\/table>/i);
  const fallbackSectionMatch = html.match(/Creditors?\s*Address(?:\(es\))?[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i);
  const sectionBody = sectionMatch?.[1] || fallbackSectionMatch?.[1] || '';
  if (!sectionBody) return [];

  const rowPattern = /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
  const contacts = [];

  for (const match of sectionBody.matchAll(rowPattern)) {
    const name = stripHtml(match[1] || '');
    const address = stripHtml(match[2] || '');
    const phone = stripHtml(match[3] || '').replace(/^-$/, '').trim();
    const normalizedName = normalizeCreditorName(name);
    if (!name || normalizedName === 'creditor' || normalizedName === 'name') {
      continue;
    }

    contacts.push({
      name,
      address,
      phone,
    });
  }

  return contacts;
};

const findCreditorContactForAccount = (contacts, accountName) => {
  let bestContact = null;
  let bestScore = 0;

  for (const contact of contacts) {
    const score = scoreCreditorContactMatch(accountName, contact.name);
    if (score > bestScore) {
      bestScore = score;
      bestContact = contact;
    }
  }

  return bestScore >= 320 ? bestContact : null;
};

const parseOpenAccounts = (html) => {
  let parts = html.split(/<div[^>]*class=["'][^"']*sub[_-]?header[^"']*["'][^>]*>/i).slice(1);
  if (parts.length <= 1) {
    const blocks = [];
    const headerPattern = /<div[^>]*class=["'][^"']*sub[_-]?header[^"']*["'][^>]*>/gi;
    const matches = [];
    let match;
    while ((match = headerPattern.exec(html)) !== null) {
      matches.push({
        start: match.index,
        end: headerPattern.lastIndex,
      });
    }

    for (let index = 0; index < matches.length; index += 1) {
      const start = matches[index].end;
      const end = matches[index + 1]?.start || html.length;
      blocks.push(html.slice(start, end));
    }

    if (blocks.length) {
      parts = blocks;
    }
  }
  const accounts = [];
  const creditorContacts = parseCreditorContacts(html);

  for (const part of parts) {
    const name = (part.match(/^\s*([^<]+)/) || [])[1]?.trim() || '';
    if (!name || name.includes('{{') || name === 'Risk Factors') {
      continue;
    }

    const block = part;
    const status = extractFirstBoundValue(block, 'Account Status');
    const statusByBureauRaw = extractRowCellValues(block, 'Account Status', { requireDigits: false });
    const accountTypeByBureau = extractRowCellValues(block, 'Account Type', { requireDigits: false });
    const accountTypeDetailByBureau = extractRowCellValues(block, 'Account Type - Detail', { requireDigits: false });
    const accountType = pickFirstBureauValue(accountTypeByBureau) || extractFirstBoundValue(block, 'Account Type');
    const accountTypeDetail = pickFirstBureauValue(accountTypeDetailByBureau) || extractRenderedCellValue(block, 'Account Type - Detail');
    const accountRatingByBureau = extractRowCellValues(block, 'Account Rating', { requireDigits: false });
    const paymentStatusByBureau = extractRowCellValues(block, 'Payment Status', { requireDigits: false });
    const accountRating = pickFirstBureauValue(accountRatingByBureau) || extractFirstBoundValue(block, 'Account Rating');
    const paymentStatus = pickFirstBureauValue(paymentStatusByBureau) || extractFirstBoundValue(block, 'Payment Status');
    const balance = extractFirstBoundValue(block, 'Balance');
    const creditLimit = extractFirstBoundValue(block, 'Credit Limit');
    const highCreditByBureau = extractRowCellValues(block, 'High Credit');
    const highBalanceByBureau = extractRowCellValues(block, 'High Balance');
    const highCredit = pickFirstBureauValue(highCreditByBureau) || extractFirstBoundValue(block, 'High Credit');
    const highBalance = pickFirstBureauValue(highBalanceByBureau) || extractFirstBoundValue(block, 'High Balance');
    const dateOpened = extractFirstBoundValue(block, 'Date Opened');
    const dateLastActive = extractFirstBoundValue(block, 'Date Last Active');
    const dateOfLastPayment = extractFirstBoundValue(block, 'Date Of Last Payment');
    const monthlyPayment = extractFirstBoundValue(block, 'Monthly Payment');
    const dateOpenedByBureauRaw = extractRowCellValues(block, 'Date Opened');
    const accountNumber = extractFirstBoundValue(block, 'Account #');
    const bureauPresence = extractRowCellValues(block, 'Account #');
    const balanceByBureauRaw = extractRowCellValues(block, 'Balance');
    const creditLimitByBureauRaw = extractRowCellValues(block, 'Credit Limit');
    const balanceByBureau = {
      transunion: balanceByBureauRaw.transunion || (bureauPresence.transunion ? balance : ''),
      experian: balanceByBureauRaw.experian || (bureauPresence.experian ? balance : ''),
      equifax: balanceByBureauRaw.equifax || (bureauPresence.equifax ? balance : ''),
    };
    const statusByBureau = {
      transunion: statusByBureauRaw.transunion || (bureauPresence.transunion ? status : ''),
      experian: statusByBureauRaw.experian || (bureauPresence.experian ? status : ''),
      equifax: statusByBureauRaw.equifax || (bureauPresence.equifax ? status : ''),
    };
    const creditLimitByBureau = {
      transunion: creditLimitByBureauRaw.transunion || (bureauPresence.transunion ? creditLimit : ''),
      experian: creditLimitByBureauRaw.experian || (bureauPresence.experian ? creditLimit : ''),
      equifax: creditLimitByBureauRaw.equifax || (bureauPresence.equifax ? creditLimit : ''),
    };
    const dateOpenedByBureau = {
      transunion: dateOpenedByBureauRaw.transunion || (bureauPresence.transunion ? dateOpened : ''),
      experian: dateOpenedByBureauRaw.experian || (bureauPresence.experian ? dateOpened : ''),
      equifax: dateOpenedByBureauRaw.equifax || (bureauPresence.equifax ? dateOpened : ''),
    };
    const paymentHistoryByBureau = parsePaymentHistoryByBureau(block);
    const paymentHistorySummary = calculatePaymentHistorySummary(
      paymentHistoryByBureau.transunion.goodCount + paymentHistoryByBureau.experian.goodCount + paymentHistoryByBureau.equifax.goodCount,
      paymentHistoryByBureau.transunion.badCount + paymentHistoryByBureau.experian.badCount + paymentHistoryByBureau.equifax.badCount,
    );
    const creditorContact = findCreditorContactForAccount(creditorContacts, name);

    if (shouldExcludeOpenAccountCandidate({
      status,
      accountType,
      accountTypeDetail,
      accountRating,
      paymentStatus,
    })) {
      continue;
    }

    accounts.push({
      name,
      status,
      accountType,
      accountTypeDetail,
      accountTypeByBureau,
      accountTypeDetailByBureau,
      statusByBureau,
      balance,
      creditLimit,
      highCredit,
      highBalance,
      highCreditByBureau,
      highBalanceByBureau,
      dateOpened,
      dateLastActive,
      dateOfLastPayment,
      monthlyPayment,
      dateOpenedByBureau,
      paymentHistoryByBureau,
      paymentHistorySummary,
      accountNumber,
      creditorAddress: creditorContact?.address || '',
      creditorPhone: creditorContact?.phone || '',
      balanceByBureau,
      creditLimitByBureau,
      bureaus: {
        transunion: Boolean(bureauPresence.transunion),
        experian: Boolean(bureauPresence.experian),
        equifax: Boolean(bureauPresence.equifax),
      },
    });
  }

  return dedupeOpenAccounts(accounts);
};

const calculateBureauTotals = (accounts) => {
  const totals = {
    transunion: {
      balanceTotal: 0,
      creditLimitTotal: 0,
    },
    experian: {
      balanceTotal: 0,
      creditLimitTotal: 0,
    },
    equifax: {
      balanceTotal: 0,
      creditLimitTotal: 0,
    },
  };

  for (const account of accounts) {
    totals.transunion.balanceTotal += parseMoneyValue(account.balanceByBureau?.transunion);
    totals.transunion.creditLimitTotal += parseMoneyValue(account.creditLimitByBureau?.transunion);
    totals.experian.balanceTotal += parseMoneyValue(account.balanceByBureau?.experian);
    totals.experian.creditLimitTotal += parseMoneyValue(account.creditLimitByBureau?.experian);
    totals.equifax.balanceTotal += parseMoneyValue(account.balanceByBureau?.equifax);
    totals.equifax.creditLimitTotal += parseMoneyValue(account.creditLimitByBureau?.equifax);
  }

  return totals;
};

const calculateBureauAgeOfCredit = (accounts) => {
  const now = new Date();
  const bureaus = {
    transunion: [],
    experian: [],
    equifax: [],
  };

  for (const account of accounts) {
    const tuDate = parseDateValue(account.dateOpenedByBureau?.transunion);
    const expDate = parseDateValue(account.dateOpenedByBureau?.experian);
    const eqDate = parseDateValue(account.dateOpenedByBureau?.equifax);

    if (tuDate) bureaus.transunion.push(tuDate.getTime());
    if (expDate) bureaus.experian.push(expDate.getTime());
    if (eqDate) bureaus.equifax.push(eqDate.getTime());
  }

  const result = {};
  for (const [bureau, timestamps] of Object.entries(bureaus)) {
    if (timestamps.length === 0) {
      result[bureau] = {
        averageOpenedDate: null,
        averageAgeYears: null,
        accountCount: 0,
      };
      continue;
    }

    const averageTimestamp = timestamps.reduce((sum, value) => sum + value, 0) / timestamps.length;
    const averageOpenedDate = new Date(averageTimestamp);
    const ageYears = (now.getTime() - averageTimestamp) / (1000 * 60 * 60 * 24 * 365.25);

    result[bureau] = {
      averageOpenedDate: averageOpenedDate.toISOString(),
      averageAgeYears: ageYears,
      accountCount: timestamps.length,
    };
  }

  return result;
};

const calculateBureauUtilization = (accounts) => {
  const totals = {
    transunion: {
      balanceTotal: 0,
      creditLimitTotal: 0,
      utilizationPercent: null,
    },
    experian: {
      balanceTotal: 0,
      creditLimitTotal: 0,
      utilizationPercent: null,
    },
    equifax: {
      balanceTotal: 0,
      creditLimitTotal: 0,
      utilizationPercent: null,
    },
  };

  for (const account of accounts) {
    if (isEligibleForBureauUtilization(account, 'transunion')) {
      totals.transunion.balanceTotal += parseMoneyValue(account.balanceByBureau?.transunion);
      totals.transunion.creditLimitTotal += parseMoneyValue(account.creditLimitByBureau?.transunion);
    }
    if (isEligibleForBureauUtilization(account, 'experian')) {
      totals.experian.balanceTotal += parseMoneyValue(account.balanceByBureau?.experian);
      totals.experian.creditLimitTotal += parseMoneyValue(account.creditLimitByBureau?.experian);
    }
    if (isEligibleForBureauUtilization(account, 'equifax')) {
      totals.equifax.balanceTotal += parseMoneyValue(account.balanceByBureau?.equifax);
      totals.equifax.creditLimitTotal += parseMoneyValue(account.creditLimitByBureau?.equifax);
    }
  }

  for (const bureau of Object.keys(totals)) {
    const entry = totals[bureau];
    if (entry.creditLimitTotal > 0) {
      entry.utilizationPercent = (entry.balanceTotal / entry.creditLimitTotal) * 100;
    }
  }

  return totals;
};

const calculateBureauOnTimePayments = (accounts) => {
  const totals = {
    transunion: {
      ...calculatePaymentHistorySummary(0, 0),
      accountCountWithHistory: 0,
      onTimePercentSum: 0,
    },
    experian: {
      ...calculatePaymentHistorySummary(0, 0),
      accountCountWithHistory: 0,
      onTimePercentSum: 0,
    },
    equifax: {
      ...calculatePaymentHistorySummary(0, 0),
      accountCountWithHistory: 0,
      onTimePercentSum: 0,
    },
  };

  for (const account of accounts) {
    for (const bureau of Object.keys(totals)) {
      const history = account.paymentHistoryByBureau?.[bureau];
      if (!history) {
        continue;
      }

      const good = Number.isFinite(history.goodCount) ? history.goodCount : 0;
      const bad = Number.isFinite(history.badCount) ? history.badCount : 0;
      const total = good + bad;

      totals[bureau].goodCount += good;
      totals[bureau].badCount += bad;

      if (total > 0) {
        const accountOnTimePercent = (good / total) * 100;
        totals[bureau].onTimePercentSum += accountOnTimePercent;
        totals[bureau].accountCountWithHistory += 1;
      }
    }
  }

  for (const bureau of Object.keys(totals)) {
    const bureauSummary = calculatePaymentHistorySummary(totals[bureau].goodCount, totals[bureau].badCount);
    const denominator = totals[bureau].accountCountWithHistory;
    const averagedPercent = denominator > 0
      ? (totals[bureau].onTimePercentSum / denominator)
      : null;

    totals[bureau] = {
      ...bureauSummary,
      accountCountWithHistory: denominator,
      onTimePercent: averagedPercent,
    };
  }

  return totals;
};

const calculateBureauTotalDebt = (accounts) => {
  const totals = {
    transunion: { totalDebt: 0 },
    experian: { totalDebt: 0 },
    equifax: { totalDebt: 0 },
  };

  for (const account of accounts) {
    if (!countsTowardTotalDebt(account)) {
      continue;
    }

    totals.transunion.totalDebt += parseMoneyValue(account.balanceByBureau?.transunion);
    totals.experian.totalDebt += parseMoneyValue(account.balanceByBureau?.experian);
    totals.equifax.totalDebt += parseMoneyValue(account.balanceByBureau?.equifax);
  }

  return totals;
};

const calculateMonthlyDebtTotals = (accounts) => ({
  totalMonthlyDebtPayments: accounts.reduce((sum, account) => sum + parseMoneyValue(account.monthlyPayment), 0),
});

const toSafeClient = (client) => {
  const jsonReport = parseJsonValue(client.creditReportJson) || parseJsonValue(client.creditReportHtml);
  const jsonScores = jsonReport ? parseCreditScoresFromJson(jsonReport) : null;
  const htmlScores = parseCreditScores(client.creditReportHtml);
  const parsed = jsonScores && Object.values(jsonScores.scores || {}).some(Boolean)
    ? jsonScores
    : htmlScores;
  const jsonAccounts = jsonReport ? parseOpenAccountsFromJson(jsonReport) : [];
  const htmlAccounts = parseOpenAccounts(client.creditReportHtml);
  const openAccounts = jsonAccounts.length > 0 ? jsonAccounts : htmlAccounts;
  const reportDate = client.reportDate
    || (jsonReport ? parseReportDateFromJson(jsonReport) : '')
    || parseReportDateFromHtml(client.creditReportHtml)
    || parseReportDateFromFilename(client.creditReportFileName);
  const bureauHardInquiries = jsonReport
    ? parseBureauHardInquiriesFromJson(jsonReport)
    : parseBureauHardInquiriesFromHtml(client.creditReportHtml);
  const nextImport = calculateNextImportForClient({
    ...client,
    reportDate,
  });
  return {
    id: client.id,
    firstName: client.firstName,
    lastName: client.lastName,
    email: client.email,
    dob: client.dob || '',
    ssn: client.ssn || '',
    address: client.address || '',
    phone: client.phone || '',
    spouseClientId: client.spouseClientId || '',
    spouseClientLabel: client.spouseClientLabel || '',
    assignedTo: client.assignedTo || '',
    ninjaAssigned: client.ninjaAssigned || '',
    affiliateAssigned: client.affiliateAssigned || 'None',
    ghlContactId: client.ghlContactId || '',
    ghlLocationId: client.ghlLocationId || '',
    ghlSource: client.ghlSource || '',
    status: client.status || 'Client',
    phase: client.phase || 'None',
    monitoringAgency: inferMonitoringAgency(client),
    yearlyIncome: client.yearlyIncome || '',
    housingPayment: client.housingPayment || '',
    debtMonthlyPayments: client.debtMonthlyPayments || '',
    monitoringUsername: client.monitoringUsername || '',
    monitoringPassword: client.monitoringPassword || '',
    secretKey: client.secretKey || '',
    monitoringToken: client.monitoringToken || '',
    portalPassword: client.portalPassword || buildDefaultPortalPassword(client.lastName || '', client.ssn || ''),
    portalEnabled: client.portalEnabled !== undefined ? Boolean(client.portalEnabled) : true,
    language: client.language || 'English',
    goal: client.goal || '',
    notes: client.notes || '',
    documents: Array.isArray(client.documents) ? client.documents : [],
    creditReportSource: client.creditReportSource || '',
    lastSyncedAt: client.lastSyncedAt || '',
    creditReportFileName: client.creditReportFileName,
    reportDate,
    nextImportInt: client.nextImportInt || '',
    nextImportLabel: client.nextImportLabel || '',
    nextImportMode: client.nextImportMode || 'manual',
    manualNextImportStartDays: Number.isFinite(Number(client.manualNextImportStartDays))
      ? Number.parseInt(client.manualNextImportStartDays, 10)
      : null,
    manualNextImportSetDate: client.manualNextImportSetDate || '',
    refreshNextImportStartDate: client.refreshNextImportStartDate || '',
    nextImport,
    createdAt: client.createdAt,
    creditScores: parsed.scores,
    creditScoresFound: parsed.foundAll,
    openAccounts,
    bureauTotals: calculateBureauTotals(openAccounts),
    bureauUtilization: calculateBureauUtilization(openAccounts),
    bureauTotalDebt: calculateBureauTotalDebt(openAccounts),
    bureauAgeOfCredit: calculateBureauAgeOfCredit(openAccounts),
    bureauOnTimePayments: calculateBureauOnTimePayments(openAccounts),
    bureauHardInquiries,
    monthlyDebtTotals: calculateMonthlyDebtTotals(openAccounts),
  };
};

const toClientListItem = (client) => {
  const reportDate = normalizeDateOnlyValue(client.reportDate);
  const manualNextImportSetDate = normalizeDateOnlyValue(client.manualNextImportSetDate);
  const refreshNextImportStartDate = normalizeDateOnlyValue(client.refreshNextImportStartDate);
  const nextImport = calculateNextImportForClient({
    ...client,
    reportDate,
    manualNextImportSetDate,
    refreshNextImportStartDate,
  });

  return {
    id: client.id,
    firstName: client.firstName || '',
    lastName: client.lastName || '',
    email: client.email || '',
    dob: client.dob || '',
    ssn: client.ssn || '',
    address: client.address || '',
    phone: client.phone || '',
    spouseClientId: client.spouseClientId || '',
    spouseClientLabel: client.spouseClientLabel || '',
    assignedTo: client.assignedTo || '',
    ninjaAssigned: client.ninjaAssigned || '',
    affiliateAssigned: client.affiliateAssigned || 'None',
    ghlContactId: client.ghlContactId || '',
    ghlLocationId: client.ghlLocationId || '',
    ghlSource: client.ghlSource || '',
    status: client.status || 'Client',
    phase: client.phase || 'None',
    monitoringAgency: inferMonitoringAgency(client),
    yearlyIncome: client.yearlyIncome || '',
    housingPayment: client.housingPayment || '',
    debtMonthlyPayments: client.debtMonthlyPayments || '',
    monitoringUsername: client.monitoringUsername || '',
    monitoringPassword: client.monitoringPassword || '',
    secretKey: client.secretKey || '',
    monitoringToken: client.monitoringToken || '',
    portalPassword: client.portalPassword || buildDefaultPortalPassword(client.lastName || '', client.ssn || ''),
    portalEnabled: client.portalEnabled !== undefined ? Boolean(client.portalEnabled) : true,
    language: client.language || 'English',
    goal: client.goal || '',
    notes: client.notes || '',
    reportDate,
    nextImportInt: client.nextImportInt || '',
    nextImportLabel: client.nextImportLabel || '',
    nextImportMode: client.nextImportMode || 'manual',
    manualNextImportStartDays: Number.isFinite(Number(client.manualNextImportStartDays))
      ? Number.parseInt(client.manualNextImportStartDays, 10)
      : null,
    manualNextImportSetDate,
    refreshNextImportStartDate,
    nextImport,
    createdAt: normalizeIsoDateTimeValue(client.createdAt),
    creditScores: null,
  };
};

const normalizeStore = (store) => {
  const normalizedBusinessSettings = {
    ...seedData.businessSettings,
    ...(store?.businessSettings && typeof store.businessSettings === 'object' ? store.businessSettings : {}),
  };
  if (Array.isArray(store?.clients)) {
    return {
      clients: store.clients.map((client) => normalizeClientRecord(client)),
      statuses: uniqueStatuses([...(Array.isArray(store.statuses) ? store.statuses : []), ...defaultStatuses]),
      phases: uniquePhases([...(Array.isArray(store.phases) ? store.phases : []), ...defaultPhases]),
      businessSettings: normalizedBusinessSettings,
    };
  }

  if (Array.isArray(store?.contacts)) {
    return {
      statuses: defaultStatuses,
      phases: defaultPhases,
      businessSettings: normalizedBusinessSettings,
      clients: store.contacts.map((contact, index) => {
        const parts = String(contact.name || '').trim().split(/\s+/).filter(Boolean);
        const firstName = parts[0] || 'Client';
        const lastName = parts.slice(1).join(' ') || `${index + 1}`;

        return {
          id: contact.id || generateId(),
          firstName,
          lastName,
          email: contact.email || '',
          dob: '',
          ssn: '',
          address: '',
          phone: contact.phone || '',
          spouseClientId: '',
          spouseClientLabel: '',
          assignedTo: '',
          status: 'Client',
          phase: 'None',
          monitoringAgency: '',
          yearlyIncome: '',
          housingPayment: '',
          debtMonthlyPayments: '',
          monitoringUsername: '',
          monitoringPassword: '',
          secretKey: '',
          monitoringToken: '',
          portalPassword: '',
          portalEnabled: true,
          language: 'English',
          goal: '',
          notes: '',
          reportDate: '',
          nextImportInt: '',
          nextImportLabel: '',
          creditReportJson: '',
          creditReportSource: '',
          lastSyncedAt: '',
          creditReportFileName: 'missing-credit-report.html',
          creditReportHtml: buildPlaceholderCreditReportHtml(firstName, lastName),
          createdAt: new Date().toISOString(),
        };
      }),
    };
  }

  return seedData;
};

const writeJsonFileAtomic = async (targetPath, payload) => {
  const tempPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, payload);
  await fs.rename(tempPath, targetPath);
};

let _surrealSchemaReady = false;
const ensureSurrealSchema = async () => {
  if (_surrealSchemaReady) return;
  _surrealSchemaReady = true;
  // Seed default users into SurrealDB users table
  const now = new Date().toISOString();
  for (const credential of getAllowedLoginCredentials()) {
    const username = normalizeUsername(credential.username);
    const password = String(credential.password || '');
    if (!username || !password) continue;
    const salt = `seed:${username}`;
    const existing = await surql(`SELECT username FROM users WHERE username = "${sEsc(username)}" LIMIT 1`).catch(() => []);
    if (!existing.length) {
      await surqlRestPut('users', username, { username, password_hash: hashUserPassword(password, salt), password_salt: salt, created_at: now, updated_at: now }).catch(() => {});
    }
    dynamicUsernames.add(username);
  }
  // Load all known usernames into memory
  const allUsers = await surql('SELECT username FROM users').catch(() => []);
  for (const row of allUsers) {
    const u = normalizeUsername(row?.username || '');
    if (u) dynamicUsernames.add(u);
  }
  if (!initialS3MirrorQueued) {
    initialS3MirrorQueued = true;
    void mirrorBusinessControlPlaneToS3('admin').catch((error) => {
      console.warn(`[S3 Mirror] initial control-plane export failed: ${error.message}`);
    });
  }
};

const buildSnapshotChecksum = (payload) => createHash('sha256')
  .update(JSON.stringify(payload))
  .digest('hex');

const mirrorCreditReportToS3 = async (ownerKey, client, snapshot = {}, reportJson = '') => {
  const normalizedOwner = normalizeOwnerKey(ownerKey);
  const clientId = String(client?.id || '').trim() || 'unknown-client';
  const stamp = String(snapshot?.createdAt || new Date().toISOString()).replace(/[:.]/g, '-');
  const reportId = String(snapshot?.id || '').trim() || 'latest';
  const source = String(snapshot?.source || client?.creditReportSource || 'report').trim().replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  const payload = {
    ownerKey: normalizedOwner,
    clientId,
    reportId,
    source,
    reportDate: String(snapshot?.reportDate || client?.reportDate || '').trim(),
    createdAt: String(snapshot?.createdAt || new Date().toISOString()),
    reportJson: parseJsonValue(reportJson) || reportJson,
  };
  await mirrorBusinessBlobToS3(
    normalizedOwner,
    `reports/${clientId}/${stamp}-${source}-${reportId}.json`,
    JSON.stringify(payload, null, 2),
  );
};

const insertReportSnapshot = async (client, payload = {}) => {
  if (!hasMeaningfulReportData({
    creditReportHtml: payload.reportHtml || client.creditReportHtml,
    creditReportJson: payload.reportJsonRaw || payload.reportJson || client.creditReportJson,
  })) return null;

  const reportHtml = String(payload.reportHtml || client.creditReportHtml || '');
  const reportJson = stringifyJsonValue(payload.reportJsonRaw || payload.reportJson || client.creditReportJson || '');
  const reportDate = String(payload.reportDate || client.reportDate || '');
  const reportFileName = String(payload.reportFileName || client.creditReportFileName || '');
  const source = String(payload.source || client.creditReportSource || 'html-upload');
  const monitoringAgency = String(payload.monitoringAgency || '');
  const responseUrl = String(payload.responseUrl || '');
  const metadataJson = stringifyJsonValue(payload.metadata || '');
  const createdAt = String(payload.createdAt || new Date().toISOString());
  const snapshotChecksum = buildSnapshotChecksum({ clientId: client.id, source, reportDate, reportFileName, reportHtml, reportJson });
  const recordId = `${String(client.id)}_${snapshotChecksum}`;

  // Use REST PUT to handle large HTML payloads
  await surqlRestPut('reports', recordId, {
    client_id: String(client.id),
    source,
    monitoring_agency: monitoringAgency,
    report_date: reportDate,
    report_file_name: reportFileName,
    report_html: reportHtml,
    report_json: reportJson,
    response_url: responseUrl,
    snapshot_checksum: snapshotChecksum,
    metadata_json: metadataJson,
    created_at: createdAt,
    source_db: 'ninjatools',
  }).catch(() => {});

  const rows = await surql(`SELECT id, client_id AS clientId, source, report_date AS reportDate, report_file_name AS reportFileName, created_at AS createdAt FROM reports WHERE client_id = "${sEsc(String(client.id))}" AND snapshot_checksum = "${sEsc(snapshotChecksum)}" LIMIT 1`);
  const snapshot = rows[0] ?? null;
  if (snapshot) {
    void mirrorCreditReportToS3(getCurrentOwnerKey(), client, snapshot, reportJson).catch((error) => {
      console.warn(`[S3 Mirror] report export failed for ${client.id}: ${error.message}`);
    });
  }
  return snapshot;
};

const ensureDataFile = async (ownerKey = getCurrentOwnerKey()) => {
  const normalizedOwner = normalizeOwnerKey(ownerKey);
  const targetDataFile = getOwnerDataFile(normalizedOwner);
  await fs.mkdir(path.dirname(targetDataFile), { recursive: true });

  try {
    await fs.access(targetDataFile);
  } catch {
    if (normalizedOwner === 'admin') {
      try {
        await fs.access(dataFile);
        const legacyRaw = await fs.readFile(dataFile, 'utf8');
        const legacyNormalized = normalizeStore(JSON.parse(legacyRaw));
        await writeJsonFileAtomic(targetDataFile, JSON.stringify(legacyNormalized, null, 2));
        return;
      } catch {
        // Fall back to seed payload when legacy admin store is unavailable.
      }
    }
    await writeJsonFileAtomic(targetDataFile, JSON.stringify(seedData, null, 2));
    return;
  }

  const raw = await fs.readFile(targetDataFile, 'utf8');
  const normalized = normalizeStore(JSON.parse(raw));
  await writeJsonFileAtomic(targetDataFile, JSON.stringify(normalized, null, 2));
};

const mergeClientProfileRow = (client, row) => {
  if (!row) {
    return client;
  }

  return {
    ...client,
    firstName: row.firstName ?? client.firstName,
    lastName: row.lastName ?? client.lastName,
    email: row.email ?? client.email,
    dob: row.dob ?? client.dob,
    ssn: row.ssn ?? client.ssn,
    address: row.address ?? client.address,
    phone: row.phone ?? client.phone,
    spouseClientId: row.spouseClientId ?? client.spouseClientId,
    spouseClientLabel: row.spouseClientLabel ?? client.spouseClientLabel,
    assignedTo: row.assignedTo ?? client.assignedTo,
    ninjaAssigned: row.ninjaAssigned ?? client.ninjaAssigned,
    affiliateAssigned: row.affiliateAssigned ?? client.affiliateAssigned,
    status: row.status ?? client.status,
    phase: row.phase ?? client.phase,
    monitoringAgency: row.monitoringAgency ?? client.monitoringAgency,
    monitoringUsername: row.monitoringUsername ?? client.monitoringUsername,
    monitoringPassword: row.monitoringPassword ?? client.monitoringPassword,
    secretKey: row.secretKey ?? client.secretKey,
    monitoringToken: row.monitoringToken ?? client.monitoringToken,
    portalPassword: row.portalPassword ?? client.portalPassword,
    portalEnabled: row.portalEnabled ?? client.portalEnabled,
    language: row.language ?? client.language,
    goal: row.goal ?? client.goal,
    notes: row.notes ?? client.notes,
    yearlyIncome: row.yearlyIncome ?? client.yearlyIncome,
    housingPayment: row.housingPayment ?? client.housingPayment,
    debtMonthlyPayments: row.debtMonthlyPayments ?? client.debtMonthlyPayments,
    nextImportInt: row.nextImportInt ?? client.nextImportInt,
    nextImportLabel: row.nextImportLabel ?? client.nextImportLabel,
    nextImportMode: row.nextImportMode ?? client.nextImportMode,
    manualNextImportStartDays: row.manualNextImportStartDays ?? client.manualNextImportStartDays,
    manualNextImportSetDate: row.manualNextImportSetDate ?? client.manualNextImportSetDate,
    refreshNextImportStartDate: row.refreshNextImportStartDate ?? client.refreshNextImportStartDate,
    documents: Array.isArray(row.documents) ? row.documents : client.documents,
    reportDate: row.reportDate ?? client.reportDate,
  };
};

const loadClientProfilesMap = async (ownerKey = getCurrentOwnerKey()) => {
  const normalizedOwner = normalizeOwnerKey(ownerKey);
  const rows = await surql(`SELECT client_id AS clientId, first_name AS firstName, last_name AS lastName, email, dob, ssn, address, phone, spouse_client_id AS spouseClientId, spouse_client_label AS spouseClientLabel, assigned_to AS assignedTo, ninja_assigned AS ninjaAssigned, affiliate_assigned AS affiliateAssigned, status, phase, monitoring_agency AS monitoringAgency, monitoring_username AS monitoringUsername, monitoring_password AS monitoringPassword, secret_key AS secretKey, monitoring_token AS monitoringToken, portal_password AS portalPassword, portal_enabled AS portalEnabled, language, goal, notes, yearly_income AS yearlyIncome, housing_payment AS housingPayment, debt_monthly_payments AS debtMonthlyPayments, next_import_int AS nextImportInt, next_import_label AS nextImportLabel, next_import_mode AS nextImportMode, manual_next_import_start_days AS manualNextImportStartDays, manual_next_import_set_date AS manualNextImportSetDate, refresh_next_import_start_date AS refreshNextImportStartDate, documents_json AS documentsJson, report_date AS reportDate FROM clients WHERE owner_key = "${sEsc(normalizedOwner)}" AND source_db = "ninjatools"`);
  return new Map(rows.map((row) => {
    let documents = null;
    try {
      const parsed = JSON.parse(String(row.documentsJson || '[]'));
      documents = Array.isArray(parsed) ? parsed : null;
    } catch { documents = null; }
    return [row.clientId, { ...row, documents }];
  }));
};

const mergeStoreWithProfileDb = async (store, ownerKey = getCurrentOwnerKey()) => {
  const profileMap = await loadClientProfilesMap(ownerKey);
  const mergedClients = store.clients.map((client) => mergeClientProfileRow(client, profileMap.get(client.id)));
  const existingIds = new Set(mergedClients.map((client) => String(client.id || '').trim()).filter(Boolean));

  // Critical bridge behavior:
  // if a client exists in MySQL but not yet in store.json, append it so /api/clients
  // immediately returns the synced row instead of hiding it from the UI.
  for (const [clientId, row] of profileMap.entries()) {
    const normalizedId = String(clientId || '').trim();
    if (!normalizedId || existingIds.has(normalizedId)) {
      continue;
    }

    mergedClients.push(normalizeClientRecord({
      id: normalizedId,
      firstName: row.firstName || '',
      lastName: row.lastName || '',
      email: row.email || '',
      dob: row.dob || '',
      ssn: row.ssn || '',
      address: row.address || '',
      phone: row.phone || '',
      spouseClientId: row.spouseClientId || '',
      spouseClientLabel: row.spouseClientLabel || '',
      assignedTo: row.assignedTo || '',
      ninjaAssigned: row.ninjaAssigned || '',
      affiliateAssigned: row.affiliateAssigned || 'None',
      status: row.status || 'Client',
      phase: row.phase || 'None',
      monitoringAgency: row.monitoringAgency || '',
      monitoringUsername: row.monitoringUsername || '',
      monitoringPassword: row.monitoringPassword || '',
      secretKey: row.secretKey || '',
      monitoringToken: row.monitoringToken || '',
      portalPassword: row.portalPassword || '',
      portalEnabled: row.portalEnabled,
      language: row.language || 'English',
      goal: row.goal || '',
      notes: row.notes || '',
      yearlyIncome: row.yearlyIncome || '',
      housingPayment: row.housingPayment || '',
      debtMonthlyPayments: row.debtMonthlyPayments || '',
      nextImportInt: row.nextImportInt || '',
      nextImportLabel: row.nextImportLabel || '',
      nextImportMode: row.nextImportMode || 'manual',
      manualNextImportStartDays: row.manualNextImportStartDays,
      manualNextImportSetDate: row.manualNextImportSetDate || '',
      refreshNextImportStartDate: row.refreshNextImportStartDate || '',
      documents: Array.isArray(row.documents) ? row.documents : [],
      reportDate: row.reportDate || '',
      creditReportJson: '',
      creditReportSource: '',
      lastSyncedAt: row.updatedAt || '',
      creditReportFileName: 'missing-credit-report.html',
      creditReportHtml: buildPlaceholderCreditReportHtml(row.firstName || 'Client', row.lastName || ''),
      createdAt: row.updatedAt || new Date().toISOString(),
    }));
    existingIds.add(normalizedId);
  }

  return {
    ...store,
    clients: mergedClients,
  };
};

const syncClientProfilesToDb = async (clients = [], ownerKey = getCurrentOwnerKey()) => {
  const normalizedOwner = normalizeOwnerKey(ownerKey);
  const existingRows = await surql(`SELECT client_id, first_name, last_name, email, ssn FROM clients WHERE owner_key = "${sEsc(normalizedOwner)}" AND source_db = "ninjatools"`);
  const canonicalBySsn = new Map();
  const canonicalByEmailName = new Map();
  for (const row of existingRows) {
    const rowClientId = String(row.client_id || '').trim();
    const canonicalId = (/^\d+$/.test(rowClientId) && rowClientId) || '';
    if (!canonicalId) continue;
    const ssnDigits = String(row.ssn || '').replace(/\D/g, '');
    if (ssnDigits.length >= 9) canonicalBySsn.set(ssnDigits.slice(0, 9), canonicalId);
    const emailNameKey = `${String(row.email || '').trim().toLowerCase()}|${String(row.first_name || '').trim().toLowerCase()}|${String(row.last_name || '').trim().toLowerCase()}`;
    if (String(row.email || '').trim()) canonicalByEmailName.set(emailNameKey, canonicalId);
  }
  const updatedAt = new Date().toISOString();
  const syncedTargetIdsInPass = new Set();
  for (const client of clients) {
    const normalizedSsn = normalizeSsnInput(client.ssn || '');
    const normalizedDob = normalizeDobInput(client.dob || '');
    let targetClientId = String(client.id || '').trim();
    if (targetClientId.startsWith('client-')) {
      const ssnDigits = String(normalizedSsn || '').replace(/\D/g, '');
      const ssnKey = ssnDigits.length >= 9 ? ssnDigits.slice(0, 9) : '';
      const emailNameKey = `${String(client.email || '').trim().toLowerCase()}|${String(client.firstName || '').trim().toLowerCase()}|${String(client.lastName || '').trim().toLowerCase()}`;
      const canonicalId = (ssnKey && canonicalBySsn.get(ssnKey))
        || (String(client.email || '').trim() ? canonicalByEmailName.get(emailNameKey) : '')
        || '';
      if (canonicalId) targetClientId = canonicalId;
    }
    if (syncedTargetIdsInPass.has(targetClientId)) continue;
    const recordId = `${targetClientId}_ninjatools`;
    await surqlRestPut('clients', recordId, {
      client_id: targetClientId,
      owner_key: normalizedOwner,
      source_db: 'ninjatools',
      first_name: client.firstName || '',
      last_name: client.lastName || '',
      email: client.email || '',
      dob: normalizedDob,
      ssn: normalizedSsn,
      address: client.address || '',
      phone: client.phone || '',
      spouse_client_id: client.spouseClientId || '',
      spouse_client_label: client.spouseClientLabel || '',
      assigned_to: client.assignedTo || '',
      ninja_assigned: client.ninjaAssigned || '',
      affiliate_assigned: client.affiliateAssigned || 'None',
      status: client.status || 'Client',
      phase: client.phase || 'None',
      monitoring_agency: client.monitoringAgency || '',
      monitoring_username: client.monitoringUsername || '',
      monitoring_password: client.monitoringPassword || '',
      secret_key: client.secretKey || '',
      monitoring_token: client.monitoringToken || '',
      portal_password: client.portalPassword || buildDefaultPortalPassword(client.lastName || '', normalizedSsn),
      portal_enabled: !!client.portalEnabled,
      language: client.language || 'English',
      goal: client.goal || '',
      notes: client.notes || '',
      yearly_income: client.yearlyIncome || '',
      housing_payment: client.housingPayment || '',
      debt_monthly_payments: client.debtMonthlyPayments || '',
      next_import_int: client.nextImportInt || '',
      next_import_label: client.nextImportLabel || '',
      next_import_mode: client.nextImportMode || 'manual',
      manual_next_import_start_days: Number.isFinite(Number(client.manualNextImportStartDays)) ? String(Number.parseInt(client.manualNextImportStartDays, 10)) : '',
      manual_next_import_set_date: client.manualNextImportSetDate || '',
      refresh_next_import_start_date: client.refreshNextImportStartDate || '',
      documents_json: JSON.stringify(normalizeClientDocumentsInput(client.documents)),
      report_date: client.reportDate || '',
      updated_at: updatedAt,
      created_at: client.createdAt || updatedAt,
    }).catch(() => {});
    syncedTargetIdsInPass.add(targetClientId);
  }
};

const deleteClientProfile = async (clientId, ownerKey = getCurrentOwnerKey()) => {
  const normalizedOwner = normalizeOwnerKey(ownerKey);
  const recordId = `${String(clientId)}_ninjatools`;
  await surql(`DELETE clients:⟨${sEsc(recordId)}⟩`).catch(() => {});
};

const loadIntegrations = async () => {
  const rows = await surql(`SELECT setting_key AS settingKey, value_json AS valueJson FROM settings WHERE setting_key IN ["integration.smartcredit","integration.smartcredit35540","integration.smartcredit68951","integration.myfreescorenow","integration.gohighlevel","integration.billing","integration.ninjadispute","integration.contabo"]`);

  const map = Object.fromEntries(rows.map((row) => {
    let parsed = {};
    try {
      parsed = JSON.parse(row.valueJson || '{}');
    } catch {
      parsed = {};
    }
    return [String(row.settingKey || '').replace('integration.', ''), parsed];
  }));

  const smartcredit35540 = map.smartcredit35540
    ? normalizeIntegrationPayload(map.smartcredit35540, 'smartcredit35540')
    : map.smartcredit
      ? normalizeIntegrationPayload(map.smartcredit, 'smartcredit35540')
      : normalizeIntegrationPayload(defaultIntegrations.smartcredit35540, 'smartcredit35540');
  const smartcredit68951 = map.smartcredit68951
    ? normalizeIntegrationPayload(map.smartcredit68951, 'smartcredit68951')
    : map.smartcredit
      ? normalizeIntegrationPayload(map.smartcredit, 'smartcredit68951')
      : normalizeIntegrationPayload(defaultIntegrations.smartcredit68951, 'smartcredit68951');

  return {
    smartcredit35540,
    smartcredit68951,
    myfreescorenow: normalizeIntegrationPayload(map.myfreescorenow, 'myfreescorenow'),
    gohighlevel: normalizeIntegrationPayload(map.gohighlevel, 'gohighlevel'),
    billing: normalizeIntegrationPayload(map.billing, 'billing'),
    ninjadispute: normalizeIntegrationPayload(map.ninjadispute, 'ninjadispute'),
    contabo: normalizeIntegrationPayload(map.contabo, 'contabo'),
  };
};

const saveIntegration = async (service, payload = {}) => {
  const normalizedService = String(service || '').trim().toLowerCase();
  if (!allowedIntegrationServices.has(normalizedService)) throw new Error('Unsupported integration service.');
  const normalized = normalizeIntegrationPayload(payload, normalizedService);
  const key = `integration.${normalizedService}`;
  await surqlRestPut('settings', key, { setting_key: key, value_json: JSON.stringify(normalized), updated_at: new Date().toISOString() });

  void mirrorBusinessControlPlaneToS3('admin').catch((error) => {
    console.warn(`[S3 Mirror] integration export failed: ${error.message}`);
  });

  return normalized;
};

const mirrorBusinessControlPlaneToS3 = async (ownerKey = getCurrentOwnerKey()) => {
  const normalizedOwner = normalizeOwnerKey(ownerKey);
  const appUsers = await surql('SELECT username, created_at AS createdAt, updated_at AS updatedAt FROM users ORDER BY username ASC').catch(() => []);
  const appSettings = await surql('SELECT setting_key AS settingKey, value_json AS valueJson, updated_at AS updatedAt FROM settings ORDER BY setting_key ASC').catch(() => []);
  const clientProfiles = await surql(`SELECT * FROM clients WHERE owner_key = "${sEsc(normalizedOwner)}" AND source_db = "ninjatools" ORDER BY client_id ASC`).catch(() => []);

  const generatedAt = new Date().toISOString();
  await mirrorBusinessBlobToS3(normalizedOwner, 'control-plane/app_users.json', JSON.stringify({
    generatedAt,
    ownerKey: normalizedOwner,
    users: appUsers,
  }, null, 2));
  await mirrorBusinessBlobToS3(normalizedOwner, 'control-plane/app_settings.json', JSON.stringify({
    generatedAt,
    ownerKey: normalizedOwner,
    settings: appSettings,
  }, null, 2));
  await mirrorBusinessBlobToS3(normalizedOwner, 'control-plane/client_profiles.json', JSON.stringify({
    generatedAt,
    ownerKey: normalizedOwner,
    clients: clientProfiles,
  }, null, 2));
};

const loadAffiliateLinks = async () => {
  const rows = await surql(`SELECT setting_key AS settingKey, value_json AS valueJson FROM settings WHERE setting_key IN ["affiliate.creditBuilder","affiliate.creditMonitoring"]`);

  const map = Object.fromEntries(rows.map((row) => {
    let parsed = [];
    try {
      parsed = JSON.parse(row.valueJson || '[]');
    } catch {
      parsed = [];
    }
    return [String(row.settingKey || ''), parsed];
  }));

  return {
    creditBuilder: await normalizeAffiliateBuilderRows(map['affiliate.creditBuilder'] || []),
    creditMonitoring: await normalizeAffiliateMonitoringRows(map['affiliate.creditMonitoring'] || affiliateMonitoringDefaults),
  };
};

const saveAffiliateSection = async (section, rows = []) => {
  const normalizedSection = String(section || '').trim();
  if (!['creditBuilder', 'creditMonitoring'].includes(normalizedSection)) {
    throw new Error('Unsupported affiliate links section.');
  }

  const normalizedRows = normalizedSection === 'creditBuilder'
    ? await normalizeAffiliateBuilderRows(rows)
    : await normalizeAffiliateMonitoringRows(rows);

  const key = `affiliate.${normalizedSection}`;
  await surqlRestPut('settings', key, { setting_key: key, value_json: JSON.stringify(normalizedRows), updated_at: new Date().toISOString() });

  void mirrorBusinessControlPlaneToS3('admin').catch((error) => {
    console.warn(`[S3 Mirror] affiliate export failed: ${error.message}`);
  });

  return normalizedRows;
};

const defaultPaymentConfig = {
  defaultRetryCount: 3,
  defaultRetryFrequencyDays: 7,
  defaultRunTimeLocal: '09:00',
  timezone: 'America/Chicago',
};

// Business-wide shared scope:
// all users in the same NinjaTools deployment resolve to one owner key unless
// we later introduce an explicit private-business override.
const normalizeOwnerKey = (_value = '') => 'admin';

const getPaymentsOwnerKey = (req, url) => normalizeOwnerKey(
  url.searchParams.get('owner')
  || req.headers['x-owner-key']
  || parseCookies(req?.headers?.cookie || '').get('txn')
  || getCurrentOwnerKey(),
);

const clampInteger = (value, fallback, min, max) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
};

const parseMoneyToCents = (value, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100);
  }
  const cleaned = String(value ?? '')
    .replace(/[^0-9.-]/g, '')
    .trim();
  if (!cleaned) {
    return fallback;
  }
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.round(parsed * 100);
};

const normalizePaymentStatus = (value, fallback = 'Active') => {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'paused') {
    return 'Paused';
  }
  if (status === 'inactive') {
    return 'Inactive';
  }
  return fallback;
};

const normalizeFrequencyType = (value, fallback = 'monthly') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (['weekly', 'biweekly', 'monthly', 'quarterly', 'custom'].includes(normalized)) {
    return normalized;
  }
  return fallback;
};

const normalizeNextChargeAt = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  const asDate = new Date(raw);
  if (Number.isNaN(asDate.valueOf())) {
    return '';
  }
  return asDate.toISOString();
};

const parseJsonField = (value, fallback = {}) => {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const getPaymentConfigKey = (ownerKey) => `payments.config.${normalizeOwnerKey(ownerKey)}`;

const loadPaymentConfig = async (ownerKey) => {
  const key = getPaymentConfigKey(ownerKey);
  const rows = await surql(`SELECT value_json AS valueJson FROM settings WHERE setting_key = "${sEsc(key)}" LIMIT 1`);
  const row = rows[0] ?? null;
  const parsed = parseJsonField(row?.valueJson, {});
  return {
    defaultRetryCount: clampInteger(parsed.defaultRetryCount, defaultPaymentConfig.defaultRetryCount, 0, 999),
    defaultRetryFrequencyDays: clampInteger(parsed.defaultRetryFrequencyDays, defaultPaymentConfig.defaultRetryFrequencyDays, 1, 365),
    defaultRunTimeLocal: String(parsed.defaultRunTimeLocal || defaultPaymentConfig.defaultRunTimeLocal).trim() || defaultPaymentConfig.defaultRunTimeLocal,
    timezone: String(parsed.timezone || defaultPaymentConfig.timezone).trim() || defaultPaymentConfig.timezone,
  };
};

const savePaymentConfig = async (ownerKey, payload = {}) => {
  const key = getPaymentConfigKey(ownerKey);
  const now = new Date().toISOString();
  const next = {
    defaultRetryCount: clampInteger(payload.defaultRetryCount, defaultPaymentConfig.defaultRetryCount, 0, 999),
    defaultRetryFrequencyDays: clampInteger(payload.defaultRetryFrequencyDays, defaultPaymentConfig.defaultRetryFrequencyDays, 1, 365),
    defaultRunTimeLocal: String(payload.defaultRunTimeLocal || defaultPaymentConfig.defaultRunTimeLocal).trim() || defaultPaymentConfig.defaultRunTimeLocal,
    timezone: String(payload.timezone || defaultPaymentConfig.timezone).trim() || defaultPaymentConfig.timezone,
  };
  await surqlRestPut('settings', key, { setting_key: key, value_json: JSON.stringify(next), updated_at: now });
  void mirrorBusinessControlPlaneToS3(ownerKey).catch((error) => {
    console.warn(`[S3 Mirror] payment config export failed: ${error.message}`);
  });
  return next;
};

const formatMerchantRow = (row = {}) => ({
  id: Number(row.id),
  merchantName: String(row.merchant_name || '').trim(),
  gateway: String(row.gateway || '').trim(),
  apiId: String(row.api_id || '').trim(),
  transactionKey: String(row.transaction_key || '').trim(),
  isDefault: Number(row.is_default || 0) === 1,
  status: normalizePaymentStatus(row.status, 'Active'),
  allowedRetries: clampInteger(row.allowed_retries, 3, 0, 999),
  retryFrequencyDays: clampInteger(row.retry_frequency_days, 7, 1, 365),
  metadata: parseJsonField(row.metadata_json, {}),
  createdAt: String(row.created_at || ''),
  updatedAt: String(row.updated_at || ''),
});

const _surrealNormMerchant = (row) => ({
  ...row,
  id: surrealExtractNumId(row.id),
  is_default: row.is_default ? 1 : 0,
});

const listPaymentMerchants = async (ownerKey) => {
  const rows = await surql(`SELECT * FROM merchants WHERE owner_key = "${sEsc(ownerKey)}" ORDER BY is_default DESC, merchant_name ASC`);
  return rows.map(_surrealNormMerchant).map(formatMerchantRow);
};

const createPaymentMerchant = async (ownerKey, payload = {}) => {
  const now = new Date().toISOString();
  const merchantName = String(payload.merchantName || '').trim();
  if (!merchantName) throw new Error('Merchant name is required.');
  const gateway = String(payload.gateway || '').trim();
  if (!gateway) throw new Error('Gateway is required.');
  const isDefault = payload.isDefault === true || payload.isDefault === 'true';
  if (isDefault) await surql(`UPDATE merchants SET is_default = false, updated_at = "${now}" WHERE owner_key = "${sEsc(ownerKey)}"`).catch(() => {});
  const numId = surrealRandIntId();
  await surqlRestPut('merchants', String(numId), {
    owner_key: ownerKey, merchant_name: merchantName, gateway,
    api_id: String(payload.apiId || '').trim(), transaction_key: String(payload.transactionKey || '').trim(),
    is_default: isDefault, status: normalizePaymentStatus(payload.status, 'Active'),
    allowed_retries: clampInteger(payload.allowedRetries, 3, 0, 999),
    retry_frequency_days: clampInteger(payload.retryFrequencyDays, 7, 1, 365),
    metadata_json: JSON.stringify(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
    created_at: now, updated_at: now,
  });
  const rows = await surql(`SELECT * FROM merchants:${numId}`);
  return formatMerchantRow(_surrealNormMerchant(rows[0] ?? { id: numId }));
};

const updatePaymentMerchant = async (ownerKey, merchantId, payload = {}) => {
  const existing = await surql(`SELECT * FROM merchants WHERE id = merchants:${merchantId} AND owner_key = "${sEsc(ownerKey)}" LIMIT 1`);
  const row = existing[0] ?? null;
  if (!row) throw new Error('Merchant not found.');
  const now = new Date().toISOString();
  const merchantName = String(payload.merchantName ?? row.merchant_name ?? '').trim();
  if (!merchantName) throw new Error('Merchant name is required.');
  const gateway = String(payload.gateway ?? row.gateway ?? '').trim();
  if (!gateway) throw new Error('Gateway is required.');
  const nextIsDefault = payload.isDefault === undefined ? !!row.is_default : payload.isDefault === true || payload.isDefault === 'true';
  if (nextIsDefault) await surql(`UPDATE merchants SET is_default = false, updated_at = "${now}" WHERE owner_key = "${sEsc(ownerKey)}"`).catch(() => {});
  await surqlRestPut('merchants', String(merchantId), {
    ...row, merchant_name: merchantName, gateway,
    api_id: String(payload.apiId ?? row.api_id ?? '').trim(),
    transaction_key: String(payload.transactionKey ?? row.transaction_key ?? '').trim(),
    is_default: nextIsDefault, status: normalizePaymentStatus(payload.status ?? row.status, 'Active'),
    allowed_retries: clampInteger(payload.allowedRetries ?? row.allowed_retries, 3, 0, 999),
    retry_frequency_days: clampInteger(payload.retryFrequencyDays ?? row.retry_frequency_days, 7, 1, 365),
    metadata_json: JSON.stringify(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : parseJsonField(row.metadata_json, {})),
    updated_at: now,
  });
  const updated = await surql(`SELECT * FROM merchants:${merchantId}`);
  return formatMerchantRow(_surrealNormMerchant(updated[0] ?? { id: merchantId }));
};

const deletePaymentMerchant = async (ownerKey, merchantId) => {
  const now = new Date().toISOString();
  await surql(`UPDATE autopay SET merchant_id = NONE, updated_at = "${now}" WHERE owner_key = "${sEsc(ownerKey)}" AND merchant_id = ${merchantId}`).catch(() => {});
  await surql(`DELETE merchants:${merchantId} WHERE owner_key = "${sEsc(ownerKey)}"`).catch(() => {});
  return true;
};

const formatProductRow = (row = {}) => ({
  id: Number(row.id),
  productName: String(row.product_name || '').trim(),
  productType: String(row.product_type || 'Service').trim() || 'Service',
  priceCents: Number(row.price_cents || 0),
  billingFrequency: normalizeFrequencyType(row.billing_frequency, 'monthly'),
  status: normalizePaymentStatus(row.status, 'Active'),
  metadata: parseJsonField(row.metadata_json, {}),
  createdAt: String(row.created_at || ''),
  updatedAt: String(row.updated_at || ''),
});

const _surrealNormProduct = (row) => ({ ...row, id: surrealExtractNumId(row.id) });

const listPaymentProducts = async (ownerKey) => {
  const rows = await surql(`SELECT * FROM products WHERE owner_key = "${sEsc(ownerKey)}" ORDER BY product_name ASC`);
  return rows.map(_surrealNormProduct).map(formatProductRow);
};

const createPaymentProduct = async (ownerKey, payload = {}) => {
  const now = new Date().toISOString();
  const productName = String(payload.productName || '').trim();
  if (!productName) throw new Error('Product name is required.');
  const numId = surrealRandIntId();
  await surqlRestPut('products', String(numId), {
    owner_key: ownerKey, product_name: productName,
    product_type: String(payload.productType || 'Service').trim() || 'Service',
    price_cents: parseMoneyToCents(payload.price, 0),
    billing_frequency: normalizeFrequencyType(payload.billingFrequency, 'monthly'),
    status: normalizePaymentStatus(payload.status, 'Active'),
    metadata_json: JSON.stringify(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
    created_at: now, updated_at: now,
  });
  const rows = await surql(`SELECT * FROM products:${numId}`);
  return formatProductRow(_surrealNormProduct(rows[0] ?? { id: numId }));
};

const updatePaymentProduct = async (ownerKey, productId, payload = {}) => {
  const existing = await surql(`SELECT * FROM products WHERE id = products:${productId} AND owner_key = "${sEsc(ownerKey)}" LIMIT 1`);
  const row = existing[0] ?? null;
  if (!row) throw new Error('Product not found.');
  const now = new Date().toISOString();
  const productName = String(payload.productName ?? row.product_name ?? '').trim();
  if (!productName) throw new Error('Product name is required.');
  await surqlRestPut('products', String(productId), {
    ...row, product_name: productName,
    product_type: String(payload.productType ?? row.product_type ?? 'Service').trim() || 'Service',
    price_cents: payload.price !== undefined ? parseMoneyToCents(payload.price, Number(row.price_cents || 0)) : Number(row.price_cents || 0),
    billing_frequency: normalizeFrequencyType(payload.billingFrequency ?? row.billing_frequency, 'monthly'),
    status: normalizePaymentStatus(payload.status ?? row.status, 'Active'),
    metadata_json: JSON.stringify(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : parseJsonField(row.metadata_json, {})),
    updated_at: now,
  });
  const updated = await surql(`SELECT * FROM products:${productId}`);
  return formatProductRow(_surrealNormProduct(updated[0] ?? { id: productId }));
};

const deletePaymentProduct = async (ownerKey, productId) => {
  const now = new Date().toISOString();
  await surql(`UPDATE autopay SET product_id = NONE, updated_at = "${now}" WHERE owner_key = "${sEsc(ownerKey)}" AND product_id = ${productId}`).catch(() => {});
  await surql(`DELETE products:${productId} WHERE owner_key = "${sEsc(ownerKey)}"`).catch(() => {});
  return true;
};

const formatAutopayRow = (row = {}) => ({
  id: Number(row.id),
  clientId: String(row.client_id || '').trim(),
  merchantId: row.merchant_id === null || row.merchant_id === undefined ? null : Number(row.merchant_id),
  productId: row.product_id === null || row.product_id === undefined ? null : Number(row.product_id),
  amountCents: Number(row.amount_cents || 0),
  frequencyType: normalizeFrequencyType(row.frequency_type, 'monthly'),
  frequencyInterval: clampInteger(row.frequency_interval, 1, 1, 365),
  nextChargeAt: String(row.next_charge_at || ''),
  status: normalizePaymentStatus(row.status, 'Active'),
  retryLimit: clampInteger(row.retry_limit, 3, 0, 999),
  retryFrequencyDays: clampInteger(row.retry_frequency_days, 7, 1, 365),
  failureCount: clampInteger(row.failure_count, 0, 0, 999999),
  lastError: String(row.last_error || '').trim(),
  lastChargeAt: String(row.last_charge_at || '').trim(),
  metadata: parseJsonField(row.metadata_json, {}),
  createdAt: String(row.created_at || ''),
  updatedAt: String(row.updated_at || ''),
});

const _surrealNormAutopay = (row) => ({ ...row, id: surrealExtractNumId(row.id) });

const listPaymentAutopay = async (ownerKey) => {
  const rows = await surql(`SELECT * FROM autopay WHERE owner_key = "${sEsc(ownerKey)}"`);
  const mapped = rows.map(_surrealNormAutopay).map(formatAutopayRow);
  return mapped.sort((a, b) => {
    const aEmpty = !a.nextChargeAt ? 1 : 0;
    const bEmpty = !b.nextChargeAt ? 1 : 0;
    if (aEmpty !== bEmpty) return aEmpty - bEmpty;
    if (a.nextChargeAt < b.nextChargeAt) return -1;
    if (a.nextChargeAt > b.nextChargeAt) return 1;
    return b.id - a.id;
  });
};

const createPaymentAutopay = async (ownerKey, payload = {}) => {
  const now = new Date().toISOString();
  const numId = surrealRandIntId();
  await surqlRestPut('autopay', String(numId), {
    owner_key: ownerKey,
    client_id: String(payload.clientId || '').trim(),
    merchant_id: payload.merchantId ? Number(payload.merchantId) : null,
    product_id: payload.productId ? Number(payload.productId) : null,
    amount_cents: parseMoneyToCents(payload.amount, 0),
    frequency_type: normalizeFrequencyType(payload.frequencyType, 'monthly'),
    frequency_interval: clampInteger(payload.frequencyInterval, 1, 1, 365),
    next_charge_at: normalizeNextChargeAt(payload.nextChargeAt),
    status: normalizePaymentStatus(payload.status, 'Active'),
    retry_limit: clampInteger(payload.retryLimit, 3, 0, 999),
    retry_frequency_days: clampInteger(payload.retryFrequencyDays, 7, 1, 365),
    failure_count: clampInteger(payload.failureCount, 0, 0, 999999),
    last_error: String(payload.lastError || '').trim(),
    last_charge_at: normalizeNextChargeAt(payload.lastChargeAt),
    metadata_json: JSON.stringify(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
    created_at: now,
    updated_at: now,
  });
  const rows = await surql(`SELECT * FROM autopay:${numId}`);
  return formatAutopayRow(_surrealNormAutopay(rows[0] ?? { id: numId }));
};

const updatePaymentAutopay = async (ownerKey, autopayId, payload = {}) => {
  const existing = await surql(`SELECT * FROM autopay WHERE id = autopay:${autopayId} AND owner_key = "${sEsc(ownerKey)}" LIMIT 1`);
  const row = existing[0] || null;
  if (!row) throw new Error('Autopay row not found.');
  const now = new Date().toISOString();
  await surqlRestPut('autopay', String(autopayId), {
    ...row,
    client_id: String(payload.clientId ?? row.client_id ?? '').trim(),
    merchant_id: payload.merchantId !== undefined ? (payload.merchantId ? Number(payload.merchantId) : null) : row.merchant_id,
    product_id: payload.productId !== undefined ? (payload.productId ? Number(payload.productId) : null) : row.product_id,
    amount_cents: payload.amount !== undefined ? parseMoneyToCents(payload.amount, Number(row.amount_cents || 0)) : Number(row.amount_cents || 0),
    frequency_type: normalizeFrequencyType(payload.frequencyType ?? row.frequency_type, 'monthly'),
    frequency_interval: clampInteger(payload.frequencyInterval ?? row.frequency_interval, 1, 1, 365),
    next_charge_at: payload.nextChargeAt !== undefined ? normalizeNextChargeAt(payload.nextChargeAt) : String(row.next_charge_at || ''),
    status: normalizePaymentStatus(payload.status ?? row.status, 'Active'),
    retry_limit: clampInteger(payload.retryLimit ?? row.retry_limit, 3, 0, 999),
    retry_frequency_days: clampInteger(payload.retryFrequencyDays ?? row.retry_frequency_days, 7, 1, 365),
    failure_count: clampInteger(payload.failureCount ?? row.failure_count, 0, 0, 999999),
    last_error: String(payload.lastError ?? row.last_error ?? '').trim(),
    last_charge_at: payload.lastChargeAt !== undefined ? normalizeNextChargeAt(payload.lastChargeAt) : String(row.last_charge_at || ''),
    metadata_json: JSON.stringify(payload.metadata && typeof payload.metadata === 'object'
      ? payload.metadata
      : parseJsonField(row.metadata_json, {})),
    updated_at: now,
  });
  const updated = await surql(`SELECT * FROM autopay:${autopayId}`);
  return formatAutopayRow(_surrealNormAutopay(updated[0] ?? { id: autopayId }));
};

const deletePaymentAutopay = async (ownerKey, autopayId) => {
  const existing = await surql(`SELECT id FROM autopay WHERE id = autopay:${autopayId} AND owner_key = "${sEsc(ownerKey)}" LIMIT 1`);
  if (!existing.length) return false;
  await surql(`DELETE autopay:${autopayId}`);
  return true;
};

const listPaymentClients = async () => {
  const store = await readStore();
  return (store.clients || []).map((client) => ({
    id: String(client.id || ''),
    name: `${String(client.firstName || '').trim()} ${String(client.lastName || '').trim()}`.trim() || 'Unnamed Client',
    email: String(client.email || '').trim(),
  }));
};

const buildPaymentsOverview = async (ownerKey) => {
  const [config, merchants, products, autopayRows, clients] = await Promise.all([
    loadPaymentConfig(ownerKey),
    listPaymentMerchants(ownerKey),
    listPaymentProducts(ownerKey),
    listPaymentAutopay(ownerKey),
    listPaymentClients(),
  ]);
  const clientNameById = new Map(clients.map((client) => [client.id, client.name]));
  const merchantNameById = new Map(merchants.map((merchant) => [merchant.id, merchant.merchantName]));
  const productNameById = new Map(products.map((product) => [product.id, product.productName]));
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const autopay = autopayRows.map((row) => ({
    ...row,
    clientName: clientNameById.get(row.clientId) || 'Unknown Client',
    merchantName: row.merchantId ? (merchantNameById.get(row.merchantId) || 'Missing Merchant') : '--',
    productName: row.productId ? (productNameById.get(row.productId) || 'Custom Charge') : 'Custom Charge',
  }));
  const summary = {
    merchantCount: merchants.length,
    productCount: products.length,
    autopayCount: autopay.length,
    activeAutopayCount: autopay.filter((entry) => entry.status === 'Active').length,
    dueIn7Days: autopay.filter((entry) => {
      if (!entry.nextChargeAt) {
        return false;
      }
      const ts = new Date(entry.nextChargeAt).valueOf();
      return Number.isFinite(ts) && ts <= (now + sevenDays);
    }).length,
  };
  return {
    ownerKey,
    config,
    merchants,
    products,
    autopay,
    clients,
    summary,
    gatewayOptions: paymentGatewayOptions,
    frequencyOptions: paymentFrequencyOptions,
  };
};

const testSquarePullForOwner = async (ownerKey, daysBack = 2) => {
  const merchants = await listPaymentMerchants(ownerKey);
  const squareMerchant = merchants.find((merchant) => {
    const gateway = String(merchant.gateway || '').trim().toLowerCase();
    return merchant.status === 'Active' && gateway === 'square';
  });

  if (!squareMerchant) {
    throw new Error('No active Square merchant found.');
  }

  const accessToken = String(squareMerchant.transactionKey || '').trim();
  if (!accessToken) {
    throw new Error('Square access token is missing on the selected merchant.');
  }

  const lookbackDays = clampInteger(daysBack, 2, 1, 30);
  const beginTime = new Date(Date.now() - (lookbackDays * 24 * 60 * 60 * 1000)).toISOString();
  const query = new URL('https://connect.squareup.com/v2/payments');
  query.searchParams.set('begin_time', beginTime);
  query.searchParams.set('sort_order', 'DESC');
  query.searchParams.set('limit', '25');

  const response = await fetch(query.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Square-Version': '2025-10-16',
      Accept: 'application/json',
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errors = Array.isArray(payload?.errors) ? payload.errors : [];
    const detail = errors.map((entry) => String(entry?.detail || entry?.code || '')).filter(Boolean).join('; ');
    throw new Error(`Square API error (${response.status})${detail ? `: ${detail}` : ''}`);
  }

  const payments = Array.isArray(payload?.payments) ? payload.payments : [];
  const sample = payments.slice(0, 5).map((entry) => {
    const amountMinor = Number(entry?.amount_money?.amount || 0);
    const currency = String(entry?.amount_money?.currency || 'USD').trim();
    const amount = `${(amountMinor / 100).toFixed(2)} ${currency}`;
    return {
      id: String(entry?.id || '').trim(),
      status: String(entry?.status || '').trim(),
      amount,
      createdAt: String(entry?.created_at || '').trim(),
    };
  });

  return {
    merchantName: squareMerchant.merchantName,
    count: payments.length,
    summary: `merchant=${squareMerchant.merchantName}, lookback=${lookbackDays}d`,
    sample,
  };
};

const parseJsonTextSafe = (value) => {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const failedPaymentGatewayTypes = new Set(['nmi', 'bankcard', 'square']);

const normalizeFailedPaymentGateway = (value = '') => {
  const gateway = String(value || '').trim().toLowerCase();
  if (!gateway) return '';
  if (gateway.includes('square')) return 'square';
  if (gateway.includes('nmi')) return 'nmi';
  if (gateway.includes('bankcard')) return 'bankcard';
  return gateway;
};

const decodeXmlEntities = (text = '') => String(text || '')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, '\'')
  .replace(/&amp;/g, '&');

const extractXmlTagValue = (xml = '', tag = '') => {
  const escaped = String(tag || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(xml || '').match(new RegExp(`<${escaped}>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return decodeXmlEntities(String(match?.[1] || '').trim());
};

const extractXmlBlocks = (xml = '', tag = '') => {
  const escaped = String(tag || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<${escaped}>([\\s\\S]*?)<\\/${escaped}>`, 'gi');
  const blocks = [];
  let match = null;
  while ((match = pattern.exec(String(xml || ''))) !== null) {
    blocks.push(String(match[1] || ''));
  }
  return blocks;
};

const formatNmiDateParam = (inputDate) => {
  const date = inputDate instanceof Date ? inputDate : new Date(inputDate);
  if (Number.isNaN(date.valueOf())) return '';
  const utcYear = date.getUTCFullYear();
  const utcMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
  const utcDay = String(date.getUTCDate()).padStart(2, '0');
  const utcHour = String(date.getUTCHours()).padStart(2, '0');
  const utcMinute = String(date.getUTCMinutes()).padStart(2, '0');
  const utcSecond = String(date.getUTCSeconds()).padStart(2, '0');
  return `${utcYear}${utcMonth}${utcDay}${utcHour}${utcMinute}${utcSecond}`;
};

const parseNmiTimestampToIso = (value = '') => {
  const raw = String(value || '').trim();
  if (!/^\d{14}$/.test(raw)) return '';
  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6)) - 1;
  const day = Number(raw.slice(6, 8));
  const hours = Number(raw.slice(8, 10));
  const minutes = Number(raw.slice(10, 12));
  const seconds = Number(raw.slice(12, 14));
  const ts = Date.UTC(year, month, day, hours, minutes, seconds);
  const date = new Date(ts);
  return Number.isNaN(date.valueOf()) ? '' : date.toISOString();
};

const normalizeFailedPaymentName = (name = '') => String(name || '')
  .replace(/\s+/g, ' ')
  .trim();

const toFailedPaymentRetryLabel = (merchant = {}) => {
  const retries = clampInteger(merchant?.allowedRetries, 3, 0, 999);
  const frequencyDays = clampInteger(merchant?.retryFrequencyDays, 7, 1, 365);
  return `${retries} / ${frequencyDays}d`;
};

const isRetryEligibleReason = (value = '') => {
  const reason = String(value || '').trim().toLowerCase();
  if (!reason) return false;
  return reason.includes('insufficient')
    || reason.includes('not sufficient')
    || reason.includes('do not honor')
    || reason.includes('expired')
    || reason.includes('declined')
    || reason.includes('limit')
    || reason.includes('exceeded')
    || reason.includes('transaction_limit')
    || reason.includes('funds');
};

const classifyNextAction = (reason = '') => (isRetryEligibleReason(reason) ? 'Retry' : 'Review');

const toFailedStatusLabel = (occurrenceCount = 1) => {
  const count = clampInteger(occurrenceCount, 1, 1, 9999);
  if (count <= 1) return 'Failed';
  return `Failed x${count}`;
};

const toMinorAmount = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const cents = parseMoneyToCents(value, 0);
  return Number.isFinite(cents) ? cents : 0;
};

const normalizeFailedPaymentEventInput = (event = {}) => {
  const transactionId = String(event.transactionId || '').trim();
  const nowIso = new Date().toISOString();
  const name = normalizeFailedPaymentName(event.clientName || '');
  const reason = String(event.failureReason || '').trim();
  const retryEligible = event.retryEligible === undefined ? isRetryEligibleReason(reason) : Boolean(event.retryEligible);
  const nextAction = String(event.nextAction || '').trim() || classifyNextAction(reason);
  return {
    transactionId,
    eventAt: String(event.eventAt || '').trim() || nowIso,
    clientName: name || 'Unknown',
    email: String(event.email || '').trim(),
    phone: String(event.phone || '').trim(),
    amountCents: toMinorAmount(event.amountCents),
    cardLast4: String(event.cardLast4 || '').trim(),
    paymentMethod: String(event.paymentMethod || '').trim(),
    failureReason: reason || 'Unknown Failure',
    retryLabel: String(event.retryLabel || '').trim(),
    notes: String(event.notes || '').trim(),
    status: String(event.status || '').trim() || 'Failed',
    nextAction,
    completed: String(event.completed || '').trim() || 'No',
    processor: String(event.processor || '').trim(),
    customerId: String(event.customerId || '').trim(),
    retryEligible,
    rawJson: event.rawJson && typeof event.rawJson === 'object' ? event.rawJson : {},
    updatedAt: nowIso,
    createdAt: String(event.createdAt || '').trim() || nowIso,
    lastSeenAt: nowIso,
  };
};

const formatFailedPaymentEventRow = (row = {}) => ({
  id: Number(row.id || 0),
  transactionId: String(row.transaction_id || '').trim(),
  eventAt: String(row.event_at || '').trim(),
  clientName: String(row.client_name || '').trim(),
  email: String(row.email || '').trim(),
  phone: String(row.phone || '').trim(),
  amountCents: Number(row.amount_cents || 0),
  amount: (Number(row.amount_cents || 0) / 100).toFixed(2),
  cardLast4: String(row.card_last4 || '').trim(),
  paymentMethod: String(row.payment_method || '').trim(),
  failureReason: String(row.failure_reason || '').trim(),
  retryLabel: String(row.retry_label || '').trim(),
  notes: String(row.notes || '').trim(),
  status: String(row.status || '').trim(),
  nextAction: String(row.next_action || '').trim(),
  completed: String(row.completed || '').trim(),
  processor: String(row.processor || '').trim(),
  customerId: String(row.customer_id || '').trim(),
  retryEligible: Number(row.retry_eligible || 0) === 1,
  occurrenceCount: Number(row.occurrence_count || 1),
  webhookSyncedAt: String(row.webhook_synced_at || '').trim(),
  webhookLastStatus: row.webhook_last_status === null || row.webhook_last_status === undefined
    ? null
    : Number(row.webhook_last_status),
  createdAt: String(row.created_at || '').trim(),
  updatedAt: String(row.updated_at || '').trim(),
  lastSeenAt: String(row.last_seen_at || '').trim(),
});

const calculateFailedPaymentOccurrenceCount = async (ownerKey, row = {}) => {
  const email = String(row.email || '').trim().toLowerCase();
  const customerId = String(row.customer_id || '').trim();
  const name = normalizeFailedPaymentName(row.client_name || '').toLowerCase();
  const all = await surql(`SELECT email, customer_id, client_name FROM payment_events WHERE owner_key = "${sEsc(ownerKey)}"`);
  if (email) {
    return Math.max(all.filter(r => String(r.email || '').trim().toLowerCase() === email).length, 1);
  }
  if (customerId) {
    return Math.max(all.filter(r => String(r.customer_id || '').trim() === customerId).length, 1);
  }
  if (name) {
    return Math.max(all.filter(r => normalizeFailedPaymentName(r.client_name || '').toLowerCase() === name).length, 1);
  }
  return 1;
};

const paymentEventRecordId = (ownerKey, transactionId) =>
  `${String(ownerKey)}_${String(transactionId)}`.replace(/[^a-zA-Z0-9_]/g, '_');

const upsertFailedPaymentEvent = async (ownerKey, event = {}) => {
  const normalizedOwnerKey = normalizeOwnerKey(ownerKey);
  const next = normalizeFailedPaymentEventInput(event);
  if (!next.transactionId) {
    return { upserted: false, reason: 'missing-transaction-id', row: null };
  }

  const recordId = paymentEventRecordId(normalizedOwnerKey, next.transactionId);
  const existingRows = await surql(`SELECT * FROM payment_events WHERE id = payment_events:${recordId} LIMIT 1`);
  const prev = existingRows[0] || null;
  const now = new Date().toISOString();

  const record = {
    owner_key: normalizedOwnerKey,
    transaction_id: next.transactionId,
    event_at: next.eventAt,
    client_name: next.clientName,
    email: next.email,
    phone: next.phone,
    amount_cents: next.amountCents,
    card_last4: next.cardLast4,
    payment_method: next.paymentMethod,
    failure_reason: next.failureReason,
    retry_label: next.retryLabel,
    notes: next.notes,
    status: next.status,
    next_action: next.nextAction,
    completed: next.completed,
    processor: next.processor,
    customer_id: next.customerId,
    retry_eligible: next.retryEligible ? 1 : 0,
    occurrence_count: prev?.occurrence_count || 1,
    webhook_synced_at: prev?.webhook_synced_at || null,
    webhook_last_status: prev?.webhook_last_status ?? null,
    created_at: prev?.created_at || next.createdAt,
    updated_at: now,
    last_seen_at: next.lastSeenAt,
  };

  await surqlRestPut('payment_events', recordId, record);

  const savedRows = await surql(`SELECT * FROM payment_events WHERE id = payment_events:${recordId} LIMIT 1`);
  const row = savedRows[0] || null;
  if (!row) return { upserted: false, reason: 'not-found-after-upsert', row: null };

  const occurrenceCount = await calculateFailedPaymentOccurrenceCount(normalizedOwnerKey, row);
  const statusLabel = toFailedStatusLabel(occurrenceCount);

  await surqlRestPut('payment_events', recordId, {
    ...record,
    occurrence_count: occurrenceCount,
    status: statusLabel,
    retry_eligible: next.retryEligible ? 1 : 0,
    next_action: next.nextAction,
    updated_at: new Date().toISOString(),
  });

  const finalRows = await surql(`SELECT * FROM payment_events WHERE id = payment_events:${recordId} LIMIT 1`);
  const finalRow = finalRows[0] || null;
  return { upserted: true, reason: 'ok', row: finalRow ? formatFailedPaymentEventRow({ ...finalRow, id: recordId }) : null };
};

const listFailedPaymentEvents = async (ownerKey, options = {}) => {
  const normalizedOwnerKey = normalizeOwnerKey(ownerKey);
  const query = String(options.query || '').trim().toLowerCase();
  const limit = clampInteger(options.limit, 500, 1, 2000);

  const rows = await surql(`SELECT * FROM payment_events WHERE owner_key = "${sEsc(normalizedOwnerKey)}" ORDER BY event_at DESC LIMIT ${limit}`);
  const formatted = rows.map(r => formatFailedPaymentEventRow({ ...r, id: String(r.id || '') }));

  if (!query) return formatted;

  return formatted.filter(event =>
    String(event.transactionId || '').toLowerCase().includes(query) ||
    String(event.clientName || '').toLowerCase().includes(query) ||
    String(event.email || '').toLowerCase().includes(query) ||
    String(event.phone || '').toLowerCase().includes(query) ||
    String(event.failureReason || '').toLowerCase().includes(query) ||
    String(event.status || '').toLowerCase().includes(query) ||
    String(event.processor || '').toLowerCase().includes(query) ||
    String(event.notes || '').toLowerCase().includes(query)
  );
};

const buildFailedPaymentPayloadFromEvent = (event = {}, options = {}) => ({
  event: 'failed_payment',
  sourceSystem: 'ninja-tools',
  source: 'ninja-tools',
  workflow: 'BTCP | Failed Payment',
  synced_at: new Date().toISOString(),
  trigger_secret: String(options.scriptTriggerSecret || '').trim(),
  transaction_id: event.transactionId || '',
  failed_at: event.eventAt || '',
  client_name: event.clientName || '',
  email: event.email || '',
  phone: event.phone || '',
  amount: Number(event.amountCents || 0) / 100,
  card_last4: event.cardLast4 || '',
  method: event.paymentMethod || '',
  reason: event.failureReason || '',
  retry_label: event.retryLabel || '',
  status: event.status || '',
  next_action: event.nextAction || '',
  completed: event.completed || 'No',
  processor: event.processor || '',
  customer_id: event.customerId || '',
  occurrence_count: Number(event.occurrenceCount || 1),
  notes: event.notes || '',
});

const sendFailedPaymentEventWebhook = async (event = {}, billingIntegration = {}) => {
  const targetUrl = String(billingIntegration.failedPaymentsWebhookUrl || '').trim();
  if (!targetUrl) {
    throw new Error('Billing webhook URL is not configured.');
  }

  const headerName = String(billingIntegration.webhookHeaderName || '').trim();
  const headerValue = String(billingIntegration.webhookHeaderValue || '').trim();
  const scriptTriggerSecret = String(billingIntegration.scriptTriggerSecret || '').trim();
  const payload = buildFailedPaymentPayloadFromEvent(event, { scriptTriggerSecret });

  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
  };
  if (headerName && headerValue) {
    headers[headerName] = headerValue;
  }
  if (scriptTriggerSecret) {
    headers['x-script-trigger-secret'] = scriptTriggerSecret;
  }

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const bodyText = await response.text().catch(() => '');

  return {
    ok: response.ok,
    status: response.status,
    body: bodyText,
    payload,
  };
};

const pullNmiLikeFailedEventsForMerchant = async (merchant = {}, daysBack = 7) => {
  const gateway = normalizeFailedPaymentGateway(merchant.gateway);
  const key = String(merchant.transactionKey || '').trim();
  if (!key) {
    return { merchantName: merchant.merchantName || gateway || 'NMI', gateway, events: [], warning: 'Missing transaction key.' };
  }

  const now = new Date();
  const lookbackDays = clampInteger(daysBack, 7, 1, 30);
  const startDate = new Date(now.valueOf() - (lookbackDays * 24 * 60 * 60 * 1000));
  const postData = new URLSearchParams({
    security_key: key,
    condition: 'failed',
    report_type: 'transaction',
    start_date: formatNmiDateParam(startDate),
    end_date: formatNmiDateParam(now),
    result_limit: '500',
  });

  const response = await fetch('https://secure.nmi.com/api/query.php', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: postData.toString(),
  });
  const xml = await response.text();
  if (!response.ok) {
    throw new Error(`${merchant.merchantName || gateway || 'NMI'} query failed [http ${response.status}]`);
  }

  const transactionBlocks = extractXmlBlocks(xml, 'transaction');
  const events = transactionBlocks.map((transactionBlock) => {
    const actionBlocks = extractXmlBlocks(transactionBlock, 'action');
    const latestAction = actionBlocks.at(-1) || '';
    const actionDate = parseNmiTimestampToIso(extractXmlTagValue(latestAction, 'date'));
    const amountText = extractXmlTagValue(latestAction, 'amount') || extractXmlTagValue(latestAction, 'requested_amount');
    const reason = extractXmlTagValue(latestAction, 'response_text')
      || extractXmlTagValue(latestAction, 'processor_response_text')
      || extractXmlTagValue(transactionBlock, 'condition')
      || 'Failed';
    const firstName = extractXmlTagValue(transactionBlock, 'first_name');
    const lastName = extractXmlTagValue(transactionBlock, 'last_name');
    const rawName = `${firstName} ${lastName}`.trim() || extractXmlTagValue(transactionBlock, 'company') || 'Unknown';
    const customerId = extractXmlTagValue(transactionBlock, 'customerid') || extractXmlTagValue(transactionBlock, 'customer_vault_id');
    const txId = extractXmlTagValue(transactionBlock, 'transaction_id');
    const fallbackEventAt = actionDate || new Date().toISOString();
    return normalizeFailedPaymentEventInput({
      transactionId: txId,
      eventAt: fallbackEventAt,
      clientName: rawName,
      email: extractXmlTagValue(transactionBlock, 'email'),
      phone: extractXmlTagValue(transactionBlock, 'phone'),
      amountCents: parseMoneyToCents(amountText || '0', 0),
      cardLast4: extractXmlTagValue(transactionBlock, 'cc_number').slice(-4),
      paymentMethod: extractXmlTagValue(transactionBlock, 'cc_type') || 'Credit Card',
      failureReason: reason,
      retryLabel: toFailedPaymentRetryLabel(merchant),
      notes: extractXmlTagValue(latestAction, 'response_code') || '',
      status: 'Failed',
      nextAction: classifyNextAction(reason),
      completed: 'No',
      processor: merchant.merchantName || (gateway === 'bankcard' ? 'Bankcard' : 'NMI'),
      customerId,
      retryEligible: isRetryEligibleReason(reason),
      rawJson: { source: 'nmi', gateway, transactionBlock, latestAction },
    });
  }).filter((event) => Boolean(event.transactionId));

  return { merchantName: merchant.merchantName || gateway || 'NMI', gateway, events };
};

const pullSquareFailedEventsForMerchant = async (merchant = {}, daysBack = 7) => {
  const key = String(merchant.transactionKey || '').trim();
  if (!key) {
    return { merchantName: merchant.merchantName || 'Square', gateway: 'square', events: [], warning: 'Missing access token.' };
  }
  const now = new Date();
  const lookbackDays = clampInteger(daysBack, 7, 1, 30);
  const beginTime = new Date(now.valueOf() - (lookbackDays * 24 * 60 * 60 * 1000)).toISOString();
  const query = new URL('https://connect.squareup.com/v2/payments');
  query.searchParams.set('begin_time', beginTime);
  query.searchParams.set('sort_order', 'DESC');
  query.searchParams.set('limit', '100');
  let cursor = '';
  const events = [];

  do {
    if (cursor) query.searchParams.set('cursor', cursor);
    else query.searchParams.delete('cursor');
    const response = await fetch(query.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${key}`,
        'Square-Version': '2026-01-22',
        Accept: 'application/json',
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errors = Array.isArray(payload?.errors) ? payload.errors : [];
      const detail = errors.map((entry) => String(entry?.detail || entry?.code || '')).filter(Boolean).join('; ');
      throw new Error(`${merchant.merchantName || 'Square'} API error (${response.status})${detail ? `: ${detail}` : ''}`);
    }

    const payments = Array.isArray(payload?.payments) ? payload.payments : [];
    for (const payment of payments) {
      if (String(payment?.status || '').toUpperCase() !== 'FAILED') continue;
      const detailsErrors = Array.isArray(payment?.card_details?.errors) ? payment.card_details.errors : [];
      const reason = String(
        detailsErrors[0]?.detail
        || detailsErrors[0]?.code
        || payment?.delay_action
        || payment?.status
        || 'FAILED',
      ).trim();
      const name = String(payment?.billing_details?.name || payment?.billing_details?.company_name || 'Unknown').trim();
      events.push(normalizeFailedPaymentEventInput({
        transactionId: String(payment?.id || '').trim(),
        eventAt: String(payment?.created_at || '').trim() || new Date().toISOString(),
        clientName: name,
        email: String(payment?.billing_details?.email_address || '').trim(),
        phone: String(payment?.billing_details?.phone_number || '').trim(),
        amountCents: Number(payment?.amount_money?.amount || 0),
        cardLast4: String(payment?.card_details?.card?.last_4 || '').trim(),
        paymentMethod: String(payment?.card_details?.card?.card_brand || 'Credit Card').trim(),
        failureReason: reason,
        retryLabel: toFailedPaymentRetryLabel(merchant),
        notes: String(detailsErrors[1]?.code || '').trim(),
        status: 'Failed',
        nextAction: classifyNextAction(reason),
        completed: 'No',
        processor: merchant.merchantName || 'Square',
        customerId: String(payment?.customer_id || '').trim(),
        retryEligible: isRetryEligibleReason(reason),
        rawJson: payment,
      }));
    }

    cursor = String(payload?.cursor || '').trim();
  } while (cursor);

  return { merchantName: merchant.merchantName || 'Square', gateway: 'square', events };
};

const runFailedPaymentPull = async (ownerKey, options = {}) => {
  const normalizedOwnerKey = normalizeOwnerKey(ownerKey);
  const dryRun = Boolean(options.dryRun);
  const daysBack = clampInteger(options.daysBack, 7, 1, 30);
  const merchantLimit = clampInteger(options.limit, 2000, 1, 5000);
  const merchants = (await listPaymentMerchants(normalizedOwnerKey))
    .filter((merchant) => merchant.status === 'Active')
    .filter((merchant) => failedPaymentGatewayTypes.has(normalizeFailedPaymentGateway(merchant.gateway)));

  const pullResults = [];
  let pulledEvents = [];
  for (const merchant of merchants) {
    const gatewayType = normalizeFailedPaymentGateway(merchant.gateway);
    try {
      let pulled = { events: [] };
      if (gatewayType === 'square') {
        pulled = await pullSquareFailedEventsForMerchant(merchant, daysBack);
      } else {
        pulled = await pullNmiLikeFailedEventsForMerchant(merchant, daysBack);
      }
      pulledEvents = pulledEvents.concat(Array.isArray(pulled.events) ? pulled.events : []);
      pullResults.push({
        merchantId: merchant.id,
        merchantName: merchant.merchantName,
        gateway: merchant.gateway,
        ok: true,
        count: Array.isArray(pulled.events) ? pulled.events.length : 0,
      });
    } catch (error) {
      pullResults.push({
        merchantId: merchant.id,
        merchantName: merchant.merchantName,
        gateway: merchant.gateway,
        ok: false,
        count: 0,
        error: error.message,
      });
    }
  }

  const dedupByTx = new Map();
  for (const event of pulledEvents) {
    const key = String(event?.transactionId || '').trim();
    if (!key) continue;
    dedupByTx.set(key, event);
  }
  const uniqueEvents = Array.from(dedupByTx.values()).slice(0, merchantLimit);

  if (dryRun) {
    return {
      dryRun: true,
      merchantsScanned: merchants.length,
      merchantResults: pullResults,
      pulledCount: pulledEvents.length,
      dedupedCount: uniqueEvents.length,
      upsertedCount: 0,
      upserts: [],
      events: uniqueEvents.map((entry) => ({
        transactionId: entry.transactionId,
        eventAt: entry.eventAt,
        clientName: entry.clientName,
        email: entry.email,
        amountCents: entry.amountCents,
        failureReason: entry.failureReason,
        status: entry.status,
        processor: entry.processor,
      })),
    };
  }

  const upserts = [];
  for (const event of uniqueEvents) {
    const result = await upsertFailedPaymentEvent(normalizedOwnerKey, event);
    upserts.push(result);
  }

  return {
    dryRun: false,
    merchantsScanned: merchants.length,
    merchantResults: pullResults,
    pulledCount: pulledEvents.length,
    dedupedCount: uniqueEvents.length,
    upsertedCount: upserts.filter((entry) => entry?.upserted).length,
    upserts,
  };
};

const fetchAddressSuggestions = async (query = '') => {
  const text = String(query || '').trim();
  if (text.length < 3) {
    return { provider: 'none', suggestions: [] };
  }

  const mapboxToken = String(
    process.env.MAPBOX_TOKEN
    || process.env.MAPBOX_PUBLIC_TOKEN
    || 'pk.eyJ1IjoiYW50aW9jaDc3IiwiYSI6ImNtcGRnNG82bTA1dGQycG4yd3ZlZTRsaHAifQ.9hEconWR_mjoR11f05oCRQ',
  ).trim();
  if (!mapboxToken) {
    return { provider: 'none', suggestions: [] };
  }

  const mapboxUrl = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json`);
  mapboxUrl.searchParams.set('access_token', mapboxToken);
  mapboxUrl.searchParams.set('country', 'us');
  mapboxUrl.searchParams.set('types', 'address');
  mapboxUrl.searchParams.set('limit', '6');

  const response = await fetch(mapboxUrl, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Mapbox address lookup failed (${response.status})`);
  }

  const payload = await response.json();
  const features = Array.isArray(payload?.features) ? payload.features : [];
  const suggestions = features.map((feature) => {
    const context = Array.isArray(feature?.context) ? feature.context : [];
    const findCtx = (prefix) => context.find((entry) => String(entry?.id || '').startsWith(prefix)) || null;
    const cityCtx = findCtx('place.') || findCtx('locality.');
    const stateCtx = findCtx('region.');
    const zipCtx = findCtx('postcode.');
    const houseNumber = String(feature?.address || feature?.properties?.address || '').trim();
    const streetName = String(feature?.text || '').trim();
    const stateCode = String(stateCtx?.short_code || stateCtx?.text || '').trim().toUpperCase();
    const normalizedState = stateCode.startsWith('US-') ? stateCode.slice(3) : stateCode;
    return {
      label: String(feature?.place_name || '').trim(),
      street: [houseNumber, streetName].filter(Boolean).join(' ').trim() || streetName,
      city: String(cityCtx?.text || '').trim(),
      state: normalizedState,
      zip: String(zipCtx?.text || '').trim(),
    };
  }).filter((entry) => entry.label);

  return { provider: 'mapbox', suggestions };
};

const upsertClientToGoHighLevelContact = async (client, integrations = null) => {
  const loadedIntegrations = integrations || await loadIntegrations();
  const apiToken = String(loadedIntegrations.gohighlevel?.apiToken || '').trim();
  const locationId = String(loadedIntegrations.gohighlevel?.locationId || '').trim();

  if (!apiToken || !locationId) {
    throw new Error('GoHighLevel API token or location ID is not configured yet.');
  }

  if (!String(client.phone || '').trim() && !String(client.email || '').trim()) {
    throw new Error('This client needs a phone number or email before syncing to GoHighLevel.');
  }

  const payload = {
    firstName: client.firstName || '',
    lastName: client.lastName || '',
    email: client.email || '',
    phone: client.phone || '',
    locationId,
    source: 'Ninja Tools',
    tags: ['Ninja Tools'],
  };

  const response = await fetch('https://services.leadconnectorhq.com/contacts/upsert', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${apiToken}`,
      'content-type': 'application/json',
      version: '2021-07-28',
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text().catch(() => '');
  const parsed = parseJsonTextSafe(responseText) || {};

  if (!response.ok) {
    throw new Error(parsed.message || parsed.error || `GoHighLevel contact upsert failed (${response.status}).`);
  }

  return {
    ok: true,
    status: response.status,
    body: responseText,
    parsed,
    locationId,
    contactId: String(parsed.contact?.id || parsed.id || '').trim(),
  };
};

const sendTextMessageViaGoHighLevel = async (client, message, attachments = [], requestOrigin = '') => {
  const normalizedMessage = String(message || '').trim();
  if (!normalizedMessage) {
    throw new Error('Please enter a text message first.');
  }

  const normalizedAttachments = Array.isArray(attachments)
    ? attachments
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .map((value) => {
        if (value.startsWith('/') && requestOrigin) {
          return `${requestOrigin}${value}`;
        }
        return value;
      })
    : [];
  const attachmentSuffix = normalizedAttachments.length
    ? `\n\nAttachments:\n${normalizedAttachments.join('\n')}`
    : '';
  const outboundMessage = `${normalizedMessage}${attachmentSuffix}`;

  if (!String(client.phone || '').trim()) {
    throw new Error('This client needs a phone number before you can send a text.');
  }

  const integrations = await loadIntegrations();
  const apiToken = String(integrations.gohighlevel?.apiToken || '').trim();
  const locationId = String(integrations.gohighlevel?.locationId || '').trim();
  const outboundWebhookUrl = String(integrations.gohighlevel?.outboundWebhookUrl || '').trim();

  if (!apiToken || !locationId) {
    if (!outboundWebhookUrl) {
      throw new Error('GoHighLevel texting is not configured yet.');
    }

    const webhookPayload = {
      event: 'ninja-tools.outbound.sms',
      sourceSystem: 'ninja-tools',
      source: 'ninja-tools',
      message: outboundMessage,
      attachments: normalizedAttachments,
      ninjaToolsClientId: client.id,
      client: {
        id: client.id,
        firstName: client.firstName || '',
        lastName: client.lastName || '',
        email: client.email || '',
        phone: client.phone || '',
        ghlContactId: client.ghlContactId || '',
        ghlLocationId: client.ghlLocationId || '',
      },
    };

    const webhookResponse = await fetch(outboundWebhookUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    const webhookBody = await webhookResponse.text().catch(() => '');
    const webhookParsed = parseJsonTextSafe(webhookBody) || {};
    if (!webhookResponse.ok) {
      throw new Error(
        webhookParsed.message
        || webhookParsed.error
        || `GoHighLevel webhook text send failed (${webhookResponse.status}).`,
      );
    }

    return {
      ok: true,
      mode: 'webhook',
      status: webhookResponse.status,
      body: webhookBody,
      parsed: webhookParsed,
      locationId: '',
      contactId: String(client.ghlContactId || '').trim(),
      conversationId: String(webhookParsed.conversationId || '').trim(),
      messageId: String(webhookParsed.messageId || '').trim(),
      upsertResult: null,
    };
  }

  let contactId = String(client.ghlContactId || '').trim();
  let upsertResult = null;
  if (!contactId) {
    upsertResult = await upsertClientToGoHighLevelContact(client, integrations);
    contactId = upsertResult.contactId;
  }

  if (!contactId) {
    throw new Error('GoHighLevel did not return a contact ID for this client.');
  }

  const response = await fetch('https://services.leadconnectorhq.com/conversations/messages', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${apiToken}`,
      'content-type': 'application/json',
      version: '2023-02-21',
    },
    body: JSON.stringify({
      type: 'SMS',
      contactId,
      locationId,
      message: outboundMessage,
    }),
  });

  const responseText = await response.text().catch(() => '');
  const parsed = parseJsonTextSafe(responseText) || {};

  if (!response.ok) {
    throw new Error(parsed.message || parsed.error || `GoHighLevel text send failed (${response.status}).`);
  }

  return {
    ok: true,
    mode: 'api',
    status: response.status,
    body: responseText,
    parsed,
    locationId,
    contactId,
    conversationId: String(parsed.conversationId || '').trim(),
    messageId: String(parsed.messageId || '').trim(),
    attachments: normalizedAttachments,
    upsertResult,
  };
};

const pushLearningContextToGoHighLevel = async ({ ownerKey = '', context = null, contextPublicUrl = '' } = {}) => {
  if (!context || typeof context !== 'object') {
    throw new Error('Learning context payload is required.');
  }

  const integrations = await loadIntegrations();
  const outboundWebhookUrl = String(integrations.gohighlevel?.outboundWebhookUrl || '').trim();
  if (!outboundWebhookUrl) {
    return {
      ok: false,
      mode: 'none',
      error: 'GoHighLevel outbound webhook URL is not configured.',
    };
  }

  const client = context?.client && typeof context.client === 'object' ? context.client : {};
  const selectedAccount = context?.selectedAccount && typeof context.selectedAccount === 'object'
    ? context.selectedAccount
    : {};
  const selectedBureauSummaries = context?.selectedBureauSummaries && typeof context.selectedBureauSummaries === 'object'
    ? context.selectedBureauSummaries
    : {};

  const payload = {
    event: 'ninja-tools.learning-context',
    sourceSystem: 'ninja-tools',
    source: 'ninjatools-learning',
    ownerKey: String(ownerKey || '').trim(),
    generatedAt: new Date().toISOString(),
    contextPublicUrl: String(contextPublicUrl || '').trim(),
    client: {
      id: String(client.id || '').trim(),
      firstName: String(client.firstName || '').trim(),
      lastName: String(client.lastName || '').trim(),
      email: String(client.email || '').trim(),
      phone: String(client.phone || '').trim(),
      monitoringAgency: String(client.monitoringAgency || '').trim(),
    },
    selectedAccount: {
      id: String(selectedAccount.id || '').trim(),
      creditorName: String(selectedAccount.creditorName || '').trim(),
      accountNumber: String(selectedAccount.accountNumber || '').trim(),
      source: String(context?.source || '').trim(),
    },
    selectedBureauSummaries,
    context,
  };

  const webhookResponse = await fetch(outboundWebhookUrl, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const bodyText = await webhookResponse.text().catch(() => '');
  const parsed = parseJsonTextSafe(bodyText) || {};
  if (!webhookResponse.ok) {
    throw new Error(
      parsed.message
      || parsed.error
      || `GoHighLevel learning-context webhook failed (${webhookResponse.status}).`,
    );
  }

  return {
    ok: true,
    mode: 'webhook-context',
    status: webhookResponse.status,
    body: bodyText,
    parsed,
  };
};

const sendTextMessageViaBlueBubbles = async (client, message, attachments = [], requestOrigin = '') => {
  const normalizedMessage = String(message || '').trim();
  if (!normalizedMessage) {
    throw new Error('Please enter a text message first.');
  }

  const normalizedAttachments = Array.isArray(attachments)
    ? attachments
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .map((value) => {
        if (value.startsWith('/') && requestOrigin) {
          return `${requestOrigin}${value}`;
        }
        return value;
      })
    : [];
  const attachmentSuffix = normalizedAttachments.length
    ? `\n\nAttachments:\n${normalizedAttachments.join('\n')}`
    : '';
  const outboundMessage = `${normalizedMessage}${attachmentSuffix}`;

  const rawPhone = String(client.phone || '').trim();
  if (!rawPhone) {
    throw new Error('This client needs a phone number before you can send a text.');
  }

  const phoneDigits = rawPhone.replace(/\D+/g, '');
  const e164Phone = phoneDigits.length === 11 && phoneDigits.startsWith('1')
    ? `+${phoneDigits}`
    : phoneDigits.length === 10
      ? `+1${phoneDigits}`
      : rawPhone.startsWith('+')
        ? rawPhone
        : `+${phoneDigits || rawPhone}`;

  const blueBubblesPassword = String(process.env.BLUEBUBBLES_PASSWORD || 'Texas123').trim() || 'Texas123';
  const configuredBase = String(process.env.BLUEBUBBLES_BASE_URL || 'https://credit-repair.besttexascreditpros.com').trim().replace(/\/+$/, '');
  const blueBubblesBases = [
    configuredBase || 'https://credit-repair.besttexascreditpros.com',
  ].filter(Boolean);
  const chatGuid = `iMessage;+;${e164Phone}`;
  const tempGuid = `temp-test-${Date.now()}`;
  const requestPayload = {
    chatGuid,
    tempGuid,
    message: outboundMessage,
    method: 'apple-script',
    subject: '',
    effectId: '',
    selectedMessageGuid: '',
  };

  let response = null;
  let responseText = '';
  let parsed = {};
  let lastError = null;
  let lastEndpoint = '';

  for (const base of blueBubblesBases) {
    const endpoint = `${base}/api/v1/message/text?password=${encodeURIComponent(blueBubblesPassword)}`;
    lastEndpoint = endpoint;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });
      responseText = await response.text().catch(() => '');
      parsed = parseJsonTextSafe(responseText) || {};

      const isCloudflareChallenge = response.status === 403 && /cf-mitigated|just a moment|challenges\.cloudflare\.com/i.test(responseText);
      if (isCloudflareChallenge) {
        lastError = new Error(`Cloudflare challenge blocked BlueBubbles at ${base} (http 403).`);
        continue;
      }

      const apiMessage = String(parsed.message || parsed.data?.message || '').trim();
      const apiError = String(parsed.error?.error || parsed.error?.type || parsed.error || '').trim();
      if (!response.ok) {
        lastError = new Error(
          apiError
          || apiMessage
          || parsed.message
          || parsed.error?.error
          || `BlueBubbles text send failed (${response.status}).`,
        );
        continue;
      }
      lastError = null;
      break;
    } catch (error) {
      const reason = String(error?.message || '').trim() || 'Unknown network error';
      lastError = new Error(`BlueBubbles server is unreachable at ${base} (${reason}).`);
    }
  }

  if (lastError) {
    throw new Error(`${lastError.message} Last endpoint: ${lastEndpoint}`);
  }
  const apiMessage = String(parsed.message || parsed.data?.message || '').trim();
  const confirmedGuid = String(
    parsed.data?.guid
    || parsed.data?.messageGuid
    || parsed.data?._id
    || parsed.data?.id
    || parsed.guid
    || parsed.messageGuid
    || parsed.id
    || '',
  ).trim();

  return {
    ok: true,
    mode: 'bluebubbles',
    status: response.status,
    body: responseText,
    parsed,
    locationId: '',
    contactId: '',
    conversationId: String(parsed.data?.chatGuid || chatGuid || '').trim(),
    messageId: confirmedGuid || tempGuid,
    attachments: normalizedAttachments,
    upsertResult: null,
    providerMessage: apiMessage || 'BlueBubbles accepted message.',
    requestPayload,
  };
};

const shouldFallbackToGoHighLevelForText = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('bluebubbles server is unreachable')
    || message.includes('fetch failed')
    || message.includes('econnrefused')
    || message.includes('ehostunreach')
    || message.includes('enotfound')
  );
};

const sendClientToGoHighLevelWebhook = async (client, options = {}) => {
  const integrations = await loadIntegrations();
  const apiToken = String(integrations.gohighlevel?.apiToken || '').trim();
  const locationId = String(integrations.gohighlevel?.locationId || '').trim();
  if (apiToken && locationId) {
    try {
      const result = await upsertClientToGoHighLevelContact(client, integrations);
      return {
        attempted: true,
        mode: 'api',
        ok: true,
        status: result.status,
        body: result.body,
        contactId: result.contactId,
        locationId: result.locationId,
      };
    } catch (error) {
      return {
        attempted: true,
        mode: 'api',
        ok: false,
        status: 0,
        body: '',
        error: error.message,
      };
    }
  }

  const targetUrl = String(integrations.gohighlevel?.outboundWebhookUrl || '').trim();
  if (!targetUrl) {
    return { attempted: false, reason: 'missing-webhook-url-or-api-config' };
  }

  const payload = {
    event: options.event || 'client.created',
    sourceSystem: 'ninja-tools',
    source: 'ninja-tools',
    ninjaToolsClientId: client.id,
    client: {
      id: client.id,
      firstName: client.firstName || '',
      lastName: client.lastName || '',
      email: client.email || '',
      phone: client.phone || '',
      status: client.status || '',
      goal: client.goal || '',
      monitoringAgency: client.monitoringAgency || '',
      monitoringUsername: client.monitoringUsername || '',
      monitoringPassword: client.monitoringPassword || '',
      yearlyIncome: client.yearlyIncome || '',
      housingPayment: client.housingPayment || '',
      debtMonthlyPayments: client.debtMonthlyPayments || '',
      notes: client.notes || '',
      reportDate: client.reportDate || '',
      createdAt: client.createdAt || '',
    },
  };

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text().catch(() => '');
  return {
    attempted: true,
    mode: 'webhook',
    ok: response.ok,
    status: response.status,
    body: responseText,
  };
};

const normalizeNinjaDisputeApiBaseUrl = (value = '') => {
  const fallback = 'https://api.ninjadispute.com';
  const raw = String(value || fallback).trim();
  return (raw || fallback).replace(/\/+$/g, '');
};

const ninjaDisputeApiRequest = async ({
  baseUrl,
  path,
  method = 'GET',
  token = '',
  body = null,
  timeoutMs = 30000,
}) => {
  const target = `${normalizeNinjaDisputeApiBaseUrl(baseUrl)}${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(target, {
      method,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const responseText = await response.text().catch(() => '');
    const parsed = parseJsonTextSafe(responseText) || {};
    if (!response.ok) {
      const details = String(parsed.error || parsed.message || responseText || '').replace(/\s+/g, ' ').trim();
      throw new Error(`NinjaDispute API ${method} ${path} failed (${response.status})${details ? ` - ${details.slice(0, 260)}` : ''}`);
    }
    return parsed;
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const loginNinjaDisputeReadOnly = async (integration = {}) => {
  const baseUrl = normalizeNinjaDisputeApiBaseUrl(integration.baseUrl);
  const email = String(integration.email || appLoginUsername || '').trim();
  const password = String(integration.password || appLoginPassword || '').trim();
  if (!email || !password) {
    throw new Error('NinjaDispute read-only integration requires email and password.');
  }
  const result = await ninjaDisputeApiRequest({
    baseUrl,
    path: '/auth/login',
    method: 'POST',
    body: { email, password },
    timeoutMs: 35000,
  });
  const token = String(result.token || '').trim();
  if (!token) {
    throw new Error('NinjaDispute login succeeded but no bearer token was returned.');
  }
  return {
    baseUrl,
    token,
  };
};

const fetchNinjaDisputeClientSearchPage = async (auth, searchTerm = '') => {
  const query = new URLSearchParams({
    sortBy: 'nextReminder',
    descending: 'true',
    pageNumber: '1',
    searchParam: String(searchTerm || ''),
  });
  const payload = await ninjaDisputeApiRequest({
    baseUrl: auth.baseUrl,
    path: `/clients?${query.toString()}`,
    method: 'GET',
    token: auth.token,
  });
  return ensureArray(payload?.clients);
};

const pickBestNinjaDisputeClientMatch = (remoteClients = [], localClient = {}) => {
  if (!remoteClients.length) {
    return null;
  }
  const localEmail = normalizeLookupValue(localClient.email);
  const localPhone = normalizeLookupPhone(localClient.phone);
  const localFirst = normalizeLookupValue(localClient.firstName);
  const localLast = normalizeLookupValue(localClient.lastName);

  const scored = remoteClients.map((remoteClient) => {
    let score = 0;
    const remoteEmail = normalizeLookupValue(remoteClient.email);
    const remotePhone = normalizeLookupPhone(remoteClient.phone);
    const remoteFirst = normalizeLookupValue(remoteClient.first_name || remoteClient.firstName);
    const remoteLast = normalizeLookupValue(remoteClient.last_name || remoteClient.lastName);
    if (localEmail && remoteEmail && localEmail === remoteEmail) {
      score += 60;
    }
    if (localPhone && remotePhone && localPhone === remotePhone) {
      score += 45;
    }
    if (localFirst && remoteFirst && localFirst === remoteFirst) {
      score += 18;
    }
    if (localLast && remoteLast && localLast === remoteLast) {
      score += 18;
    }
    return { remoteClient, score };
  }).sort((a, b) => b.score - a.score);

  if (!scored.length || scored[0].score <= 0) {
    return null;
  }
  return scored[0].remoteClient;
};

const extractDerogatoryAccountsFromNinjaDisputeClient = (clientPayload = {}) => {
  const remoteJson = clientPayload?.json || {};
  const cachedRows = parseDerogatoryAccountsFromNinjaDisputeRows(remoteJson.accounts);
  if (cachedRows.length) {
    return {
      accounts: cachedRows,
      source: 'ninjadispute-json-accounts',
    };
  }

  const reportDataEntries = ensureArray(remoteJson.data);
  for (const entry of reportDataEntries) {
    const byPartitions = parseDerogatoryAccountsFromPartitions(entry?.TradeLinePartition);
    if (byPartitions.length) {
      return {
        accounts: byPartitions,
        source: 'ninjadispute-reportdata-tradelinepartition',
      };
    }

    const originParsed = parseJsonValue(entry?.origin);
    if (originParsed) {
      const byOrigin = parseDerogatoryAccountsFromJson(originParsed);
      if (byOrigin.length) {
        return {
          accounts: byOrigin,
          source: 'ninjadispute-reportdata-origin',
        };
      }
    }
  }

  return {
    accounts: [],
    source: 'ninjadispute-no-derogatory-found',
  };
};

const pullDerogatoryAccountsFromNinjaDispute = async (integration = {}, localClient = {}) => {
  const auth = await loginNinjaDisputeReadOnly(integration);
  const searchTerms = [
    String(localClient.email || '').trim(),
    `${localClient.firstName || ''} ${localClient.lastName || ''}`.trim(),
    normalizeLookupPhone(localClient.phone || ''),
  ].filter(Boolean);

  const seenIds = new Set();
  const candidateClients = [];
  for (const term of searchTerms) {
    const rows = await fetchNinjaDisputeClientSearchPage(auth, term);
    for (const row of rows) {
      const id = String(row?.id || '').trim();
      if (!id || seenIds.has(id)) {
        continue;
      }
      seenIds.add(id);
      candidateClients.push(row);
    }
  }

  const matchedClient = pickBestNinjaDisputeClientMatch(candidateClients, localClient);
  if (!matchedClient?.id) {
    throw new Error('No matching NinjaDispute client was found for this contact.');
  }

  const remoteClientPayload = await ninjaDisputeApiRequest({
    baseUrl: auth.baseUrl,
    path: `/clients/${matchedClient.id}?all=true`,
    method: 'GET',
    token: auth.token,
    timeoutMs: 35000,
  });

  const extracted = extractDerogatoryAccountsFromNinjaDisputeClient(remoteClientPayload);
  return {
    accounts: extracted.accounts,
    source: extracted.source,
    matchedClient: {
      id: String(matchedClient.id || ''),
      firstName: String(matchedClient.first_name || matchedClient.firstName || '').trim(),
      lastName: String(matchedClient.last_name || matchedClient.lastName || '').trim(),
      email: String(matchedClient.email || '').trim(),
      phone: String(matchedClient.phone || '').trim(),
    },
  };
};

const loginConsumerDirectAtEnvironment = async (environment, integration) => {
  const clientKey = String(integration?.tokenId || '').trim();
  const clientSecret = String(integration?.apiSecret || '').trim();
  if (!clientKey || !clientSecret) {
    throw new Error('SmartCredit client key and client secret are required.');
  }

  const authHeader = `Basic ${Buffer.from(`${clientKey}:${clientSecret}`, 'utf8').toString('base64')}`;
  const tokenBody = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: `target-entity:${environment.scopeTargetEntity}`,
  }).toString();

  const response = await fetch(environment.authUrl, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
      authorization: authHeader,
    },
    body: tokenBody,
  });

  const text = await response.text();
  const parsed = parseJsonValue(text) || {};
  if (!response.ok) {
    const bodyPreview = text.replace(/\s+/g, ' ').trim().slice(0, 220);
    throw new Error(`SmartCredit OAuth token failed (${response.status})${bodyPreview ? ` - ${bodyPreview}` : ''}`);
  }

  const jwt = String(
    parsed.access_token
    || parsed.token
    || parsed.jwt
    || parsed.accessToken
    || '',
  ).trim();
  if (!jwt) {
    throw new Error('SmartCredit OAuth succeeded but no access_token was returned.');
  }

  return {
    baseUrl: environment.apiBaseUrl,
    jwt,
    tokenType: String(parsed.token_type || 'Bearer').trim() || 'Bearer',
    scope: String(parsed.scope || '').trim(),
    environment: environment.name,
  };
};

const loginConsumerDirect = async (integration) => {
  let lastError = null;
  for (const environment of consumerDirectEnvironments) {
    try {
      return await loginConsumerDirectAtEnvironment(environment, integration);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('SmartCredit Partner API login failed.');
};

const requestSmartCreditAccessToken = async (integration) => {
  const clientId = String(integration?.tokenId || '').trim();
  const clientSecret = String(integration?.apiSecret || '').trim();
  if (!clientId || !clientSecret) {
    throw new Error('SmartCredit API credentials are required.');
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams();
  body.set('grant_type', 'client_credentials');
  body.set('scope', `target-entity:${smartCreditTargetEntityId}`);

  const authUrl = new URL('/oauth2/token', smartCreditAuthBaseUrl);
  const requestBody = body.toString();
  const responsePayload = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: authUrl.protocol,
        hostname: authUrl.hostname,
        port: authUrl.port || 443,
        path: `${authUrl.pathname}${authUrl.search}`,
        method: 'POST',
        family: 4,
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': 'BestTexasCreditPros-Server/1.0 (+https://besttexascreditpros.com)',
          'Content-Length': Buffer.byteLength(requestBody),
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          resolve({ statusCode: Number(res.statusCode || 0), body: raw });
        });
      },
    );
    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });

  const parsed = parseJsonValue(responsePayload.body) || {};
  const accessToken = String(parsed.access_token || '').trim();
  if (responsePayload.statusCode < 200 || responsePayload.statusCode >= 300 || !accessToken) {
    throw new Error(parsed.error_description || parsed.error || `SmartCredit OAuth2 failed (${responsePayload.statusCode})`);
  }

  return accessToken;
};

const requestSmartCreditCustomersByEmail = async (accessToken, email) => {
  const token = String(accessToken || '').trim();
  const emailValue = String(email || '').trim();
  if (!token || !emailValue) {
    throw new Error('SmartCredit access token and email are required for customer lookup.');
  }

  const targetUrl = new URL('/v1/customers', smartCreditPartnerBaseUrl);
  targetUrl.searchParams.set('email', emailValue);

  const responsePayload = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port || 443,
        path: `${targetUrl.pathname}${targetUrl.search}`,
        method: 'GET',
        family: 4,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          resolve({ statusCode: Number(res.statusCode || 0), body: raw });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });

  const parsed = parseJsonValue(responsePayload.body) || {};
  if (responsePayload.statusCode < 200 || responsePayload.statusCode >= 300) {
    throw new Error(parsed.message || parsed.error || `SmartCredit customer lookup failed (${responsePayload.statusCode})`);
  }

  return {
    url: targetUrl.toString(),
    text: responsePayload.body,
    json: parsed,
  };
};

const requestSmartCreditLoginCode = async (accessToken, customerToken) => {
  const token = String(accessToken || '').trim();
  const customer = String(customerToken || '').trim();
  if (!token || !customer) {
    throw new Error('SmartCredit access token and customer token are required.');
  }

  // Keep this in the same structure as the proven manual curl run (including IPv4).
  console.log(
    [
      'SmartCredit OTC login-as request command:',
      `curl -i -X POST "https://papi.consumerdirect.io/v1/customers/${encodeURIComponent(customer)}/otcs/login-as" \\`,
      '  -H "Authorization: Bearer $TOKEN" \\',
      '  -H "Content-Type: application/json" \\',
      '  -H "User-Agent: BestTexasCreditPros-Server/1.0 (+https://besttexascreditpros.com)" \\',
      '  -H "Accept: application/json" \\',
      '  -H "Accept-Language: en-US,en;q=0.9" \\',
      '  --ipv4 \\',
      `  -d '{"agentId": "${smartCreditAgentId}"}'`,
    ].join('\n'),
  );

  const targetUrl = new URL(
    `/v1/customers/${encodeURIComponent(customer)}/otcs/login-as`,
    smartCreditPartnerBaseUrl,
  );
  const requestBody = JSON.stringify({ agentId: smartCreditAgentId });
  const responsePayload = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port || 443,
        path: `${targetUrl.pathname}${targetUrl.search}`,
        method: 'POST',
        family: 4,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'BestTexasCreditPros-Server/1.0 (+https://besttexascreditpros.com)',
          Accept: 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Content-Length': Buffer.byteLength(requestBody),
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          resolve({ statusCode: Number(res.statusCode || 0), body: raw });
        });
      },
    );
    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });

  const parsed = parseJsonValue(responsePayload.body) || {};
  const code = String(parsed.code || parsed.otc || parsed.otp || '').trim();
  if (responsePayload.statusCode < 200 || responsePayload.statusCode >= 300 || !code) {
    const firstError = Array.isArray(parsed.errors) && parsed.errors.length
      ? parsed.errors[0]
      : null;
    const errorCode = String(firstError?.code || '').trim();
    const errorMessage = String(firstError?.message || '').trim();
    const reason = errorMessage || parsed.message || parsed.error || '';
    throw new Error(
      reason
        ? `SmartCredit OTC login-as failed (${responsePayload.statusCode}): ${errorCode ? `${errorCode} - ` : ''}${reason}`
        : `SmartCredit OTC login-as failed (${responsePayload.statusCode})`,
    );
  }

  return code;
};

const requestSmartCreditJwt = async (code) => {
  const otcCode = String(code || '').trim();
  if (!otcCode) {
    throw new Error('SmartCredit OTC code is required.');
  }

  const targetUrl = new URL('/v1/login', smartCreditApiBaseUrl);
  targetUrl.searchParams.set('code', otcCode);

  const responsePayload = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port || 443,
        path: `${targetUrl.pathname}${targetUrl.search}`,
        method: 'GET',
        family: 4,
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: 'https://www.smartcredit.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          resolve({ statusCode: Number(res.statusCode || 0), body: raw });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });

  const parsed = parseJsonValue(responsePayload.body) || {};
  const jwt = String(
    parsed?.token
    || parsed?.jwt
    || parsed?.accessToken
    || parsed?.data?.token
    || parsed?.data?.jwt
    || '',
  ).trim();
  if (responsePayload.statusCode < 200 || responsePayload.statusCode >= 300 || !jwt) {
    throw new Error(parsed.message || parsed.error || `SmartCredit JWT login failed (${responsePayload.statusCode})`);
  }

  return jwt;
};

const requestSmartCreditJwtViaIntegration = async (customerToken) => {
  const customer = String(customerToken || '').trim();
  if (!customer) {
    throw new Error('SmartCredit customer token is required.');
  }

  const response = await fetch(`${smartCreditIntegrationBaseUrl}/smartcredit/token/${encodeURIComponent(customer)}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'user-agent': 'BestTexasCreditPros-Server/1.0',
    },
  });

  const text = await response.text();
  const parsed = parseJsonValue(text) || {};
  const jwt = String(parsed.smartCreditToken || parsed.token || parsed.jwt || '').trim();
  if (!response.ok || !jwt) {
    throw new Error(parsed.error || parsed.detail || parsed.message || `SmartCreditIntegration token flow failed (${response.status})`);
  }
  return jwt;
};

const smartCreditApiRequest = async ({ jwt, path, method = 'GET', body }) => {
  const token = String(jwt || '').trim();
  if (!token) {
    throw new Error('SmartCredit JWT is required.');
  }
  const url = new URL(path, smartCreditApiBaseUrl);
  const requestBody = body ? JSON.stringify(body) : '';
  const responsePayload = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method,
        family: 4,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'BestTexasCreditPros-Server/1.0 (+https://besttexascreditpros.com)',
          Accept: 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          ...(requestBody ? { 'Content-Length': Buffer.byteLength(requestBody) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          resolve({ statusCode: Number(res.statusCode || 0), body: raw });
        });
      },
    );
    req.on('error', reject);
    if (requestBody) {
      req.write(requestBody);
    }
    req.end();
  });

  const json = parseJsonValue(responsePayload.body);
  if (responsePayload.statusCode < 200 || responsePayload.statusCode >= 300) {
    throw new Error((json && (json.message || json.error)) || `SmartCredit API request failed (${responsePayload.statusCode})`);
  }
  return { url: url.toString(), text: responsePayload.body, json };
};

const extractSmartCreditCustomerTokenFromLookup = (payload = {}) => {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.customers)
      ? payload.customers
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
  for (const row of rows) {
    const candidate = String(
      row?.customerToken
      || row?.customer_token
      || row?.token
      || row?.id
      || '',
    ).trim();
    if (candidate) {
      return candidate;
    }
  }
  return '';
};

const runSmartCreditTokenFlow = async (integration, customerToken, forcePaid = false, customerEmail = '') => {
  let accessToken = await requestSmartCreditAccessToken(integration);
  let code = '';
  let jwt = '';
  let tokenSource = 'integration';
  let customerLookup = null;
  let effectiveCustomerToken = String(customerToken || '').trim();

  // Only use email lookup when there is no client token.
  if (!effectiveCustomerToken && String(customerEmail || '').trim()) {
    console.log(
      [
        'SmartCredit customer lookup request command:',
        'curl -X GET "https://papi.consumerdirect.io/v1/customers?email=<selected-client-email>" \\',
        '  -H "Accept: application/json" \\',
        '  -H "Authorization: Bearer $ACCESS_TOKEN" \\',
        '  --ipv4',
      ].join('\n'),
    );
    customerLookup = await requestSmartCreditCustomersByEmail(accessToken, customerEmail).catch(() => null);
    if (!effectiveCustomerToken && customerLookup?.json) {
      effectiveCustomerToken = extractSmartCreditCustomerTokenFromLookup(customerLookup.json);
    }
  }

  if (!effectiveCustomerToken) {
    throw new Error('Missing SmartCredit customer token for selected client.');
  }

  try {
    jwt = await requestSmartCreditJwtViaIntegration(effectiveCustomerToken);
  } catch (integrationError) {
    tokenSource = 'native-fallback';
    code = await requestSmartCreditLoginCode(accessToken, effectiveCustomerToken);
    jwt = await requestSmartCreditJwt(code);
    console.log(`-> SmartCreditIntegration unavailable, used native fallback: ${integrationError.message}`);
  }

  const statement = await smartCreditApiRequest({
    jwt,
    path: '/v1/customer/statement',
  });

  const remaining = Number(
    statement?.json?.threeBureauReportRemainingCount
    ?? statement?.json?.data?.threeBureauReportRemainingCount
    ?? statement?.json?.customer?.threeBureauReportRemainingCount
    ?? 0,
  );

  if (!Number.isFinite(remaining) || remaining < 1) {
    const noRemainingError = new Error('SmartCredit statement shows no remaining three-bureau reports.');
    noRemainingError.smartCreditContext = {
      jwt,
      effectiveCustomerToken,
      tokenSource,
      statementUrl: statement?.url || '',
    };
    throw noRemainingError;
  }

  const ordered = await smartCreditApiRequest({
    jwt,
    path: '/v1/credit/3bs',
    method: 'POST',
    body: { isNonPaid: true },
  });

  const billingType = String(
    ordered?.json?.billingType
    || ordered?.json?.data?.billingType
    || '',
  ).trim();

  const current = await smartCreditApiRequest({
    jwt,
    path: '/v1/credit/3bs/current',
  });

  if (!hasNonEmptyJsonPayload(current?.json, current?.text)) {
    throw new Error('SmartCredit current report returned empty JSON payload.');
  }

  return {
    accessToken,
    jwt,
    code,
    tokenSource,
    customerLookup,
    effectiveCustomerToken,
    statement,
    ordered,
    current,
    billingType,
    remainingCount: remaining,
  };
};

const parseSmartCreditNewestOrderId = (payload) => {
  const root = payload && typeof payload === 'object' ? payload : {};
  const candidates = []
    .concat(Array.isArray(root) ? root : [])
    .concat(Array.isArray(root.orders) ? root.orders : [])
    .concat(Array.isArray(root.items) ? root.items : [])
    .concat(Array.isArray(root.data) ? root.data : [])
    .filter((row) => row && typeof row === 'object');

  if (!candidates.length) return '';

  const getTime = (row) => Date.parse(
    String(
      row.createdAt
      || row.created_at
      || row.updatedAt
      || row.updated_at
      || row.reportDate
      || row.date
      || '',
    ),
  ) || 0;

  candidates.sort((a, b) => getTime(b) - getTime(a));
  const top = candidates[0] || {};
  return String(
    top.orderId
    || top.order_id
    || top.id
    || top.reportId
    || top.report_id
    || '',
  ).trim();
};

const fetchSmartCreditNewestOrderId = async (jwt) => {
  const token = String(jwt || '').trim();
  if (!token) return '';
  const metadata = await smartCreditApiRequest({
    jwt: token,
    path: '/v1/credit/3bs/metadata',
    method: 'GET',
  });
  return parseSmartCreditNewestOrderId(metadata?.json);
};

const fetchSmartCreditReportByOrderId = async (jwt, orderId) => {
  const token = String(jwt || '').trim();
  const normalizedOrderId = String(orderId || '').trim();
  if (!token) throw new Error('Missing SmartCredit JWT token.');
  if (!normalizedOrderId) throw new Error('Missing SmartCredit order ID.');
  return smartCreditApiRequest({
    jwt: token,
    path: `/v1/credit/3bs/${encodeURIComponent(normalizedOrderId)}`,
    method: 'GET',
  });
};

const extractCustomerTokenFromJwt = (jwtToken) => {
  const token = String(jwtToken || '').trim();
  if (!token) return '';
  const parts = token.split('.');
  if (parts.length < 2) return '';
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const normalized = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=');
    const payload = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
    return String(payload?.customerToken || payload?.customer_token || '').trim();
  } catch {
    return '';
  }
};

const loginMyFreeScoreNow = async (integration) => {
  const email = String(integration.tokenId || '').trim();
  const password = String(integration.apiSecret || '').trim();
  if (!email || !password) {
    throw new Error('MyFreeScoreNow API email and password are required.');
  }

  const formData = new FormData();
  formData.set('email', email);
  formData.set('password', password);

  const response = await fetch(`${myFreeScoreNowBaseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
    },
    body: formData,
  });

  const text = await response.text();
  const parsed = parseJsonValue(text) || {};
  if (!response.ok || !parsed.success || !parsed.token) {
    throw new Error(parsed.message || `MyFreeScoreNow login failed (${response.status})`);
  }

  return {
    baseUrl: myFreeScoreNowBaseUrl,
    token: String(parsed.token || '').trim(),
    raw: parsed,
  };
};

const consumerDirectRequest = async ({ baseUrl, jwt, path, method = 'GET', query = {}, body }) => {
  const url = new URL(path, baseUrl);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    method,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${jwt}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Consumer Direct request failed (${response.status})`);
  }

  return {
    url: url.toString(),
    text,
    json: parseJsonValue(text),
  };
};

const myFreeScoreNowRequest = async ({ token, path, fields = {}, method = 'POST' }) => {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      formData.set(key, String(value));
    }
  });

  const response = await fetch(new URL(path, myFreeScoreNowBaseUrl), {
    method,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const text = await response.text();
  const parsed = parseJsonValue(text) || {};
  if (!response.ok || parsed.success === false) {
    const endpoint = `${String(method || 'POST').toUpperCase()} ${path}`;
    const reason = parsed.message || parsed.error || `MyFreeScoreNow request failed (${response.status})`;
    throw new Error(`${reason} [${endpoint} | http ${response.status}]`);
  }

  return {
    url: new URL(path, myFreeScoreNowBaseUrl).toString(),
    text,
    json: parsed,
  };
};

const fetchConsumerDirectCurrentReport = async (integration, customerToken) => {
  const { baseUrl, jwt } = await loginConsumerDirect(integration);
  return consumerDirectRequest({
    baseUrl,
    jwt,
    path: '/customer/credit/3bs/details',
    query: { customerToken },
  });
};

const orderConsumerDirectNew3b = async (integration, customerToken) => {
  const { baseUrl, jwt } = await loginConsumerDirect(integration);
  return consumerDirectRequest({
    baseUrl,
    jwt,
    path: '/customer/credit/3bs',
    method: 'POST',
    query: { customerToken },
  });
};

const fetchMyFreeScoreNowCurrentReport = async (integration, memberEmail, clientToken) => {
  const { token } = await loginMyFreeScoreNow(integration);
  return myFreeScoreNowRequest({
    token,
    path: '/api/auth/fetch-3B-json',
    fields: {
      email: memberEmail,
      client_token: clientToken,
    },
  });
};

const fetchMyFreeScoreNowCurrentReportWithBearer = async (bearerToken, memberEmail, clientToken) => {
  return myFreeScoreNowRequest({
    token: bearerToken,
    path: '/api/auth/fetch-3B-json',
    fields: {
      email: memberEmail,
      client_token: clientToken,
    },
  });
};

const checkMyFreeScoreNow3bStatus = async (integration, memberEmail, clientToken) => {
  const { token } = await loginMyFreeScoreNow(integration);
  return myFreeScoreNowRequest({
    token,
    path: '/api/auth/member/3B/status-check',
    fields: {
      email: memberEmail,
      client_token: clientToken,
    },
  });
};

const checkMyFreeScoreNow3bStatusWithBearer = async (bearerToken, memberEmail, clientToken) => {
  return myFreeScoreNowRequest({
    token: bearerToken,
    path: '/api/auth/member/3B/status-check',
    fields: {
      email: memberEmail,
      client_token: clientToken,
    },
  });
};

const refreshMyFreeScoreNow3b = async (integration, memberEmail, clientToken) => {
  const { token } = await loginMyFreeScoreNow(integration);
  return myFreeScoreNowRequest({
    token,
    path: '/api/auth/member/3B/refresh',
    fields: {
      email: memberEmail,
      client_token: clientToken,
    },
  });
};

const refreshMyFreeScoreNow3bWithBearer = async (bearerToken, memberEmail, clientToken) => {
  return myFreeScoreNowRequest({
    token: bearerToken,
    path: '/api/auth/member/3B/refresh',
    fields: {
      email: memberEmail,
      client_token: clientToken,
    },
  });
};

const isMyFreeScoreNowUnauthorizedError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('unauthorized member access') || message.includes('unauthorized access');
};

const maskTokenPreview = (value = '') => {
  const text = String(value || '').trim();
  if (!text) {
    return '[missing token]';
  }
  if (text.length <= 10) {
    return `${text.slice(0, 2)}*** (len ${text.length})`;
  }
  return `${text.slice(0, 6)}...${text.slice(-4)} (len ${text.length})`;
};

const formatMfsnDebugTrail = (steps = []) => {
  const cleanSteps = Array.isArray(steps)
    ? steps.map((entry) => String(entry || '').trim()).filter(Boolean)
    : [];
  if (!cleanSteps.length) {
    return '';
  }
  return `\nMFSN debug:\n- ${cleanSteps.join('\n- ')}`;
};

const hasNonEmptyJsonPayload = (payload, rawText = '') => {
  if (payload === null || payload === undefined) {
    return String(rawText || '').trim().length > 1;
  }
  if (typeof payload === 'string') {
    return payload.trim().length > 1;
  }
  if (Array.isArray(payload)) {
    return payload.length > 0;
  }
  if (typeof payload === 'object') {
    return Object.keys(payload).length > 0;
  }
  return false;
};

const seedIntegrations = async () => {
  const current = await loadIntegrations();
  await saveIntegration('smartcredit35540', current.smartcredit35540);
  await saveIntegration('smartcredit68951', current.smartcredit68951);
  await saveIntegration('myfreescorenow', current.myfreescorenow);
  await saveIntegration('billing', current.billing);
  await saveIntegration('ninjadispute', current.ninjadispute);
};

const syncConsumerDirectReportToClient = async ({
  store,
  client,
  integrationKey,
  reportJson,
  reportDate,
  responseUrl,
  source,
}) => {
  const syncedAt = new Date().toISOString();
  const reportJsonText = stringifyJsonValue(reportJson || '');
  const resolvedReportDate = getTodayIsoDate();
  const previousReportDate = String(client.reportDate || '');
  const previousReportJson = String(client.creditReportJson || '');
  const reportFileName = `${source}-${extractDateToken(resolvedReportDate).replaceAll('/', '-') || Date.now()}.json`;

  await insertReportSnapshot(client, {
    source,
    monitoringAgency: client.monitoringAgency || integrationKey,
    reportDate: resolvedReportDate,
    reportFileName,
    reportHtml: client.creditReportHtml,
    reportJsonRaw: reportJsonText,
    responseUrl,
    createdAt: syncedAt,
    metadata: {
      provider: integrationKey === 'myfreescorenow' ? 'myfreescorenow' : 'consumerdirect',
      integrationKey,
      customerToken: client.monitoringToken || '',
    },
  });

  client.reportDate = resolvedReportDate;
  client.creditReportJson = reportJsonText;
  client.creditReportSource = source;
  client.creditReportFileName = reportFileName;
  client.lastSyncedAt = syncedAt;
  client.nextImportInt = '';
  client.nextImportLabel = '';
  if (resolvedReportDate !== previousReportDate || reportJsonText !== previousReportJson) {
    client.nextImportMode = 'refresh-success';
    client.refreshNextImportStartDate = getTodayIsoDate();
    client.manualNextImportStartDays = null;
    client.manualNextImportSetDate = '';
  }
  await writeStore(store);

  return toSafeClient(client);
};

const seedReportHistory = async (store) => {
  for (const client of store.clients) {
    if (!hasMeaningfulReportData(client)) {
      continue;
    }

    await insertReportSnapshot(client, {
      source: client.creditReportSource || 'seed-existing-report',
      reportDate: client.reportDate,
      reportFileName: client.creditReportFileName,
      reportHtml: client.creditReportHtml,
      reportJson: client.creditReportJson,
      createdAt: client.lastSyncedAt || client.createdAt,
      metadata: { seeded: true },
    });
  }
};

const ensureStorageReady = async (ownerKey = getCurrentOwnerKey()) => {
  const normalizedOwner = normalizeOwnerKey(ownerKey);
  if (!storageReadyByOwner.has(normalizedOwner)) {
    storageReadyByOwner.set(normalizedOwner, (async () => {
      const targetDataFile = getOwnerDataFile(normalizedOwner);
      await ensureDataFile(normalizedOwner);
      const raw = await fs.readFile(targetDataFile, 'utf8');
      const normalized = await mergeStoreWithProfileDb(normalizeStore(JSON.parse(raw)), normalizedOwner);
      await syncClientProfilesToDb(normalized.clients, normalizedOwner);
      await seedIntegrations();
      await seedReportHistory(normalized);
      void mirrorBusinessBlobToS3(normalizedOwner, 'store/store.json', JSON.stringify(normalized, null, 2)).catch((error) => {
        console.warn(`[S3 Mirror] ensureStorageReady store export failed: ${error.message}`);
      });
      void mirrorBusinessControlPlaneToS3(normalizedOwner).catch((error) => {
        console.warn(`[S3 Mirror] ensureStorageReady control-plane export failed: ${error.message}`);
      });
    })());
  }

  await storageReadyByOwner.get(normalizedOwner);
};

const readStore = async (ownerKey = getCurrentOwnerKey()) => {
  const normalizedOwner = normalizeOwnerKey(ownerKey);
  const targetDataFile = getOwnerDataFile(normalizedOwner);
  await ensureStorageReady(normalizedOwner);
  const raw = await fs.readFile(targetDataFile, 'utf8');
  return mergeStoreWithProfileDb(normalizeStore(JSON.parse(raw)), normalizedOwner);
};

const writeStore = async (store, ownerKey = getCurrentOwnerKey()) => {
  const normalizedOwner = normalizeOwnerKey(ownerKey);
  const targetDataFile = getOwnerDataFile(normalizedOwner);
  const normalized = normalizeStore(store);
  await writeJsonFileAtomic(targetDataFile, JSON.stringify(normalized, null, 2));
  await syncClientProfilesToDb(normalized.clients, normalizedOwner);
  void mirrorBusinessBlobToS3(normalizedOwner, 'store/store.json', JSON.stringify(normalized, null, 2)).catch((error) => {
    console.warn(`[S3 Mirror] store export failed: ${error.message}`);
  });
  void mirrorBusinessControlPlaneToS3(normalizedOwner).catch((error) => {
    console.warn(`[S3 Mirror] control-plane export failed: ${error.message}`);
  });
};

const listReportHistory = async (clientId) => {
  const rows = await surql(`SELECT id, client_id, source, monitoring_agency, report_date, report_file_name, response_url, created_at FROM reports WHERE client_id = "${sEsc(String(clientId))}" AND source_db = "ninjatools" ORDER BY created_at DESC`);
  return rows.map(row => ({
    id: String(row.id || ''),
    clientId: String(row.client_id || ''),
    source: String(row.source || ''),
    monitoringAgency: String(row.monitoring_agency || ''),
    reportDate: String(row.report_date || ''),
    reportFileName: String(row.report_file_name || ''),
    responseUrl: String(row.response_url || ''),
    createdAt: String(row.created_at || ''),
  }));
};

const deleteReportHistory = async (clientId) => {
  await surql(`DELETE reports WHERE client_id = "${sEsc(String(clientId))}" AND source_db = "ninjatools"`);
};

const findClientForSync = (clients, criteria) => {
  const firstName = normalizeLookupValue(criteria.firstName);
  const lastName = normalizeLookupValue(criteria.lastName);
  const email = normalizeLookupValue(criteria.email);
  const monitoringUsername = normalizeLookupValue(criteria.monitoringUsername);
  const monitoringPassword = normalizeLookupValue(criteria.monitoringPassword);

  if (monitoringUsername) {
    let credentialMatches = clients.filter((client) => (
      normalizeLookupValue(client.monitoringUsername) === monitoringUsername
      || normalizeLookupValue(client.email) === monitoringUsername
    ));

    if (monitoringPassword) {
      const passwordMatches = credentialMatches.filter((client) => (
        normalizeLookupValue(client.monitoringPassword) === monitoringPassword
      ));
      if (passwordMatches.length) {
        credentialMatches = passwordMatches;
      }
    }

    if (firstName && lastName) {
      const nameRefined = credentialMatches.filter((client) => (
        normalizeLookupValue(client.firstName) === firstName
        && normalizeLookupValue(client.lastName) === lastName
      ));
      if (nameRefined.length) {
        credentialMatches = nameRefined;
      }
    }

    if (credentialMatches.length) {
      return credentialMatches[0];
    }
  }

  let matches = clients.filter((client) => (
    normalizeLookupValue(client.firstName) === firstName
    && normalizeLookupValue(client.lastName) === lastName
  ));

  if (email) {
    const emailMatches = matches.filter((client) => normalizeLookupValue(client.email) === email);
    if (emailMatches.length) {
      matches = emailMatches;
    }
  }

  return matches[0] || null;
};

const serveStatic = async (res, pathname) => {
  let requested = pathname === '/' ? '/index.html' : pathname;
  if (pathname === '/billing') {
    requested = '/billing.html';
  }
  if (pathname === '/payments') {
    requested = '/payments.html';
  }
  if (pathname === '/add-clients') {
    requested = '/add-clients.html';
  }
  if (pathname === '/add-client') {
    requested = '/add-client.html';
  }
  if (pathname === '/training' || pathname === '/Training') {
    requested = '/learning.html';
  }
  if (pathname === '/learning' || pathname === '/Learning') {
    requested = '/learning.html';
  }
  const filePath = path.join(publicDir, requested);

  if (!filePath.startsWith(publicDir)) {
    notFound(res);
    return;
  }

  try {
    const ext = path.extname(filePath);
    const file = await fs.readFile(filePath);
    send(res, 200, file, contentTypes[ext] ?? 'application/octet-stream');
  } catch {
    notFound(res);
  }
};

const server = createServer((req, res) => {
  const cookies = parseCookies(req?.headers?.cookie || '');
  const requestUser = normalizeUsername(cookies.get('txn') || '');
  const scopedOwnerKey = normalizeOwnerKey(requestUser || appLoginUsername);
  const requestOriginHeader = String(req.headers.origin || '').trim();
  const requestOrigin = resolveCorsOrigin(requestOriginHeader);
  const requestHeaders = String(req.headers['access-control-request-headers'] || '').trim();
  requestContext.run({ ownerKey: scopedOwnerKey, knownUsers: dynamicUsernames, requestOrigin, requestHeaders }, async () => {
    try {
    const corsHeaders = buildCorsHeaders(requestOrigin, requestHeaders);
    const originalWriteHead = res.writeHead.bind(res);
    res.writeHead = (statusCode, statusMessageOrHeaders, maybeHeaders) => {
      if (typeof statusMessageOrHeaders === 'string') {
        const mergedHeaders = {
          ...toHeaderObject(maybeHeaders),
          ...corsHeaders,
        };
        return originalWriteHead(statusCode, statusMessageOrHeaders, mergedHeaders);
      }
      const mergedHeaders = {
        ...toHeaderObject(statusMessageOrHeaders),
        ...corsHeaders,
      };
      return originalWriteHead(statusCode, mergedHeaders);
    };

    if (req.method === 'OPTIONS') {
      if (!requestOriginHeader || !requestOrigin) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'CORS origin not allowed.' }, null, 2));
        return;
      }
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const requestHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
    const isApiHost = requestHost === 'api.ninjadispute.com';
    const rawPathname = (url.pathname.length > 1 && url.pathname.endsWith('/'))
      ? url.pathname.slice(0, -1)
      : url.pathname;
    let pathname = rawPathname;
    if (
      isApiHost
      && pathname !== '/'
      && pathname !== '/api'
      && !pathname.startsWith('/api/')
      && !pathname.startsWith('/socket.io')
      && !path.extname(pathname)
    ) {
      pathname = `/api${pathname}`;
    }
    if ((pathname === '/payments' || pathname === '/payments.html') && !isAppAuthenticated(req)) {
      res.writeHead(302, { Location: '/' });
      res.end();
      return;
    }

  if (pathname === '/api/login' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const username = String(body.username ?? '').trim();
      const password = String(body.password ?? '');
      const legacyValid = isValidAppCredential(username, password);
      const dynamicValid = await verifyUserCredential(username, password);
      if (!legacyValid && !dynamicValid) {
        send(res, 401, { error: 'Invalid username or password.' });
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Set-Cookie': [
          `txn=${encodeURIComponent(username)}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`,
        ],
      });
      res.end(JSON.stringify({ success: true, user: normalizeUsername(username) }, null, 2));
    } catch (error) {
      send(res, 400, { error: error.message || 'Login failed.' });
    }
    return;
  }

  if (pathname === '/api/signup' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const username = String(body.username ?? '').trim();
      const password = String(body.password ?? '');
      const confirmPassword = String(body.confirmPassword ?? '');

      if (!username || !password) {
        send(res, 400, { error: 'Username and password are required.' });
        return;
      }
      if (password.length < 8) {
        send(res, 400, { error: 'Password must be at least 8 characters.' });
        return;
      }
      if (confirmPassword && password !== confirmPassword) {
        send(res, 400, { error: 'Password confirmation does not match.' });
        return;
      }

      const created = await createAppUser(username, password);

      res.writeHead(201, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Set-Cookie': [
          `txn=${encodeURIComponent(created.username)}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`,
        ],
      });
      res.end(JSON.stringify({ success: true, user: created.username }, null, 2));
    } catch (error) {
      send(res, 400, { error: error.message || 'Signup failed.' });
    }
    return;
  }

  if (pathname === '/api/business-settings' && req.method === 'GET') {
    const store = await readStore();
    send(res, 200, {
      ok: true,
      settings: {
        ...seedData.businessSettings,
        ...(store.businessSettings && typeof store.businessSettings === 'object' ? store.businessSettings : {}),
      },
    });
    return;
  }

  if (pathname === '/api/business-settings' && req.method === 'PUT') {
    try {
      const body = await readBody(req);
      const incoming = body?.settings && typeof body.settings === 'object' ? body.settings : {};
      const store = await readStore();
      store.businessSettings = {
        ...seedData.businessSettings,
        ...incoming,
      };
      await writeStore(store);
      send(res, 200, { ok: true, settings: store.businessSettings });
    } catch (error) {
      send(res, 400, { error: error.message || 'Unable to save business settings.' });
    }
    return;
  }

  if (pathname === '/api/health' && req.method === 'GET') {
    send(res, 200, { ok: true });
    return;
  }

  if (pathname === '/api/auth/status' && req.method === 'GET') {
    const cookies = parseCookies(req?.headers?.cookie || '');
    const username = normalizeUsername(cookies.get('txn') || '');
    send(res, 200, { authenticated: isAppAuthenticated(req), user: username || '' });
    return;
  }

  if (pathname === '/api/auth/sso-login' && req.method === 'POST') {
    try {
      // Short-circuit: if txn session is already valid, no SSO verification needed.
      if (isAppAuthenticated(req)) {
        const txnUser = normalizeUsername(parseCookies(req?.headers?.cookie || '').get('txn') || '');
        send(res, 200, { authenticated: true, user: txnUser });
        return;
      }
      const body = await readBody(req);
      const cookies = parseCookies(req?.headers?.cookie || '');
      // Client sends token explicitly in body; cookie header is a fallback.
      const ninjaToken = String(body.token || cookies.get('ninja_token') || '').trim();
      if (!ninjaToken) {
        send(res, 401, { error: 'No SSO token present.' });
        return;
      }
      let ssoUsername = '';

      // Try EdDSA verification via auth.ninjadispute.com first (OAuth users).
      try {
        const verifyRes = await fetch('https://auth.ninjadispute.com/verify', {
          headers: { Authorization: `Bearer ${ninjaToken}` },
        });
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json().catch(() => ({}));
          if (verifyData?.authenticated) {
            ssoUsername = normalizeUsername(verifyData.username || verifyData.email || '');
          }
        }
      } catch {}

      // Fallback: HS256 token issued by api.ninjadispute.com (direct-login users).
      if (!ssoUsername) {
        const apiPayload = verifyApiJWT(ninjaToken);
        if (apiPayload) {
          ssoUsername = normalizeUsername(apiPayload.username || apiPayload.email || '');
        }
      }

      if (!ssoUsername) {
        send(res, 401, { error: 'SSO token invalid or unrecognized.' });
        return;
      }
      dynamicUsernames.add(ssoUsername);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': req.headers.origin || '*',
        'Access-Control-Allow-Credentials': 'true',
        'Set-Cookie': [
          `txn=${encodeURIComponent(ssoUsername)}; Path=/; Max-Age=3600; SameSite=Lax; Secure`,
        ],
      });
      res.end(JSON.stringify({ authenticated: true, user: ssoUsername }, null, 2));
    } catch (error) {
      send(res, 500, { error: error.message || 'SSO login failed.' });
    }
    return;
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Set-Cookie': [
        'txn=; Path=/; Max-Age=0; SameSite=Lax; Secure',
      ],
    });
    res.end(JSON.stringify({ success: true }, null, 2));
    return;
  }

  if (pathname === '/api/address-suggestions' && req.method === 'GET') {
    try {
      const result = await fetchAddressSuggestions(url.searchParams.get('q') || '');
      send(res, 200, result);
    } catch (error) {
      send(res, 500, { error: error.message || 'Address suggestions unavailable.' });
    }
    return;
  }

  if (pathname === '/api/documents/proxy' && req.method === 'GET') {
    try {
      const storageKey = String(url.searchParams.get('key') || '').trim();
      if (!storageKey) {
        send(res, 400, { error: 'Missing document key.' });
        return;
      }
      const result = await fetchContaboObject(storageKey);
      let resolved = result;
      if (!resolved.ok && Number(resolved.status || 0) === 404) {
        const localFallback = await fetchLocalPublicDocument(storageKey);
        if (localFallback.ok) {
          resolved = localFallback;
        }
      }
      if (!resolved.ok) {
        res.writeHead(Number(resolved.status || 502), {
          'Content-Type': resolved.contentType || 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(String(resolved.body || 'Document fetch failed.'));
        return;
      }
      const headers = {
        'Content-Type': resolved.contentType || 'application/octet-stream',
        'Cache-Control': 'private, max-age=300',
        'Access-Control-Allow-Origin': '*',
      };
      if (resolved.contentLength) {
        headers['Content-Length'] = String(resolved.contentLength);
      }
      if (resolved.eTag) {
        headers.ETag = String(resolved.eTag);
      }
      if (resolved.lastModified) {
        headers['Last-Modified'] = String(resolved.lastModified);
      }
      res.writeHead(200, headers);
      res.end(resolved.body);
    } catch (error) {
      send(res, 500, { error: error.message || 'Document proxy failed.' });
    }
    return;
  }

  if (pathname === '/api/admin/migrate-documents-to-s3' && req.method === 'POST') {
    try {
      if (!isAppAuthenticated(req)) {
        send(res, 401, { error: 'Unauthorized' });
        return;
      }
      const ownerKey = normalizeOwnerKey(getAuthenticatedUsername(req) || appLoginUsername);
      const body = await readBody(req).catch(() => ({}));
      const limit = Number.isFinite(Number(body?.limit)) ? Math.max(1, Math.trunc(Number(body.limit))) : 0;
      const store = await readStore(ownerKey);
      const clients = Array.isArray(store.clients) ? store.clients : [];
      const max = limit > 0 ? Math.min(limit, clients.length) : clients.length;

      let clientsProcessed = 0;
      let clientsUpdated = 0;
      let documentsUploaded = 0;
      const failures = [];

      for (let i = 0; i < max; i += 1) {
        const client = clients[i];
        clientsProcessed += 1;
        const before = normalizeClientDocumentsInput(client.documents);
        const beforeKeys = new Set(before.map((doc) => String(doc.storageKey || '').trim()).filter(Boolean));
        try {
          const after = await persistClientDocumentsToS3(before, { ownerKey, clientId: client.id });
          const afterKeys = new Set(after.map((doc) => String(doc.storageKey || '').trim()).filter(Boolean));
          const uploadedForClient = Math.max(0, afterKeys.size - beforeKeys.size);
          if (uploadedForClient > 0 || JSON.stringify(before) !== JSON.stringify(after)) {
            client.documents = after;
            clientsUpdated += 1;
            documentsUploaded += uploadedForClient;
          }
        } catch (error) {
          failures.push({
            clientId: client.id,
            client: `${client.firstName || ''} ${client.lastName || ''}`.trim(),
            error: error.message || 'Migration failed',
          });
        }
      }

      if (clientsUpdated > 0) {
        await writeStore(store, ownerKey);
      }

      send(res, 200, {
        ok: true,
        ownerKey,
        clientsProcessed,
        clientsUpdated,
        documentsUploaded,
        failures,
      });
    } catch (error) {
      send(res, 500, { error: error.message || 'Document migration failed.' });
    }
    return;
  }

  if (pathname === '/api/simulator/vantage' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const profile = body?.profile && typeof body.profile === 'object' ? body.profile : {};
      const accounts = Array.isArray(profile.accounts) ? profile.accounts : [];
      if (!accounts.length) {
        profile.accounts = [
          {
            bureau: 'transunion',
            type: 'revolving',
            balance: 0,
            limit_or_original: 1000,
            age_months: 24,
            on_time_months: 24,
            late_30: 0,
            late_60: 0,
            late_90: 0,
          },
        ];
      }
      const scenario = String(body?.scenario || 'baseline').trim() || 'baseline';
      const value = body?.value ?? '';
      let result;
      try {
        result = await runVantageSimulation(profile, scenario, value);
      } catch (error) {
        result = buildFallbackVantageResult(profile, scenario, error?.message || 'Python model failed');
      }
      send(res, 200, { result });
    } catch (error) {
      const fallback = buildFallbackVantageResult({}, 'baseline', error.message || 'What-if simulation failed.');
      send(res, 200, { result: fallback, warning: error.message || 'What-if simulation failed.' });
    }
    return;
  }

  if (pathname === '/api/clients' && req.method === 'GET') {
    const store = await readStore();
    send(res, 200, {
      statuses: store.statuses,
      phases: store.phases || defaultPhases,
      clients: store.clients.map(toClientListItem),
    });
    return;
  }

  if (pathname === '/api/integrations' && req.method === 'GET') {
    const integrations = await loadIntegrations();
    send(res, 200, { integrations });
    return;
  }

  if (pathname === '/api/payments/overview' && req.method === 'GET') {
    try {
      const ownerKey = getPaymentsOwnerKey(req, url);
      const overview = await buildPaymentsOverview(ownerKey);
      send(res, 200, { ok: true, ...overview });
    } catch (error) {
      send(res, 500, { error: error.message || 'Failed to load payments overview.' });
    }
    return;
  }

  if (pathname === '/api/payments/config' && req.method === 'PUT') {
    try {
      const ownerKey = getPaymentsOwnerKey(req, url);
      const body = await readBody(req);
      const config = await savePaymentConfig(ownerKey, body || {});
      send(res, 200, { ok: true, ownerKey, config });
    } catch (error) {
      send(res, 400, { error: error.message || 'Failed to save payments config.' });
    }
    return;
  }

  if (pathname === '/api/payments/merchants' && req.method === 'POST') {
    try {
      const ownerKey = getPaymentsOwnerKey(req, url);
      const body = await readBody(req);
      const merchant = await createPaymentMerchant(ownerKey, body || {});
      send(res, 201, { ok: true, merchant });
    } catch (error) {
      send(res, 400, { error: error.message || 'Failed to create merchant.' });
    }
    return;
  }

  if (pathname === '/api/payments/test-square' && req.method === 'POST') {
    try {
      const ownerKey = getPaymentsOwnerKey(req, url);
      const body = await readBody(req);
      const result = await testSquarePullForOwner(ownerKey, body?.daysBack);
      send(res, 200, { ok: true, ...result });
    } catch (error) {
      send(res, 400, { error: error.message || 'Square pull test failed.' });
    }
    return;
  }

  const merchantMatch = pathname.match(/^\/api\/payments\/merchants\/(\d+)$/);
  if (merchantMatch && req.method === 'PUT') {
    try {
      const ownerKey = getPaymentsOwnerKey(req, url);
      const body = await readBody(req);
      const merchantId = Number(merchantMatch[1]);
      const merchant = await updatePaymentMerchant(ownerKey, merchantId, body || {});
      send(res, 200, { ok: true, merchant });
    } catch (error) {
      send(res, 400, { error: error.message || 'Failed to update merchant.' });
    }
    return;
  }

  if (merchantMatch && req.method === 'DELETE') {
    try {
      const ownerKey = getPaymentsOwnerKey(req, url);
      const merchantId = Number(merchantMatch[1]);
      const deleted = await deletePaymentMerchant(ownerKey, merchantId);
      if (!deleted) {
        notFound(res);
        return;
      }
      send(res, 200, { ok: true, deleted: true });
    } catch (error) {
      send(res, 400, { error: error.message || 'Failed to delete merchant.' });
    }
    return;
  }

  if (pathname === '/api/payments/products' && req.method === 'POST') {
    try {
      const ownerKey = getPaymentsOwnerKey(req, url);
      const body = await readBody(req);
      const product = await createPaymentProduct(ownerKey, body || {});
      send(res, 201, { ok: true, product });
    } catch (error) {
      send(res, 400, { error: error.message || 'Failed to create product.' });
    }
    return;
  }

  const productMatch = pathname.match(/^\/api\/payments\/products\/(\d+)$/);
  if (productMatch && req.method === 'PUT') {
    try {
      const ownerKey = getPaymentsOwnerKey(req, url);
      const body = await readBody(req);
      const productId = Number(productMatch[1]);
      const product = await updatePaymentProduct(ownerKey, productId, body || {});
      send(res, 200, { ok: true, product });
    } catch (error) {
      send(res, 400, { error: error.message || 'Failed to update product.' });
    }
    return;
  }

  if (productMatch && req.method === 'DELETE') {
    try {
      const ownerKey = getPaymentsOwnerKey(req, url);
      const productId = Number(productMatch[1]);
      const deleted = await deletePaymentProduct(ownerKey, productId);
      if (!deleted) {
        notFound(res);
        return;
      }
      send(res, 200, { ok: true, deleted: true });
    } catch (error) {
      send(res, 400, { error: error.message || 'Failed to delete product.' });
    }
    return;
  }

  if (pathname === '/api/payments/autopay' && req.method === 'POST') {
    try {
      const ownerKey = getPaymentsOwnerKey(req, url);
      const body = await readBody(req);
      const autopay = await createPaymentAutopay(ownerKey, body || {});
      send(res, 201, { ok: true, autopay });
    } catch (error) {
      send(res, 400, { error: error.message || 'Failed to create autopay rule.' });
    }
    return;
  }

  const autopayMatch = pathname.match(/^\/api\/payments\/autopay\/(\d+)$/);
  if (autopayMatch && req.method === 'PUT') {
    try {
      const ownerKey = getPaymentsOwnerKey(req, url);
      const body = await readBody(req);
      const autopayId = Number(autopayMatch[1]);
      const autopay = await updatePaymentAutopay(ownerKey, autopayId, body || {});
      send(res, 200, { ok: true, autopay });
    } catch (error) {
      send(res, 400, { error: error.message || 'Failed to update autopay rule.' });
    }
    return;
  }

  if (autopayMatch && req.method === 'DELETE') {
    try {
      const ownerKey = getPaymentsOwnerKey(req, url);
      const autopayId = Number(autopayMatch[1]);
      const deleted = await deletePaymentAutopay(ownerKey, autopayId);
      if (!deleted) {
        notFound(res);
        return;
      }
      send(res, 200, { ok: true, deleted: true });
    } catch (error) {
      send(res, 400, { error: error.message || 'Failed to delete autopay rule.' });
    }
    return;
  }

  if (pathname === '/api/training/clients' && req.method === 'GET') {
    if (!requireAppAuth(req, res)) {
      return;
    }
    const store = await readStore();
    const clients = (store.clients || []).map((client) => ({
      id: client.id,
      firstName: String(client.firstName || '').trim(),
      lastName: String(client.lastName || '').trim(),
      email: String(client.email || '').trim(),
      dob: String(client.dob || '').trim(),
      ssn: String(client.ssn || '').trim(),
      address: String(client.address || '').trim(),
      documents: Array.isArray(client.documents) ? client.documents : [],
      monitoringAgency: inferMonitoringAgency(client),
      reportDate: String(client.reportDate || '').trim(),
      hasJsonReport: Boolean(
        String(client.creditReportJson || '').trim()
        || (String(client.creditReportHtml || '').trim() && !isPlaceholderCreditReportHtml(client.creditReportHtml)),
      ),
    }));
    send(res, 200, { ok: true, clients });
    return;
  }

  if (pathname === '/api/training/context/session' && req.method === 'GET') {
    if (!requireAppAuth(req, res)) {
      return;
    }
    const ownerKey = normalizeOwnerKey(getAuthenticatedUsername(req) || appLoginUsername);
    const row = learningContextByOwner.get(ownerKey) || null;
    send(res, 200, {
      ok: true,
      ownerKey,
      context: row?.context || null,
      updatedAt: row?.updatedAt || null,
      contextId: row?.contextId || '',
      contextPublicUrl: row?.contextPublicUrl || '',
    });
    return;
  }

  const publicTrainingContextMatch = pathname.match(/^\/api\/training\/context\/public\/([^/]+)$/);
  if (publicTrainingContextMatch && req.method === 'GET') {
    const contextId = decodeURIComponent(publicTrainingContextMatch[1]);
    const token = String(url.searchParams.get('token') || '').trim();
    const row = [...learningContextByOwner.values()].find(
      (entry) => String(entry?.contextId || '') === contextId && String(entry?.accessToken || '') === token,
    );
    if (!row) {
      send(res, 401, { error: 'Invalid context token.' });
      return;
    }
    send(res, 200, {
      ok: true,
      contextId: row.contextId,
      updatedAt: row.updatedAt,
      context: row.context || {},
    });
    return;
  }

  if (pathname === '/api/training/context/session' && req.method === 'POST') {
    if (!requireAppAuth(req, res)) {
      return;
    }
    try {
      const ownerKey = normalizeOwnerKey(getAuthenticatedUsername(req) || appLoginUsername);
      const body = await readBody(req);
      const rawContext = body?.context && typeof body.context === 'object' ? body.context : null;
      if (!rawContext) {
        send(res, 400, { error: 'context payload is required.' });
        return;
      }
      const serialized = JSON.stringify(rawContext);
      if (serialized.length > 2_500_000) {
        send(res, 400, { error: 'Context payload is too large.' });
        return;
      }

      const pushToGhl = Boolean(body?.pushToGhl);
      const updatedAt = new Date().toISOString();
      const existing = learningContextByOwner.get(ownerKey) || {};
      const contextId = String(existing.contextId || randomUUID());
      const accessToken = String(existing.accessToken || randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', ''));
      const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() || 'https';
      const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
      const publicBaseUrl = hostHeader ? `${proto}://${hostHeader}` : '';
      const contextPublicUrl = publicBaseUrl
        ? `${publicBaseUrl}/api/training/context/public/${encodeURIComponent(contextId)}?token=${encodeURIComponent(accessToken)}`
        : '';

      learningContextByOwner.set(ownerKey, {
        context: JSON.parse(serialized),
        updatedAt,
        contextId,
        accessToken,
        contextPublicUrl,
      });

      let goHighLevelSync = null;
      if (pushToGhl) {
        const client = rawContext?.client && typeof rawContext.client === 'object' ? rawContext.client : null;
        if (client) {
          try {
            goHighLevelSync = await pushLearningContextToGoHighLevel({
              ownerKey,
              context: rawContext,
              contextPublicUrl,
            });
          } catch (ghlError) {
            const canFallbackToSms = String(client.phone || '').trim() || String(client.email || '').trim();
            if (canFallbackToSms) {
              try {
                const selectedAccount = rawContext?.selectedAccount || {};
                const selectedBureauSummaries = rawContext?.selectedBureauSummaries || {};
                const summaryMessage = [
                  'NinjaTools Learning Context Sync',
                  `Client: ${String(client.firstName || '').trim()} ${String(client.lastName || '').trim()}`.trim(),
                  `Selected Creditor: ${String(selectedAccount.creditorName || '').trim() || '--'}`,
                  `Selected Account #: ${String(selectedAccount.accountNumber || '').trim() || '--'}`,
                  `Source: ${String(rawContext?.source || '').trim() || '--'}`,
                  'Bureau Snapshot:',
                  ...Object.entries(selectedBureauSummaries).map(([bureau, row]) => {
                    const name = String(row?.creditor || '--').trim();
                    const number = String(row?.accountNumber || '--').trim();
                    const status = String(row?.openClosed || '--').trim();
                    return `- ${String(bureau || '').toUpperCase()}: ${name} | ${number} | ${status}`;
                  }),
                  contextPublicUrl ? `Full Context URL: ${contextPublicUrl}` : '',
                ].filter(Boolean).join('\n');

                const pushResult = await sendTextMessageViaGoHighLevel(
                  {
                    id: String(client.id || '').trim(),
                    firstName: String(client.firstName || '').trim(),
                    lastName: String(client.lastName || '').trim(),
                    email: String(client.email || '').trim(),
                    phone: String(client.phone || '').trim(),
                    ghlContactId: String(client.ghlContactId || '').trim(),
                  },
                  summaryMessage,
                  [],
                  '',
                );
                goHighLevelSync = {
                  ok: true,
                  mode: `${pushResult?.mode || 'api'}-fallback`,
                  contactId: String(pushResult?.contactId || '').trim(),
                  conversationId: String(pushResult?.conversationId || '').trim(),
                  messageId: String(pushResult?.messageId || '').trim(),
                  warning: `Webhook context push failed, used message fallback: ${String(ghlError?.message || 'Unknown webhook error.')}`,
                };
              } catch (fallbackError) {
                goHighLevelSync = {
                  ok: false,
                  error: String(fallbackError?.message || 'Failed to push learning context via fallback message.'),
                  cause: String(ghlError?.message || 'Webhook context push failed.'),
                };
              }
            } else {
              goHighLevelSync = {
                ok: false,
                error: String(ghlError?.message || 'Failed to push context to GoHighLevel chat.'),
              };
            }
          }
        } else {
          goHighLevelSync = {
            ok: false,
            error: 'Selected client is missing from context payload, so GoHighLevel bot sync could not run.',
          };
        }
      }

      send(res, 200, {
        ok: true,
        ownerKey,
        updatedAt,
        bytes: serialized.length,
        contextId,
        contextPublicUrl,
        goHighLevelSync,
      });
    } catch (error) {
      send(res, 400, { error: error.message || 'Failed to sync learning context.' });
    }
    return;
  }

  if (pathname === '/api/training/ai/rewrite' && req.method === 'POST') {
    if (!requireAppAuth(req, res)) {
      return;
    }
    try {
      const ownerKey = normalizeOwnerKey(getAuthenticatedUsername(req) || appLoginUsername);
      const body = await readBody(req);
      const provider = String(body?.provider || 'groq').trim().toLowerCase();
      const level = String(body?.level || 'Initial Letter').trim();
      const selectedText = String(body?.selectedText || '').trim();
      const customPrompt = String(body?.customPrompt || '').trim();
      if (selectedText.length < 10) {
        send(res, 400, { error: 'Please select at least 10 characters to rewrite.' });
        return;
      }

      const submittedContext = body?.context && typeof body.context === 'object' ? body.context : null;
      const existingContext = learningContextByOwner.get(ownerKey)?.context || null;
      const context = submittedContext || existingContext || {};
      if (submittedContext) {
        learningContextByOwner.set(ownerKey, {
          context: submittedContext,
          updatedAt: new Date().toISOString(),
        });
      }

      const prompt = buildAiRewritePrompt({
        level,
        selectedText,
        context,
        customPrompt,
      });

      let rewritten = '';
      if (provider === 'groq') {
        rewritten = await callGroqRewrite({ prompt });
      } else if (provider === 'claude' || provider === 'anthropic') {
        rewritten = await callAnthropicRewrite({ prompt });
      } else {
        send(res, 400, { error: `Unsupported provider "${provider}". Use groq or claude.` });
        return;
      }

      send(res, 200, {
        ok: true,
        provider,
        level,
        text: rewritten,
      });
    } catch (error) {
      send(res, 400, { error: error.message || 'AI rewrite failed.' });
    }
    return;
  }

  const trainingDerogMatch = pathname.match(/^\/api\/training\/clients\/([^/]+)\/derogatory$/);
  if (trainingDerogMatch && req.method === 'GET') {
    if (!requireAppAuth(req, res)) {
      return;
    }
    const clientId = decodeURIComponent(trainingDerogMatch[1]);
    const store = await readStore();
    const client = store.clients.find((entry) => String(entry.id || '') === clientId);
    if (!client) {
      notFound(res);
      return;
    }

    const localReportValue = parseJsonValue(client.creditReportJson) || parseJsonValue(client.creditReportHtml);
    const localDerogatoryAccounts = localReportValue ? parseDerogatoryAccountsFromJson(localReportValue) : [];
    const localAllTradelineAccounts = localReportValue ? parseAllTradelineAccountsFromJson(localReportValue) : [];
    let accounts = [];
    let source = 'local-json';
    let matchedRemoteClient = null;
    let warnings = [];

    try {
      const integrations = await loadIntegrations();
      const remoteResult = await pullDerogatoryAccountsFromNinjaDispute(integrations.ninjadispute || {}, client);
      accounts = remoteResult.accounts;
      source = `remote-${remoteResult.source}`;
      matchedRemoteClient = remoteResult.matchedClient || null;
      if (accounts.length && localAllTradelineAccounts.length) {
        accounts = mergeDerogatoryAccounts(accounts, localAllTradelineAccounts);
      } else if (!accounts.length && localDerogatoryAccounts.length) {
        if (localDerogatoryAccounts.length) {
          accounts = localDerogatoryAccounts;
          source = 'local-json-fallback-after-remote-empty';
          warnings.push('Remote source returned zero derogatory rows; used local JSON fallback.');
        }
      }
      if (accounts.length && localReportValue) {
        accounts = enrichDerogatoryAccountsWithSubscriberContacts(accounts, localReportValue, client.creditReportHtml || '');
      }
    } catch (error) {
      warnings.push(String(error?.message || 'Remote NinjaDispute pull failed.'));
      if (localReportValue) {
        accounts = localDerogatoryAccounts;
        source = 'local-json-fallback';
        accounts = enrichDerogatoryAccountsWithSubscriberContacts(accounts, localReportValue, client.creditReportHtml || '');
      } else {
        accounts = [];
        source = 'none';
      }
    }

    send(res, 200, {
      ok: true,
      client: {
        id: client.id,
        firstName: client.firstName || '',
        lastName: client.lastName || '',
        email: client.email || '',
        reportDate: client.reportDate || '',
      },
      accounts,
      source,
      matchedRemoteClient,
      warnings,
    });
    return;
  }

  if (pathname === '/api/billing/failed-payments' && req.method === 'GET') {
    try {
      const ownerKey = getPaymentsOwnerKey(req, url);
      const query = String(url.searchParams.get('q') || '').trim();
      const limit = Number.parseInt(String(url.searchParams.get('limit') || '').trim(), 10);
      const rows = await listFailedPaymentEvents(ownerKey, {
        query,
        limit: Number.isFinite(limit) && limit > 0 ? limit : 500,
      });
      send(res, 200, {
        ok: true,
        ownerKey,
        count: rows.length,
        events: rows,
      });
    } catch (error) {
      send(res, 400, { error: error.message || 'Failed to load failed payments.' });
    }
    return;
  }

  if (pathname === '/api/billing/safe-query-all-failed-trans' && req.method === 'POST') {
    try {
      const ownerKey = getPaymentsOwnerKey(req, url);
      const body = await readBody(req);
      const dryRun = Boolean(body.dryRun);
      const limit = Number.parseInt(String(body.limit ?? '').trim(), 10);
      const daysBack = Number.parseInt(String(body.daysBack ?? '').trim(), 10);
      const maxRows = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 5000) : 2000;
      const lookbackDays = Number.isFinite(daysBack) && daysBack > 0 ? Math.min(daysBack, 30) : 7;

      const integrations = await loadIntegrations();
      const billingIntegration = integrations.billing || normalizeIntegrationPayload({}, 'billing');
      const pullResult = await runFailedPaymentPull(ownerKey, {
        dryRun,
        limit: maxRows,
        daysBack: lookbackDays,
      });

      const webhookResults = [];
      if (!dryRun) {
        if (!String(billingIntegration.failedPaymentsWebhookUrl || '').trim()) {
          send(res, 400, { error: 'Billing webhook URL is not configured.' });
          return;
        }

        const ownerEvents = await listFailedPaymentEvents(ownerKey, { limit: maxRows });
        for (const event of ownerEvents) {
          if (event.webhookSyncedAt) continue;
          try {
            const hookResult = await sendFailedPaymentEventWebhook(event, billingIntegration);
            webhookResults.push({
              transactionId: event.transactionId,
              name: event.clientName,
              ok: hookResult.ok,
              status: hookResult.status,
              responseBody: String(hookResult.body || '').slice(0, 500),
            });
            const evtRecordId = paymentEventRecordId(normalizeOwnerKey(ownerKey), event.transactionId);
            const evtRows = await surql(`SELECT * FROM payment_events WHERE id = payment_events:${evtRecordId} LIMIT 1`);
            const evtRow = evtRows[0];
            if (evtRow) {
              await surqlRestPut('payment_events', evtRecordId, {
                ...evtRow,
                webhook_synced_at: hookResult.ok ? new Date().toISOString() : null,
                webhook_last_status: Number(hookResult.status || 0),
                updated_at: new Date().toISOString(),
              });
            }
          } catch (error) {
            webhookResults.push({
              transactionId: event.transactionId,
              name: event.clientName,
              ok: false,
              status: 0,
              error: error.message,
            });
          }
        }
      }

      const successCount = webhookResults.filter((entry) => entry.ok).length;
      const failedCount = webhookResults.length - successCount;
      send(res, 200, {
        ok: true,
        dryRun,
        ownerKey,
        daysBack: lookbackDays,
        merchantsScanned: pullResult.merchantsScanned || 0,
        merchantResults: pullResult.merchantResults || [],
        pulledCount: pullResult.pulledCount || 0,
        dedupedCount: pullResult.dedupedCount || 0,
        totalMatched: dryRun ? (pullResult.dedupedCount || 0) : (pullResult.upsertedCount || 0),
        attempted: dryRun ? 0 : webhookResults.length,
        successCount: dryRun ? 0 : successCount,
        failedCount: dryRun ? 0 : failedCount,
        results: dryRun ? (pullResult.events || []) : webhookResults,
      });
    } catch (error) {
      send(res, 400, { error: error.message || 'Failed to run SafeQuery.' });
    }
    return;
  }

  if (pathname === '/api/integrations/gohighlevel/webhook' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const integrations = await loadIntegrations();
      const requiredWebhookKey = String(integrations.gohighlevel?.webhookKey || ghlWebhookKey || '').trim();
      const providedKey = String(
        url.searchParams.get('key')
        || req.headers['x-ghl-key']
        || String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''),
      ).trim();

      if (requiredWebhookKey && providedKey !== requiredWebhookKey) {
        send(res, 401, { error: 'Invalid GoHighLevel webhook key.' });
        return;
      }

      const payload = extractHighLevelContactPayload(body);
      if (!payload.firstName || !payload.lastName) {
        send(res, 400, { error: 'GoHighLevel payload must include at least a first and last name.' });
        return;
      }

      const normalizedEmail = normalizeLookupValue(payload.email);
      const normalizedPhone = normalizeLookupPhone(payload.phone);
      const normalizedGhlContactId = normalizeLookupValue(payload.ghlContactId);
      const store = await readStore();
      let createdNew = false;
      let matchedBy = 'new';

      let client = store.clients.find((entry) => normalizeLookupValue(entry.ghlContactId) === normalizedGhlContactId);
      if (client) {
        matchedBy = 'ghlContactId';
      }
      if (!client && normalizedEmail) {
        client = store.clients.find((entry) => normalizeLookupValue(entry.email) === normalizedEmail);
        if (client) {
          matchedBy = 'email';
        }
      }
      if (!client && normalizedPhone) {
        client = store.clients.find((entry) => normalizeLookupPhone(entry.phone) === normalizedPhone);
        if (client) {
          matchedBy = 'phone';
        }
      }
      if (!client) {
        const normalizedFirst = normalizeLookupValue(payload.firstName);
        const normalizedLast = normalizeLookupValue(payload.lastName);
        if (normalizedFirst && normalizedLast) {
          client = store.clients.find((entry) => {
            if (normalizeLookupValue(entry.firstName) !== normalizedFirst) return false;
            if (normalizeLookupValue(entry.lastName) !== normalizedLast) return false;
            if (normalizedEmail && normalizeLookupValue(entry.email) === normalizedEmail) return true;
            if (normalizedPhone && normalizeLookupPhone(entry.phone) === normalizedPhone) return true;
            return false;
          });
          if (client) {
            matchedBy = 'name+contact';
          }
        }
      }

      const nextStatus = payload.status || client?.status || 'Lead';
      const nextPhase = client?.phase || 'None';
      const nowIso = new Date().toISOString();
      const action = client ? 'updated' : 'created';

      if (!client) {
        createdNew = true;
        client = normalizeClientRecord({
          id: generateId(),
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
          phone: payload.phone,
          status: nextStatus,
          phase: nextPhase,
          monitoringAgency: payload.monitoringAgency || '',
          monitoringUsername: payload.monitoringUsername || '',
          monitoringPassword: payload.monitoringPassword || '',
          yearlyIncome: payload.yearlyIncome || '',
          housingPayment: payload.housingPayment || '',
          debtMonthlyPayments: payload.debtMonthlyPayments || '',
          ghlContactId: payload.ghlContactId || '',
          ghlLocationId: payload.ghlLocationId || '',
          ghlSource: payload.source || 'gohighlevel-webhook',
          goal: payload.goal || '',
          notes: payload.notes || '',
          createdAt: nowIso,
        });
        store.clients.unshift(client);
      } else {
        client.firstName = payload.firstName || client.firstName;
        client.lastName = payload.lastName || client.lastName;
        client.email = payload.email || client.email;
        client.phone = payload.phone || client.phone;
        client.status = nextStatus;
        client.phase = nextPhase;
        client.monitoringAgency = payload.monitoringAgency || client.monitoringAgency || '';
        client.monitoringUsername = payload.monitoringUsername || client.monitoringUsername || '';
        client.monitoringPassword = payload.monitoringPassword || client.monitoringPassword || '';
        client.yearlyIncome = payload.yearlyIncome || client.yearlyIncome || '';
        client.housingPayment = payload.housingPayment || client.housingPayment || '';
        client.debtMonthlyPayments = payload.debtMonthlyPayments || client.debtMonthlyPayments || '';
        client.ghlContactId = payload.ghlContactId || client.ghlContactId || '';
        client.ghlLocationId = payload.ghlLocationId || client.ghlLocationId || '';
        client.ghlSource = payload.source || client.ghlSource || 'gohighlevel-webhook';
        client.goal = payload.goal || client.goal || '';
        client.notes = payload.notes || client.notes || '';
      }

      store.statuses = uniqueStatuses([...store.statuses, nextStatus]);
      store.phases = uniquePhases([...(store.phases || defaultPhases), nextPhase]);
      await writeStore(store);

      send(res, createdNew ? 201 : 200, {
        ok: true,
        action,
        client: toSafeClient(client),
        matchedBy,
      });
    } catch (error) {
      send(res, 400, { error: error.message });
    }
    return;
  }

  if (pathname.startsWith('/api/integrations/') && req.method === 'PUT') {
    try {
      const service = pathname.split('/')[3];
      const body = await readBody(req);
      const integration = await saveIntegration(service, body);
      send(res, 200, { ok: true, service, integration });
    } catch (error) {
      send(res, 400, { error: error.message });
    }
    return;
  }

  if (pathname === '/api/affiliate-links' && req.method === 'GET') {
    const affiliateLinks = await loadAffiliateLinks();
    send(res, 200, { affiliateLinks });
    return;
  }

  if (pathname === '/api/affiliate-links/credit-builder' && req.method === 'PUT') {
    try {
      const body = await readBody(req);
      const rows = await saveAffiliateSection('creditBuilder', body.rows || []);
      send(res, 200, { ok: true, section: 'creditBuilder', rows });
    } catch (error) {
      send(res, 400, { error: error.message });
    }
    return;
  }

  if (pathname === '/api/affiliate-links/credit-monitoring' && req.method === 'PUT') {
    try {
      const body = await readBody(req);
      const rows = await saveAffiliateSection('creditMonitoring', body.rows || []);
      send(res, 200, { ok: true, section: 'creditMonitoring', rows });
    } catch (error) {
      send(res, 400, { error: error.message });
    }
    return;
  }

  if (pathname.startsWith('/api/clients/') && !pathname.endsWith('/report') && !pathname.endsWith('/report-history') && req.method === 'GET') {
    const id = pathname.split('/')[3];
    const store = await readStore();
    const client = store.clients.find((entry) => entry.id === id);

    if (!client) {
      notFound(res);
      return;
    }

    send(res, 200, { client: toSafeClient(client) });
    return;
  }

  if (pathname.startsWith('/api/clients/') && pathname.endsWith('/report-history') && req.method === 'GET') {
    const id = pathname.split('/')[3];
    const store = await readStore();
    const client = store.clients.find((entry) => entry.id === id);

    if (!client) {
      notFound(res);
      return;
    }

    send(res, 200, {
      clientId: id,
      history: await listReportHistory(id),
    });
    return;
  }

  if (pathname.startsWith('/api/report-runs/') && req.method === 'GET') {
    const runId = pathname.split('/')[3];
    const run = reportRuns.get(runId);

    if (!run) {
      notFound(res);
      return;
    }

    send(res, 200, { run: getReportRunSnapshot(run) });
    return;
  }

  if (pathname === '/api/uploads/text-attachment' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const uploaded = await saveTextAttachmentFile({
        fileName: String(body.fileName || '').trim(),
        mimeType: String(body.mimeType || '').trim(),
        dataUrl: String(body.dataUrl || '').trim(),
      });
      send(res, 201, {
        ok: true,
        ...uploaded,
      });
    } catch (error) {
      send(res, 400, { error: error.message || 'Attachment upload failed.' });
    }
    return;
  }

  if (pathname.startsWith('/api/clients/') && pathname.endsWith('/send-text') && req.method === 'POST') {
    try {
      const id = pathname.split('/')[3];
      const body = await readBody(req);
      const message = String(body.message || '').trim();
      const attachments = Array.isArray(body.attachments) ? body.attachments : [];
      const forwardedProtocol = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
      const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
      const requestHost = forwardedHost || String(req.headers.host || '').trim();
      const requestOrigin = requestHost ? `${forwardedProtocol || 'https'}://${requestHost}` : '';
      const store = await readStore();
      const client = store.clients.find((entry) => entry.id === id);

      if (!client) {
        notFound(res);
        return;
      }

      let result;
      let blueBubblesError = null;
      try {
        result = await sendTextMessageViaBlueBubbles(client, message, attachments, requestOrigin);
      } catch (error) {
        blueBubblesError = error;
      }

      if (!result && blueBubblesError && shouldFallbackToGoHighLevelForText(blueBubblesError)) {
        try {
          result = await sendTextMessageViaGoHighLevel(client, message, attachments, requestOrigin);
          result.fallbackMode = 'gohighlevel-api';
          result.fallbackReason = String(blueBubblesError.message || 'BlueBubbles unavailable');
        } catch (fallbackError) {
          const primaryMessage = String(blueBubblesError.message || 'BlueBubbles unavailable');
          const fallbackMessage = String(fallbackError.message || 'GoHighLevel fallback failed');
          throw new Error(`${primaryMessage} Fallback failed: ${fallbackMessage}`);
        }
      }

      if (!result && blueBubblesError) {
        throw blueBubblesError;
      }

      if (result.contactId) {
        client.ghlContactId = result.contactId;
      }
      if (result.locationId) {
        client.ghlLocationId = result.locationId;
      }
      client.ghlSource = client.ghlSource || 'ninja-tools-outbound';
      await writeStore(store);

      send(res, 200, {
        ok: true,
        client: toSafeClient(client),
        contactId: result.contactId,
        locationId: result.locationId,
        conversationId: result.conversationId,
        messageId: result.messageId,
        mode: result.mode || 'unknown',
        fallbackMode: result.fallbackMode || '',
        fallbackReason: result.fallbackReason || '',
        providerMessage: result.providerMessage || '',
      });
    } catch (error) {
      send(res, 400, { error: error.message });
    }
    return;
  }

  if (pathname.startsWith('/api/clients/') && !pathname.endsWith('/report') && req.method === 'DELETE') {
    const id = pathname.split('/')[3];
    const store = await readStore();
    const nextClients = store.clients.filter((entry) => entry.id !== id);

    if (nextClients.length === store.clients.length) {
      notFound(res);
      return;
    }

    store.clients = nextClients;
    await writeStore(store);
    await deleteReportHistory(id);
    await deleteClientProfile(id);
    send(res, 200, { ok: true, deletedId: id });
    return;
  }

  if (pathname === '/api/client-statuses' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const status = String(body.status || '').trim();

      if (!status) {
        send(res, 400, { error: 'Status name is required.' });
        return;
      }

      const store = await readStore();
      store.statuses = uniqueStatuses([...store.statuses, status]);
      await writeStore(store);
      send(res, 201, { ok: true, statuses: store.statuses });
    } catch (error) {
      send(res, 400, { error: error.message });
    }
    return;
  }

  if (pathname === '/api/client-phases' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const phase = String(body.phase || '').trim();

      if (!phase) {
        send(res, 400, { error: 'Phase name is required.' });
        return;
      }

      const store = await readStore();
      store.phases = uniquePhases([...(store.phases || defaultPhases), phase]);
      await writeStore(store);
      send(res, 201, { ok: true, phases: store.phases });
    } catch (error) {
      send(res, 400, { error: error.message });
    }
    return;
  }

  if (pathname.startsWith('/api/clients/') && pathname.endsWith('/status') && req.method === 'PATCH') {
    try {
      const id = pathname.split('/')[3];
      const body = await readBody(req);
      const nextStatus = String(body.status || '').trim();

      if (!nextStatus) {
        send(res, 400, { error: 'Status is required.' });
        return;
      }

      const store = await readStore();
      const client = store.clients.find((entry) => entry.id === id);

      if (!client) {
        notFound(res);
        return;
      }

      client.status = nextStatus;
      store.statuses = uniqueStatuses([...store.statuses, nextStatus]);
      await writeStore(store);
      send(res, 200, { ok: true, client: toSafeClient(client), statuses: store.statuses });
    } catch (error) {
      send(res, 400, { error: error.message });
    }
    return;
  }

  if (pathname.startsWith('/api/clients/') && pathname.endsWith('/phase') && req.method === 'PATCH') {
    try {
      const id = pathname.split('/')[3];
      const body = await readBody(req);
      const nextPhase = String(body.phase || '').trim();

      if (!nextPhase) {
        send(res, 400, { error: 'Phase is required.' });
        return;
      }

      const store = await readStore();
      const client = store.clients.find((entry) => entry.id === id);

      if (!client) {
        notFound(res);
        return;
      }

      client.phase = nextPhase;
      store.phases = uniquePhases([...(store.phases || defaultPhases), nextPhase]);
      await writeStore(store);
      send(res, 200, { ok: true, client: toSafeClient(client), phases: store.phases });
    } catch (error) {
      send(res, 400, { error: error.message });
    }
    return;
  }

  if (pathname.startsWith('/api/clients/') && pathname.endsWith('/next-import') && req.method === 'PATCH') {
    try {
      const id = pathname.split('/')[3];
      const body = await readBody(req);
      const inputDays = Number.parseInt(String(body.days ?? '').trim(), 10);

      if (!Number.isFinite(inputDays)) {
        send(res, 400, { error: 'Next Import days must be a number.' });
        return;
      }

      const store = await readStore();
      const client = store.clients.find((entry) => entry.id === id);

      if (!client) {
        notFound(res);
        return;
      }

      const formatted = formatNextImportValue(String(inputDays));
      client.nextImportInt = formatted.nextImportInt;
      client.nextImportLabel = formatted.nextImportLabel;
      client.nextImportMode = 'manual';
      client.manualNextImportStartDays = inputDays;
      client.manualNextImportSetDate = getTodayIsoDate();

      await writeStore(store);
      send(res, 200, { ok: true, client: toSafeClient(client) });
    } catch (error) {
      send(res, 400, { error: error.message });
    }
    return;
  }

  if (pathname.startsWith('/api/clients/') && pathname.endsWith('/financial-profile') && req.method === 'PATCH') {
    try {
      const id = pathname.split('/')[3];
      const body = await readBody(req);
      const yearlyIncome = String(body.yearlyIncome || '').trim();

      const store = await readStore();
      const client = store.clients.find((entry) => entry.id === id);

      if (!client) {
        notFound(res);
        return;
      }

      client.yearlyIncome = yearlyIncome;
      await writeStore(store);
      send(res, 200, { ok: true, client: toSafeClient(client) });
    } catch (error) {
      send(res, 400, { error: error.message });
    }
    return;
  }

  if (pathname.startsWith('/api/clients/') && pathname.endsWith('/profile') && req.method === 'PATCH') {
    try {
      const id = pathname.split('/')[3];
      const body = await readBody(req);
      const store = await readStore();
      const ownerKey = normalizeOwnerKey(getAuthenticatedUsername(req) || appLoginUsername);
      const client = store.clients.find((entry) => entry.id === id);

      if (!client) {
        notFound(res);
        return;
      }

      const nextStatus = readOptionalStringField(body, 'status', client.status || 'Client') || 'Client';
      const nextPhase = readOptionalStringField(body, 'phase', client.phase || 'None') || 'None';
      const nextImport = formatNextImportValue(hasOwnField(body, 'nextImportInt') ? body.nextImportInt : client.nextImportInt);
      const ssn = normalizeSsnInput(readOptionalStringField(body, 'ssn', client.ssn || ''));
      const dob = normalizeDobInput(readOptionalStringField(body, 'dob', client.dob || ''));
      const nextLastName = readOptionalStringField(body, 'lastName', client.lastName || '');

      client.firstName = readOptionalStringField(body, 'firstName', client.firstName || '');
      client.lastName = nextLastName;
      client.email = readOptionalStringField(body, 'email', client.email || '');
      client.dob = dob;
      client.ssn = ssn;
      client.address = readOptionalStringField(body, 'address', client.address || '');
      client.phone = readOptionalStringField(body, 'phone', client.phone || '');
      client.spouseClientId = readOptionalStringField(body, 'spouseClientId', client.spouseClientId || '');
      client.spouseClientLabel = readOptionalStringField(body, 'spouseClientLabel', client.spouseClientLabel || '');
      client.assignedTo = readOptionalStringField(body, 'assignedTo', client.assignedTo || '');
      client.ninjaAssigned = readOptionalStringField(body, 'ninjaAssigned', client.ninjaAssigned || '');
      client.affiliateAssigned = readOptionalStringField(body, 'affiliateAssigned', client.affiliateAssigned || 'None') || 'None';
      client.status = nextStatus;
      client.phase = nextPhase;
      client.monitoringAgency = readOptionalStringField(body, 'monitoringAgency', client.monitoringAgency || '');
      client.monitoringUsername = readOptionalStringField(body, 'monitoringUsername', client.monitoringUsername || '');
      client.monitoringPassword = readOptionalStringField(body, 'monitoringPassword', client.monitoringPassword || '');
      const requestedSecret = readOptionalStringField(body, 'secretKey', client.secretKey || '');
      client.secretKey = requestedSecret || getLastFourDigits(ssn);
      client.monitoringToken = readOptionalStringField(body, 'monitoringToken', client.monitoringToken || '');
      client.portalPassword = readOptionalStringField(body, 'portalPassword', client.portalPassword || '')
        || buildDefaultPortalPassword(nextLastName, ssn);
      client.portalEnabled = readOptionalStringField(body, 'portalEnabled', client.portalEnabled ? 'on' : 'off').toLowerCase() !== 'off';
      client.language = readOptionalStringField(body, 'language', client.language || 'English') || 'English';
      client.goal = readOptionalStringField(body, 'goal', client.goal || '');
      client.notes = readOptionalStringField(body, 'notes', client.notes || '');
      client.documents = Array.isArray(body.documents)
        ? await persistClientDocumentsToS3(body.documents, { ownerKey, clientId: client.id })
        : await persistClientDocumentsToS3(client.documents, { ownerKey, clientId: client.id });
      client.yearlyIncome = readOptionalStringField(body, 'yearlyIncome', client.yearlyIncome || '');
      client.housingPayment = readOptionalStringField(body, 'housingPayment', client.housingPayment || '');
      client.debtMonthlyPayments = readOptionalStringField(body, 'debtMonthlyPayments', client.debtMonthlyPayments || '');
      client.reportDate = readOptionalStringField(body, 'reportDate', client.reportDate || '');
      client.nextImportInt = nextImport.nextImportInt;
      client.nextImportLabel = nextImport.nextImportLabel;
      if (String(body.nextImportInt ?? '').trim()) {
        const parsedManual = Number.parseInt(String(body.nextImportInt).trim(), 10);
        if (Number.isFinite(parsedManual)) {
          client.nextImportMode = 'manual';
          client.manualNextImportStartDays = parsedManual;
          client.manualNextImportSetDate = getTodayIsoDate();
        }
      }

      store.statuses = uniqueStatuses([...store.statuses, nextStatus]);
      store.phases = uniquePhases([...(store.phases || defaultPhases), nextPhase]);
      await writeStore(store);
      send(res, 200, { ok: true, client: toSafeClient(client), statuses: store.statuses, phases: store.phases });
    } catch (error) {
      send(res, 400, { error: error.message });
    }
    return;
  }

  if (pathname.startsWith('/api/clients/') && pathname.endsWith('/refresh-report') && req.method === 'POST') {
    try {
      const id = pathname.split('/')[3];
      const body = await readBody(req);
      const forcePaid = Boolean(body.forcePaid);
      const store = await readStore();
      const client = store.clients.find((entry) => entry.id === id);

      if (!client) {
        notFound(res);
        return;
      }

      // Always trust explicit credential fields sent with refresh for this
      // selected client id, then persist before deciding refresh mode.
      client.monitoringAgency = readOptionalStringField(body, 'monitoringAgency', client.monitoringAgency || '');
      client.monitoringUsername = readOptionalStringField(body, 'monitoringUsername', client.monitoringUsername || '');
      client.monitoringPassword = readOptionalStringField(body, 'monitoringPassword', client.monitoringPassword || '');
      client.monitoringToken = readOptionalStringField(body, 'monitoringToken', client.monitoringToken || '');
      const refreshSecret = readOptionalStringField(body, 'secretKey', client.secretKey || '');
      client.secretKey = refreshSecret || getLastFourDigits(client.ssn || '');

      const hydratedFrom = hydrateBrowserCredentialsFromDuplicate(store, client);
      await writeStore(store);

      const refreshMode = chooseReportRefreshMode(client);
      if (
        refreshMode.mode === 'none'
        && String(client.monitoringAgency || '').trim().toLowerCase().includes('myfree')
      ) {
        send(res, 400, { error: 'MyFreeScoreNow selected, but no Client Token is saved for this client yet.' });
        return;
      }
      if (refreshMode.mode === 'browser' && refreshMode.runnerType) {
        const initialLogs = hydratedFrom
          ? [`Recovered missing browser credentials from duplicate client ${hydratedFrom.id} before refresh.`]
          : [];
        const run = await startBrowserReportRun(client, { initialLogs });
        send(res, 202, {
          ok: true,
          started: true,
          runId: run.id,
          runnerType: refreshMode.runnerType,
          refreshMode: refreshMode.mode,
          status: run.status,
          logs: run.logs,
        });
        return;
      }

      const integrationKey = refreshMode.integrationKey || getIntegrationKeyForAgency(client.monitoringAgency);
      if (!integrationKey) {
        send(res, 400, { error: 'This client is not set to a supported token-based monitoring service.' });
        return;
      }

      // Always use the token saved on the selected client record.
      const token = String(client.monitoringToken || '').trim();
      if (!token) {
        send(res, 400, { error: 'This client does not have a saved token yet.' });
        return;
      }

      const integrations = await loadIntegrations();
      const resolvedIntegrationKey = integrationKey === 'smartcredit'
        ? 'smartcredit35540'
        : integrationKey;
      const integration = integrations[resolvedIntegrationKey];
      if (!integration || !integration.tokenId || !integration.apiSecret) {
        if (resolvedIntegrationKey === 'smartcredit35540' || resolvedIntegrationKey === 'smartcredit68951') {
          send(res, 400, { error: 'The SmartCredit integration is not configured yet.' });
          return;
        }
        send(res, 400, { error: `The ${integrationKey} integration is not configured yet.` });
        return;
      }

      const canFallbackToBrowser = integrationKey === 'smartcredit'
        && Boolean(getBrowserRunnerTypeForAgency(client.monitoringAgency))
        && String(client.monitoringUsername || '').trim()
        && String(client.monitoringPassword || '').trim();

      if (resolvedIntegrationKey === 'myfreescorenow') {
        const debugSteps = [];
        const memberEmailCandidates = [...new Set([
          String(client.monitoringUsername || '').trim(),
          String(client.email || '').trim(),
        ].filter(Boolean))];
        debugSteps.push(`member email candidates: ${memberEmailCandidates.join(', ') || '[none]'}`);
        if (!memberEmailCandidates.length) {
          send(res, 400, { error: 'This MyFreeScoreNow client needs a member email saved in username or email.' });
          return;
        }

        debugSteps.push(`client token preview: ${maskTokenPreview(token)}`);
        let loginDetails = null;
        try {
          loginDetails = await loginMyFreeScoreNow(integration);
        } catch (error) {
          throw new Error(`MyFreeScoreNow admin login failed: ${error.message}${formatMfsnDebugTrail(debugSteps)}`);
        }
        debugSteps.push('admin login: success');

        const bearerToken = String(loginDetails?.token || '').trim();
        if (!bearerToken) {
          throw new Error(`MyFreeScoreNow login succeeded but no bearer token was returned.${formatMfsnDebugTrail(debugSteps)}`);
        }

        let statusDetails = null;
        let memberEmail = '';
        let statusError = null;
        for (const candidateEmail of memberEmailCandidates) {
          debugSteps.push(`status-check: trying ${candidateEmail}`);
          try {
            statusDetails = await checkMyFreeScoreNow3bStatusWithBearer(bearerToken, candidateEmail, token);
            memberEmail = candidateEmail;
            statusError = null;
            debugSteps.push(`status-check: success for ${candidateEmail}`);
            break;
          } catch (error) {
            statusError = error;
            debugSteps.push(`status-check: failed for ${candidateEmail} -> ${error.message}`);
            if (!isMyFreeScoreNowUnauthorizedError(error)) {
              break;
            }
          }
        }
        if (!statusDetails) {
          throw new Error(`${statusError?.message || 'MyFreeScoreNow status check failed.'}${formatMfsnDebugTrail(debugSteps)}`);
        }

        const refreshAvailable = Boolean(statusDetails.json?.refresh_available);
        debugSteps.push(`refresh_available: ${refreshAvailable ? 'true' : 'false'}`);
        if (refreshAvailable) {
          try {
            await refreshMyFreeScoreNow3bWithBearer(bearerToken, memberEmail, token);
            debugSteps.push('refresh call: success');
          } catch (error) {
            debugSteps.push(`refresh call: failed -> ${error.message}`);
            throw new Error(`${error.message}${formatMfsnDebugTrail(debugSteps)}`);
          }
          await sleep(2000);
        }

        let latestDetails = null;
        try {
          latestDetails = await fetchMyFreeScoreNowCurrentReportWithBearer(bearerToken, memberEmail, token);
          debugSteps.push('fetch-3B-json: success');
        } catch (error) {
          debugSteps.push(`fetch-3B-json: failed -> ${error.message}`);
          throw new Error(`${error.message}${formatMfsnDebugTrail(debugSteps)}`);
        }
        if (!hasNonEmptyJsonPayload(latestDetails?.json, latestDetails?.text)) {
          debugSteps.push('fetch-3B-json: empty payload');
          throw new Error(`MyFreeScoreNow fetch returned empty JSON payload.${formatMfsnDebugTrail(debugSteps)}`);
        }
        const latestReportDate = parseReportDateFromJson(latestDetails.text) || client.reportDate || '';
        const previousHistory = await listReportHistory(client.id);
        const hadStoredReport = hasMeaningfulReportData(client) || previousHistory.length > 0;

        const updatedClient = await syncConsumerDirectReportToClient({
          store,
          client,
          integrationKey,
          reportJson: latestDetails.json || latestDetails.text,
          reportDate: latestReportDate,
          responseUrl: latestDetails.url,
          source: refreshAvailable ? `${integrationKey}-ordered-3b` : `${integrationKey}-current-3b`,
        });

        send(res, 200, {
          ok: true,
          orderedNewReport: refreshAvailable,
          refreshAvailable,
          reportDateBeforeOrder: parseReportDateFromJson(statusDetails.text) || '',
          reportDateAfterOrder: latestReportDate,
          savedCurrentReport: !hadStoredReport,
          message: refreshAvailable
            ? 'MyFreeScoreNow refresh completed, then latest JSON report fetched and saved.'
            : 'MyFreeScoreNow refresh is not available yet. Latest JSON report fetched and saved.',
          client: updatedClient,
          history: await listReportHistory(client.id),
          savePaths: getReportSavePaths(),
        });
        return;
      }

      try {
        if (resolvedIntegrationKey === 'smartcredit35540' || resolvedIntegrationKey === 'smartcredit68951') {
          const flow = await runSmartCreditTokenFlow(
            integration,
            token,
            forcePaid,
            client.monitoringUsername || client.email || '',
          );
          const jwtCustomerToken = extractCustomerTokenFromJwt(flow.jwt);
          if (jwtCustomerToken && jwtCustomerToken !== flow.effectiveCustomerToken) {
            throw new Error(
              `SmartCredit token mismatch: selected client token ${maskTokenPreview(flow.effectiveCustomerToken)} does not match JWT token ${maskTokenPreview(jwtCustomerToken)}.`,
            );
          }
          const latestDetails = flow.current;
          const latestReportDate = parseReportDateFromJson(latestDetails.text) || client.reportDate || '';

          const updatedClient = await syncConsumerDirectReportToClient({
            store,
            client,
            integrationKey,
            reportJson: latestDetails.json || latestDetails.text,
            reportDate: latestReportDate,
            responseUrl: latestDetails.url,
            source: `${integrationKey}-token-flow-3b-current`,
          });

          send(res, 200, {
            ok: true,
            orderedNewReport: true,
            message: 'SmartCredit token flow completed (statement check -> POST /v1/credit/3bs isNonPaid:true -> GET /v1/credit/3bs/current).',
            reportDateAfterOrder: latestReportDate,
            statementThreeBureauReportRemainingCount: flow.remainingCount,
            billingType: flow.billingType,
            tokenSource: flow.tokenSource,
            testedEndpoints: {
              statement: flow.statement?.url || '',
              customerLookup: flow.customerLookup?.url || '',
              current: flow.current?.url || '',
              effectiveCustomerToken: flow.effectiveCustomerToken || '',
            },
            jwtToken: flow.jwt,
            client: updatedClient,
            history: await listReportHistory(client.id),
            savePaths: getReportSavePaths(),
          });
          return;
        }

        let currentDetails = await fetchConsumerDirectCurrentReport(integration, token);
        if (!hasNonEmptyJsonPayload(currentDetails?.json, currentDetails?.text)) {
          await sleep(1200);
          currentDetails = await fetchConsumerDirectCurrentReport(integration, token);
          if (!hasNonEmptyJsonPayload(currentDetails?.json, currentDetails?.text)) {
            throw new Error('Current report pull returned an empty JSON payload. No data was saved.');
          }
        }
        const currentReportDate = parseReportDateFromJson(currentDetails.text) || client.reportDate || '';
        const previousHistory = await listReportHistory(client.id);
        const hadStoredReport = hasMeaningfulReportData(client) || previousHistory.length > 0;
        const syncedCurrentClient = await syncConsumerDirectReportToClient({
          store,
          client,
          integrationKey,
          reportJson: currentDetails.json || currentDetails.text,
          reportDate: currentReportDate,
          responseUrl: currentDetails.url,
          source: `${integrationKey}-current-3b`,
        });
        const reportAgeDays = getReportAgeDays(currentReportDate);

        if (reportAgeDays !== null && reportAgeDays <= 30 && !forcePaid) {
          send(res, 200, {
            ok: true,
            requiresConfirmation: true,
            message: `This report is only ${reportAgeDays} day${reportAgeDays === 1 ? '' : 's'} old, so ordering a new one may not be free. Continue?`,
            reportDate: currentReportDate,
            reportAgeDays,
            savedCurrentReport: !hadStoredReport,
            client: syncedCurrentClient,
            history: await listReportHistory(client.id),
            savePaths: getReportSavePaths(),
          });
          return;
        }

        await orderConsumerDirectNew3b(integration, token);

        let latestDetails = currentDetails;
        let latestReportDate = currentReportDate;
        for (let attempt = 0; attempt < 4; attempt += 1) {
          await sleep(4000);
          latestDetails = await fetchConsumerDirectCurrentReport(integration, token);
          latestReportDate = parseReportDateFromJson(latestDetails.text) || latestReportDate || '';
          if (latestReportDate && latestReportDate !== currentReportDate) {
            break;
          }
        }

        const updatedClient = await syncConsumerDirectReportToClient({
          store,
          client,
          integrationKey,
          reportJson: latestDetails.json || latestDetails.text,
          reportDate: latestReportDate,
          responseUrl: latestDetails.url,
          source: `${integrationKey}-ordered-3b`,
        });

        send(res, 200, {
          ok: true,
          orderedNewReport: true,
          reportDateBeforeOrder: currentReportDate,
          reportDateAfterOrder: latestReportDate,
          reportAgeDays,
          savedCurrentReport: !hadStoredReport,
          client: updatedClient,
          history: await listReportHistory(client.id),
          savePaths: getReportSavePaths(),
        });
      } catch (error) {
        const errorMessage = String(error?.message || '');
        const isCustomerNotActive = /CUSTOMER_NOT_ACTIVE/i.test(errorMessage);
        if (isCustomerNotActive) {
          send(res, 422, {
            ok: false,
            message: "Please update client's payment information",
            error: errorMessage,
            refreshMode: 'smartcredit-direct',
            requiresPaymentUpdate: true,
          });
          return;
        }
        if (canFallbackToBrowser) {
          const fallbackLogs = [`SmartCredit direct JSON method failed: ${errorMessage}`];
          if (String(error.message || '').includes('SmartCredit statement shows no remaining three-bureau reports.')) {
            const jwtFromError = error?.smartCreditContext?.jwt || '';
            try {
              const newestOrderId = await fetchSmartCreditNewestOrderId(jwtFromError);
              if (newestOrderId) {
                fallbackLogs.push(`SmartCredit metadata newest order ID: ${newestOrderId}`);
                try {
                  const orderDetails = await fetchSmartCreditReportByOrderId(jwtFromError, newestOrderId);
                  if (hasNonEmptyJsonPayload(orderDetails?.json, orderDetails?.text)) {
                    const latestReportDate = parseReportDateFromJson(orderDetails.text) || client.reportDate || '';
                    const updatedClient = await syncConsumerDirectReportToClient({
                      store,
                      client,
                      integrationKey,
                      reportJson: orderDetails.json || orderDetails.text,
                      reportDate: latestReportDate,
                      responseUrl: orderDetails.url,
                      source: `${integrationKey}-metadata-order-id`,
                    });

                    send(res, 200, {
                      ok: true,
                      orderedNewReport: false,
                      message: 'SmartCredit statement had no remaining 3-bureau reports. Saved JSON from newest metadata order ID.',
                      metadataNewestOrderId: newestOrderId,
                      reportDateAfterOrder: latestReportDate,
                      client: updatedClient,
                      history: await listReportHistory(client.id),
                      savePaths: getReportSavePaths(),
                    });
                    return;
                  }
                  fallbackLogs.push(`SmartCredit order ID ${newestOrderId} returned empty JSON payload`);
                } catch (orderErr) {
                  fallbackLogs.push(`SmartCredit order ID fetch failed (${newestOrderId}): ${orderErr.message}`);
                }
              } else {
                fallbackLogs.push('SmartCredit metadata newest order ID: not found');
              }
            } catch (metaErr) {
              fallbackLogs.push(`SmartCredit metadata lookup failed: ${metaErr.message}`);
            }
          }
          fallbackLogs.push('Falling back to browser-based SmartCredit JSON pull.');
          const run = await startBrowserReportRun(client, {
            initialLogs: fallbackLogs,
          });
          send(res, 202, {
            ok: true,
            started: true,
            runId: run.id,
            runnerType: run.agency,
            refreshMode: 'browser-fallback',
            fallbackReason: error.message,
            status: run.status,
            logs: run.logs,
          });
          return;
        }

        throw error;
      }
    } catch (error) {
      send(res, 400, { error: error.message });
    }
    return;
  }

  if (pathname === '/api/clients' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const ownerKey = normalizeOwnerKey(getAuthenticatedUsername(req) || appLoginUsername);

      if (!body.firstName?.trim() || !body.lastName?.trim()) {
        send(res, 400, { error: 'First name and last name are required.' });
        return;
      }

      const store = await readStore();
      const reportHtml = String(body.creditReportHtml || '').trim()
        || buildPlaceholderCreditReportHtml(String(body.firstName || '').trim(), String(body.lastName || '').trim());
      const ssn = normalizeSsnInput(String(body.ssn || '').trim());
      const dob = normalizeDobInput(String(body.dob || '').trim());
      const clientId = generateId();
      const parsedReportDate = body.reportDate?.trim()
        || parseReportDateFromHtml(reportHtml || '')
        || parseReportDateFromFilename(body.creditReportFileName || '');

      const normalizedFirst = normalizeLookupValue(body.firstName || '');
      const normalizedLast = normalizeLookupValue(body.lastName || '');
      const normalizedEmail = normalizeLookupValue(body.email || '');
      const normalizedPhone = normalizeLookupPhone(body.phone || '');

      const existingClient = store.clients.find((entry) => {
        if (normalizeLookupValue(entry.firstName) !== normalizedFirst) return false;
        if (normalizeLookupValue(entry.lastName) !== normalizedLast) return false;
        if (normalizedEmail && normalizeLookupValue(entry.email) === normalizedEmail) return true;
        if (normalizedPhone && normalizeLookupPhone(entry.phone) === normalizedPhone) return true;
        return false;
      });

      const client = {
        id: clientId,
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        email: body.email?.trim() || '',
        dob,
        ssn,
        address: String(body.address || '').trim(),
        phone: body.phone?.trim() || '',
        spouseClientId: String(body.spouseClientId || '').trim(),
        spouseClientLabel: String(body.spouseClientLabel || '').trim(),
        assignedTo: String(body.assignedTo || '').trim(),
        ninjaAssigned: String(body.ninjaAssigned || '').trim(),
        affiliateAssigned: String(body.affiliateAssigned || 'None').trim() || 'None',
        status: body.status?.trim() || 'Client',
        phase: String(body.phase || '').trim() || 'None',
        monitoringAgency: String(body.monitoringAgency || '').trim(),
        yearlyIncome: String(body.yearlyIncome || '').trim(),
        housingPayment: String(body.housingPayment || '').trim(),
        debtMonthlyPayments: String(body.debtMonthlyPayments || '').trim(),
        monitoringUsername: String(body.monitoringUsername || '').trim(),
        monitoringPassword: String(body.monitoringPassword || '').trim(),
        secretKey: String(body.secretKey || '').trim() || getLastFourDigits(ssn),
        monitoringToken: String(body.monitoringToken || '').trim(),
        portalPassword: String(body.portalPassword || '').trim() || buildDefaultPortalPassword(body.lastName, ssn),
        portalEnabled: String(body.portalEnabled || 'on').trim().toLowerCase() !== 'off',
        language: String(body.language || 'English').trim() || 'English',
        goal: String(body.goal || '').trim(),
        documents: await persistClientDocumentsToS3(body.documents, { ownerKey, clientId }),
        reportDate: parsedReportDate,
        nextImportInt: String(body.nextImportInt || '').trim(),
        nextImportLabel: String(body.nextImportLabel || '').trim(),
        nextImportMode: 'manual',
        manualNextImportStartDays: Number.parseInt(String(body.nextImportInt || '').trim(), 10) || null,
        manualNextImportSetDate: getTodayIsoDate(),
        refreshNextImportStartDate: '',
        creditReportJson: stringifyJsonValue(body.creditReportJson || ''),
        creditReportSource: String(body.creditReportSource || 'html-upload').trim(),
        lastSyncedAt: new Date().toISOString(),
        creditReportFileName: body.creditReportFileName?.trim() || 'missing-credit-report.html',
        creditReportHtml: reportHtml,
        createdAt: new Date().toISOString(),
      };
      if (existingClient) {
        const existingCreatedAt = existingClient.createdAt || client.createdAt;
        Object.assign(existingClient, {
          ...existingClient,
          ...client,
          id: existingClient.id,
          createdAt: existingCreatedAt,
        });
      } else {
        store.clients.unshift(client);
      }
      store.statuses = uniqueStatuses([...store.statuses, client.status]);
      store.phases = uniquePhases([...(store.phases || defaultPhases), client.phase]);
      await writeStore(store);
      const savedClient = existingClient || client;
      await insertReportSnapshot(savedClient, {
        source: savedClient.creditReportSource,
        reportDate: savedClient.reportDate,
        reportFileName: savedClient.creditReportFileName,
        reportHtml: savedClient.creditReportHtml,
        reportJson: savedClient.creditReportJson,
        createdAt: savedClient.lastSyncedAt,
      });
      let gohighlevelSync = { attempted: false, reason: 'not-run' };
      try {
        gohighlevelSync = await sendClientToGoHighLevelWebhook(savedClient, { event: existingClient ? 'client.updated' : 'client.created' });
        if (gohighlevelSync.ok && gohighlevelSync.contactId) {
          savedClient.ghlContactId = gohighlevelSync.contactId;
          savedClient.ghlLocationId = gohighlevelSync.locationId || savedClient.ghlLocationId || '';
          savedClient.ghlSource = 'ninja-tools-outbound';
          await writeStore(store);
        }
      } catch (error) {
        gohighlevelSync = {
          attempted: true,
          ok: false,
          error: error.message,
        };
      }

      send(res, 201, {
        client: toSafeClient(savedClient),
        gohighlevelSync,
        deduped: Boolean(existingClient),
      });
    } catch (error) {
      send(res, 400, { error: error.message });
    }
    return;
  }

  if (pathname === '/api/clients/import-csv' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const rows = Array.isArray(body.rows) ? body.rows : [];

      const importedClients = rows
        .map((row) => {
          const firstName = String(row.firstName || '').trim();
          const lastName = String(row.lastName || '').trim();

          if (!firstName || !lastName) {
            return null;
          }

          return {
            id: generateId(),
            firstName,
            lastName,
            email: String(row.email || '').trim(),
            phone: String(row.phone || '').trim(),
            dob: normalizeDobInput(String(row.dob || row.DOB || '').trim()),
            ssn: normalizeSsnInput(String(row.ssn || row.SSN || '').trim()),
            status: String(row.status || '').trim() || 'Client',
            phase: String(row.phase || '').trim() || 'None',
            monitoringAgency: '',
            yearlyIncome: '',
            housingPayment: '',
            debtMonthlyPayments: '',
            monitoringUsername: '',
            monitoringPassword: '',
            secretKey: '',
            monitoringToken: '',
            goal: '',
            reportDate: String(row.reportDate || '').trim(),
            nextImportInt: String(row.nextImportInt || '').trim(),
            nextImportLabel: String(row.nextImportLabel || '').trim(),
            nextImportMode: 'manual',
            manualNextImportStartDays: Number.parseInt(String(row.nextImportInt || '').trim(), 10) || null,
            manualNextImportSetDate: getTodayIsoDate(),
            refreshNextImportStartDate: '',
            creditReportJson: '',
            creditReportSource: 'csv-import',
            lastSyncedAt: '',
            creditReportFileName: 'imported-from-csv.html',
            creditReportHtml: buildPlaceholderCreditReportHtml(firstName, lastName),
            createdAt: new Date().toISOString(),
          };
        })
        .filter(Boolean);

      if (importedClients.length === 0) {
        send(res, 400, { error: 'No valid clients were found in the CSV.' });
        return;
      }

      const store = await readStore();
      store.clients = [...importedClients, ...store.clients];
      store.statuses = uniqueStatuses([...store.statuses, ...importedClients.map((client) => client.status)]);
      store.phases = uniquePhases([...(store.phases || defaultPhases), ...importedClients.map((client) => client.phase)]);
      await writeStore(store);
      send(res, 201, {
        ok: true,
        importedCount: importedClients.length,
        clients: importedClients.map(toSafeClient),
      });
    } catch (error) {
      send(res, 400, { error: error.message });
    }
    return;
  }

  if (pathname === '/api/report-sync/identityiq' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const clientId = String(body.clientId || '').trim();
      const firstName = String(body.firstName || '').trim();
      const lastName = String(body.lastName || '').trim();
      const email = String(body.email || '').trim();

      if (!clientId && (!firstName || !lastName)) {
        send(res, 400, { error: 'First name and last name are required for report sync.' });
        return;
      }

      const store = await readStore();
      const client = (clientId
        ? store.clients.find((entry) => String(entry.id || '').trim() === clientId)
        : null) || findClientForSync(store.clients, {
        firstName,
        lastName,
        email,
        monitoringUsername: body.monitoringUsername,
      });

      if (!client) {
        send(res, 404, { error: 'No matching client was found for this IdentityIQ report sync.' });
        return;
      }

      const reportHtml = String(body.reportHtml || '').trim() || client.creditReportHtml;
      const reportJsonText = stringifyJsonValue(body.reportJsonRaw || body.reportJson || '');
      const parsedReportJson = parseJsonValue(reportJsonText);
      if (!parsedReportJson) {
        send(res, 400, { error: 'IdentityIQ sync refused: report JSON is missing or invalid.' });
        return;
      }

      if (Array.isArray(parsedReportJson) && parsedReportJson.length === 0) {
        send(res, 400, { error: 'IdentityIQ sync refused: report JSON array is empty.' });
        return;
      }

      if (!Array.isArray(parsedReportJson) && typeof parsedReportJson === 'object' && Object.keys(parsedReportJson).length === 0) {
        send(res, 400, { error: 'IdentityIQ sync refused: report JSON object is empty.' });
        return;
      }
      const reportDate = getTodayIsoDate();
      const syncedAt = new Date().toISOString();
      const reportFileName = String(body.creditReportFileName || '').trim()
        || formatReportFileName(reportDate, 'identityiq-report');
      const reportSource = String(body.creditReportSource || 'identityiq-json').trim();
      const previousReportDate = String(client.reportDate || '');
      const previousReportJson = String(client.creditReportJson || '');

      await insertReportSnapshot(client, {
        source: reportSource,
        monitoringAgency: body.monitoringAgency || 'IdentityIQ',
        reportDate,
        reportFileName,
        reportHtml,
        reportJsonRaw: reportJsonText,
        responseUrl: body.responseUrl || '',
        createdAt: syncedAt,
        metadata: {
          monitoringUsername: body.monitoringUsername || '',
          matchedBy: clientId ? 'client-id' : 'first-last-email',
        },
      });

      client.reportDate = reportDate;
      client.creditReportFileName = reportFileName;
      client.creditReportHtml = reportHtml;
      client.creditReportJson = reportJsonText;
      client.creditReportSource = reportSource;
      client.monitoringAgency = String(body.monitoringAgency || 'IdentityIQ').trim();
      client.monitoringUsername = String(body.monitoringUsername || client.monitoringUsername || '').trim();
      client.lastSyncedAt = syncedAt;
      client.nextImportInt = '';
      client.nextImportLabel = '';
      if (reportDate !== previousReportDate || reportJsonText !== previousReportJson) {
        client.nextImportMode = 'refresh-success';
        client.refreshNextImportStartDate = getTodayIsoDate();
        client.manualNextImportStartDays = null;
        client.manualNextImportSetDate = '';
      }
      client.phase = advanceClientPhase(client.phase);
      store.phases = uniquePhases([...(store.phases || defaultPhases), client.phase]);

      await writeStore(store);

      send(res, 200, {
        ok: true,
        jsonLength: String(reportJsonText || '').length,
        client: toSafeClient(client),
        history: await listReportHistory(client.id),
        savePaths: getReportSavePaths(),
      });
    } catch (error) {
      send(res, 400, { error: error.message });
    }
    return;
  }

  if (pathname === '/api/report-sync/smartcredit' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const clientId = String(body.clientId || '').trim();
      const firstName = String(body.firstName || '').trim();
      const lastName = String(body.lastName || '').trim();
      const email = String(body.email || '').trim();
      const monitoringUsername = String(body.monitoringUsername || '').trim();
      const monitoringPassword = String(body.monitoringPassword || '').trim();
      const reportJsonText = stringifyJsonValue(body.reportJsonRaw || body.reportJson || '');
      if (!reportJsonText.trim()) {
        send(res, 400, { error: 'SmartCredit report sync requires JSON report data.' });
        return;
      }

      if ((!firstName || !lastName) && !monitoringUsername) {
        send(res, 400, { error: 'A matching SmartCredit sync needs either first/last name or a monitoring username.' });
        return;
      }

      const store = await readStore();
      const client = (clientId
        ? store.clients.find((entry) => String(entry.id || '').trim() === clientId)
        : null) || findClientForSync(store.clients, {
        firstName,
        lastName,
        email,
        monitoringUsername,
        monitoringPassword,
      });

      if (!client) {
        send(res, 404, {
          error: `No matching client was found for this SmartCredit report sync using monitoring username "${monitoringUsername || '[missing]'}"${firstName || lastName ? ` and name "${`${firstName} ${lastName}`.trim()}"` : ''}.`,
        });
        return;
      }

      await insertReportSnapshot(client, {
        source: client.creditReportSource || 'pre-smartcredit-sync',
        monitoringAgency: client.monitoringAgency || body.monitoringAgency || 'SmartCredit',
        reportDate: client.reportDate || '',
        reportFileName: client.creditReportFileName || '',
        reportHtml: client.creditReportHtml || '',
        reportJsonRaw: client.creditReportJson || '',
        responseUrl: '',
        createdAt: new Date().toISOString(),
        metadata: {
          preservedBeforeSync: true,
          matchedBy: clientId ? 'client-id' : 'first-last-email',
        },
      });

      const reportDate = getTodayIsoDate();
      const syncedAt = new Date().toISOString();
      const reportFileName = String(body.creditReportFileName || '').trim()
        || formatReportFileName(reportDate, 'smartcredit-report').replace(/\.html$/i, '.json');
      const reportSource = String(body.creditReportSource || 'smartcredit-json').trim();
      const previousReportDate = String(client.reportDate || '');
      const previousReportJson = String(client.creditReportJson || '');

      client.reportDate = reportDate;
      client.creditReportJson = reportJsonText;
      client.creditReportSource = reportSource;
      client.creditReportFileName = reportFileName;
      client.monitoringAgency = String(body.monitoringAgency || client.monitoringAgency || 'SmartCredit').trim();
      client.monitoringUsername = String(body.monitoringUsername || client.monitoringUsername || '').trim();
      client.lastSyncedAt = syncedAt;
      client.nextImportInt = '';
      client.nextImportLabel = '';
      if (reportDate !== previousReportDate || reportJsonText !== previousReportJson) {
        client.nextImportMode = 'refresh-success';
        client.refreshNextImportStartDate = getTodayIsoDate();
        client.manualNextImportStartDays = null;
        client.manualNextImportSetDate = '';
      }
      client.phase = advanceClientPhase(client.phase);
      store.phases = uniquePhases([...(store.phases || defaultPhases), client.phase]);

      await writeStore(store);

      send(res, 200, {
        ok: true,
        client: toSafeClient(client),
        history: await listReportHistory(client.id),
        savePaths: getReportSavePaths(),
      });
    } catch (error) {
      send(res, 400, { error: error.message });
    }
    return;
  }

  if (pathname.startsWith('/api/clients/') && pathname.endsWith('/report') && req.method === 'GET') {
    const parts = pathname.split('/');
    const id = parts[3];
    const store = await readStore();
    const client = store.clients.find((entry) => entry.id === id);

    if (!client) {
      notFound(res);
      return;
    }

    const generatedFromJson = buildCreditReportHtmlFromJson(client);
    if (generatedFromJson) {
      send(res, 200, generatedFromJson, 'text/html; charset=utf-8');
      return;
    }

    const reportHtml = String(client.creditReportHtml || '').trim();
    if (reportHtml && !isPlaceholderCreditReportHtml(reportHtml)) {
      send(res, 200, reportHtml, 'text/html; charset=utf-8');
      return;
    }

    send(res, 200, buildPlaceholderCreditReportHtml(client.firstName || 'Client', client.lastName || ''), 'text/html; charset=utf-8');
    return;
  }

    await serveStatic(res, pathname);
    } catch (error) {
      send(res, 500, { error: error?.message || 'Server error.' });
    }
  });
});

const io = new SocketIOServer(server, {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  cors: {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const allowedOrigin = resolveCorsOrigin(origin);
      if (allowedOrigin) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS origin not allowed for socket.io'));
    },
    credentials: true,
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  socket.emit('socket:ready', { ok: true, id: socket.id, at: new Date().toISOString() });
});

server.listen(port, host, async () => {
  await ensureStorageReady();
  console.log(`Tools Ninja is running at http://${host}:${port}`);
});
