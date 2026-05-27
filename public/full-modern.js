const state = {
  clients: [],
  activeClientId: '',
  activeClient: null,
  expandedAccount: 0,
};

const getFullApp = () => document.getElementById('fullApp');
const bureaus = [
  ['transunion', 'tu', 'TransUnion'],
  ['experian', 'ex', 'Experian'],
  ['equifax', 'eq', 'Equifax'],
];

const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');
const list = (value) => Array.isArray(value) ? value : [];
const first = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== '') ?? '';
const money = (value) => {
  const raw = String(value ?? '').replace(/[^0-9.-]/g, '');
  const num = Number(raw);
  if (!Number.isFinite(num)) return first(value, '$0.00');
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};
const pct = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? `${num.toFixed(2)}%` : '0.00%';
};
const normalizeDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};
const clientName = (client = {}) => {
  const firstName = first(client.firstName, client.first_name);
  const lastName = first(client.lastName, client.last_name);
  return `${firstName} ${lastName}`.trim() || 'Unknown Client';
};
const maskSsn = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length >= 9) return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 9)}`;
  return first(value, '—');
};

async function api(path) {
  const response = await fetch(path, { credentials: 'include' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.message || `HTTP ${response.status}`);
  return payload;
}

function report(client = {}) {
  return client.json || {};
}

function reportData(client = {}) {
  return list(report(client).data);
}

function latestReportData(client = {}) {
  return reportData(client)[0] || {};
}

function reportAccounts(client = {}) {
  return list(report(client).accounts);
}

function scoreFor(client, bureau) {
  const name = bureau === 'transunion' ? 'TransUnion' : bureau === 'experian' ? 'Experian' : 'Equifax';
  const reportScore = latestReportData(client).creditScore?.[name];
  return first(
    typeof reportScore === 'object' ? reportScore?.score : reportScore,
    client.creditScores?.[bureau],
    client.creditScores?.[name],
    '—',
  );
}

function bureauValue(account, bureau, fieldLabels) {
  for (const entry of list(account.inCon)) {
    const item = entry?.[bureau];
    const label = String(item?.label || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (fieldLabels.some((fieldLabel) => label === fieldLabel.toLowerCase())) {
      return first(item?.value, '—');
    }
  }
  const button = account?.[bureau]?.classifycations?.dataButton || account?.[bureau]?.dataButton || {};
  const field = fieldLabels[0].toLowerCase();
  if (field.includes('account #')) return first(account?.[bureau]?.['account number'], account?.[bureau]?.accountNumber, account.acc_num, '—');
  if (field.includes('account type - detail')) return first(button.accountTypeDetail, account?.[bureau]?.accountTypeDetail, '—');
  if (field.includes('account type')) return first(button.accountType, account?.[bureau]?.accountType, account.type, '—');
  if (field.includes('account status')) return first(button.accountStatus, account?.[bureau]?.accountStatus, '—');
  if (field.includes('monthly')) return first(button.monthlyPayment, '—');
  if (field.includes('date opened')) return first(button.dateOpened, account?.[bureau]?.dateOpened, '—');
  if (field.includes('balance')) return money(first(button.balance, account?.[bureau]?.balance, account.balance));
  if (field.includes('high credit')) return money(first(button.highBalance, account?.[bureau]?.highBalance));
  if (field.includes('credit limit')) return money(first(button.creditLimit, account?.[bureau]?.creditLimit));
  if (field.includes('past due')) return money(first(button.pastDue, account?.[bureau]?.pastDue));
  if (field.includes('payment status')) return first(button.paymentStatus, account?.[bureau]?.paymentStatus, '—');
  if (field.includes('last reported')) return first(button.dateReported?.text, account?.[bureau]?.dateReported?.text, '—');
  if (field.includes('comments')) return first(button.comments, account?.[bureau]?.comments, '—');
  if (field.includes('date last active')) return normalizeDate(first(button.lastActive, account?.[bureau]?.lastActive));
  return '—';
}

function bureauAccountName(account, bureau) {
  return first(
    account?.[bureau]?.['account name'],
    account?.[bureau]?.accountName,
    account?.[bureau]?.cn,
    account.acc_name,
    '—',
  );
}

function accountNumber(account, bureau) {
  return first(
    account?.[bureau]?.['account number'],
    account?.[bureau]?.accountNumber,
    account.acc_num,
    '—',
  );
}

function bureauCard(account, bureau, className, label) {
  const data = account?.[bureau];
  if (!data) return `<div class="bureau-card missing">Data not available</div>`;
  const status = first(
    data.classifycations?.type,
    data.classifycations?.comment,
    bureauValue(account, bureau, ['Account Status:']),
    account.type,
    'Derogatory',
  );
  const age = first(data.classifycations?.dateReported?.text, data.dateReported?.text, 'Verified');
  const payment = bureauValue(account, bureau, ['Payment Status:']);
  return `
    <div class="bureau-card ${className}">
      <h3>${esc(label)} <span class="match-badge">0% Match</span></h3>
      <p class="account-name">${esc(bureauAccountName(account, bureau))}</p>
      <p class="account-number">Account Number # ${esc(accountNumber(account, bureau))}</p>
      <div class="tag-row">
        <span class="tag dark">• ${esc(status)}</span>
        <span class="tag pink">${esc(payment)}</span>
        <span class="tag">${esc(age)}</span>
      </div>
    </div>
  `;
}

function tableRows(account) {
  const rows = [
    ['Account #:', ['Account #:']],
    ['Account Type:', ['Account Type:']],
    ['Account Type - Detail:', ['Account Type - Detail:']],
    ['Bureau Code:', ['Bureau Code:']],
    ['Account Status:', ['Account Status:']],
    ['Monthly Payment:', ['Monthly Payment:']],
    ['Date Opened:', ['Date Opened:']],
    ['Balance:', ['Balance:']],
    ['No. of Months (terms):', ['No. of Months (terms):']],
    ['High Credit:', ['High Credit:']],
    ['Credit Limit:', ['Credit Limit:']],
    ['Past Due:', ['Past Due:']],
    ['Payment Status:', ['Payment Status:']],
    ['Last Reported:', ['Last Reported:']],
    ['Comments:', ['Comments:']],
    ['Date Last Active:', ['Date Last Active:']],
    ['Date of Last Payment:', ['Date of Last Payment:']],
    ['Two-Year payment history', ['Two-Year payment history']],
  ];
  return rows.map(([label, labels]) => `
    <tr>
      <td>${esc(label)}</td>
      ${bureaus.map(([bureau]) => {
        const value = bureauValue(account, bureau, labels);
        const highlight = value && value !== '—' && !String(value).startsWith('Verified');
        return `<td class="${highlight ? 'highlight' : ''}">${esc(value)}</td>`;
      }).join('')}
    </tr>
  `).join('');
}

function expandedAccount(account) {
  return `
    <div class="expanded">
      <section class="table-card">
        <h3>⚙ Table information</h3>
        <div class="table-scroll">
          <table class="info-table">
            <thead>
              <tr>
                <th>${esc(first(account.acc_name, 'Account'))}</th>
                <th class="tu">TransUnion</th>
                <th class="ex">Experian</th>
                <th class="eq">Equifax</th>
              </tr>
            </thead>
            <tbody>${tableRows(account)}</tbody>
          </table>
        </div>
      </section>
      <section class="evidence-card">
        <h3>▧ Dispute Evidence Notes</h3>
        <textarea class="evidence-box" placeholder="Explain the inaccuracy for this account...">${esc(first(account.letter?.reason, account.type, ''))}</textarea>
      </section>
    </div>
  `;
}

function accountRows(client) {
  const accounts = reportAccounts(client);
  if (!accounts.length) {
    return '<div class="empty-note">No derogatory accounts were returned for this client.</div>';
  }
  return accounts.map((account, index) => `
    <article class="account-wrap">
      <button class="account-row" data-expand-account="${index}" type="button">
        <span class="row-number">${String(index + 1).padStart(2, '0')}</span>
        ${bureauCard(account, 'transunion', 'tu', 'TransUnion')}
        ${bureauCard(account, 'experian', 'ex', 'Experian')}
        ${bureauCard(account, 'equifax', 'eq', 'Equifax')}
      </button>
      ${state.expandedAccount === index ? expandedAccount(account) : ''}
    </article>
  `).join('');
}

function openAccounts(client) {
  return list(client.openAccounts);
}

function selectedCreditCard(client) {
  const cards = openAccounts(client);
  return cards.find((account) => /revolving|credit card/i.test(`${account.accountType || ''} ${account.type || ''}`)) || cards[0] || {};
}

function utilizationFor(card) {
  const balance = Number(String(first(card.balance, card.currentBalance, 0)).replace(/[^0-9.-]/g, '')) || 0;
  const limit = Number(String(first(card.creditLimit, card.limit, card.highCredit, 0)).replace(/[^0-9.-]/g, '')) || 0;
  return limit > 0 ? (balance / limit) * 100 : 0;
}

function avgAge(client) {
  const values = Object.values(client.bureauAgeOfCredit || {})
    .map((item) => Number(item.averageAgeYears ?? item.years ?? item.average ?? 0))
    .filter(Number.isFinite);
  if (!values.length) return '0.00 Years';
  return `${(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)} Years`;
}

function renderToolbar() {
  return `
    <form class="full-toolbar" id="clientSearchForm">
      <div class="toolbar-field">
        <label>Search Client</label>
        <input id="clientSearchInput" placeholder="Name, email, phone, ID" />
      </div>
      <div class="toolbar-field">
        <label>Select Client</label>
        <select id="clientSelect">
          ${state.clients.map((client) => `<option value="${esc(client.id)}" ${String(client.id) === String(state.activeClientId) ? 'selected' : ''}>${esc(clientName(client))} — ${esc(client.id)}</option>`).join('')}
        </select>
      </div>
      <div class="toolbar-actions">
        <button class="btn soft" type="submit">Search</button>
        <button class="btn emerald" id="reloadClient" type="button">Reload</button>
      </div>
    </form>
  `;
}

function renderClient(client) {
  const app = getFullApp();
  if (!app) return;
  const nameParts = clientName(client).split(/\s+/);
  const last = nameParts.length > 1 ? nameParts.pop() : '';
  const firstNames = nameParts.join(' ') || clientName(client);
  const card = selectedCreditCard(client);
  const accounts = reportAccounts(client);
  app.innerHTML = `
    ${renderToolbar()}
    <section class="client-hero">
      <div class="client-left">
        <div class="name-row">
          <div class="avatar"></div>
          <div>
            <h1 class="client-name">${esc(firstNames)} <span>${esc(last)}</span> ✎</h1>
            <p class="subtitle">Client Account Overview</p>
          </div>
        </div>
        <div class="identity-grid">
          <div class="identity-card"><span class="identity-icon">◉</span><div><small>SSN Number</small><strong>${esc(maskSsn(client.ssn))}</strong></div></div>
          <div class="identity-card"><span class="identity-icon">▣</span><div><small>Birth Date</small><strong>${esc(normalizeDate(client.dob))}</strong></div></div>
        </div>
      </div>
      <div class="client-right">
        <div class="report-row">
          <div class="status-block"><small>Active Report</small><span class="provider-pill">${esc(first(client.monitoringAgency, client.raw?.monitoringAgency, 'IdentityIQ'))}</span></div>
          <div class="status-block"><small>Select Report Date</small><span class="date-pill">${esc(normalizeDate(client.reportDate))}⌄</span></div>
        </div>
        <div class="hero-actions">
          <button class="btn" type="button">↗ Open Live Report</button>
          <button class="btn emerald" type="button">⇩ Export Case</button>
        </div>
      </div>
    </section>
    <section class="summary-grid">
      <div class="summary-card">
        <div class="age-line"><span>Average Age of Credit</span><strong>${esc(avgAge(client))}</strong></div>
        <div class="score-grid">
          <div class="score tu"><strong>${esc(scoreFor(client, 'transunion'))}</strong><span>TU</span></div>
          <div class="score ex"><strong>${esc(scoreFor(client, 'experian'))}</strong><span>EX</span></div>
          <div class="score eq"><strong>${esc(scoreFor(client, 'equifax'))}</strong><span>EQ</span></div>
        </div>
      </div>
      <div class="module-card">
        <div class="credit-choice">
          <label class="mini-label">Select Credit Card</label>
          <div class="full-select">${esc(first(card.accountName, card.creditorName, card.name, 'No credit card detected'))}⌄</div>
        </div>
        <div class="metric-grid">
          <div class="metric"><small>Balance</small><strong>${esc(money(first(card.balance, card.currentBalance, 0)))}</strong></div>
          <div class="metric"><small>Limit</small><strong>${esc(money(first(card.creditLimit, card.limit, card.highCredit, 0)))}</strong></div>
        </div>
        <div class="utilization"><small>Utilization Rate</small><strong>${esc(pct(utilizationFor(card)))}</strong></div>
      </div>
    </section>
    <section class="auto-attack">
      <button class="btn purple" type="button">★ Auto Attack</button>
      <div>
        <label class="mini-label">Account per Letter</label>
        <div class="account-letter-select">3 Accounts⌄</div>
      </div>
    </section>
    <section class="derogatory-shell">
      <div class="section-title">
        <h2>Derogatory Accounts</h2>
        <span class="count-pill">${accounts.length} accounts</span>
      </div>
      <div class="analysis-header"><span>#</span><span>TransUnion Analysis</span><span>Experian Analysis</span><span>Equifax Analysis</span></div>
      ${accountRows(client)}
    </section>
  `;
  bindEvents();
}

function renderError(error) {
  const app = getFullApp();
  if (!app) return;
  app.innerHTML = `<section class="error-box"><strong>FULL failed to load.</strong><br>${esc(error.message || error)}</section>`;
}

async function loadClients(search = '') {
  const data = await api(`/api/full/clients?searchParam=${encodeURIComponent(search)}`);
  state.clients = list(data.clients);
  if (!state.activeClientId) {
    const params = new URLSearchParams(window.location.search);
    state.activeClientId = first(params.get('client'), params.get('id'), localStorage.getItem('ntSelectedClientId'), state.clients[0]?.id);
  }
}

async function loadClient(clientId) {
  if (!clientId) throw new Error('No client selected.');
  state.activeClientId = String(clientId);
  localStorage.setItem('ntSelectedClientId', state.activeClientId);
  const data = await api(`/api/full/clients/${encodeURIComponent(state.activeClientId)}`);
  state.activeClient = data.client;
  if (!reportAccounts(state.activeClient).length) {
    try {
      const snapshot = await api(`/full-api/clients/${encodeURIComponent(state.activeClientId)}`);
      const snapshotReport = snapshot.json || {};
      if (Array.isArray(snapshotReport.accounts) && snapshotReport.accounts.length) {
        state.activeClient = {
          ...state.activeClient,
          firstName: first(state.activeClient.firstName, snapshot.first_name),
          lastName: first(state.activeClient.lastName, snapshot.last_name),
          email: first(state.activeClient.email, snapshot.email),
          phone: first(state.activeClient.phone, snapshot.phone),
          ssn: first(state.activeClient.ssn, snapshot.ssn),
          dob: first(state.activeClient.dob, snapshot.dob),
          json: snapshotReport,
        };
      }
    } catch {
      // Static snapshots are optional; the live store remains the primary source.
    }
  }
  if (window.ND_HASH_SHELL_ACTIVE) {
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}#/dispute/${encodeURIComponent(state.activeClientId)}`);
  } else {
    const url = new URL(window.location.href);
    url.searchParams.set('client', state.activeClientId);
    window.history.replaceState({}, '', url);
  }
  renderClient(state.activeClient);
}

function bindEvents() {
  document.getElementById('clientSearchForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await loadClients(document.getElementById('clientSearchInput').value.trim());
    if (state.clients[0]) await loadClient(state.clients[0].id);
  });
  document.getElementById('clientSelect')?.addEventListener('change', (event) => loadClient(event.target.value).catch(renderError));
  document.getElementById('reloadClient')?.addEventListener('click', () => loadClient(state.activeClientId).catch(renderError));
  document.querySelectorAll('[data-expand-account]').forEach((button) => {
    button.addEventListener('click', () => {
      state.expandedAccount = Number(button.dataset.expandAccount);
      renderClient(state.activeClient);
    });
  });
}

async function init() {
  try {
    await loadClients('');
    await loadClient(state.activeClientId || state.clients[0]?.id);
  } catch (error) {
    renderError(error);
  }
}

window.renderFullModernDispute = async (clientId = '') => {
  state.activeClientId = String(clientId || state.activeClientId || '');
  try {
    await loadClients('');
    await loadClient(state.activeClientId || state.clients[0]?.id);
  } catch (error) {
    renderError(error);
  }
};

if (!window.ND_HASH_SHELL_ACTIVE) {
  init();
}
