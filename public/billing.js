const state = {
  failedEvents: [],
  billingConfig: {
    failedPaymentsWebhookUrl: '',
    webhookHeaderName: '',
    webhookHeaderValue: '',
    scriptTriggerSecret: '',
  },
};

const byId = (id) => document.getElementById(id);
const getCookieValue = (name) => {
  const cookie = String(document.cookie || '');
  const parts = cookie.split(';').map((entry) => entry.trim());
  const match = parts.find((entry) => entry.startsWith(`${name}=`));
  if (!match) {
    return '';
  }
  return decodeURIComponent(match.slice(name.length + 1));
};

const setMessage = (id, text, isError = false) => {
  const node = byId(id);
  if (!node) {
    return;
  }
  node.textContent = String(text || '');
  node.classList.toggle('is-error', Boolean(isError));
};

const appendLog = (line) => {
  const log = byId('billingLog');
  if (!log) {
    return;
  }
  const stamp = new Date().toLocaleTimeString();
  log.textContent += `\n[${stamp}] ${line}`;
  log.scrollTop = log.scrollHeight;
};

const request = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = String(payload.error || payload.message || '').trim();
    throw new Error(`${reason || 'Request failed.'} [${options.method || 'GET'} ${url} | http ${response.status}]`);
  }
  return payload;
};

const setAppVisibility = (loggedIn) => {
  byId('billingLoginCard').hidden = Boolean(loggedIn);
  byId('billingApp').hidden = !loggedIn;
};

const setSignedInAs = (user = '') => {
  const node = byId('billingSignedInAs');
  if (!node) {
    return;
  }
  const label = String(user || 'admin').trim() || 'admin';
  node.textContent = `Signed in as ${label}`;
};

const renderStats = (summary = {}) => {
  byId('billingMatchedCount').textContent = String(summary.totalMatched ?? state.failedEvents.length ?? 0);
  byId('billingSuccessCount').textContent = String(summary.successCount ?? 0);
  byId('billingFailedCount').textContent = String(summary.failedCount ?? 0);
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatDateTime = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '--';
  const date = new Date(raw);
  if (Number.isNaN(date.valueOf())) return escapeHtml(raw);
  return escapeHtml(date.toLocaleString());
};

const formatAmount = (value) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return '$0.00';
  return `$${amount.toFixed(2)}`;
};

const renderRows = (events = state.failedEvents) => {
  const tbody = byId('billingEventRows');
  if (!tbody) {
    return;
  }
  if (!events.length) {
    tbody.innerHTML = '<tr><td colspan="11">No failed payment transactions found.</td></tr>';
    return;
  }

  tbody.innerHTML = events.map((event) => `
    <tr>
      <td>${formatDateTime(event.eventAt)}</td>
      <td>${escapeHtml(event.transactionId || '--')}</td>
      <td>${escapeHtml(event.clientName || '--')}</td>
      <td>${escapeHtml(event.email || '--')}</td>
      <td>${escapeHtml(event.phone || '--')}</td>
      <td>${escapeHtml(formatAmount(event.amount))}</td>
      <td>${escapeHtml(event.cardLast4 || '--')}</td>
      <td>${escapeHtml(event.paymentMethod || '--')}</td>
      <td>${escapeHtml(event.failureReason || '--')}</td>
      <td>${escapeHtml(event.status || '--')}</td>
      <td>${escapeHtml(event.processor || '--')}</td>
    </tr>
  `).join('');
};

const fillConfig = () => {
  byId('billingWebhookUrl').value = state.billingConfig.failedPaymentsWebhookUrl || '';
  byId('billingHeaderName').value = state.billingConfig.webhookHeaderName || '';
  byId('billingHeaderValue').value = state.billingConfig.webhookHeaderValue || '';
  byId('billingTriggerSecret').value = state.billingConfig.scriptTriggerSecret || '';
};

const loadConfig = async () => {
  const payload = await request('/api/integrations');
  state.billingConfig = payload.integrations?.billing || state.billingConfig;
  fillConfig();
};

const loadFailedEvents = async (query = '') => {
  const q = String(query || '').trim();
  const suffix = q ? `?q=${encodeURIComponent(q)}` : '';
  const payload = await request(`/api/billing/failed-payments${suffix}`);
  state.failedEvents = Array.isArray(payload.events) ? payload.events : [];
  renderRows(state.failedEvents);
  renderStats({ totalMatched: payload.count || state.failedEvents.length, successCount: 0, failedCount: 0 });
  appendLog(`Failed list refreshed. Matched: ${payload.count || state.failedEvents.length}`);
};

const runSafeQuery = async (dryRun = false) => {
  setMessage('billingRunMessage', dryRun ? 'Running dry run...' : 'Running SafeQueryAllFailedTrans...');
  appendLog(dryRun ? 'Starting dry run sync...' : 'Starting live sync...');
  const payload = await request('/api/billing/safe-query-all-failed-trans', {
    method: 'POST',
    body: JSON.stringify({ dryRun }),
  });
  renderStats(payload);
  const resultPreview = (payload.results || [])
    .slice(0, 12)
    .map((row) => `${row.ok ? 'OK' : 'FAIL'} ${row.name || row.clientName || row.transactionId || 'row'} (${row.status || 0})${row.error ? ` :: ${row.error}` : ''}`)
    .join('\n');
  if (resultPreview) {
    appendLog(resultPreview);
  }
  const merchantPreview = (payload.merchantResults || [])
    .map((row) => `${row.ok ? 'PULL OK' : 'PULL FAIL'} ${row.merchantName} [${row.gateway}] count=${row.count}${row.error ? ` :: ${row.error}` : ''}`)
    .join('\n');
  if (merchantPreview) {
    appendLog(merchantPreview);
  }
  appendLog(`SafeQuery done. success=${payload.successCount} failed=${payload.failedCount} attempted=${payload.attempted}`);
  appendLog(`pull summary: merchants=${payload.merchantsScanned || 0} pulled=${payload.pulledCount || 0} deduped=${payload.dedupedCount || 0}`);
  if (Number(payload.attempted || 0) === 0 && !dryRun) {
    appendLog('SafeQuery note: no webhook sends were attempted (no unsynced rows or webhook not configured).');
  }
  setMessage('billingRunMessage', `SafeQuery complete. Sent ${payload.successCount}, failed ${payload.failedCount}.`, payload.failedCount > 0);
  await loadFailedEvents(byId('billingSearchInput')?.value || '');
};

const handleLoginSubmit = async (event) => {
  event.preventDefault();
  const username = byId('billingLoginUsername').value.trim();
  const password = byId('billingLoginPassword').value;
  setMessage('billingLoginMessage', 'Signing in...');
  try {
    await request('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    localStorage.setItem('billingUser', String(username || 'admin').trim().toLowerCase());
    localStorage.setItem('billingLoggedIn', '1');
    setAppVisibility(true);
    setSignedInAs(String(username || 'admin').trim().toLowerCase());
    setMessage('billingLoginMessage', '');
    await loadConfig();
    await loadFailedEvents();
  } catch (error) {
    setMessage('billingLoginMessage', error.message || 'Login failed.', true);
  }
};

const handleConfigSubmit = async (event) => {
  event.preventDefault();
  const nextConfig = {
    failedPaymentsWebhookUrl: byId('billingWebhookUrl').value.trim(),
    webhookHeaderName: byId('billingHeaderName').value.trim(),
    webhookHeaderValue: byId('billingHeaderValue').value.trim(),
    scriptTriggerSecret: byId('billingTriggerSecret').value.trim(),
  };
  setMessage('billingConfigMessage', 'Saving settings...');
  try {
    const payload = await request('/api/integrations/billing', {
      method: 'PUT',
      body: JSON.stringify(nextConfig),
    });
    state.billingConfig = payload.integration || nextConfig;
    fillConfig();
    setMessage('billingConfigMessage', 'Billing settings saved.');
    appendLog('Billing webhook settings saved.');
  } catch (error) {
    setMessage('billingConfigMessage', error.message || 'Failed to save settings.', true);
  }
};

const bindEvents = () => {
  byId('billingLoginForm').addEventListener('submit', handleLoginSubmit);
  byId('billingConfigForm').addEventListener('submit', handleConfigSubmit);

  byId('billingRefreshListButton').addEventListener('click', async () => {
    try {
      await loadFailedEvents(byId('billingSearchInput')?.value || '');
    } catch (error) {
      setMessage('billingRunMessage', error.message, true);
    }
  });
  byId('billingDryRunButton').addEventListener('click', async () => {
    try {
      await runSafeQuery(true);
    } catch (error) {
      setMessage('billingRunMessage', error.message || 'Dry run failed.', true);
      appendLog(`Dry run failed: ${error.message}`);
    }
  });
  byId('billingRunButton').addEventListener('click', async () => {
    try {
      await runSafeQuery(false);
    } catch (error) {
      setMessage('billingRunMessage', error.message || 'SafeQuery failed.', true);
      appendLog(`SafeQuery failed: ${error.message}`);
    }
  });

  byId('billingSearchInput').addEventListener('input', async (event) => {
    const query = event.target.value || '';
    try {
      await loadFailedEvents(query);
    } catch (error) {
      setMessage('billingRunMessage', error.message || 'Search failed.', true);
    }
  });

  byId('billingLogoutButton').addEventListener('click', () => {
    localStorage.removeItem('billingLoggedIn');
    localStorage.removeItem('billingUser');
    setAppVisibility(false);
    setSignedInAs('admin');
    setMessage('billingLoginMessage', 'Signed out.');
  });
};

const init = async () => {
  bindEvents();
  const cookieUser = String(getCookieValue('txn') || '').trim().toLowerCase();
  const rememberedUser = String(localStorage.getItem('billingUser') || '').trim().toLowerCase();
  const activeUser = cookieUser || rememberedUser || 'admin';
  const shouldAutoOpen = localStorage.getItem('billingLoggedIn') === '1' || Boolean(cookieUser);
  if (cookieUser) {
    localStorage.setItem('billingLoggedIn', '1');
    localStorage.setItem('billingUser', cookieUser);
  }
  setAppVisibility(shouldAutoOpen);
  setSignedInAs(activeUser);
  byId('billingLog').textContent = 'Ready.';
  if (!shouldAutoOpen) {
    return;
  }

  try {
    await loadConfig();
    await loadFailedEvents();
  } catch (error) {
    appendLog(`Startup load failed: ${error.message}`);
    appendLog('Retrying startup load once...');
    setMessage('billingRunMessage', error.message, true);
    try {
      await loadConfig();
      await loadFailedEvents();
      appendLog('Startup retry succeeded.');
      setMessage('billingRunMessage', '');
    } catch (retryError) {
      appendLog(`Startup retry failed: ${retryError.message}`);
      setMessage('billingRunMessage', retryError.message, true);
    }
  }
};

void init();
