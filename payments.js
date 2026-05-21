const state = {
  ownerKey: '',
  config: {
    defaultRetryCount: 3,
    defaultRetryFrequencyDays: 7,
    defaultRunTimeLocal: '09:00',
    timezone: 'America/Chicago',
  },
  gatewayOptions: [],
  frequencyOptions: [],
  merchants: [],
  products: [],
  autopay: [],
  clients: [],
  failedPaymentClients: [],
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

const formatCurrency = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

const parseMoneyString = (value) => String(value ?? '').replace(/[^0-9.-]/g, '').trim();

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatDateTime = (value) => {
  if (!value) {
    return '--';
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return '--';
  }
  return date.toLocaleString();
};

const formatShortDate = (value) => {
  if (!value) {
    return '--';
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return '--';
  }
  return date.toLocaleDateString();
};

const isoToLocalDateTimeInput = (isoValue) => {
  if (!isoValue) {
    return '';
  }
  const date = new Date(isoValue);
  if (Number.isNaN(date.valueOf())) {
    return '';
  }
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const localDateTimeInputToIso = (inputValue) => {
  const text = String(inputValue || '').trim();
  if (!text) {
    return '';
  }
  const date = new Date(text);
  if (Number.isNaN(date.valueOf())) {
    return '';
  }
  return date.toISOString();
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
  const log = byId('paymentsLog');
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
      ...(state.ownerKey ? { 'X-Owner-Key': state.ownerKey } : {}),
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
  byId('paymentsLoginCard').hidden = Boolean(loggedIn);
  byId('paymentsApp').hidden = !loggedIn;
};

const setSignedInAs = () => {
  const signedInNode = byId('paymentsSignedInAs');
  if (!signedInNode) {
    return;
  }
  const owner = state.ownerKey || 'admin';
  signedInNode.textContent = `Signed in as ${owner}`;
};

const clearMerchantForm = () => {
  byId('merchantId').value = '';
  byId('merchantName').value = '';
  byId('merchantApiId').value = '';
  byId('merchantTransactionKey').value = '';
  byId('merchantStatus').value = 'Active';
  byId('merchantRetries').value = String(state.config.defaultRetryCount || 3);
  byId('merchantRetryDays').value = String(state.config.defaultRetryFrequencyDays || 7);
  byId('merchantIsDefault').checked = false;
  byId('merchantQuickBubbles')?.querySelectorAll('.merchant-quick-edit-bubble').forEach((node) => {
    node.classList.remove('is-active');
  });
};

const clearProductForm = () => {
  byId('productId').value = '';
  byId('productName').value = '';
  byId('productType').value = '';
  byId('productPrice').value = '';
  byId('productStatus').value = 'Active';
  if (state.frequencyOptions.length) {
    byId('productFrequency').value = state.frequencyOptions[2]?.value || state.frequencyOptions[0]?.value || 'monthly';
  }
};

const clearAutopayForm = () => {
  byId('autopayId').value = '';
  byId('autopayAmount').value = '';
  byId('autopayFrequencyInterval').value = '1';
  byId('autopayNextCharge').value = '';
  byId('autopayRetryLimit').value = String(state.config.defaultRetryCount || 3);
  byId('autopayRetryDays').value = String(state.config.defaultRetryFrequencyDays || 7);
  byId('autopayStatus').value = 'Active';
  if (state.frequencyOptions.length) {
    byId('autopayFrequency').value = state.frequencyOptions[2]?.value || state.frequencyOptions[0]?.value || 'monthly';
  }
};

const renderSummary = (summary = {}) => {
  byId('paymentsMerchantCount').textContent = String(summary.merchantCount ?? 0);
  byId('paymentsProductCount').textContent = String(summary.productCount ?? 0);
  byId('paymentsActiveAutopayCount').textContent = String(summary.activeAutopayCount ?? 0);
  byId('paymentsDueCount').textContent = String(summary.dueIn7Days ?? 0);
};

const renderGatewayOptions = () => {
  const select = byId('merchantGateway');
  select.innerHTML = state.gatewayOptions.map((option) => `<option value="${option}">${option}</option>`).join('');
};

const renderFrequencyOptions = () => {
  const markup = state.frequencyOptions.map((option) => `<option value="${option.value}">${option.label}</option>`).join('');
  byId('productFrequency').innerHTML = markup;
  byId('autopayFrequency').innerHTML = markup;
};

const renderClientOptions = () => {
  const clientSelect = byId('autopayClient');
  clientSelect.innerHTML = [
    '<option value="">Select client...</option>',
    ...state.clients.map((client) => `<option value="${client.id}">${client.name}${client.email ? ` (${client.email})` : ''}</option>`),
  ].join('');
};

const renderMerchantOptionsForAutopay = () => {
  const select = byId('autopayMerchant');
  select.innerHTML = [
    '<option value="">Custom / none</option>',
    ...state.merchants.map((merchant) => `<option value="${merchant.id}">${merchant.merchantName} • ${merchant.gateway}</option>`),
  ].join('');
};

const renderProductOptionsForAutopay = () => {
  const select = byId('autopayProduct');
  select.innerHTML = [
    '<option value="">Custom charge</option>',
    ...state.products.map((product) => `<option value="${product.id}">${product.productName} (${formatCurrency(product.priceCents)})</option>`),
  ].join('');
};

const renderMerchants = () => {
  const tbody = byId('merchantRows');
  if (!state.merchants.length) {
    tbody.innerHTML = '<tr><td colspan="6">No merchants configured yet.</td></tr>';
    return;
  }
  tbody.innerHTML = state.merchants.map((merchant) => `
    <tr>
      <td>${merchant.merchantName}${merchant.isDefault ? ' <strong>(Default)</strong>' : ''}</td>
      <td>${merchant.gateway}</td>
      <td>${merchant.apiId || '--'}</td>
      <td>${merchant.status}</td>
      <td>${merchant.allowedRetries} / ${merchant.retryFrequencyDays}d</td>
      <td>
        <div class="payments-action-buttons">
          <button type="button" data-merchant-action="edit" data-merchant-id="${merchant.id}">Edit</button>
          <button type="button" data-merchant-action="delete" data-merchant-id="${merchant.id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
  renderMerchantQuickBubbles();
};

const populateMerchantForm = (merchant) => {
  if (!merchant) {
    return;
  }
  byId('merchantId').value = String(merchant.id);
  byId('merchantName').value = merchant.merchantName;
  byId('merchantGateway').value = merchant.gateway;
  byId('merchantApiId').value = merchant.apiId || '';
  byId('merchantTransactionKey').value = merchant.transactionKey || '';
  byId('merchantStatus').value = merchant.status;
  byId('merchantRetries').value = String(merchant.allowedRetries || 3);
  byId('merchantRetryDays').value = String(merchant.retryFrequencyDays || 7);
  byId('merchantIsDefault').checked = Boolean(merchant.isDefault);
  const bubbleWrap = byId('merchantQuickBubbles');
  if (bubbleWrap) {
    bubbleWrap.querySelectorAll('.merchant-quick-edit-bubble').forEach((node) => {
      const isActive = Number(node.dataset.merchantId || 0) === Number(merchant.id);
      node.classList.toggle('is-active', isActive);
    });
  }
  setMessage('merchantMessage', `Editing merchant "${merchant.merchantName}"`);
};

const renderMerchantQuickBubbles = () => {
  const wrap = byId('merchantQuickBubbles');
  if (!wrap) {
    return;
  }
  const topMerchants = [...state.merchants].slice(0, 5);
  if (!topMerchants.length) {
    wrap.innerHTML = '<span class="payments-message">No merchants yet</span>';
    return;
  }
  wrap.innerHTML = topMerchants.map((merchant) => `
    <button
      type="button"
      class="merchant-quick-edit-bubble"
      data-merchant-bubble="${merchant.id}"
      data-merchant-id="${merchant.id}"
      title="Edit ${escapeHtml(merchant.merchantName)}"
    >
      ${escapeHtml(merchant.merchantName)}
    </button>
  `).join('');
};

const renderProducts = () => {
  const tbody = byId('productRows');
  if (!state.products.length) {
    tbody.innerHTML = '<tr><td colspan="6">No products configured yet.</td></tr>';
    return;
  }
  tbody.innerHTML = state.products.map((product) => `
    <tr>
      <td>${product.productName}</td>
      <td>${product.productType || 'Service'}</td>
      <td>${formatCurrency(product.priceCents)}</td>
      <td>${product.billingFrequency}</td>
      <td>${product.status}</td>
      <td>
        <div class="payments-action-buttons">
          <button type="button" data-product-action="edit" data-product-id="${product.id}">Edit</button>
          <button type="button" data-product-action="delete" data-product-id="${product.id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
};

const renderAutopay = () => {
  const tbody = byId('autopayRows');
  if (!state.autopay.length) {
    tbody.innerHTML = '<tr><td colspan="7">No client autopay schedules yet.</td></tr>';
    return;
  }
  tbody.innerHTML = state.autopay.map((row) => `
    <tr>
      <td>${row.clientName || 'Unknown Client'}</td>
      <td>${row.merchantName || '--'}</td>
      <td>${row.productName || 'Custom charge'}</td>
      <td>${formatCurrency(row.amountCents)}</td>
      <td>${formatDateTime(row.nextChargeAt)}</td>
      <td>${row.status}</td>
      <td>
        <div class="payments-action-buttons">
          <button type="button" data-autopay-action="edit" data-autopay-id="${row.id}">Edit</button>
          <button type="button" data-autopay-action="delete" data-autopay-id="${row.id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
};

const parseFailedPaymentMeta = (client = {}) => {
  const notes = String(client.notes || '');
  const status = String(client.status || '');
  const combined = `${notes} ${status}`;
  const amountMatch = combined.match(/(?:\$|amount[:\s]*)\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  const last4Match = combined.match(/(?:last[\s_-]*4|ending|x{2,}\*{2,})[:\s#-]*([0-9]{4})/i)
    || combined.match(/\b([0-9]{4})\b/);
  const cardTypeMatch = combined.match(/\b(visa|mastercard|discover|amex|american\s*express)\b/i);

  let cardType = cardTypeMatch ? cardTypeMatch[1].toUpperCase() : '--';
  if (cardType === 'AMERICAN EXPRESS') {
    cardType = 'AMEX';
  }

  const incident = notes.trim() || status.trim() || '--';
  const dateValue = client.reportDate || client.createdAt || '';

  return {
    amount: amountMatch ? `$${Number(amountMatch[1]).toFixed(2)}` : '--',
    last4: last4Match ? last4Match[1] : '--',
    cardType,
    incident,
    dateValue,
  };
};

const renderFailedPaymentRows = () => {
  const tbody = byId('paymentsFailedRows');
  const countNode = byId('paymentsFailedCount');
  if (!tbody) {
    return;
  }

  const rows = Array.isArray(state.failedPaymentClients) ? state.failedPaymentClients : [];
  if (countNode) {
    countNode.textContent = `${rows.length} record${rows.length === 1 ? '' : 's'}`;
  }

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="12">No failed-payment records found.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((client) => {
    const meta = parseFailedPaymentMeta(client);
    const fullName = `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Unknown';
    return `
      <tr>
        <td>${escapeHtml(client.id || '--')}</td>
        <td>${escapeHtml(formatShortDate(meta.dateValue))}</td>
        <td>${escapeHtml(fullName)}</td>
        <td>${escapeHtml(client.email || '--')}</td>
        <td>${escapeHtml(client.phone || '--')}</td>
        <td>${escapeHtml(meta.amount)}</td>
        <td>${escapeHtml(meta.last4)}</td>
        <td>${escapeHtml(meta.cardType)}</td>
        <td>${escapeHtml(meta.incident)}</td>
        <td><input type="checkbox" aria-label="Move ${escapeHtml(fullName)}" /></td>
        <td><input type="checkbox" aria-label="Email ${escapeHtml(fullName)}" /></td>
        <td><input type="checkbox" aria-label="Text ${escapeHtml(fullName)}" /></td>
      </tr>
    `;
  }).join('');
};

const refreshFailedPayments = async () => {
  try {
    const payload = await request('/api/billing/failed-payments');
    state.failedPaymentClients = Array.isArray(payload.clients) ? payload.clients : [];
    renderFailedPaymentRows();
  } catch (error) {
    state.failedPaymentClients = [];
    renderFailedPaymentRows();
    appendLog(`Failed-payment queue load issue: ${error.message || 'unknown error'}`);
  }
};

const refreshOverview = async () => {
  const payload = await request('/api/payments/overview');
  state.ownerKey = payload.ownerKey || state.ownerKey;
  state.config = payload.config || state.config;
  state.gatewayOptions = Array.isArray(payload.gatewayOptions) ? payload.gatewayOptions : [];
  state.frequencyOptions = Array.isArray(payload.frequencyOptions) ? payload.frequencyOptions : [];
  state.merchants = Array.isArray(payload.merchants) ? payload.merchants : [];
  state.products = Array.isArray(payload.products) ? payload.products : [];
  state.autopay = Array.isArray(payload.autopay) ? payload.autopay : [];
  state.clients = Array.isArray(payload.clients) ? payload.clients : [];

  renderSummary(payload.summary || {});
  renderGatewayOptions();
  renderFrequencyOptions();
  renderClientOptions();
  renderMerchantOptionsForAutopay();
  renderProductOptionsForAutopay();
  renderMerchants();
  renderProducts();
  renderAutopay();
  await refreshFailedPayments();

  byId('configDefaultRetries').value = String(state.config.defaultRetryCount ?? 3);
  byId('configRetryDays').value = String(state.config.defaultRetryFrequencyDays ?? 7);
  byId('configRunTime').value = String(state.config.defaultRunTimeLocal || '09:00');
  byId('configTimezone').value = String(state.config.timezone || 'America/Chicago');

  clearMerchantForm();
  clearProductForm();
  clearAutopayForm();
  setSignedInAs();
};

const saveMerchant = async (event) => {
  event.preventDefault();
  const merchantId = Number(byId('merchantId').value || 0);
  const payload = {
    merchantName: byId('merchantName').value.trim(),
    gateway: byId('merchantGateway').value,
    apiId: byId('merchantApiId').value.trim(),
    transactionKey: byId('merchantTransactionKey').value.trim(),
    status: byId('merchantStatus').value,
    allowedRetries: Number(byId('merchantRetries').value || 3),
    retryFrequencyDays: Number(byId('merchantRetryDays').value || 7),
    isDefault: byId('merchantIsDefault').checked,
  };
  setMessage('merchantMessage', merchantId ? 'Updating merchant...' : 'Saving merchant...');
  if (merchantId > 0) {
    await request(`/api/payments/merchants/${merchantId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  } else {
    await request('/api/payments/merchants', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
  await refreshOverview();
  setMessage('merchantMessage', 'Merchant saved.');
  appendLog(`Merchant saved: ${payload.merchantName}`);
};

const saveProduct = async (event) => {
  event.preventDefault();
  const productId = Number(byId('productId').value || 0);
  const payload = {
    productName: byId('productName').value.trim(),
    productType: byId('productType').value.trim(),
    price: parseMoneyString(byId('productPrice').value),
    billingFrequency: byId('productFrequency').value,
    status: byId('productStatus').value,
  };
  setMessage('productMessage', productId ? 'Updating product...' : 'Saving product...');
  if (productId > 0) {
    await request(`/api/payments/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  } else {
    await request('/api/payments/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
  await refreshOverview();
  setMessage('productMessage', 'Product saved.');
  appendLog(`Product saved: ${payload.productName}`);
};

const saveAutopay = async (event) => {
  event.preventDefault();
  const autopayId = Number(byId('autopayId').value || 0);
  const payload = {
    clientId: byId('autopayClient').value,
    merchantId: byId('autopayMerchant').value ? Number(byId('autopayMerchant').value) : null,
    productId: byId('autopayProduct').value ? Number(byId('autopayProduct').value) : null,
    amount: parseMoneyString(byId('autopayAmount').value),
    frequencyType: byId('autopayFrequency').value,
    frequencyInterval: Number(byId('autopayFrequencyInterval').value || 1),
    nextChargeAt: localDateTimeInputToIso(byId('autopayNextCharge').value),
    status: byId('autopayStatus').value,
    retryLimit: Number(byId('autopayRetryLimit').value || state.config.defaultRetryCount || 3),
    retryFrequencyDays: Number(byId('autopayRetryDays').value || state.config.defaultRetryFrequencyDays || 7),
  };
  setMessage('autopayMessage', autopayId ? 'Updating AutoPay...' : 'Saving AutoPay...');
  if (autopayId > 0) {
    await request(`/api/payments/autopay/${autopayId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  } else {
    await request('/api/payments/autopay', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
  await refreshOverview();
  setMessage('autopayMessage', 'AutoPay saved.');
  appendLog(`AutoPay saved for client ${payload.clientId || '(unassigned)'}`);
};

const saveConfig = async (event) => {
  event.preventDefault();
  const payload = {
    defaultRetryCount: Number(byId('configDefaultRetries').value || 3),
    defaultRetryFrequencyDays: Number(byId('configRetryDays').value || 7),
    defaultRunTimeLocal: byId('configRunTime').value || '09:00',
    timezone: byId('configTimezone').value.trim() || 'America/Chicago',
  };
  setMessage('paymentsConfigMessage', 'Saving retry rules...');
  await request('/api/payments/config', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  await refreshOverview();
  setMessage('paymentsConfigMessage', 'Retry configuration saved.');
  appendLog('Retry configuration updated.');
};

const handleMerchantTableActions = async (event) => {
  const button = event.target.closest('[data-merchant-action]');
  if (!button) {
    return;
  }
  const action = button.dataset.merchantAction;
  const merchantId = Number(button.dataset.merchantId || 0);
  const merchant = state.merchants.find((entry) => entry.id === merchantId);
  if (!merchant) {
    return;
  }
  if (action === 'edit') {
    populateMerchantForm(merchant);
    return;
  }
  if (!window.confirm(`Delete merchant "${merchant.merchantName}"?`)) {
    return;
  }
  await request(`/api/payments/merchants/${merchant.id}`, { method: 'DELETE' });
  await refreshOverview();
  appendLog(`Merchant deleted: ${merchant.merchantName}`);
};

const handleMerchantQuickBubbleClick = (event) => {
  const button = event.target.closest('[data-merchant-bubble]');
  if (!button) {
    return;
  }
  const merchantId = Number(button.dataset.merchantId || 0);
  const merchant = state.merchants.find((entry) => entry.id === merchantId);
  if (!merchant) {
    return;
  }
  populateMerchantForm(merchant);
};

const runSquarePullTest = async () => {
  setMessage('merchantMessage', 'Running Square test pull...');
  appendLog('Square test pull started...');
  const payload = await request('/api/payments/test-square', {
    method: 'POST',
    body: JSON.stringify({ daysBack: 2 }),
  });
  const count = Number(payload?.count || 0);
  const summary = String(payload?.summary || '');
  appendLog(`Square test pull complete. Retrieved ${count} payment(s).`);
  if (summary) {
    appendLog(`Square summary: ${summary}`);
  }
  if (Array.isArray(payload?.sample) && payload.sample.length) {
    payload.sample.forEach((row, index) => {
      appendLog(
        `Square sample #${index + 1}: ${row.id || '--'} | ${row.status || '--'} | ${row.amount || '--'} | ${row.createdAt || '--'}`,
      );
    });
  }
  setMessage('merchantMessage', `Square test complete (${count} payment${count === 1 ? '' : 's'}).`);
};

const handleProductTableActions = async (event) => {
  const button = event.target.closest('[data-product-action]');
  if (!button) {
    return;
  }
  const action = button.dataset.productAction;
  const productId = Number(button.dataset.productId || 0);
  const product = state.products.find((entry) => entry.id === productId);
  if (!product) {
    return;
  }
  if (action === 'edit') {
    byId('productId').value = String(product.id);
    byId('productName').value = product.productName;
    byId('productType').value = product.productType || '';
    byId('productPrice').value = formatCurrency(product.priceCents);
    byId('productFrequency').value = product.billingFrequency || 'monthly';
    byId('productStatus').value = product.status || 'Active';
    setMessage('productMessage', `Editing product "${product.productName}"`);
    return;
  }
  if (!window.confirm(`Delete product "${product.productName}"?`)) {
    return;
  }
  await request(`/api/payments/products/${product.id}`, { method: 'DELETE' });
  await refreshOverview();
  appendLog(`Product deleted: ${product.productName}`);
};

const handleAutopayTableActions = async (event) => {
  const button = event.target.closest('[data-autopay-action]');
  if (!button) {
    return;
  }
  const action = button.dataset.autopayAction;
  const autopayId = Number(button.dataset.autopayId || 0);
  const autopay = state.autopay.find((entry) => entry.id === autopayId);
  if (!autopay) {
    return;
  }
  if (action === 'edit') {
    byId('autopayId').value = String(autopay.id);
    byId('autopayClient').value = autopay.clientId || '';
    byId('autopayMerchant').value = autopay.merchantId ? String(autopay.merchantId) : '';
    byId('autopayProduct').value = autopay.productId ? String(autopay.productId) : '';
    byId('autopayAmount').value = formatCurrency(autopay.amountCents);
    byId('autopayFrequency').value = autopay.frequencyType || 'monthly';
    byId('autopayFrequencyInterval').value = String(autopay.frequencyInterval || 1);
    byId('autopayNextCharge').value = isoToLocalDateTimeInput(autopay.nextChargeAt);
    byId('autopayStatus').value = autopay.status || 'Active';
    byId('autopayRetryLimit').value = String(autopay.retryLimit || state.config.defaultRetryCount || 3);
    byId('autopayRetryDays').value = String(autopay.retryFrequencyDays || state.config.defaultRetryFrequencyDays || 7);
    setMessage('autopayMessage', `Editing autopay for "${autopay.clientName}"`);
    return;
  }
  if (!window.confirm(`Delete autopay for "${autopay.clientName}"?`)) {
    return;
  }
  await request(`/api/payments/autopay/${autopay.id}`, { method: 'DELETE' });
  await refreshOverview();
  appendLog(`AutoPay deleted for ${autopay.clientName}`);
};

const handleAutopayProductChange = () => {
  const productId = Number(byId('autopayProduct').value || 0);
  if (!productId) {
    return;
  }
  const product = state.products.find((entry) => entry.id === productId);
  if (!product) {
    return;
  }
  if (!byId('autopayAmount').value.trim()) {
    byId('autopayAmount').value = formatCurrency(product.priceCents);
  }
  byId('autopayFrequency').value = product.billingFrequency || 'monthly';
};

const handleLoginSubmit = async (event) => {
  event.preventDefault();
  const username = byId('paymentsLoginUsername').value.trim();
  const password = byId('paymentsLoginPassword').value;
  setMessage('paymentsLoginMessage', 'Signing in...');
  try {
    await request('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    state.ownerKey = String(username || 'admin').trim().toLowerCase();
    localStorage.setItem('paymentsLoggedIn', '1');
    localStorage.setItem('paymentsOwnerKey', state.ownerKey);
    setAppVisibility(true);
    setSignedInAs();
    setMessage('paymentsLoginMessage', '');
    byId('paymentsLog').textContent = 'Ready.';
    await refreshOverview();
    appendLog(`Payments loaded for owner "${state.ownerKey}".`);
  } catch (error) {
    setMessage('paymentsLoginMessage', error.message || 'Login failed.', true);
  }
};

const bindEvents = () => {
  byId('paymentsLoginForm').addEventListener('submit', handleLoginSubmit);
  byId('merchantForm').addEventListener('submit', async (event) => {
    try {
      await saveMerchant(event);
    } catch (error) {
      setMessage('merchantMessage', error.message || 'Failed to save merchant.', true);
    }
  });
  byId('productForm').addEventListener('submit', async (event) => {
    try {
      await saveProduct(event);
    } catch (error) {
      setMessage('productMessage', error.message || 'Failed to save product.', true);
    }
  });
  byId('autopayForm').addEventListener('submit', async (event) => {
    try {
      await saveAutopay(event);
    } catch (error) {
      setMessage('autopayMessage', error.message || 'Failed to save autopay.', true);
    }
  });
  byId('paymentsConfigForm').addEventListener('submit', async (event) => {
    try {
      await saveConfig(event);
    } catch (error) {
      setMessage('paymentsConfigMessage', error.message || 'Failed to save config.', true);
    }
  });

  byId('merchantResetButton').addEventListener('click', clearMerchantForm);
  byId('merchantSquareTestButton').addEventListener('click', async () => {
    try {
      await runSquarePullTest();
    } catch (error) {
      setMessage('merchantMessage', error.message || 'Square test pull failed.', true);
      appendLog(`Square test pull failed: ${error.message || 'Unknown error'}`);
    }
  });
  byId('productResetButton').addEventListener('click', clearProductForm);
  byId('autopayResetButton').addEventListener('click', clearAutopayForm);
  byId('autopayProduct').addEventListener('change', handleAutopayProductChange);
  byId('merchantQuickBubbles').addEventListener('click', handleMerchantQuickBubbleClick);
  byId('merchantRows').addEventListener('click', async (event) => {
    try {
      await handleMerchantTableActions(event);
    } catch (error) {
      setMessage('merchantMessage', error.message || 'Merchant action failed.', true);
    }
  });
  byId('productRows').addEventListener('click', async (event) => {
    try {
      await handleProductTableActions(event);
    } catch (error) {
      setMessage('productMessage', error.message || 'Product action failed.', true);
    }
  });
  byId('autopayRows').addEventListener('click', async (event) => {
    try {
      await handleAutopayTableActions(event);
    } catch (error) {
      setMessage('autopayMessage', error.message || 'AutoPay action failed.', true);
    }
  });
  byId('paymentsLogoutButton').addEventListener('click', () => {
    localStorage.removeItem('paymentsLoggedIn');
    localStorage.removeItem('paymentsOwnerKey');
    state.ownerKey = '';
    setAppVisibility(false);
    setSignedInAs();
    setMessage('paymentsLoginMessage', 'Signed out.');
  });
};

const init = async () => {
  bindEvents();
  const cookieUser = String(getCookieValue('txn') || '').trim().toLowerCase();
  const shouldAutoOpen = localStorage.getItem('paymentsLoggedIn') === '1' || Boolean(cookieUser);
  const rememberedOwner = localStorage.getItem('paymentsOwnerKey') || '';
  state.ownerKey = cookieUser || String(rememberedOwner || '').trim().toLowerCase();
  if (cookieUser) {
    localStorage.setItem('paymentsLoggedIn', '1');
    localStorage.setItem('paymentsOwnerKey', cookieUser);
  }
  setAppVisibility(shouldAutoOpen);
  setSignedInAs();
  byId('paymentsLog').textContent = 'Ready.';

  if (!shouldAutoOpen || !state.ownerKey) {
    return;
  }
  try {
    await refreshOverview();
    appendLog(`Payments loaded for owner "${state.ownerKey}".`);
  } catch (error) {
    appendLog(`Startup load failed: ${error.message}`);
  }
};

void init();
