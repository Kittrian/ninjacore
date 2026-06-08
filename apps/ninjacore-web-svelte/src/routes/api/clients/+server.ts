import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

// Fallback mock data when Rust backend is unavailable
const mockClients = [
  {
    id: '1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '555-0100',
    status: 'active',
    phase: 'dispute',
    monitoringAgency: 'TransUnion',
    reportDate: '2026-05-28',
    daysLeft: 15,
  },
  {
    id: '2',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.com',
    phone: '555-0101',
    status: 'active',
    phase: 'monitoring',
    monitoringAgency: 'Equifax',
    reportDate: '2026-05-27',
    daysLeft: 8,
  },
  {
    id: '3',
    firstName: 'Bob',
    lastName: 'Johnson',
    email: 'bob@example.com',
    phone: '555-0102',
    status: 'completed',
    phase: 'closed',
    monitoringAgency: 'Experian',
    reportDate: '2026-05-20',
    daysLeft: -5,
  },
];

async function forwardToRustBackend(path: string, options?: RequestInit) {
  const socketPath = process.env.RUST_API_ORIGIN || 'unix:///tmp/ninjacore.sock';

  // Only attempt Unix socket connection if Rust backend is configured
  if (!socketPath.startsWith('unix://')) {
    return null;
  }

  try {
    // In Bun, we can use unix:// URLs directly in fetch
    const url = `http://${socketPath}${path}`;
    const response = await fetch(url, {
      method: options?.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: options?.body,
    } as any);

    if (response.ok) {
      return response.json();
    }
  } catch (err) {
    // Rust backend not available, fall back to mock data
    console.warn(`Rust backend unavailable (${socketPath}), using mock data`);
  }

  return null;
}

export const GET: RequestHandler = async () => {
  try {
    // Try to get real data from Rust backend
    const backendData = await forwardToRustBackend('/api/clients');

    if (backendData) {
      return json(backendData);
    }

    // Fall back to mock data
    return json({
      statuses: ['active', 'completed', 'on-hold'],
      phases: ['intake', 'dispute', 'monitoring', 'closed'],
      clients: mockClients,
    });
  } catch (err) {
    return error(500, 'Failed to fetch clients');
  }
};
