const state = {
  failedClients: [],
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
    throw new Error(payload.error || 'Request failed.');
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
  byId('billingMatchedCount').textContent = String(summary.totalMatched ?? state.failedClients.length ?? 0);
  byId('billingSuccessCount').textContent = String(summary.successCount ?? 0);
  byId('billingFailedCount').textContent = String(summary.failedCount ?? 0);
};

const renderRows = (clients = state.failedClients) => {
  const tbody = byId('billingClientRows');
  if (!tbody) {
    return;
  }
  if (!clients.length) {
    tbody.innerHTML = '<tr><td colspan="6">No failed payment clients found.</td></tr>';
    return;
  }

  tbody.innerHTML = clients.map((client) => `
    <tr>
      <td>${client.firstName || ''} ${client.lastName || ''}</td>
      <td>${client.email || '--'}</td>
      <td>${client.phone || '--'}</td>
      <td>${client.status || '--'}</td>
      <td>${client.monitoringAgency || '--'}</td>
      <td>${client.reportDate || '--'}</td>
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

const loadFailedClients = async (query = '') => {
  const q = String(query || '').trim();
  const suffix = q ? `?q=${encodeURIComponent(q)}` : '';
  const payload = await request(`/api/billing/failed-payments${suffix}`);
  state.failedClients = Array.isArray(payload.clients) ? payload.clients : [];
  renderRows(state.failedClients);
  renderStats({ totalMatched: payload.count || state.failedClients.length, successCount: 0, failedCount: 0 });
  appendLog(`Failed list refreshed. Matched: ${payload.count || state.failedClients.length}`);
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
    .map((row) => `${row.ok ? 'OK' : 'FAIL'} ${row.name} (${row.status || 0})${row.error ? ` :: ${row.error}` : ''}`)
    .join('\n');
  if (resultPreview) {
    appendLog(resultPreview);
  }
  appendLog(`SafeQuery done. success=${payload.successCount} failed=${payload.failedCount} attempted=${payload.attempted}`);
  setMessage('billingRunMessage', `SafeQuery complete. Sent ${payload.successCount}, failed ${payload.failedCount}.`, payload.failedCount > 0);
  await loadFailedClients(byId('billingSearchInput')?.value || '');
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
    await loadFailedClients();
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
      await loadFailedClients(byId('billingSearchInput')?.value || '');
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
      await loadFailedClients(query);
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
    await loadFailedClients();
  } catch (error) {
    appendLog(`Startup load failed: ${error.message}`);
    setMessage('billingRunMessage', error.message, true);
  }
};

void init();
