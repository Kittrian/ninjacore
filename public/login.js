(function initAuthPage() {
  const loginForm = document.querySelector('.login-form');
  const pageShell = document.querySelector('.page-shell');
  const authMessage = document.getElementById('authMessage');
  const googleSignInWrap = document.getElementById('googleSignInWrap');
  const logoutButton = document.getElementById('logoutButton');
  const root = document.documentElement;
  const body = document.body;

  const showMessage = (message, isError = false) => {
    if (!authMessage) return;
    authMessage.textContent = String(message || '');
    authMessage.classList.toggle('is-error', Boolean(isError));
  };

  const showApp = () => {
    root.classList.remove('auth-active');
    body.classList.remove('auth-active');
    if (loginForm) loginForm.style.display = 'none';
    if (pageShell) pageShell.style.display = 'block';
    window.dispatchEvent(new Event('toolsninja:app-show'));
  };

  const showLogin = () => {
    root.classList.add('auth-active');
    body.classList.add('auth-active');
    if (loginForm) loginForm.style.display = '';
    if (pageShell) pageShell.style.display = 'none';
  };

  const api = async (url, payload) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || 'Request failed.');
    }
    return body;
  };

  const checkSession = async () => {
    try {
      const response = await fetch('/api/auth/status');
      const payload = await response.json().catch(() => ({}));
      if (payload?.authenticated) {
        showApp();
      } else {
        showLogin();
      }
    } catch {
      showLogin();
    }
  };

  const handleGoogleLogin = async (response) => {
    const googleToken = String(response?.credential || '').trim();
    if (!googleToken) {
      showMessage('Google sign-in failed: missing credential.', true);
      return;
    }

    try {
      showMessage('Signing in with Google...');
      const endpoints = ['/api/auth/google-login', 'https://vault.ninjadispute.com/api/auth/google-login'];
      let authPayload = null;
      let lastError = null;

      for (const endpoint of endpoints) {
        try {
          const authResponse = await api(endpoint, { token: googleToken });
          authPayload = authResponse;
          break;
        } catch (error) {
          lastError = error;
        }
      }

      if (!authPayload?.token) {
        throw lastError || new Error('Google login failed.');
      }

      localStorage.setItem('jwtToken', authPayload.token);
      showMessage('');
      showApp();
    } catch (error) {
      showMessage(error.message || 'Google login failed.', true);
    }
  };

  window.handleGoogleLogin = handleGoogleLogin;
  if (googleSignInWrap) {
    googleSignInWrap.hidden = true;
  }

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = String(document.getElementById('username')?.value || '').trim();
    const password = String(document.getElementById('password')?.value || '');
    if (!username || !password) {
      showMessage('Enter username and password.', true);
      return;
    }
    try {
      showMessage('Signing in...');
      await api('/api/login', { username, password });
      showMessage('');
      showApp();
    } catch (error) {
      showMessage(error.message || 'Login failed.', true);
    }
  });

  logoutButton?.addEventListener('click', async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch {
      // Fallback local clear if server call fails.
      document.cookie = 'txn=; Path=/; Max-Age=0; SameSite=Lax';
    }
    showMessage('');
    showLogin();
    window.location.href = '/';
  });

  const getNinjaCookie = () => {
    const m = ('; ' + document.cookie).split('; ninja_token=');
    return m.length === 2 ? m.pop().split(';')[0] : null;
  };

  const trySSOLogin = async () => {
    const token = getNinjaCookie();
    if (!token) return false;
    try {
      const res = await fetch('/api/auth/sso-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.authenticated) return true;
      }
    } catch {
      // SSO unavailable, fall through to normal login
    }
    return false;
  };

  showLogin();
  (async () => {
    if (await trySSOLogin()) {
      showApp();
    } else {
      void checkSession();
    }
  })();
})();
