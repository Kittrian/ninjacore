const cssHref = '/nd-hash-shell.css?v=20260527-09';
if (!document.querySelector(`link[href="${cssHref}"]`)) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = cssHref;
  document.head.appendChild(link);
}

const state = {
  clients: [],
  selectedClient: null,
  search: '',
  modalClient: null,
};

const fullApi = {
  clients: '/api/full/clients',
  client: (id) => `/api/full/clients/${encodeURIComponent(id)}`,
  letters: '/full-api/templates',
  template: '/full-api/paraghraph',
  alternate: '/full-api/alternate',
  creditor: '/full-api/creditor',
};

const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');
const list = (value) => Array.isArray(value) ? value : [];
const first = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== '') ?? '';
const clientName = (client = {}) => `${first(client.firstName, client.first_name)} ${first(client.lastName, client.last_name)}`.trim() || 'Unnamed Client';
const money = (value) => {
  const num = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? num.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '$0.00';
};
const route = () => String(location.hash || '#/clients').replace(/^#\/?/, '').split('/').filter(Boolean);

async function getJson(url) {
  const response = await fetch(url, { credentials: 'include' });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`);
  return body;
}

async function loadClients(search = '') {
  const payload = await getJson(`${fullApi.clients}?searchParam=${encodeURIComponent(search)}`);
  state.clients = list(payload.clients);
  return state.clients;
}

async function loadClient(id) {
  const payload = await getJson(fullApi.client(id));
  let client = payload.client;
  if (!list(client?.json?.accounts).length) {
    try {
      const snapshot = await getJson(`/full-api/clients/${encodeURIComponent(id)}`);
      if (snapshot?.json) {
        client = {
          ...client,
          firstName: first(client.firstName, snapshot.first_name),
          lastName: first(client.lastName, snapshot.last_name),
          email: first(client.email, snapshot.email),
          phone: first(client.phone, snapshot.phone),
          ssn: first(client.ssn, snapshot.ssn),
          dob: first(client.dob, snapshot.dob),
          address: first(client.address, snapshot.address, snapshot.currentAddress),
          json: snapshot.json,
        };
      }
    } catch {
    }
  }
  state.selectedClient = client;
  return client;
}

function scores(client = {}) {
  const data = list(client.json?.data)[0] || {};
  return {
    tu: first(data.creditScore?.TransUnion, data.creditScore?.TransUnion?.score, client.creditScores?.transunion, ''),
    ex: first(data.creditScore?.Experian, data.creditScore?.Experian?.score, client.creditScores?.experian, ''),
    eq: first(data.creditScore?.Equifax, data.creditScore?.Equifax?.score, client.creditScores?.equifax, ''),
  };
}

function topbar(active) {
  return `
    <header class="nd-topbar">
      <div class="nd-brand">
        <button class="nd-menu" type="button">☰</button>
        <img class="nd-logo" src="/full-spa-backup/logo--no-bg.png" alt="Ninja Dispute" onerror="this.style.display='none'">
        <span>Ninja Dispute</span>
      </div>
      <form class="nd-search" id="ndSearchForm">
        <input id="ndSearchInput" value="${esc(state.search)}" placeholder="Search Client">
      </form>
      <div class="nd-top-spacer"></div>
      <div class="nd-top-icons"><span class="nd-bell">🔔</span><span>✅</span><span class="nd-avatar">K</span></div>
    </header>
    <aside class="nd-sidebar">
      ${[
        ['clients', '▣', '#/clients'],
        ['letters', '▤', '#/letters'],
        ['template', '▤', '#/template'],
        ['alternate', '▤', '#/alternate'],
        ['creditor', '▤', '#/creditor'],
      ].map(([key, icon, href]) => `<a class="nd-nav-link ${active === key ? 'is-active' : ''}" href="${href}" title="${key}">${icon}</a>`).join('')}
    </aside>
  `;
}

function shell(active, content) {
  document.body.innerHTML = `<div class="nd-app">${topbar(active)}<main class="nd-content">${content}</main></div>`;
  document.getElementById('ndSearchForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    state.search = document.getElementById('ndSearchInput')?.value.trim() || '';
    location.hash = `#/clients${state.search ? `?q=${encodeURIComponent(state.search)}` : ''}`;
    await render();
  });
}

function table(headers, rows, empty = 'No data available') {
  return `
    <table class="nd-table">
      <thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead>
      <tbody>${rows.length ? rows.join('') : `<tr><td colspan="${headers.length}">⚠ ${esc(empty)}</td></tr>`}</tbody>
    </table>
  `;
}

async function renderClients() {
  await loadClients(state.search);
  const rows = state.clients.map((client, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><a class="nd-client-name" href="#/dispute/${esc(client.id)}">${esc(clientName(client))}</a></td>
      <td>${esc(client.phone || '')}</td>
      <td>${esc(client.email || '')}</td>
      <td>${esc(client.status || '')}</td>
      <td>${esc(client.reportDate || '')}</td>
      <td><button class="nd-action" data-edit-client="${esc(client.id)}">✎</button></td>
    </tr>
  `);
  shell('clients', `<section class="nd-card nd-list-card"><div class="nd-page-head"><h1>Clients</h1><button class="nd-add">ADD</button></div>${table(['#', 'Name', 'Phone', 'Email', 'Status', 'Report Date', 'Action'], rows)}</section>`);
  document.querySelectorAll('[data-edit-client]').forEach((button) => {
    button.addEventListener('click', async () => {
      state.modalClient = await loadClient(button.dataset.editClient);
      renderClientModal();
    });
  });
}

async function renderListPage(active, title, endpoint, columns, mapRow) {
  const payload = await getJson(endpoint);
  const rowsData = Array.isArray(payload) ? payload : Object.values(payload).find(Array.isArray) || [];
  const rows = rowsData.map((row, index) => mapRow(row, index));
  shell(active, `<section class="nd-card nd-list-card"><div class="nd-page-head"><h1>${esc(title)}</h1><button class="nd-add">ADD</button></div>${table(columns, rows)}</section>`);
}

function renderLetters() {
  return renderListPage('letters', 'Letters', fullApi.letters, ['#', 'Name', 'File Name', 'TransUnion', 'Equifax', 'Experian', 'Action'], (row) => `
    <tr><td>${esc(row.id)}</td><td>${esc(row.name)}</td><td>${esc(first(row.file_name, row.name))} 👁</td><td>${esc(row.tu || row.transunion || 'TransUnion PO Box 2000 Ch...')}</td><td>${esc(row.eq || row.equifax || 'Equifax P.O. Box 740256 Atl...')}</td><td>${esc(row.ex || row.experian || 'Experian P.O. Box 9701 Alle...')}</td><td><button class="nd-action">✎</button><button class="nd-action">🗑</button></td></tr>
  `);
}

function renderTemplates() {
  return renderListPage('template', 'Dispute Templates', fullApi.template, ['#', 'Name', 'Text', 'Action'], (row) => `
    <tr><td>${esc(row.id)}</td><td>${esc(first(row.key, row.name, row.title))}</td><td>${esc(first(row.value, row.body, row.content)).slice(0, 420)}</td><td><button class="nd-action">✎</button><button class="nd-action">🗑</button></td></tr>
  `);
}

function renderAlternate() {
  return renderListPage('alternate', 'Alternate Letters', fullApi.alternate, ['#', 'Name', 'Action'], (row) => `
    <tr><td>${esc(row.id)}</td><td>${esc(first(row.name, row.title))}</td><td><button class="nd-action">✎</button><button class="nd-action">🗑</button></td></tr>
  `);
}

function renderCreditor() {
  return renderListPage('creditor', 'Creditor Contacts', fullApi.creditor, ['#', 'Name', 'Address', 'Action'], (row) => `
    <tr><td>${esc(row.id)}</td><td>${esc(row.name)}</td><td>${esc(first(row.value, row.address))}</td><td><button class="nd-action">✎</button><button class="nd-action">🗑</button></td></tr>
  `);
}

function accountCell(account, bureau, label) {
  const value = account?.[bureau];
  if (!value) return `<td><span class="nd-small">Data not available</span></td>`;
  return `<td><strong class="${label}">${esc(first(value.cn, value['account name'], account.acc_name, account.creditorName))}</strong><br><span class="nd-small">${esc(first(value['account number'], account.acc_num, account.accountNumber))}</span></td>`;
}

function disputeTable(client) {
  const accounts = list(client.json?.accounts);
  const rows = accounts.map((account, index) => `
    <tr>
      <td>${index + 1}</td>
      ${accountCell(account, 'transunion', 'tu')}
      ${accountCell(account, 'experian', 'ex')}
      ${accountCell(account, 'equifax', 'eq')}
      <td><input type="checkbox"></td>
      <td><input type="checkbox"></td>
      <td>${esc(account.letter?.name || '')}</td>
      <td>${esc(account.type || '')}</td>
      <td>${esc(account.type || '')}</td>
      <td><button class="nd-action">🚫</button></td>
    </tr>
  `);
  return table(['No.', 'TransUnion', 'Experian', 'Equifax', 'Add Table', 'Add Incon', 'Letter', 'Dispute Reason #1', 'Dispute Reason #2', 'Remove Account'], rows);
}

async function renderDispute(id) {
  const client = await loadClient(id);
  const score = scores(client);
  const cards = list(client.openAccounts);
  const card = cards[0] || {};
  shell('clients', `
    <section class="nd-dispute-page">
      <div class="nd-dispute-head">
        <div><h1 class="nd-client-title">${esc(clientName(client))} <button class="nd-action" data-edit-client="${esc(client.id)}">✎</button></h1><div class="nd-small">${esc(client.ssn || '')}<br>${esc(client.dob || '')}</div></div>
        <div class="nd-dispute-controls"><button class="nd-open-btn">Open Report</button><button class="nd-action">☁</button><select class="nd-flat-select"><option>Select Report By Month</option><option selected>${esc(client.reportDate || 'Latest Report')}</option></select></div>
      </div>
      <div class="nd-score-area">
        <div><p>Average Age of Credit <strong>${esc(client.bureauAgeOfCredit?.transunion?.averageAgeYears || 'NaN')} Years</strong></p><div class="nd-bureau-icons"><span class="tu">${esc(score.tu || 'tu')}</span><span class="ex">${esc(score.ex || 'e')}</span><span class="eq">${esc(score.eq || 'EQ')}</span></div></div>
        <div class="nd-auto-grid"><button class="nd-auto-btn">⚔ AUTO ATTACK</button><select class="nd-flat-select"><option>Account per Letter</option><option selected>5 Accounts</option></select><select class="nd-flat-select nd-wide-select"><option>${esc(first(card.name, card.creditorName, 'Select Credit Card'))}</option></select><div class="nd-metrics"><div><span class="nd-small">BALANCE</span><br><strong>${money(first(card.balance, 0))}</strong></div><div><span class="nd-small">LIMIT</span><br><strong>${money(first(card.creditLimit, 0))}</strong></div><div><span class="nd-small">UTILIZATION</span></div></div></div>
      </div>
      <div class="nd-add-account-row"><select class="nd-flat-select"><option>Add Account from Credit Report</option></select><div class="nd-bankruptcy-row"><select class="nd-flat-select"><option>Select Bankruptcy</option></select><button class="nd-outline-btn">ADD MORE ACCOUNTS</button><label class="nd-switch">⚪ Get Personal Info?</label></div></div>
      <section class="nd-card"><div class="nd-page-head"><h1>Derogatory Accounts</h1><button class="nd-link-btn">⟳ RESET DATA</button></div>${disputeTable(client)}</section>
      ${['Credit Info', 'Progress', 'Inquiries', 'Tradeline Comparison Report'].map((title) => `<div class="nd-collapse"><div class="nd-collapse-title">◉ ${esc(title)} <span style="margin-left:auto">⌄</span></div></div>`).join('')}
      <section class="nd-card nd-alt-grid"><div class="nd-section-title">Alternate Letters</div>${table(['Choose Letter', 'Choose Bureau', 'Bureau\\Repository Address', 'Choose Creditor', 'Address of Creditor', 'Add Incon', 'Account / Reference #', 'Actions'], ['<tr><td><input placeholder="LETTER"></td><td><input placeholder="Choose Bureau"></td><td></td><td><input placeholder="Choose Creditor"></td><td></td><td><input type="checkbox"></td><td><input></td><td>＋ －</td></tr>'])}</section>
    </section>
  `);
  document.querySelector('[data-edit-client]')?.addEventListener('click', () => {
    state.modalClient = client;
    renderClientModal();
  });
}

function renderClientModal() {
  const client = state.modalClient;
  if (!client) return;
  const modal = document.createElement('div');
  modal.className = 'nd-modal-backdrop';
  modal.innerHTML = `
    <section class="nd-modal">
      <h2>Edit Client</h2>
      <h3>Client details</h3>
      <div class="nd-form-grid">
        ${[
          ['First Name', first(client.firstName, client.first_name)],
          ['Last Name', first(client.lastName, client.last_name)],
          ['Phone Number', client.phone],
          ['Email', client.email],
          ['Address', client.address, 'wide'],
          ['SSN', client.ssn],
          ['DOB', client.dob],
          ['Secret Question', first(client.secretQuestion, String(client.ssn || '').slice(-4)), 'wide'],
          ['User Name', first(client.monitoringUsername, client.email)],
          ['Password', client.monitoringPassword || '••••••••'],
          ['Names', list(client.names).join('\\n'), ''],
          ['Employers', list(client.employers).join('\\n'), ''],
          ['Current Address', client.currentAddress || '', 'wide'],
          ['Addresses', list(client.addresses).join('\\n\\n'), 'wide'],
        ].map(([label, value, wide]) => `<div class="nd-field ${wide === 'wide' ? 'wide' : ''}"><label>${esc(label)}</label>${String(value || '').includes('\\n') || wide === 'wide' ? `<textarea rows="4">${esc(value)}</textarea>` : `<input value="${esc(value)}">`}</div>`).join('')}
      </div>
      <div class="nd-doc-grid">${['Photo ID', 'SSN DOC', 'POA 1', 'POA 2', 'POA 3', 'Cover Sheet / LPOA'].map((label) => `<div class="nd-doc-box"><div class="nd-doc-thumb">${esc(label)}</div><strong>${esc(label)}</strong><br><button class="nd-link-btn">View / Edit / Replace</button></div>`).join('')}</div>
      <p class="nd-small">Additional Information</p>
      <div class="nd-form-grid"><div class="nd-field"><label>Description</label><input value="smartcredit_member_id"></div><div class="nd-field"><label>Information</label><input value=""></div></div>
      <div class="nd-modal-actions"><button class="nd-link-btn" id="ndModalCancel">CANCEL</button><button class="nd-link-btn" id="ndModalSave">SAVE</button></div>
    </section>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.id === 'ndModalCancel' || event.target.id === 'ndModalSave') modal.remove();
  });
}

async function render() {
  try {
    const [name, id] = route();
    if (!name) {
      location.hash = '#/clients';
      return;
    }
    if (name === 'clients') return renderClients();
    if (name === 'letters') return renderLetters();
    if (name === 'template') return renderTemplates();
    if (name === 'alternate') return renderAlternate();
    if (name === 'creditor') return renderCreditor();
    if (name === 'dispute' && id) return renderDispute(id);
    location.hash = '#/clients';
  } catch (error) {
    shell('clients', `<section class="nd-card"><div class="nd-page-head"><h1>Load Error</h1></div><p style="padding:18px;color:#b91c1c">${esc(error.message)}</p></section>`);
  }
}

window.addEventListener('hashchange', render);
render();
