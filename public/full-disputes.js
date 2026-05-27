const ND_API = 'https://api.ninjadispute.com';
const state = {
  clients: [],
  activeClientId: '',
};

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');
const list = (value) => Array.isArray(value) ? value : [];
const first = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== '') ?? '';
const attr = (value, key) => first(value?.[`@${key}`], value?.[key], value?.attributes?.[key]);
const descriptor = (value) => first(value?.['@description'], value?.description, value?.['@symbol'], value?.symbol, value?.['@abbreviation'], value?.abbreviation, value);

async function fetchJson(path) {
  const res = await fetch(`${ND_API}${path}`, { credentials: 'include' });
  const text = await res.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }
  if (!res.ok) {
    throw new Error(payload?.error || payload?.message || `HTTP ${res.status}`);
  }
  return payload;
}

function clientName(client) {
  return `${first(client.first_name, client.firstName)} ${first(client.last_name, client.lastName)}`.trim() || '(missing name)';
}

function clientMeta(client) {
  return [
    first(client.email),
    first(client.phone),
    `id ${client.id}`,
  ].filter(Boolean).join(' | ');
}

function setStatus(message, isError = false) {
  const node = $('fullStatus');
  node.textContent = message;
  node.style.color = isError ? '#a23124' : '';
}

function renderClientList() {
  const wrap = $('fullClientList');
  wrap.innerHTML = state.clients.map((client) => `
    <button class="full-client-button${String(client.id) === String(state.activeClientId) ? ' is-active' : ''}" type="button" data-client-id="${esc(client.id)}">
      <strong>${esc(clientName(client))}</strong>
      <span>${esc(clientMeta(client))}</span>
    </button>
  `).join('') || '<p class="empty-note">No clients returned.</p>';
  wrap.querySelectorAll('[data-client-id]').forEach((button) => {
    button.addEventListener('click', () => loadClient(button.dataset.clientId));
  });
}

async function loadClients(search = '') {
  setStatus('Loading clients...');
  const data = await fetchJson(`/clients?pageNumber=1&searchParam=${encodeURIComponent(search)}`);
  state.clients = list(data.clients);
  setStatus(`${state.clients.length} client${state.clients.length === 1 ? '' : 's'} loaded`);
  renderClientList();
}

function scoreValue(reportData, client, bureau) {
  const oldName = bureau === 'transunion' ? 'TransUnion' : bureau === 'experian' ? 'Experian' : 'Equifax';
  return first(
    reportData?.creditScore?.[oldName]?.score,
    reportData?.creditScore?.[bureau]?.score,
    client?.creditScores?.[bureau],
    client?.creditScores?.[oldName],
    '-',
  );
}

function completeness(client, report, data, accounts) {
  const checks = [
    ['Name', clientName(client) !== '(missing name)'],
    ['SSN', Boolean(client.ssn)],
    ['DOB', Boolean(client.dob)],
    ['Report row', Boolean(report)],
    ['Report data', data.length > 0],
    ['Scores', data.some((entry) => entry?.creditScore) || Boolean(client.creditScores)],
    ['Accounts', accounts.length > 0],
    ['Tradelines', data.some((entry) => list(entry?.TradeLinePartition).length)],
    ['Inquiries', data.some((entry) => list(entry?.InquiryPartition).length)],
    ['Subscribers', data.some((entry) => list(entry?.Subscriber).length)],
  ];
  return `<div class="full-pill-row">${checks.map(([label, ok]) => `<span class="full-pill ${ok ? 'good' : 'bad'}">${esc(label)}: ${ok ? 'found' : 'missing'}</span>`).join('')}</div>`;
}

function table(headers, rows, emptyText) {
  if (!rows.length) return `<p class="empty-note">${esc(emptyText)}</p>`;
  return `<div class="full-table-wrap"><table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

function renderReportAccounts(accounts) {
  const rows = accounts.map((account) => `
    <tr>
      <td><strong>${esc(first(account.acc_name, account.name, account.creditorName, '-'))}</strong><br><span class="muted">${esc(first(account.acc_num, account.accountNumber))}</span></td>
      <td>${esc(first(account.type, account.status, account.accountType, '-'))}</td>
      <td>${esc(first(account.balance, account.currentBalance, '-'))}</td>
      <td>${bureauCell(account.transunion)}</td>
      <td>${bureauCell(account.experian)}</td>
      <td>${bureauCell(account.equifax)}</td>
      <td>${esc(first(account.letter?.name, account.letter?.file_name, account.letterName, '-'))}</td>
    </tr>
  `);
  return table(['Account', 'Type', 'Balance', 'TransUnion', 'Experian', 'Equifax', 'Letter'], rows, 'No cached json.accounts rows were returned.');
}

function bureauCell(value) {
  if (!value) return '-';
  return [
    first(value.type, value.status),
    first(value.classifycations?.comment, value.comment),
    first(value.classifycations?.dataButton?.accountStatus),
  ].filter(Boolean).map(esc).join('<br>') || 'present';
}

function renderTradelines(data) {
  const rows = [];
  data.forEach((entry, entryIndex) => {
    list(entry?.TradeLinePartition).forEach((partition, partitionIndex) => {
      const tradelines = list(partition?.Tradeline);
      const creditor = first(...tradelines.map((line) => first(line?.creditorName, line?.['@creditorName'])), attr(partition, 'creditorName'), '-');
      const bureaus = tradelines.map((line) => descriptor(line?.Source?.Bureau)).filter(Boolean).join(', ');
      const accountNumber = first(...tradelines.map((line) => first(line?.accountNumber, line?.['@accountNumber'])), attr(partition, 'accountNumber'), '-');
      const accountType = first(attr(partition, 'accountTypeDescription'), ...tradelines.map((line) => descriptor(line?.GrantedTrade?.CreditType)), '-');
      const status = first(...tradelines.map((line) => descriptor(line?.PayStatus)), ...tradelines.map((line) => descriptor(line?.AccountCondition)), '-');
      const balance = first(...tradelines.map((line) => first(line?.currentBalance, line?.['@currentBalance'])), '-');
      const dispute = first(...tradelines.map((line) => descriptor(line?.DisputeFlag)), ...tradelines.map((line) => descriptor(line?.AccountDesignator)), '-');
      rows.push(`
        <tr>
          <td>${entryIndex + 1}.${partitionIndex + 1}</td>
          <td><strong>${esc(creditor)}</strong><br><span class="muted">${esc(accountNumber)}</span></td>
          <td>${esc(bureaus || '-')}</td>
          <td>${esc(accountType)}</td>
          <td>${esc(status)}</td>
          <td>${esc(balance)}</td>
          <td>${esc(dispute)}</td>
        </tr>
      `);
    });
  });
  return table(['#', 'Creditor', 'Bureaus', 'Account Type', 'Status', 'Balance', 'Dispute Signal'], rows, 'No TradeLinePartition rows were returned.');
}

function renderInquiries(data) {
  const rows = [];
  data.forEach((entry, entryIndex) => {
    list(entry?.InquiryPartition).forEach((inquiry, inquiryIndex) => {
      const items = list(inquiry?.Inquiry).length ? list(inquiry.Inquiry) : [inquiry];
      items.forEach((item) => {
        rows.push(`
          <tr>
            <td>${entryIndex + 1}.${inquiryIndex + 1}</td>
            <td>${esc(first(item?.subscriberName, item?.['@subscriberName'], attr(inquiry, 'subscriberName'), '-'))}</td>
            <td>${esc(descriptor(item?.Bureau) || descriptor(item?.Source?.Bureau) || '-')}</td>
            <td>${esc(first(item?.inquiryDate, item?.['@inquiryDate'], item?.date, item?.['@date'], '-'))}</td>
            <td>${esc(first(descriptor(item?.IndustryCode), attr(inquiry, 'inquiryType'), '-'))}</td>
          </tr>
        `);
      });
    });
  });
  return table(['#', 'Subscriber', 'Bureau', 'Date', 'Type'], rows, 'No InquiryPartition rows were returned.');
}

function renderSubscribers(data) {
  const rows = [];
  data.forEach((entry) => {
    list(entry?.Subscriber).forEach((subscriber) => {
      rows.push(`
        <tr>
          <td><strong>${esc(first(subscriber?.name, subscriber?.['@name'], subscriber?.subscriberName, '-'))}</strong><br><span class="muted">${esc(first(subscriber?.code, subscriber?.['@code']))}</span></td>
          <td>${esc(first(subscriber?.address, subscriber?.Address?.unparsedStreet, subscriber?.StreetAddress, '-'))}</td>
          <td>${esc(first(subscriber?.city, subscriber?.Address?.city, '-'))}</td>
          <td>${esc(first(subscriber?.state, subscriber?.Address?.stateCode, '-'))}</td>
          <td>${esc(first(subscriber?.phone, subscriber?.Phone?.number, '-'))}</td>
        </tr>
      `);
    });
  });
  return table(['Subscriber', 'Address', 'City', 'State', 'Phone'], rows, 'No Subscriber rows were returned.');
}

function renderJsonSection(title, value, emptyText) {
  const hasData = Array.isArray(value) ? value.length > 0 : Boolean(value && Object.keys(value).length);
  return `
    <section class="full-section">
      <details ${hasData ? '' : 'open'}>
        <summary>${esc(title)}</summary>
        ${hasData ? `<pre class="json-block">${esc(JSON.stringify(value, null, 2))}</pre>` : `<p class="empty-note">${esc(emptyText)}</p>`}
      </details>
    </section>
  `;
}

function renderClient(client) {
  const report = client.json || null;
  const data = list(report?.data);
  const latest = data[0] || {};
  const accounts = list(report?.accounts);
  const extraInfo = list(client.extraInfo);
  const profileCards = [
    ['Client ID', client.id],
    ['Name', clientName(client)],
    ['SSN', first(client.ssn, '-')],
    ['DOB', first(client.dob, '-')],
    ['Phone', first(client.phone, '-')],
    ['Email', first(client.email, '-')],
    ['Address', first(client.address, '-')],
    ['Report Type', first(report?.reportType, report?.report_type, '-')],
  ];

  $('fullContent').innerHTML = `
    <div class="full-detail-head">
      <div>
        <h2>${esc(clientName(client))}</h2>
        <p class="muted">Full renderer for /clients/${esc(client.id)}?all=1</p>
      </div>
      <button type="button" id="reloadClientBtn">Reload Client</button>
    </div>

    <section class="full-section">
      <h3>Completeness</h3>
      ${completeness(client, report, data, accounts)}
    </section>

    <div class="full-grid cols-3">
      ${profileCards.map(([label, value]) => `<div class="full-card"><small>${esc(label)}</small><strong>${esc(first(value, '-'))}</strong></div>`).join('')}
    </div>

    <section class="full-section">
      <h3>Bureau Scores</h3>
      <div class="full-grid cols-3">
        ${['transunion', 'experian', 'equifax'].map((bureau) => `<div class="full-card full-score"><small>${esc(bureau)}</small><strong>${esc(scoreValue(latest, client, bureau))}</strong></div>`).join('')}
      </div>
    </section>

    <section class="full-section">
      <h3>Cached Dispute Accounts</h3>
      ${renderReportAccounts(accounts)}
    </section>

    <section class="full-section">
      <h3>All Tradeline Partitions</h3>
      ${renderTradelines(data)}
    </section>

    <section class="full-section">
      <h3>Inquiries</h3>
      ${renderInquiries(data)}
    </section>

    <section class="full-section">
      <h3>Subscribers And Furnishers</h3>
      ${renderSubscribers(data)}
    </section>

    ${renderJsonSection('Public Records', data.flatMap((entry) => list(entry?.PulblicRecordPartition || entry?.PublicRecordPartition)), 'No public-record partition was returned.')}
    ${renderJsonSection('Progress', report?.progress || [], 'No progress array was returned.')}
    ${renderJsonSection('Deletions Lists', report?.deletetionsLists || report?.deletionsLists || [], 'No deletions list was returned.')}
    ${renderJsonSection('Compare', report?.compare || [], 'No compare array was returned.')}
    ${renderJsonSection('Alternate Letters', report?.alternateLetters || [], 'No alternate letters were returned.')}
    ${renderJsonSection('Extra Info', extraInfo, 'No extraInfo rows were returned.')}
    ${renderJsonSection('Raw Client Payload', client, 'No client payload returned.')}
  `;
  $('reloadClientBtn').addEventListener('click', () => loadClient(client.id));
}

async function loadClient(clientId) {
  state.activeClientId = String(clientId);
  renderClientList();
  $('fullContent').innerHTML = '<div class="full-empty-state"><h2>Loading client...</h2></div>';
  try {
    const client = await fetchJson(`/clients/${encodeURIComponent(clientId)}?all=1`);
    renderClient(client);
    const url = new URL(window.location.href);
    url.searchParams.set('client', clientId);
    window.history.replaceState({}, '', url);
  } catch (error) {
    $('fullContent').innerHTML = `<div class="full-empty-state"><h2>Could not load client</h2><p>${esc(error.message)}</p></div>`;
  }
}

function bindSearch() {
  $('fullSearchForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    try {
      await loadClients($('fullSearchInput').value.trim());
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      button.disabled = false;
    }
  });
}

async function init() {
  bindSearch();
  try {
    await loadClients('');
    const clientId = new URL(window.location.href).searchParams.get('client');
    if (clientId) {
      loadClient(clientId);
    }
  } catch (error) {
    setStatus(`${error.message}. Sign in through NinjaDispute/Auth first, then refresh /FULL.`, true);
  }
}

init();
