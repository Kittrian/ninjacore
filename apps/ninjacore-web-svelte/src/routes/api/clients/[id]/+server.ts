import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { ClientDetailResponse } from '$lib/types/client';

// Fallback mock data when Rust backend is unavailable
const mockClientsDetail: Record<string, any> = {
  '1': {
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
    dob: '1985-03-15',
    ssn: '***-**-1234',
    address: '123 Main St, Anytown, USA',
    creditScores: {
      transunion: '685',
      equifax: '692',
      experian: '678',
    },
    creditScoresFound: true,
    bureauTotalDebt: {
      transunion: 15000,
      equifax: 14500,
      experian: 16200,
    },
    openAccounts: [
      { bureau: 'TransUnion', account: 'CC-1234', balance: 5000, limit: 10000 },
      { bureau: 'Equifax', account: 'AUTO-5678', balance: 18000, limit: 25000 },
    ],
    lastSyncedAt: '2026-05-28T10:30:00Z',
  },
  '2': {
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
    dob: '1990-07-22',
    ssn: '***-**-5678',
    address: '456 Oak Ave, Sometown, USA',
    creditScores: {
      transunion: '702',
      equifax: '695',
      experian: '710',
    },
    creditScoresFound: true,
    bureauTotalDebt: {
      transunion: 8500,
      equifax: 9200,
      experian: 8000,
    },
    openAccounts: [
      { bureau: 'Equifax', account: 'CC-9012', balance: 3500, limit: 8000 },
    ],
    lastSyncedAt: '2026-05-27T14:15:00Z',
  },
};

async function forwardToRustBackend(path: string, options?: RequestInit) {
  const socketPath = process.env.RUST_API_ORIGIN || 'unix:///tmp/ninjacore.sock';

  if (!socketPath.startsWith('unix://')) {
    return null;
  }

  try {
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
    console.warn(`Rust backend unavailable (${socketPath}), using mock data`);
  }

  return null;
}

export const GET: RequestHandler = async ({ params }) => {
  const { id } = params;

  try {
    // Try to get real data from Rust backend
    const backendData = await forwardToRustBackend(`/api/clients/${id}`);

    if (backendData) {
      return json(backendData as ClientDetailResponse);
    }

    // Fall back to mock data
    if (mockClientsDetail[id]) {
      return json({
        client: mockClientsDetail[id],
      } as ClientDetailResponse);
    }

    return error(404, 'Client not found');
  } catch (err) {
    return error(500, 'Failed to fetch client details');
  }
};
