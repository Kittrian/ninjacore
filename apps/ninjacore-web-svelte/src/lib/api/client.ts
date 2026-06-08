// API client with Unix socket + HTTP support
// In browser: uses relative URLs (proxied by SvelteKit)
// On server: can use Unix sockets (via Node/Bun APIs)

import { dev } from '$app/environment';

const API_BASE = import.meta.env.VITE_API_BASE || (dev ? 'http://localhost:3018' : '/api');

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

export async function apiRequest<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Server-side Unix socket helper (Bun only)
export async function unixSocketRequest<T>(
  socketPath: string,
  method: string,
  path: string,
  body?: any
): Promise<T> {
  // Only works in Bun with Unix socket support
  if (typeof Bun === 'undefined') {
    throw new Error('Unix socket API requires Bun runtime');
  }

  const response = await fetch(`http://unix:${socketPath}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  } as any);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
