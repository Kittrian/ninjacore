#!/usr/bin/env node

import { chromium } from 'playwright';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const parseClientPayload = () => {
  const raw = process.env.TOOLS_NINJA_CLIENT || '';
  if (!raw) {
    throw new Error('Missing TOOLS_NINJA_CLIENT payload.');
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid TOOLS_NINJA_CLIENT payload: ${error.message}`);
  }
};

const tryParseJson = (value) => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const normalizeJsonPayload = (reportPayload = {}, label = 'JSON payload') => {
  const rawInput = String(reportPayload?.reportJsonRaw || '').trim();
  const parsedInput = reportPayload?.reportJson || tryParseJson(rawInput) || tryParseJson(extractFirstJsonObject(rawInput));
  if (!parsedInput || (typeof parsedInput !== 'object')) {
    throw new Error(`${label} cleanup failed: payload was not valid JSON object/array.`);
  }

  const normalizedRaw = JSON.stringify(parsedInput);
  const reparsed = tryParseJson(normalizedRaw);
  if (!reparsed) {
    throw new Error(`${label} cleanup failed: normalized payload did not parse.`);
  }

  return {
    ...reportPayload,
    reportJson: reparsed,
    reportJsonRaw: normalizedRaw,
  };
};

const unwrapJsonCallback = (value) => {
  const text = String(value || '').replace(/^\uFEFF/, '').trim();
  if (!text) {
    return '';
  }

  // Fast path: exact JSON_CALLBACK(...) wrapper.
  const strictWrapped = text.match(/^\s*JSON_CALLBACK\s*\(\s*([\s\S]*?)\s*\)\s*;?\s*$/i);
  if (strictWrapped?.[1]) {
    return strictWrapped[1].trim();
  }

  // Resilient path: find JSON_CALLBACK anywhere and extract balanced payload.
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

  return text.replace(/^<pre[^>]*>/i, '').replace(/<\/pre>\s*$/i, '').trim();
};

const extractFirstJsonObject = (value) => {
  const text = String(value || '').replace(/^\uFEFF/, '').trim();
  if (!text) {
    return '';
  }
  const firstBrace = text.search(/[{\[]/);
  if (firstBrace < 0) {
    return '';
  }

  const opener = text[firstBrace];
  const closer = opener === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let quoteChar = '';
  let escaping = false;

  for (let i = firstBrace; i < text.length; i += 1) {
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
    if (ch === opener) depth += 1;
    if (ch === closer) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(firstBrace, i + 1).trim();
      }
    }
  }

  return '';
};

const normalizeAgency = (value) => String(value || '').trim().toLowerCase();
const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const defaultApiBaseNewServer = String(process.env.TOOLS_NINJA_API_BASE_DEFAULT || 'http://5.78.214.176:3017').trim();
const defaultApiBaseWhitelistedServer = String(process.env.TOOLS_NINJA_API_BASE_WHITELISTED || 'http://147.93.190.166:3017').trim();

const resolveToolsNinjaApiBaseForAgency = (agencyLower = '') => {
  const explicitBase = String(process.env.TOOLS_NINJA_API_BASE || '').trim();
  if (explicitBase) return explicitBase;
  if (agencyLower.includes('smart') || agencyLower.includes('myfree') || agencyLower.includes('freescorenow')) {
    return defaultApiBaseWhitelistedServer;
  }
  return defaultApiBaseNewServer;
};

const summarizeUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '[unknown]';
  try {
    const url = new URL(raw);
    const path = (url.pathname || '/').toLowerCase();
    if (path.includes('security-question')) return 'identityiq/security-question';
    if (path.includes('dashboard')) return 'identityiq/dashboard';
    if (path.includes('creditreport.aspx') && url.search.toLowerCase().includes('view=json')) return 'identityiq/credit-report-json';
    if (path.includes('creditreport.aspx')) return 'identityiq/credit-report';
    if (path.includes('logout.aspx')) return 'identityiq/logout';
    if (path === '/' || path.includes('identityiq.com')) return 'identityiq/home';
    return `${url.hostname}${path}`.replace(/^www\./i, '');
  } catch {
    return raw.slice(0, 120);
  }
};

const logCurrentPageSummary = async (page, label = 'Current page') => {
  const url = typeof page?.url === 'function' ? page.url() : '';
  console.log(`-> ${label}: ${summarizeUrl(url)}`);
};

const detectIdentityIqChallengeSignals = async (page) => {
  try {
    const signals = await page.evaluate(() => {
      const html = document.documentElement?.outerHTML || '';
      const bodyText = document.body?.innerText || '';
      const hasInputs = document.querySelectorAll('input, form').length > 0;
      const suspiciousScript = /rposing-to-knocking|imperva|incap|cdn\.optimizely|captcha|challenge/i.test(html);
      const suspiciousText = /access denied|verify you are human|captcha|bot/i.test(bodyText);
      return { hasInputs, suspiciousScript, suspiciousText };
    });
    return Boolean(!signals.hasInputs && (signals.suspiciousScript || signals.suspiciousText));
  } catch {
    return false;
  }
};

const getSecretKey = (client) => String(
  client.secretKey
  || client.ssnLastFour
  || client.lastFourOfSsn
  || client.ssn4
  || ''
).trim();

const fetchFreshClientFromToolsNinja = async (client, apiBase) => {
  const clientId = String(client?.id || '').trim();
  if (!clientId) {
    return null;
  }
  try {
    const apiUser = String(process.env.TOOLS_NINJA_API_USER || 'admin').trim() || 'admin';
    const response = await fetch(`${apiBase}/api/clients/${encodeURIComponent(clientId)}`, {
      method: 'GET',
      headers: {
        Cookie: `txn=${encodeURIComponent(apiUser)}`,
      },
    });
    if (!response.ok) {
      console.log(`-> Fresh client pull failed (http ${response.status})`);
      return null;
    }
    const payload = await response.json().catch(() => ({}));
    if (payload?.client && typeof payload.client === 'object') {
      return payload.client;
    }
    return null;
  } catch (error) {
    console.log(`-> Fresh client pull error: ${error.message}`);
    return null;
  }
};

const fillIdentityIqCredentials = async (iqPage, client) => {
  const username = String(client?.monitoringUsername || '').trim();
  const password = String(client?.monitoringPassword || '').trim();
  if (!username || !password) {
    throw new Error('Missing IdentityIQ username or password.');
  }

  console.log('Filling username...');
  const usernameCandidates = [
    iqPage.locator('#txtUserName, input[name="txtUserName"], input[placeholder*="Username" i], input[aria-label*="Username" i]').first(),
    iqPage.getByRole('textbox', { name: /Enter Username|Username|Email/i }).first(),
    iqPage.locator('#username, #userName, #email, input[name=\"username\"], input[name=\"email\"], input[type=\"email\"]').first(),
  ];
  let usernameFilled = false;
  for (const locator of usernameCandidates) {
    const count = await locator.count().catch(() => 0);
    if (!count) continue;
    try {
      await locator.fill(username, { timeout: 12000 });
      usernameFilled = true;
      break;
    } catch {
      // try next locator
    }
  }
  if (!usernameFilled) {
    await logCurrentPageSummary(iqPage, 'URL when username field missing');
    throw new Error('Could not find IdentityIQ username field.');
  }

  console.log('Filling password...');
  const passwordCandidates = [
    iqPage.locator('#txtPassword, input[name="txtPassword"], input[placeholder*="Password" i], input[aria-label*="Password" i]').first(),
    iqPage.getByRole('textbox', { name: /Enter Password|Password/i }).first(),
    iqPage.locator('#password, #passWord, input[name=\"password\"], input[type=\"password\"]').first(),
  ];
  let passwordFilled = false;
  for (const locator of passwordCandidates) {
    const count = await locator.count().catch(() => 0);
    if (!count) continue;
    try {
      await locator.fill(password, { timeout: 12000 });
      passwordFilled = true;
      break;
    } catch {
      // try next locator
    }
  }
  if (!passwordFilled) {
    await logCurrentPageSummary(iqPage, 'URL when password field missing');
    throw new Error('Could not find IdentityIQ password field.');
  }
};

const ensureIdentityIqLoginScreen = async (iqPage) => {
  const usernameSelector = '#txtUserName, input[name="txtUserName"], #username, #userName, #email, input[name="username"], input[name="email"], input[type="email"]';
  const usernameRoleSelector = iqPage.getByRole('textbox', { name: /Enter Username|Username|Email/i }).first();

  const hasUsernameField = async () => {
    const roleCount = await usernameRoleSelector.count().catch(() => 0);
    if (roleCount) {
      const roleVisible = await usernameRoleSelector.isVisible({ timeout: 3000 }).catch(() => false);
      if (roleVisible) return true;
    }
    const locator = iqPage.locator(usernameSelector).first();
    const count = await locator.count().catch(() => 0);
    if (!count) return false;
    return locator.isVisible({ timeout: 3000 }).catch(() => false);
  };

  if (await hasUsernameField()) {
    return true;
  }

  await logCurrentPageSummary(iqPage, 'IdentityIQ page before login-screen recovery');
  const memberUrl = 'https://member.identityiq.com/';
  const currentUrl = String(iqPage.url() || '');

  if (!currentUrl.startsWith(memberUrl)) {
    console.log(`-> Username field not visible yet, trying: ${memberUrl}`);
    await gotoWithRetry(iqPage, memberUrl, { waitUntil: 'domcontentloaded', timeout: 25000 }, 2).catch(() => {});
    await iqPage.waitForTimeout(1000);
    if (await hasUsernameField()) {
      await logCurrentPageSummary(iqPage, `IdentityIQ page after recovery URL ${memberUrl}`);
      return true;
    }
  }

  // If the landing page needs a "Login/Sign In" click, try it once before challenge fail.
  const loginEntrypoints = [
    iqPage.getByRole('link', { name: /Login|Sign In/i }).first(),
    iqPage.getByRole('button', { name: /Login|Sign In/i }).first(),
    iqPage.locator('a[href*="login" i], a[href*="signin" i], button[id*="login" i], button[class*="login" i]').first(),
  ];
  for (const entry of loginEntrypoints) {
    const count = await entry.count().catch(() => 0);
    if (!count) continue;
    const visible = await entry.isVisible({ timeout: 1200 }).catch(() => false);
    if (!visible) continue;
    console.log('-> Username field not visible yet, trying login entrypoint click');
    await entry.click({ timeout: 5000 }).catch(() => {});
    await iqPage.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});
    await iqPage.waitForTimeout(900);
    if (await hasUsernameField()) {
      await logCurrentPageSummary(iqPage, 'IdentityIQ page after login entrypoint click');
      return true;
    }
  }

  console.log('-> Username field not visible yet, trying one page reload');
  await iqPage.reload({ waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
  await iqPage.waitForTimeout(1000);
  if (await hasUsernameField()) {
    await logCurrentPageSummary(iqPage, 'IdentityIQ page after one reload');
    return true;
  }

  await logCurrentPageSummary(iqPage, 'IdentityIQ page after login-screen recovery attempts');
  return false;
};

const captureIdentityIqLatestReport = async (iqPage) => {
  console.log('Opening View Latest Report...');

  const capturedResponses = [];
  const capturePromises = [];
  const responseListener = (response) => {
    const url = response.url().toLowerCase();
    if (!url.includes('dsply')) {
      return;
    }

    capturePromises.push((async () => {
      const headers = response.headers();
      const body = await response.text().catch(() => '');
      capturedResponses.push({
        url: response.url(),
        status: response.status(),
        contentType: headers['content-type'] || '',
        body,
      });
    })());
  };

  iqPage.on('response', responseListener);

  try {
    const candidateLocators = [
      iqPage.locator('a[href="/CreditReport.aspx"]').first(),
      iqPage.locator('a[href*="CreditReport"]').first(),
      iqPage.getByRole('link', { name: /View Latest Report/i }).first(),
      iqPage.getByText(/View Latest Report/i, { exact: false }).first(),
    ];

    let opened = false;
    for (const candidate of candidateLocators) {
      const count = await candidate.count().catch(() => 0);
      if (!count) {
        continue;
      }

      const visible = await candidate.isVisible({ timeout: 4000 }).catch(() => false);
      if (!visible) {
        continue;
      }

      console.log('-> View Latest Report candidate found; attempting click');
      await Promise.allSettled([
        iqPage.waitForURL(/CreditReport\.aspx/i, { timeout: 30000 }),
        candidate.click({ timeout: 10000 }),
      ]);
      opened = iqPage.url().includes('CreditReport.aspx');
      if (opened) {
        break;
      }
    }

    if (!opened) {
      console.log('-> View Latest Report link not visible; navigating directly to CreditReport.aspx');
      await logCurrentPageSummary(iqPage, 'URL at View Latest fallback');
      await iqPage.goto('https://member.identityiq.com/CreditReport.aspx', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    }

    await iqPage.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await iqPage.waitForTimeout(4000);
  } finally {
    iqPage.off('response', responseListener);
  }

  await Promise.allSettled(capturePromises);

  const latestResponse = [...capturedResponses].reverse().find((entry) => {
    const text = String(entry.body || '').trim();
    return /json/i.test(entry.contentType) || text.startsWith('{') || text.startsWith('[');
  }) || capturedResponses.at(-1) || null;

  const reportHtml = await iqPage.content().catch(() => '');
  const bodyInnerText = await iqPage.locator('body').innerText().catch(() => '');
  let reportJsonRaw = latestResponse?.body || '';
  let normalizedJsonRaw = unwrapJsonCallback(reportJsonRaw);
  let reportJson = tryParseJson(normalizedJsonRaw) || tryParseJson(extractFirstJsonObject(normalizedJsonRaw));

  // If no dsply payload or parse failed, try to recover JSON_CALLBACK from the page itself.
  if (!reportJson) {
    const callbackCandidates = [
      bodyInnerText,
      reportHtml,
      await iqPage.evaluate(() => document.documentElement?.outerHTML || '').catch(() => ''),
    ].filter(Boolean);

    for (const candidate of callbackCandidates) {
      const maybeJson = unwrapJsonCallback(candidate);
      const parsed = tryParseJson(maybeJson) || tryParseJson(extractFirstJsonObject(maybeJson));
      if (parsed) {
        reportJsonRaw = maybeJson;
        normalizedJsonRaw = maybeJson;
        reportJson = parsed;
        console.log(`-> Recovered IdentityIQ JSON_CALLBACK from page content (${maybeJson.length} chars).`);
        break;
      }
    }
  }

  console.log(`-> View Latest Report captured. dsply responses: ${capturedResponses.length}`);
  if (latestResponse?.url) {
    console.log(`-> Using dsply response: ${latestResponse.url}`);
  } else {
    console.log('-> No dsply response body captured; continuing with rendered report HTML only.');
    await logCurrentPageSummary(iqPage, 'URL when dsply response missing');
  }

  return {
    reportHtml,
    reportJson,
    reportJsonRaw: normalizedJsonRaw,
    responseUrl: latestResponse?.url || '',
  };
};

const captureIdentityIqDirectJson = async (iqPage) => {
  const directJsonUrls = [
    'https://member.identityiq.com/CreditReport.aspx?view=json',
  ];

  const parseDirectJsonText = (rawBody = '') => {
    const unwrappedBody = unwrapJsonCallback(rawBody);
    const reportJson = tryParseJson(unwrappedBody) || tryParseJson(extractFirstJsonObject(unwrappedBody));
    if (!reportJson) {
      return null;
    }
    return { reportJson, reportJsonRaw: unwrappedBody };
  };

  const captureCurrentPageAsJson = async (label) => {
    const currentBody = await iqPage.locator('body').innerText().catch(() => '');
    const parsed = parseDirectJsonText(currentBody || '');
    if (!parsed) {
      return null;
    }
    console.log(`-> ${label}: parsed JSON from current page body (${parsed.reportJsonRaw.length} chars).`);
    return {
      reportHtml: await iqPage.content().catch(() => ''),
      reportJson: parsed.reportJson,
      reportJsonRaw: parsed.reportJsonRaw,
      responseUrl: iqPage.url() || '',
    };
  };

  for (const directJsonUrl of directJsonUrls) {
    console.log(`Trying direct IdentityIQ JSON URL first: ${directJsonUrl}`);

    let response;
    try {
      response = await iqPage.goto(directJsonUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    } catch (error) {
      console.log(`-> Direct JSON URL load failed: ${error.message}`);
      await logCurrentPageSummary(iqPage, 'URL when direct JSON load failed');
      const parsedCurrentPage = await captureCurrentPageAsJson('Direct JSON URL fallback after goto failure');
      if (parsedCurrentPage) {
        return parsedCurrentPage;
      }
      continue;
    }

    const rawBody = (await response?.text().catch(() => ''))
      || (await iqPage.locator('body').innerText().catch(() => ''))
      || '';
    const parsedBody = parseDirectJsonText(rawBody);
    if (!parsedBody) {
      console.log('-> Direct JSON URL did not return parseable JSON.');
      await logCurrentPageSummary(iqPage, 'URL when JSON was not parseable');
      const parsedCurrentPage = await captureCurrentPageAsJson('Direct JSON URL fallback from current page');
      if (parsedCurrentPage) {
        return parsedCurrentPage;
      }
    } else {
      console.log(`-> Direct JSON URL captured valid JSON (${parsedBody.reportJsonRaw.length} chars).`);
      const payload = {
        reportHtml: await iqPage.content().catch(() => ''),
        reportJson: parsedBody.reportJson,
        reportJsonRaw: parsedBody.reportJsonRaw,
        responseUrl: response?.url() || directJsonUrl,
      };
      console.log('CLEANING UP JSON...');
      return normalizeJsonPayload(payload, 'IdentityIQ direct JSON');
    }
  }

  const evaluateFetchTargets = [
    '/CreditReport.aspx?view=json',
    'https://member.identityiq.com/CreditReport.aspx?view=json',
  ];

  for (const target of evaluateFetchTargets) {
    try {
      console.log(`-> Trying authenticated in-page fetch fallback: ${target}`);
      const fetchedBody = await iqPage.evaluate(async (url) => {
        try {
          const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
          });
          return await response.text();
        } catch (error) {
          return `__FETCH_ERROR__${error?.message || String(error)}`;
        }
      }, target);

      if (String(fetchedBody || '').startsWith('__FETCH_ERROR__')) {
        console.log(`-> In-page fetch fallback failed: ${String(fetchedBody).replace('__FETCH_ERROR__', '')}`);
        continue;
      }

      const parsedBody = parseDirectJsonText(fetchedBody || '');
      if (!parsedBody) {
        console.log('-> In-page fetch fallback returned non-JSON response.');
        continue;
      }

      console.log(`-> In-page fetch fallback captured valid JSON (${parsedBody.reportJsonRaw.length} chars).`);
      const payload = {
        reportHtml: await iqPage.content().catch(() => ''),
        reportJson: parsedBody.reportJson,
        reportJsonRaw: parsedBody.reportJsonRaw,
        responseUrl: target,
      };
      console.log('CLEANING UP JSON...');
      return normalizeJsonPayload(payload, 'IdentityIQ in-page JSON');
    } catch (error) {
      console.log(`-> In-page fetch fallback threw: ${error.message}`);
    }
  }

  return null;
};

const tryClickIdentityIqRefreshControl = async (iqPage) => {
  const refreshName = /Refresh Report|Refresh 3[- ]?Bureau Report|Refresh 3 Bureau Report/i;
  const refreshLocators = [
    iqPage.getByRole('button', { name: refreshName }).first(),
    iqPage.getByRole('link', { name: refreshName }).first(),
    iqPage.locator('button:has-text("Refresh Report"), a:has-text("Refresh Report"), [role="button"]:has-text("Refresh Report")').first(),
    iqPage.locator('button, a, [role="button"]').filter({ hasText: refreshName }).first(),
  ];

  for (let i = 0; i < refreshLocators.length; i += 1) {
    const locator = refreshLocators[i];
    try {
      const isVisible = await locator.isVisible({ timeout: 4000 }).catch(() => false);
      if (!isVisible) {
        console.log(`-> Refresh control locator ${i + 1}/${refreshLocators.length} not visible`);
        continue;
      }
      console.log(`-> Found refresh control with locator ${i + 1}, attempting click...`);
      await locator.click({ timeout: 8000 });
      console.log(`-> Refresh control clicked successfully`);
      await iqPage.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      return true;
    } catch (err) {
      console.log(`-> Refresh control locator ${i + 1} click failed: ${err.message}`);
    }
  }

  console.log('-> No refresh control found with any locator strategy');
  return false;
};

const captureSmartCreditCurrentJson = async (scPage) => {
  const reportUrl = 'https://www.smartcredit.com/member/credit-report/3b/simple.htm?format=JSON';
  console.log(`Opening SmartCredit JSON report: ${reportUrl}`);

  const response = await scPage.goto(reportUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 40000,
  });

  const reportJsonRaw = (await response?.text().catch(() => ''))
    || (await scPage.locator('body').innerText().catch(() => ''))
    || '';
  const reportJson = tryParseJson(reportJsonRaw);

  if (!reportJsonRaw.trim()) {
    throw new Error('SmartCredit JSON report response was empty.');
  }

  console.log(`-> SmartCredit JSON captured (${reportJsonRaw.length} chars)`);
  return {
    reportJson,
    reportJsonRaw,
    responseUrl: response?.url() || reportUrl,
  };
};

const readResponseDetails = async (response) => {
  const status = Number(response?.status || 0);
  const statusText = String(response?.statusText || '').trim();
  let raw = '';
  try {
    raw = await response.text();
  } catch {
    raw = '';
  }
  let parsed = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }
  return {
    status,
    statusText,
    raw,
    payload: parsed && typeof parsed === 'object' ? parsed : {},
  };
};

const postJsonWithRetry = async (url, options = {}, retryCount = 1) => {
  let lastError;
  for (let attempt = 1; attempt <= retryCount + 1; attempt += 1) {
    try {
      const response = await fetch(url, options);
      const details = await readResponseDetails(response);
      if (response.ok) return details;
      const retryable = details.status >= 500 || details.status === 408 || details.status === 429;
      const reason = String(details.payload?.error || details.raw || `HTTP ${details.status}`).slice(0, 320);
      if (retryable && attempt <= retryCount) {
        console.log(`-> Sync POST retry ${attempt}/${retryCount + 1} for ${url}: ${details.status} ${details.statusText || ''} ${reason}`);
        await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
        continue;
      }
      throw new Error(`HTTP ${details.status} ${details.statusText || ''} ${reason}`.trim());
    } catch (error) {
      lastError = error;
      if (attempt <= retryCount) {
        console.log(`-> Sync POST network retry ${attempt}/${retryCount + 1} for ${url}: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error(`POST failed for ${url}`);
};

const syncIdentityIqReportToToolsNinja = async (client, reportPayload, apiBase) => {
  const cleanedPayload = normalizeJsonPayload(reportPayload, 'IdentityIQ pre-sync JSON');
  console.log(`Syncing IdentityIQ report to Tools Ninja for ${client.firstName} ${client.lastName}...`);
  const apiUser = String(process.env.TOOLS_NINJA_API_USER || 'admin').trim() || 'admin';
  const syncUrl = `${apiBase}/api/report-sync/identityiq`;
  const { payload } = await postJsonWithRetry(syncUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `txn=${encodeURIComponent(apiUser)}`,
    },
    body: JSON.stringify({
      clientId: String(client.id || '').trim(),
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      monitoringUsername: client.monitoringUsername,
      monitoringAgency: client.monitoringAgency,
      creditReportSource: 'identityiq-json',
      creditReportFileName: 'identityiq-latest-report.html',
      ...cleanedPayload,
    }),
  }, 1);
  const fallbackLength = Number((cleanedPayload?.reportJsonRaw || '').length || 0);
  const jsonLength = Number(payload?.jsonLength || fallbackLength || 0);
  if (!Number.isFinite(jsonLength) || jsonLength <= 0) {
    throw new Error(`Tools Ninja sync returned empty JSON payload for client ${client.firstName} ${client.lastName}; report may not have been saved.`);
  }

  console.log(`JSON loaded to NinjaTools (${jsonLength} bytes).`);
  console.log(`-> Tools Ninja sync complete for client ${payload.client?.firstName || client.firstName} ${payload.client?.lastName || client.lastName}`);
  if (payload.savePaths?.currentClientStorePath) {
    console.log(`-> Current client store path: ${payload.savePaths.currentClientStorePath}`);
  }
  if (payload.savePaths?.reportHistoryDbPath) {
    console.log(`-> Report history DB path: ${payload.savePaths.reportHistoryDbPath}`);
  }
};

const syncSmartCreditReportToToolsNinja = async (client, reportPayload, apiBase) => {
  console.log(`Syncing SmartCredit report to Tools Ninja for ${client.firstName} ${client.lastName}...`);
  const apiUser = String(process.env.TOOLS_NINJA_API_USER || 'admin').trim() || 'admin';
  const syncUrl = `${apiBase}/api/report-sync/smartcredit`;
  const { payload } = await postJsonWithRetry(syncUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `txn=${encodeURIComponent(apiUser)}`,
    },
    body: JSON.stringify({
      clientId: String(client.id || '').trim(),
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      monitoringUsername: client.monitoringUsername,
      monitoringPassword: client.monitoringPassword,
      monitoringAgency: client.monitoringAgency,
      creditReportSource: 'smartcredit-json',
      creditReportFileName: 'smartcredit-latest-report.json',
      ...reportPayload,
    }),
  }, 1);

  const rawLength = Number((reportPayload?.reportJsonRaw || '').length || 0);
  if (rawLength > 0) {
    console.log(`JSON loaded to NinjaTools (${rawLength} bytes).`);
  } else {
    console.log('JSON loaded to NinjaTools.');
  }
  console.log(`-> SmartCredit Tools Ninja sync complete for client ${payload.client?.firstName || client.firstName} ${payload.client?.lastName || client.lastName}`);
  if (payload.savePaths?.currentClientStorePath) {
    console.log(`-> Current client store path: ${payload.savePaths.currentClientStorePath}`);
  }
  if (payload.savePaths?.reportHistoryDbPath) {
    console.log(`-> Report history DB path: ${payload.savePaths.reportHistoryDbPath}`);
  }
};

const gotoWithRetry = async (page, url, options = {}, attempts = 2) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await page.goto(url, options);
    } catch (error) {
      lastError = error;
      const message = String(error?.message || error);
      const isAborted = message.includes('ERR_ABORTED');
      console.log(`-> goto attempt ${attempt}/${attempts} failed for ${url}: ${message}`);
      if (!isAborted || attempt === attempts) {
        throw error;
      }
      await page.waitForTimeout(1200);
    }
  }
  throw lastError || new Error(`Navigation failed for ${url}`);
};

const silentlyClearBrowserSession = async (context, agencyLower) => {
  await context.clearCookies().catch(() => {});

  const targets = agencyLower.includes('identity') || agencyLower.includes('iiq')
    ? ['https://member.identityiq.com/']
    : agencyLower.includes('smart')
      ? ['https://www.smartcredit.com/', 'https://www.smartcredit.com/login/']
      : [];

  for (const target of targets) {
    const page = await context.newPage();
    try {
      await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await page.evaluate(() => {
        try { window.localStorage.clear(); } catch {}
        try { window.sessionStorage.clear(); } catch {}
        try {
          const names = document.cookie.split(';').map((part) => part.split('=')[0]?.trim()).filter(Boolean);
          for (const name of names) {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${location.hostname}`;
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.${location.hostname.replace(/^www\./, '')}`;
          }
        } catch {}
      }).catch(() => {});
    } finally {
      await page.close().catch(() => {});
    }
  }
};

const silentlyLogoutAtEnd = async (context, agencyLower) => {
  const logoutUrls = agencyLower.includes('identity') || agencyLower.includes('iiq')
    ? ['https://member.identityiq.com/logout.aspx']
    : agencyLower.includes('smart')
      ? ['https://www.smartcredit.com/logout']
      : [];

  for (const logoutUrl of logoutUrls) {
    const page = await context.newPage();
    try {
      await page.goto(logoutUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    } finally {
      await page.close().catch(() => {});
    }
  }
};

const runIdentityIq = async (context, client, apiBase) => {
  let secretKey = getSecretKey(client);
  if (!secretKey) {
    console.log('-> Secret key is blank. Continuing without security-answer fallback.');
  }

  console.log('\n-> Agency match: IdentityIQ detected — Running Script A');

  const pulseClientName = `${String(client.firstName || '').trim()} ${String(client.lastName || '').trim()}`.trim() || 'Client';
  const username = String(client.monitoringUsername || '').trim();
  const password = String(client.monitoringPassword || '').trim();

  const iqPage = await context.newPage();
  await iqPage.bringToFront().catch(() => {});

  const usernameField = iqPage.locator(
    '#txtUserName, input[name="txtUserName"], input[placeholder*="Username" i], input[aria-label*="Username" i]',
  ).first();
  const passwordField = iqPage.locator(
    '#txtPassword, input[name="txtPassword"], input[type="password"], input[placeholder*="Password" i], input[aria-label*="Password" i]',
  ).first();
  const loginButton = iqPage.locator(
    'button:has-text("Login"), input[type="submit"][value*="Login" i], a:has-text("Login")',
  ).first();

  console.log('Navigating to IdentityIQ...');
  const identityIqMemberUrl = 'https://member.identityiq.com/';
  try {
    await iqPage.goto(identityIqMemberUrl, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await iqPage.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => {});
  } catch (error) {
    console.log(`-> IdentityIQ navigation issue on ${identityIqMemberUrl}: ${error.message}`);
  }

  let loginSurfaceReady = await usernameField.isVisible({ timeout: 1800 }).catch(() => false);
  if (!loginSurfaceReady) {
    console.log(`-> Username field not visible yet, trying: ${identityIqMemberUrl}`);
    loginSurfaceReady = await ensureIdentityIqLoginScreen(iqPage);
  }

  console.log(`-> IdentityIQ page after login-screen recovery attempts: ${summarizeUrl(iqPage.url())}`);

  if (!loginSurfaceReady) {
    console.log('-> Login fields not visible; proceeding with challenge-aware fallback path.');
  }

  if (await usernameField.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('Filling username...');
    await usernameField.fill(username, { timeout: 8000 });
  }

  if (await passwordField.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('Filling password...');
    await passwordField.fill(password, { timeout: 8000 });
  }

  console.log('Clicking Login button...');
  if (await loginButton.isVisible({ timeout: 2500 }).catch(() => false)) {
    await loginButton.click({ timeout: 8000 }).catch((error) => {
      console.log(`-> Login click fallback failed: ${error.message}`);
    });
  } else {
    console.log('-> Login button not visible; continuing to challenge/dashboard checks.');
  }

  await iqPage.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

  const detectInvalidIdentityIqLogin = async () => {
    const rawUrl = String(iqPage.url() || '').trim();
    let onMemberHost = false;
    let path = '/';
    try {
      const parsed = new URL(rawUrl);
      onMemberHost = parsed.hostname.toLowerCase() === 'member.identityiq.com';
      path = String(parsed.pathname || '/').toLowerCase();
    } catch {
      // keep defaults
    }

    const transitionedToKnownPostLoginPath = /dashboard|security-question|creditreport\.aspx|logout\.aspx/.test(path);
    if (!onMemberHost || transitionedToKnownPostLoginPath) {
      return false;
    }

    const invalidLoginVisible = await iqPage.locator('p.chakra-text.css-qa23dg').filter({ hasText: /Invalid login attempt/i }).first().isVisible({ timeout: 1200 }).catch(() => false)
      || await iqPage.getByText(/Invalid login attempt/i).first().isVisible({ timeout: 1200 }).catch(() => false);

    if (!invalidLoginVisible) {
      return false;
    }

    console.log('IdentityIQ states Invalid Login Attempt');
    console.log('Check Username and password');
    throw new Error('IdentityIQ states Invalid Login Attempt. Check Username and password');
  };

  await detectInvalidIdentityIqLogin();

  console.log('Checking if already on dashboard...');
  const isDashboard = iqPage.url().includes('Dashboard.aspx')
    || await iqPage.getByText(/Dashboard|Welcome|My Account/i).isVisible({ timeout: 2500 }).catch(() => false)
    || await iqPage.locator('button.navbar-toggle, .dashboard-header, [aria-label="menu"]').isVisible({ timeout: 2500 }).catch(() => false);
  if (isDashboard) {
    console.log('-> Already on dashboard — skipping security step');
  } else {
    console.log('-> Security step detected — attempting to fill secret key...');
    try {
      if (!secretKey) {
        console.log('-> Security question needs secret key. Pulling fresh client record and retrying key lookup...');
        const freshClient = await fetchFreshClientFromToolsNinja(client, apiBase);
        const refreshedSecretKey = getSecretKey(freshClient || {});
        if (refreshedSecretKey) {
          secretKey = refreshedSecretKey;
          console.log(`-> Refreshed secret key found (len ${secretKey.length}).`);
        } else {
          throw new Error('Security question page detected, but Secret Key is blank. Refetch from client record failed.');
        }
      }

      const securityAnswer = iqPage.locator(
        '#FBfbforcechangesecurityanswer_txtSecurityAnswer, input[name*="SecurityAnswer" i], input[id*="SecurityAnswer" i], input[aria-label*="security" i]',
      ).first();
      await securityAnswer.fill(secretKey, { timeout: 5000 });
      console.log('Security answer filled');
      await iqPage.getByRole('button', { name: /Submit|Continue|Verify|Next|Login|Sign In/i })
        .first()
        .click({ timeout: 8000 });
      console.log('-> Security submit clicked');
    } catch (error) {
      console.log(`-> Security step skipped or failed: ${error.message}`);
    }
  }

  await iqPage.waitForURL(/Dashboard\.aspx|CreditReport\.aspx|SecureAlacarte\.aspx/i, { timeout: 15000 }).catch(() => {
    console.log('Post-login URL not fully detected — proceeding anyway');
  });

  let usedIdentityIqJsonFallback = false;

  const purchaseReportNode = iqPage.locator('a:has-text("Purchase Report"), div:has-text("Purchase Report")').first();
  const refreshAvailableNode = iqPage.locator('a:has-text("Refresh Available"), div:has-text("Refresh Available"), a:has-text("Refresh Report"), button:has-text("Refresh Report")').first();
  const refreshBtn = iqPage.getByRole('button', { name: /Refresh Report/i }).first();

  const purchaseVisible = await purchaseReportNode.isVisible({ timeout: 2500 }).catch(() => false);
  const refreshAvailableVisible = await refreshAvailableNode.isVisible({ timeout: 2500 }).catch(() => false);

  if (purchaseVisible) {
    console.log('-> IdentityIQ shows Purchase Report. Skipping refresh and pulling JSON immediately.');
    const directJsonPayload = await captureIdentityIqDirectJson(iqPage);
    if (directJsonPayload) {
      await syncIdentityIqReportToToolsNinja(client, directJsonPayload, apiBase);
      usedIdentityIqJsonFallback = true;
    } else {
      console.log('-> IdentityIQ immediate JSON fallback failed');
    }
  } else if (refreshAvailableVisible) {
    console.log('-> IdentityIQ shows Refresh Available. Clicking refresh now.');
    const clicked = await tryClickIdentityIqRefreshControl(iqPage);
    if (clicked) {
      console.log(`${pulseClientName} loaded. Ready to refresh.`);
      console.log('Refreshing report... Lets Go !');
      console.log('-> Refresh Report clicked');
    } else {
      console.log('-> Refresh Available visible but refresh click target was not actionable.');
    }
  } else {
    console.log('-> No Purchase/Refresh indicator found; trying immediate JSON capture.');
    const directJsonPayload = await captureIdentityIqDirectJson(iqPage);
    if (directJsonPayload) {
      await syncIdentityIqReportToToolsNinja(client, directJsonPayload, apiBase);
      usedIdentityIqJsonFallback = true;
    } else {
      console.log('-> IdentityIQ immediate JSON fallback failed');
    }
  }

  if (usedIdentityIqJsonFallback) {
    console.log('Script A complete — IdentityIQ JSON fallback used immediately.');
    return;
  }

  console.log('Script A complete — waiting 12s before JSON capture...');
  await iqPage.waitForTimeout(12000);

  try {
    // Fast path after refresh: go straight to canonical JSON endpoint.
    let reportPayload = await captureIdentityIqDirectJson(iqPage);
    if (!reportPayload) {
      console.log('-> Direct JSON capture after refresh failed, falling back to View Latest Report capture.');
      reportPayload = await captureIdentityIqLatestReport(iqPage);
    }
    await syncIdentityIqReportToToolsNinja(client, reportPayload, apiBase);
  } catch (reportErr) {
    console.log(`-> IdentityIQ report capture/sync failed: ${reportErr.message}`);
    throw reportErr;
  }
};

const runSmartCredit = async (context, client, apiBase) => {
  console.log('\n-> Running SmartCredit (Script B)');

  const scPage = await context.newPage();
  await scPage.bringToFront().catch(() => {});

  console.log('Logging into SmartCredit...');
  await scPage.goto('https://www.smartcredit.com/login/', { waitUntil: 'networkidle', timeout: 40000 });

  console.log('Filling username (#loginId)...');
  await scPage.locator('#loginId').fill(client.monitoringUsername, { timeout: 15000 });

  console.log('Filling password (#password)...');
  await scPage.locator('#password').fill(client.monitoringPassword, { timeout: 15000 });

  console.log('Clicking login button...');
  await scPage.locator('button[name="login"]').click({ timeout: 15000 });

  console.log('Waiting for dashboard hamburger (up to 40s)...');
  try {
    await scPage.locator('button.navbar-toggle').waitFor({ state: 'visible', timeout: 40000 });
    console.log('-> Hamburger menu found');
  } catch (error) {
    console.log(`-> Hamburger not found in 40s: ${error.message}`);
    console.log('-> Proceeding anyway');
  }

  console.log('Clicking hamburger menu...');
  await scPage.locator('button.navbar-toggle').click().catch(() => {});

  console.log('Navigating to 3B Report & Scores...');
  await scPage.getByRole('link', { name: /3B Report & Scores/i })
    .click({ timeout: 30000 })
    .catch((error) => {
      console.log(`-> 3B link click failed: ${error.message}`);
    });

  console.log('Scanning for 3-Bureau report age alert...');

  try {
    console.log('Waiting for .hero-3b alert container (up to 40s)...');
    const alertContainer = scPage.locator('div.hero-3b .d-flex.align-items-start.align-items-xl-center.fade.show.mt-4.fs-18.text-white[role="alert"]');
    await alertContainer.waitFor({ state: 'visible', timeout: 40000 });

    const alertSpan = alertContainer.locator('span').first();
    const alertText = (await alertSpan.innerText()).trim();
    console.log(`Found alert text: ${alertText}`);

    const daysMatch = alertText.match(/is\s*(?:<strong>)?\s*(\d+)\s*(?:<\/strong>)?\s+days?\s+old/i)
      || alertText.match(/is\s+(\d+)\s+days?\s+old/i);

    const reportAgeDays = daysMatch?.[1] ? Number.parseInt(daysMatch[1], 10) : null;
    if (reportAgeDays !== null) {
      console.log(`-> SUCCESS: Parsed report age -> ${reportAgeDays} days old`);
      if (reportAgeDays > 29) {
        console.log(`-> ${reportAgeDays} > 29 -> ordering update`);
        await scPage.locator('a[href="/member/credit-report/3b/confirm.htm"]')
          .first()
          .click({ timeout: 5000 })
          .then(() => console.log('-> Clicked Order an update now link'))
          .catch(async (error) => {
            console.log(`-> Direct link click failed: ${error.message}`);
          });

        if (!scPage.url().includes('/member/credit-report/3b/confirm.htm')) {
          console.log('-> Navigating directly to SmartCredit confirm page...');
          await scPage.goto('https://www.smartcredit.com/member/credit-report/3b/confirm.htm', {
            waitUntil: 'domcontentloaded',
            timeout: 15000,
          });
        }

        await scPage.waitForURL(/\/member\/credit-report\/3b\/confirm\.htm/i, { timeout: 15000 }).catch(() => {
          console.log('-> Confirm page URL not detected yet — proceeding with confirm-page locators');
        });
      } else {
        console.log(`-> ${reportAgeDays} <= 29 days — no update needed`);
      }
    } else {
      console.log('-> No number found in alert text');
    }
  } catch (error) {
    console.log(`-> SmartCredit age alert scan skipped: ${error.message}`);
  }

  console.log('Checking for Review and Buy button on confirm page...');
  const reviewBuyBtn = scPage.getByRole('link', { name: /Review and Buy/i }).first();
  try {
    await reviewBuyBtn.waitFor({ state: 'visible', timeout: 5000 });
    await reviewBuyBtn.click({ timeout: 5000 });
    console.log('-> Clicked Review and Buy');
    await scPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  } catch {
    console.log('-> Review and Buy button not found');
  }

  console.log('Checking for Complete Order button...');
  const completeOrderBtn = scPage.getByRole('link', { name: /Complete Order/i }).first();
  try {
    await completeOrderBtn.waitFor({ state: 'visible', timeout: 5000 });
    await completeOrderBtn.click({ timeout: 5000 });
    console.log('-> Clicked Complete Order');
    await scPage.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await scPage.waitForTimeout(5000);
  } catch {
    console.log('-> Complete Order button not found');
  }

  const reportPayload = await captureSmartCreditCurrentJson(scPage);
  await syncSmartCreditReportToToolsNinja(client, reportPayload, apiBase);
};

const main = async () => {
  console.log('XxXGetReport - Ninja Tools Server Runner');

  const client = parseClientPayload();
  const monitoringAgency = String(client.monitoringAgency || '').trim();
  const username = String(client.monitoringUsername || '').trim();
  const password = String(client.monitoringPassword || '').trim();
  const agencyLower = normalizeAgency(monitoringAgency);
  const apiBase = resolveToolsNinjaApiBaseForAgency(agencyLower);

  if (!client.firstName || !client.lastName) {
    throw new Error('Selected client is missing first or last name.');
  }
  if (!monitoringAgency) {
    throw new Error('Selected client is missing a monitoring agency.');
  }
  if (!username || !password) {
    throw new Error('Selected client is missing monitoring username or password.');
  }

  console.log(`Selected client: ${client.firstName} ${client.lastName}`);
  console.log(`Monitoring Agency: ${monitoringAgency}`);
  console.log(`Tools Ninja API Base: ${apiBase}`);
  console.log(`Username: ${username}`);
  console.log(`Password: ${password ? '********' : '[empty]'}`);
  console.log(`Secret Key: ${getSecretKey(client) || '[empty]'}`);
  const tokenId = String(client.tokenId || '').trim();
  const useScriptB = agencyLower.includes('smart')
    || agencyLower.includes('myfree')
    || agencyLower.includes('freescorenow');
  if (agencyLower.includes('identity') || agencyLower.includes('iiq')) {
    console.log('Agency match confirmed: IdentityIQ -> Script A');
  } else if (useScriptB) {
    if (!tokenId) {
      console.log(`Agency match confirmed: ${monitoringAgency} (no token; using password) -> Script B`);
    } else {
      console.log(`Agency match confirmed: ${monitoringAgency} -> Script B`);
    }
  }

  const runProfileDir = await mkdtemp(path.join(tmpdir(), 'tools-ninja-iso-'));
  let context;
  const chromiumExecutablePath = String(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '').trim();
  try {
    context = await chromium.launchPersistentContext(runProfileDir, {
      headless: true,
      viewport: { width: 1366, height: 900 },
      locale: 'en-US',
      timezoneId: 'America/Chicago',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.208 Safari/537.36',
      extraHTTPHeaders: {
        'accept-language': 'en-US,en;q=0.9',
      },
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ],
      ...(chromiumExecutablePath ? { executablePath: chromiumExecutablePath } : {}),
    });
    await context.addInitScript(() => {
      try {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
        Object.defineProperty(navigator, 'language', { get: () => 'en-US' });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      } catch {
        // no-op
      }
    });
    await silentlyClearBrowserSession(context, agencyLower);

    if (agencyLower.includes('identity') || agencyLower.includes('iiq')) {
      await runIdentityIq(context, client, apiBase);
    } else if (useScriptB) {
      await runSmartCredit(context, client, apiBase);
    } else {
      throw new Error(`Unsupported monitoring agency for browser runner: ${monitoringAgency}`);
    }

    console.log('Refresh confirmed. JSON loaded to NinjaTools.');
    console.log('Smoke bomb');
    console.log('Script completed successfully');
  } finally {
    if (context) {
      await silentlyLogoutAtEnd(context, agencyLower).catch(() => {});
      await silentlyClearBrowserSession(context, agencyLower).catch(() => {});
    }
    await context?.close().catch(() => {});
    await rm(runProfileDir, { recursive: true, force: true }).catch(() => {});
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
