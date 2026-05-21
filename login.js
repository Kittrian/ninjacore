(function initAuthPage() {
  const authShell = document.querySelector('.auth-shell');
  const pageShell = document.querySelector('.page-shell');
  const authMessage = document.getElementById('authMessage');
  const loginForm = document.querySelector('form[data-auth-form="login"]');
  const signupForm = document.querySelector('form[data-auth-form="signup"]');
  const tabs = Array.from(document.querySelectorAll('[data-auth-tab]'));
  const forms = Array.from(document.querySelectorAll('.auth-form'));

  const showMessage = (message, isError = false) => {
    if (!authMessage) {
      return;
    }
    authMessage.textContent = String(message || '');
    authMessage.classList.toggle('is-error', Boolean(isError));
  };

  const setTab = (mode) => {
    tabs.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.authTab === mode);
    });
    forms.forEach((form) => {
      form.classList.toggle('is-active', form.dataset.authForm === mode);
    });
    showMessage('');
  };

  const showApp = () => {
    if (authShell) {
      authShell.style.display = 'none';
    }
    if (pageShell) {
      pageShell.style.display = '';
    }
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
      const payload = await response.json();
      if (payload?.authenticated) {
        showApp();
      }
    } catch {
      // Ignore session check failures on boot.
    }
  };

  tabs.forEach((button) => {
    button.addEventListener('click', () => setTab(button.dataset.authTab || 'login'));
  });

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
      showApp();
    } catch (error) {
      showMessage(error.message || 'Login failed.', true);
    }
  });

  signupForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = String(document.getElementById('signupUsername')?.value || '').trim();
    const password = String(document.getElementById('signupPassword')?.value || '');
    const confirmPassword = String(document.getElementById('signupConfirmPassword')?.value || '');
    if (!username || !password || !confirmPassword) {
      showMessage('Fill out all create-account fields.', true);
      return;
    }
    if (password.length < 8) {
      showMessage('Password must be at least 8 characters.', true);
      return;
    }
    if (password !== confirmPassword) {
      showMessage('Passwords do not match.', true);
      return;
    }
    try {
      showMessage('Creating account...');
      await api('/api/signup', { username, password, confirmPassword });
      showApp();
    } catch (error) {
      showMessage(error.message || 'Create account failed.', true);
    }
  });

  setTab('login');
  void checkSession();
})();
