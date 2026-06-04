const API_BASE = '/api';

export async function fetchClients() {
  const response = await fetch(`${API_BASE}/clients`);
  if (!response.ok) throw new Error(`Failed to fetch clients: ${response.status}`);
  return response.json();
}

export async function fetchIntegrations() {
  const response = await fetch(`${API_BASE}/integrations`);
  if (!response.ok) throw new Error(`Failed to fetch integrations: ${response.status}`);
  return response.json();
}

export async function login(username: string, password: string) {
  const response = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`Login failed: ${response.status}`);
  return response.json();
}

export async function logout() {
  const response = await fetch(`${API_BASE}/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`Logout failed: ${response.status}`);
  return response.json();
}
