const byId = (id) => document.getElementById(id);

const clientSelect = byId('learningClientSelect');
const accountSelect = byId('learningAccountSelect');
const statusNode = byId('learningStatus');
const comparisonWrap = byId('learningComparisonWrap');
const creditorTitle = byId('learningCreditorTitle');
const clientSummary = byId('learningClientSummary');
const accountMeta = byId('learningAccountMeta');
const editorToggleBtn = byId('learningEditorToggleBtn');
const editorPanel = byId('learningEditorPanel');
const editorArea = byId('learningEditorArea');
const editorColorInput = byId('learningEditorColor');
const editorTagBtn = byId('learningEditorTagBtn');
const editorRenderTagsBtn = byId('learningEditorRenderTagsBtn');
const editorTableBtn = byId('learningEditorTableBtn');
const editorImageBtn = byId('learningEditorImageBtn');
const editorYoutubeBtn = byId('learningEditorYoutubeBtn');
const editorRawHtmlBtn = byId('learningEditorRawHtmlBtn');
const editorEditRawHtmlBtn = byId('learningEditorEditRawHtmlBtn');
const editorSpinnerTagBtn = byId('learningEditorSpinnerTagBtn');
const editorAiLevelSelect = byId('learningEditorAiLevelSelect');
const editorAiProviderSelect = byId('learningEditorAiProviderSelect');
const syncBotContextBtn = byId('learningSyncBotContextBtn');
const editorSetGrokKeyBtn = byId('learningEditorSetGrokKeyBtn');
const editorAiBtn = byId('learningEditorAiBtn');
const editorAiInitialBtn = byId('learningEditorAiInitialBtn');
const editorAiLevel3Btn = byId('learningEditorAiLevel3Btn');
const editorAiLevel5Btn = byId('learningEditorAiLevel5Btn');
const editorAiLevel7Btn = byId('learningEditorAiLevel7Btn');
const editorAiMostAggressiveBtn = byId('learningEditorAiMostAggressiveBtn');
const editorSaveBtn = byId('learningEditorSaveBtn');
const editorLoadBtn = byId('learningEditorLoadBtn');
const aiPromptInput = byId('learningAiPromptInput');
const aiPromptProviderSelect = byId('learningAiPromptProviderSelect');
const aiPromptModeSelect = byId('learningAiPromptModeSelect');
const aiPromptSendBtn = byId('learningAiPromptSendBtn');
const aiPromptBox = document.querySelector('.floating-label-form-group');
const aiPromptHeadingBtn = aiPromptBox ? aiPromptBox.querySelector('.floating-label-form-group__heading button') : null;
const aiPromptCloseBtn = aiPromptBox ? aiPromptBox.querySelector('.form-close-button') : null;
const editorWorkspace = byId('learningEditorWorkspace');
const tagDrawerList = byId('learningTagDrawerList');
const tagDrawerHint = byId('learningTagDrawerHint');
const metro2GuideNode = byId('learningMetro2Guide');
const resourcePanel = byId('learningResourcePanel');
const resourceButtons = Array.from(document.querySelectorAll('[data-resource]'));
const metro2Panel = byId('learningMetro2Panel');
const docPanel = byId('learningDocPanel');
const pdfLoadBtn = byId('learningPdfLoadBtn');
const pdfSearchInput = byId('learningPdfSearchInput');
const pdfSearchBtn = byId('learningPdfSearchBtn');
const pdfFrameWrap = byId('learningPdfFrameWrap');
const pdfFrame = byId('learningPdfFrame');

const state = {
  clients: [],
  selectedClientId: '',
  selectedClient: null,
  selectedClientAccounts: [],
  selectedAccountId: '',
  selectedAccount: null,
  selectedSource: '',
  learningContext: null,
};
let botContextSyncTimer = null;
let lastBotContextSyncKey = '';
let lastBotContextSyncAt = 0;
const LEARNING_SELECTED_CLIENT_STORAGE_KEY = 'ninja-selected-client-id';
const LEARNING_CONTEXT_STORAGE_KEY = 'ninja-learning-active-context';
const LEARNING_CONTEXT_EVENT = 'ninja-learning-context';

const PDF_DOCS = {
  fcra: {
    label: 'FCRA March 2026',
    pdfUrl: 'https://www.ftc.gov/system/files/ftc_gov/pdf/fcra-march-2026.pdf',
  },
  fdcpa: {
    label: 'FDCPA',
    pdfUrl: 'https://www.ftc.gov/system/files/documents/plain-language/fair-debt-collection-practices-act.pdf',
  },
};
const PDFJS_VIEWER_URL = 'https://mozilla.github.io/pdf.js/web/viewer.html';
let pdfEmbedded = false;
let activePdfDocKey = 'fcra';
let activeRawHtmlBlock = null;

const bureauOrder = ['transunion', 'experian', 'equifax'];
const bureauLabels = {
  transunion: 'TransUnion',
  experian: 'Experian',
  equifax: 'Equifax',
};
const bureauCssClass = {
  transunion: 'tu',
  experian: 'ex',
  equifax: 'eq',
};
const bureauTagSuffix = {
  transunion: 'tu',
  experian: 'ex',
  equifax: 'eq',
};

const metro2Segments = [
  {
    title: 'BSCF · Base Segment Character Format',
    description: 'Primary account tradeline segment. Core fields for account type, portfolio type, ownership, balances, payment profile, and dates are carried here.',
    badges: ['BSCF', 'BS-9', 'BS-11', 'BS-12', 'BS-21', 'BS-22', 'BS-27', 'BS-37'],
  },
  {
    title: 'HRCF · Header Record Character Format',
    description: 'File-level and data reporter identity context. Includes reporter identity elements and routing metadata used before account-level segments.',
    badges: ['HRCF', 'HR-13', 'HR-14'],
  },
  {
    title: 'J1S / J2S · Name & Consumer Detail Extensions',
    description: 'Supplemental consumer identification segments typically used when extra borrower or associated-party identity context is needed beyond base fields.',
    badges: ['J1S', 'J2S'],
  },
  {
    title: 'K1S–K4S · Consumer/Account Detail Extensions',
    description: 'Additional supplemental segments for account-holder identity, ownership context, and extended furnishable details required by implementation rules.',
    badges: ['K1S', 'K2S', 'K3S', 'K4S', 'K1S-3'],
  },
  {
    title: 'L1S / N1S · Supplemental Narrative & Conditions',
    description: 'Segments used for extra account narratives, specialized conditions, and extended compliance/dispute-related reporting where present.',
    badges: ['L1S', 'N1S', '^NTCU^'],
  },
  {
    title: 'TRCF · Trailer Record Character Format',
    description: 'File trailer totals and control counts used for validation/reconciliation after all account segments are processed.',
    badges: ['TRCF', 'record counts', 'control totals'],
  },
  {
    title: 'Packed Formats',
    description: 'Packed-layout variants of header/base/trailer records used in environments that transmit fixed packed format records.',
    badges: ['HRPF', 'BSPF', 'TRPF'],
  },
  {
    title: 'Furnisher & Bureau Markers',
    description: 'Common implementation markers for furnisher blocks and bureau targeting inside mapped payloads and translation layers.',
    badges: ['D1', 'DF2', 'T = TransUnion'],
  },
];

const dynamicSpinnerDefaults = ['Great', 'Wonderful', 'Spectacular'];
const GROK_KEY_STORAGE = 'learning-grok-api-key';

const toneMap = {
  'Initial Letter': 'Rewrite this professionally and politely.',
  'Response Level 1': 'Make it slightly more firm but professional.',
  'Response Level 3': 'Make it noticeably firmer and assertive.',
  'Response Level 5': 'Make it strong, confident, and direct.',
  'Response Level 7': 'Make it very firm and aggressive.',
  'Most Aggressive': 'Make it extremely aggressive and demanding while staying legally appropriate.',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (response.status === 401) {
    window.location.href = '/';
    throw new Error('Authentication required.');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload;
}

function normalizeValue(value) {
  const text = String(value ?? '').trim();
  return text ? text : '--';
}

function formatRowCellValue(rowLabel, rawValue) {
  const value = normalizeValue(rawValue);
  if (value === '--') return escapeHtml(value);
  if (String(rowLabel || '').trim().toLowerCase() !== 'data reporter street address') {
    return escapeHtml(value);
  }
  const parts = String(value).split(',');
  if (parts.length >= 2) {
    const line1 = escapeHtml(parts[0].trim());
    const line2 = escapeHtml(parts.slice(1).join(',').trim());
    return `<span class="learning-address-two-line">${line1}<br>${line2}</span>`;
  }
  return `<span class="learning-address-two-line">${escapeHtml(value)}</span>`;
}

function formatClientName(client) {
  return `${String(client?.firstName || '').trim()} ${String(client?.lastName || '').trim()}`.trim() || 'Client';
}

function shortenText(value, maxLength = 72) {
  const text = String(value || '').trim();
  if (!text) return '--';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function toTitleCase(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
}

function expandAddressTerms(value) {
  const replacements = [
    [/\bAve\.?\b/gi, 'Avenue'],
    [/\bAv\b/gi, 'Avenue'],
    [/\bSt\.?\b/gi, 'Street'],
    [/\bRd\.?\b/gi, 'Road'],
    [/\bDr\.?\b/gi, 'Drive'],
    [/\bBlvd\.?\b/gi, 'Boulevard'],
    [/\bLn\.?\b/gi, 'Lane'],
    [/\bCt\.?\b/gi, 'Court'],
    [/\bPkwy\.?\b/gi, 'Parkway'],
    [/\bPl\.?\b/gi, 'Place'],
    [/\bTrl\.?\b/gi, 'Trail'],
    [/\bCir\.?\b/gi, 'Circle'],
    [/\bHwy\.?\b/gi, 'Highway'],
    [/\bMt\b/gi, 'Mount'],
    [/\bFt\b/gi, 'Fort'],
  ];

  let text = String(value || '');
  replacements.forEach(([pattern, next]) => {
    text = text.replace(pattern, next);
  });
  return text.replace(/\s+/g, ' ').trim();
}

const usStateLongNames = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
};

function formatClientAddressTag(client) {
  const raw = String(client?.address || '').trim();
  if (!raw) return '--';
  const clean = raw.replace(/\r?\n/g, ', ').replace(/\s{2,}/g, ' ').replace(/\s*,\s*/g, ', ').trim();
  if (!clean) return '--';

  if (clean.includes('|')) {
    const [streetPart, localityPart] = clean.split('|');
    const street = toTitleCase(expandAddressTerms(String(streetPart || '').trim().replace(/,$/, '')));
    const localityClean = String(localityPart || '').trim().replace(/\s+/g, ' ');
    const localityMatch = localityClean.match(/^(.*?)[,\s]+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
    if (localityMatch) {
      const city = toTitleCase(expandAddressTerms(String(localityMatch[1] || '').trim().replace(/,$/, '')));
      const state = String(localityMatch[2] || '').trim().toUpperCase();
      const zip = String(localityMatch[3] || '').trim();
      return [street, `${city} ${state} ${zip}`.replace(/\s+/g, ' ').trim()].filter(Boolean).join('\n');
    }
    return [street, toTitleCase(expandAddressTerms(localityClean))].filter(Boolean).join('\n');
  }

  const full = clean.match(/^(.*?)(?:,\s*|\s+)([A-Za-z][A-Za-z .'-]+?)(?:,\s*|\s+)([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (full) {
    const street = toTitleCase(expandAddressTerms(full[1]));
    const city = toTitleCase(expandAddressTerms(full[2]));
    const stateCode = String(full[3] || '').trim().toUpperCase();
    const zip = String(full[4] || '').trim();
    return [street, `${city} ${stateCode} ${zip}`.trim()].filter(Boolean).join('\n');
  }

  const parts = clean.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const street = toTitleCase(expandAddressTerms(parts[0]));
    const localityRaw = parts.slice(1).join(' ');
    const stateZip = localityRaw.match(/\b([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\b/);
    if (stateZip) {
      const stateCode = String(stateZip[1] || '').trim().toUpperCase();
      const city = toTitleCase(expandAddressTerms(localityRaw.replace(stateZip[0], '').trim()));
      return [street, `${city} ${stateCode} ${stateZip[2]}`.replace(/\s+/g, ' ').trim()].join('\n');
    }
    return [street, toTitleCase(expandAddressTerms(localityRaw))].join('\n');
  }

  return toTitleCase(expandAddressTerms(clean));
}

function normalizeClientDocType(value) {
  return String(value || '').trim().toLowerCase();
}

function getClientDocumentTagValue(client, typeName) {
  const wanted = normalizeClientDocType(typeName);
  const docs = Array.isArray(client?.documents) ? client.documents : [];
  const row = docs.find((entry) => normalizeClientDocType(entry?.type) === wanted);
  if (!row) return '--';
  return String(row.fileName || row.type || '').trim() || '--';
}

function bureauView(account, bureau) {
  return account?.bureaus?.[bureau] || {};
}

function bureauRaw(account, bureau) {
  return bureauView(account, bureau)?.raw || {};
}

function hasBureauReporting(account, bureau) {
  const view = bureauView(account, bureau);
  if (!view || typeof view !== 'object') return false;
  const keys = Object.keys(view);
  if (keys.length === 0) return false;
  if (keys.length > 1) return true;
  return keys[0] !== 'raw' || Object.keys(view.raw || {}).length > 0;
}

function getAccountNameForBureau(account, bureau) {
  return firstNonEmpty(
    bureauView(account, bureau)?.creditorName,
    firstDataPoint(bureauRaw(account, bureau), [
      'creditorName',
      '@creditorName',
      'DataReporter.Name',
      'GrantedTrade.CreditorName',
    ], [
      'creditorname',
      'subscribername',
      'datareportername',
      'furnishername',
    ]),
    account?.creditorName,
  );
}

function collectBureauAccounts(bureau) {
  const source = Array.isArray(state.selectedClientAccounts) ? state.selectedClientAccounts : [];
  const bureauRows = source.filter((account) => Boolean(bureauView(account, bureau)));
  return bureauRows.map((account, index) => ({
    index: index + 1,
    name: getAccountNameForBureau(account, bureau) || '--',
    number: getAccountNumber(account, bureau) || '--',
  }));
}

function buildTagDrawerGroups() {
  const groups = [];
  const client = state.selectedClient || {};

  groups.push({
    key: 'client',
    label: 'Client Tags',
    count: 5,
    sections: [
      {
        label: 'Client Profile',
        icon: '👤',
        items: [
          {
            token: '{{first-name}}',
            description: 'Client first name',
            value: String(client.firstName || '').trim() || '--',
          },
          {
            token: '{{last-name}}',
            description: 'Client last name',
            value: String(client.lastName || '').trim() || '--',
          },
          {
            token: '{{address}}',
            description: 'Street on line 1, city/state/zip on line 2',
            value: formatClientAddressTag(client),
          },
          {
            token: '{{dob}}',
            description: 'Client date of birth',
            value: String(client.dob || '').trim() || '--',
          },
          {
            token: '{{ssn}}',
            description: 'Client social security number',
            value: String(client.ssn || '').trim() || '--',
          },
        ],
      },
    ],
  });

  groups.push({
    key: 'documents',
    label: 'Document Tags',
    count: 6,
    sections: [
      {
        label: 'Letter Attachments',
        icon: '📄',
        items: [
          { token: '{{ID Doc}}', description: 'ID Document file name', value: getClientDocumentTagValue(client, 'ID Document') },
          { token: '{{SSN Doc}}', description: 'SSN Document file name', value: getClientDocumentTagValue(client, 'SSN Document') },
          { token: '{{POA1}}', description: 'POA Document file name', value: getClientDocumentTagValue(client, 'POA Document') },
          { token: '{{POA2}}', description: 'POA2 Document file name', value: getClientDocumentTagValue(client, 'POA2 Document') },
          { token: '{{POA3}}', description: 'POA3 Document file name', value: getClientDocumentTagValue(client, 'POA3 Document') },
          { token: '{{LPOA}}', description: 'Limited Power of Attorney file name', value: getClientDocumentTagValue(client, 'Limited Power of Attorney') },
        ],
      },
    ],
  });

  for (const bureau of bureauOrder) {
    const suffix = bureauTagSuffix[bureau];
    const rows = collectBureauAccounts(bureau);
    const names = rows.map((row) => row.name);
    const numbers = rows.map((row) => row.number);
    const lines = rows.map((row) => `${row.name}\n${row.number}`);
    const first = rows[0] || { name: '--', number: '--' };
    const nameItems = [
      {
        token: `{{account-name-${suffix}}}`,
        description: 'Account 1 name',
        value: first.name,
      },
      {
        token: `{{account-names-${suffix}}}`,
        description: `${rows.length || 0} account name${rows.length === 1 ? '' : 's'} list`,
        value: names.join('\n') || '--',
      },
      ...rows.map((row) => ({
        token: `{{account-name-${suffix}-${row.index}}}`,
        description: `Account ${row.index} name`,
        value: row.name,
      })),
    ];

    const numberItems = [
      {
        token: `{{account-number-${suffix}}}`,
        description: 'Account 1 number',
        value: first.number,
      },
      {
        token: `{{account-numbers-${suffix}}}`,
        description: `${rows.length || 0} account number${rows.length === 1 ? '' : 's'} list`,
        value: numbers.join('\n') || '--',
      },
      ...rows.map((row) => ({
        token: `{{account-number-${suffix}-${row.index}}}`,
        description: `Account ${row.index} number`,
        value: row.number,
      })),
    ];

    const lineItems = [
      {
        token: `{{account-lines-${suffix}}}`,
        description: 'Name + number pairs for this bureau',
        value: lines.join('\n\n') || '--',
      },
    ];

    groups.push({
      key: bureau,
      label: bureauLabels[bureau],
      count: rows.length,
      sections: [
        { label: 'Account Names', icon: '◉', items: nameItems },
        { label: 'Account Numbers', icon: '№', items: numberItems },
        { label: 'Name + Number Lines', icon: '▤', items: lineItems },
      ],
    });
  }
  return groups;
}

function normalizeTemplateToken(token) {
  return String(token || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function buildTemplateTagValueMap() {
  const map = new Map();
  const groups = buildTagDrawerGroups();
  groups.forEach((group) => {
    (group.sections || []).forEach((section) => {
      (section.items || []).forEach((item) => {
        const token = String(item?.token || '').trim();
        if (!token) return;
        const normalized = normalizeTemplateToken(token);
        const rawValue = String(item?.value || '').trim();
        const value = rawValue === '--' ? '' : rawValue;
        map.set(normalized, value);
      });
    });
  });
  return map;
}

function getTagValuesObject() {
  const tagMap = buildTemplateTagValueMap();
  const values = {};
  tagMap.forEach((value, key) => {
    values[key] = value;
  });
  return values;
}

function getEditorPlainText() {
  if (!editorArea) return '';
  return String(editorArea.innerText || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .trim();
}

function buildLearningContextPayload() {
  const account = state.selectedAccount || null;
  const client = state.selectedClient || null;
  const allAccounts = Array.isArray(state.selectedClientAccounts) ? state.selectedClientAccounts : [];
  const selectedBureauData = {};
  const selectedBureauDataPoints = {};
  const selectedBureauSummaries = {};

  for (const bureau of bureauOrder) {
    const raw = account ? (bureauRaw(account, bureau) || {}) : {};
    selectedBureauData[bureau] = raw;
    selectedBureauDataPoints[bureau] = rawDataPoints(raw);
    selectedBureauSummaries[bureau] = {
      bureau,
      creditor: getAccountNameForBureau(account || {}, bureau),
      accountNumber: getAccountNumber(account || {}, bureau),
      address: getDataReporterAddress(account || {}, bureau),
      phone: getPhone(account || {}, bureau),
      openClosed: getOpenClosed(account || {}, bureau),
      ownershipType: getAccountOwnershipType(account || {}, bureau),
      ecoaCode: getEcoaCode(account || {}, bureau),
      complianceConditionCode: getComplianceCondition(account || {}, bureau),
      disputeFlag: getDisputeFlag(account || {}, bureau),
      eoscar: getEOscarSignal(account || {}, bureau),
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    page: 'learning',
    pageUrl: window.location.href,
    source: state.selectedSource || '',
    client,
    selectedAccount: account,
    allClientDerogatoryAccounts: allAccounts,
    visibleComparisonRows: account ? buildRows(account) : [],
    tags: getTagValuesObject(),
    editor: {
      html: editorArea ? String(editorArea.innerHTML || '') : '',
      text: getEditorPlainText(),
      selectedText: getSelectedEditorText(),
    },
    selectedBureauData,
    selectedBureauDataPoints,
    selectedBureauSummaries,
  };
}

function broadcastLearningContextToWidget(contextPayload) {
  if (!contextPayload || typeof contextPayload !== 'object') return;
  try {
    const asText = JSON.stringify(contextPayload);
    window.__NINJA_LEARNING_CONTEXT__ = contextPayload;
    window.localStorage.setItem(LEARNING_CONTEXT_STORAGE_KEY, asText);
    document.dispatchEvent(new CustomEvent(LEARNING_CONTEXT_EVENT, { detail: contextPayload }));

    const widgetIframes = Array.from(document.querySelectorAll('iframe')).filter((iframe) => {
      const src = String(iframe.getAttribute('src') || '');
      return /leadconnectorhq\.com/i.test(src) || /chat-widget/i.test(src);
    });
    widgetIframes.forEach((iframe) => {
      try {
        iframe.contentWindow?.postMessage({
          type: 'ninja-learning-context',
          source: 'ninjatools-learning',
          payload: contextPayload,
        }, '*');
      } catch (_error) {
        // ignore per-frame errors
      }
    });
  } catch (_error) {
    // ignore context broadcast failures
  }
}

async function syncLearningContext({ silent = true, pushToGhl = false } = {}) {
  const contextPayload = buildLearningContextPayload();
  state.learningContext = contextPayload;
  broadcastLearningContextToWidget(contextPayload);
  try {
    const payload = await requestJson('/api/training/context/session', {
      method: 'POST',
      body: JSON.stringify({ context: contextPayload, pushToGhl }),
    });
    if (!silent) {
      const suffix = payload?.contextPublicUrl
        ? ` Context URL ready for tools/workflows.`
        : '';
      const ghlResult = payload?.goHighLevelSync;
      if (pushToGhl && ghlResult && !ghlResult.ok) {
        setStatus(`Context saved, but GHL push failed: ${ghlResult.error || 'Unknown error.'}`, true);
      } else if (pushToGhl) {
        setStatus(`Learning context synced to bot + AI context bridge.${suffix}`);
      } else {
        setStatus('Learning context synced to bot + AI context bridge.');
      }
    }
  } catch (error) {
    if (!silent) setStatus(`Context sync failed: ${error.message}`, true);
  }
  return contextPayload;
}

function getBotContextSyncKey() {
  return [
    String(state.selectedClientId || '').trim(),
    String(state.selectedAccountId || '').trim(),
    String(state.selectedSource || '').trim(),
    String(Array.isArray(state.selectedClientAccounts) ? state.selectedClientAccounts.length : 0),
  ].join('|');
}

function scheduleBotContextSync({ reason = 'auto', force = false, delayMs = 700 } = {}) {
  if (botContextSyncTimer) {
    window.clearTimeout(botContextSyncTimer);
    botContextSyncTimer = null;
  }
  botContextSyncTimer = window.setTimeout(async () => {
    if (!state.selectedClientId) return;
    const syncKey = getBotContextSyncKey();
    const now = Date.now();
    const recentlySynced = (now - lastBotContextSyncAt) < 12_000;
    if (!force && syncKey === lastBotContextSyncKey && recentlySynced) {
      return;
    }
    try {
      await syncLearningContext({ silent: true, pushToGhl: true });
      lastBotContextSyncKey = syncKey;
      lastBotContextSyncAt = Date.now();
      if (reason === 'manual') {
        setStatus('Learning bot context synced from selected client/account.');
      }
    } catch (error) {
      if (reason === 'manual') {
        setStatus(`Bot context sync failed: ${error.message}`, true);
      }
    }
  }, Math.max(120, Number(delayMs) || 700));
}

function renderTagDrawer() {
  if (!tagDrawerList) return;
  const groups = buildTagDrawerGroups();
  const hasRows = groups.some((group) => group.count > 0);
  if (tagDrawerHint) {
    tagDrawerHint.textContent = hasRows
      ? 'Click a tag to insert it into the editor.'
      : 'Select a client/account to load real values for these tags.';
  }
  tagDrawerList.innerHTML = groups.map((group, groupIndex) => `
    <details class="learning-tag-accordion" data-bureau="${escapeAttr(group.key)}" ${groupIndex === 0 ? 'open' : ''}>
      <summary>
        <span class="bureau-dot"></span>
        <span>${escapeHtml(group.label)}</span>
        <strong>${group.count}</strong>
      </summary>
      <div class="learning-tag-group">
        ${group.sections.map((section) => `
          <div class="learning-tag-section">
            <h4><span class="learning-tag-section-icon">${escapeHtml(section.icon)}</span>${escapeHtml(section.label)}</h4>
            ${section.items.map((tag) => `
              <button
                type="button"
                class="learning-tag-item"
                data-tag-token="${escapeAttr(tag.token)}"
                title="${escapeAttr(tag.value)}"
              >
                <code>${escapeHtml(tag.token)}</code>
                <span>${escapeHtml(tag.description)} • ${escapeHtml(shortenText(tag.value, 58))}</span>
              </button>
            `).join('')}
          </div>
        `).join('')}
      </div>
    </details>
  `).join('');
}

function getPathValue(obj, path) {
  if (!obj || !path) return '';
  const parts = String(path).split('.');
  let current = obj;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return '';
    current = current[part];
  }
  if (current === null || current === undefined) return '';
  if (typeof current === 'object' && ('$' in current)) return String(current.$ || '').trim();
  return String(current || '').trim();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function firstFromPaths(raw, paths = []) {
  for (const path of paths) {
    const value = getPathValue(raw, path);
    if (String(value || '').trim()) return String(value).trim();
  }
  return '';
}

const rawDataPointCache = new WeakMap();

function normalizeKeyToken(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function flattenRawDataPoints(obj, basePath = '', out = []) {
  if (obj === null || obj === undefined) return out;
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => flattenRawDataPoints(item, `${basePath}[${index}]`, out));
    return out;
  }
  if (typeof obj === 'object') {
    if ('$' in obj && obj.$ !== null && obj.$ !== undefined && obj.$ !== '') {
      out.push({
        key: `${basePath}.$`,
        keyNorm: normalizeKeyToken(`${basePath}.$`),
        value: String(obj.$).trim(),
      });
    }
    Object.entries(obj).forEach(([key, value]) => {
      const nextPath = basePath ? `${basePath}.${key}` : key;
      flattenRawDataPoints(value, nextPath, out);
    });
    return out;
  }
  const str = String(obj).trim();
  if (!str) return out;
  out.push({
    key: basePath,
    keyNorm: normalizeKeyToken(basePath),
    value: str,
  });
  return out;
}

function rawDataPoints(raw) {
  if (!raw || typeof raw !== 'object') return [];
  if (rawDataPointCache.has(raw)) return rawDataPointCache.get(raw);
  const points = flattenRawDataPoints(raw);
  rawDataPointCache.set(raw, points);
  return points;
}

function firstFromHints(raw, hints = []) {
  const points = rawDataPoints(raw);
  for (const hint of hints) {
    const hintNorm = normalizeKeyToken(hint);
    const match = points.find((point) => point.keyNorm.includes(hintNorm) && String(point.value || '').trim());
    if (match) return String(match.value || '').trim();
  }
  return '';
}

function firstDataPoint(raw, paths = [], hints = []) {
  return firstNonEmpty(firstFromPaths(raw, paths), firstFromHints(raw, hints));
}

function centsToDollars(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!/^-?\d+$/.test(raw)) return raw;
  return `$${(Number(raw) / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function maybeMoney(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\$/.test(raw)) return raw;
  if (/^-?\d+$/.test(raw)) {
    if (raw.length >= 4) return centsToDollars(raw);
    return `$${Number(raw).toLocaleString('en-US')}`;
  }
  return raw;
}

function formatDollars(value) {
  return `$${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatMoneyField(value, options = {}) {
  const {
    defaultZero = false,
    expandSmall = false,
    smartDot = false,
  } = options;

  const raw = String(value ?? '').trim();
  if (!raw) return defaultZero ? '$0.00' : '';

  let cleaned = raw.replace(/\$/g, '').replace(/,/g, '').replace(/\s+/g, '');

  if (/^-?\d+\.\d{2}$/.test(cleaned) && smartDot) {
    const [left, right] = cleaned.split('.');
    if (left.length <= 2 && right.length === 2) {
      cleaned = `${left}${right}`;
    }
  }

  if (/^-?\d+$/.test(cleaned)) {
    let valueInt = Number(cleaned);
    if (expandSmall && Math.abs(valueInt) > 0 && Math.abs(valueInt) < 100) {
      valueInt = valueInt * 100;
    }
    return formatDollars(valueInt);
  }

  if (/^-?\d+\.\d+$/.test(cleaned)) {
    return formatDollars(Number(cleaned));
  }

  return raw;
}

function ownershipFromEcoa(value) {
  const code = String(value || '').trim().toUpperCase();
  const map = {
    '1': 'Individual',
    '2': 'Joint Contractual Liability',
    '3': 'Authorized User',
    '5': 'Co-maker / Guarantor',
    '7': 'Maker',
    'T': 'Terminated',
    'W': 'Business / Commercial',
    'X': 'Deceased',
    'Z': 'Delete Consumer',
  };
  return map[code] || '';
}

function mapByBureau(account, getter) {
  const result = {};
  for (const bureau of bureauOrder) {
    result[bureau] = hasBureauReporting(account, bureau) ? (getter(bureau) || '') : '';
  }
  return result;
}

function fromAnyBureau(account, currentBureau, resolver) {
  const primary = resolver(currentBureau);
  if (String(primary || '').trim()) return String(primary).trim();
  for (const bureau of bureauOrder) {
    if (bureau === currentBureau) continue;
    const value = resolver(bureau);
    if (String(value || '').trim()) return String(value).trim();
  }
  return '';
}

function getAccountNumber(account, bureau) {
  return firstNonEmpty(
    fromAnyBureau(account, bureau, (b) => {
      const raw = bureauRaw(account, b);
      return firstNonEmpty(
        bureauView(account, b).accountNumber,
        firstDataPoint(raw, ['@accountNumber', 'accountNumber', 'account_number', 'ConsumerAccountNumber', 'BSCF7'], [
          'consumeraccountnumber',
          'bscf7',
          'accountnumber',
        ]),
      );
    }),
    account.accountNumber,
  );
}

function getDataReporterAddress(account, bureau) {
  return firstNonEmpty(
    fromAnyBureau(account, bureau, (b) => {
      const raw = bureauRaw(account, b);
      return firstDataPoint(raw, [
        'DataReporter.Address',
        'DataReporter.StreetAddress',
        'DataReporterAddress',
        'creditorAddress',
        'address',
        'Address',
        '@creditorAddress',
      ], [
        'datareporterstreetaddress',
        'datareporteraddress',
        'creditorsaddresses',
        'creditorsaddress',
        'creditoraddresses',
        'creditoraddresses',
        'creditorstreetaddress',
        'creditoraddress',
        'streetaddress',
        'street',
        'address1',
        'addressline',
        'addressline1',
        'collectionagencyaddress',
        'datereporteraddress',
      ]);
    }),
    account?.creditorAddress,
  );
}

function getPhone(account, bureau) {
  return firstNonEmpty(
    fromAnyBureau(account, bureau, (b) => {
      const raw = bureauRaw(account, b);
      return firstDataPoint(raw, [
        'creditorPhone',
        'phone',
        'Phone',
        'DataReporter.Phone',
        'DataReporter.Telephone',
      ], [
        'datareportertelephonenumber',
        'datareporterphone',
        'creditorphone',
        'creditorphonenumber',
        'creditorsphonenumber',
        'creditorsphonenumbers',
        'telephonenumber',
        'phone',
        'phone1',
        'contactnumber',
        'creditorphone',
        'phonenumber',
        'hrcf14',
      ]);
    }),
    account?.creditorPhone,
  );
}

function getPreferredLearningClientId() {
  try {
    const params = new URLSearchParams(window.location.search || '');
    const fromQuery = String(params.get('clientId') || '').trim();
    if (fromQuery) return fromQuery;
    return String(window.localStorage.getItem(LEARNING_SELECTED_CLIENT_STORAGE_KEY) || '').trim();
  } catch (_error) {
    return '';
  }
}

function getDviciCode(account, bureau) {
  return firstNonEmpty(
    fromAnyBureau(account, bureau, (b) => {
      const raw = bureauRaw(account, b);
      return firstDataPoint(raw, [
        '@subscriberCode',
        'DataVerifierInternalCodeIdentificationNumber',
        'DVICIN',
      ], [
        'dataverifierinternalcodeidentificationnumber',
        'dvicin',
        'subscribercode',
        'subscribernumber',
      ]);
    }),
    getPhone(account, bureau),
  );
}

function getOpenClosed(account, bureau) {
  const raw = bureauRaw(account, bureau);
  return firstNonEmpty(
    firstDataPoint(raw, ['OpenClosed.@description', 'OpenClosed.@abbreviation', 'OpenClosed.@symbol'], [
      'openclosed',
      'accountcondition',
      'accountstatus',
      'paymentstatus',
      'accountrating',
    ]),
    bureauView(account, bureau).status,
  );
}

function getAccountOwnershipType(account, bureau) {
  const raw = bureauRaw(account, bureau);
  const ecoaCode = getEcoaRawCode(account, bureau);
  const ecoaMapped = ownershipFromEcoa(ecoaCode);
  return firstNonEmpty(
    ecoaMapped,
    firstDataPoint(raw, ['AccountDesignator.@description', 'AccountDesignator.@abbreviation'], [
      'accountownershiptype',
      'accountownership',
      'ownershiptype',
      'ownership',
      'ecoa',
    ]),
    firstDataPoint(raw, ['ownership', 'accountOwnership'], []),
  );
}

function getEcoaRawCode(account, bureau) {
  const raw = bureauRaw(account, bureau);
  return firstNonEmpty(
    firstDataPoint(raw, ['AccountDesignator.@symbol', 'GrantedTrade.CreditType.@symbol'], [
      'ecoa',
      'bs37',
      'accountdesignator',
    ]),
  );
}

function getEcoaCode(account, bureau) {
  return firstNonEmpty(
    getEcoaRawCode(account, bureau),
  );
}

function getComplianceCondition(account, bureau) {
  const raw = bureauRaw(account, bureau);
  return firstNonEmpty(
    firstDataPoint(raw, ['DisputeFlag.@description', 'DisputeFlag.@abbreviation'], [
      'complianceconditioncode',
      'disputeflag',
      'disputecondition',
    ]),
  );
}

function getDateLastVerified(account, bureau) {
  const raw = bureauRaw(account, bureau);
  return firstNonEmpty(
    firstDataPoint(raw, ['@dateReported', '@dateAccountStatus', 'Source.InquiryDate.$'], [
      'datelastverified',
      'dlv',
      'dateaccountstatus',
      'datereported',
    ]),
    bureauView(account, bureau).dateLastActive,
  );
}

function getDateOfLastPayment(account, bureau) {
  const raw = bureauRaw(account, bureau);
  return firstNonEmpty(
    bureauView(account, bureau).dateOfLastPayment,
    firstDataPoint(raw, [
      'GrantedTrade.@dateLastPayment',
      'GrantedTrade.dateLastPayment',
      '@dateLastPayment',
      'dateLastPayment',
      'DateLastPayment',
      'DateOfLastPayment',
      'Source.DateLastPayment.$',
    ], [
      'dateoflastpayment',
      'datelastpayment',
      'lastpaymentdate',
      'paymentlastdate',
      'bscf27',
    ]),
  );
}

function getDateOfLastUpdateActivity(account, bureau) {
  const raw = bureauRaw(account, bureau);
  return firstNonEmpty(
    bureauView(account, bureau).dateLastActive,
    firstDataPoint(raw, [
      '@dateAccountStatus',
      'dateAccountStatus',
      '@dateReported',
      'dateReported',
      'DateReported',
      'Source.InquiryDate.$',
      'GrantedTrade.@dateLastPayment',
      'GrantedTrade.dateLastPayment',
    ], [
      'dateoflastupdateactivity',
      'datelastactive',
      'dateaccountinformation',
      'dateaccountstatus',
      'datereported',
      'lastreportdate',
      'bscf24',
    ]),
  );
}

function getSpecialComment(account, bureau) {
  const raw = bureauRaw(account, bureau);
  return firstNonEmpty(
    firstDataPoint(raw, ['SpecialCommentCode.@description', 'specialCommentCode'], [
      'specialcommentcode',
      'specialcomment',
      'commentcode',
    ]),
    bureauView(account, bureau).paymentStatus,
    bureauView(account, bureau).accountRating,
  );
}

function getAccountComments(account, bureau) {
  const raw = bureauRaw(account, bureau);
  return firstNonEmpty(
    firstDataPoint(raw, [
      'Comment',
      'Comments',
      '@comment',
      '@comments',
      'ConsumerComment',
      'ConsumerComments',
      'Narrative',
      'Remark',
      'Remarks',
      'SubscriberComment',
      'DisputeComment',
      'GrantedTrade.Comment',
      'GrantedTrade.Comments',
      'GrantedTrade.Remark',
      'GrantedTrade.Remarks',
    ], [
      'comments',
      'comment',
      'consumercomment',
      'consumercomments',
      'narrative',
      'remark',
      'remarks',
      'subscribercomment',
      'disputecomment',
    ]),
  );
}

function getDisputeFlag(account, bureau) {
  const raw = bureauRaw(account, bureau);
  return firstNonEmpty(
    firstDataPoint(raw, [
      'DisputeFlag.@description',
      'DisputeFlag.@abbreviation',
      'ComplianceConditionCode',
      '@complianceConditionCode',
      'disputeFlag',
    ], [
      'disputeflag',
      'disputecode',
      'complianceconditioncode',
    ]),
  );
}

function getEOscarSignal(account, bureau) {
  const raw = bureauRaw(account, bureau);
  return firstNonEmpty(
    firstDataPoint(raw, [
      'eOscar',
      'EOscar',
      'eOscarIndicator',
      '@eOscarIndicator',
      'EoscarIndicator',
    ], [
      'eoscar',
      'eoscarindicator',
    ]),
  );
}

function getLateCount(account, bureau, days) {
  const raw = bureauRaw(account, bureau);
  const dayText = String(days);
  const candidates = {
    30: ['GrantedTrade.@late30Count', '@late30Count', 'late30Count', 'thirtyDayLateCount', 'Late30Count'],
    60: ['GrantedTrade.@late60Count', '@late60Count', 'late60Count', 'sixtyDayLateCount', 'Late60Count'],
    90: ['GrantedTrade.@late90Count', '@late90Count', 'late90Count', 'ninetyDayLateCount', 'Late90Count'],
    120: ['GrantedTrade.@late120Count', '@late120Count', 'late120Count', `late${dayText}Count`, 'Late120Count'],
    150: ['GrantedTrade.@late150Count', '@late150Count', 'late150Count', `late${dayText}Count`, 'Late150Count'],
    180: ['GrantedTrade.@late180Count', '@late180Count', 'late180Count', `late${dayText}Count`, 'Late180Count'],
  };
  return firstNonEmpty(
    firstDataPoint(raw, candidates[days] || [], [
      `late${dayText}count`,
      `${dayText}daylate`,
    ]),
  );
}

function getMonthlyStatuses(account, bureau) {
  const raw = bureauRaw(account, bureau);
  const history = raw?.GrantedTrade?.PayStatusHistory?.MonthlyPayStatus;
  if (Array.isArray(history)) {
    const mapped = history
      .map((item) => {
        const date = firstNonEmpty(
          item?.['@date'],
          item?.date,
          item?.['@month'],
          item?.month,
          item?.['@period'],
          item?.period,
        );
        const status = firstNonEmpty(
          item?.['@status'],
          item?.status,
          item?.['@code'],
          item?.code,
          item?.$,
        );
        const parsedDate = date ? new Date(date) : null;
        return {
          date,
          status,
          sortValue: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.getTime() : 0,
        };
      })
      .filter((entry) => entry.date || entry.status)
      .sort((a, b) => b.sortValue - a.sortValue)
      .slice(0, 24)
      .map(({ date, status }) => ({ date, status }));
    if (mapped.length) return mapped;
  }

  const statusString = firstFromPaths(raw, [
    'GrantedTrade.PayStatusHistory.@status',
    'GrantedTrade.PayStatusHistory.status',
    'PayStatusHistory.@status',
  ]);
  const startDate = firstFromPaths(raw, ['GrantedTrade.PayStatusHistory.@startDate']);
  if (!statusString) return [];

  const hasDelimitedTokens = /[\s,;|/]+/.test(statusString.trim());
  const statuses = (hasDelimitedTokens
    ? statusString.split(/[\s,;|/]+/)
    : statusString.split(''))
    .map((token) => String(token || '').trim())
    .filter(Boolean)
    .slice(0, 24);

  return statuses.map((status, index) => ({
    date: startDate ? `${startDate} #${index + 1}` : `Month ${index + 1}`,
    status,
  }));
}

function normalizeHistoryStatusToken(value) {
  const token = String(value || '').trim().toUpperCase();
  if (!token) return '--';
  if (['?', 'NA', 'N/A', 'NR', 'ND', 'UNK', 'UNKNOWN', 'XX'].includes(token)) return '--';
  if (['C', 'CUR', 'CURRENT', 'PAA', 'PAIDASAGREED', '0', 'U'].includes(token)) return 'OK';
  if (/^(CO|COL|COLLECTION|CHARGEOFF|CHARGEDOFF)/.test(token)) return 'CO';
  if (/^(30|60|90|120|150|180)$/.test(token)) return token;
  return token;
}

function historyTokenClass(token) {
  const clean = normalizeHistoryStatusToken(token);
  if (clean === '--') return 'is-empty';
  if (clean === 'OK') return 'is-good';
  if (clean === '30') return 'is-warn';
  if (clean === 'CO' || clean === 'M' || /^(60|90|120|150|180)$/.test(clean)) return 'is-bad';
  return 'is-neutral';
}

function buildRows(account) {
  const rows = [];
  const push = (label, code, getter) => rows.push({ label, code, values: mapByBureau(account, getter) });
  const pushSection = (label) => rows.push({ section: label });

  push('Data Reporter Street Address', 'HRCF13 HR-13 ^NTCU^ HR-13', (bureau) => getDataReporterAddress(account, bureau));
  push('Phone Number', 'HR-14', (bureau) => getPhone(account, bureau));

  pushSection('Account Classification');
  push('Consumer Account Number', 'BS-7', (bureau) => firstNonEmpty(
    getAccountNumber(account, bureau),
    firstDataPoint(bureauRaw(account, bureau), ['ConsumerAccountNumber', 'BSCF7', '@accountNumber'], [
      'consumeraccountnumber',
      'bscf7',
      'accountnumber',
    ]),
  ));
  push('Account Type', 'BS-9', (bureau) => firstNonEmpty(
    bureauView(account, bureau).accountType,
    firstDataPoint(bureauRaw(account, bureau), ['GrantedTrade.AccountType.@abbreviation', 'GrantedTrade.AccountType.@description'], [
      'accounttypecode',
      'accounttype',
      'bscf9',
    ]),
    account.accountType,
  ));
  push('Portfolio Type', 'BS-9', (bureau) => firstNonEmpty(
    bureauView(account, bureau).accountTypeDetail,
    firstDataPoint(bureauRaw(account, bureau), ['IndustryCode.@abbreviation', 'IndustryCode.@description'], [
      'portfoliotype',
      'industrycode',
      'bscf9',
    ]),
  ));
  push('Account Ownership Type', 'K1S-3', (bureau) => getAccountOwnershipType(account, bureau));
  push('Account Condition', '^NTCU^', (bureau) => getOpenClosed(account, bureau));
  push('Account\'s Date Open', '^NTCU^', (bureau) => firstNonEmpty(
    bureauView(account, bureau).dateOpened,
    firstDataPoint(bureauRaw(account, bureau), ['@dateOpened'], [
      'accountdateopened',
      'dateopened',
    ]),
  ));
  push('Account\'s Closed Date', 'BS-26', (bureau) => firstDataPoint(bureauRaw(account, bureau), ['@dateClosed'], [
    'accountcloseddate',
    'dateclosed',
    'bscf26',
  ]));
  push('Date of Last Payment', 'BS-27', (bureau) => firstNonEmpty(
    getDateOfLastPayment(account, bureau),
  ));
  push('Date of Last Update/Activity', 'BS-24', (bureau) => firstNonEmpty(
    getDateOfLastUpdateActivity(account, bureau),
  ));
  push('Data Verifier Internal Code Identification Number (DVICIN)', '', (bureau) => getDviciCode(account, bureau));

  pushSection('Core Bureau Data Points');
  push('BS-37 ECOA Code', 'BS-37', (bureau) => getEcoaCode(account, bureau));
  push('BS-22 Amount Past Due', 'BS-22', (bureau) => formatMoneyField(firstNonEmpty(
    firstDataPoint(bureauRaw(account, bureau), ['GrantedTrade.@amountPastDue', '@amountPastDue'], [
      'amountpastdue',
      'pastdueamount',
      'bscf22',
    ]),
  ), { defaultZero: true, expandSmall: true, smartDot: true }));
  push('BS-11 Account Credit Limit', 'BS-11', (bureau) => formatMoneyField(firstNonEmpty(
    bureauView(account, bureau).creditLimit,
    firstDataPoint(bureauRaw(account, bureau), ['GrantedTrade.CreditLimit.$', '@creditLimit'], [
      'accountcreditlimit',
      'creditlimit',
      'bscf11',
    ]),
  ), { defaultZero: true, expandSmall: true, smartDot: true }));
  push('BS-21 Account Current Balance', 'BS-21', (bureau) => formatMoneyField(firstNonEmpty(
    bureauView(account, bureau).balance,
    firstDataPoint(bureauRaw(account, bureau), ['@currentBalance'], [
      'accountcurrentbalance',
      'currentbalance',
      'bscf21',
    ]),
  ), { defaultZero: true, smartDot: true }));
  push('BS-12 High Credit/ Original Loan Amount', 'BS-12', (bureau) => formatMoneyField(firstNonEmpty(
    bureauView(account, bureau).highBalance,
    firstDataPoint(bureauRaw(account, bureau), ['@highBalance'], [
      'highcredit',
      'originalloanamount',
      'highbalance',
      'bscf12',
    ]),
  ), { defaultZero: true, expandSmall: true, smartDot: true }));
  push('BS-15 Scheduled Monthly Payment Amount', 'BS-15', (bureau) => formatMoneyField(firstNonEmpty(
    firstDataPoint(bureauRaw(account, bureau), ['GrantedTrade.@monthlyPayment'], [
      'scheduledmonthlypaymentamount',
      'monthlypayment',
      'bscf15',
    ]),
    bureauView(account, bureau).monthlyPayment,
  ), { defaultZero: true, smartDot: true }));
  push('Actual Payment Amount', '', (bureau) => formatMoneyField(firstNonEmpty(
    firstDataPoint(bureauRaw(account, bureau), ['ActualPaymentAmount', '@actualPaymentAmount'], [
      'actualpaymentamount',
      'paymentamountactual',
      'ntcu',
    ]),
  ), { defaultZero: true, smartDot: true }));
  push('BS-14 Internal Cycle Code Identifier', 'BS-14', (bureau) => firstNonEmpty(
    firstDataPoint(bureauRaw(account, bureau), ['BSCF14', 'InternalCycleCodeIdentifier'], [
      'internalcyclecodeidentifier',
      'internalcyclecode',
      'bscf14',
    ]),
    firstDataPoint(bureauRaw(account, bureau), ['GrantedTrade.PaymentFrequency.@abbreviation', 'GrantedTrade.PaymentFrequency.@description'], [
      'paymentfrequency',
    ]),
  ));
  push('30-Day Lates Count', '', (bureau) => getLateCount(account, bureau, 30));
  push('60-Day Lates Count', '', (bureau) => getLateCount(account, bureau, 60));
  push('90-Day Lates Count', '', (bureau) => getLateCount(account, bureau, 90));
  push('120-Day Lates Count', '', (bureau) => getLateCount(account, bureau, 120));
  push('150-Day Lates Count', '', (bureau) => getLateCount(account, bureau, 150));
  push('180-Day Lates Count', '', (bureau) => getLateCount(account, bureau, 180));

  pushSection('Compliance & Comments');
  push('Compliance Condition Code', '', (bureau) => getComplianceCondition(account, bureau));
  push('Date Last Verified (DLV)', '^NTCU^', (bureau) => getDateLastVerified(account, bureau));
  push('Special Comment Code(s)', '', (bureau) => getSpecialComment(account, bureau));
  push('Comments', '', (bureau) => getAccountComments(account, bureau));

  return rows;
}

function renderPaymentHistoryGrid(account) {
  const histByBureau = mapByBureau(account, (bureau) => getMonthlyStatuses(account, bureau));
  const monthCount = 24;
  const now = new Date();
  const monthKeys = Array.from({ length: monthCount }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
      year: String(d.getFullYear()).slice(-2),
    };
  });

  const bodyRows = bureauOrder.map((bureau) => {
    const isReportedHere = hasBureauReporting(account, bureau);
    const statuses = Array.isArray(histByBureau[bureau]) ? histByBureau[bureau] : [];
    const cells = [];
    for (let i = 0; i < monthCount; i += 1) {
      if (!isReportedHere) {
        cells.push('<td class="hist-cell is-empty"></td>');
        continue;
      }
      const normalized = normalizeHistoryStatusToken(statuses[i]?.status || '');
      const toneClass = historyTokenClass(normalized);
      cells.push(`<td class="hist-cell ${toneClass}">${escapeHtml(normalized)}</td>`);
    }
    return `<tr><th>${escapeHtml(bureauLabels[bureau].toUpperCase())}</th>${cells.join('')}</tr>`;
  }).join('');

  return `
    <div class="learning-history-wrap">
      <h3>Two-Year payment history</h3>
      <table class="learning-history-table">
        <thead>
          <tr>
            <th>MONTH</th>
            ${monthKeys.map((m) => `<th>${m.month}</th>`).join('')}
          </tr>
          <tr>
            <th>YEAR</th>
            ${monthKeys.map((m) => `<th>${m.year}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${bodyRows}
        </tbody>
      </table>
    </div>
  `;
}

function renderMetro2Guide(account) {
  if (!metro2GuideNode) return;

  const dynamicRows = account ? [
    {
      label: 'Dispute Flag (current account)',
      values: mapByBureau(account, (bureau) => getDisputeFlag(account, bureau)),
    },
    {
      label: 'Compliance Condition Code',
      values: mapByBureau(account, (bureau) => getComplianceCondition(account, bureau)),
    },
    {
      label: 'Special Comment Code(s)',
      values: mapByBureau(account, (bureau) => getSpecialComment(account, bureau)),
    },
    {
      label: 'e-OSCAR Signal',
      values: mapByBureau(account, (bureau) => getEOscarSignal(account, bureau)),
    },
  ] : [];

  const segmentCards = metro2Segments.map((segment) => `
    <article class="learning-metro2-card">
      <h3>${escapeHtml(segment.title)}</h3>
      <p>${escapeHtml(segment.description)}</p>
      <div class="learning-metro2-badges">
        ${segment.badges.map((badge) => `<span class="learning-metro2-badge">${escapeHtml(badge)}</span>`).join('')}
      </div>
    </article>
  `).join('');

  const disputeAndEOscarBlock = account ? `
    <article class="learning-metro2-card">
      <h3>Dispute Flags & e-OSCAR</h3>
      <p>Pulled from available bureau raw payload keys. Blank means the current JSON did not expose that value.</p>
      <div class="learning-metro2-badges">
        <span class="learning-metro2-badge">Dispute flags</span>
        <span class="learning-metro2-badge">e-OSCAR</span>
        <span class="learning-metro2-badge">compliance codes</span>
      </div>
      <table class="learning-table" style="margin-top:8px;min-width:0">
        <thead>
          <tr>
            <th class="item">Signal</th>
            ${bureauOrder.map((bureau) => `<th class="${bureauCssClass[bureau]}">${escapeHtml(bureauLabels[bureau])}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${dynamicRows.map((row) => `
            <tr>
              <td class="item">${escapeHtml(row.label)}</td>
              ${bureauOrder.map((bureau) => `<td class="${bureauCssClass[bureau]}">${escapeHtml(normalizeValue(row.values[bureau]))}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </article>
  ` : `
    <article class="learning-metro2-card">
      <h3>Dispute Flags & e-OSCAR</h3>
      <p>Select an account to show bureau-level dispute/compliance/e-OSCAR signals from that account JSON.</p>
      <div class="learning-metro2-badges">
        <span class="learning-metro2-badge">DisputeFlag</span>
        <span class="learning-metro2-badge">ComplianceConditionCode</span>
        <span class="learning-metro2-badge">e-OSCAR</span>
      </div>
    </article>
  `;

  metro2GuideNode.innerHTML = `
    <p class="learning-metro2-intro">Classified Metro2 quick guide for segment families, packed vs character formats, bureau markers, and dispute workflow context. <strong>^NTCU^</strong> means not standard Metro2 fielding, translated by CRA, or unknown in source data.</p>
    <div class="learning-metro2-grid">
      ${segmentCards}
      ${disputeAndEOscarBlock}
    </div>
    <section class="learning-metro2-faq">
      <h3>FAQ / Usage Notes</h3>
      <ul>
        <li>BSCF carries the main tradeline. J/K/L/N segments extend data when furnishers or CRA transformations include extra blocks.</li>
        <li>TRCF/TRPF are reconciliation records. They validate counts/totals after all base/supplemental segments are consumed.</li>
        <li>Dispute flags and compliance condition codes should be reviewed together with special comments and DLV for bureau consistency.</li>
        <li>J1/J2 are consumer identity extension segments; K1-K4 expand ownership and supplemental consumer/account details; L1/N1 carry additional narrative/condition extensions.</li>
        <li>D1 and DF2 are furnisher context markers in mapped files, and T commonly represents the TransUnion bureau marker.</li>
      </ul>
    </section>
    <section class="learning-metro2-faq">
      <h3>Segment Families At A Glance</h3>
      <ul>
        <li>Character family: HRCF → BSCF (+ optional J/K/L/N segments) → TRCF.</li>
        <li>Packed family: HRPF → BSPF (+ optional packed companions) → TRPF.</li>
        <li>Dispute workflow set: DisputeFlag + ComplianceConditionCode + SpecialCommentCode + DLV, reviewed bureau-by-bureau.</li>
      </ul>
    </section>
  `;
}

function buildPdfViewerSrc(searchTerm = '') {
  const doc = PDF_DOCS[activePdfDocKey] || PDF_DOCS.fcra;
  const hashParts = ['page=1', 'zoom=page-width'];
  const query = String(searchTerm || '').trim();
  if (query) hashParts.push(`search=${encodeURIComponent(query)}`);
  return `${PDFJS_VIEWER_URL}?file=${encodeURIComponent(doc.pdfUrl)}#${hashParts.join('&')}`;
}

function ensureEmbeddedPdf(searchTerm = '') {
  if (!pdfFrame || !pdfFrameWrap) return;
  if (!pdfEmbedded) {
    pdfFrame.src = buildPdfViewerSrc(searchTerm);
    pdfFrameWrap.hidden = false;
    pdfEmbedded = true;
    if (pdfSearchInput) pdfSearchInput.disabled = false;
    if (pdfSearchBtn) pdfSearchBtn.disabled = false;
    if (pdfLoadBtn) pdfLoadBtn.textContent = `${(PDF_DOCS[activePdfDocKey] || PDF_DOCS.fcra).label} Embedded`;
    setStatus(`${(PDF_DOCS[activePdfDocKey] || PDF_DOCS.fcra).label} embedded. Use Search PDF for in-document find.`);
    return;
  }
  if (searchTerm) {
    pdfFrame.src = buildPdfViewerSrc(searchTerm);
    setStatus(`Searching embedded PDF for "${searchTerm}".`);
  }
}

function setActivePdfDoc(docKey) {
  if (!PDF_DOCS[docKey]) return;
  activePdfDocKey = docKey;
  const doc = PDF_DOCS[activePdfDocKey];
  if (pdfLoadBtn) pdfLoadBtn.textContent = `Embed ${doc.label} PDF`;
  if (pdfEmbedded && pdfFrame) {
    const existingQuery = String(pdfSearchInput?.value || '').trim();
    pdfFrame.src = buildPdfViewerSrc(existingQuery);
    setStatus(`${doc.label} embedded. Use Search PDF for in-document find.`);
  }
}

function showResourcePanel(resourceKey) {
  if (!resourcePanel || !metro2Panel || !docPanel) return;

  const isOpen = !resourcePanel.hidden && resourcePanel.dataset.activeResource === resourceKey;
  if (isOpen) {
    resourcePanel.hidden = true;
    resourcePanel.dataset.activeResource = '';
    resourceButtons.forEach((btn) => btn.classList.remove('is-active'));
    return;
  }

  resourcePanel.hidden = false;
  resourcePanel.dataset.activeResource = resourceKey;
  resourceButtons.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.resource === resourceKey));

  if (resourceKey === 'metro2') {
    metro2Panel.hidden = false;
    docPanel.hidden = true;
    return;
  }

  metro2Panel.hidden = true;
  docPanel.hidden = false;
  setActivePdfDoc(resourceKey);
}

function ensureEditorFocus() {
  if (!editorArea) return false;
  editorArea.focus();
  return true;
}

function runEditorCommand(command, value = null) {
  if (!ensureEditorFocus()) return;
  document.execCommand(command, false, value);
}

function insertEditorText(text) {
  if (!editorArea || !ensureEditorFocus()) return false;
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    if (editorArea.contains(range.commonAncestorContainer)) {
      range.deleteContents();
      const textNode = document.createTextNode(String(text || ''));
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    }
  }
  runEditorCommand('insertText', String(text || ''));
  return true;
}

function safePrompt(message, fallback = '') {
  const value = window.prompt(message, fallback);
  return typeof value === 'string' ? value.trim() : '';
}

function getSelectedEditorText() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return '';
  const range = selection.getRangeAt(0);
  if (!editorArea || !editorArea.contains(range.commonAncestorContainer)) return '';
  return String(selection.toString() || '').trim();
}

function replaceSelectionWithText(text) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  if (!editorArea || !editorArea.contains(range.commonAncestorContainer)) return false;
  range.deleteContents();
  const textNode = document.createTextNode(text);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

function getGrokApiKey() {
  return localStorage.getItem(GROK_KEY_STORAGE) || '';
}

async function rewriteWithGrok(level) {
  if (!editorArea) return;
  const selectedText = getSelectedEditorText();
  if (!selectedText || selectedText.length < 10) {
    alert('Please highlight some text first!');
    return;
  }

  const apiKey = getGrokApiKey();
  if (!apiKey) {
    alert('Set Grok API key first.');
    return;
  }

  const prompt = `${toneMap[level] || 'Rewrite this text professionally.'}

Context JSON (current client, selected account, raw bureau datapoints, active tags, and editor state):
${JSON.stringify(state.learningContext || buildLearningContextPayload())}

Original Text:
"""
${selectedText}
"""

Rewritten Version:`;

  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-4.1-fast',
        messages: [
          { role: 'system', content: 'You are an expert at writing strong credit dispute letters.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    const data = await res.json().catch(() => ({}));
    const rewritten = String(data?.choices?.[0]?.message?.content || '').trim();
    if (!res.ok || !rewritten) {
      throw new Error(String(data?.error?.message || data?.error || 'Could not rewrite.'));
    }

    const replaced = replaceSelectionWithText(rewritten);
    if (!replaced) {
      runEditorCommand('insertText', rewritten);
    }
    setStatus(`Successfully rewritten in "${level}" style.`);
  } catch (err) {
    console.error(err);
    alert('Failed to connect to Grok. Check your API key and internet.');
  }
}

async function rewriteWithServerAi(level, provider = 'groq') {
  if (!editorArea) return;
  const selectedText = getSelectedEditorText();
  if (!selectedText || selectedText.length < 10) {
    alert('Please highlight some text first!');
    return;
  }
  const normalizedProvider = String(provider || 'groq').trim().toLowerCase();
  const contextPayload = await syncLearningContext({ silent: true });
  try {
    const payload = await requestJson('/api/training/ai/rewrite', {
      method: 'POST',
      body: JSON.stringify({
        provider: normalizedProvider,
        level,
        selectedText,
        context: contextPayload,
      }),
    });
    const rewritten = String(payload?.text || '').trim();
    if (!rewritten) {
      throw new Error('Empty AI response.');
    }
    const replaced = replaceSelectionWithText(rewritten);
    if (!replaced) {
      runEditorCommand('insertText', rewritten);
    }
    setStatus(`Successfully rewritten with ${normalizedProvider.toUpperCase()} in "${level}" style.`);
  } catch (error) {
    console.error(error);
    alert(`Failed to rewrite with ${normalizedProvider.toUpperCase()}. ${error?.message || ''}`.trim());
  }
}

function upsertEditorTextResult(text, preferReplaceSelection = true) {
  const output = String(text || '').trim();
  if (!output) return false;
  if (preferReplaceSelection && replaceSelectionWithText(output)) {
    return true;
  }
  if (!editorArea) return false;
  editorArea.focus();
  const separator = editorArea.innerText?.trim() ? '\n\n' : '';
  runEditorCommand('insertText', `${separator}${output}`);
  return true;
}

async function runCustomAiPrompt() {
  const customPrompt = String(aiPromptInput?.value || '').trim();
  if (!customPrompt) {
    alert('Enter an AI prompt first.');
    return;
  }

  const mode = String(aiPromptModeSelect?.value || 'selection').trim().toLowerCase();
  const highlightedText = getSelectedEditorText();
  const fullEditorText = getEditorPlainText();
  const sourceText = mode === 'editor'
    ? fullEditorText
    : (highlightedText || fullEditorText);

  if (!sourceText || sourceText.length < 10) {
    alert('Add editor text (or highlight text) before sending the prompt.');
    return;
  }

  const providerFromBox = String(aiPromptProviderSelect?.value || '').trim().toLowerCase();
  const fallbackProvider = String(editorAiProviderSelect?.value || 'groq').trim().toLowerCase();
  const provider = providerFromBox || fallbackProvider;
  const level = String(editorAiLevelSelect?.value || 'Initial Letter').trim();
  const contextPayload = await syncLearningContext({ silent: true });
  const useSelectionReplace = Boolean(highlightedText && mode !== 'editor');

  if (aiPromptSendBtn) {
    aiPromptSendBtn.disabled = true;
    aiPromptSendBtn.textContent = 'Sending...';
  }

  try {
    if (provider !== 'groq' && provider !== 'claude' && provider !== 'anthropic') {
      throw new Error('Prompt box supports Groq and Claude only.');
    }

    const payload = await requestJson('/api/training/ai/rewrite', {
      method: 'POST',
      body: JSON.stringify({
        provider,
        level,
        selectedText: sourceText,
        customPrompt,
        context: contextPayload,
      }),
    });
    const rewritten = String(payload?.text || '').trim();
    if (!rewritten) {
      throw new Error('Empty AI response.');
    }
    upsertEditorTextResult(rewritten, useSelectionReplace);
    const providerLabel = provider === 'anthropic' ? 'CLAUDE' : provider.toUpperCase();
    setStatus(`Custom AI prompt completed with ${providerLabel}.`);
  } catch (error) {
    console.error(error);
    alert(String(error?.message || 'AI prompt failed.'));
  } finally {
    if (aiPromptSendBtn) {
      aiPromptSendBtn.disabled = false;
      aiPromptSendBtn.textContent = 'Send Prompt to AI';
    }
  }
}

function parseSpinnerOptions(value) {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    if (Array.isArray(parsed)) {
      const clean = parsed.map((item) => String(item || '').trim()).filter(Boolean);
      return clean.length ? clean : [...dynamicSpinnerDefaults];
    }
  } catch (_) {
    // ignore parse errors and use defaults
  }
  return [...dynamicSpinnerDefaults];
}

function randomSpinnerWord(options) {
  const list = Array.isArray(options) && options.length ? options : dynamicSpinnerDefaults;
  return list[Math.floor(Math.random() * list.length)];
}

function escapeAttr(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function initLearningEditor() {
  if (!editorToggleBtn || !editorPanel || !editorArea) return;

  if (tagDrawerList) {
    tagDrawerList.addEventListener('click', (event) => {
      const button = event.target instanceof Element ? event.target.closest('[data-tag-token]') : null;
      if (!button) return;
      const token = String(button.getAttribute('data-tag-token') || '').trim();
      if (!token) return;
      insertEditorText(token);
      setStatus(`Inserted ${token}`);
    });
  }

  if (editorWorkspace) {
    editorWorkspace.classList.add('is-tag-drawer-open');
  }
  renderTagDrawer();

  editorToggleBtn.addEventListener('click', () => {
    const nextHidden = !editorPanel.hidden;
    editorPanel.hidden = nextHidden;
    editorToggleBtn.classList.toggle('is-active', !nextHidden);
    if (!nextHidden) {
      ensureEditorFocus();
      const nodes = editorArea.querySelectorAll('span[data-type="dynamic-spinner"]');
      nodes.forEach((node) => {
        const options = parseSpinnerOptions(node.getAttribute('data-options'));
        node.textContent = randomSpinnerWord(options);
      });
    }
  });

  if (!editorArea.innerHTML.trim()) {
    editorArea.innerHTML = '<p></p>';
  }

  function clearRawBlockSelection() {
    if (activeRawHtmlBlock) {
      activeRawHtmlBlock.classList.remove('is-selected');
      activeRawHtmlBlock = null;
    }
  }

  function selectRawBlock(block) {
    clearRawBlockSelection();
    if (!block) return;
    activeRawHtmlBlock = block;
    activeRawHtmlBlock.classList.add('is-selected');
  }

  function editRawHtmlBlock(block) {
    if (!block) {
      setStatus('Select a Raw HTML block first.', true);
      return;
    }
    const currentHtml = String(block.dataset.rawHtml || block.innerHTML || '').trim();
    const currentStyle = String(block.dataset.rawStyle || block.getAttribute('style') || '').trim();
    const nextHtml = safePrompt('Edit HTML', currentHtml);
    if (!nextHtml) return;
    const nextStyle = safePrompt('Edit CSS (optional)', currentStyle);
    block.dataset.rawHtml = nextHtml;
    block.dataset.rawStyle = nextStyle || '';
    block.innerHTML = nextHtml;
    if (nextStyle) block.setAttribute('style', nextStyle);
    else block.removeAttribute('style');
    setStatus('Raw HTML block updated.');
  }

  function randomizeDynamicSpinners() {
    if (!editorArea) return;
    const nodes = editorArea.querySelectorAll('span[data-type="dynamic-spinner"]');
    nodes.forEach((node) => {
      const options = parseSpinnerOptions(node.getAttribute('data-options'));
      node.textContent = randomSpinnerWord(options);
      node.classList.add('dynamic-spinner');
      node.setAttribute('title', '{{spinner}}');
    });
  }

  function buildTextFragmentFromValue(doc, value = '') {
    const fragment = doc.createDocumentFragment();
    const lines = String(value || '').split('\n');
    lines.forEach((line, index) => {
      fragment.appendChild(doc.createTextNode(line));
      if (index < lines.length - 1) {
        fragment.appendChild(doc.createElement('br'));
      }
    });
    return fragment;
  }

  function replaceTemplateTagsInEditor() {
    if (!editorArea) return { replaced: 0 };

    const tagMap = buildTemplateTagValueMap();
    if (!tagMap.size) return { replaced: 0 };

    const walker = document.createTreeWalker(editorArea, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    const tokenPattern = /\{\{[^{}]+\}\}/g;
    let replaced = 0;

    textNodes.forEach((node) => {
      const text = String(node.nodeValue || '');
      if (!text.includes('{{') || !text.includes('}}')) return;

      let changed = false;
      const fragment = document.createDocumentFragment();
      let cursor = 0;

      for (const match of text.matchAll(tokenPattern)) {
        const index = Number(match.index || 0);
        const tokenRaw = String(match[0] || '');
        const normalized = normalizeTemplateToken(tokenRaw);
        if (!tagMap.has(normalized)) {
          continue;
        }

        changed = true;
        if (index > cursor) {
          fragment.appendChild(document.createTextNode(text.slice(cursor, index)));
        }

        const value = tagMap.get(normalized) || '';
        fragment.appendChild(buildTextFragmentFromValue(document, value));
        cursor = index + tokenRaw.length;
        replaced += 1;
      }

      if (!changed) return;

      if (cursor < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(cursor)));
      }

      const parent = node.parentNode;
      if (parent) {
        parent.replaceChild(fragment, node);
      }
    });

    return { replaced };
  }

  editorArea.addEventListener('click', (event) => {
    const block = event.target instanceof Element ? event.target.closest('.raw-html-block') : null;
    if (block) {
      selectRawBlock(block);
      return;
    }
    clearRawBlockSelection();
  });

  editorArea.addEventListener('dblclick', (event) => {
    const block = event.target instanceof Element ? event.target.closest('.raw-html-block') : null;
    if (!block) return;
    selectRawBlock(block);
    editRawHtmlBlock(block);
  });

  Array.from(document.querySelectorAll('[data-editor-cmd]')).forEach((btn) => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-editor-cmd');
      const val = btn.getAttribute('data-editor-value');
      if (!cmd) return;
      runEditorCommand(cmd, val || null);
    });
  });

  if (editorColorInput) {
    editorColorInput.addEventListener('input', () => {
      runEditorCommand('foreColor', editorColorInput.value);
    });
  }

  if (editorTagBtn) {
    editorTagBtn.addEventListener('click', () => {
      const name = safePrompt('Enter tag name (example: firstName, today, companyName)');
      if (!name) return;
      runEditorCommand('insertHTML', `<span class="custom-tag" data-type="custom-tag" data-name="${escapeHtml(name)}">{{${escapeHtml(name)}}}</span>`);
    });
  }

  if (editorRenderTagsBtn) {
    editorRenderTagsBtn.addEventListener('click', () => {
      const { replaced } = replaceTemplateTagsInEditor();
      if (replaced > 0) {
        setStatus(`Rendered ${replaced} tag${replaced === 1 ? '' : 's'} from client profile + latest report data.`);
        return;
      }
      setStatus('No matching {{tags}} found to render.', true);
    });
  }

  if (editorTableBtn) {
    editorTableBtn.addEventListener('click', () => {
      const cols = Number(safePrompt('Columns?', '3')) || 3;
      const rows = Number(safePrompt('Rows?', '3')) || 3;
      const safeCols = Math.max(1, Math.min(10, cols));
      const safeRows = Math.max(1, Math.min(20, rows));
      const head = `<tr>${Array.from({ length: safeCols }, (_, i) => `<th>H${i + 1}</th>`).join('')}</tr>`;
      const body = Array.from({ length: safeRows - 1 }, () => `<tr>${Array.from({ length: safeCols }, () => '<td>&nbsp;</td>').join('')}</tr>`).join('');
      runEditorCommand('insertHTML', `<table border="1" style="border-collapse:collapse;width:100%;margin:8px 0">${head}${body}</table><p></p>`);
    });
  }

  if (editorImageBtn) {
    editorImageBtn.addEventListener('click', () => {
      const url = safePrompt('Image URL');
      if (!url) return;
      runEditorCommand('insertImage', url);
    });
  }

  if (editorYoutubeBtn) {
    editorYoutubeBtn.addEventListener('click', () => {
      const url = safePrompt('YouTube URL');
      if (!url) return;
      runEditorCommand('insertHTML', `<p><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a></p>`);
    });
  }

  if (editorRawHtmlBtn) {
    editorRawHtmlBtn.addEventListener('click', () => {
      const html = safePrompt('Paste raw HTML block');
      if (!html) return;
      const css = safePrompt('Optional inline CSS for wrapper (example: background:#fff3cd; padding:16px;)', '');
      const safeStyle = css ? ` style="${escapeAttr(css)}"` : '';
      runEditorCommand(
        'insertHTML',
        `<div class="raw-html-block"${safeStyle} data-type="raw-html" data-raw-html="${escapeAttr(html)}" data-raw-style="${escapeAttr(css || '')}">${html}</div><p></p>`,
      );
      setStatus('Raw HTML block inserted into editor.');
    });
  }

  if (editorEditRawHtmlBtn) {
    editorEditRawHtmlBtn.addEventListener('click', () => {
      if (activeRawHtmlBlock) {
        editRawHtmlBlock(activeRawHtmlBlock);
        return;
      }
      const selected = window.getSelection();
      const anchor = selected?.anchorNode;
      const block = anchor && anchor.parentElement ? anchor.parentElement.closest('.raw-html-block') : null;
      if (block) {
        selectRawBlock(block);
        editRawHtmlBlock(block);
        return;
      }
      setStatus('Place cursor in a Raw HTML block or click one first.', true);
    });
  }

  if (editorSpinnerTagBtn) {
    editorSpinnerTagBtn.addEventListener('click', () => {
      const options = [...dynamicSpinnerDefaults];
      const randomWord = randomSpinnerWord(options);
      runEditorCommand(
        'insertHTML',
        `<span data-type="dynamic-spinner" data-options="${escapeAttr(JSON.stringify(options))}" class="dynamic-spinner" title="{{spinner}}">${escapeHtml(randomWord)}</span>`,
      );
      setStatus('Inserted {{spinner}} dynamic placeholder.');
    });
  }

  if (editorSetGrokKeyBtn) {
    editorSetGrokKeyBtn.addEventListener('click', () => {
      const current = getGrokApiKey();
      const entered = safePrompt('Paste Grok API Key', current || '');
      if (!entered) return;
      localStorage.setItem(GROK_KEY_STORAGE, entered);
      setStatus('Grok API key saved locally for this browser.');
    });
  }

  const runEditorRewrite = async (level) => {
    const provider = String(editorAiProviderSelect?.value || 'grok').trim().toLowerCase();
    if (provider === 'grok') {
      await rewriteWithGrok(level);
      return;
    }
    await rewriteWithServerAi(level, provider);
  };

  if (editorAiBtn) {
    editorAiBtn.addEventListener('click', async () => {
      const level = String(editorAiLevelSelect?.value || 'Initial Letter').trim();
      await runEditorRewrite(level);
    });
  }

  if (editorAiInitialBtn) {
    editorAiInitialBtn.addEventListener('click', async () => {
      await runEditorRewrite('Initial Letter');
    });
  }

  if (editorAiLevel3Btn) {
    editorAiLevel3Btn.addEventListener('click', async () => {
      await runEditorRewrite('Response Level 3');
    });
  }

  if (editorAiLevel5Btn) {
    editorAiLevel5Btn.addEventListener('click', async () => {
      await runEditorRewrite('Response Level 5');
    });
  }

  if (editorAiLevel7Btn) {
    editorAiLevel7Btn.addEventListener('click', async () => {
      await runEditorRewrite('Response Level 7');
    });
  }

  if (editorAiMostAggressiveBtn) {
    editorAiMostAggressiveBtn.addEventListener('click', async () => {
      await runEditorRewrite('Most Aggressive');
    });
  }

  if (aiPromptSendBtn) {
    aiPromptSendBtn.addEventListener('click', async () => {
      await runCustomAiPrompt();
    });
  }

  if (aiPromptInput) {
    aiPromptInput.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      await runCustomAiPrompt();
    });
  }

  const toggleAiPromptBox = (open) => {
    if (!aiPromptBox) return;
    aiPromptBox.classList.toggle('open', Boolean(open));
  };

  if (aiPromptHeadingBtn) {
    aiPromptHeadingBtn.addEventListener('click', () => {
      const isOpen = aiPromptBox?.classList.contains('open');
      toggleAiPromptBox(!isOpen);
    });
  }

  if (aiPromptCloseBtn) {
    aiPromptCloseBtn.addEventListener('click', () => {
      toggleAiPromptBox(false);
    });
  }

  if (syncBotContextBtn) {
    syncBotContextBtn.addEventListener('click', async () => {
      scheduleBotContextSync({ reason: 'manual', force: true, delayMs: 50 });
    });
  }

  if (editorSaveBtn) {
    editorSaveBtn.addEventListener('click', () => {
      localStorage.setItem('learning-editor-document', editorArea.innerHTML || '');
      setStatus('Editor content saved locally.');
    });
  }

  if (editorLoadBtn) {
    editorLoadBtn.addEventListener('click', () => {
      const saved = localStorage.getItem('learning-editor-document');
      if (!saved) {
        setStatus('No saved editor content found.');
        return;
      }
      editorArea.innerHTML = saved;
      randomizeDynamicSpinners();
      setStatus('Editor content loaded.');
    });
  }

  randomizeDynamicSpinners();
  if (editorSetGrokKeyBtn && getGrokApiKey()) {
    editorSetGrokKeyBtn.textContent = 'Update Grok Key';
  }

  let contextSyncTimer = null;
  const scheduleContextSync = () => {
    if (contextSyncTimer) {
      window.clearTimeout(contextSyncTimer);
    }
    contextSyncTimer = window.setTimeout(() => {
      syncLearningContext({ silent: true }).catch(() => {});
    }, 250);
  };
  editorArea.addEventListener('input', scheduleContextSync);
  editorArea.addEventListener('keyup', scheduleContextSync);
  editorArea.addEventListener('mouseup', scheduleContextSync);
}

function renderAccountMeta() {
  if (!accountMeta) {
    return;
  }
  const account = state.selectedAccount;
  const source = state.selectedSource || '--';
  const metaRows = [
    ['Creditor', account?.creditorName || '--'],
    ['Creditor Address', getDataReporterAddress(account, 'transunion') || '--'],
    ['Account #', account?.accountNumber || '--'],
    ['Source', source],
  ];
  accountMeta.innerHTML = metaRows.map(([label, value]) => `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>
  `).join('');
}

function renderComparisonTable() {
  const account = state.selectedAccount;
  const client = state.selectedClient;
  creditorTitle.textContent = account?.creditorName || 'Choose an account';
  clientSummary.textContent = client
    ? `${formatClientName(client)}${client.reportDate ? ` • Report ${client.reportDate}` : ''}`
    : 'No client selected.';
  renderAccountMeta();

  if (!account) {
    comparisonWrap.innerHTML = '<div class="learning-empty-state">No account selected.</div>';
    renderMetro2Guide(null);
    renderTagDrawer();
    syncLearningContext({ silent: true }).catch(() => {});
    return;
  }

  const rows = buildRows(account);
  const bodyRows = rows.map((row) => {
    if (row.section) {
      return `<tr class="section-row"><td colspan="5">${escapeHtml(row.section)}</td></tr>`;
    }
    const isAddressRow = String(row.label || '').trim().toLowerCase() === 'data reporter street address';
    return `
      <tr class="${isAddressRow ? 'learning-row-address' : ''}">
        <td class="item">${escapeHtml(row.label)}</td>
        <td class="codes">${row.code ? `<span class="learning-code">${escapeHtml(row.code)}</span>` : ''}</td>
        ${bureauOrder.map((bureau) => {
          const value = normalizeValue(row.values[bureau]);
          return `<td class="${bureauCssClass[bureau]} ${value === '--' ? 'muted' : ''}">${formatRowCellValue(row.label, row.values[bureau])}</td>`;
        }).join('')}
      </tr>
    `;
  }).join('');

  comparisonWrap.innerHTML = `
    <table class="learning-table">
      <thead>
        <tr>
          <th class="item">Field</th>
          <th class="codes">Code</th>
          ${bureauOrder.map((bureau) => `<th class="${bureauCssClass[bureau]}">${escapeHtml(bureauLabels[bureau])}</th>`).join('')}
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
    ${renderPaymentHistoryGrid(account)}
  `;
  renderMetro2Guide(account);
  renderTagDrawer();
  syncLearningContext({ silent: true }).catch(() => {});
}

function setStatus(message, isError = false) {
  statusNode.textContent = message;
  statusNode.style.color = isError ? '#b42318' : '';
}

function renderClientOptions() {
  const options = ['<option value="">Choose client</option>'];
  const sorted = [...state.clients].sort((a, b) => formatClientName(a).localeCompare(formatClientName(b)));
  for (const client of sorted) {
    options.push(`<option value="${escapeHtml(client.id)}">${escapeHtml(formatClientName(client))}</option>`);
  }
  clientSelect.innerHTML = options.join('');
}

function renderAccountOptions() {
  const options = ['<option value="">Choose account</option>'];
  for (const account of state.selectedClientAccounts) {
    const label = [
      account.creditorName || 'Unknown creditor',
      account.accountNumber || 'No account #',
    ].join(' • ');
    options.push(`<option value="${escapeHtml(account.id)}">${escapeHtml(label)}</option>`);
  }
  accountSelect.innerHTML = options.join('');
  accountSelect.disabled = !state.selectedClientAccounts.length;
}

async function loadClients() {
  setStatus('Loading clients...');
  const payload = await requestJson('/api/training/clients');
  const reportReadyClients = Array.isArray(payload.clients)
    ? payload.clients.filter((client) => {
      const hasReport = Boolean(client && (
        String(client.reportDate || '').trim()
        || client.hasJsonReport
      ));
      return hasReport;
    })
    : [];
  const preferredClientId = getPreferredLearningClientId();

  if (!preferredClientId) {
    state.clients = [];
    renderClientOptions();
    clientSelect.disabled = true;
    setStatus('No client selected in NinjaTools. Select a client first, then open Learning.', true);
    return;
  }

  const selectedClient = reportReadyClients.find((client) => client.id === preferredClientId) || null;
  if (!selectedClient) {
    state.clients = [];
    renderClientOptions();
    clientSelect.disabled = true;
    setStatus('Selected client was not found or has no JSON report ready.', true);
    return;
  }

  state.clients = [selectedClient];
  renderClientOptions();
  clientSelect.value = selectedClient.id;
  clientSelect.disabled = true;
  await loadClientAccounts(selectedClient.id);
}

async function loadClientAccounts(clientId) {
  state.selectedClientId = clientId;
  state.selectedClient = state.clients.find((client) => client.id === clientId) || null;
  state.selectedClientAccounts = [];
  state.selectedAccountId = '';
  state.selectedAccount = null;
  state.selectedSource = '';
  renderAccountOptions();
  renderComparisonTable();

  if (!clientId) {
    setStatus('Choose a client.');
    return;
  }

  setStatus('Loading client accounts...');
  const payload = await requestJson(`/api/training/clients/${encodeURIComponent(clientId)}/derogatory`);
  state.selectedClientAccounts = Array.isArray(payload.accounts) ? payload.accounts : [];
  state.selectedSource = String(payload.source || '').trim();
  renderAccountOptions();
  renderComparisonTable();
  setStatus(state.selectedClientAccounts.length ? 'Choose an account.' : 'No derogatory accounts found for this client.');
  scheduleBotContextSync({ reason: 'client-load', force: true, delayMs: 180 });
}

function handleAccountChange(accountId) {
  state.selectedAccountId = accountId;
  state.selectedAccount = state.selectedClientAccounts.find((account) => account.id === accountId) || null;
  renderComparisonTable();
  if (state.selectedAccount) {
    setStatus(`Showing ${state.selectedAccount.creditorName || 'selected account'}.`);
  }
  scheduleBotContextSync({ reason: 'account-change', force: true, delayMs: 120 });
}

clientSelect.addEventListener('change', async () => {
  try {
    await loadClientAccounts(clientSelect.value);
  } catch (error) {
    setStatus(error.message || 'Failed to load client accounts.', true);
  }
});

accountSelect.addEventListener('change', () => {
  handleAccountChange(accountSelect.value);
});

if (pdfLoadBtn) {
  pdfLoadBtn.addEventListener('click', () => {
    const searchTerm = pdfSearchInput ? pdfSearchInput.value : '';
    ensureEmbeddedPdf(searchTerm);
  });
}

resourceButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const resource = btn.dataset.resource;
    if (!resource) return;
    showResourcePanel(resource);
  });
});

if (pdfSearchBtn) {
  pdfSearchBtn.addEventListener('click', () => {
    const query = String(pdfSearchInput?.value || '').trim();
    ensureEmbeddedPdf(query);
  });
}

if (pdfSearchInput) {
  pdfSearchInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const query = String(pdfSearchInput.value || '').trim();
    ensureEmbeddedPdf(query);
  });
}

loadClients().catch((error) => {
  setStatus(error.message || 'Failed to load clients.', true);
});

renderMetro2Guide(null);
setActivePdfDoc(activePdfDocKey);
initLearningEditor();
syncLearningContext({ silent: true }).catch(() => {});
scheduleBotContextSync({ reason: 'startup', force: true, delayMs: 900 });
