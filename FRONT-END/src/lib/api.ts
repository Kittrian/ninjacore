/** API client for Axum backend over Unix socket */

interface ApiOptions {
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	body?: any;
	headers?: Record<string, string>;
}

interface ClientsPayload<T = any> {
	statuses?: string[];
	phases?: string[];
	clients?: T[];
}

const API_BASE = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3019';

export async function apiCall<T>(
	endpoint: string,
	options: ApiOptions = {}
): Promise<T> {
	const { method = 'GET', body, headers = {} } = options;

	const fetchOptions: RequestInit = {
		method,
		headers: {
			'Content-Type': 'application/json',
			...headers,
		},
		credentials: 'include', // Send cookies for auth
	};

	if (body) {
		fetchOptions.body = JSON.stringify(body);
	}

	const url = `${API_BASE}/api${endpoint}`;
	const response = await fetch(url, fetchOptions);

	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: response.statusText }));
		throw new Error(error.error || `API error: ${response.status}`);
	}

	return response.json();
}

// Health check
export async function healthCheck() {
	return apiCall('/health');
}

// Authentication
export async function login(username: string, password: string) {
	return apiCall('/login', {
		method: 'POST',
		body: { username, password },
	});
}

export async function logout() {
	return apiCall('/logout', { method: 'POST' });
}

export async function authStatus() {
	return apiCall('/auth/status');
}

// Clients
export async function getClients(offset: number = 0, limit: number = 100) {
	const payload = await apiCall<ClientsPayload | any[]>(`/clients?offset=${offset}&limit=${limit}`);
	const clients = Array.isArray(payload) ? payload : Array.isArray(payload?.clients) ? payload.clients : [];
	return clients.slice(offset, offset + limit);
}

export async function getClientsPayload(options?: { status?: string }) {
	const statusParam = options?.status ? `?status=${encodeURIComponent(options.status)}` : '';
	const payload = await apiCall<ClientsPayload | any[]>(`/clients${statusParam}`);
	const clients = Array.isArray(payload) ? payload : Array.isArray(payload?.clients) ? payload.clients : [];
	return {
		statuses: Array.isArray((payload as ClientsPayload)?.statuses) ? (payload as ClientsPayload).statuses! : [],
		phases: Array.isArray((payload as ClientsPayload)?.phases) ? (payload as ClientsPayload).phases! : [],
		clients,
		totalCount: clients.length,
	};
}

export async function searchClients(query: string) {
	return apiCall(`/clients/search?q=${encodeURIComponent(query)}`);
}

export async function getClient(id: string) {
	return apiCall(`/clients/${id}`);
}

// Business settings
export async function getBusinessSettings() {
	return apiCall('/business-settings');
}

export async function updateBusinessSettings(settings: any) {
	return apiCall('/business-settings', {
		method: 'PUT',
		body: settings,
	});
}
