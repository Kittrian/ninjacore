const resolveInitialHubMode = () => {
  try {
    const url = new URL(window.location.href);
    const hub = String(url.searchParams.get('hub') || '').trim().toLowerCase();
    if (['home', 'add', 'clients'].includes(hub)) {
      return hub;
    }

    const pathname = String(url.pathname || '').trim().toLowerCase();
    if (
      pathname.endsWith('/add-clients')
      || pathname.endsWith('/add-clients.html')
      || pathname.endsWith('/add-client')
      || pathname.endsWith('/add-client.html')
    ) {
      return 'add';
    }
  } catch {
  }

  return 'clients';
};

const state = {
  clients: [],
  statuses: [],
  phases: [],
  currentUser: 'admin',
  query: '',
  selectedClientId: '',
  pinnedClientId: '',
  accountCategoryFilter: 'all',
  editingClientId: '',
  addFormEditingClientId: '',
  sortKey: 'nextImport',
  sortDirection: 'asc',
  statusFilter: 'Client',
  hubMode: resolveInitialHubMode(),
  integrations: {
    smartcredit: { pid: '', tokenId: '', apiSecret: '' },
    smartcredit35540: { pid: '35540', tokenId: '', apiSecret: '' },
    smartcredit68951: { pid: '68951', tokenId: '', apiSecret: '' },
    myfreescorenow: { pid: '', tokenId: '', apiSecret: '' },
  },
  affiliateLinks: {
    creditBuilder: [],
    creditMonitoring: [],
  },
  activeAffiliateTab: 'creditBuilder',
  clientsRenderLimit: 80,
};
const CLIENTS_RENDER_INITIAL_LIMIT = 80;
const CLIENTS_RENDER_INCREMENT = 120;
const CLIENTS_SEARCH_RENDER_LIMIT = 120;

const affiliateMonitoringOrder = ['identityiq', 'myscoreiq', 'smartcredit', 'myfreescorenow'];
const affiliateMonitoringFallbacks = {
  identityiq: {
    id: 'identityiq',
    name: 'IdentityIQ',
    description: '',
    url: '',
    imagePath: '',
    show: false,
    isDefault: false,
  },
  myscoreiq: {
    id: 'myscoreiq',
    name: 'mySCOREIQ',
    description: '',
    url: '',
    imagePath: '',
    show: false,
    isDefault: false,
  },
  smartcredit: {
    id: 'smartcredit',
    name: 'SmartCredit',
    description: '',
    url: '',
    imagePath: '/assets/smartcredit-logo.png',
    show: false,
    isDefault: false,
  },
  myfreescorenow: {
    id: 'myfreescorenow',
    name: 'myFreeScoreNow',
    description: '',
    url: '',
    imagePath: '/assets/myfreescorenow-logo.png',
    show: false,
    isDefault: false,
  },
};

const byId = (id) => document.getElementById(id);
const setBootLoadingOverlay = (isActive, message = '') => {
  const overlay = byId('appBootLoader');
  if (!overlay) {
    return;
  }
  overlay.hidden = !isActive;
  overlay.classList.toggle('is-active', Boolean(isActive));
  const messageNode = byId('appBootLoaderText');
  if (messageNode && message) {
    messageNode.textContent = message;
  }
};
const apiBase = window.location.protocol === 'file:' ? 'http://127.0.0.1:3017' : '';
const APP_SCRIPT_VERSION = 'v3.01 loaded';
let previousHubIndex = -1;
const widgetLogoStorageKey = 'tools-ninja-widget-logo';
const widgetBusinessNameStorageKey = 'tools-ninja-widget-business-name';
const widgetBrandColorStorageKey = 'tools-ninja-widget-brand-color';
const homeSettingsStorageKey = 'tools-ninja-home-settings';
const learningSelectedClientStorageKey = 'ninja-selected-client-id';
const homeBrandColors = ['#58a55c', '#4da95f', '#1d9ca1', '#ffad28', '#ee3b6c', '#0000ff'];
let addClientPortalPasswordManual = false;
let addClientSecretKeyManual = false;
let lastDerivedPortalPassword = '';
let lastDerivedSecretKey = '';
let addressSuggestionTimer = null;
let addressSuggestionController = null;
let addressSuggestionRecords = [];
let searchRenderTimer = null;
let clientSaveProgressTimer = null;
let clientSaveProgressValue = 0;
const clientDocumentBinaryCache = new Map();
const fixedClientDocumentTypes = [
  'ID Document',
  'SSN Document',
  'POA Document',
  'POA2 Document',
  'POA3 Document',
  'Limited Power of Attorney',
  'Affidavit of Facts',
  'Identity Theft Affidavit',
  'Other',
];
const docTypesWithPrintSide = new Set(['Limited Power of Attorney', 'Affidavit of Facts', 'Identity Theft Affidavit', 'Other']);
const docTypesWithPrintLetters = new Set(['Limited Power of Attorney', 'Affidavit of Facts', 'Identity Theft Affidavit', 'Other']);
const documentImageCropWidth = 900;
const documentImageCropHeight = 500;
let imageCropVueInstance = null;
let imageCropResolve = null;
let imageCropReject = null;
let imageCropActiveObjectUrl = '';
let refreshLoaderThreeModulePromise = null;
let refreshLoaderController = null;
let isRefreshLoaderRunning = false;
const defaultBrowserTabTitle = document.title || 'NinjaTools';
let quickSaveClientIdentityController = null;
let pendingQuickSaveExitToContacts = false;

const createQuickSaveClientIdentityController = () => {
  const root = document.querySelector('[data-nt-quick-save]');
  if (!root) return null;
  const button = root.querySelector('.nt-qs-button');
  const text = root.querySelector('.nt-qs-text');
  const progress = root.querySelector('.nt-qs-progress-bar');
  const check = root.querySelector('.nt-qs-checkmark');
  const checkPath = root.querySelector('.nt-qs-check-path');
  const clientForm = byId('clientForm');
  if (!button || !text || !progress || !check || !checkPath || !clientForm) return null;

  const reset = () => {
    button.disabled = false;
    button.style.width = '200px';
    button.style.height = '52px';
    button.style.borderRadius = '8px';
    text.style.opacity = '1';
    progress.style.width = '0';
    progress.style.height = '10px';
    progress.style.borderRadius = '200px';
    progress.style.opacity = '1';
    check.style.opacity = '0';
    const len = checkPath.getTotalLength();
    checkPath.style.strokeDasharray = String(len);
    checkPath.style.strokeDashoffset = String(len);
  };

  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const playAndSubmit = async () => {
    if (button.disabled) return;
    button.disabled = true;
    const len = checkPath.getTotalLength();
    checkPath.style.strokeDasharray = String(len);
    checkPath.style.strokeDashoffset = String(len);

    text.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 100,
      fill: 'forwards',
      easing: 'linear',
    });
    await wait(100);

    button.animate([
      { width: '200px', height: '52px', borderRadius: '8px' },
      { width: '300px', height: '10px', borderRadius: '100px' },
    ], { duration: 1300, fill: 'forwards', easing: 'ease' });
    await wait(1300);
    button.style.width = '300px';
    button.style.height = '10px';
    button.style.borderRadius = '100px';

    progress.animate([{ width: '0' }, { width: '300px' }], {
      duration: 2000,
      fill: 'forwards',
      easing: 'linear',
    });
    await wait(2000);
    progress.style.width = '300px';

    button.style.width = '0';

    progress.animate([
      { width: '300px', height: '10px', borderRadius: '200px' },
      { width: '80px', height: '80px', borderRadius: '80px' },
    ], { duration: 750, fill: 'forwards', easing: 'ease', delay: 500 });
    await wait(1250);
    progress.style.width = '80px';
    progress.style.height = '80px';
    progress.style.borderRadius = '80px';

    progress.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: 120, fill: 'forwards', easing: 'linear' },
    );
    await wait(120);
    progress.style.opacity = '0';

    check.style.opacity = '1';
    checkPath.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], {
      duration: 220,
      fill: 'forwards',
      easing: 'ease-in-out',
    });
    await wait(220);

    pendingQuickSaveExitToContacts = true;
    clientForm.requestSubmit();
  };

  button.addEventListener('click', (event) => {
    event.preventDefault();
    playAndSubmit().catch(() => reset());
  });

  reset();
  return { reset };
};

const updateBrowserTabTitle = (client = null) => {
  if (!client) {
    document.title = defaultBrowserTabTitle;
    return;
  }
  const firstName = String(client.firstName || '').trim();
  const lastName = String(client.lastName || '').trim();
  const fullName = `${firstName} ${lastName}`.trim();
  document.title = fullName ? `${fullName} - File` : defaultBrowserTabTitle;
};

const persistLearningSelectedClientId = (clientId = '') => {
  try {
    const normalized = String(clientId || '').trim();
    if (normalized) {
      window.localStorage.setItem(learningSelectedClientStorageKey, normalized);
      return;
    }
    window.localStorage.removeItem(learningSelectedClientStorageKey);
  } catch (_error) {
    // ignore localStorage errors
  }
};

const loadRefreshLoaderThree = async () => {
  if (!refreshLoaderThreeModulePromise) {
    refreshLoaderThreeModulePromise = import('https://esm.sh/three@0.160.1')
      .then((module) => module?.default || module)
      .catch((error) => {
        refreshLoaderThreeModulePromise = null;
        throw error;
      });
  }
  return refreshLoaderThreeModulePromise;
};

const buildRefreshLoaderController = (anchor) => {
  const root = document.createElement('div');
  root.className = 'nt-refresh-loader';
  const wrap = document.createElement('div');
  wrap.className = 'nt-refresh-loader-wrap';
  root.append(wrap);

  let renderer = null;
  let camera = null;
  let scene = null;
  let group = null;
  let mesh = null;
  let ring = null;
  let ringcover = null;
  let animationFrameId = null;
  let toend = false;
  let animatestep = 0;
  let acceleration = 0;
  let disposed = false;

  const onPointerDown = () => {
    toend = true;
  };
  const onPointerUp = () => {
    toend = false;
  };

  const ensureAttached = () => {
    if (disposed) return;
    if (root.parentElement !== anchor) {
      anchor.replaceChildren(root);
    }
  };

  const easing = (t, b, c, d) => {
    let normalized = t / (d / 2);
    if (normalized < 1) return ((c / 2) * normalized * normalized) + b;
    normalized -= 2;
    return ((c / 2) * ((normalized * normalized * normalized) + 2)) + b;
  };

  const disposeThreeObjects = () => {
    if (!group || !scene) {
      return;
    }
    for (const child of [...group.children]) {
      if (child.geometry && typeof child.geometry.dispose === 'function') {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((item) => item?.dispose?.());
        } else if (typeof child.material.dispose === 'function') {
          child.material.dispose();
        }
      }
      group.remove(child);
    }
    scene.remove(group);
  };

  const stop = () => {
    disposed = true;
    if (animationFrameId) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    root.removeEventListener('pointerdown', onPointerDown);
    root.removeEventListener('pointerup', onPointerUp);
    root.removeEventListener('pointerleave', onPointerUp);
    disposeThreeObjects();
    if (renderer) {
      renderer.dispose?.();
      renderer.forceContextLoss?.();
      if (renderer.domElement?.parentElement === wrap) {
        wrap.removeChild(renderer.domElement);
      }
    }
    renderer = null;
    camera = null;
    scene = null;
    group = null;
    mesh = null;
    ring = null;
    ringcover = null;
    if (anchor) {
      anchor.replaceChildren();
    }
  };

  const start = async () => {
    if (disposed) return;
    ensureAttached();
    if (renderer) return;

    let THREE;
    try {
      THREE = await loadRefreshLoaderThree();
    } catch (error) {
      return;
    }
    if (disposed) return;

    const canvassize = 560;
    const length = 40;
    const radius = 5.6;
    const rotatevalue = 0.035;
    const pi2 = Math.PI * 2;

    class LoadingCurve extends THREE.Curve {
      getPoint(percent, target = new THREE.Vector3()) {
        const x = length * Math.sin(pi2 * percent);
        const y = radius * Math.cos(pi2 * 3 * percent);
        let t = ((percent % 0.25) / 0.25);
        t = (percent % 0.25) - ((2 * (1 - t) * t * -0.0185) + (t * t * 0.25));
        if (Math.floor(percent / 0.25) === 0 || Math.floor(percent / 0.25) === 2) {
          t *= -1;
        }
        const z = radius * Math.sin(pi2 * 2 * (percent - t));
        return target.set(x, y, z);
      }
    }

    camera = new THREE.PerspectiveCamera(65, 1, 1, 10000);
    camera.position.z = 150;

    scene = new THREE.Scene();
    group = new THREE.Group();
    scene.add(group);

    mesh = new THREE.Mesh(
      new THREE.TubeGeometry(new LoadingCurve(), 200, 1.1, 8, true),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    group.add(mesh);

    ringcover = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 15, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0, transparent: true }),
    );
    ringcover.position.x = length + 1;
    ringcover.rotation.y = Math.PI / 2;
    group.add(ringcover);

    ring = new THREE.Mesh(
      new THREE.RingGeometry(4.3, 5.55, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0, transparent: true }),
    );
    ring.position.x = length + 1.1;
    ring.rotation.y = Math.PI / 2;
    group.add(ring);

    for (let i = 0; i < 10; i += 1) {
      const plain = new THREE.Mesh(
        new THREE.PlaneGeometry((length * 2) + 1, radius * 3, 1),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07 }),
      );
      plain.position.z = -2.5 + (i * 0.5);
      group.add(plain);
    }

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(canvassize, canvassize);
    renderer.setClearColor(0x000000, 0);
    wrap.appendChild(renderer.domElement);

    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('pointerup', onPointerUp);
    root.addEventListener('pointerleave', onPointerUp);

    const render = () => {
      if (disposed || !mesh || !group || !renderer || !camera || !scene || !ring || !ringcover) {
        return;
      }
      animatestep = Math.max(0, Math.min(240, toend ? animatestep + 1 : animatestep - 4));
      acceleration = easing(animatestep, 0, 1, 240);

      if (acceleration > 0.35) {
        const progress = (acceleration - 0.35) / 0.65;
        group.rotation.y = (-Math.PI / 2) * progress;
        group.position.z = 50 * progress;
        const endProgress = Math.max(0, (acceleration - 0.97) / 0.03);
        mesh.material.opacity = 1 - endProgress;
        ringcover.material.opacity = endProgress;
        ring.material.opacity = endProgress;
        ring.scale.x = ring.scale.y = 0.9 + (0.1 * endProgress);
      } else {
        group.rotation.y = 0;
        group.position.z = 0;
        mesh.material.opacity = 1;
        ringcover.material.opacity = 0;
        ring.material.opacity = 0;
        ring.scale.x = ring.scale.y = 1;
      }

      mesh.rotation.x += rotatevalue + acceleration;
      renderer.render(scene, camera);
      animationFrameId = window.requestAnimationFrame(render);
    };

    render();
  };

  return {
    anchor,
    start,
    stop,
  };
};

const syncRefreshLoaderToDetail = () => {
  const detailRoot = byId('clientDetail');
  const anchor = detailRoot?.querySelector('.detail-refresh-loader-anchor') || null;
  if (!isRefreshLoaderRunning || !anchor) {
    if (refreshLoaderController) {
      refreshLoaderController.stop();
      refreshLoaderController = null;
    }
    return;
  }
  if (!refreshLoaderController || refreshLoaderController.anchor !== anchor) {
    if (refreshLoaderController) {
      refreshLoaderController.stop();
    }
    refreshLoaderController = buildRefreshLoaderController(anchor);
  }
  void refreshLoaderController.start();
};

const setRefreshLoaderRunning = (running) => {
  isRefreshLoaderRunning = Boolean(running);
  syncRefreshLoaderToDetail();
};

const formatFileSize = (bytes) => {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) {
    return '';
  }
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
};

const getSsnLastFour = (value = '') => String(value || '').replace(/\D/g, '').slice(-4);

const buildPortalPasswordDefault = (lastName = '', firstName = '') => {
  const cleanLastName = String(lastName || '').trim().replace(/\s+/g, '');
  const firstInitial = String(firstName || '').trim().charAt(0);
  return `${cleanLastName}${firstInitial}123`.trim();
};

const buildCombinedAddress = ({ street = '', city = '', state = '', zip = '' } = {}) => {
  const streetValue = String(street || '').trim();
  const cityValue = String(city || '').trim();
  const stateValue = String(state || '').trim().toUpperCase();
  const zipValue = String(zip || '').trim();
  const locality = [cityValue, [stateValue, zipValue].filter(Boolean).join(' ')].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  if (streetValue && locality) {
    return `${streetValue} | ${locality}`;
  }
  return streetValue || locality;
};

const parseCombinedAddress = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) {
    return { street: '', city: '', state: '', zip: '' };
  }

  const cleaned = raw
    .replace(/,\s*(United States(?: of America)?|USA)\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const parseLocality = (localityValue = '') => {
    const locality = String(localityValue || '').trim().replace(/\s+/g, ' ');
    if (!locality) {
      return { city: '', state: '', zip: '' };
    }
    const fullMatch = locality.match(/^(.*?)[,\s]+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
    if (fullMatch) {
      return {
        city: String(fullMatch[1] || '').trim().replace(/,$/, ''),
        state: String(fullMatch[2] || '').trim().toUpperCase(),
        zip: String(fullMatch[3] || '').trim(),
      };
    }
    const stateOnly = locality.match(/^(.*?)[,\s]+([A-Za-z]{2})$/);
    if (stateOnly) {
      return {
        city: String(stateOnly[1] || '').trim().replace(/,$/, ''),
        state: String(stateOnly[2] || '').trim().toUpperCase(),
        zip: '',
      };
    }
    return { city: locality.replace(/,$/, ''), state: '', zip: '' };
  };

  if (cleaned.includes('|')) {
    const [streetPart, localityPart] = cleaned.split('|');
    const street = String(streetPart || '').trim().replace(/,$/, '');
    const parsedLocality = parseLocality(localityPart || '');
    return {
      street,
      city: parsedLocality.city,
      state: parsedLocality.state,
      zip: parsedLocality.zip,
    };
  }

  const stateZipMatch = cleaned.match(/,\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)(?:\s*,.*)?$/);
  if (stateZipMatch && Number.isInteger(stateZipMatch.index)) {
    const state = String(stateZipMatch[1] || '').trim().toUpperCase();
    const zip = String(stateZipMatch[2] || '').trim();
    const prefix = cleaned.slice(0, stateZipMatch.index).replace(/,\s*$/, '').trim();
    const parts = prefix.split(',').map((part) => String(part || '').trim()).filter(Boolean);
    if (parts.length >= 2) {
      const city = parts.pop() || '';
      const street = parts.join(', ');
      return { street, city, state, zip };
    }
    return { street: prefix, city: '', state, zip };
  }

  const stateOnlyMatch = cleaned.match(/,\s*([A-Za-z]{2})(?:\s*,.*)?$/);
  if (stateOnlyMatch && Number.isInteger(stateOnlyMatch.index)) {
    const state = String(stateOnlyMatch[1] || '').trim().toUpperCase();
    const prefix = cleaned.slice(0, stateOnlyMatch.index).replace(/,\s*$/, '').trim();
    const parts = prefix.split(',').map((part) => String(part || '').trim()).filter(Boolean);
    if (parts.length >= 2) {
      const city = parts.pop() || '';
      const street = parts.join(', ');
      return { street, city, state, zip: '' };
    }
    return { street: prefix, city: '', state, zip: '' };
  }

  const match = cleaned.match(/^(.*?)(?:,\s*([^,]+?),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?))?$/);
  if (!match) {
    return { street: cleaned, city: '', state: '', zip: '' };
  }

  return {
    street: String(match[1] || '').trim(),
    city: String(match[2] || '').trim(),
    state: String(match[3] || '').trim().toUpperCase(),
    zip: String(match[4] || '').trim(),
  };
};

const uniqueStatusList = (statuses = []) => {
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

const uniquePhaseList = (phases = []) => {
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

const getDefaultHomeSettings = () => ({
  companyName: window.localStorage.getItem(widgetBusinessNameStorageKey) || 'Best Texas Credit Pros',
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
  logoDataUrl: window.localStorage.getItem(widgetLogoStorageKey) || '',
});

const normalizeBrandColor = (value) => {
  const color = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#0000ff';
};

const toRgb = (hex) => {
  const value = String(hex || '').replace('#', '');
  return {
    r: Number.parseInt(value.slice(0, 2), 16) || 0,
    g: Number.parseInt(value.slice(2, 4), 16) || 0,
    b: Number.parseInt(value.slice(4, 6), 16) || 0,
  };
};

const toHex = ({ r, g, b }) => {
  const channel = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
};

const mixHex = (fromHex, toHexValue, ratio) => {
  const from = toRgb(fromHex);
  const to = toRgb(toHexValue);
  const p = Math.max(0, Math.min(1, ratio));
  return toHex({
    r: from.r + (to.r - from.r) * p,
    g: from.g + (to.g - from.g) * p,
    b: from.b + (to.b - from.b) * p,
  });
};

const applyBrandColor = (value, { notifyWidget = true } = {}) => {
  const color = normalizeBrandColor(value);
  const deep = mixHex(color, '#000000', 0.52);
  const strong = mixHex(color, '#000000', 0.26);
  const light = mixHex(color, '#ffffff', 0.22);
  document.documentElement.style.setProperty('--ninja-dynamic-color', color);
  document.documentElement.style.setProperty('--ninja-logo-color-1', deep);
  document.documentElement.style.setProperty('--ninja-logo-color-2', strong);
  document.documentElement.style.setProperty('--ninja-logo-color-3', light);
  window.localStorage.setItem(widgetBrandColorStorageKey, color);
  byId('clientHubHomePane')?.style.setProperty('--home-brand-color', color);

  if (!notifyWidget) {
    return;
  }

  const frame = document.querySelector('.hero-widget-frame');
  if (frame?.contentWindow) {
    frame.contentWindow.postMessage({ type: 'tools-ninja:brand-color', value: color }, window.location.origin);
  }
};

const readHomeSettings = () => {
  const defaults = getDefaultHomeSettings();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(homeSettingsStorageKey) || '{}');
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
};

const writeHomeSettings = (settings) => {
  window.localStorage.setItem(homeSettingsStorageKey, JSON.stringify(settings));
};

const fetchBusinessSettingsFromServer = async () => {
  try {
    const payload = await request('/api/business-settings');
    if (!payload?.settings || typeof payload.settings !== 'object') {
      return null;
    }
    return payload.settings;
  } catch {
    return null;
  }
};

const saveBusinessSettingsToServer = async (settings) => {
  await request('/api/business-settings', {
    method: 'PUT',
    body: { settings },
  });
};

const syncBusinessAssetsToWidget = ({ companyName = '', logoDataUrl = '', companyColor = '' } = {}) => {
  const existingName = String(window.localStorage.getItem(widgetBusinessNameStorageKey) || '').trim();
  const nextName = String(companyName || '').trim() || existingName || 'Best Texas Credit Pros';
  const nextColor = normalizeBrandColor(companyColor);
  window.localStorage.setItem(widgetBusinessNameStorageKey, nextName);
  window.localStorage.setItem(widgetBrandColorStorageKey, nextColor);
  if (logoDataUrl) {
    window.localStorage.setItem(widgetLogoStorageKey, logoDataUrl);
  } else {
    window.localStorage.removeItem(widgetLogoStorageKey);
  }

  const frame = document.querySelector('.hero-widget-frame');
  if (frame?.contentWindow) {
    frame.contentWindow.postMessage({ type: 'tools-ninja:business-name', value: nextName }, window.location.origin);
    frame.contentWindow.postMessage({ type: 'tools-ninja:logo', value: logoDataUrl || '' }, window.location.origin);
    frame.contentWindow.postMessage({ type: 'tools-ninja:brand-color', value: nextColor }, window.location.origin);
  }
};

const setHomeSettingsMessage = (message, isError = false) => {
  const node = byId('homeSettingsMessage');
  if (!node) {
    return;
  }
  node.textContent = message;
  node.classList.toggle('error', Boolean(isError));
};

const updateHomeFromPreview = () => {
  const companyName = byId('homeCompanyName')?.value?.trim() || 'Best Texas Credit Pros';
  const senderName = byId('homeSenderName')?.value?.trim() || 'Andrew';
  const emailDomainRaw = byId('homeEmailDomain')?.value?.trim() || '@securecreditclient.com';
  const normalizedDomain = emailDomainRaw.startsWith('@') ? emailDomainRaw.slice(1) : emailDomainRaw;
  const preview = byId('homeFromNamePreview');
  if (preview) {
    preview.value = `From: ${companyName} <${senderName}@${normalizedDomain}>`;
  }
};

const applyHomeSettingsToDom = (settings) => {
  byId('homeCompanyName').value = settings.companyName || '';
  byId('homeCompanyAddress').value = settings.companyAddress || '';
  byId('homeCompanyCity').value = settings.companyCity || '';
  byId('homeCompanyState').value = settings.companyState || 'Texas';
  byId('homeCompanyZipcode').value = settings.companyZipcode || '';
  byId('homeCompanyEmail').value = settings.companyEmail || '';
  byId('homeCompanyPhone').value = settings.companyPhone || '';
  byId('homeConsultationFee').value = settings.consultationFee || '';
  byId('homeServiceFee').value = settings.serviceFee || '';
  byId('homeClientPortalUrl').value = settings.clientPortalUrl || '';
  byId('homeSelfSignupLink').value = settings.selfSignupLink || '';
  byId('homeSenderName').value = settings.senderName || '';
  byId('homeEmailDomain').value = settings.emailDomain || '';
  byId('homeDisputeDueDate').value = settings.disputeDueDate || '35-Days';

  const logoPreview = byId('homeLogoPreview');
  const logoPlaceholder = byId('homeLogoPlaceholder');
  if (settings.logoDataUrl) {
    logoPreview.src = settings.logoDataUrl;
    logoPreview.hidden = false;
    logoPlaceholder.hidden = true;
  } else {
    logoPreview.removeAttribute('src');
    logoPreview.hidden = true;
    logoPlaceholder.hidden = false;
  }

  document.querySelectorAll('[data-home-color]').forEach((button) => {
    const isActive = button.dataset.homeColor === settings.companyColor;
    button.classList.toggle('is-active', isActive);
  });
  applyBrandColor(settings.companyColor || '#0000ff');
  updateHomeFromPreview();
};

const collectHomeSettingsFromDom = () => ({
  companyName: byId('homeCompanyName')?.value?.trim() || '',
  companyAddress: byId('homeCompanyAddress')?.value?.trim() || '',
  companyCity: byId('homeCompanyCity')?.value?.trim() || '',
  companyState: byId('homeCompanyState')?.value?.trim() || '',
  companyZipcode: byId('homeCompanyZipcode')?.value?.trim() || '',
  companyEmail: byId('homeCompanyEmail')?.value?.trim() || '',
  companyPhone: byId('homeCompanyPhone')?.value?.trim() || '',
  consultationFee: byId('homeConsultationFee')?.value?.trim() || '',
  serviceFee: byId('homeServiceFee')?.value?.trim() || '',
  clientPortalUrl: byId('homeClientPortalUrl')?.value?.trim() || '',
  selfSignupLink: byId('homeSelfSignupLink')?.value?.trim() || '',
  senderName: byId('homeSenderName')?.value?.trim() || '',
  emailDomain: byId('homeEmailDomain')?.value?.trim() || '',
  disputeDueDate: byId('homeDisputeDueDate')?.value?.trim() || '35-Days',
  companyColor: document.querySelector('[data-home-color].is-active')?.dataset.homeColor || '#0000ff',
  logoDataUrl: byId('homeLogoPreview')?.hidden ? '' : (byId('homeLogoPreview')?.getAttribute('src') || ''),
});

const renderAddClientStatusOptions = () => {
  const select = byId('clientAddStatus');
  if (!select) {
    return;
  }
  const selected = select.value || 'Client';
  const options = uniqueStatusList(state.statuses || ['Client']);
  select.innerHTML = options.map((status) => (
    `<option value="${status}"${status === selected ? ' selected' : ''}>${status}</option>`
  )).join('');
  if (!options.includes(selected)) {
    select.value = options[0] || 'Client';
  }
};

const renderAddClientPhaseOptions = () => {
  const select = byId('clientAddPhase');
  if (!select) {
    return;
  }
  const selected = select.value || 'None';
  const options = uniquePhaseList(state.phases || ['None']);
  select.innerHTML = options.map((phase) => (
    `<option value="${phase}"${phase === selected ? ' selected' : ''}>${phase}</option>`
  )).join('');
  if (!options.includes(selected)) {
    select.value = options[0] || 'None';
  }
};

const renderAddClientAssignmentOptions = () => {
  const ninjaSelect = byId('clientNinjaAssigned');
  const affiliateSelect = byId('clientAffiliateAssigned');
  if (ninjaSelect) {
    const current = String(state.currentUser || 'admin').trim() || 'admin';
    ninjaSelect.innerHTML = `<option value="${escapeHtml(current)}">${escapeHtml(current)}</option>`;
    ninjaSelect.value = current;
  }
  if (affiliateSelect && !affiliateSelect.options.length) {
    affiliateSelect.innerHTML = '<option value="None">None</option>';
    affiliateSelect.value = 'None';
  }
};

const renderSpouseClientOptions = () => {
  const datalist = byId('spouseClientMatches');
  if (!datalist) {
    return;
  }
  const currentClientId = state.addFormEditingClientId || state.selectedClientId || '';
  const rows = state.clients
    .filter((client) => client.id !== currentClientId)
    .map((client) => {
      const display = `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.email || client.phone || 'Client';
      const meta = [client.email, client.phone].filter(Boolean)[0] || '';
      return {
        id: client.id,
        value: meta ? `${display} • ${meta}` : display,
      };
    })
    .sort((left, right) => left.value.localeCompare(right.value));

  datalist.innerHTML = rows.map((row) => (
    `<option value="${row.value}" data-client-id="${row.id}"></option>`
  )).join('');
};

const syncSelectedSpouseClient = () => {
  const input = byId('spouseClientSearch');
  const hidden = byId('spouseClientId');
  const datalist = byId('spouseClientMatches');
  if (!input || !hidden || !datalist) {
    return;
  }
  const typed = String(input.value || '').trim();
  const match = Array.from(datalist.options).find((option) => option.value === typed);
  hidden.value = match?.dataset.clientId || '';
};

const syncDerivedClientCredentials = ({ forcePortal = false, forceSecret = false } = {}) => {
  const lastNameInput = document.querySelector('#clientForm input[name="lastName"]');
  const firstNameInput = document.querySelector('#clientForm input[name="firstName"]');
  const ssnInput = document.querySelector('#clientForm input[name="ssn"]');
  const portalInput = byId('clientPortalPasswordInput');
  const secretKeyInput = byId('clientSecretKeyInput');
  const lastName = lastNameInput?.value || '';
  const firstName = firstNameInput?.value || '';
  const ssn = ssnInput?.value || '';
  const lastFour = getSsnLastFour(ssn);
  const portalDefault = buildPortalPasswordDefault(lastName, firstName);
  const secretDefault = lastFour;

  if (portalInput && (
    forcePortal
    || !addClientPortalPasswordManual
    || !portalInput.value.trim()
    || portalInput.value.trim() === lastDerivedPortalPassword
  )) {
    portalInput.value = portalDefault;
  }
  lastDerivedPortalPassword = portalDefault;

  if (secretKeyInput && (
    forceSecret
    || !addClientSecretKeyManual
    || !secretKeyInput.value.trim()
    || secretKeyInput.value.trim() === lastDerivedSecretKey
  )) {
    secretKeyInput.value = secretDefault;
  }
  lastDerivedSecretKey = secretDefault;
};

const updateClientMonitoringCredentialLayout = () => {
  const form = getClientForm();
  if (!form) return;

  const agency = normalizeMonitoringAgency(form.monitoringAgency?.value || '');
  const useTokenOnly = agency === 'smartcredit' || agency === 'myfreescorenow';
  const secretKeyField = form.querySelector('.add-client-secret-key-field');
  const tokenField = form.querySelector('.add-client-token-field');

  if (secretKeyField) {
    secretKeyField.hidden = useTokenOnly;
  }

  if (tokenField) {
    tokenField.classList.toggle('token-in-secret-slot', useTokenOnly);
  }
};

const resetAddClientDerivedState = () => {
  addClientPortalPasswordManual = false;
  addClientSecretKeyManual = false;
  lastDerivedPortalPassword = '';
  lastDerivedSecretKey = '';
  syncDerivedClientCredentials({ forcePortal: true, forceSecret: true });
};

const getClientForm = () => byId('clientForm');

const normalizeClientDocuments = (value) => {
  const rows = Array.isArray(value) ? value : [];
  return rows
    .map((row, index) => ({
      id: String(row?.id || `doc-${index}-${Date.now()}`),
      type: String(row?.type || '').trim(),
      includeInPrintLetters: Boolean(row?.includeInPrintLetters),
      printSide: String(row?.printSide || 'front').toLowerCase() === 'back' ? 'back' : 'front',
      fileName: String(row?.fileName || '').trim(),
      fileDataUrl: String(row?.fileDataUrl || '').trim(),
      fileType: String(row?.fileType || '').trim(),
      fileSize: Number.isFinite(Number(row?.fileSize)) ? Number(row.fileSize) : null,
      isCustom: Boolean(row?.isCustom),
    }))
    .filter((row) => row.type);
};

const buildDefaultClientDocuments = () => fixedClientDocumentTypes.map((type, index) => ({
  id: `doc-fixed-${index}`,
  type,
  includeInPrintLetters: false,
  printSide: 'front',
  fileName: '',
  fileDataUrl: '',
  fileType: '',
  fileSize: null,
  isCustom: false,
}));

const buildDocumentPreviewMarkup = (entry = {}) => {
  const fileName = String(entry.fileName || '').trim();
  const fileType = String(entry.fileType || '').trim().toLowerCase();
  const fileDataUrl = String(entry.fileDataUrl || '').trim();

  if (fileDataUrl && fileType.startsWith('image/')) {
    return `<img class="client-doc-preview-image" src="${escapeHtml(fileDataUrl)}" alt="${escapeHtml(fileName || 'Document preview')}" />`;
  }
  if (fileDataUrl && fileType.includes('pdf')) {
    return `<iframe class="client-doc-preview-pdf" src="${escapeHtml(fileDataUrl)}#toolbar=0&navpanes=0&scrollbar=0" title="${escapeHtml(fileName || 'PDF preview')}"></iframe>`;
  }
  if (fileName) {
    return `<div class="client-doc-preview-placeholder">${escapeHtml(fileName)}</div>`;
  }
  return '<div class="client-doc-preview-empty">Drop file here<br/>or click to choose</div>';
};

const renderClientDocumentsSection = (documents = []) => {
  const container = byId('clientDocumentsList');
  if (!container) {
    return;
  }

  const rows = documents.length ? normalizeClientDocuments(documents) : buildDefaultClientDocuments();
  clientDocumentBinaryCache.clear();
  container.innerHTML = rows.map((row) => {
    if (row.fileDataUrl) {
      clientDocumentBinaryCache.set(row.id, {
        fileName: row.fileName || '',
        fileDataUrl: row.fileDataUrl || '',
        fileType: row.fileType || '',
        fileSize: row.fileSize ?? null,
      });
    }
    const showPrintSide = docTypesWithPrintSide.has(row.type);
    const showIncludeInPrintLetters = docTypesWithPrintLetters.has(row.type);
    const removeButton = row.isCustom ? `<button class="client-doc-remove" type="button" data-doc-action="remove" data-doc-id="${row.id}">Remove</button>` : '';
    const initialPreview = buildDocumentPreviewMarkup(row);
    const fileMeta = [row.fileName || '', formatFileSize(row.fileSize)].filter(Boolean).join(' • ');
    return `
      <div class="client-doc-card" data-doc-row="${row.id}" data-doc-custom="${row.isCustom ? '1' : '0'}">
        <div class="client-doc-card-head">
          <div class="client-doc-type">${escapeHtml(row.type)}</div>
          ${removeButton}
        </div>
        <label class="client-doc-dropzone" data-doc-dropzone="1" tabindex="0" role="button" aria-label="Upload ${escapeHtml(row.type)}">
          <input type="file" data-doc-field="file" />
          <div class="client-doc-preview">${initialPreview}</div>
        </label>
        <div class="client-doc-file-meta">${escapeHtml(fileMeta)}</div>
        ${showPrintSide ? `
          <div class="client-doc-print-sides">
            <label><input type="radio" name="docPrintSide-${row.id}" value="front" ${row.printSide !== 'back' ? 'checked' : ''} /> Front\\Print</label>
            <label><input type="radio" name="docPrintSide-${row.id}" value="back" ${row.printSide === 'back' ? 'checked' : ''} /> Back\\Print</label>
          </div>
        ` : ''}
        ${showIncludeInPrintLetters ? `
          <label class="client-doc-include">
            <input type="checkbox" data-doc-field="include" ${row.includeInPrintLetters ? 'checked' : ''} />
            Include in Print Letters
          </label>
        ` : ''}
      </div>
    `;
  }).join('');

  bindClientDocumentDropzones();
};

const renderDocumentPreview = (card, file) => {
  const preview = card.querySelector('.client-doc-preview');
  const meta = card.querySelector('.client-doc-file-meta');
  if (!preview || !file) return;
  preview.innerHTML = buildDocumentPreviewMarkup(file);
  if (meta) {
    meta.textContent = [file.fileName || '', formatFileSize(file.fileSize)].filter(Boolean).join(' • ');
  }
};

const assignClientDocumentFileToCard = async (card, fileInput, file) => {
  if (!card || !fileInput || !file) {
    return;
  }
  let fileToStore = file;
  if (String(file.type || '').toLowerCase().startsWith('image/')) {
    try {
      const cropped = await openImageCropDialog(file);
      if (!cropped) {
        return;
      }
      fileToStore = cropped;
    } catch (error) {
      console.warn('Image crop dialog failed; using original file.', error);
      fileToStore = file;
    }
  }
  const dataUrl = await readFileAsDataUrl(fileToStore);
  const cached = {
    fileName: String(fileToStore.name || '').trim(),
    fileDataUrl: dataUrl,
    fileType: String(fileToStore.type || '').trim(),
    fileSize: Number.isFinite(fileToStore.size) ? fileToStore.size : null,
  };
  clientDocumentBinaryCache.set(String(card.dataset.docRow || ''), cached);
  // Safari and some WebView environments can throw on DataTransfer().
  // We still keep the selected/cropped file in cache so Save works.
  try {
    if (typeof DataTransfer === 'function') {
      const transfer = new DataTransfer();
      transfer.items.add(fileToStore);
      fileInput.files = transfer.files;
    }
  } catch (error) {
    // Keep going; cached document data is used during save.
  }
  renderDocumentPreview(card, cached);
};

const bindClientDocumentDropzones = () => {
  const container = byId('clientDocumentsList');
  if (container && container.dataset.changeBound !== '1') {
    container.dataset.changeBound = '1';
    container.addEventListener('change', async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.dataset.docField !== 'file') {
        return;
      }
      const card = target.closest('[data-doc-row]');
      const file = target.files?.[0];
      if (!card || !file) {
        return;
      }
      try {
        await assignClientDocumentFileToCard(card, target, file);
      } catch (error) {
        setFormMessage(error?.message || 'Unable to upload this document right now.', true);
      } finally {
        try {
          target.value = '';
        } catch (resetError) {
          // no-op
        }
      }
    });
  }

  const cards = [...document.querySelectorAll('#clientDocumentsList [data-doc-row]')];
  cards.forEach((card) => {
    const dropzone = card.querySelector('[data-doc-dropzone]');
    const fileInput = card.querySelector('input[data-doc-field="file"]');
    if (!dropzone || !fileInput || dropzone.dataset.bound === '1') return;
    dropzone.dataset.bound = '1';

    const openPicker = () => {
      try {
        fileInput.value = '';
      } catch (resetError) {
        // no-op
      }
      try {
        if (typeof fileInput.showPicker === 'function') {
          fileInput.showPicker();
          return;
        }
      } catch (error) {
        // Fallback to click below.
      }
      fileInput.click();
    };

    dropzone.addEventListener('click', () => {
      openPicker();
    });

    fileInput.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    dropzone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPicker();
      }
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        dropzone.classList.add('is-drag-over');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropzone.addEventListener(eventName, async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (eventName === 'drop') {
          const file = event.dataTransfer?.files?.[0];
          if (file) {
            try {
              await assignClientDocumentFileToCard(card, fileInput, file);
            } catch (error) {
              setFormMessage(error?.message || 'Unable to upload this document right now.', true);
            } finally {
              try {
                fileInput.value = '';
              } catch (resetError) {
                // no-op
              }
            }
          }
        }
        dropzone.classList.remove('is-drag-over');
      });
    });
  });
};

const collectClientDocumentsFromForm = () => {
  const container = byId('clientDocumentsList');
  if (!container) {
    return [];
  }

  const rows = [...container.querySelectorAll('[data-doc-row]')];
  return rows.map((row, index) => {
    const typeText = String(row.querySelector('.client-doc-type')?.textContent || '').trim();
    const include = Boolean(row.querySelector('[data-doc-field="include"]')?.checked);
    const checkedSide = row.querySelector('input[type="radio"]:checked')?.value || 'front';
    const rowId = row.dataset.docRow || `doc-row-${index}`;
    const cachedFile = clientDocumentBinaryCache.get(rowId) || null;
    const fileName = cachedFile?.fileName
      || row.querySelector('[data-doc-field="file"]')?.files?.[0]?.name
      || '';
    return {
      id: rowId,
      type: typeText,
      includeInPrintLetters: include,
      printSide: checkedSide === 'back' ? 'back' : 'front',
      fileName: String(fileName || '').trim(),
      fileDataUrl: String(cachedFile?.fileDataUrl || '').trim(),
      fileType: String(cachedFile?.fileType || '').trim(),
      fileSize: Number.isFinite(Number(cachedFile?.fileSize)) ? Number(cachedFile.fileSize) : null,
      isCustom: row.dataset.docCustom === '1',
    };
  }).filter((entry) => entry.type);
};

const setClientFormMode = (mode = 'add', client = null) => {
  const form = getClientForm();
  if (!form) {
    return;
  }

  const isEdit = mode === 'edit' && client?.id;
  const title = byId('clientFormTitle');
  const subtitle = byId('clientFormSubtitle');
  const submitButton = byId('clientFormSubmitButton');
  quickSaveClientIdentityController?.reset?.();
  pendingQuickSaveExitToContacts = false;
  renderAddClientAssignmentOptions();
  renderAddClientStatusOptions();
  renderAddClientPhaseOptions();

  if (isEdit) {
    state.addFormEditingClientId = client.id;
    if (title) {
      title.textContent = 'Edit Client';
    }
    if (subtitle) {
      subtitle.textContent = 'Update client identity, credentials, and portal access.';
    }
    if (submitButton) {
      submitButton.textContent = 'Save Client Changes';
    }
    setClientFormSegment('client');
    renderClientDocumentsSection(client.documents || []);
    updateClientMonitoringCredentialLayout();
    return;
  }

  state.addFormEditingClientId = '';
  if (title) {
    title.textContent = 'Add Client';
  }
  if (subtitle) {
    subtitle.textContent = 'Client identity, monitoring credentials, and portal access for Ninja Tools.';
  }
  if (submitButton) {
    submitButton.textContent = 'Save Client';
  }
  if (form.ninjaAssigned) {
    form.ninjaAssigned.value = String(state.currentUser || 'admin').trim() || 'admin';
  }
  if (form.affiliateAssigned) {
    form.affiliateAssigned.value = 'None';
  }
  if (form.phase) {
    form.phase.value = 'None';
  }
  const portalEnabledToggle = byId('clientPortalEnabledToggle');
  if (portalEnabledToggle) {
    portalEnabledToggle.checked = true;
  }
  syncClientPortalToggleValue();
  setClientFormSegment('client');
  renderClientDocumentsSection();
  updateClientMonitoringCredentialLayout();
};

const populateAddClientFormFromClient = (client) => {
  const form = getClientForm();
  if (!form || !client) {
    return;
  }

  const addressParts = parseCombinedAddress(client.address || '');
  form.firstName.value = client.firstName || '';
  form.lastName.value = client.lastName || '';
  form.email.value = client.email || '';
  form.dob.value = client.dob || '';
  form.ssn.value = client.ssn || '';
  form.phone.value = client.phone || '';
  form.address.value = addressParts.street || client.address || '';
  form.addressCity.value = addressParts.city || '';
  form.addressState.value = addressParts.state || '';
  form.addressZip.value = addressParts.zip || '';
  if (form.assignedTo) {
    form.assignedTo.value = client.assignedTo || '';
  }
  form.status.value = client.status || 'Client';
  if (form.phase) {
    form.phase.value = client.phase || 'None';
  }
  form.monitoringAgency.value = client.monitoringAgency || '';
  form.monitoringUsername.value = client.monitoringUsername || '';
  form.monitoringPassword.value = client.monitoringPassword || '';
  form.secretKey.value = client.secretKey || '';
  form.monitoringToken.value = client.monitoringToken || '';
  form.portalPassword.value = client.portalPassword || '';
  form.language.value = client.language || 'English';
  if (form.ninjaAssigned) {
    const current = String(state.currentUser || 'admin').trim() || 'admin';
    form.ninjaAssigned.innerHTML = `<option value="${escapeHtml(current)}">${escapeHtml(current)}</option>`;
    form.ninjaAssigned.value = client.ninjaAssigned || current;
  }
  if (form.affiliateAssigned) {
    form.affiliateAssigned.value = client.affiliateAssigned || 'None';
  }
  renderClientDocumentsSection(client.documents || []);

  const portalEnabledToggle = byId('clientPortalEnabledToggle');
  if (portalEnabledToggle) {
    portalEnabledToggle.checked = client.portalEnabled !== false;
  }
  syncClientPortalToggleValue();

  const spouseInput = byId('spouseClientSearch');
  const spouseHidden = byId('spouseClientId');
  if (spouseInput) {
    spouseInput.value = client.spouseClientLabel || '';
  }
  if (spouseHidden) {
    spouseHidden.value = client.spouseClientId || '';
  }

  addClientPortalPasswordManual = true;
  addClientSecretKeyManual = true;
  lastDerivedPortalPassword = form.portalPassword.value.trim();
  lastDerivedSecretKey = form.secretKey.value.trim();
  updateClientMonitoringCredentialLayout();
};

const MAPBOX_PUBLIC_TOKEN = 'pk.eyJ1IjoiYW50aW9jaDc3IiwiYSI6ImNtcGRnNG82bTA1dGQycG4yd3ZlZTRsaHAifQ.9hEconWR_mjoR11f05oCRQ';

const mapboxContextText = (context = [], type = '') => {
  const hit = Array.isArray(context)
    ? context.find((entry) => String(entry?.id || '').startsWith(`${type}.`))
    : null;
  return String(hit?.text || '').trim();
};

const mapboxContextShortCode = (context = [], type = '') => {
  const hit = Array.isArray(context)
    ? context.find((entry) => String(entry?.id || '').startsWith(`${type}.`))
    : null;
  const code = String(hit?.short_code || '').trim();
  if (!code) return '';
  const split = code.split('-');
  return (split[1] || split[0] || '').toUpperCase();
};

const parseMapboxFeatureToAddress = (feature) => {
  const text = String(feature?.text || '').trim();
  const addressNumber = String(feature?.address || '').trim();
  const street = [addressNumber, text].filter(Boolean).join(' ').trim();
  const context = Array.isArray(feature?.context) ? feature.context : [];
  const city = mapboxContextText(context, 'place') || mapboxContextText(context, 'locality');
  const state = mapboxContextShortCode(context, 'region');
  const zip = mapboxContextText(context, 'postcode');
  const label = [
    street,
    [city, state, zip].filter(Boolean).join(' ').trim(),
  ].filter(Boolean).join(', ');

  return {
    label,
    street,
    city,
    state,
    zip,
    placeId: String(feature?.id || '').trim(),
  };
};

const populateAddressSuggestions = async (query) => {
  const datalist = byId('clientAddressMatches');
  const hint = byId('clientAddressHint');
  if (!datalist) {
    return;
  }

  const text = String(query || '').trim();
  if (text.length < 3) {
    datalist.innerHTML = '';
    addressSuggestionRecords = [];
    if (hint) {
      hint.textContent = 'Address suggestions will appear as you type.';
    }
    return;
  }

  if (addressSuggestionController) {
    addressSuggestionController.abort();
  }
  addressSuggestionController = new AbortController();

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json?access_token=${encodeURIComponent(MAPBOX_PUBLIC_TOKEN)}&country=us&types=address&limit=6`;
    const response = await fetch(url, {
      signal: addressSuggestionController.signal,
    });
    if (!response.ok) {
      throw new Error('Address lookup unavailable.');
    }
    const payload = await response.json();
    const features = Array.isArray(payload?.features) ? payload.features : [];
    addressSuggestionRecords = features
      .map(parseMapboxFeatureToAddress)
      .filter((entry) => entry.label && entry.street);
    datalist.innerHTML = addressSuggestionRecords.map((suggestion) => (
      `<option value="${String(suggestion.label || '').replace(/"/g, '&quot;')}"></option>`
    )).join('');
    if (hint) {
      hint.textContent = addressSuggestionRecords.length
        ? 'Mapbox-powered address suggestions are active.'
        : 'Keep typing to narrow the address search.';
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      return;
    }
    if (hint) {
      hint.textContent = 'Address search is temporarily unavailable. You can still type the full address.';
    }
  }
};

const queueAddressSuggestions = (value) => {
  if (addressSuggestionTimer) {
    window.clearTimeout(addressSuggestionTimer);
  }
  addressSuggestionTimer = window.setTimeout(() => {
    populateAddressSuggestions(value);
  }, 180);
};

const applyAddressSuggestionSelection = (value = '') => {
  const form = getClientForm();
  if (!form) {
    return;
  }

  const typed = String(value || '').trim();
  if (!typed) {
    return;
  }

  const match = addressSuggestionRecords.find((entry) => String(entry.label || '').trim().toLowerCase() === typed.toLowerCase());
  if (match) {
    if (form.address) {
      form.address.value = String(match.street || typed).trim();
    }
    if (form.addressCity && match.city) {
      form.addressCity.value = String(match.city || '').trim();
    }
    if (form.addressState && match.state) {
      form.addressState.value = String(match.state || '').trim().toUpperCase().slice(0, 2);
    }
    if (form.addressZip && match.zip) {
      form.addressZip.value = String(match.zip || '').trim();
    }
    return;
  }

  const parsed = parseCombinedAddress(typed);
  if (form.address && parsed.street) {
    form.address.value = parsed.street;
  }
  if (form.addressCity && parsed.city) {
    form.addressCity.value = parsed.city;
  }
  if (form.addressState && parsed.state) {
    form.addressState.value = parsed.state;
  }
  if (form.addressZip && parsed.zip) {
    form.addressZip.value = parsed.zip;
  }
};

const setHubMode = (mode = 'clients', { preserveAddFormState = false } = {}) => {
  const nextMode = ['home', 'add', 'clients'].includes(mode) ? mode : 'clients';
  state.hubMode = nextMode;

  const switcher = byId('clientHubSwitch');
  if (switcher) {
    const selectedIndex = nextMode === 'home' ? '1' : nextMode === 'add' ? '2' : '3';
    switcher.dataset.selected = selectedIndex;
    switcher.querySelectorAll('[data-hub-mode]').forEach((button) => {
      const isActive = button.dataset.hubMode === nextMode;
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  const layout = byId('crmLayout');
  if (layout) {
    layout.dataset.hubMode = nextMode;
  }

  const panes = {
    home: byId('clientHubHomePane'),
    add: byId('clientHubAddPane'),
    clients: byId('clientHubClientsPane'),
  };
  Object.entries(panes).forEach(([key, pane]) => {
    if (!pane) {
      return;
    }
    pane.hidden = key !== nextMode;
  });

  if (nextMode === 'add') {
    if (!preserveAddFormState) {
      const form = getClientForm();
      if (form) {
        form.reset();
      }
      failClientSaveProgress();
      setClientFormMode('add');
      resetAddClientDerivedState();
      setFormMessage('');
    }
    window.requestAnimationFrame(() => {
      document.querySelector('#clientForm input[name="firstName"]')?.focus();
    });
  }
};

const setClientFormSegment = (segment = 'client') => {
  const form = byId('clientForm');
  const tabs = [...document.querySelectorAll('#clientForm [data-form-segment-tab]')];
  const panels = [...document.querySelectorAll('#clientForm [data-form-segment-panel]')];
  const clientOnlySections = [...document.querySelectorAll('#clientForm .client-only-section')];
  if (!tabs.length || !panels.length) {
    return;
  }
  const nextSegment = ['client', 'ninja', 'affiliate'].includes(segment) ? segment : 'client';
  const showClientOnly = nextSegment === 'client';
  tabs.forEach((tab) => {
    const active = tab.dataset.formSegmentTab === nextSegment;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  panels.forEach((panel) => {
    const active = panel.dataset.formSegmentPanel === nextSegment;
    panel.classList.toggle('is-active', active);
    panel.hidden = !active;
  });
  if (form) {
    form.classList.remove('is-segment-client', 'is-segment-ninja', 'is-segment-affiliate');
    form.classList.add(`is-segment-${nextSegment}`);
  }
  clientOnlySections.forEach((section) => {
    section.hidden = !showClientOnly;
    section.querySelectorAll('input, select, textarea, button').forEach((control) => {
      const shouldKeepEnabled = Boolean(control.id === 'addCustomDocumentButton');
      control.disabled = !showClientOnly && !shouldKeepEnabled;
    });
  });
};

const getSmartCreditIntegrationKey = () => 'smartcredit35540';

const request = async (url, options = {}) => {
  const response = await fetch(`${apiBase}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(payload.error || 'Request failed');
  }

  return response.json();
};

const readHtmlFile = async (file) => {
  if (!file) {
    throw new Error('Please choose an HTML file for Credit Report.');
  }

  return file.text();
};

const readCsvFile = async (file) => {
  if (!file) {
    throw new Error('Please choose a CSV file to import.');
  }

  return file.text();
};

const readImageFileAsDataUrl = async (file) => {
  if (!file) {
    return '';
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read image file.'));
    reader.readAsDataURL(file);
  });
};

const readFileAsDataUrl = async (file) => {
  if (!file) {
    return '';
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read attachment file.'));
    reader.readAsDataURL(file);
  });
};

const normalizeCroppedFileName = (fileName = '') => {
  const base = String(fileName || 'document').replace(/\.[^.]+$/, '').trim() || 'document';
  return `${base}.jpg`;
};

const resizeImageFileToDimensions = async (file, width, height) => {
  if (!file || !width || !height) {
    return file;
  }

  const sourceDataUrl = await readFileAsDataUrl(file);
  if (!sourceDataUrl) {
    return file;
  }

  const image = new Image();
  image.decoding = 'async';
  image.src = sourceDataUrl;
  await image.decode();

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    return file;
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const resizedBlob = await new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob || null), 'image/jpeg', 0.94);
  });
  if (!resizedBlob) {
    return file;
  }

  return new File([resizedBlob], normalizeCroppedFileName(file.name), {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
};

const queueClientSearchRender = () => {
  if (searchRenderTimer) {
    window.clearTimeout(searchRenderTimer);
  }
  searchRenderTimer = window.setTimeout(() => {
    searchRenderTimer = null;
    renderClientsRowsOnly();
  }, 80);
};

const syncNotesPaperHeight = (notesInput, notesPanel) => {
  if (!notesInput) {
    return;
  }
  const panel = notesPanel || notesInput.closest('.client-notes-panel');
  notesInput.style.height = 'auto';
  const minHeight = 170;
  const maxHeight = 430;
  const measured = Number(notesInput.scrollHeight) + 6;
  const nextHeight = Math.max(minHeight, Math.min(maxHeight, measured));
  notesInput.style.height = `${nextHeight}px`;

  if (!panel) {
    return;
  }
  panel.dataset.notesDensity = nextHeight < 215
    ? 'compact'
    : nextHeight > 330
      ? 'expanded'
      : 'standard';
};

const teardownImageCropState = () => {
  if (imageCropVueInstance?.destroyCropper) {
    imageCropVueInstance.destroyCropper();
  }
  if (imageCropActiveObjectUrl) {
    try {
      URL.revokeObjectURL(imageCropActiveObjectUrl);
    } catch (error) {
      // no-op
    }
    imageCropActiveObjectUrl = '';
  }
  if (imageCropVueInstance) {
    imageCropVueInstance.imageSrc = '';
  }
};

const ensureImageCropVue = () => {
  if (imageCropVueInstance) {
    return imageCropVueInstance;
  }

  const root = byId('imageCropVueApp');
  const dialog = byId('imageCropDialog');
  if (!(dialog instanceof HTMLDialogElement) || !root) {
    throw new Error('Crop dialog is not available.');
  }

  if (!window.Vue) {
    throw new Error('Vue 2 runtime is missing for crop dialog.');
  }
  if (!window.Cropper) {
    throw new Error('CropperJS runtime is missing for crop dialog.');
  }

  imageCropVueInstance = new window.Vue({
    el: root,
    data() {
      return {
        imageSrc: '',
        cropper: null,
      };
    },
    methods: {
      initializeCropper() {
        this.destroyCropper();
        const imageEl = this.$refs.cropImage;
        if (!(imageEl instanceof HTMLImageElement)) {
          return;
        }
        this.cropper = new window.Cropper(imageEl, {
          aspectRatio: NaN,
          viewMode: 0,
          dragMode: 'move',
          autoCropArea: 0.92,
          movable: true,
          rotatable: true,
          zoomable: true,
          zoomOnWheel: true,
          cropBoxMovable: true,
          cropBoxResizable: true,
          responsive: true,
          guides: true,
          center: true,
          background: false,
          toggleDragModeOnDblclick: false,
          checkOrientation: false,
          ready: () => {
            if (this.cropper) {
              this.cropper.setDragMode('move');
            }
          },
        });
      },
      destroyCropper() {
        if (this.cropper) {
          this.cropper.destroy();
          this.cropper = null;
        }
      },
      setSource(source) {
        this.destroyCropper();
        this.imageSrc = source;
        this.$nextTick(() => {
          this.initializeCropper();
        });
      },
      rotate(degrees) {
        if (!this.cropper) return;
        this.cropper.rotate(Number(degrees) || 0);
      },
      moveImageBy(dx, dy) {
        if (!this.cropper) return;
        this.cropper.move(Number(dx) || 0, Number(dy) || 0);
      },
      nudgeEdge(edge, deltaPx) {
        if (!this.cropper) return;
        const delta = Number(deltaPx) || 0;
        if (!delta) return;

        const crop = this.cropper.getCropBoxData();
        const canvas = this.cropper.getCanvasData();
        if (!crop || !canvas) return;

        const minSize = 40;
        const next = {
          left: crop.left,
          top: crop.top,
          width: crop.width,
          height: crop.height,
        };

        const canvasLeft = Number(canvas.left) || 0;
        const canvasTop = Number(canvas.top) || 0;
        const canvasRight = canvasLeft + (Number(canvas.width) || 0);
        const canvasBottom = canvasTop + (Number(canvas.height) || 0);

        if (edge === 'top') {
          const maxTop = (next.top + next.height) - minSize;
          const unclampedTop = next.top + delta;
          const clampedTop = Math.min(Math.max(unclampedTop, canvasTop), maxTop);
          next.height -= (clampedTop - next.top);
          next.top = clampedTop;
        } else if (edge === 'right') {
          const currentRight = next.left + next.width;
          const minRight = next.left + minSize;
          const unclampedRight = currentRight + delta;
          const clampedRight = Math.max(Math.min(unclampedRight, canvasRight), minRight);
          next.width = clampedRight - next.left;
        } else if (edge === 'bottom') {
          const currentBottom = next.top + next.height;
          const minBottom = next.top + minSize;
          const unclampedBottom = currentBottom + delta;
          const clampedBottom = Math.max(Math.min(unclampedBottom, canvasBottom), minBottom);
          next.height = clampedBottom - next.top;
        } else if (edge === 'left') {
          const maxLeft = (next.left + next.width) - minSize;
          const unclampedLeft = next.left + delta;
          const clampedLeft = Math.min(Math.max(unclampedLeft, canvasLeft), maxLeft);
          next.width -= (clampedLeft - next.left);
          next.left = clampedLeft;
        }

        next.width = Math.max(minSize, next.width);
        next.height = Math.max(minSize, next.height);

        this.cropper.setCropBoxData(next);
      },
      resetCrop() {
        if (!this.cropper) return;
        this.cropper.reset();
      },
      emitCancel() {
        if (typeof imageCropResolve === 'function') {
          imageCropResolve(null);
        }
      },
      emitSave() {
        if (!this.cropper) {
          if (typeof imageCropResolve === 'function') {
            imageCropResolve(null);
          }
          return;
        }
        try {
          const canvas = this.cropper.getCroppedCanvas({
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
          });
          if (!canvas) {
            if (typeof imageCropResolve === 'function') {
              imageCropResolve(null);
            }
            return;
          }
          canvas.toBlob((blob) => {
            if (!blob) {
              if (typeof imageCropResolve === 'function') {
                imageCropResolve(null);
              }
              return;
            }
            if (typeof imageCropResolve === 'function') {
              imageCropResolve(blob);
            }
          }, 'image/jpeg', 0.95);
        } catch (error) {
          if (typeof imageCropReject === 'function') {
            imageCropReject(error instanceof Error ? error : new Error('Unable to crop image.'));
          }
        }
      },
    },
  });

  return imageCropVueInstance;
};

const openImageCropDialog = async (file) => {
  if (!file || !String(file.type || '').toLowerCase().startsWith('image/')) {
    return file;
  }

  const dialog = byId('imageCropDialog');
  if (!(dialog instanceof HTMLDialogElement)) {
    return file;
  }

  const cropVue = ensureImageCropVue();
  teardownImageCropState();
  imageCropActiveObjectUrl = URL.createObjectURL(file);
  cropVue.setSource(imageCropActiveObjectUrl);

  return new Promise((resolve, reject) => {
    const onDialogCancel = (event) => {
      event.preventDefault();
      if (typeof imageCropResolve === 'function') {
        imageCropResolve(null);
      }
    };

    imageCropResolve = async (blobOrNull) => {
      imageCropResolve = null;
      imageCropReject = null;
      dialog.removeEventListener('cancel', onDialogCancel);
      if (dialog.open) {
        dialog.close();
      }

      if (!blobOrNull) {
        teardownImageCropState();
        resolve(null);
        return;
      }

      try {
        const croppedFile = new File([blobOrNull], normalizeCroppedFileName(file.name), {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        const resizedAfterSave = await resizeImageFileToDimensions(
          croppedFile,
          documentImageCropWidth,
          documentImageCropHeight,
        );
        teardownImageCropState();
        resolve(resizedAfterSave);
      } catch (error) {
        teardownImageCropState();
        reject(error instanceof Error ? error : new Error('Unable to process cropped image.'));
      }
    };

    imageCropReject = (error) => {
      imageCropResolve = null;
      imageCropReject = null;
      dialog.removeEventListener('cancel', onDialogCancel);
      if (dialog.open) {
        dialog.close();
      }
      teardownImageCropState();
      reject(error instanceof Error ? error : new Error('Unable to crop image.'));
    };

    dialog.addEventListener('cancel', onDialogCancel);

    if (!dialog.open) {
      dialog.showModal();
    }
  });
};

const parseCsvText = (text) => {
  const rows = [];
  let currentRow = [];
  let currentValue = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = '';
      continue;
    }

    currentValue += char;
  }

  if (currentValue || currentRow.length) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map((value) => String(value || '').trim());
  return rows.slice(1)
    .filter((row) => row.some((value) => String(value || '').trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, String(row[index] || '').trim()])));
};

const mapCsvRowsToClients = (rows) => rows.map((row) => ({
  firstName: row.First || '',
  lastName: row.Last || '',
  status: row.Status || 'Client',
  phone: row.Phone || '',
  email: row.Email || '',
  pid: row.PID || row.Pid || row.pid || '',
  reportDate: row['Report Date'] || '',
  nextImportInt: row['Next Import Int'] || '',
  nextImportLabel: row['Next Import'] || '',
})).filter((row) => row.firstName && row.lastName);

const formatPhoneNumber = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  const normalized = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;

  if (normalized.length !== 10) {
    return String(value || '');
  }

  return `(${normalized.slice(0, 3)})${normalized.slice(3, 6)}-${normalized.slice(6)}`;
};

const parseDateValue = (value) => {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }

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

  const parsedTimestamp = Date.parse(text);
  if (!Number.isNaN(parsedTimestamp)) {
    const date = new Date(parsedTimestamp);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
};

const toLocalDateOnly = (dateValue) => new Date(
  dateValue.getFullYear(),
  dateValue.getMonth(),
  dateValue.getDate(),
);

const getCalendarDayDiff = (fromDate, toDate) => {
  const start = toLocalDateOnly(fromDate);
  const end = toLocalDateOnly(toDate);
  const msPerDay = 24 * 60 * 60 * 1000;
  const utcStart = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const utcEnd = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((utcEnd - utcStart) / msPerDay);
};

const parseDisputeDueDays = (value) => {
  const match = String(value || '').match(/-?\d+/);
  const numeric = Number.parseInt(match?.[0] || '', 10);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 35;
  }
  return numeric;
};

const buildNextImportFromDisputeDueDate = (reportDate, dueDays) => {
  const parsed = parseDateValue(reportDate);
  if (!parsed) {
    return {
      reportDate: '',
      nextImportDate: null,
      reportAgeDays: null,
      daysUntilNextImport: null,
      label: '',
    };
  }

  const now = new Date();
  const reportAgeDays = Math.max(0, getCalendarDayDiff(parsed, now));
  const daysUntilNextImport = dueDays - reportAgeDays;
  const nextImportDateValue = toLocalDateOnly(parsed);
  nextImportDateValue.setDate(nextImportDateValue.getDate() + dueDays);

  return {
    reportDate,
    nextImportDate: nextImportDateValue.toISOString(),
    reportAgeDays,
    daysUntilNextImport,
    label: `${daysUntilNextImport} day${Math.abs(daysUntilNextImport) === 1 ? '' : 's'}`,
  };
};

const applyDisputeDueDateCountdownToClients = (clients = []) => {
  // Server is authoritative for next-import countdown mode:
  // - manual mode (csv/manual set)
  // - refresh-success mode (successful fresh import)
  void clients;
};

const parseMoneyValue = (value) => {
  const numeric = Number.parseFloat(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
};

const isMissingOrZeroCreditLimit = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '--' || /^n\/?a$/i.test(raw)) {
    return true;
  }
  return parseMoneyValue(raw) <= 0;
};

const hasPositiveCreditLimit = (value) => parseMoneyValue(value) > 0;

const accountHasAnyPositiveCreditLimit = (account) => {
  if (!account) {
    return false;
  }

  if (hasPositiveCreditLimit(account.creditLimit)) {
    return true;
  }

  return ['transunion', 'experian', 'equifax']
    .some((bureau) => hasPositiveCreditLimit(account.creditLimitByBureau?.[bureau]));
};

const isChargeCardNoLimitForBureau = (account, bureau) => {
  if (!account || !bureau || !isCreditCardType(account)) {
    return false;
  }
  return isMissingOrZeroCreditLimit(account.creditLimitByBureau?.[bureau]);
};

const isChargeCardNoLimitAccount = (account) => {
  if (!account || !isCreditCardType(account)) {
    return false;
  }
  if (accountHasAnyPositiveCreditLimit(account)) {
    return false;
  }

  const reportedBureaus = ['transunion', 'experian', 'equifax']
    .filter((bureau) => Boolean(account?.bureaus?.[bureau]));

  if (reportedBureaus.length > 0) {
    return reportedBureaus.every((bureau) => isChargeCardNoLimitForBureau(account, bureau));
  }

  return isMissingOrZeroCreditLimit(account.creditLimit);
};

const formatMoneyDisplay = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '--') {
    return '--';
  }
  const amount = parseMoneyValue(raw);
  const isNegative = amount < 0;
  const abs = Math.abs(amount);
  return `${isNegative ? '-' : ''}$${abs.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
};

const isClosedAccount = (account) => String(account?.status || '').toLowerCase().includes('closed');

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

const getAccountVisualType = (account) => {
  const detail = String(account.accountTypeDetail || '').toLowerCase();
  const type = String(account.accountType || '').toLowerCase();
  const name = String(account.name || account.creditorName || '').toLowerCase();
  const creditor = String(account.creditorName || '').toLowerCase();
  const originalCreditor = String(account.originalCreditor || '').toLowerCase();
  const combined = `${detail} ${type}`.trim();
  const detectionText = `${name} ${creditor} ${originalCreditor} ${detail} ${type}`.toLowerCase();
  const normalizedDetectionText = detectionText.replace(/[^a-z0-9]/g, '');

  if (
    detectionText.includes('idiq power')
    || normalizedDetectionText.includes('idiqpower')
    || detail.includes('cellular')
    || detail.includes('utility')
    || detail.includes('utlity')
    || type.includes('cellular')
    || type.includes('utility')
    || type.includes('utlity')
    || detectionText.includes('utility company')
    || detectionText.includes('utlity company')
    ||
    detectionText.includes('bilt rentpmt')
    || detectionText.includes('bilt rent')
    || normalizedDetectionText.includes('biltrentpmt')
    || normalizedDetectionText.includes('biltrent')
    || detectionText.includes('telecom')
    || normalizedDetectionText.includes('telecom')
    || detectionText.includes('selfreported')
    || detectionText.includes('self reported')
    || detectionText.includes('self report')
    || detectionText.includes('selfrent')
    || normalizedDetectionText.includes('selfreported')
    || normalizedDetectionText.includes('selfreport')
    || normalizedDetectionText.includes('selfrent')
  ) {
    return {
      key: 'reported-account',
      label: 'Reported Account',
      iconPath: '/assets/account-types/reported.png',
      isSelfReported: true,
    };
  }

  if (isCreditCardType(account) || combined.includes('revolving') || combined.includes('charge account')) {
    return {
      key: 'credit-card',
      label: 'Credit Card',
      iconPath: '/assets/account-types/credit-cards.svg',
    };
  }

  if (combined.includes('business') || combined.includes('commercial')) {
    return {
      key: 'business-loan',
      label: 'Business Loan',
      iconPath: '/assets/account-types/business-loans.svg',
    };
  }

  if (combined.includes('education') || combined.includes('student')) {
    return {
      key: 'student-loan',
      label: 'Student Loan',
      iconPath: '/assets/account-types/student-loans.svg',
    };
  }

  if (combined.includes('mortgage') || combined.includes('home loan') || combined.includes('real estate')) {
    return {
      key: 'home-loan',
      label: 'Home Loan',
      iconPath: '/assets/account-types/home-loans.svg',
    };
  }

  if (combined.includes('auto') || combined.includes('vehicle') || combined.includes('motor')) {
    return {
      key: 'auto-loan',
      label: 'Auto Loan',
      iconPath: '/assets/account-types/auto-loans.svg',
    };
  }

  if (isInstallmentType(account) || combined.includes('personal')) {
    return {
      key: 'personal-loan',
      label: 'Personal Loan',
      iconPath: '/assets/account-types/personal-loans.svg',
    };
  }

  return null;
};

const formatCreditorAddressLines = (value) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return {
      line1: 'Address unavailable',
      line2: '',
    };
  }

  const cityStateZipMatch = text.match(/^(.*?)([A-Z][A-Z\s.'-]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i)
    || text.match(/^(.*?)([A-Z][A-Z\s.'-]+)\s*,\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i)
    || text.match(/^(.*?)([A-Z][A-Z\s.'-]+)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);

  if (!cityStateZipMatch) {
    return {
      line1: text,
      line2: '',
    };
  }

  const line1 = String(cityStateZipMatch[1] || '').trim().replace(/,$/, '').trim();
  const city = String(cityStateZipMatch[2] || '').trim().replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ');
  const state = String(cityStateZipMatch[3] || '').trim().toUpperCase();
  const zip = String(cityStateZipMatch[4] || '').trim();

  return {
    line1: line1 || text,
    line2: `${city}, ${state} ${zip}`.trim(),
  };
};

const getMeaningfulAccountTypeValue = (value) => {
  const text = String(value || '').trim();
  return text && text !== '-' && text !== '--' ? text : '';
};

const getAccountTypeDisplay = (account) => {
  const detail = getMeaningfulAccountTypeValue(account.accountTypeDetail);
  const type = getMeaningfulAccountTypeValue(account.accountType);
  const visual = getAccountVisualType(account);

  if (detail) {
    return detail;
  }

  if (visual && type.toLowerCase() === 'revolving') {
    return visual.label;
  }

  return type || visual?.label || '--';
};

const formatUtilization = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '--';
  }

  return `${(Math.ceil(value * 10) / 10).toFixed(1)}%`;
};

const formatAgeOfCredit = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '--';
  }

  return `${value.toFixed(2)} years`;
};

const formatOnTimePayments = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '--';
  }

  return `${Math.round(value)}%`;
};

const getElapsedYearsFromDate = (value) => {
  const parsed = parseDateValue(value);
  if (!parsed) {
    return null;
  }

  const now = new Date();
  const diffMs = now.getTime() - parsed.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return 0;
  }

  return diffMs / (365.25 * 24 * 60 * 60 * 1000);
};

const formatLastPaymentBadge = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 1) {
    return '';
  }

  return `Date of Last Payment ${value.toFixed(1)} yrs`;
};

const formatCurrency = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '--';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const normalizeAffiliateRow = (row = {}, fallback = {}) => ({
  id: String(row.id || fallback.id || `affiliate-${Math.random().toString(36).slice(2, 10)}`),
  name: String(row.name ?? fallback.name ?? '').trim(),
  description: String(row.description ?? fallback.description ?? '').trim(),
  url: String(row.url || '').trim(),
  imagePath: String(row.imagePath || fallback.imagePath || '').trim(),
  show: Boolean(row.show),
  isDefault: Boolean(row.isDefault),
});

const normalizeAffiliateLinksPayload = (payload = {}) => {
  const monitoringRows = affiliateMonitoringOrder.map((id) => {
    const fallback = affiliateMonitoringFallbacks[id];
    const source = Array.isArray(payload.creditMonitoring)
      ? payload.creditMonitoring.find((row) => String(row?.id || '').toLowerCase() === id)
      : null;
    return normalizeAffiliateRow(source || {}, fallback);
  });

  return {
    creditBuilder: Array.isArray(payload.creditBuilder)
      ? payload.creditBuilder.map((row) => normalizeAffiliateRow(row))
      : [],
    creditMonitoring: monitoringRows,
  };
};

const formatOnTimeBadge = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '';
  }

  return `On Time ${Math.round(value)}%`;
};

const clampPercent = (value) => Math.max(0, Math.min(100, value));

const getPercentTone = (value, direction = 'higher-is-better') => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '';
  }

  const clamped = clampPercent(direction === 'lower-is-better' ? 100 - value : value);
  const hue = Math.round((clamped / 100) * 120);
  return `--pill-bg: hsla(${hue}, 82%, 88%, 0.96); --pill-border: hsla(${hue}, 72%, 46%, 0.26); --pill-fg: hsl(${hue}, 72%, 24%);`;
};

const getAccountReferenceValue = (account) => {
  const highBalanceAmount = parseMoneyValue(account.highBalance);
  const highCreditAmount = parseMoneyValue(account.highCredit);
  const creditLimitAmount = parseMoneyValue(account.creditLimit);

  if (!isInstallmentType(account)) {
    if (creditLimitAmount > 0) {
      return {
        label: 'Credit Limit',
        value: formatMoneyDisplay(account.creditLimit),
        referenceAmount: creditLimitAmount,
        percent: (parseMoneyValue(account.balance) / creditLimitAmount) * 100,
        badgeLabel: 'Usage',
        badgeDirection: 'lower-is-better',
      };
    }

    if (highBalanceAmount > 0) {
      return {
        label: 'High Balance',
        value: formatMoneyDisplay(account.highBalance),
        referenceAmount: highBalanceAmount,
        percent: (parseMoneyValue(account.balance) / highBalanceAmount) * 100,
        badgeLabel: 'Usage',
        badgeDirection: 'lower-is-better',
      };
    }

    if (highCreditAmount > 0) {
      return {
        label: 'High Credit',
        value: formatMoneyDisplay(account.highCredit),
        referenceAmount: highCreditAmount,
        percent: (parseMoneyValue(account.balance) / highCreditAmount) * 100,
        badgeLabel: 'Usage',
        badgeDirection: 'lower-is-better',
      };
    }

    return {
      label: 'Credit Limit',
      value: formatMoneyDisplay(account.creditLimit),
      referenceAmount: 0,
      percent: null,
      badgeLabel: 'Usage',
      badgeDirection: 'lower-is-better',
    };
  }

  if (highBalanceAmount > 0) {
    const remainingPercent = (parseMoneyValue(account.balance) / highBalanceAmount) * 100;
    return {
      label: 'High Balance',
      value: formatMoneyDisplay(account.highBalance),
      referenceAmount: highBalanceAmount,
      percent: clampPercent(remainingPercent),
      badgeLabel: 'Remaining',
      badgeDirection: 'lower-is-better',
    };
  }

  if (highCreditAmount > 0) {
    const remainingPercent = (parseMoneyValue(account.balance) / highCreditAmount) * 100;
    return {
      label: 'High Credit',
      value: formatMoneyDisplay(account.highCredit),
      referenceAmount: highCreditAmount,
      percent: clampPercent(remainingPercent),
      badgeLabel: 'Remaining',
      badgeDirection: 'lower-is-better',
    };
  }

  return {
    label: 'High Credit',
    value: '--',
    referenceAmount: 0,
    percent: null,
    badgeLabel: 'Remaining',
    badgeDirection: 'lower-is-better',
  };
};

const getAccountAgeYears = (account) => {
  const date = parseDateValue(account.dateOpened);
  if (!date) {
    return null;
  }

  const years = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return Number.isFinite(years) ? years : null;
};

const formatYearsBadge = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '';
  }

  return `${value.toFixed(2)} yrs`;
};

const formatPercentBadge = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '';
  }

  return `${value.toFixed(1)}%`;
};

const formatReferenceBadge = (reference) => {
  const percentText = formatPercentBadge(reference.percent);
  if (!percentText) {
    return '';
  }

  return `${percentText} ${reference.badgeLabel || ''}`.trim();
};

const accountCategoryDefinitions = [
  { key: 'revolving', label: 'Revolving' },
  { key: 'miscInstallment', label: 'Misc Installment' },
  { key: 'autoInstallment', label: 'Auto Installment' },
  { key: 'mortgage', label: 'Mortgage' },
  { key: 'recreationalMerchandise', label: 'Recreational Merchandise' },
  { key: 'education', label: 'Education' },
];

const accountFilterDefinitions = [
  { key: 'all', label: 'All Accounts' },
  ...accountCategoryDefinitions,
];

const getCategoryVisual = (categoryKey) => {
  const visualMap = {
    revolving: {
      label: 'Credit Card',
      iconPath: '/assets/account-types/credit-cards.svg',
    },
    miscInstallment: {
      label: 'Personal Loan',
      iconPath: '/assets/account-types/personal-loans.svg',
    },
    autoInstallment: {
      label: 'Auto Loan',
      iconPath: '/assets/account-types/auto-loans.svg',
    },
    mortgage: {
      label: 'Home Loan',
      iconPath: '/assets/account-types/home-loans.svg',
    },
    recreationalMerchandise: {
      label: 'Business Loan',
      iconPath: '/assets/account-types/business-loans.svg',
    },
    education: {
      label: 'Student Loan',
      iconPath: '/assets/account-types/student-loans.svg',
    },
  };

  return visualMap[categoryKey] || null;
};

const classifyAccountCategory = (account) => {
  const accountType = String(account.accountType || '').toLowerCase();
  const detail = String(account.accountTypeDetail || '').toLowerCase();
  const combined = `${detail} ${accountType}`.trim();

  if (accountType.includes('revolving') || isCreditCardType(account)) {
    return 'revolving';
  }

  if (combined.includes('mortgage')) {
    return 'mortgage';
  }

  if (combined.includes('education') || combined.includes('student')) {
    return 'education';
  }

  if (combined.includes('recreational merchandise')) {
    return 'recreationalMerchandise';
  }

  if (combined.includes('auto')) {
    return 'autoInstallment';
  }

  if (isInstallmentType(account)) {
    return 'miscInstallment';
  }

  return '';
};

const buildAccountCategoryCounts = (accounts) => {
  const counts = Object.fromEntries(accountCategoryDefinitions.map((item) => [item.key, 0]));

  accounts.forEach((account) => {
    const category = classifyAccountCategory(account);
    if (category) {
      counts[category] += 1;
    }
  });

  return counts;
};

const getCreditMixSummary = (accounts, categoryCounts) => {
  const totalAccounts = accounts.length;
  const distinctTypes = accountCategoryDefinitions.filter((item) => (categoryCounts[item.key] || 0) > 0).length;
  const revolvingCount = categoryCounts.revolving || 0;
  const installmentCount = [
    categoryCounts.miscInstallment || 0,
    categoryCounts.autoInstallment || 0,
    categoryCounts.mortgage || 0,
    categoryCounts.recreationalMerchandise || 0,
    categoryCounts.education || 0,
  ].reduce((sum, value) => sum + value, 0);
  const hasRevolving = revolvingCount > 0;
  const hasInstallment = installmentCount > 0;

  if (totalAccounts === 0) {
    return {
      label: 'Very Low / None',
      points: 0,
      distinctTypes,
      totalAccounts,
    };
  }

  if (!hasRevolving || !hasInstallment) {
    const points = distinctTypes >= 2 && totalAccounts >= 3 ? 18 : 10;
    return {
      label: points >= 18 ? 'Partial Mixture' : 'Very Low / None',
      points,
      distinctTypes,
      totalAccounts,
    };
  }

  if (distinctTypes <= 2 || totalAccounts < 4) {
    return {
      label: 'Partial Mixture',
      points: 24,
      distinctTypes,
      totalAccounts,
    };
  }

  if (distinctTypes === 3 || totalAccounts < 6 || revolvingCount < 3) {
    return {
      label: 'Solid Mixture',
      points: Math.min(38, 34 + Math.max(0, totalAccounts - 4)),
      distinctTypes,
      totalAccounts,
    };
  }

  return {
    label: 'Maximum Mixture',
    points: 45,
    distinctTypes,
    totalAccounts,
  };
};

const getPaymentHistorySummary = (bureauOnTimePayments = {}) => {
  const values = [
    bureauOnTimePayments.transunion?.onTimePercent,
    bureauOnTimePayments.experian?.onTimePercent,
    bureauOnTimePayments.equifax?.onTimePercent,
  ].filter((value) => typeof value === 'number' && Number.isFinite(value));

  if (!values.length) {
    return {
      label: 'No History',
      points: 0,
      averagePercent: null,
    };
  }

  const averagePercent = values.reduce((sum, value) => sum + value, 0) / values.length;
  const points = Math.round((averagePercent / 100) * 157);

  if (averagePercent >= 99.95) {
    return { label: 'Exceptional', points: 157, averagePercent };
  }

  if (averagePercent >= 98) {
    return { label: 'Strong', points, averagePercent };
  }

  if (averagePercent >= 95) {
    return { label: 'Good', points, averagePercent };
  }

  if (averagePercent >= 90) {
    return { label: 'Fair', points, averagePercent };
  }

  return { label: 'Needs Work', points, averagePercent };
};

const clientSearchFields = (client) => {
  const first = String(client.firstName || '').trim();
  const last = String(client.lastName || '').trim();
  const full = `${first} ${last}`.trim();
  const reverseFull = `${last} ${first}`.trim();
  const username = String(client.monitoringUsername || client.username || '').trim();
  const email = String(client.email || '').trim();
  const phone = String(client.phone || '').trim();
  const phoneDigits = digitsOnly(phone);
  const fullNoSpace = `${first}${last}`.trim();
  const reverseNoSpace = `${last}${first}`.trim();
  return [
    first,
    last,
    full,
    reverseFull,
    fullNoSpace,
    reverseNoSpace,
    email,
    phone,
    phoneDigits,
    client.ssn,
    username,
  ];
};

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');
const normalizeClientSearchValue = (value) => String(value || '')
  .trim()
  .replace(/[|,;]+$/g, '')
  .trim()
  .toLowerCase();
const shouldApplyClientSearch = (queryValue) => {
  const normalizedQuery = normalizeClientSearchValue(queryValue);
  if (!normalizedQuery) {
    return false;
  }
  const queryDigits = digitsOnly(normalizedQuery);
  return normalizedQuery.length >= 3 || queryDigits.length >= 3;
};

const clearPinnedClientList = () => {
  state.pinnedClientId = '';
};

const getExactClientIdMatches = (queryValue, clients) => {
  const normalizedQuery = normalizeClientSearchValue(queryValue);
  if (!normalizedQuery) {
    return null;
  }
  const queryDigits = digitsOnly(normalizedQuery);
  const exactMatches = new Set();
  clients.forEach((client) => {
    const normalizedEmail = normalizeClientSearchValue(client.email);
    const normalizedUsername = normalizeClientSearchValue(client.monitoringUsername);
    const normalizedPhoneDigits = digitsOnly(client.phone);
    const normalizedSsnDigits = digitsOnly(client.ssn);
    if (
      (normalizedEmail && normalizedEmail === normalizedQuery)
      || (normalizedUsername && normalizedUsername === normalizedQuery)
      || (queryDigits && normalizedPhoneDigits && normalizedPhoneDigits === queryDigits)
      || (queryDigits && normalizedSsnDigits && normalizedSsnDigits === queryDigits)
    ) {
      exactMatches.add(client.id);
    }
  });
  return exactMatches.size ? exactMatches : null;
};

const sortDefinitions = [
  { key: 'firstName', label: 'First' },
  { key: 'lastName', label: 'Last' },
  { key: 'status', label: 'Status' },
  { key: 'phase', label: 'Phase' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
];

const getSortIndicator = (key) => {
  if (state.sortKey !== key) {
    return '↑↓';
  }

  return state.sortDirection === 'asc' ? '↑' : '↓';
};

const sortClients = (clients) => {
  const direction = state.sortDirection === 'asc' ? 1 : -1;
  const key = state.sortKey;

  return [...clients].sort((left, right) => {
    if (key === 'nextImport') {
      const leftValue = left.nextImport?.daysUntilNextImport;
      const rightValue = right.nextImport?.daysUntilNextImport;
      const safeLeft = Number.isFinite(leftValue) ? leftValue : Number.MAX_SAFE_INTEGER;
      const safeRight = Number.isFinite(rightValue) ? rightValue : Number.MAX_SAFE_INTEGER;
      return (safeLeft - safeRight) * direction;
    }

    if (key === 'reportDate') {
      const leftDate = parseDateValue(left.reportDate);
      const rightDate = parseDateValue(right.reportDate);
      const safeLeft = leftDate ? leftDate.getTime() : Number.MAX_SAFE_INTEGER;
      const safeRight = rightDate ? rightDate.getTime() : Number.MAX_SAFE_INTEGER;
      return (safeLeft - safeRight) * direction;
    }

    const leftValue = String(left[key] || '').toLowerCase();
    const rightValue = String(right[key] || '').toLowerCase();
    return leftValue.localeCompare(rightValue) * direction;
  });
};

const toggleSort = (key) => {
  if (state.sortKey === key) {
    state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    state.sortKey = key;
    state.sortDirection = 'asc';
  }

  renderClients();
};

const formatNextImport = (nextImport) => {
  const days = nextImport?.daysUntilNextImport;
  if (!Number.isFinite(days)) {
    return '--';
  }

  return `${days} day${Math.abs(days) === 1 ? '' : 's'}`;
};

const renderNextImportCell = (nextImport) => {
  const days = nextImport?.daysUntilNextImport;
  if (!Number.isFinite(days)) {
    return '--';
  }

  const classes = ['next-import-pill'];
  if (days < 0) {
    classes.push(days >= -4 ? 'is-warning-overdue' : 'is-overdue');
  } else if (days === 0) {
    classes.push('is-due');
  }

  return `<button class="${classes.join(' ')} next-import-edit-button" type="button" data-action="next-import" data-next-import-days="${days}" aria-label="Edit next import days">${formatNextImport(nextImport)}</button>`;
};

const formatReportDateCell = (reportDate) => {
  const parsed = parseDateValue(reportDate);
  if (!parsed) {
    return '--';
  }
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getReportAgeSummary = (reportDate) => {
  const parsed = parseDateValue(reportDate);
  if (!parsed) {
    return {
      dateLabel: 'No report date',
      ageLabel: 'No last report yet',
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - parsed.getTime();
  const diffDays = Math.max(0, Math.round(diffMs / 86400000));

  return {
    dateLabel: reportDate,
    ageLabel: `${diffDays} day${diffDays === 1 ? '' : 's'} since last report`,
  };
};

const normalizeMonitoringAgency = (value) => String(value || '').trim().toLowerCase();

const getMonitoringLinkStatus = (client, agency) => {
  const normalizedAgency = normalizeMonitoringAgency(agency);
  if (!normalizedAgency) {
    return { visible: false, linked: false, text: '' };
  }

  const reportSyncHealthy = client.lastReportRunStatus !== 'failed';
  if (normalizedAgency.includes('identity')) {
    const hasLoginCreds = Boolean(String(client.monitoringUsername || '').trim() && String(client.monitoringPassword || '').trim());
    const linked = Boolean(hasLoginCreds && reportSyncHealthy);
    return {
      visible: true,
      linked,
      text: linked ? 'Linked' : 'Unlinked',
    };
  }

  if (normalizedAgency.includes('myscore')) {
    const tokenValue = String(client.monitoringToken || '').trim();
    const linked = Boolean(tokenValue && reportSyncHealthy);
    return {
      visible: true,
      linked,
      text: linked ? 'Linked' : 'Unlinked',
    };
  }

  const integrationKey = normalizedAgency.includes('smart')
    ? getSmartCreditIntegrationKey()
    : normalizedAgency.includes('myfree')
      ? 'myfreescorenow'
      : '';
  if (!integrationKey) {
    return { visible: false, linked: false, text: '' };
  }

  const integration = state.integrations[integrationKey] || {};
  const tokenValue = String(client.monitoringToken || '').trim();
  const credsReady = Boolean(String(integration.tokenId || '').trim() && String(integration.apiSecret || '').trim());
  const linked = Boolean(tokenValue && credsReady && reportSyncHealthy);

  return {
    visible: true,
    linked,
    text: linked ? 'Linked' : 'Unlinked',
  };
};

const getMonitoringServiceMeta = (client) => {
  const agency = normalizeMonitoringAgency(client.monitoringAgency);
  const source = normalizeMonitoringAgency(client.creditReportSource);
  const combined = `${agency} ${source}`;

  if (combined.includes('identity')) {
    return { key: 'identityiq', label: 'IdentityIQ' };
  }
  if (combined.includes('smart')) {
    return { key: 'smartcredit', label: 'SmartCredit' };
  }
  if (combined.includes('myscore')) {
    return { key: 'myscoreiq', label: 'MyScoreIQ' };
  }
  if (combined.includes('myfree') || combined.includes('mfsn')) {
    return { key: 'myfreescorenow', label: 'MyFreeScoreNow' };
  }

  return { key: 'report', label: 'Credit Report' };
};

const monitoringAgencyOptions = [
  { value: 'IdentityIQ', key: 'identityiq', label: 'IdentityIQ' },
  { value: 'MyFreeScoreNow', key: 'myfreescorenow', label: 'MyFreeScoreNow' },
  { value: 'SmartCredit', key: 'smartcredit', label: 'SmartCredit' },
  { value: 'MyScoreIQ', key: 'myscoreiq', label: 'MyScoreIQ' },
];

const renderMonitoringBadge = (client) => {
  const service = getMonitoringServiceMeta(client);
  return `
    <a class="client-table-report monitoring-badge monitoring-${service.key}" href="/api/clients/${client.id}/report" target="_blank" rel="noreferrer" title="${service.label}">
      <span>${service.label}</span>
    </a>
  `;
};

const getDtiScalePosition = (percent) => {
  if (typeof percent !== 'number' || !Number.isFinite(percent)) {
    return null;
  }

  const clamped = Math.max(0, Math.min(percent, 60));
  return (clamped / 60) * 100;
};

const parseNumericValue = (value) => {
  const numeric = Number.parseFloat(String(value || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
};

const formatIncomeValue = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '';
  }

  return Math.round(value).toString();
};

const calculateDtiSummary = (client) => {
  return calculateDtiSummaryWithPaydown(client, 0);
};

const inferDebtMonthlyPaymentsFromAccounts = (client = {}) => {
  const openAccounts = Array.isArray(client.openAccounts) ? client.openAccounts : [];
  return openAccounts.reduce((sum, account) => {
    const monthly = parseMoneyValue(account.monthlyPayment);
    return Number.isFinite(monthly) && monthly > 0 ? sum + monthly : sum;
  }, 0);
};

const inferHousingPaymentFromAccounts = (client = {}) => {
  const openAccounts = Array.isArray(client.openAccounts) ? client.openAccounts : [];
  return openAccounts.reduce((sum, account) => {
    const typeLabel = `${String(account.accountType || '').toLowerCase()} ${String(account.accountTypeDetail || '').toLowerCase()}`;
    if (!/mortgage|real estate|home loan|fha/.test(typeLabel)) {
      return sum;
    }
    const monthly = parseMoneyValue(account.monthlyPayment);
    return Number.isFinite(monthly) && monthly > 0 ? sum + monthly : sum;
  }, 0);
};

const getDebtCategoryLabel = (account = {}) => {
  // Use report-native account type labels for Total Debt categories.
  // Keep only light normalization for readability.
  const preferred = String(account.accountTypeDetail || '').trim();
  const fallbackType = String(account.accountType || '').trim();
  const raw = preferred || fallbackType;
  if (!raw) {
    return 'Uncategorized';
  }

  const normalized = raw.toLowerCase();
  if (isChargeCardNoLimitAccount(account)) {
    return 'Charge Card';
  }
  if (isCreditCardType(account) || normalized.includes('charge account')) {
    return 'Credit Card';
  }
  if (normalized.includes('mortgage')) {
    return 'Mortgage';
  }
  if (normalized.includes('educat') || normalized.includes('student')) {
    return 'Education Loans';
  }

  return raw;
};

const calculateDtiSummaryWithPaydown = (client, paydownPercent = 0) => {
  const yearlyIncome = parseNumericValue(client.yearlyIncome);
  const housingPayment = parseNumericValue(client.housingPayment) || 0;
  const debtMonthlyPayments = parseNumericValue(client.debtMonthlyPayments) || 0;
  const openAccounts = Array.isArray(client.openAccounts) ? client.openAccounts : [];
  const bureauDebtValues = [
    client.bureauTotalDebt?.transunion?.totalDebt,
    client.bureauTotalDebt?.experian?.totalDebt,
    client.bureauTotalDebt?.equifax?.totalDebt,
  ].filter((value) => typeof value === 'number' && Number.isFinite(value));
  const averageTotalDebt = bureauDebtValues.length
    ? bureauDebtValues.reduce((sum, value) => sum + value, 0) / bureauDebtValues.length
    : 0;
  const bureauCategoryTotals = new Map();
  openAccounts.forEach((account) => {
    const label = getDebtCategoryLabel(account);
    if (!bureauCategoryTotals.has(label)) {
      bureauCategoryTotals.set(label, {
        label,
        isCreditCard: isCreditCardType(account) && !isChargeCardNoLimitAccount(account),
        transunion: 0,
        experian: 0,
        equifax: 0,
      });
    }

    const row = bureauCategoryTotals.get(label);
    row.isCreditCard = row.isCreditCard || (isCreditCardType(account) && !isChargeCardNoLimitAccount(account));

    ['transunion', 'experian', 'equifax'].forEach((bureau) => {
      const balance = parseMoneyValue(account.balanceByBureau?.[bureau]);
      if (Number.isFinite(balance) && balance > 0) {
        row[bureau] += balance;
      }
    });
  });

  const debtTypeRows = [...bureauCategoryTotals.values()]
    .map((row) => ({
      label: row.label,
      isCreditCard: row.isCreditCard,
      amount: (row.transunion + row.experian + row.equifax) / 3,
    }))
    .filter((row) => row.amount > 0.009)
    .sort((left, right) => right.amount - left.amount);

  const normalizedPaydownPercent = Math.max(0, Math.min(100, Number(paydownPercent) || 0));
  const paidRatio = normalizedPaydownPercent / 100;
  const adjustedDebtTypeRows = debtTypeRows.map((row) => ({
    ...row,
    amount: row.isCreditCard ? Math.max(0, row.amount * (1 - paidRatio)) : row.amount,
  }));

  const adjustedCreditCardDebt = adjustedDebtTypeRows
    .filter((row) => row.isCreditCard)
    .reduce((sum, row) => sum + row.amount, 0);
  const adjustedAverageTotalDebt = adjustedDebtTypeRows.reduce((sum, row) => sum + row.amount, 0);

  const mortgageDebt = adjustedDebtTypeRows
    .filter((row) => /mortgage/i.test(row.label))
    .reduce((sum, row) => sum + row.amount, 0);
  const autoDebt = adjustedDebtTypeRows
    .filter((row) => /auto|vehicle|lease/i.test(row.label))
    .reduce((sum, row) => sum + row.amount, 0);
  const debtBreakdown = {
    creditCardDebt: adjustedCreditCardDebt,
    mortgageDebt,
    autoDebt,
    otherDebt: Math.max(0, adjustedAverageTotalDebt - adjustedCreditCardDebt - mortgageDebt - autoDebt),
  };

  if (!yearlyIncome || yearlyIncome <= 0) {
    return {
      yearlyIncome: null,
      grossMonthlyIncome: null,
      housingPayment,
      debtMonthlyPayments,
      averageTotalDebt: adjustedAverageTotalDebt,
      averageCreditCardDebt: adjustedCreditCardDebt,
      debtBreakdown,
      adjustedCreditCardDebt,
      debtTypeRows: adjustedDebtTypeRows,
      paydownPercent: normalizedPaydownPercent,
      frontEndDtiPercent: null,
      backEndDtiPercent: null,
    };
  }

  const grossMonthlyIncome = yearlyIncome / 12;
  return {
    yearlyIncome,
    grossMonthlyIncome,
    housingPayment,
    debtMonthlyPayments,
    averageTotalDebt: adjustedAverageTotalDebt,
    averageCreditCardDebt: adjustedCreditCardDebt,
    debtBreakdown,
    adjustedCreditCardDebt,
    debtTypeRows: adjustedDebtTypeRows,
    paydownPercent: normalizedPaydownPercent,
    frontEndDtiPercent: grossMonthlyIncome > 0 ? (housingPayment / grossMonthlyIncome) * 100 : null,
    backEndDtiPercent: grossMonthlyIncome > 0 ? ((housingPayment + debtMonthlyPayments) / grossMonthlyIncome) * 100 : null,
  };
};

const formatDtiPercent = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '--';
  }

  return `${value.toFixed(1)}%`;
};

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));
const toFiniteNumber = (value, fallback = null) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const readBureauTradelineSummary = (client, bureau) => {
  const summary = client?.bureauTradelineSummary?.[bureau] || {};
  return {
    totalAccounts: toFiniteNumber(summary.totalAccounts, null),
    openAccounts: toFiniteNumber(summary.openAccounts, null),
    closedAccounts: toFiniteNumber(summary.closedAccounts, null),
    delinquentAccounts: toFiniteNumber(summary.delinquentAccounts, null),
    derogatoryAccounts: toFiniteNumber(summary.derogatoryAccounts, null),
  };
};

const hasMeaningfulReportForProjection = (client = {}) => {
  const bureaus = ['transunion', 'experian', 'equifax'];
  const toPositive = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0;
  };

  const hasAccounts = Array.isArray(client.openAccounts) && client.openAccounts.length > 0;
  const hasAnyScore = bureaus.some((bureau) => toPositive(client?.creditScores?.[bureau]));
  const hasAnyUtilizationTotals = bureaus.some((bureau) => (
    toPositive(client?.bureauUtilization?.[bureau]?.balanceTotal)
    || toPositive(client?.bureauUtilization?.[bureau]?.creditLimitTotal)
  ));
  const hasAnyOnTimeHistory = bureaus.some((bureau) => (
    toPositive(client?.bureauOnTimePayments?.[bureau]?.accountCountWithHistory)
    || toPositive(client?.bureauOnTimePayments?.[bureau]?.goodCount)
    || toPositive(client?.bureauOnTimePayments?.[bureau]?.badCount)
  ));
  const hasAnyAgeData = bureaus.some((bureau) => (
    toPositive(client?.bureauAgeOfCredit?.[bureau]?.accountCount)
    && toPositive(client?.bureauAgeOfCredit?.[bureau]?.averageAgeYears)
  ));
  const hasAnyHardInquiries = bureaus.some((bureau) => toPositive(client?.bureauHardInquiries?.[bureau]));
  const hasAnyTradelineSummary = bureaus.some((bureau) => {
    const summary = client?.bureauTradelineSummary?.[bureau] || {};
    return (
      toPositive(summary.totalAccounts)
      || toPositive(summary.openAccounts)
      || toPositive(summary.closedAccounts)
      || toPositive(summary.delinquentAccounts)
      || toPositive(summary.derogatoryAccounts)
    );
  });

  return (
    hasAccounts
    || hasAnyScore
    || hasAnyUtilizationTotals
    || hasAnyOnTimeHistory
    || hasAnyAgeData
    || hasAnyHardInquiries
    || hasAnyTradelineSummary
  );
};

const hasProjectedFicoInputsForBureau = (client, bureau) => {
  if (!hasMeaningfulReportForProjection(client)) {
    return false;
  }

  const score = Number(client.creditScores?.[bureau]);
  const utilizationPercent = Number(client.bureauUtilization?.[bureau]?.utilizationPercent);
  const utilizationBalanceTotal = Number(client.bureauUtilization?.[bureau]?.balanceTotal);
  const utilizationCreditLimitTotal = Number(client.bureauUtilization?.[bureau]?.creditLimitTotal);
  const onTimePercent = Number(client.bureauOnTimePayments?.[bureau]?.onTimePercent);
  const onTimeAccountCount = Number(client.bureauOnTimePayments?.[bureau]?.accountCountWithHistory);
  const onTimeGoodCount = Number(client.bureauOnTimePayments?.[bureau]?.goodCount);
  const onTimeBadCount = Number(client.bureauOnTimePayments?.[bureau]?.badCount);
  const averageAgeYears = Number(client.bureauAgeOfCredit?.[bureau]?.averageAgeYears);
  const ageAccountCount = Number(client.bureauAgeOfCredit?.[bureau]?.accountCount);
  const hardInquiries = Number(client.bureauHardInquiries?.[bureau]);
  const tradelineSummary = readBureauTradelineSummary(client, bureau);
  const openAccounts = Array.isArray(client.openAccounts) ? client.openAccounts : [];
  const hasBureauAccounts = openAccounts.some((account) => account?.bureaus?.[bureau]);
  const hasUtilizationSignal = (
    Number.isFinite(utilizationPercent)
    && utilizationPercent >= 0
    && (
      (Number.isFinite(utilizationCreditLimitTotal) && utilizationCreditLimitTotal > 0)
      || (Number.isFinite(utilizationBalanceTotal) && utilizationBalanceTotal > 0)
    )
  );
  const hasOnTimeSignal = (
    Number.isFinite(onTimePercent)
    && onTimePercent >= 0
    && (
      (Number.isFinite(onTimeAccountCount) && onTimeAccountCount > 0)
      || (Number.isFinite(onTimeGoodCount) && onTimeGoodCount > 0)
      || (Number.isFinite(onTimeBadCount) && onTimeBadCount > 0)
    )
  );
  const hasAgeSignal = (
    Number.isFinite(averageAgeYears)
    && averageAgeYears > 0
    && Number.isFinite(ageAccountCount)
    && ageAccountCount > 0
  );

  return (
    hasBureauAccounts
    || (Number.isFinite(tradelineSummary.totalAccounts) && tradelineSummary.totalAccounts > 0)
    || (Number.isFinite(score) && score > 0)
    || hasUtilizationSignal
    || hasOnTimeSignal
    || hasAgeSignal
    || (Number.isFinite(hardInquiries) && hardInquiries > 0)
  );
};

const calculateProjectedFicoForBureau = (client, bureau) => {
  const bureauScore = Number(client.creditScores?.[bureau]);
  const utilizationPercent = Number(client.bureauUtilization?.[bureau]?.utilizationPercent);
  const onTimePercent = Number(client.bureauOnTimePayments?.[bureau]?.onTimePercent);
  const averageAgeYears = Number(client.bureauAgeOfCredit?.[bureau]?.averageAgeYears);
  const hardInquiries = Number(client.bureauHardInquiries?.[bureau]);

  const openAccounts = Array.isArray(client.openAccounts) ? client.openAccounts : [];
  const ficoRelevantAccounts = openAccounts.filter((account) => {
    const status = String(account.status || '').toLowerCase();
    const accountType = `${String(account.accountType || '')} ${String(account.accountTypeDetail || '')}`.toLowerCase();
    if (!account.bureaus?.[bureau]) return false;
    if (status.includes('closed')) return false;
    if (status.includes('derog')) return false;
    if (accountType.includes('collection')) return false;
    return true;
  });
  const bureauVisibleAccounts = openAccounts.filter((account) => account?.bureaus?.[bureau]);
  const tradelineSummary = readBureauTradelineSummary(client, bureau);

  const bureauAccountHistories = ficoRelevantAccounts
    .filter((account) => account.bureaus?.[bureau])
    .map((account) => account.paymentHistoryByBureau?.[bureau])
    .filter(Boolean);

  const delinquentAccountCount = bureauAccountHistories.reduce((total, history) => {
    const bad = Number.isFinite(history.badCount) ? history.badCount : 0;
    return total + (bad > 0 ? 1 : 0);
  }, 0);

  const severeDelinquencyCount = bureauAccountHistories.reduce((total, history) => {
    const onTime = Number.isFinite(history?.onTimePercent) ? history.onTimePercent : 100;
    return total + (onTime < 95 ? 1 : 0);
  }, 0);

  const visibleRelevantAccountCount = ficoRelevantAccounts.reduce((total, account) => (
    account.bureaus?.[bureau] ? total + 1 : total
  ), 0);
  const totalAccounts = Number.isFinite(tradelineSummary.totalAccounts) && tradelineSummary.totalAccounts > 0
    ? tradelineSummary.totalAccounts
    : bureauVisibleAccounts.length;
  const openCount = Number.isFinite(tradelineSummary.openAccounts) && tradelineSummary.openAccounts >= 0
    ? tradelineSummary.openAccounts
    : bureauVisibleAccounts.length;
  const closedCount = Number.isFinite(tradelineSummary.closedAccounts) && tradelineSummary.closedAccounts >= 0
    ? tradelineSummary.closedAccounts
    : Math.max(0, totalAccounts - openCount);
  const delinquentFromSummary = Number.isFinite(tradelineSummary.delinquentAccounts) && tradelineSummary.delinquentAccounts >= 0
    ? tradelineSummary.delinquentAccounts
    : 0;
  const derogatoryFromSummary = Number.isFinite(tradelineSummary.derogatoryAccounts) && tradelineSummary.derogatoryAccounts >= 0
    ? tradelineSummary.derogatoryAccounts
    : 0;

  const safeUtilization = Number.isFinite(utilizationPercent) ? clampNumber(utilizationPercent, 0, 150) : 35;
  const safeOnTime = Number.isFinite(onTimePercent) ? clampNumber(onTimePercent, 0, 100) : (derogatoryFromSummary > 0 ? 88 : 95);
  const safeAge = Number.isFinite(averageAgeYears) ? clampNumber(averageAgeYears, 0, 40) : 4;
  const safeInquiries = Number.isFinite(hardInquiries) ? clampNumber(hardInquiries, 0, 30) : 2;
  const safeDelinquentAccountCount = clampNumber(Math.max(delinquentAccountCount, delinquentFromSummary), 0, 12);
  const safeSevereDelinqCount = clampNumber(severeDelinquencyCount, 0, 10);
  const safeDerogatoryCount = clampNumber(derogatoryFromSummary, 0, 12);
  const safeTotalAccounts = clampNumber(totalAccounts, 0, 150);
  const safeClosedAccounts = clampNumber(closedCount, 0, 150);
  const historyCoverage = safeTotalAccounts > 0
    ? clampNumber(bureauAccountHistories.length / safeTotalAccounts, 0, 1)
    : 1;

  const mixTypes = new Set(
    ficoRelevantAccounts
      .filter((account) => account.bureaus?.[bureau])
      .map((account) => {
        const type = `${String(account.accountType || '')} ${String(account.accountTypeDetail || '')}`.toLowerCase();
        if (type.includes('mortgage')) return 'mortgage';
        if (type.includes('installment') || type.includes('auto') || type.includes('student')) return 'installment';
        if (type.includes('revolving') || type.includes('credit card') || type.includes('charge')) return 'revolving';
        return 'other';
      }),
  );

  // FICO-style weighted components tuned against reverse-engineering references.
  const paymentHistoryComponent = safeOnTime;
  const utilizationComponent = clampNumber(100 - safeUtilization, 0, 100);
  const ageComponent = clampNumber((safeAge / 12) * 100, 0, 100);
  const newCreditComponent = clampNumber(100 - (safeInquiries * 9), 0, 100);
  const mixComponent = clampNumber((mixTypes.size / 4) * 100, 0, 100);

  const weightedPercent = (
    (paymentHistoryComponent * 0.40)
    + (utilizationComponent * 0.27)
    + (ageComponent * 0.14)
    + (mixComponent * 0.10)
    + (newCreditComponent * 0.09)
  );

  const modelScore = 300 + ((weightedPercent / 100) * 550);
  const hasObservedBureauScore = Number.isFinite(bureauScore) && bureauScore > 0;
  const observed = hasObservedBureauScore ? clampNumber(bureauScore, 300, 850) : null;

  let penalty = 0;
  penalty += safeDelinquentAccountCount * 9;
  penalty += safeSevereDelinqCount * 14;
  penalty += safeDerogatoryCount * 18;
  if (safeDelinquentAccountCount > 0 || safeSevereDelinqCount > 0 || safeDerogatoryCount > 0) {
    penalty += 18;
  }
  if (safeTotalAccounts > 0 && safeTotalAccounts < 3) {
    penalty += 12;
  } else if (safeTotalAccounts < 5) {
    penalty += 6;
  }
  if (safeClosedAccounts === 0 && safeTotalAccounts <= 2) {
    penalty += 7;
  }
  if (safeUtilization > 85) {
    penalty += 18;
  } else if (safeUtilization > 75) {
    penalty += 12;
  } else if (safeUtilization > 50) {
    penalty += 7;
  }
  if (safeOnTime < 98) {
    penalty += 6;
  }
  if (safeOnTime < 95) {
    penalty += 9;
  }
  if (safeOnTime < 90) {
    penalty += 14;
  }
  penalty += Math.max(0, safeInquiries - 2) * 3;
  if (visibleRelevantAccountCount === 0 && safeTotalAccounts > 0) {
    penalty += 10;
  }
  if (historyCoverage < 0.5) {
    penalty += Math.round((0.5 - historyCoverage) * 26);
  } else if (historyCoverage < 0.8) {
    penalty += Math.round((0.8 - historyCoverage) * 8);
  }

  let adjustedModel = modelScore - penalty;

  // Anchor to observed bureau score (typically Vantage) with a conservative FICO gap.
  if (observed !== null) {
    const pristineProfile = (
      safeUtilization <= 9
      && safeOnTime >= 99.7
      && safeInquiries <= 1
      && safeDelinquentAccountCount === 0
      && safeSevereDelinqCount === 0
      && safeDerogatoryCount === 0
      && safeTotalAccounts >= 5
    );

    let targetGap = pristineProfile ? 4 : 22;
    if (!pristineProfile) {
      if (safeUtilization > 40) targetGap += 5;
      if (safeUtilization > 60) targetGap += 7;
      if (safeUtilization > 80) targetGap += 10;
      if (safeOnTime < 99) targetGap += 5;
      if (safeOnTime < 97) targetGap += 8;
      if (safeOnTime < 95) targetGap += 12;
      if (safeOnTime < 90) targetGap += 16;
      if (safeDelinquentAccountCount > 0) targetGap += safeDelinquentAccountCount * 4;
      if (safeSevereDelinqCount > 0) targetGap += safeSevereDelinqCount * 5;
      if (safeDerogatoryCount > 0) targetGap += Math.min(35, safeDerogatoryCount * 7);
      if (safeInquiries > 2) targetGap += (safeInquiries - 2) * 2;
      if (safeTotalAccounts > 0 && safeTotalAccounts < 3) targetGap += 8;
      if (safeClosedAccounts === 0 && safeTotalAccounts > 0) targetGap += 5;
      if (historyCoverage < 0.65) targetGap += Math.round((0.65 - historyCoverage) * 18);
    }

    const targetVsObserved = observed - targetGap;
    adjustedModel = (adjustedModel * 0.3) + (targetVsObserved * 0.7);
    adjustedModel = clampNumber(
      adjustedModel,
      observed - 130,
      pristineProfile ? (observed + 2) : (observed - 2),
    );
  }

  return Math.round(clampNumber(adjustedModel, 300, 850));
};

const mapSimulatorAccountType = (account = {}) => {
  const type = `${String(account.accountType || '')} ${String(account.accountTypeDetail || '')}`.toLowerCase();
  if (type.includes('mortgage')) return 'mortgage';
  if (type.includes('student')) return 'student';
  if (type.includes('auto') || type.includes('vehicle') || type.includes('lease')) return 'auto';
  if (type.includes('installment') || type.includes('loan') || type.includes('note')) return 'installment';
  if (type.includes('credit card') || type.includes('revolving') || type.includes('charge')) return 'revolving';
  return 'other';
};

const CLIENTS_GLASS_BG_STORAGE_KEY = 'toolsNinja.clientsGlassBgDataUrl';
const DEFAULT_CLIENTS_GLASS_BG_URL = '/assets/clients-glass-bg.png';

const applyClientsGlassBackground = (rawUrl = '') => {
  const list = byId('clientsList');
  if (!list) {
    return;
  }
  const safeUrl = String(rawUrl || '').trim();
  if (!safeUrl) {
    list.style.removeProperty('--nt-clients-custom-bg');
    return;
  }
  list.style.setProperty('--nt-clients-custom-bg', `url("${safeUrl}")`);
};

const getSavedClientsGlassBackground = () => {
  try {
    return String(window.localStorage.getItem(CLIENTS_GLASS_BG_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
};

const saveClientsGlassBackground = (dataUrl) => {
  try {
    if (!dataUrl) {
      window.localStorage.removeItem(CLIENTS_GLASS_BG_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(CLIENTS_GLASS_BG_STORAGE_KEY, dataUrl);
  } catch {
    // Ignore storage failures (private mode / quota)
  }
};

const buildSimulatorPaymentHistory = (account = {}) => {
  const summaryPercent = Number(account?.paymentHistorySummary?.onTimePercent);
  const bureauSummaries = ['transunion', 'experian', 'equifax']
    .map((bureau) => Number(account?.paymentHistoryByBureau?.[bureau]?.onTimePercent))
    .filter((value) => Number.isFinite(value));
  const onTimePercent = Number.isFinite(summaryPercent)
    ? summaryPercent
    : (bureauSummaries.length
      ? bureauSummaries.reduce((sum, value) => sum + value, 0) / bureauSummaries.length
      : 100);

  const clamped = clampNumber(onTimePercent, 0, 100);
  const badCount = Math.round(((100 - clamped) / 100) * 24);
  const history = [];
  for (let i = 0; i < 24; i += 1) {
    history.push(i < badCount ? '30' : 'OK');
  }
  return history;
};

const buildWhatIfProfileFromClient = (client) => {
  const sourceAccounts = Array.isArray(client.openAccounts) ? client.openAccounts : [];
  const accounts = sourceAccounts.map((account, index) => {
    const opened = parseDateValue(account.dateOpened);
    const ageMonths = opened
      ? Math.max(1, Math.round((Date.now() - opened.getTime()) / (1000 * 60 * 60 * 24 * 30.4375)))
      : 24;
    const balance = Math.max(0, parseMoneyValue(account.balance));
    const limitOrOriginal = Math.max(
      1,
      parseMoneyValue(account.creditLimit)
      || parseMoneyValue(account.highCredit)
      || parseMoneyValue(account.highBalance)
      || parseMoneyValue(account.creditLimitByBureau?.transunion)
      || parseMoneyValue(account.creditLimitByBureau?.experian)
      || parseMoneyValue(account.creditLimitByBureau?.equifax)
      || balance,
    );
    const statusRaw = String(account.status || '').toLowerCase();
    let status = 'open';
    if (statusRaw.includes('closed')) status = 'closed';
    else if (statusRaw.includes('charge')) status = 'charged_off';
    else if (statusRaw.includes('collect')) status = 'in_collection';
    else if (statusRaw.includes('paid')) status = 'paid';

    return {
      account_id: String(account.accountNumber || account.name || `account_${index + 1}`),
      type: mapSimulatorAccountType(account),
      age_months: ageMonths,
      balance,
      limit_or_original: limitOrOriginal,
      status,
      payment_history: buildSimulatorPaymentHistory(account),
      industry: String(account.accountTypeDetail || account.accountType || '').trim() || undefined,
    };
  });

  const hardInquiries = ['transunion', 'experian', 'equifax']
    .map((bureau) => Number(client?.bureauHardInquiries?.[bureau]))
    .filter((value) => Number.isFinite(value));
  const inquiriesLast12m = hardInquiries.length
    ? Math.max(...hardInquiries)
    : 0;
  const collectionsUnpaid = sourceAccounts.filter((account) => {
    const combined = `${String(account.accountType || '')} ${String(account.accountTypeDetail || '')} ${String(account.status || '')}`.toLowerCase();
    return combined.includes('collection') || combined.includes('derog');
  }).length;

  return {
    accounts,
    inquiries_last_12m: inquiriesLast12m,
    months_since_last_inquiry: inquiriesLast12m > 0 ? 3 : 12,
    bankruptcies: 0,
    collections_unpaid: collectionsUnpaid,
    tax_liens: 0,
    judgments: 0,
  };
};

const renderClientsTable = (clients, options = {}) => {
  const emptyMessage = String(options.emptyMessage || 'No clients saved yet.');
  const totalCount = Number.isFinite(options.totalCount) ? Number(options.totalCount) : clients.length;
  const hasMoreRows = Boolean(options.hasMoreRows);
  const headerColumns = [
    { key: 'firstName', label: 'Client' },
    { key: 'status', label: 'Status' },
    { key: 'phase', label: 'Phase' },
    { key: 'nextImport', label: 'Days Left' },
    { key: 'phone', label: 'Phone' },
    { key: null, label: 'Monitoring' },
    { key: 'reportDate', label: 'Report Date' },
    { key: null, label: '' },
  ];

  const renderHeaderCell = (column) => {
    if (!column.key) {
      return `<th class="nt-liquid-col-static">${column.label}</th>`;
    }
    return `
      <th>
        <button class="sort-button nt-liquid-sort-button" type="button" data-sort-key="${column.key}">
          ${column.label} <span class="sort-hint">${getSortIndicator(column.key)}</span>
        </button>
      </th>
    `;
  };

  const renderDaysLeftCell = (nextImport) => {
    const days = nextImport?.daysUntilNextImport;
    const classes = ['next-import-edit-button', 'nt-liquid-status-pill'];
    if (!Number.isFinite(days)) {
      classes.push('nt-liquid-status-muted');
      return `<span class="${classes.join(' ')}">--</span>`;
    }
    if (days < 0) {
      classes.push('nt-liquid-status-overdue');
    } else if (days === 0) {
      classes.push('nt-liquid-status-due');
    } else if (days <= 7) {
      classes.push('nt-liquid-status-warning');
    } else {
      classes.push('nt-liquid-status-good');
    }
    return `<button class="${classes.join(' ')}" type="button" data-action="next-import" data-next-import-days="${days}" aria-label="Edit days left">${formatNextImport(nextImport)}</button>`;
  };

  const rows = clients.map((client) => {
    const displayName = `${client.firstName || ''} ${client.lastName || ''}`.trim() || '--';
    const email = String(client.email || '').trim();
    const phoneRaw = String(client.phone || '').trim();
    const phoneDisplay = formatPhoneNumber(phoneRaw) || phoneRaw;
    const emailDisplay = email || '--';
    const isSelectedRow = String(state.selectedClientId || '') === String(client.id || '');
    return `
      <tr data-client-id="${client.id}" class="${isSelectedRow ? 'nt-liquid-row-selected' : ''}">
        <td class="nt-liquid-col-member">
          <div class="nt-liquid-member-stack">
            <button class="nt-liquid-member-link" type="button" data-action="open" title="${escapeHtml(displayName)}">
              <span class="nt-liquid-member-name">${escapeHtml(displayName)}</span>
            </button>
            <button class="nt-liquid-email-copy" type="button" data-action="copy-email" data-email="${escapeHtml(email)}" aria-label="Copy email for ${escapeHtml(displayName)}">
              <span class="nt-liquid-email-copy-label">${escapeHtml(emailDisplay)}</span>
            </button>
          </div>
        </td>
        <td class="nt-liquid-col-stage">
          <select class="client-status-select nt-liquid-select" data-action="status" data-client-id="${client.id}">
            ${state.statuses.map((status) => `
              <option value="${status}"${status === (client.status || 'Client') ? ' selected' : ''}>${status}</option>
            `).join('')}
          </select>
        </td>
        <td class="nt-liquid-col-phase">
          <select class="client-phase-select nt-liquid-select" data-action="phase" data-client-id="${client.id}">
            ${state.phases.map((phase) => `
              <option value="${phase}"${phase === (client.phase || 'None') ? ' selected' : ''}>${phase}</option>
            `).join('')}
          </select>
        </td>
        <td class="nt-liquid-col-days">${renderDaysLeftCell(client.nextImport)}</td>
        <td class="nt-liquid-col-phone">
          ${phoneRaw
    ? `
            <button class="nt-liquid-phone-copy" type="button" data-action="copy-phone" data-phone="${escapeHtml(phoneRaw)}" aria-label="Copy phone for ${escapeHtml(displayName)}">
              <span class="nt-liquid-phone-copy-label">${escapeHtml(phoneDisplay)}</span>
            </button>
          `
    : ''}
        </td>
        <td class="nt-liquid-col-monitor">${renderMonitoringBadge(client)}</td>
        <td class="nt-liquid-col-report">${formatReportDateCell(client.reportDate)}</td>
        <td class="nt-liquid-col-actions">
          <div class="nt-liquid-actions-row">
            <button class="client-table-edit nt-liquid-edit-button" type="button" data-action="edit" aria-label="Edit client">Edit</button>
            <button class="client-table-delete nt-liquid-delete-button" type="button" data-action="delete" aria-label="Delete client">X</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  const loadMoreRowMarkup = hasMoreRows ? `
    <tr class="nt-liquid-load-more-row">
      <td colspan="${headerColumns.length}">
        <button class="nt-liquid-load-more-btn" type="button" data-action="load-more-clients">
          Load More Clients
        </button>
      </td>
    </tr>
  ` : '';

  const bodyMarkup = (rows || `
    <tr class="nt-liquid-empty-row">
      <td class="nt-liquid-empty-cell" colspan="${headerColumns.length}">${escapeHtml(emptyMessage)}</td>
    </tr>
  `) + loadMoreRowMarkup;

  const countLabel = hasMoreRows
    ? `${clients.length} of ${totalCount} clients`
    : `${totalCount} client${totalCount === 1 ? '' : 's'}`;

  return `
    <div class="nt-liquid-table-shell">
      <div class="nt-liquid-table-toolbar">
        <span class="nt-liquid-toolbar-title">Clients</span>
        <span class="nt-liquid-toolbar-count" id="clientsTableCount">${countLabel}</span>
        <div class="nt-liquid-table-search">
          <span class="nt-liquid-table-search-icon">🔍</span>
          <input id="clientsTableSearchInput" class="nt-liquid-table-search-input" type="search" placeholder="Search clients..." aria-label="Search clients" value="${escapeHtml(state.query || '')}">
        </div>
        <div class="nt-liquid-toolbar-buttons">
          <button id="clientsTableBackgroundTrigger" class="nt-liquid-toolbar-btn nt-liquid-bg-btn" type="button">Background</button>
          <select id="clientsTableStatusFilter" class="nt-liquid-toolbar-btn nt-liquid-toolbar-select" aria-label="Filter clients by status">
            <option value="__all__"${state.statusFilter === '__all__' ? ' selected' : ''}>All Statuses</option>
            ${state.statuses.map((status) => `<option value="${escapeHtml(status)}"${status === state.statusFilter ? ' selected' : ''}>${escapeHtml(status)}</option>`).join('')}
          </select>
          <button id="clientsTableImportTrigger" class="nt-liquid-toolbar-btn nt-liquid-import-btn" type="button">Import</button>
        </div>
        <input id="clientsTableBackgroundInput" class="nt-liquid-bg-input" type="file" accept="image/*" />
      </div>
      <div class="nt-liquid-table-scroll">
        <table class="nt-liquid-table">
          <thead>
            <tr>${headerColumns.map(renderHeaderCell).join('')}</tr>
          </thead>
          <tbody>${bodyMarkup}</tbody>
        </table>
      </div>
    </div>
  `;
};

const bindProgressiveClientTableHandlers = (list, hasMoreRows) => {
  if (!list) {
    return;
  }

  const loadMoreButton = list.querySelector('[data-action="load-more-clients"]');
  if (loadMoreButton) {
    loadMoreButton.addEventListener('click', () => {
      state.clientsRenderLimit += CLIENTS_RENDER_INCREMENT;
      renderClients();
    });
  }

  const tableScroll = list.querySelector('.nt-liquid-table-scroll');
  if (tableScroll && hasMoreRows) {
    tableScroll.addEventListener('scroll', () => {
      const remainingPx = tableScroll.scrollHeight - tableScroll.scrollTop - tableScroll.clientHeight;
      if (remainingPx > 220 || tableScroll.dataset.loadingMore === '1') {
        return;
      }
      tableScroll.dataset.loadingMore = '1';
      state.clientsRenderLimit += CLIENTS_RENDER_INCREMENT;
      renderClients();
      window.setTimeout(() => {
        tableScroll.dataset.loadingMore = '0';
      }, 0);
    });
  }
};

const renderClientsLoadingSkeleton = () => {
  const list = byId('clientsList');
  if (!list) {
    return;
  }
  const placeholderRows = Array.from({ length: 7 }, () => `
    <tr>
      <td><div class="nt-clients-skeleton-line nt-clients-skeleton-line--lg"></div></td>
      <td><div class="nt-clients-skeleton-line nt-clients-skeleton-line--md"></div></td>
      <td><div class="nt-clients-skeleton-line nt-clients-skeleton-line--md"></div></td>
      <td><div class="nt-clients-skeleton-line nt-clients-skeleton-line--sm"></div></td>
      <td><div class="nt-clients-skeleton-line nt-clients-skeleton-line--phone"></div></td>
      <td><div class="nt-clients-skeleton-line nt-clients-skeleton-line--badge"></div></td>
      <td><div class="nt-clients-skeleton-line nt-clients-skeleton-line--date"></div></td>
      <td><div class="nt-clients-skeleton-line nt-clients-skeleton-line--xs"></div></td>
    </tr>
  `).join('');

  list.innerHTML = `
    <div class="nt-liquid-table-shell nt-clients-skeleton-shell" aria-hidden="true">
      <div class="nt-liquid-table-toolbar">
        <span class="nt-liquid-toolbar-title">Clients</span>
        <span class="nt-liquid-toolbar-count">Loading...</span>
        <div class="nt-liquid-table-search">
          <span class="nt-liquid-table-search-icon">🔍</span>
          <input class="nt-liquid-table-search-input" type="search" value="" placeholder="Search clients..." disabled>
        </div>
        <div class="nt-liquid-toolbar-buttons">
          <button class="nt-liquid-toolbar-btn nt-liquid-bg-btn" type="button" disabled>Background</button>
          <button class="nt-liquid-toolbar-btn nt-liquid-import-btn" type="button" disabled>Import</button>
        </div>
      </div>
      <div class="nt-liquid-table-scroll">
        <table class="nt-liquid-table nt-clients-skeleton-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Status</th>
              <th>Phase</th>
              <th>Days Left</th>
              <th>Phone</th>
              <th>Monitoring</th>
              <th>Report Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${placeholderRows}</tbody>
        </table>
      </div>
    </div>
  `;

  list.classList.remove('clients-table-wrap--compact');
  applyClientsGlassBackground(getSavedClientsGlassBackground() || DEFAULT_CLIENTS_GLASS_BG_URL);
};

const getFilteredClients = () => {
  const query = normalizeClientSearchValue(state.query);
  const queryDigits = digitsOnly(query);
  const applyQuerySearch = shouldApplyClientSearch(query);
  const exactClientIdMatches = getExactClientIdMatches(query, state.clients);

  return state.clients.filter((client) => {
    if (state.pinnedClientId) {
      return client.id === state.pinnedClientId;
    }

    const matchesStatus = state.statusFilter === '__all__' || (client.status || 'Client') === state.statusFilter;

    if (!query || !applyQuerySearch) {
      return matchesStatus;
    }

    if (exactClientIdMatches) {
      return matchesStatus && exactClientIdMatches.has(client.id);
    }

    return matchesStatus
      && (
        clientSearchFields(client)
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
        || (
          queryDigits.length > 0
          && [client.phone, client.ssn]
            .filter(Boolean)
            .some((value) => digitsOnly(value).includes(queryDigits))
        )
      );
  });
};

const renderClients = () => {
  const list = byId('clientsList');

  list.innerHTML = '';
  const filtered = getFilteredClients();
  const sortedClients = sortClients(filtered);
  const hasSearchQuery = Boolean(String(state.query || '').trim());
  const isSearchActive = shouldApplyClientSearch(state.query);
  const emptyMessage = hasSearchQuery
    ? (isSearchActive ? 'No clients match your search.' : 'Type at least 3 letters to search clients.')
    : 'No clients saved yet.';
  const shouldProgressivelyRender = !hasSearchQuery && sortedClients.length > CLIENTS_RENDER_INITIAL_LIMIT;
  const normalizedLimit = Math.max(CLIENTS_RENDER_INITIAL_LIMIT, Number(state.clientsRenderLimit) || CLIENTS_RENDER_INITIAL_LIMIT);
  const searchLimited = hasSearchQuery && sortedClients.length > CLIENTS_SEARCH_RENDER_LIMIT;
  const visibleLimit = shouldProgressivelyRender
    ? normalizedLimit
    : searchLimited
      ? CLIENTS_SEARCH_RENDER_LIMIT
      : sortedClients.length;
  const visibleClients = sortedClients.slice(0, visibleLimit);
  const hasMoreRows = (shouldProgressivelyRender || searchLimited) && visibleClients.length < sortedClients.length;

  list.innerHTML = renderClientsTable(visibleClients, {
    emptyMessage,
    totalCount: sortedClients.length,
    hasMoreRows,
  });
  list.classList.toggle('clients-table-wrap--compact', visibleClients.length === 1);
  applyClientsGlassBackground(getSavedClientsGlassBackground() || DEFAULT_CLIENTS_GLASS_BG_URL);
  const tableSearchInput = list.querySelector('#clientsTableSearchInput');
  if (tableSearchInput) {
    tableSearchInput.value = state.query || '';
    tableSearchInput.addEventListener('input', (event) => {
      const previousQuery = state.query;
      state.query = event.target.value;
      state.clientsRenderLimit = CLIENTS_RENDER_INITIAL_LIMIT;
      if (state.pinnedClientId && state.query !== previousQuery) {
        clearPinnedClientList();
      }
      const wasFiltering = shouldApplyClientSearch(previousQuery);
      const isFiltering = shouldApplyClientSearch(state.query);
      if (!isFiltering && !wasFiltering) {
        return;
      }
      queueClientSearchRender();
    });
  }
  const importTrigger = list.querySelector('#clientsTableImportTrigger');
  if (importTrigger) {
    importTrigger.addEventListener('click', () => {
      byId('clientsCsv')?.click();
    });
  }
  const statusFilterSelect = list.querySelector('#clientsTableStatusFilter');
  if (statusFilterSelect) {
    statusFilterSelect.addEventListener('change', (event) => {
      state.statusFilter = String(event.target.value || '__all__');
      state.clientsRenderLimit = CLIENTS_RENDER_INITIAL_LIMIT;
      clearPinnedClientList();
      state.selectedClientId = '';
      persistLearningSelectedClientId('');
      renderClients();
    });
  }
  const backgroundTrigger = list.querySelector('#clientsTableBackgroundTrigger');
  const backgroundInput = list.querySelector('#clientsTableBackgroundInput');
  if (backgroundTrigger && backgroundInput) {
    backgroundTrigger.addEventListener('click', () => {
      backgroundInput.click();
    });
    backgroundInput.addEventListener('change', () => {
      const file = backgroundInput.files?.[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '').trim();
        if (!result) {
          return;
        }
        saveClientsGlassBackground(result);
        applyClientsGlassBackground(result);
        setFormMessage('Clients background updated.');
      };
      reader.readAsDataURL(file);
      backgroundInput.value = '';
    });
  }

  bindClientTableRowInteractionListeners(list);
  bindProgressiveClientTableHandlers(list, hasMoreRows);

  list.querySelectorAll('[data-sort-key]').forEach((button) => {
    button.addEventListener('click', () => {
      toggleSort(button.dataset.sortKey);
    });
  });

    byId('addStatusButton')?.addEventListener('click', async () => {
      const statusName = window.prompt('Add a new client status');
      if (!statusName) {
        return;
      }

      try {
        const payload = await request('/api/client-statuses', {
          method: 'POST',
          body: JSON.stringify({ status: statusName }),
        });
        state.statuses = payload.statuses || state.statuses;
        syncStatusFilterOptions();
        renderClients();
      } catch (error) {
        setFormMessage(error.message, true);
      }
    });

    byId('addPhaseButton')?.addEventListener('click', async () => {
      const phaseName = window.prompt('Add a new phase');
      if (!phaseName) {
        return;
      }

      try {
        const payload = await request('/api/client-phases', {
          method: 'POST',
          body: JSON.stringify({ phase: phaseName }),
        });
        state.phases = payload.phases || state.phases;
        renderClients();
      } catch (error) {
        setFormMessage(error.message, true);
      }
    });
  renderDashboard();
};

const bindClientTableRowInteractionListeners = (list) => {
  if (!list) {
    return;
  }

  list.querySelectorAll('[data-action="open"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const clickedButton = event.currentTarget;
      clickedButton.classList.remove('nt-liquid-member-link-clicked');
      // restart the click animation if user taps quickly
      void clickedButton.offsetWidth;
      clickedButton.classList.add('nt-liquid-member-link-clicked');
      window.setTimeout(() => {
        clickedButton.classList.remove('nt-liquid-member-link-clicked');
      }, 650);

      const row = event.currentTarget.closest('tr');
      if (!row?.dataset.clientId) {
        return;
      }
      void loadClientDetail(row.dataset.clientId);
    });
  });

  list.querySelectorAll('[data-action="delete"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const row = event.currentTarget.closest('tr');
      if (!row?.dataset.clientId) {
        return;
      }
      void deleteClient(row.dataset.clientId);
    });
  });

  list.querySelectorAll('[data-action="edit"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const row = event.currentTarget.closest('tr');
      if (!row?.dataset.clientId) {
        return;
      }
      openEditDialog(row.dataset.clientId);
    });
  });

  list.querySelectorAll('[data-action="copy-phone"]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      const targetButton = event.currentTarget;
      const phone = String(event.currentTarget.dataset.phone || '').trim();
      if (!phone) {
        return;
      }
      try {
        await navigator.clipboard.writeText(phone);
        targetButton.classList.add('is-copied');
        const labelNode = targetButton.querySelector('.nt-liquid-phone-copy-label');
        if (labelNode) {
          labelNode.textContent = 'Copied';
        } else {
          targetButton.textContent = 'Copied';
        }
        window.setTimeout(() => {
          targetButton.classList.remove('is-copied');
          const resetNode = targetButton.querySelector('.nt-liquid-phone-copy-label');
          if (resetNode) {
            resetNode.textContent = formatPhoneNumber(phone) || phone;
          } else {
            targetButton.textContent = 'Copy Phone';
          }
        }, 1200);
        setFormMessage(`Copied ${formatPhoneNumber(phone)} to clipboard.`);
      } catch (error) {
        setFormMessage('Could not copy phone number.', true);
      }
    });
  });

  list.querySelectorAll('[data-action="copy-email"]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      const targetButton = event.currentTarget;
      const email = String(targetButton.dataset.email || '').trim();
      if (!email) {
        return;
      }
      try {
        await navigator.clipboard.writeText(email);
        targetButton.classList.add('is-copied');
        const labelNode = targetButton.querySelector('.nt-liquid-email-copy-label');
        if (labelNode) {
          labelNode.textContent = 'Copied';
        } else {
          targetButton.title = 'Copied';
        }
        window.setTimeout(() => {
          targetButton.classList.remove('is-copied');
          const resetNode = targetButton.querySelector('.nt-liquid-email-copy-label');
          if (resetNode) {
            resetNode.textContent = email;
          } else {
            targetButton.title = '';
          }
        }, 1200);
        setFormMessage(`Copied ${email} to clipboard.`);
      } catch (error) {
        setFormMessage('Could not copy email.', true);
      }
    });
  });

  list.querySelectorAll('[data-action="next-import"]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      const row = event.currentTarget.closest('tr');
      const clientId = row?.dataset.clientId;
      if (!clientId) {
        return;
      }

      const currentDays = Number.parseInt(event.currentTarget.dataset.nextImportDays || '', 10);
      const promptValue = Number.isFinite(currentDays) ? String(currentDays) : '';
      const input = window.prompt('Set Next Import days for this client', promptValue);
      if (input === null) {
        return;
      }

      const parsedDays = Number.parseInt(String(input).trim(), 10);
      if (!Number.isFinite(parsedDays)) {
        setFormMessage('Please enter a valid number of days.', true);
        return;
      }

      try {
        const payload = await request(`/api/clients/${clientId}/next-import`, {
          method: 'PATCH',
          body: JSON.stringify({ days: parsedDays }),
        });
        const target = state.clients.find((client) => client.id === clientId);
        if (target && payload.client) {
          Object.assign(target, payload.client);
        }
        renderClients();
        if (state.selectedClientId === clientId) {
          await loadClientDetail(clientId);
        }
        setFormMessage(`Next Import updated to ${parsedDays} day${Math.abs(parsedDays) === 1 ? '' : 's'}.`);
      } catch (error) {
        setFormMessage(error.message, true);
      }
    });
  });

  list.querySelectorAll('[data-action="status"]').forEach((select) => {
    select.addEventListener('change', async (event) => {
      const { clientId } = event.currentTarget.dataset;
      const nextStatus = event.currentTarget.value;
      try {
        const payload = await request(`/api/clients/${clientId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: nextStatus }),
        });
        state.statuses = payload.statuses || state.statuses;
        const target = state.clients.find((client) => client.id === clientId);
        if (target) {
          target.status = nextStatus;
        }
        syncStatusFilterOptions();
        renderClients();
      } catch (error) {
        setFormMessage(error.message, true);
      }
    });
  });

    list.querySelectorAll('[data-action="phase"]').forEach((select) => {
      select.addEventListener('change', async (event) => {
        const { clientId } = event.currentTarget.dataset;
        const nextPhase = event.currentTarget.value;
        try {
          const payload = await request(`/api/clients/${clientId}/phase`, {
            method: 'PATCH',
            body: JSON.stringify({ phase: nextPhase }),
          });
          state.phases = payload.phases || state.phases;
          const target = state.clients.find((client) => client.id === clientId);
          if (target) {
            target.phase = nextPhase;
          }
          renderClients();
        } catch (error) {
          setFormMessage(error.message, true);
        }
      });
    });
};

const renderClientsRowsOnly = () => {
  const list = byId('clientsList');
  if (!list) {
    return;
  }
  const body = list.querySelector('.nt-liquid-table tbody');
  if (!body) {
    renderClients();
    return;
  }

  const filtered = getFilteredClients();
  const sortedClients = sortClients(filtered);
  const hasSearchQuery = Boolean(String(state.query || '').trim());
  const isSearchActive = shouldApplyClientSearch(state.query);
  const emptyMessage = hasSearchQuery
    ? (isSearchActive ? 'No clients match your search.' : 'Type at least 3 letters to search clients.')
    : 'No clients saved yet.';
  const shouldProgressivelyRender = !hasSearchQuery && sortedClients.length > CLIENTS_RENDER_INITIAL_LIMIT;
  const normalizedLimit = Math.max(CLIENTS_RENDER_INITIAL_LIMIT, Number(state.clientsRenderLimit) || CLIENTS_RENDER_INITIAL_LIMIT);
  const searchLimited = hasSearchQuery && sortedClients.length > CLIENTS_SEARCH_RENDER_LIMIT;
  const visibleLimit = shouldProgressivelyRender
    ? normalizedLimit
    : searchLimited
      ? CLIENTS_SEARCH_RENDER_LIMIT
      : sortedClients.length;
  const visibleClients = sortedClients.slice(0, visibleLimit);
  const hasMoreRows = (shouldProgressivelyRender || searchLimited) && visibleClients.length < sortedClients.length;

  const virtualTableContainer = document.createElement('div');
  virtualTableContainer.innerHTML = renderClientsTable(visibleClients, {
    emptyMessage,
    totalCount: sortedClients.length,
    hasMoreRows,
  });
  const nextBody = virtualTableContainer.querySelector('.nt-liquid-table tbody');
  if (!nextBody) {
    renderClients();
    return;
  }

  body.innerHTML = nextBody.innerHTML;
  const countNode = list.querySelector('#clientsTableCount');
  if (countNode) {
    countNode.textContent = hasMoreRows
      ? `${visibleClients.length} of ${sortedClients.length} clients`
      : `${sortedClients.length} client${sortedClients.length === 1 ? '' : 's'}`;
  }
  list.classList.toggle('clients-table-wrap--compact', visibleClients.length === 1);
  bindClientTableRowInteractionListeners(list);
  bindProgressiveClientTableHandlers(list, hasMoreRows);
};

const syncStatusFilterOptions = () => {
  const select = byId('statusFilter');
  if (!select) {
    return;
  }

  const options = ['<option value="__all__">All Clients</option>', ...state.statuses.map((status) => `
    <option value="${status}"${status === state.statusFilter ? ' selected' : ''}>${status}</option>
  `)];

  select.innerHTML = options.join('');
};

const renderClientDetail = (client) => {
  updateBrowserTabTitle(client);
  const shell = byId('clientDetail');
  const template = byId('clientDetailTemplate');
  const node = template.content.firstElementChild.cloneNode(true);
  const dtiSummary = calculateDtiSummary(client);
  const shortReportDate = formatShortReportDate(client.reportDate);

  const detailName = `${client.firstName} ${client.lastName}`.trim();
  const detailNameNode = node.querySelector('.detail-name');
  if (detailNameNode) {
    const label = `\uf504 ${detailName || 'Client Detail'}`;
    const nameLength = detailName.replace(/\s+/g, '').length;
    let computedSize = 'clamp(1.5rem, 2.85vw, 2.05rem)';
    let computedShift = '0rem';
    let computedSpacing = '0em';
    if (nameLength >= 28) {
      computedSize = 'clamp(1.08rem, 1.9vw, 1.34rem)';
      computedShift = '0.58rem';
      computedSpacing = '-0.05em';
    } else if (nameLength >= 24) {
      computedSize = 'clamp(1.2rem, 2.15vw, 1.52rem)';
      computedShift = '0.4rem';
      computedSpacing = '-0.035em';
    } else if (nameLength >= 20) {
      computedSize = 'clamp(1.34rem, 2.4vw, 1.78rem)';
      computedShift = '0.22rem';
      computedSpacing = '-0.015em';
    }
    detailNameNode.textContent = label;
    detailNameNode.setAttribute('data-text', label);
    detailNameNode.style.setProperty('--detail-name-size', computedSize);
    detailNameNode.style.setProperty('--detail-name-shift', computedShift);
    detailNameNode.style.setProperty('--detail-name-letter-spacing', computedSpacing);
  }
  node.querySelector('.detail-email').innerHTML = client.email ? `<a class="client-email-link detail-email-link" href="mailto:${client.email}">${client.email}</a>` : '';
  const textClientDestination = node.querySelector('.text-client-destination');
  const textClientInput = node.querySelector('.text-client-input');
  const textClientStatus = node.querySelector('.text-client-status');
  const textClientSendButton = node.querySelector('.text-client-send-button');
  let textAttachmentDropzone = node.querySelector('.text-attachment-dropzone');
  let textAttachmentInput = node.querySelector('.text-attachment-input');
  let textAttachmentMeta = node.querySelector('.text-attachment-meta');
  if (!textAttachmentDropzone || !textAttachmentInput || !textAttachmentMeta) {
    const textClientField = node.querySelector('.text-client-field');
    if (textClientField) {
      const attachmentArea = document.createElement('div');
      attachmentArea.className = 'text-attachment-area';
      attachmentArea.innerHTML = `
        <span class="text-attachment-label">Attachment</span>
        <div class="text-attachment-dropzone" role="button" tabindex="0" aria-label="Add attachment">
          <input class="text-attachment-input" type="file" accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.zip,.heic,.heif,.webp" hidden />
          <p class="text-attachment-hint">Drop image/PDF/file, click to choose, or paste screenshot (Ctrl/Cmd+V)</p>
          <p class="text-attachment-meta muted"></p>
        </div>
      `;
      textClientField.insertAdjacentElement('beforebegin', attachmentArea);
      textAttachmentDropzone = node.querySelector('.text-attachment-dropzone');
      textAttachmentInput = node.querySelector('.text-attachment-input');
      textAttachmentMeta = node.querySelector('.text-attachment-meta');
    }
  }
  const detailRefreshButton = node.querySelector('.detail-refresh-button');
  const formattedPhone = formatPhoneNumber(client.phone || '') || client.phone || '';
  if (textClientDestination) {
    textClientDestination.textContent = formattedPhone
      ? `Texts will send to ${formattedPhone}`
      : '';
  }
  const setTextClientStatus = (message = '', isError = false) => {
    if (!textClientStatus) {
      return;
    }
    textClientStatus.textContent = message;
    textClientStatus.classList.toggle('error', Boolean(isError));
  };
  const selectedAttachments = [];
  const formatAttachmentMeta = () => {
    if (!textAttachmentMeta) {
      return;
    }
    if (!selectedAttachments.length) {
      textAttachmentMeta.textContent = '';
      textAttachmentMeta.classList.remove('is-ready');
      return;
    }
    const names = selectedAttachments.map((item) => item.fileName).join(', ');
    textAttachmentMeta.textContent = `Attached: ${names}`;
    textAttachmentMeta.classList.add('is-ready');
  };
  const uploadAttachmentFile = async (file) => {
    const fileSize = Number(file?.size || 0);
    const maxBytes = 15 * 1024 * 1024;
    if (!file || !file.name) {
      throw new Error('Please choose a valid attachment.');
    }
    if (fileSize > maxBytes) {
      throw new Error('Attachment must be 15MB or smaller.');
    }
    const dataUrl = await readFileAsDataUrl(file);
    const payload = await request('/api/uploads/text-attachment', {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type || '',
        dataUrl,
      }),
    });
    return {
      fileName: payload.fileName || file.name,
      fileUrl: payload.fileUrl || '',
      mimeType: payload.mimeType || file.type || '',
    };
  };
  const handleAttachmentFile = async (file) => {
    if (!file) {
      return;
    }
    setTextClientStatus('Uploading attachment...');
    try {
      const uploaded = await uploadAttachmentFile(file);
      selectedAttachments.length = 0;
      selectedAttachments.push(uploaded);
      formatAttachmentMeta();
      setTextClientStatus('Attachment ready to send.');
    } catch (error) {
      setTextClientStatus(error.message || 'Attachment upload failed.', true);
    }
  };
  const pickPastedImageFile = (event) => {
    const clipboardItems = Array.from(event?.clipboardData?.items || []);
    for (const item of clipboardItems) {
      if (item?.kind === 'file' && String(item.type || '').toLowerCase().startsWith('image/')) {
        const file = item.getAsFile?.();
        if (file) {
          return file;
        }
      }
    }
    return null;
  };
  const handlePastedScreenshot = async (event) => {
    const pastedFile = pickPastedImageFile(event);
    if (!pastedFile) {
      return false;
    }
    event.preventDefault();
    const screenshotName = pastedFile.name || `Screenshot-${Date.now()}.png`;
    const screenshotFile = new File([pastedFile], screenshotName, {
      type: pastedFile.type || 'image/png',
      lastModified: Date.now(),
    });
    await handleAttachmentFile(screenshotFile);
    return true;
  };
  if (textAttachmentDropzone && textAttachmentInput) {
    textAttachmentDropzone.addEventListener('click', () => textAttachmentInput.click());
    textAttachmentDropzone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        textAttachmentInput.click();
      }
    });
    textAttachmentDropzone.addEventListener('paste', async (event) => {
      await handlePastedScreenshot(event);
    });
    textAttachmentDropzone.addEventListener('dragover', (event) => {
      event.preventDefault();
      textAttachmentDropzone.classList.add('is-dragover');
    });
    textAttachmentDropzone.addEventListener('dragleave', () => {
      textAttachmentDropzone.classList.remove('is-dragover');
    });
    textAttachmentDropzone.addEventListener('drop', async (event) => {
      event.preventDefault();
      textAttachmentDropzone.classList.remove('is-dragover');
      const file = event.dataTransfer?.files?.[0];
      await handleAttachmentFile(file);
    });
    textAttachmentInput.addEventListener('change', async () => {
      const file = textAttachmentInput.files?.[0];
      await handleAttachmentFile(file);
      textAttachmentInput.value = '';
    });
  }
  if (textClientInput) {
    textClientInput.addEventListener('paste', async (event) => {
      await handlePastedScreenshot(event);
    });
  }
  formatAttachmentMeta();
  if (textClientInput) {
    // Keep typing enabled even if destination phone is currently missing.
    textClientInput.disabled = false;
  }
  if (textClientSendButton) {
    textClientSendButton.disabled = false;
  }
  setTextClientStatus('');
  const reportLink = node.querySelector('.detail-report-link');
  reportLink.href = `/api/clients/${client.id}/report`;
  reportLink.textContent = `Last Report ${formatReportDateMMDD(client.reportDate)}`;
  reportLink.title = shortReportDate === 'No report' ? 'No report saved yet' : `Open report from ${shortReportDate}`;
  reportLink.setAttribute('aria-label', `Open credit report for ${client.firstName} ${client.lastName}`);
  setWidgetRefreshHeader(client);
  node.querySelector('.monitoring-username-input').value = client.monitoringUsername || '';
  const passwordInput = node.querySelector('.monitoring-password-input');
  const passwordToggleButton = node.querySelector('.password-toggle-button');
  passwordInput.value = client.monitoringPassword || '';
  const securityFieldLabel = node.querySelector('.security-field-label');
  const securityCodeInput = node.querySelector('.security-code-input');
  const securityCodeToggleButton = node.querySelector('.security-code-toggle-button');
  const agencyButtons = [...node.querySelectorAll('.agency-toggle')];
  const monitoringLinkIndicator = node.querySelector('.monitoring-link-indicator');
  const monitoringLinkIcon = node.querySelector('.monitoring-link-icon');
  const monitoringLinkText = node.querySelector('.monitoring-link-text');
  const securityValues = {
    identityiq: client.secretKey || '',
    token: client.monitoringToken || '',
  };
  let lastLinkedCredentialSignature = '';
  const getActiveAgencyValue = () => (
    agencyButtons.find((button) => button.classList.contains('is-active'))?.dataset.agency
    || client.monitoringAgency
    || 'IdentityIQ'
  );
  const getLiveMonitoringDraft = () => {
    const monitoringAgency = getActiveAgencyValue();
    const normalizedAgency = normalizeMonitoringAgency(monitoringAgency);
    const tokenAgency = normalizedAgency.includes('smart') || normalizedAgency.includes('myfree');
    const securityValue = String(securityCodeInput?.value || '').trim();
    return {
      monitoringAgency,
      monitoringUsername: String(node.querySelector('.monitoring-username-input')?.value || '').trim(),
      monitoringPassword: String(node.querySelector('.monitoring-password-input')?.value || '').trim(),
      secretKey: tokenAgency ? '' : securityValue,
      monitoringToken: tokenAgency ? securityValue : '',
    };
  };
  const updateMonitoringLinkIndicator = (selectedAgency) => {
    const liveDraft = getLiveMonitoringDraft();
    const linkStatus = getMonitoringLinkStatus({
      ...client,
      monitoringAgency: liveDraft.monitoringAgency,
      monitoringUsername: liveDraft.monitoringUsername,
      monitoringPassword: liveDraft.monitoringPassword,
      monitoringToken: liveDraft.monitoringToken,
    }, selectedAgency || liveDraft.monitoringAgency);
    monitoringLinkIndicator.hidden = !linkStatus.visible;
    monitoringLinkIcon.classList.toggle('is-linked', linkStatus.linked);
    monitoringLinkIcon.classList.toggle('is-unlinked', !linkStatus.linked);
    monitoringLinkIcon.innerHTML = linkStatus.linked
      ? '<img class="monitoring-link-icon-image" src="/assets/linked-icon.png" alt="Linked" />'
      : '<img class="monitoring-link-icon-image" src="/assets/unlinked-icon.png" alt="Unlinked" />';
    monitoringLinkText.textContent = linkStatus.text;
    monitoringLinkIndicator.title = linkStatus.linked
      ? 'Token and service credentials are ready for this service.'
      : 'Missing required credentials for this service.';
    return { linkStatus, liveDraft };
  };
  const setAgencyButtons = (selectedAgency) => {
    const normalized = normalizeMonitoringAgency(selectedAgency);
    let activeAgencyIndex = 0;
    agencyButtons.forEach((button) => {
      const isActive = normalizeMonitoringAgency(button.dataset.agency) === normalized;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      if (isActive) {
        activeAgencyIndex = Math.max(0, agencyButtons.indexOf(button));
      }
    });
    node.querySelector('.monitoring-agency-switch')?.style.setProperty('--agency-index', String(activeAgencyIndex));
    const usingIdentity = normalized.includes('identity');
    securityFieldLabel.textContent = usingIdentity ? 'Secret Key' : 'Token';
    securityCodeInput.placeholder = usingIdentity ? 'Secret Key' : 'Token';
    securityCodeInput.value = usingIdentity ? securityValues.identityiq : securityValues.token;
    if (securityCodeToggleButton) {
      securityCodeToggleButton.setAttribute('aria-label', usingIdentity ? 'Show secret key' : 'Show token');
    }
    updateMonitoringLinkIndicator(selectedAgency);
  };
  setAgencyButtons(client.monitoringAgency || 'IdentityIQ');

  node.querySelectorAll('.score-value').forEach((element) => {
    const bureau = element.dataset.score;
    element.textContent = client.creditScores?.[bureau] ?? '--';
  });

  node.querySelectorAll('.projected-fico-value').forEach((element) => {
    const bureau = element.dataset.projectedFico;
    if (!hasProjectedFicoInputsForBureau(client, bureau)) {
      element.textContent = '--';
      return;
    }
    element.textContent = String(calculateProjectedFicoForBureau(client, bureau));
  });

  node.querySelectorAll('.utilization-value').forEach((element) => {
    const bureau = element.dataset.utilization;
    element.textContent = formatUtilization(client.bureauUtilization?.[bureau]?.utilizationPercent);
  });

  node.querySelectorAll('.age-value').forEach((element) => {
    const bureau = element.dataset.age;
    element.textContent = formatAgeOfCredit(client.bureauAgeOfCredit?.[bureau]?.averageAgeYears);
  });

  node.querySelectorAll('.on-time-value').forEach((element) => {
    const bureau = element.dataset.onTime;
    element.textContent = formatOnTimePayments(client.bureauOnTimePayments?.[bureau]?.onTimePercent);
  });

  node.querySelectorAll('.total-debt-value').forEach((element) => {
    const bureau = element.dataset.totalDebt;
    element.textContent = formatCurrency(client.bureauTotalDebt?.[bureau]?.totalDebt);
  });

  node.querySelector('.detail-note').textContent = client.creditScoresFound
    ? `Pulled directly from ${client.creditReportFileName}.`
    : `I could not find all three scores in ${client.creditReportFileName}.`;

  const yearlyIncomeInput = node.querySelector('.yearly-income-input');
  const housingPaymentInput = node.querySelector('.housing-payment-input');
  const debtMonthlyPaymentInput = node.querySelector('.debt-monthly-payment-input');
  const notesInput = node.querySelector('.client-notes-input');
  const notesPanel = node.querySelector('.client-notes-panel');
  const goalSelect = node.querySelector('.client-goal-select');
  goalSelect.value = client.goal || '';
  notesInput.value = client.notes || '';
  syncNotesPaperHeight(notesInput, notesPanel);
  const currentYearlyIncome = parseNumericValue(client.yearlyIncome);
  yearlyIncomeInput.value = formatIncomeValue(
    Number.isFinite(currentYearlyIncome) && currentYearlyIncome > 0
      ? currentYearlyIncome
      : '',
  );
  const inferredHousingPayment = inferHousingPaymentFromAccounts(client);
  const inferredDebtMonthlyPayments = inferDebtMonthlyPaymentsFromAccounts(client);
  const currentHousingPayment = parseNumericValue(client.housingPayment);
  const currentDebtMonthlyPayments = parseNumericValue(client.debtMonthlyPayments);
  housingPaymentInput.value = formatIncomeValue(
    Number.isFinite(currentHousingPayment) && currentHousingPayment > 0
      ? currentHousingPayment
      : inferredHousingPayment,
  );
  debtMonthlyPaymentInput.value = formatIncomeValue(
    Number.isFinite(currentDebtMonthlyPayments) && currentDebtMonthlyPayments > 0
      ? currentDebtMonthlyPayments
      : inferredDebtMonthlyPayments,
  );
  const whatIfScenarioSelect = node.querySelector('.whatif-scenario-select');
  if (whatIfScenarioSelect && !String(whatIfScenarioSelect.value || '').trim()) {
    whatIfScenarioSelect.value = 'pay_down_revolving';
  }
  if (whatIfScenarioSelect && String(whatIfScenarioSelect.value || '').trim() === 'baseline') {
    whatIfScenarioSelect.value = 'pay_down_revolving';
  }
  const whatIfValueLabel = node.querySelector('.whatif-value-label');
  const whatIfScenarioSlider = node.querySelector('.whatif-scenario-slider');
  const whatIfSliderValue = node.querySelector('.whatif-slider-value');
  const whatIfSliderHelper = node.querySelector('.whatif-slider-helper');
  const whatIfSliderTotal = node.querySelector('.whatif-slider-total');
  const bureaus = ['transunion', 'experian', 'equifax'];
  const updateDtiDisplay = () => {
    const activeScenario = String(whatIfScenarioSelect?.value || 'baseline').trim();
    const sliderValue = Number.parseInt(whatIfScenarioSlider?.value || '0', 10) || 0;
    const paydownValue = activeScenario === 'pay_down_revolving' ? sliderValue : 0;
    const liveClient = {
      ...client,
      yearlyIncome: yearlyIncomeInput.value,
      housingPayment: housingPaymentInput.value,
      debtMonthlyPayments: debtMonthlyPaymentInput.value,
    };
    const liveDtiSummary = calculateDtiSummaryWithPaydown(liveClient, paydownValue);
    const dtiTotalDebtNode = node.querySelector('.dti-total-debt');
    const dtiCreditCardAverageNode = node.querySelector('.dti-credit-card-average');
    const dtiFrontEndNode = node.querySelector('.dti-front-end');
    const dtiBackEndNode = node.querySelector('.dti-back-end');
    const frontEndMarker = node.querySelector('.front-end-marker');
    const backEndMarker = node.querySelector('.back-end-marker');
    if (!dtiTotalDebtNode || !dtiFrontEndNode || !dtiBackEndNode || !frontEndMarker || !backEndMarker) {
      return;
    }

    dtiTotalDebtNode.textContent = formatCurrency(liveDtiSummary.averageTotalDebt);
    if (dtiCreditCardAverageNode) {
      dtiCreditCardAverageNode.textContent = formatCurrency(liveDtiSummary.adjustedCreditCardDebt);
    }

    const debtBreakdownList = node.querySelector('.dti-debt-breakdown-list');
    if (debtBreakdownList) {
      const rows = Array.isArray(liveDtiSummary.debtTypeRows) ? liveDtiSummary.debtTypeRows : [];
      debtBreakdownList.innerHTML = rows.length
        ? rows.map((row) => `<span><b>${escapeHtml(row.label)}</b> <em>${formatCurrency(row.amount)}</em></span>`).join('')
        : '<span><b>No debt categories</b> <em>$0.00</em></span>';
    }

    dtiFrontEndNode.textContent = formatDtiPercent(liveDtiSummary.frontEndDtiPercent);
    dtiBackEndNode.textContent = formatDtiPercent(liveDtiSummary.backEndDtiPercent);
    const frontPosition = getDtiScalePosition(liveDtiSummary.frontEndDtiPercent);
    const backPosition = getDtiScalePosition(liveDtiSummary.backEndDtiPercent);
    if (frontPosition === null) {
      frontEndMarker.hidden = true;
    } else {
      frontEndMarker.hidden = false;
      frontEndMarker.style.left = `${frontPosition}%`;
    }
    if (backPosition === null) {
      backEndMarker.hidden = true;
    } else {
      backEndMarker.hidden = false;
      backEndMarker.style.left = `${backPosition}%`;
    }
  };
  updateDtiDisplay();
  const whatIfStatus = node.querySelector('.whatif-status');
  const whatIfCurrentVantage = node.querySelector('.whatif-current-vantage');
  const whatIfCurrentFico = node.querySelector('.whatif-current-fico');
  const whatIfVantageScore = node.querySelector('.whatif-vantage-score');
  const whatIfProjectedFicoBureau = node.querySelector('.whatif-projected-fico-bureau');
  const whatIfVantageDeltaScore = node.querySelector('.whatif-vantage-delta-score');
  const whatIfFicoDeltaScore = node.querySelector('.whatif-fico-delta-score');
  const whatIfUpArrowImage = '/assets/icons/arrow-up-green.svg';
  const whatIfDownArrowImage = '/assets/icons/arrow-down-red.svg';
  const formatBureauScoreColumns = (values = {}, compareValues = {}, showPositive = false) => bureaus.map((bureau) => {
    const label = bureau === 'transunion' ? 'TransUnion' : bureau === 'experian' ? 'Experian' : 'Equifax';
    const score = values[bureau] ?? '---';
    const scoreNumeric = Number(score);
    const compareNumeric = Number(compareValues?.[bureau]);
    const showPlus = Boolean(
      showPositive
      && Number.isFinite(scoreNumeric)
      && Number.isFinite(compareNumeric)
      && scoreNumeric > compareNumeric,
    );
    return `<span class="whatif-bureau-column ${bureau}"><small>${label}</small><strong>${score}${showPlus ? '<span class="whatif-projected-plus">+</span>' : ''}</strong></span>`;
  }).join('');
  const formatDeltaMarkup = (deltaValue) => {
    const numeric = Number(deltaValue);
    if (!Number.isFinite(numeric)) {
      return '<span class="whatif-delta-arrow">-</span><span class="whatif-delta-value">---</span>';
    }
    if (numeric > 0) {
      return `<img class="whatif-delta-arrow-image up" src="${whatIfUpArrowImage}" alt="Delta up" /><span class="whatif-delta-value up">+${Math.round(numeric)}</span>`;
    }
    if (numeric < 0) {
      return `<img class="whatif-delta-arrow-image down" src="${whatIfDownArrowImage}" alt="Delta down" /><span class="whatif-delta-value down">${Math.round(numeric)}</span>`;
    }
    return '<span class="whatif-delta-arrow flat">→</span><span class="whatif-delta-value flat">0</span>';
  };
  const clampScore = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    return Math.max(300, Math.min(850, Math.round(numeric)));
  };
  const setWhatIfStatus = (message, isError = false) => {
    if (!whatIfStatus) return;
    whatIfStatus.textContent = message;
    whatIfStatus.classList.toggle('error', Boolean(isError));
  };
  const setWhatIfResults = ({
    currentVantage = {},
    currentFico = {},
    projectedVantage = {},
    projectedFico = {},
    vantageDelta = null,
    ficoDelta = null,
  } = {}) => {
    if (whatIfCurrentVantage) whatIfCurrentVantage.innerHTML = formatBureauScoreColumns(currentVantage);
    if (whatIfCurrentFico) whatIfCurrentFico.innerHTML = formatBureauScoreColumns(currentFico);
    if (whatIfVantageScore) whatIfVantageScore.innerHTML = formatBureauScoreColumns(projectedVantage, currentVantage, true);
    if (whatIfProjectedFicoBureau) whatIfProjectedFicoBureau.innerHTML = formatBureauScoreColumns(projectedFico, currentFico, true);
    if (whatIfVantageDeltaScore) whatIfVantageDeltaScore.innerHTML = formatDeltaMarkup(vantageDelta);
    if (whatIfFicoDeltaScore) whatIfFicoDeltaScore.innerHTML = formatDeltaMarkup(ficoDelta);
  };
  const getSliderConfigForScenario = (scenario) => {
    if (scenario === 'pay_down_revolving') {
      return {
        label: 'Credit Card Utilization Pay Down',
        helper: (value) => `${value}% pay down applied to revolving balances`,
        valueLabel: (value) => `${value}%`,
        min: 0,
        max: 100,
        step: 10,
        fallback: 0,
      };
    }
    if (scenario === 'increase_credit_limits') {
      return {
        label: 'Increase Credit Limit',
        helper: (value) => `Increase all revolving limits by ${formatCurrency(value)}`,
        valueLabel: (value) => formatCurrency(value),
        min: 0,
        max: 50000,
        step: 1000,
        fallback: 5000,
      };
    }
    if (scenario === 'time_travel') {
      return {
        label: 'Age Accounts Time Travel',
        helper: (value) => `Advance profile age by ${value} year${value === 1 ? '' : 's'}`,
        valueLabel: (value) => `${value} yr`,
        min: 0,
        max: 10,
        step: 1,
        fallback: 1,
      };
    }
    return {
      label: 'Scenario Input',
      helper: () => 'No scenario adjustment',
      valueLabel: () => 'N/A',
      min: 0,
      max: 100,
      step: 10,
      fallback: 0,
    };
  };
  const currentVantageByBureau = bureaus.reduce((acc, bureau) => {
    const numeric = Number(client.creditScores?.[bureau]);
    acc[bureau] = Number.isFinite(numeric) ? Math.round(numeric) : '---';
    return acc;
  }, {});
  const currentFicoByBureau = bureaus.reduce((acc, bureau) => {
    const value = hasProjectedFicoInputsForBureau(client, bureau)
      ? calculateProjectedFicoForBureau(client, bureau)
      : null;
    acc[bureau] = Number.isFinite(Number(value)) ? Number(value) : '---';
    return acc;
  }, {});
  setWhatIfResults({
    currentVantage: currentVantageByBureau,
    currentFico: currentFicoByBureau,
    projectedVantage: currentVantageByBureau,
    projectedFico: currentFicoByBureau,
    vantageDelta: 0,
    ficoDelta: 0,
  });
  const revolvingBalanceTotal = (Array.isArray(client.openAccounts) ? client.openAccounts : [])
    .filter((account) => isCreditCardType(account) && !isChargeCardNoLimitAccount(account))
    .reduce((sum, account) => sum + parseMoneyValue(account.balance || account.highBalance), 0);
  const revolvingLimitTotal = (Array.isArray(client.openAccounts) ? client.openAccounts : [])
    .filter((account) => isCreditCardType(account) && !isChargeCardNoLimitAccount(account))
    .reduce((sum, account) => sum + parseMoneyValue(account.creditLimit), 0);
  let whatIfRunTimer = null;
  let whatIfRunNonce = 0;
  const updatePaydownRemainingBalance = () => {
    if (!whatIfSliderTotal) return;
    const scenario = String(whatIfScenarioSelect?.value || 'baseline').trim();
    const sliderValue = Number.parseInt(whatIfScenarioSlider?.value || '0', 10) || 0;
    if (scenario === 'pay_down_revolving') {
      const remaining = Math.max(0, revolvingBalanceTotal * (1 - (sliderValue / 100)));
      whatIfSliderTotal.textContent = formatCurrency(remaining);
      return;
    }
    if (scenario === 'increase_credit_limits') {
      const increased = revolvingLimitTotal + sliderValue;
      whatIfSliderTotal.textContent = formatCurrency(Math.max(0, increased));
      return;
    }
    if (scenario === 'time_travel') {
      whatIfSliderTotal.textContent = `${sliderValue} year${sliderValue === 1 ? '' : 's'}`;
      return;
    }
    whatIfSliderTotal.textContent = formatCurrency(revolvingBalanceTotal);
  };
  const updateWhatIfValueFieldFromScenario = () => {
    if (!whatIfScenarioSelect || !whatIfScenarioSlider || !whatIfValueLabel || !whatIfSliderValue || !whatIfSliderHelper) {
      return;
    }
    const scenario = String(whatIfScenarioSelect.value || 'baseline').trim();
    const sliderConfig = getSliderConfigForScenario(scenario);
    whatIfValueLabel.textContent = sliderConfig.label;
    whatIfScenarioSlider.min = String(sliderConfig.min);
    whatIfScenarioSlider.max = String(sliderConfig.max);
    whatIfScenarioSlider.step = String(sliderConfig.step);
    const currentValue = Number.parseInt(whatIfScenarioSlider.value || '', 10);
    const normalizedValue = Number.isFinite(currentValue)
      ? Math.min(sliderConfig.max, Math.max(sliderConfig.min, currentValue))
      : sliderConfig.fallback;
    whatIfScenarioSlider.value = String(normalizedValue);
    whatIfSliderValue.textContent = sliderConfig.valueLabel(normalizedValue);
    whatIfSliderHelper.textContent = sliderConfig.helper(normalizedValue);
    updatePaydownRemainingBalance();
    updateDtiDisplay();
  };
  const runWhatIfSimulation = async () => {
    const runToken = ++whatIfRunNonce;
    setWhatIfStatus('Running model...');
    try {
      const scenario = whatIfScenarioSelect?.value || 'baseline';
      const profile = buildWhatIfProfileFromClient(client);
      const sliderValue = Number.parseInt(whatIfScenarioSlider?.value || '0', 10) || 0;
      let value = '';
      if (scenario === 'pay_down_revolving') {
        const revolvingBalance = (profile.accounts || [])
          .filter((account) => account.type === 'revolving')
          .reduce((sum, account) => sum + (Number(account.balance) || 0), 0);
        value = String(Math.round(revolvingBalance * (sliderValue / 100)));
      } else if (scenario === 'increase_credit_limits') {
        const currentLimit = (profile.accounts || [])
          .filter((account) => account.type === 'revolving')
          .reduce((sum, account) => sum + (Number(account.limit_or_original) || 0), 0);
        if (currentLimit > 0) {
          const rawRatio = sliderValue / currentLimit;
          value = rawRatio > 0
            ? rawRatio.toFixed(8).replace(/0+$/, '').replace(/\.$/, '')
            : '0';
        } else {
          value = '0';
        }
      } else if (scenario === 'time_travel') {
        value = String(Math.max(0, sliderValue) * 12);
      }
      const payload = await request('/api/simulator/vantage', {
        method: 'POST',
        body: JSON.stringify({
          profile,
          scenario,
          value,
        }),
      });
      const baseline = payload?.result?.baseline || {};
      const scenarioResult = payload?.result?.scenario || null;
      const deltaValue = Number.isFinite(Number(scenarioResult?.delta)) ? Number(scenarioResult.delta) : 0;
      const baselineFicoScore = Number(baseline?.ficoScore);
      const scenarioFicoScore = Number(scenarioResult?.ficoScore);
      const ficoDeltaValue = (
        Number.isFinite(scenarioFicoScore) && Number.isFinite(baselineFicoScore)
      ) ? (scenarioFicoScore - baselineFicoScore) : 0;
      let effectiveVantageDelta = deltaValue;
      let effectiveFicoDelta = ficoDeltaValue;
      if (scenario === 'increase_credit_limits' && sliderValue > 0) {
        const revolvingAccounts = (profile.accounts || []).filter((account) => account.type === 'revolving');
        const currentRevolvingBalance = revolvingAccounts.reduce((sum, account) => sum + (Number(account.balance) || 0), 0);
        const currentRevolvingLimit = revolvingAccounts.reduce((sum, account) => sum + (Number(account.limit_or_original) || 0), 0);
        if (currentRevolvingLimit > 0 && currentRevolvingBalance > 0) {
          const baselineUtilization = (currentRevolvingBalance / currentRevolvingLimit) * 100;
          const projectedUtilization = (currentRevolvingBalance / (currentRevolvingLimit + sliderValue)) * 100;
          const utilizationDrop = Math.max(0, baselineUtilization - projectedUtilization);
          const vantageFloorDelta = utilizationDrop > 0.25 ? Math.max(1, Math.round(utilizationDrop * 0.82)) : 0;
          const ficoFloorDelta = utilizationDrop > 0.25 ? Math.max(1, Math.round(utilizationDrop * 0.57)) : 0;
          if (Math.abs(effectiveVantageDelta) < 0.5) {
            effectiveVantageDelta = vantageFloorDelta;
          }
          if (Math.abs(effectiveFicoDelta) < 0.5) {
            effectiveFicoDelta = ficoFloorDelta;
          }
        }
      } else if (scenario === 'time_travel' && sliderValue > 0) {
        const allAccounts = Array.isArray(profile.accounts) ? profile.accounts : [];
        const accountCount = allAccounts.length;
        const hasScoreHeadroom = bureaus.some((bureau) => {
          const current = Number(client.creditScores?.[bureau]);
          return Number.isFinite(current) && current < 848;
        });
        if (accountCount > 0 && hasScoreHeadroom) {
          const totalAgeMonths = allAccounts.reduce((sum, account) => sum + (Number(account.age_months) || 0), 0);
          const averageAgeMonths = totalAgeMonths / Math.max(1, accountCount);
          const youngestAgeMonths = allAccounts.reduce((youngest, account) => {
            const ageMonths = Number(account.age_months);
            if (!Number.isFinite(ageMonths)) {
              return youngest;
            }
            return Math.min(youngest, ageMonths);
          }, Number.POSITIVE_INFINITY);
          const monthsSinceInquiry = Number(profile.months_since_last_inquiry || 12);
          const cappedYears = Math.max(0, Math.min(10, sliderValue));
          const ageLiftFactor = averageAgeMonths < 96
            ? (1 + ((96 - averageAgeMonths) / 140))
            : 0.95;
          const youngestBoost = Number.isFinite(youngestAgeMonths) && youngestAgeMonths < 24 ? 1.2 : 1;
          const inquiryRelief = monthsSinceInquiry < 12 ? ((12 - monthsSinceInquiry) / 12) * 2.4 : 0;
          const estimatedFloor = Math.max(
            1,
            Math.round(((cappedYears * 0.75) * ageLiftFactor * youngestBoost) + inquiryRelief),
          );

          if (Math.abs(effectiveVantageDelta) < 0.5) {
            effectiveVantageDelta = estimatedFloor;
          }
          if (Math.abs(effectiveFicoDelta) < 0.5) {
            effectiveFicoDelta = Math.max(1, Math.round(estimatedFloor * 0.7));
          }
        }
      }
      const projectedVantageByBureau = bureaus.reduce((acc, bureau) => {
        const current = Number(client.creditScores?.[bureau]);
        if (!Number.isFinite(current) || !Number.isFinite(effectiveVantageDelta)) {
          acc[bureau] = '---';
          return acc;
        }
        acc[bureau] = clampScore(current + effectiveVantageDelta);
        return acc;
      }, {});
      const projectedFicoByBureau = bureaus.reduce((acc, bureau) => {
        const current = Number(currentFicoByBureau[bureau]);
        if (!Number.isFinite(current) || !Number.isFinite(effectiveFicoDelta)) {
          acc[bureau] = '---';
          return acc;
        }
        acc[bureau] = clampScore(current + effectiveFicoDelta);
        return acc;
      }, {});
      if (runToken !== whatIfRunNonce) {
        return;
      }
      setWhatIfResults({
        currentVantage: currentVantageByBureau,
        currentFico: currentFicoByBureau,
        projectedVantage: projectedVantageByBureau,
        projectedFico: projectedFicoByBureau,
        vantageDelta: effectiveVantageDelta,
        ficoDelta: effectiveFicoDelta,
      });
      setWhatIfStatus('Simulation complete.');
    } catch (error) {
      if (runToken !== whatIfRunNonce) {
        return;
      }
      setWhatIfStatus(error.message || 'Simulation failed.', true);
    }
  };
  const queueWhatIfSimulation = () => {
    if (whatIfRunTimer) {
      window.clearTimeout(whatIfRunTimer);
    }
    whatIfRunTimer = window.setTimeout(() => {
      whatIfRunTimer = null;
      void runWhatIfSimulation();
    }, 140);
  };
  if (whatIfScenarioSelect && whatIfScenarioSlider) {
    whatIfScenarioSelect?.addEventListener('change', () => {
      updateWhatIfValueFieldFromScenario();
      queueWhatIfSimulation();
    });
    whatIfScenarioSlider?.addEventListener('input', () => {
      const scenario = String(whatIfScenarioSelect?.value || 'baseline').trim();
      const sliderConfig = getSliderConfigForScenario(scenario);
      const sliderValue = Number.parseInt(whatIfScenarioSlider.value || '0', 10) || 0;
      if (whatIfSliderValue) {
        whatIfSliderValue.textContent = sliderConfig.valueLabel(sliderValue);
      }
      if (whatIfSliderHelper) {
        whatIfSliderHelper.textContent = sliderConfig.helper(sliderValue);
      }
      updatePaydownRemainingBalance();
      updateDtiDisplay();
      queueWhatIfSimulation();
    });
    updateWhatIfValueFieldFromScenario();
    void runWhatIfSimulation();
  }

  const accountsList = node.querySelector('.accounts-list');
  const accountCategoryList = node.querySelector('.account-category-list');
  const accountsFilterButton = node.querySelector('.accounts-filter-button');
  const accountsFilterMenu = node.querySelector('.accounts-filter-menu');
  const openAccounts = (client.openAccounts ?? []).filter((account) => !isClosedAccount(account));
  const visibleAccounts = state.accountCategoryFilter === 'all'
    ? openAccounts
    : openAccounts.filter((account) => classifyAccountCategory(account) === state.accountCategoryFilter);
  const categoryCounts = buildAccountCategoryCounts(openAccounts);
  const creditMixSummary = getCreditMixSummary(openAccounts, categoryCounts);
  const paymentHistorySummary = getPaymentHistorySummary(client.bureauOnTimePayments);
  node.querySelector('#openAccountCount').textContent = String(visibleAccounts.length);
  node.querySelector('.hard-inquiry-count-transunion').textContent = String(client.bureauHardInquiries?.transunion ?? 0);
  node.querySelector('.hard-inquiry-count-experian').textContent = String(client.bureauHardInquiries?.experian ?? 0);
  node.querySelector('.hard-inquiry-count-equifax').textContent = String(client.bureauHardInquiries?.equifax ?? 0);
  accountsFilterButton.textContent = 'Choose Accounts';
  accountsFilterButton.setAttribute('aria-expanded', 'false');
  accountsFilterMenu.hidden = true;
  accountsFilterMenu.innerHTML = accountFilterDefinitions.map((item) => `
    <button class="accounts-filter-option${item.key === state.accountCategoryFilter ? ' is-active' : ''}" type="button" data-account-filter="${item.key}">${item.label}</button>
  `).join('');
  const categoryCardsMarkup = accountCategoryDefinitions.map((item) => {
    const count = categoryCounts[item.key] || 0;
    const visualConfig = getCategoryVisual(item.key);
    const visual = count > 0
      ? `<span class="account-category-count">${count}</span>`
      : '<span class="account-category-zero" aria-label="Zero accounts"></span>';

    return `
      <div class="account-category-card account-category-card-inline">
        <div class="account-category-visual-row">
          ${visualConfig ? `<img class="account-category-icon" src="${visualConfig.iconPath}" alt="${visualConfig.label}" />` : ''}
          ${visual}
        </div>
        <span class="account-category-label">${item.label}</span>
      </div>
    `;
  }).join('');
  accountCategoryList.insertAdjacentHTML('beforebegin', `
    <div class="credit-mix-summary">
      <div class="credit-mix-main">
        <div class="credit-mix-copy">
          <small>Credit Mixture</small>
          <strong>${creditMixSummary.label}</strong>
        </div>
        <div class="credit-mix-points">
          <span><strong>${creditMixSummary.points}/45</strong><small>pts</small></span>
        </div>
      </div>
      <div class="credit-mix-extra-row credit-mix-category-row">
        ${categoryCardsMarkup}
      </div>
    </div>
    <div class="credit-mix-summary payment-history-summary">
      <div class="credit-mix-main">
        <div class="credit-mix-copy">
          <small>Payment History Avg</small>
          <strong>${paymentHistorySummary.label}</strong>
          ${typeof paymentHistorySummary.averagePercent === 'number' ? `<em>${paymentHistorySummary.averagePercent.toFixed(1)}% avg on time</em>` : ''}
        </div>
        <div class="credit-mix-points">
          <span><strong>${paymentHistorySummary.points}/157</strong><small>pts</small></span>
        </div>
      </div>
      <div class="credit-mix-extra-row credit-mix-extra-row-blank">
      </div>
    </div>
  `);
  accountCategoryList.innerHTML = '';

  if (visibleAccounts.length === 0) {
    accountsList.innerHTML = '<p class="muted">No open accounts were found in this report.</p>';
  } else {
    accountsList.innerHTML = visibleAccounts.map((account) => `
      ${(() => {
        const reference = getAccountReferenceValue(account);
        const accountAgeYears = getAccountAgeYears(account);
        const lastPaymentAgeYears = getElapsedYearsFromDate(account.dateOfLastPayment || account.dateLastActive || '');
        const onTimeTone = getPercentTone(account.paymentHistorySummary?.onTimePercent);
        const referencePercentTone = getPercentTone(reference.percent, reference.badgeDirection);
        const accountVisual = getAccountVisualType(account);
        const creditorAddress = formatCreditorAddressLines(account.creditorAddress || '');
        const isChargeCardNoLimit = isChargeCardNoLimitAccount(account);
        const accountTypeBadge = accountVisual?.isSelfReported
          ? 'Self Reported'
          : isChargeCardNoLimit
            ? 'Charge Card no Limit'
            : isCreditCardType(account)
            ? 'Credit Card'
            : isMortgageType(account)
              ? 'Mortgage'
              : isInstallmentType(account)
                ? 'Installment'
                : '';
        return `
      <article class="account-item">
        <div class="account-top-grid">
          <div class="account-header-primary">
            <div class="account-name-row">
              <strong>${account.name}</strong>
              <div class="bureau-badges">
                ${account.bureaus?.transunion ? '<span class="bureau-logo tu" aria-label="TransUnion"><span class="logo-ring">tu</span></span>' : ''}
                ${account.bureaus?.experian ? '<span class="bureau-logo exp" aria-label="Experian"><span class="logo-exp-square sq-a"></span><span class="logo-exp-square sq-b"></span><span class="logo-exp-square sq-c"></span><span class="logo-exp-square sq-d"></span><span class="logo-exp-square sq-e"></span><span class="logo-exp-text">e</span></span>' : ''}
                ${account.bureaus?.equifax ? '<span class="bureau-logo eq" aria-label="Equifax"><span class="logo-eq-text">EQ</span></span>' : ''}
              </div>
            </div>
            <p class="muted">${account.accountNumber || 'Account number not shown'}</p>
            ${formatLastPaymentBadge(lastPaymentAgeYears) ? `<div class="account-last-payment-row"><span class="account-metric-pill account-last-payment-pill">${formatLastPaymentBadge(lastPaymentAgeYears)}</span></div>` : ''}
          </div>
          <div class="account-top-visual">
            ${accountVisual ? `<img class="account-type-icon account-type-icon-large ${accountVisual.isSelfReported ? 'account-type-icon-self-reported' : ''}" src="${accountVisual.iconPath}" alt="${accountVisual.label}" />` : ''}
          </div>
          <div class="account-header-metrics">
            <div class="account-header-metric account-header-metric-reference">
              <strong>Balance</strong>
              <span class="account-metric-value">${formatMoneyDisplay(account.balance || '$0')}</span>
              <strong>${reference.label}</strong>
              <span class="account-metric-value account-metric-value-dual">
                <span>${reference.value || '--'}</span>
              </span>
              ${formatReferenceBadge(reference) ? `<span class="account-metric-pill account-metric-pill-inline" style="${referencePercentTone}">${formatReferenceBadge(reference)}</span>` : '<span class="account-metric-spacer" aria-hidden="true"></span>'}
            </div>
            <div class="account-header-metric account-header-metric-opened">
              <strong>Date Opened</strong>
              <span class="account-metric-value">${account.dateOpened || '--'}</span>
              ${formatYearsBadge(accountAgeYears) ? `<span class="account-metric-pill account-metric-pill-inline account-age-pill">${formatYearsBadge(accountAgeYears)}</span>` : '<span class="account-metric-spacer" aria-hidden="true"></span>'}
            </div>
            <div class="account-header-metric account-header-metric-type">
              <strong>Account Type</strong>
              <span class="account-metric-value account-type-value">${getAccountTypeDisplay(account)}</span>
              ${accountTypeBadge ? `<span class="account-metric-pill account-metric-pill-inline">${accountTypeBadge}</span>` : '<span class="account-metric-spacer" aria-hidden="true"></span>'}
            </div>
          </div>
          <div class="account-pill-group">
            ${formatOnTimeBadge(account.paymentHistorySummary?.onTimePercent) ? `<span class="account-pill account-pill-dynamic" style="${onTimeTone}">${formatOnTimeBadge(account.paymentHistorySummary?.onTimePercent)}</span>` : ''}
            <span class="account-pill">${account.status || 'Open'}</span>
            <div class="account-pill-contact">
              <span class="account-pill-contact-line">${creditorAddress.line1}</span>
              ${creditorAddress.line2 ? `<span class="account-pill-contact-line">${creditorAddress.line2}</span>` : ''}
              <span class="account-pill-contact-line account-pill-contact-phone">${formatPhoneNumber(account.creditorPhone || '') || account.creditorPhone || 'Phone unavailable'}</span>
            </div>
          </div>
        </div>
        <div class="account-bottom-grid">
          <div class="account-bottom-meta">
          </div>
        </div>
      </article>
    `;
      })()}
    `).join('');
  }

  shell.innerHTML = '';
  shell.appendChild(node);
  syncRefreshLoaderToDetail();

  if (textClientSendButton && textClientInput) {
    textClientSendButton.addEventListener('click', async () => {
      if (!formattedPhone) {
        setTextClientStatus('Add a client phone number before sending a text.', true);
        textClientInput.focus();
        return;
      }
      const message = textClientInput.value.trim();
      if (!message) {
        setTextClientStatus('Please type a text message first.', true);
        textClientInput.focus();
        return;
      }

      textClientSendButton.disabled = true;
      textClientSendButton.textContent = 'Sending...';
      setTextClientStatus('Sending text through BlueBubbles...');
      setWidgetConsoleMessage(`Sending text to ${client.firstName} ${client.lastName} through BlueBubbles...`);

      try {
        const payload = await request(`/api/clients/${client.id}/send-text`, {
          method: 'POST',
          body: JSON.stringify({
            message,
            attachments: selectedAttachments.map((item) => item.fileUrl).filter(Boolean),
          }),
        });
        const target = state.clients.find((entry) => entry.id === client.id);
        if (target && payload.client) {
          Object.assign(target, payload.client);
        }
        textClientInput.value = '';
        selectedAttachments.length = 0;
        formatAttachmentMeta();
        const sentVia = String(payload.fallbackMode || payload.mode || '').trim();
        const providerMessage = String(payload.providerMessage || '').trim();
        const throughText = sentVia === 'gohighlevel-api'
          ? 'GoHighLevel fallback'
          : 'BlueBubbles';
        setTextClientStatus(`Sent to ${formattedPhone || 'client phone'} through ${throughText}.${providerMessage ? ` ${providerMessage}` : ''}`);
        setWidgetConsoleMessage(`${client.firstName} ${client.lastName} text sent via ${throughText}.${providerMessage ? ` ${providerMessage}` : ''}`);
      } catch (error) {
        setTextClientStatus(error.message, true);
        setWidgetConsoleMessage(error.message, true);
      } finally {
        textClientSendButton.disabled = false;
        textClientSendButton.textContent = 'Send Text';
      }
    });
  }

  if (detailRefreshButton) {
    detailRefreshButton.addEventListener('click', async () => {
      detailRefreshButton.disabled = true;
      try {
        await triggerSelectedClientRefresh();
      } finally {
        detailRefreshButton.disabled = false;
      }
    });
  }

  let saveProfileTimer;
  let credentialSaveTimer;
  const persistProfile = async () => {
    try {
      const payload = await request(`/api/clients/${client.id}/profile`, {
        method: 'PATCH',
        body: JSON.stringify({
          yearlyIncome: yearlyIncomeInput.value,
          housingPayment: housingPaymentInput.value,
          debtMonthlyPayments: debtMonthlyPaymentInput.value,
          monitoringAgency: agencyButtons.find((button) => button.classList.contains('is-active'))?.dataset.agency || 'IdentityIQ',
          monitoringUsername: node.querySelector('.monitoring-username-input').value,
          monitoringPassword: node.querySelector('.monitoring-password-input').value,
          secretKey: securityValues.identityiq,
          monitoringToken: securityValues.token,
          goal: goalSelect.value,
          notes: notesInput.value,
        }),
      });

      const target = state.clients.find((entry) => entry.id === client.id);
      if (target) {
        Object.assign(target, payload.client);
      }

      const activeElement = document.activeElement;
      const credentialFieldFocused = Boolean(
        activeElement
        && node.contains(activeElement)
        && activeElement.matches('.monitoring-username-input, .monitoring-password-input, .security-code-input'),
      );
      if (state.selectedClientId === client.id && !credentialFieldFocused) {
        renderClientDetail(payload.client);
      }
    } catch (error) {
      setFormMessage(error.message, true);
    }
  };

  const queueProfileSave = () => {
    window.clearTimeout(saveProfileTimer);
    saveProfileTimer = window.setTimeout(() => {
      void persistProfile();
    }, 350);
  };

  const queueCredentialSave = () => {
    window.clearTimeout(credentialSaveTimer);
    // Credentials should not auto-save aggressively while typing.
    credentialSaveTimer = window.setTimeout(() => {
      void persistProfile();
    }, 1800);
  };

  const flushProfileSave = () => {
    window.clearTimeout(saveProfileTimer);
    window.clearTimeout(credentialSaveTimer);
    void persistProfile();
  };
  const maybePersistLinkedCredentials = () => {
    const { linkStatus, liveDraft } = updateMonitoringLinkIndicator(getActiveAgencyValue());
    if (!linkStatus.linked) {
      lastLinkedCredentialSignature = '';
      return;
    }
    const signature = [
      String(client.id || '').trim(),
      normalizeMonitoringAgency(liveDraft.monitoringAgency),
      liveDraft.monitoringUsername,
      liveDraft.monitoringPassword,
      liveDraft.secretKey,
      liveDraft.monitoringToken,
    ].join('|');
    if (signature === lastLinkedCredentialSignature) {
      return;
    }
    lastLinkedCredentialSignature = signature;
    flushProfileSave();
    setWidgetConsoleMessage(`Credentials linked and saved for ${client.firstName} ${client.lastName}.`, false, true);
  };

  yearlyIncomeInput.addEventListener('input', queueProfileSave);
  housingPaymentInput.addEventListener('input', queueProfileSave);
  debtMonthlyPaymentInput.addEventListener('input', queueProfileSave);
  yearlyIncomeInput.addEventListener('input', updateDtiDisplay);
  housingPaymentInput.addEventListener('input', updateDtiDisplay);
  debtMonthlyPaymentInput.addEventListener('input', updateDtiDisplay);
  let notesSaveTimer;
  const queueNotesSave = () => {
    window.clearTimeout(notesSaveTimer);
    // Notes should not save aggressively while typing.
    notesSaveTimer = window.setTimeout(() => {
      void persistProfile();
    }, 2200);
  };
  const flushNotesSave = () => {
    window.clearTimeout(notesSaveTimer);
    flushProfileSave();
  };
  notesInput.addEventListener('input', queueNotesSave);
  notesInput.addEventListener('input', () => {
    syncNotesPaperHeight(notesInput, notesPanel);
  });
  notesInput.addEventListener('blur', flushNotesSave);
  goalSelect.addEventListener('change', flushProfileSave);
  node.querySelector('.monitoring-username-input').addEventListener('input', () => {
    queueCredentialSave();
    maybePersistLinkedCredentials();
  });
  passwordInput.addEventListener('input', () => {
    queueCredentialSave();
    maybePersistLinkedCredentials();
  });
  node.querySelector('.monitoring-username-input').addEventListener('blur', flushProfileSave);
  passwordInput.addEventListener('blur', flushProfileSave);
  securityCodeInput.addEventListener('input', () => {
    const activeAgency = agencyButtons.find((button) => button.classList.contains('is-active'))?.dataset.agency || 'IdentityIQ';
    if (normalizeMonitoringAgency(activeAgency).includes('identity')) {
      securityValues.identityiq = securityCodeInput.value;
    } else {
      securityValues.token = securityCodeInput.value;
    }
    queueCredentialSave();
    maybePersistLinkedCredentials();
  });
  securityCodeInput.addEventListener('blur', flushProfileSave);
  agencyButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const currentAgency = agencyButtons.find((entry) => entry.classList.contains('is-active'))?.dataset.agency || 'IdentityIQ';
      if (normalizeMonitoringAgency(currentAgency).includes('identity')) {
        securityValues.identityiq = securityCodeInput.value;
      } else {
        securityValues.token = securityCodeInput.value;
      }
      setAgencyButtons(button.dataset.agency);
      queueProfileSave();
      maybePersistLinkedCredentials();
    });
  });

  passwordToggleButton.addEventListener('click', () => {
    const nextVisible = toggleSensitiveInputVisibility(passwordInput, 'text');
    passwordToggleButton.setAttribute('aria-pressed', nextVisible ? 'true' : 'false');
    passwordToggleButton.setAttribute('aria-label', nextVisible ? 'Hide password' : 'Show password');
    passwordToggleButton.textContent = nextVisible ? '◑' : '◐';
  });

  securityCodeToggleButton?.addEventListener('click', () => {
    const nextVisible = toggleSensitiveInputVisibility(securityCodeInput, 'text');
    securityCodeToggleButton.setAttribute('aria-pressed', nextVisible ? 'true' : 'false');
    securityCodeToggleButton.setAttribute('aria-label', nextVisible ? 'Hide token' : 'Show token');
    securityCodeToggleButton.textContent = nextVisible ? '◑' : '◐';
  });

  accountsFilterButton.addEventListener('click', () => {
    const isOpen = accountsFilterButton.getAttribute('aria-expanded') === 'true';
    accountsFilterButton.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    accountsFilterMenu.hidden = isOpen;
  });

  accountsFilterMenu.querySelectorAll('[data-account-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      state.accountCategoryFilter = button.dataset.accountFilter || 'all';
      const target = state.clients.find((entry) => entry.id === client.id) || client;
      renderClientDetail(target);
    });
  });
};

const openEditDialog = async (clientId) => {
  const client = state.clients.find((entry) => entry.id === clientId);
  if (!client) {
    return;
  }

  let detailedClient = client;
  try {
    const payload = await request(`/api/clients/${clientId}`);
    if (payload?.client?.id) {
      detailedClient = payload.client;
    }
  } catch (error) {
    // Fall back to list payload if detailed fetch fails.
  }

  renderAddClientStatusOptions();
  renderAddClientPhaseOptions();
  renderAddClientAssignmentOptions();
  renderSpouseClientOptions();
  setClientFormMode('edit', detailedClient);
  populateAddClientFormFromClient(detailedClient);
  setHubMode('add', { preserveAddFormState: true });
  setFormMessage(`Editing ${detailedClient.firstName} ${detailedClient.lastName}.`);
};

const closeEditDialog = () => {
  byId('clientEditDialog')?.close();
  state.editingClientId = '';
};

const syncClientPortalToggleValue = () => {
  const toggle = byId('clientPortalEnabledToggle');
  const hidden = byId('clientPortalEnabledValue');
  if (!toggle || !hidden) {
    return;
  }
  hidden.value = toggle.checked ? 'on' : 'off';
};

const loadClients = async ({ showSkeleton = false } = {}) => {
  const shouldShowSkeleton = Boolean(showSkeleton) && state.clients.length === 0;
  if (shouldShowSkeleton) {
    renderClientsLoadingSkeleton();
  }

  const payload = await request('/api/clients');
  state.clients = payload.clients;
  state.clientsRenderLimit = CLIENTS_RENDER_INITIAL_LIMIT;
  if (state.pinnedClientId && !state.clients.some((client) => client.id === state.pinnedClientId)) {
    clearPinnedClientList();
  }
  state.currentUser = String(payload.currentUser || state.currentUser || 'admin').trim() || 'admin';
  applyDisputeDueDateCountdownToClients(state.clients);
  state.statuses = payload.statuses || state.statuses;
  state.phases = uniquePhaseList(payload.phases || state.phases || ['None']);
  syncStatusFilterOptions();
  renderAddClientStatusOptions();
  renderAddClientPhaseOptions();
  renderAddClientAssignmentOptions();
  renderSpouseClientOptions();
  renderClients();
  if (!state.selectedClientId) {
    setWidgetRefreshHeader(null);
    updateBrowserTabTitle(null);
  }
};

const renderClientDetailLoading = () => {
  const detail = byId('clientDetail');
  if (!detail) {
    return;
  }
  detail.innerHTML = `
    <div class="nt-client-detail-loader" role="status" aria-live="polite" aria-busy="true">
      <div class="nt-client-detail-loader-box">
        <div class="nt-client-detail-loader-overlay"></div>
        <div class="nt-client-gear one">
          <div class="nt-client-gear-inner">
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
          </div>
        </div>
        <div class="nt-client-gear two">
          <div class="nt-client-gear-inner">
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
          </div>
        </div>
        <div class="nt-client-gear three">
          <div class="nt-client-gear-inner">
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
          </div>
        </div>
        <div class="nt-client-gear four large">
          <div class="nt-client-gear-inner">
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
          </div>
        </div>
      </div>
      <h3 class="nt-client-detail-loader-text">Loading...</h3>
    </div>
  `;
};

const loadClientDetail = async (clientId) => {
  renderClientDetailLoading();
  const payload = await request(`/api/clients/${clientId}`);
  const liveClient = payload?.client ? { ...payload.client } : null;
  if (liveClient) {
    applyDisputeDueDateCountdownToClients([liveClient]);
  }
  state.selectedClientId = clientId;
  state.pinnedClientId = clientId;
  persistLearningSelectedClientId(clientId);
  state.accountCategoryFilter = 'all';
  state.clientsRenderLimit = CLIENTS_RENDER_INITIAL_LIMIT;
  const selectedName = `${payload.client?.firstName || ''} ${payload.client?.lastName || ''}`.trim();
  if (selectedName) {
    setWidgetConsoleMessage(`${selectedName} loaded. Ready to refresh.`);
  }
  renderClientDetail(liveClient || payload.client);
  renderClients();
};

const deleteClient = async (clientId) => {
  const client = state.clients.find((entry) => entry.id === clientId);
  if (!client) {
    return;
  }

  const confirmed = window.confirm(`Delete ${client.firstName} ${client.lastName}?`);
  if (!confirmed) {
    return;
  }

  await request(`/api/clients/${clientId}`, {
    method: 'DELETE',
  });

  if (state.selectedClientId === clientId) {
    state.selectedClientId = '';
    clearPinnedClientList();
    persistLearningSelectedClientId('');
    byId('clientDetail').innerHTML = '<p class="muted">Choose a client to load the credit scores.</p>';
    setWidgetRefreshHeader(null);
    updateBrowserTabTitle(null);
  }

  await loadClients();
  setFormMessage('Client deleted.');
};

const setFormMessage = (message, isError = false) => {
  const element = byId('formMessage');
  element.textContent = message;
  element.style.color = isError ? '#a33333' : '';
};

const setClientSaveProgressState = (active, value = 0) => {
  const box = byId('clientSaveProgressBox');
  const bar = byId('clientSaveProgressBar');
  const percent = byId('clientSaveProgressPercent');
  const submit = byId('clientFormSubmitButton');
  if (!box || !bar || !percent || !submit) {
    return;
  }
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  box.hidden = !active;
  bar.style.width = `${safeValue}%`;
  percent.textContent = `${safeValue}%`;
  box.querySelector('.client-save-progress-track')?.setAttribute('aria-valuenow', String(safeValue));
  submit.disabled = active;
};

const startClientSaveProgress = () => {
  if (clientSaveProgressTimer) {
    window.clearInterval(clientSaveProgressTimer);
  }
  clientSaveProgressValue = 4;
  setClientSaveProgressState(true, clientSaveProgressValue);
  clientSaveProgressTimer = window.setInterval(() => {
    if (clientSaveProgressValue >= 92) {
      return;
    }
    clientSaveProgressValue += Math.random() < 0.35 ? 2 : 1;
    setClientSaveProgressState(true, clientSaveProgressValue);
  }, 140);
};

const finishClientSaveProgress = async () => {
  if (clientSaveProgressTimer) {
    window.clearInterval(clientSaveProgressTimer);
    clientSaveProgressTimer = null;
  }
  clientSaveProgressValue = 100;
  setClientSaveProgressState(true, clientSaveProgressValue);
  await new Promise((resolve) => window.setTimeout(resolve, 240));
  setClientSaveProgressState(false, 0);
  clientSaveProgressValue = 0;
  quickSaveClientIdentityController?.reset?.();
};

const failClientSaveProgress = () => {
  if (clientSaveProgressTimer) {
    window.clearInterval(clientSaveProgressTimer);
    clientSaveProgressTimer = null;
  }
  setClientSaveProgressState(false, 0);
  clientSaveProgressValue = 0;
  quickSaveClientIdentityController?.reset?.();
  pendingQuickSaveExitToContacts = false;
};

const setCsvImportMessage = (message, isError = false) => {
  const element = byId('csvImportMessage');
  element.textContent = message;
  element.style.color = isError ? '#a33333' : '';
};

const setIntegrationMessage = (message, isError = false) => {
  const element = byId('integrationMessage');
  if (!element) {
    return;
  }
  element.textContent = message;
  element.style.color = isError ? '#a33333' : '';
};

const renderDashboard = () => {
  const shell = byId('dashboardShell');
  if (!shell) {
    return;
  }

  const clients = Array.isArray(state.clients) ? state.clients : [];
  if (!clients.length) {
    shell.innerHTML = '<p class="muted">No dashboard data yet. Add or import a client to wake Ninja Tools up.</p>';
    return;
  }

  const countWith = (predicate) => clients.filter(predicate).length;
  const formatNumber = (value) => new Intl.NumberFormat('en-US').format(Number(value) || 0);
  const now = Date.now();
  const bureauScores = {
    transunion: clients.map((client) => Number.parseFloat(client.creditScores?.transunion)).filter(Number.isFinite),
    experian: clients.map((client) => Number.parseFloat(client.creditScores?.experian)).filter(Number.isFinite),
    equifax: clients.map((client) => Number.parseFloat(client.creditScores?.equifax)).filter(Number.isFinite),
  };
  const getAverage = (values) => (values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : null);

  const monitoringLinked = countWith((client) => (
    String(client.monitoringUsername || '').trim()
    || String(client.monitoringPassword || '').trim()
    || String(client.monitoringToken || '').trim()
  ));
  const activeNinjaMembers = countWith((client) => (
    String(client.status || '').trim().toLowerCase() === 'client'
  ));
  const clientsAdded30Days = countWith((client) => {
    const createdAt = parseDateValue(client.createdAt);
    if (!createdAt) {
      return false;
    }
    return ((now - createdAt.getTime()) / (1000 * 60 * 60 * 24)) <= 30;
  });

  const freshReports = countWith((client) => {
    const parsed = parseDateValue(client.reportDate);
    if (!parsed) {
      return false;
    }
    return ((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)) <= 30;
  });

  const importNow = countWith((client) => (
    typeof client.nextImport?.daysUntilNextImport === 'number'
      && client.nextImport.daysUntilNextImport <= 0
  ));
  const importDueSoon = countWith((client) => (
    typeof client.nextImport?.daysUntilNextImport === 'number'
      && client.nextImport.daysUntilNextImport > 0
      && client.nextImport.daysUntilNextImport <= 7
  ));
  const failedPayments = countWith((client) => {
    const status = String(client.status || '').toLowerCase();
    const notes = String(client.notes || '').toLowerCase();
    return status.includes('failed payment') || notes.includes('failed payment');
  });

  const recentAdds = [...clients]
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())
    .slice(0, 5);

  const attentionClients = [...clients]
    .filter((client) => (
      (typeof client.nextImport?.daysUntilNextImport === 'number' && client.nextImport.daysUntilNextImport <= 7)
      || ['Ghosting', 'Lead', 'Prospect'].includes(String(client.status || ''))
    ))
    .sort((left, right) => {
      const leftDays = Number.isFinite(left.nextImport?.daysUntilNextImport) ? left.nextImport.daysUntilNextImport : Number.MAX_SAFE_INTEGER;
      const rightDays = Number.isFinite(right.nextImport?.daysUntilNextImport) ? right.nextImport.daysUntilNextImport : Number.MAX_SAFE_INTEGER;
      return leftDays - rightDays;
    })
    .slice(0, 6);

  const statusCounts = Array.from(clients.reduce((map, client) => {
    const key = String(client.status || 'Client').trim() || 'Client';
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map()).entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6);

  const agencyCounts = Array.from(clients.reduce((map, client) => {
    const key = normalizeMonitoringAgency(client.monitoringAgency || '') || 'unassigned';
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map()).entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5);

  const reportSourceCounts = Array.from(clients.reduce((map, client) => {
    const source = String(client.creditReportSource || 'No report').trim() || 'No report';
    map.set(source, (map.get(source) || 0) + 1);
    return map;
  }, new Map()).entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4);

  shell.innerHTML = `
    <div class="dashboard-topline">
      <div class="dashboard-title-wrap">
        <p class="eyebrow">Ninja Dashboard</p>
        <h2>Mission Control</h2>
        <p class="dashboard-subtitle">Clear control center for team activity, import deadlines, and GHL-powered follow-up priorities.</p>
      </div>
      <div class="dashboard-score-strip">
        <span class="dashboard-score-chip transunion">TU ${getAverage(bureauScores.transunion) ?? '--'}</span>
        <span class="dashboard-score-chip experian">EX ${getAverage(bureauScores.experian) ?? '--'}</span>
        <span class="dashboard-score-chip equifax">EQ ${getAverage(bureauScores.equifax) ?? '--'}</span>
      </div>
    </div>

    <div class="dashboard-card-grid dashboard-card-grid-mission">
      <article class="dashboard-stat-card">
        <span class="dashboard-stat-label">Clients Added (30d)</span>
        <strong>${formatNumber(clientsAdded30Days)}</strong>
        <small>Total vault: ${formatNumber(clients.length)}</small>
      </article>
      <article class="dashboard-stat-card">
        <span class="dashboard-stat-label">Active Ninja Members</span>
        <strong>${formatNumber(activeNinjaMembers)}</strong>
        <small>${Math.round((activeNinjaMembers / clients.length) * 100)}% of total clients</small>
      </article>
      <article class="dashboard-stat-card dashboard-stat-card-alert">
        <span class="dashboard-stat-label">Clients Import Due</span>
        <strong>${formatNumber(importNow)}</strong>
        <small>${formatNumber(importDueSoon)} more due within 7 days</small>
      </article>
      <article class="dashboard-stat-card dashboard-stat-card-alert">
        <span class="dashboard-stat-label">Failed Payments</span>
        <strong>${formatNumber(failedPayments)}</strong>
        <small>Tracked from client status/notes and GHL updates</small>
      </article>
    </div>

    <div class="dashboard-board-grid dashboard-board-grid-mission">
      <section class="dashboard-board">
        <div class="dashboard-board-head">
          <h3>Priority Queue</h3>
          <span>${attentionClients.length} flagged</span>
        </div>
        <div class="dashboard-board-list">
          ${attentionClients.length ? attentionClients.map((client) => `
            <button class="dashboard-client-row" type="button" data-dashboard-client-id="${escapeHtml(client.id)}">
              <span class="dashboard-client-name">${escapeHtml(`${client.firstName || ''} ${client.lastName || ''}`.trim())}</span>
              <span class="dashboard-client-meta">${escapeHtml(client.status || 'Client')} • ${escapeHtml(client.nextImport?.label || 'No import date')}</span>
            </button>
          `).join('') : '<p class="muted">No urgent client items right now.</p>'}
        </div>
      </section>

      <section class="dashboard-board">
        <div class="dashboard-board-head">
          <h3>Recent Adds</h3>
          <span>Newest records</span>
        </div>
        <div class="dashboard-board-list">
          ${recentAdds.map((client) => `
            <button class="dashboard-client-row is-compact" type="button" data-dashboard-client-id="${escapeHtml(client.id)}">
              <span class="dashboard-client-name">${escapeHtml(`${client.firstName || ''} ${client.lastName || ''}`.trim())}</span>
              <span class="dashboard-client-meta">${escapeHtml(client.status || 'Client')} • ${escapeHtml(client.email || client.phone || 'No email or phone')}</span>
            </button>
          `).join('')}
        </div>
      </section>

      <section class="dashboard-board">
        <div class="dashboard-board-head">
          <h3>GHL Activity Mix</h3>
          <span>Live buckets</span>
        </div>
        <div class="dashboard-pill-grid">
          ${statusCounts.map(([status, count]) => `
            <div class="dashboard-metric-pill">
              <strong>${formatNumber(count)}</strong>
              <span>${escapeHtml(status)}</span>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="dashboard-board">
        <div class="dashboard-board-head">
          <h3>Monitoring Stack</h3>
          <span>Assigned sources</span>
        </div>
        <div class="dashboard-provider-list">
          ${agencyCounts.map(([agency, count]) => `
            <div class="dashboard-provider-row">
              <span>${escapeHtml(agency.replace(/\b\w/g, (char) => char.toUpperCase()))}</span>
              <strong>${formatNumber(count)}</strong>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="dashboard-board dashboard-board-wide">
        <div class="dashboard-board-head">
          <h3>Report Sources</h3>
          <span>What powers profiles</span>
        </div>
        <div class="dashboard-provider-list">
          ${reportSourceCounts.map(([source, count]) => `
            <div class="dashboard-provider-row">
              <span>${escapeHtml(source)}</span>
              <strong>${formatNumber(count)}</strong>
            </div>
          `).join('')}
        </div>
      </section>
    </div>
  `;

  shell.querySelectorAll('[data-dashboard-client-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const clientId = button.dataset.dashboardClientId;
      if (clientId) {
        void loadClientDetail(clientId);
      }
    });
  });
};

const setWidgetConsoleMessage = (message, isError = false, append = false) => {
  const frame = document.querySelector('.hero-widget-frame');
  if (!frame?.contentWindow) {
    return;
  }

  frame.contentWindow.postMessage({
    type: 'tools-ninja:script-version',
    value: APP_SCRIPT_VERSION,
  }, window.location.origin);

  frame.contentWindow.postMessage({
    type: 'tools-ninja:console-log',
    message,
    level: isError ? 'error' : 'info',
    append: Boolean(append),
  }, window.location.origin);
};

const escapeHtml = (value) => String(value || '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const formatShortReportDate = (reportDate) => {
  const parsed = parseDateValue(reportDate);
  if (!parsed) {
    return 'No report';
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const formatReportDateMMDD = (reportDate) => {
  const parsed = parseDateValue(reportDate);
  if (!parsed) {
    return '-- --';
  }
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const formatLongReportDate = (reportDate) => {
  const parsed = parseDateValue(reportDate);
  if (!parsed) {
    return '';
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const toggleSensitiveInputVisibility = (field, revealType = 'text') => {
  if (!field) {
    return false;
  }
  const previousValue = String(field.value || '');
  const nextType = field.type === revealType ? 'password' : revealType;
  field.type = nextType;
  // Some browser/webview stacks clear password values on type flip.
  if (!field.value && previousValue) {
    field.value = previousValue;
  }
  return nextType !== 'password';
};

const getReportAgeDays = (reportDate) => {
  const parsed = parseDateValue(reportDate);
  if (!parsed) {
    return null;
  }

  return Math.max(0, getCalendarDayDiff(parsed, new Date()));
};

const setWidgetRefreshHeader = (client) => {
  const frame = document.querySelector('.hero-widget-frame');
  if (!frame?.contentWindow) {
    return;
  }

  const firstName = String(client?.firstName || '').trim();
  const longReportDate = client ? formatLongReportDate(client.reportDate) : '';
  const reportAgeDays = client ? getReportAgeDays(client.reportDate) : null;
  const dayLabel = reportAgeDays === null ? '' : `${reportAgeDays} Day${reportAgeDays === 1 ? '' : 's'}`;
  const title = client && firstName
    ? (longReportDate
        ? `Last Report Imported for ${firstName}\nwas ${longReportDate}${dayLabel ? ` (${dayLabel})` : ''}`
        : `Last Report Imported for ${firstName}\nis not available yet`)
    : '';

  frame.contentWindow.postMessage({
    type: 'tools-ninja:refresh-header',
    title,
    reportDate: '',
  }, window.location.origin);
};

const syncSelectedClientFromServer = async (clientId) => {
  const payload = await request(`/api/clients/${clientId}`);
  const incomingClient = payload.client;
  if (!incomingClient) {
    return null;
  }
  applyDisputeDueDateCountdownToClients([incomingClient]);

  const existingClient = state.clients.find((client) => client.id === incomingClient.id);
  if (existingClient) {
    Object.assign(existingClient, incomingClient);
  } else {
    state.clients.unshift(incomingClient);
  }

  const hydratedClient = state.clients.find((client) => client.id === incomingClient.id) || incomingClient;
  if (!hydratedClient.lastReportRunStatus) {
    hydratedClient.lastReportRunStatus = 'success';
  }

  renderClients();
  if (state.selectedClientId === incomingClient.id) {
    renderClientDetail(hydratedClient);
  }

  return hydratedClient;
};

const pollReportRun = async (runId, clientId, initialLogCount = 0) => {
  let lastLogCount = Number.isFinite(initialLogCount) ? initialLogCount : 0;
  let earlyHydrated = false;

  while (true) {
    const payload = await request(`/api/report-runs/${runId}`);
    const run = payload.run;
    const logLines = Array.isArray(run?.logs) ? run.logs : [];
    if (logLines.length > lastLogCount) {
      const newLines = logLines.slice(lastLogCount);
      lastLogCount = logLines.length;
      setWidgetConsoleMessage(newLines.join('\n'), run?.status === 'failed', true);

      if (!earlyHydrated && clientId) {
        const joined = newLines.join('\n');
        const successHint = /Tools Ninja sync complete|JSON loaded to NinjaTools|Smoke bomb|Script completed successfully/i.test(joined);
        if (successHint) {
          const updatedClient = await syncSelectedClientFromServer(clientId).catch(() => null);
          if (updatedClient) {
            updatedClient.lastReportRunStatus = 'success';
            renderClients();
            if (state.selectedClientId === updatedClient.id) {
              renderClientDetail(updatedClient);
              setWidgetRefreshHeader(updatedClient);
            }
            earlyHydrated = true;
          }
        }
      }
    }

    if (run?.status === 'completed') {
      const updatedClient = await syncSelectedClientFromServer(clientId);
      if (updatedClient) {
        updatedClient.lastReportRunStatus = 'success';
        if (state.selectedClientId === updatedClient.id) {
          renderClientDetail(updatedClient);
        }
      }
      return;
    }

    if (run?.status === 'failed') {
      if (clientId) {
        const updatedClient = await syncSelectedClientFromServer(clientId).catch(() => null);
        if (updatedClient) {
          updatedClient.lastReportRunStatus = 'failed';
          if (state.selectedClientId === updatedClient.id) {
            renderClientDetail(updatedClient);
          }
        }
      }
      throw new Error(run?.error || 'Browser report runner failed.');
    }

    await new Promise((resolve) => window.setTimeout(resolve, 1500));
  }
};

const triggerSelectedClientRefresh = async (forcePaid = false) => {
  if (!state.selectedClientId) {
    setRefreshLoaderRunning(false);
    setWidgetConsoleMessage('Choose a client first.', true);
    window.alert('Choose a client first.');
    return;
  }

  let refreshRunRequested = false;
  let handoffToNestedRefresh = false;
  try {
    setRefreshLoaderRunning(false);
    const selectedClient = state.clients.find((client) => client.id === state.selectedClientId);
    const activeMonitoringAgency = selectedClient?.monitoringAgency || '';
    const monitoringAgency = normalizeMonitoringAgency(activeMonitoringAgency);
    const hasMonitoringUsername = Boolean(String(selectedClient?.monitoringUsername || '').trim());
    const hasMonitoringPassword = Boolean(String(selectedClient?.monitoringPassword || '').trim());
    const hasMonitoringToken = Boolean(String(selectedClient?.monitoringToken || '').trim());
    const isMyFreeScoreNow = monitoringAgency.includes('myfree');
    const isMyFreeScoreNowTokenFlow = isMyFreeScoreNow && hasMonitoringToken;

    if (isMyFreeScoreNowTokenFlow && !hasMonitoringUsername) {
      const name = `${selectedClient?.firstName || ''} ${selectedClient?.lastName || ''}`.trim() || 'Client';
      setWidgetConsoleMessage(`${name} loaded. Ready to refresh.\nMissing monitoring credentials. Add username and client token first.`, true, true);
      return;
    }
    if (!isMyFreeScoreNowTokenFlow && (!hasMonitoringUsername || !hasMonitoringPassword)) {
      const name = `${selectedClient?.firstName || ''} ${selectedClient?.lastName || ''}`.trim() || 'Client';
      setWidgetConsoleMessage(`${name} loaded. Ready to refresh.\nMissing monitoring credentials. Add username and password first.`, true, true);
      return;
    }
    if (selectedClient) {
      selectedClient.lastReportRunStatus = 'pending';
      if (state.selectedClientId === selectedClient.id) {
        renderClientDetail(selectedClient);
      }
    }

    setWidgetConsoleMessage('Refreshing report... Lets Go !', false, true);
    setRefreshLoaderRunning(true);
    refreshRunRequested = true;
    const payload = await request(`/api/clients/${state.selectedClientId}/refresh-report`, {
      method: 'POST',
      body: JSON.stringify({ forcePaid }),
    });

    if (payload.runId) {
      const initialLogDump = Array.isArray(payload.logs) ? payload.logs.join('\n') : 'Starting browser report runner...';
      setWidgetConsoleMessage(initialLogDump, false, true);
      await pollReportRun(
        payload.runId,
        state.selectedClientId,
        Array.isArray(payload.logs) ? payload.logs.length : 0,
      );
      return;
    }

    if (payload.requiresConfirmation) {
      setWidgetConsoleMessage(payload.message || 'This report may not be free yet. Confirm to continue.');
      const confirmed = window.confirm(payload.message || 'This report may not be free yet. Continue?');
      if (!confirmed) {
        setWidgetConsoleMessage('Refresh cancelled.');
        return;
      }
      handoffToNestedRefresh = true;
      await triggerSelectedClientRefresh(true);
      return;
    }

    const target = state.clients.find((client) => client.id === state.selectedClientId);
    if (target && payload.client) {
      Object.assign(target, payload.client);
      target.lastReportRunStatus = 'success';
    }
    renderClients();
    if (payload.client && state.selectedClientId === payload.client.id) {
      const refreshedClient = state.clients.find((client) => client.id === payload.client.id) || payload.client;
      refreshedClient.lastReportRunStatus = 'success';
      renderClientDetail(refreshedClient);
      setWidgetRefreshHeader(refreshedClient);
    }
    const savePathsMessage = payload.savePaths
      ? `\nSaved current report to: ${payload.savePaths.currentClientStorePath || '[unknown]'}\nSaved report history to: ${payload.savePaths.reportHistoryDbPath || '[unknown]'}`
      : '';
    setWidgetConsoleMessage(
      (payload.message
      || (payload.orderedNewReport ? 'New report ordered and synced.' : 'Current report synced.'))
      + savePathsMessage,
    );
  } catch (error) {
    const selectedClient = state.clients.find((client) => client.id === state.selectedClientId);
    if (selectedClient) {
      selectedClient.lastReportRunStatus = 'failed';
      if (state.selectedClientId === selectedClient.id) {
        renderClientDetail(selectedClient);
      }
    }
    setWidgetConsoleMessage(error?.message || 'Refresh failed.', true, true);
  } finally {
    if (refreshRunRequested && !handoffToNestedRefresh) {
      setRefreshLoaderRunning(false);
    }
  }
};

const applyIntegrationValues = (formId, values = {}) => {
  const form = byId(formId);
  if (!form) {
    return;
  }
  if (form.pid) {
    form.pid.value = values.pid || '';
  }
  if (form.tokenId) {
    form.tokenId.value = values.tokenId || '';
  }
  if (form.apiSecret) {
    form.apiSecret.value = values.apiSecret || '';
  }
};

const loadAffiliateLinks = async () => {
  const payload = await request('/api/affiliate-links');
  state.affiliateLinks = normalizeAffiliateLinksPayload(payload.affiliateLinks || {});
};

const renderAffiliateBuilderRows = () => state.affiliateLinks.creditBuilder.map((row, index) => `
  <article class="affiliate-row-card" data-affiliate-section="creditBuilder" data-affiliate-id="${escapeHtml(row.id)}">
    <div class="affiliate-row-media">
      ${row.imagePath ? `<img class="affiliate-row-image" src="${escapeHtml(row.imagePath)}" alt="${escapeHtml(row.name || 'Affiliate logo')}" />` : '<div class="affiliate-row-image affiliate-row-image-placeholder">Logo</div>'}
      <label class="affiliate-image-upload">
        <input class="affiliate-image-input" type="file" accept="image/*" data-image-section="creditBuilder" data-image-id="${escapeHtml(row.id)}" />
        Upload
      </label>
    </div>
    <div class="affiliate-row-main">
      <label class="field">
        <span>Name</span>
        <input class="affiliate-name-input" data-affiliate-field="name" value="${escapeHtml(row.name)}" placeholder="Boom Pay" />
      </label>
      <label class="field">
        <span>Description</span>
        <input class="affiliate-description-input" data-affiliate-field="description" value="${escapeHtml(row.description)}" placeholder="Build credit with your rent." />
      </label>
      <label class="field">
        <span>Affiliate Link</span>
        <input class="affiliate-url-input" data-affiliate-field="url" value="${escapeHtml(row.url)}" placeholder="https://..." />
      </label>
    </div>
    <div class="affiliate-row-side">
      <div class="affiliate-toggle-stack">
        <label class="affiliate-toggle-line">
          <span>Show</span>
          <input class="affiliate-toggle-input" data-affiliate-field="show" type="checkbox"${row.show ? ' checked' : ''} />
        </label>
        <label class="affiliate-toggle-line">
          <span>Default</span>
          <input class="affiliate-toggle-input" data-affiliate-field="isDefault" type="checkbox"${row.isDefault ? ' checked' : ''} />
        </label>
      </div>
      <button class="affiliate-save-button" type="button" data-save-affiliate="creditBuilder" data-affiliate-id="${escapeHtml(row.id)}">Save</button>
      <span class="affiliate-row-index">#${index + 1}</span>
    </div>
  </article>
`).join('');

const renderAffiliateMonitoringRows = () => state.affiliateLinks.creditMonitoring.map((row) => `
  <article class="affiliate-row-card affiliate-row-card-monitoring" data-affiliate-section="creditMonitoring" data-affiliate-id="${escapeHtml(row.id)}">
    <div class="affiliate-row-media">
      ${row.imagePath ? `<img class="affiliate-row-image" src="${escapeHtml(row.imagePath)}" alt="${escapeHtml(row.name || 'Affiliate logo')}" />` : '<div class="affiliate-row-image affiliate-row-image-placeholder">Logo</div>'}
      <label class="affiliate-image-upload">
        <input class="affiliate-image-input" type="file" accept="image/*" data-image-section="creditMonitoring" data-image-id="${escapeHtml(row.id)}" />
        Upload
      </label>
    </div>
    <div class="affiliate-row-main">
      <span class="affiliate-launch-pill">${escapeHtml(row.name)} Partner Signup</span>
      <label class="field">
        <span>Affiliate Link</span>
        <input class="affiliate-url-input" data-affiliate-field="url" value="${escapeHtml(row.url)}" placeholder="https://..." />
      </label>
    </div>
    <div class="affiliate-row-side">
      <div class="affiliate-toggle-stack">
        <label class="affiliate-toggle-line">
          <span>Show</span>
          <input class="affiliate-toggle-input" data-affiliate-field="show" type="checkbox"${row.show ? ' checked' : ''} />
        </label>
        <label class="affiliate-toggle-line">
          <span>Default</span>
          <input class="affiliate-toggle-input" data-affiliate-field="isDefault" type="checkbox"${row.isDefault ? ' checked' : ''} />
        </label>
      </div>
      <button class="affiliate-save-button" type="button" data-save-affiliate="creditMonitoring" data-affiliate-id="${escapeHtml(row.id)}">Save</button>
    </div>
  </article>
`).join('');

const syncAffiliateTabs = () => {
  const tabs = [...document.querySelectorAll('[data-affiliate-tab-target]')];
  tabs.forEach((button) => {
    const isActive = button.dataset.affiliateTabTarget === state.activeAffiliateTab;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  const builderPanel = byId('affiliateBuilderPanel');
  const monitoringPanel = byId('affiliateMonitoringPanel');
  if (builderPanel) {
    builderPanel.hidden = state.activeAffiliateTab !== 'creditBuilder';
  }
  if (monitoringPanel) {
    monitoringPanel.hidden = state.activeAffiliateTab !== 'creditMonitoring';
  }
};

const renderAffiliateLinksDialog = () => {
  const builder = byId('affiliateBuilderRows');
  const monitoring = byId('affiliateMonitoringRows');
  if (!builder || !monitoring) {
    return;
  }

  builder.innerHTML = renderAffiliateBuilderRows() || '<p class="affiliate-empty-state">No credit builder affiliate links yet. Click Add Affiliate Link to start.</p>';
  monitoring.innerHTML = renderAffiliateMonitoringRows();
  syncAffiliateTabs();
};

const collectAffiliateRowsFromDom = (section) => {
  const rows = [...document.querySelectorAll(`[data-affiliate-section="${section}"]`)];
  return rows.map((row) => ({
    id: row.dataset.affiliateId || '',
    name: row.querySelector('[data-affiliate-field="name"]')?.value || (affiliateMonitoringFallbacks[row.dataset.affiliateId]?.name || ''),
    description: row.querySelector('[data-affiliate-field="description"]')?.value || '',
    url: row.querySelector('[data-affiliate-field="url"]')?.value || '',
    imagePath: row.dataset.imagePath || '',
    imageDataUrl: row.dataset.imageDataUrl || '',
    show: row.querySelector('[data-affiliate-field="show"]')?.checked || false,
    isDefault: row.querySelector('[data-affiliate-field="isDefault"]')?.checked || false,
  }));
};

const openAffiliateLinksDialog = () => {
  renderAffiliateLinksDialog();
  byId('affiliateLinksDialog')?.showModal();
};

const closeAffiliateLinksDialog = () => {
  byId('affiliateLinksDialog')?.close();
};

const saveAffiliateSection = async (section) => {
  const rows = collectAffiliateRowsFromDom(section);
  const payload = await request(`/api/affiliate-links/${section === 'creditBuilder' ? 'credit-builder' : 'credit-monitoring'}`, {
    method: 'PUT',
    body: JSON.stringify({ rows }),
  });

  state.affiliateLinks[section] = payload.rows || [];
  renderAffiliateLinksDialog();
  setIntegrationMessage(section === 'creditBuilder' ? 'Credit Builder affiliate links saved.' : 'Credit Monitoring affiliate links saved.');
};

const loadIntegrations = async () => {
  const payload = await request('/api/integrations');
  state.integrations = payload.integrations || state.integrations;
  const smartCreditDefault = state.integrations.smartcredit35540
    || state.integrations.smartcredit
    || { tokenId: '', apiSecret: '' };
  applyIntegrationValues('smartCreditIntegrationForm', smartCreditDefault);
  applyIntegrationValues('myFreeScoreIntegrationForm', state.integrations.myfreescorenow);
  if (state.selectedClientId) {
    const selectedClient = state.clients.find((client) => client.id === state.selectedClientId);
    if (selectedClient) {
      renderClientDetail(selectedClient);
    }
  }
};

const bindEvents = () => {
  byId('clientHubSwitch')?.querySelectorAll('[data-hub-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      const switcher = byId('clientHubSwitch');
      const index = Number(button.dataset.index || '3');
      button.classList.add('initialised');
      if (switcher) {
        switcher.classList.add('moving');
        if (previousHubIndex === -1) {
          switcher.querySelector('.icon[data-index="2"]')?.classList.add('initialised');
        }
        if ((previousHubIndex === 1 && index === 3) || (previousHubIndex === 3 && index === 1)) {
          const middle = switcher.querySelector('.icon[data-index="2"]');
          middle?.classList.remove('initialised');
          window.setTimeout(() => middle?.classList.add('initialised'), 0);
        }
        window.setTimeout(() => {
          switcher.classList.remove('moving');
        }, 750);
      }
      previousHubIndex = index;
      setHubMode(button.dataset.hubMode || 'clients');
    });
  });
  setHubMode(state.hubMode);
  renderAddClientStatusOptions();
  renderAddClientPhaseOptions();
  renderAddClientAssignmentOptions();
  renderSpouseClientOptions();
  resetAddClientDerivedState();

  const homeForm = byId('homeSettingsForm');
  const homeLogoInput = byId('homeLogoInput');
  homeForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const settings = collectHomeSettingsFromDom();
    writeHomeSettings(settings);
    await saveBusinessSettingsToServer(settings);
    syncBusinessAssetsToWidget(settings);
    updateHomeFromPreview();
    applyDisputeDueDateCountdownToClients(state.clients);
    renderClients();
    if (state.selectedClientId) {
      const selected = state.clients.find((client) => client.id === state.selectedClientId);
      if (selected) {
        renderClientDetail(selected);
      }
    }
    setHomeSettingsMessage('Business settings saved.');
    setHubMode('clients');
  });

  homeLogoInput?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      const preview = byId('homeLogoPreview');
      const placeholder = byId('homeLogoPlaceholder');
      preview.src = dataUrl;
      preview.hidden = false;
      placeholder.hidden = true;
      const settings = collectHomeSettingsFromDom();
      writeHomeSettings(settings);
      await saveBusinessSettingsToServer(settings);
      syncBusinessAssetsToWidget(settings);
      setHomeSettingsMessage('Logo updated and saved.');
    } catch (error) {
      setHomeSettingsMessage(error.message, true);
    }
  });

  byId('homeColorSwatches')?.querySelectorAll('[data-home-color]').forEach((button) => {
    button.addEventListener('click', () => {
      byId('homeColorSwatches')?.querySelectorAll('[data-home-color]').forEach((entry) => entry.classList.remove('is-active'));
      button.classList.add('is-active');
      applyBrandColor(button.dataset.homeColor || '#0000ff');
    });
  });

  ['homeCompanyName', 'homeSenderName', 'homeEmailDomain'].forEach((id) => {
    byId(id)?.addEventListener('input', updateHomeFromPreview);
  });

  document.querySelector('#clientForm input[name="firstName"]')?.addEventListener('input', () => {
    syncDerivedClientCredentials();
  });
  document.querySelector('#clientForm input[name="lastName"]')?.addEventListener('input', () => {
    syncDerivedClientCredentials();
  });
  document.querySelector('#clientForm input[name="ssn"]')?.addEventListener('input', (event) => {
    const digits = String(event.target.value || '').replace(/\D/g, '').slice(0, 9);
    if (digits.length > 5) {
      event.target.value = `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
    } else if (digits.length > 3) {
      event.target.value = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    } else {
      event.target.value = digits;
    }
    syncDerivedClientCredentials();
  });
  document.querySelector('#clientForm input[name="dob"]')?.addEventListener('input', (event) => {
    const digits = String(event.target.value || '').replace(/\D/g, '').slice(0, 8);
    if (digits.length > 4) {
      event.target.value = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      event.target.value = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else {
      event.target.value = digits;
    }
  });
  document.querySelector('#clientForm input[name="addressState"]')?.addEventListener('input', (event) => {
    event.target.value = String(event.target.value || '').replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase();
  });
  document.querySelector('#clientForm input[name="addressZip"]')?.addEventListener('input', (event) => {
    const digits = String(event.target.value || '').replace(/\D/g, '').slice(0, 9);
    if (digits.length > 5) {
      event.target.value = `${digits.slice(0, 5)}-${digits.slice(5)}`;
    } else {
      event.target.value = digits;
    }
  });
  byId('clientPortalPasswordInput')?.addEventListener('input', () => {
    addClientPortalPasswordManual = true;
  });
  byId('clientPortalPasswordInput')?.addEventListener('paste', () => {
    addClientPortalPasswordManual = true;
  });
  byId('clientSecretKeyInput')?.addEventListener('input', () => {
    addClientSecretKeyManual = true;
  });
  byId('clientSecretKeyInput')?.addEventListener('paste', () => {
    addClientSecretKeyManual = true;
  });
  document.querySelector('#clientForm select[name="monitoringAgency"]')?.addEventListener('change', () => {
    updateClientMonitoringCredentialLayout();
  });
  document.querySelectorAll('#clientForm [data-password-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const fieldName = button.getAttribute('data-password-toggle');
      const field = fieldName ? document.querySelector(`#clientForm [name="${fieldName}"]`) : null;
      if (!field) {
        return;
      }
      const nextVisible = toggleSensitiveInputVisibility(field, 'text');
      button.setAttribute('aria-pressed', nextVisible ? 'true' : 'false');
      button.setAttribute('aria-label', nextVisible ? 'Hide value' : 'Show value');
      button.textContent = nextVisible ? '◑' : '◐';
    });
  });
  byId('clientPortalEnabledToggle')?.addEventListener('change', syncClientPortalToggleValue);
  syncClientPortalToggleValue();
  document.querySelectorAll('#clientForm [data-form-segment-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      setClientFormSegment(tab.dataset.formSegmentTab || 'client');
    });
  });
  setClientFormSegment('client');
  updateClientMonitoringCredentialLayout();
  byId('spouseClientSearch')?.addEventListener('input', syncSelectedSpouseClient);
  byId('spouseClientSearch')?.addEventListener('change', syncSelectedSpouseClient);
  byId('clientAddressInput')?.addEventListener('input', (event) => {
    queueAddressSuggestions(event.target.value);
  });
  byId('clientAddressInput')?.addEventListener('paste', (event) => {
    const clipboardText = event?.clipboardData?.getData('text') || '';
    const pasted = String(clipboardText || '').trim();
    window.setTimeout(() => {
      const currentValue = String(byId('clientAddressInput')?.value || '').trim();
      const valueToSearch = pasted || currentValue;
      queueAddressSuggestions(valueToSearch);
      applyAddressSuggestionSelection(currentValue || valueToSearch);
    }, 0);
  });
  byId('clientAddressInput')?.addEventListener('change', (event) => {
    applyAddressSuggestionSelection(event.target.value);
    queueAddressSuggestions(event.target.value);
  });
  byId('clientAddressInput')?.addEventListener('blur', (event) => {
    applyAddressSuggestionSelection(event.target.value);
  });
  byId('addCustomDocumentButton')?.addEventListener('click', () => {
    const type = window.prompt('Document type (required):');
    if (type === null) {
      return;
    }
    const cleanType = String(type || '').trim();
    if (!cleanType) {
      setFormMessage('Document type is required.', true);
      return;
    }
    const existing = collectClientDocumentsFromForm();
    existing.push({
      id: `doc-custom-${Date.now()}`,
      type: cleanType,
      includeInPrintLetters: false,
      printSide: 'front',
      fileName: '',
      fileDataUrl: '',
      fileType: '',
      fileSize: null,
      isCustom: true,
    });
    renderClientDocumentsSection(existing);
  });
  byId('clientDocumentsList')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-doc-action="remove"]');
    if (!button) {
      return;
    }
    const removeId = button.dataset.docId;
    const remaining = collectClientDocumentsFromForm().filter((entry) => entry.id !== removeId);
    renderClientDocumentsSection(remaining);
  });

  byId('searchInput')?.addEventListener('input', (event) => {
    const previousQuery = state.query;
    state.query = event.target.value;
    state.clientsRenderLimit = CLIENTS_RENDER_INITIAL_LIMIT;
    if (state.pinnedClientId && state.query !== previousQuery) {
      clearPinnedClientList();
    }
    const wasFiltering = shouldApplyClientSearch(previousQuery);
    const isFiltering = shouldApplyClientSearch(state.query);
    if (!isFiltering && !wasFiltering) {
      return;
    }
    queueClientSearchRender();
  });

  byId('statusFilter')?.addEventListener('change', (event) => {
    state.statusFilter = event.target.value;
    state.clientsRenderLimit = CLIENTS_RENDER_INITIAL_LIMIT;
    clearPinnedClientList();
    state.selectedClientId = '';
    persistLearningSelectedClientId('');
    updateBrowserTabTitle(null);
    renderClients();
  });

  byId('affiliateLinksLaunch')?.addEventListener('click', openAffiliateLinksDialog);
  byId('billingQuickAction')?.addEventListener('click', () => {
    window.location.href = '/payments';
  });
  byId('disputeQuickAction')?.addEventListener('click', () => {
    setHubMode('clients');
  });
  byId('affiliateLinksClose')?.addEventListener('click', closeAffiliateLinksDialog);
  byId('affiliateLinksDialog')?.addEventListener('click', (event) => {
    const dialog = event.currentTarget;
    const rect = dialog.getBoundingClientRect();
    const inside = (
      event.clientX >= rect.left
      && event.clientX <= rect.right
      && event.clientY >= rect.top
      && event.clientY <= rect.bottom
    );
    if (!inside) {
      closeAffiliateLinksDialog();
    }
  });
  document.querySelectorAll('[data-affiliate-tab-target]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeAffiliateTab = button.dataset.affiliateTabTarget || 'creditBuilder';
      syncAffiliateTabs();
    });
  });
  byId('affiliateAddBuilderRow')?.addEventListener('click', () => {
    state.affiliateLinks.creditBuilder.push(normalizeAffiliateRow({
      id: `builder-${Date.now()}`,
      name: '',
      description: '',
      url: '',
      imagePath: '',
      show: false,
      isDefault: false,
    }));
    renderAffiliateLinksDialog();
  });
  byId('affiliateLinksDialog')?.addEventListener('click', async (event) => {
    const saveButton = event.target.closest('[data-save-affiliate]');
    if (saveButton) {
      try {
        setIntegrationMessage('');
        await saveAffiliateSection(saveButton.dataset.saveAffiliate);
      } catch (error) {
        setIntegrationMessage(error.message, true);
      }
      return;
    }
  });
  byId('affiliateLinksDialog')?.addEventListener('change', async (event) => {
    const target = event.target;
    if (target.matches('[data-affiliate-field="isDefault"]')) {
      const section = target.closest('[data-affiliate-section]')?.dataset.affiliateSection;
      if (target.checked && section) {
        document.querySelectorAll(`[data-affiliate-section="${section}"] [data-affiliate-field="isDefault"]`).forEach((input) => {
          if (input !== target) {
            input.checked = false;
          }
        });
      }
      try {
        await saveAffiliateSection(section);
      } catch (error) {
        setIntegrationMessage(error.message, true);
      }
      return;
    }

    if (target.matches('[data-affiliate-field="show"]')) {
      const section = target.closest('[data-affiliate-section]')?.dataset.affiliateSection;
      try {
        await saveAffiliateSection(section);
      } catch (error) {
        setIntegrationMessage(error.message, true);
      }
      return;
    }

    if (target.matches('.affiliate-image-input')) {
      const section = target.dataset.imageSection;
      const rowId = target.dataset.imageId;
      const rowElement = document.querySelector(`[data-affiliate-section="${section}"][data-affiliate-id="${rowId}"]`);
      const file = target.files?.[0];
      if (!rowElement || !file) {
        return;
      }

      try {
        const dataUrl = await readImageFileAsDataUrl(file);
        rowElement.dataset.imageDataUrl = dataUrl;
        const preview = rowElement.querySelector('.affiliate-row-image');
        if (preview) {
          preview.src = dataUrl;
        } else {
          const placeholder = rowElement.querySelector('.affiliate-row-image-placeholder');
          if (placeholder) {
            placeholder.outerHTML = `<img class="affiliate-row-image" src="${escapeHtml(dataUrl)}" alt="Affiliate logo preview" />`;
          }
        }
      } catch (error) {
        setIntegrationMessage(error.message, true);
      }
    }
  });

  byId('clientEditClose')?.addEventListener('click', closeEditDialog);
  byId('clientEditCancel')?.addEventListener('click', closeEditDialog);
  byId('clientEditDialog')?.addEventListener('click', (event) => {
    const dialog = event.currentTarget;
    const rect = dialog.getBoundingClientRect();
    const inside = (
      event.clientX >= rect.left
      && event.clientX <= rect.right
      && event.clientY >= rect.top
      && event.clientY <= rect.bottom
    );
    if (!inside) {
      closeEditDialog();
    }
  });
  quickSaveClientIdentityController = createQuickSaveClientIdentityController();
  byId('clientEditForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.editingClientId) {
      return;
    }

    try {
      const form = event.currentTarget;
      const payload = await request(`/api/clients/${state.editingClientId}/profile`, {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: form.firstName.value,
          lastName: form.lastName.value,
          status: form.status.value,
          phase: form.phase?.value || 'None',
          phone: form.phone.value,
          email: form.email.value,
          pid: form.pid?.value,
          nextImportInt: form.nextImportInt.value,
          monitoringAgency: form.monitoringAgency.value,
        }),
      });

      state.statuses = payload.statuses || state.statuses;
      state.phases = uniquePhaseList(payload.phases || state.phases || ['None']);
      const target = state.clients.find((client) => client.id === state.editingClientId);
      if (target) {
        Object.assign(target, payload.client);
      }
      closeEditDialog();
      syncStatusFilterOptions();
      renderClients();
      if (state.selectedClientId === payload.client.id) {
        renderClientDetail(payload.client);
      }
    } catch (error) {
      setFormMessage(error.message, true);
    }
  });

  byId('clientForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setFormMessage('');
    startClientSaveProgress();
    const shouldExitToContacts = pendingQuickSaveExitToContacts;

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      syncSelectedSpouseClient();
      syncDerivedClientCredentials();
      const address = buildCombinedAddress({
        street: String(formData.get('address') || '').trim(),
        city: String(formData.get('addressCity') || '').trim(),
        state: String(formData.get('addressState') || '').trim(),
        zip: String(formData.get('addressZip') || '').trim(),
      });
      const payloadBody = {
        firstName: String(formData.get('firstName') || '').trim(),
        lastName: String(formData.get('lastName') || '').trim(),
        email: String(formData.get('email') || '').trim(),
        dob: String(formData.get('dob') || '').trim(),
        ssn: String(formData.get('ssn') || '').trim(),
        address,
        phone: String(formData.get('phone') || '').trim(),
        spouseClientId: String(formData.get('spouseClientId') || '').trim(),
        spouseClientLabel: String(formData.get('spouseClientSearch') || '').trim(),
        assignedTo: String(formData.get('assignedTo') || formData.get('ninjaAssigned') || '').trim(),
        status: String(formData.get('status') || '').trim() || 'Client',
        phase: String(formData.get('phase') || '').trim() || 'None',
        ninjaAssigned: String(formData.get('ninjaAssigned') || '').trim(),
        affiliateAssigned: String(formData.get('affiliateAssigned') || 'None').trim() || 'None',
        monitoringAgency: String(formData.get('monitoringAgency') || '').trim(),
        monitoringUsername: String(formData.get('monitoringUsername') || '').trim(),
        monitoringPassword: String(formData.get('monitoringPassword') || '').trim(),
        secretKey: String(formData.get('secretKey') || '').trim(),
        monitoringToken: String(formData.get('monitoringToken') || '').trim(),
        portalPassword: String(formData.get('portalPassword') || '').trim(),
        portalEnabled: String(formData.get('portalEnabled') || 'on').trim(),
        language: String(formData.get('language') || 'English').trim(),
        documents: collectClientDocumentsFromForm(),
      };

      let savedClientId = '';
      let wasUpdate = false;
      if (state.addFormEditingClientId) {
        const payload = await request(`/api/clients/${state.addFormEditingClientId}/profile`, {
          method: 'PATCH',
          body: JSON.stringify(payloadBody),
        });
        savedClientId = payload?.client?.id || state.addFormEditingClientId;
        wasUpdate = true;
        setFormMessage('Client updated.');
      } else {
        const payload = await request('/api/clients', {
          method: 'POST',
          body: JSON.stringify(payloadBody),
        });
        savedClientId = payload?.client?.id || '';
        setFormMessage('Client saved.');
      }

      if (shouldExitToContacts) {
        await finishClientSaveProgress();
        setHubMode('clients');
        loadClients().catch(() => {});
      } else if (wasUpdate) {
        await finishClientSaveProgress();
        await loadClients();
        // Keep user on Add/Edit with current data visible after save.
        setHubMode('add', { preserveAddFormState: true });
        if (savedClientId) {
          const refreshedClient = state.clients.find((entry) => entry.id === savedClientId);
          if (refreshedClient) {
            setClientFormMode('edit', refreshedClient);
            populateAddClientFormFromClient(refreshedClient);
          }
        }
      } else {
        await finishClientSaveProgress();
        await loadClients();
        // New record flow keeps prior behavior.
        setHubMode('clients');
        form.reset();
        setClientFormMode('add');
        resetAddClientDerivedState();
      }
      pendingQuickSaveExitToContacts = false;
    } catch (error) {
      failClientSaveProgress();
      setFormMessage(error.message, true);
    }
  });

  byId('clientsCsv')?.addEventListener('change', () => {
    const file = byId('clientsCsv')?.files?.[0];
    if (!file) {
      return;
    }
    byId('csvImportForm')?.requestSubmit();
  });

  byId('csvImportForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setCsvImportMessage('');

    try {
      const form = event.currentTarget;
      const file = byId('clientsCsv').files[0];
      const csvText = await readCsvFile(file);
      const rows = mapCsvRowsToClients(parseCsvText(csvText));

      if (!rows.length) {
        throw new Error('No valid client rows were found in this CSV.');
      }

      const payload = await request('/api/clients/import-csv', {
        method: 'POST',
        body: JSON.stringify({ rows }),
      });

      form.reset();
      setCsvImportMessage(`Imported ${payload.importedCount} clients.`);
      await loadClients();
    } catch (error) {
      setCsvImportMessage(error.message, true);
    }
  });

  byId('smartCreditIntegrationForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setIntegrationMessage('');

    try {
      const form = event.currentTarget;
      const payload = await request('/api/integrations/smartcredit35540', {
        method: 'PUT',
        body: JSON.stringify({
          tokenId: form.tokenId.value,
          apiSecret: form.apiSecret.value,
        }),
      });
      state.integrations.smartcredit35540 = payload.integration;
      applyIntegrationValues('smartCreditIntegrationForm', payload.integration);
      setIntegrationMessage('SmartCredit integration saved.');
    } catch (error) {
      setIntegrationMessage(error.message, true);
    }
  });

  byId('myFreeScoreIntegrationForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setIntegrationMessage('');

    try {
      const form = event.currentTarget;
      const payload = await request('/api/integrations/myfreescorenow', {
        method: 'PUT',
        body: JSON.stringify({
          pid: form.pid?.value || '',
          tokenId: form.tokenId.value,
          apiSecret: form.apiSecret.value,
        }),
      });
      state.integrations.myfreescorenow = payload.integration;
      applyIntegrationValues('myFreeScoreIntegrationForm', payload.integration);
      setIntegrationMessage('MyFreeScoreNow integration saved.');
    } catch (error) {
      setIntegrationMessage(error.message, true);
    }
  });

  byId('ninjaDisplay')?.addEventListener('click', () => {
    const ninja = byId('ninjaDisplay');
    ninja.classList.remove('is-animating');
    void ninja.offsetWidth;
    ninja.classList.add('is-animating');
  });

  byId('ninjaDisplay')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    byId('ninjaDisplay')?.click();
  });

  byId('ninjaDisplay')?.addEventListener('animationend', () => {
    byId('ninjaDisplay')?.classList.remove('is-animating');
  });

  const heroWidgetFrame = document.querySelector('.hero-widget-frame');
  heroWidgetFrame?.addEventListener('load', () => {
    heroWidgetFrame.contentWindow?.postMessage({
      type: 'tools-ninja:script-version',
      value: APP_SCRIPT_VERSION,
    }, window.location.origin);
    syncBusinessAssetsToWidget(readHomeSettings());
  });

  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) {
      return;
    }
    if (event.data?.type === 'tools-ninja:request-script-version') {
      heroWidgetFrame?.contentWindow?.postMessage({
        type: 'tools-ninja:script-version',
        value: APP_SCRIPT_VERSION,
      }, window.location.origin);
      return;
    }
    if (event.data?.type === 'tools-ninja:refresh-report') {
      void triggerSelectedClientRefresh();
      return;
    }
    if (event.data?.type === 'tools-ninja:hub-mode') {
      const requestedMode = String(event.data.mode || '').trim();
      if (requestedMode === 'add') {
        setHubMode('add');
        return;
      }
      if (requestedMode === 'home') {
        setHubMode('home');
        return;
      }
      setHubMode('clients');
    }
  });
};

const initHeroGlowButtons = async () => {
  // Intentionally no-op: keep Billing/Dispute buttons isolated to CSS animation only.
};

const initSetupAiPromptsButton = () => {
  const button = byId('setupAiPromptsAction');
  if (!button) {
    return;
  }

  button.addEventListener('pointermove', (event) => {
    const rect = button.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    button.style.setProperty('--sap-ai-x', `${x}px`);
    button.style.setProperty('--sap-ai-y', `${y}px`);
  });

  button.addEventListener('pointerleave', () => {
    button.style.setProperty('--sap-ai-x', '50%');
    button.style.setProperty('--sap-ai-y', '50%');
  });
};

const initDeferredSkeletonImages = () => {
  const images = [...document.querySelectorAll('img.tn-lazy-image[data-src]')];
  if (!images.length) {
    return;
  }
  const schedule = typeof window.requestIdleCallback === 'function'
    ? (fn) => window.requestIdleCallback(fn, { timeout: 1500 })
    : (fn) => window.setTimeout(fn, 80);
  const promoteImage = (img) => {
    const src = String(img.dataset.src || '').trim();
    if (!src || img.dataset.lazyLoaded === '1') {
      return;
    }
    img.dataset.lazyLoaded = '1';
    const loader = new Image();
    loader.decoding = 'async';
    loader.loading = 'lazy';
    const finish = () => {
      img.src = src;
      img.classList.add('is-loaded');
    };
    loader.onload = finish;
    loader.onerror = finish;
    loader.src = src;
  };
  images.forEach((img, index) => {
    schedule(() => window.setTimeout(() => promoteImage(img), index * 65));
  });
};

let appBootstrapped = false;

const bootstrapApp = () => {
  if (appBootstrapped) {
    return;
  }
  appBootstrapped = true;

  const initialHomeSettings = readHomeSettings();
  applyBrandColor(initialHomeSettings.companyColor || '#0000ff', { notifyWidget: false });
  applyHomeSettingsToDom(initialHomeSettings);
  syncBusinessAssetsToWidget(initialHomeSettings);
  fetchBusinessSettingsFromServer().then((serverSettings) => {
    if (!serverSettings) {
      return;
    }
    const merged = {
      ...readHomeSettings(),
      ...serverSettings,
    };
    writeHomeSettings(merged);
    applyHomeSettingsToDom(merged);
    syncBusinessAssetsToWidget(merged);
  });
  void initHeroGlowButtons().catch((error) => {
    console.warn('Hero glow bootstrap failed.', error);
  });
  initSetupAiPromptsButton();
  initDeferredSkeletonImages();
  bindEvents();
  setClientFormMode('add');
  setBootLoadingOverlay(true, 'Loading Ninja Tools...');
  loadClients({ showSkeleton: true })
    .then(() => {
      const backgroundLoad = () => {
        Promise.allSettled([loadIntegrations(), loadAffiliateLinks()]).then((results) => {
          const rejected = results.find((entry) => entry.status === 'rejected');
          if (rejected?.reason?.message) {
            setFormMessage(rejected.reason.message, true);
          }
          setBootLoadingOverlay(false);
        });
      };

      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(backgroundLoad, { timeout: 1200 });
      } else {
        window.setTimeout(backgroundLoad, 0);
      }
    })
    .catch((error) => {
      setBootLoadingOverlay(false);
      setFormMessage(error.message, true);
    });

  if (window.location.protocol === 'file:') {
    setFormMessage('Connected to the local CRM server at http://127.0.0.1:3017.');
  }
};

const reportBootstrapFailure = (error) => {
  console.error('NinjaTools bootstrap failed:', error);
  try {
    setBootLoadingOverlay(false);
    const message = error?.message ? `Startup failed: ${error.message}` : 'Startup failed. Check browser console.';
    setFormMessage(message, true);
    const integrationMessage = byId('integrationMessage');
    if (integrationMessage) {
      integrationMessage.textContent = message;
      integrationMessage.classList.add('is-error');
    }
  } catch (innerError) {
    console.error('Failed to show bootstrap failure message:', innerError);
  }
};

const safeBootstrapApp = () => {
  try {
    bootstrapApp();
  } catch (error) {
    reportBootstrapFailure(error);
  }
};

const shouldDelayBootstrapForAuth =
  document.documentElement.classList.contains('auth-active')
  || document.body.classList.contains('auth-active')
  || document.querySelector('.login-form')?.style.display !== 'none';

if (shouldDelayBootstrapForAuth) {
  window.addEventListener('toolsninja:app-show', safeBootstrapApp, { once: true });
} else {
  safeBootstrapApp();
}
