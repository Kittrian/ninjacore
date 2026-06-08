// Authentication routes: login, signup, auth status, OAuth flows
// These are imported from server.mjs context and called here

export const handler = async (context) => {
  const { req, res, pathname, method } = context;
  const {
    send, readBody, isValidAppCredential, verifyUserCredential,
    normalizeUsername, createAppUser, requireAppAuth, parseCookies,
    isAppAuthenticated, createHash, randomUUID, googleClientId, githubClientId,
    oauthRedirectUri
  } = context.utils;

  // POST /api/login
  if (pathname === '/api/login' && method === 'POST') {
    try {
      const body = await readBody(req);
      const username = String(body.username ?? '').trim();
      const password = String(body.password ?? '');
      const legacyValid = isValidAppCredential(username, password);
      const dynamicValid = await verifyUserCredential(username, password);
      if (!legacyValid && !dynamicValid) {
        send(res, 401, { error: 'Invalid username or password.' });
        return true;
      }

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Set-Cookie': [
          `txn=${encodeURIComponent(username)}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`,
        ],
      });
      res.end(JSON.stringify({ success: true, user: normalizeUsername(username) }, null, 2));
    } catch (error) {
      send(res, 400, { error: error.message || 'Login failed.' });
    }
    return true;
  }

  // POST /api/signup
  if (pathname === '/api/signup' && method === 'POST') {
    try {
      const body = await readBody(req);
      const username = String(body.username ?? '').trim();
      const password = String(body.password ?? '');
      const confirmPassword = String(body.confirmPassword ?? '');

      if (!username || !password) {
        send(res, 400, { error: 'Username and password are required.' });
        return true;
      }
      if (password.length < 8) {
        send(res, 400, { error: 'Password must be at least 8 characters.' });
        return true;
      }
      if (confirmPassword && password !== confirmPassword) {
        send(res, 400, { error: 'Password confirmation does not match.' });
        return true;
      }

      const created = await createAppUser(username, password);

      res.writeHead(201, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Set-Cookie': [
          `txn=${encodeURIComponent(created.username)}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`,
        ],
      });
      res.end(JSON.stringify({ success: true, user: created.username }, null, 2));
    } catch (error) {
      send(res, 400, { error: error.message || 'Signup failed.' });
    }
    return true;
  }

  // GET /api/auth/status
  if (pathname === '/api/auth/status' && method === 'GET') {
    const cookies = parseCookies(req?.headers?.cookie || '');
    const username = normalizeUsername(cookies.get('txn') || '');
    send(res, 200, { authenticated: isAppAuthenticated(req), user: username || '' });
    return true;
  }

  // GET /api/auth/google-login
  if (pathname === '/api/auth/google-login' && method === 'GET') {
    const state = createHash('sha256').update(randomUUID()).digest('hex');
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', googleClientId);
    authUrl.searchParams.set('redirect_uri', oauthRedirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', state);
    res.writeHead(302, { 'Location': authUrl.toString() });
    res.end();
    return true;
  }

  // GET /api/auth/github-login
  if (pathname === '/api/auth/github-login' && method === 'GET') {
    const state = createHash('sha256').update(randomUUID()).digest('hex');
    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.set('client_id', githubClientId);
    authUrl.searchParams.set('redirect_uri', oauthRedirectUri);
    authUrl.searchParams.set('scope', 'user:email');
    authUrl.searchParams.set('state', state);
    res.writeHead(302, { 'Location': authUrl.toString() });
    res.end();
    return true;
  }

  // GET /api/logout
  if (pathname === '/api/logout' && method === 'POST') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': 'txn=; Path=/; Max-Age=0; SameSite=Lax; Secure'
    });
    res.end(JSON.stringify({ success: true }, null, 2));
    return true;
  }

  return false;
};
