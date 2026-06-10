(function initAuthPage() {
  if (window.ND_HASH_SHELL_ACTIVE || String(window.location.hash || '').startsWith('#/')) {
    return;
  }

  const pageShell = document.querySelector('.page-shell');
  const authMessage = document.getElementById('authMessage');
  const logoutButton = document.getElementById('logoutButton');
  const gateShell = document.getElementById('ssoRedirectShell');
  const ultraButton = document.getElementById('ultraSignInButton');
  const root = document.documentElement;
  const body = document.body;
  const ULTRA_LOGIN_URL = 'https://auth.ultradispute.com/login?provider=google&redirect=https://ninjacore.ninjadispute.com/dashboard.html';

  const showMessage = (message, isError = false) => {
    if (!authMessage) return;
    authMessage.textContent = String(message || '');
    authMessage.classList.toggle('is-error', Boolean(isError));
  };

  const showApp = () => {
    root.classList.remove('auth-active');
    body.classList.remove('auth-active');
    if (gateShell) gateShell.style.display = 'none';
    if (pageShell) pageShell.style.display = 'block';
    window.dispatchEvent(new Event('toolsninja:app-show'));
  };

  const showGate = (message = 'Redirecting to UltraDispute...') => {
    root.classList.add('auth-active');
    body.classList.add('auth-active');
    if (gateShell) gateShell.style.display = 'flex';
    if (pageShell) pageShell.style.display = 'none';
    showMessage(message, false);
  };

  const redirectToUltra = () => {
    showGate('Redirecting to UltraDispute...');
    window.setTimeout(() => {
      if (window.location.href !== ULTRA_LOGIN_URL) {
        window.location.replace(ULTRA_LOGIN_URL);
      }
    }, 250);
  };

  const trySSOLogin = async (token) => {
    if (!token) return false;
    try {
      const res = await fetch('/api/auth/sso-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return Boolean(data?.authenticated);
      }
    } catch {}
    return false;
  };

  const getUrlSsoToken = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('sso_token') || null;
  };

  ultraButton?.setAttribute('href', ULTRA_LOGIN_URL);

  logoutButton?.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' }).catch(() => {
      document.cookie = 'txn=; Path=/; Max-Age=0; SameSite=Lax';
    });
    showMessage('');
    window.location.replace('https://ultradispute.com/');
  });

  (async () => {
    try {
      const response = await fetch('/api/auth/status');
      const payload = await response.json().catch(() => ({}));
      if (payload?.authenticated) {
        showApp();
        return;
      }
    } catch {}

    const urlToken = getUrlSsoToken();
    if (urlToken) {
      history.replaceState(null, '', window.location.pathname + window.location.hash);
      showGate('Finishing UltraDispute sign-in...');
      if (await trySSOLogin(urlToken)) {
        showApp();
        return;
      }
      showGate('UltraDispute sign-in failed. Redirecting back to login...');
      redirectToUltra();
      return;
    }
    redirectToUltra();
  })();
})();
