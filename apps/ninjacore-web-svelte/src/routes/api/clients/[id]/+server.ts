import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { ClientDetailResponse } from '$lib/types/client';

const mockClientsDetail: Record<string, any> = {
  'client-1': {
    id: 'client-1',
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
};

export const GET: RequestHandler = async ({ params }) => {
  const { id } = params;

  // Return mock data or error
  if (mockClientsDetail[id]) {
    return json({
      client: mockClientsDetail[id],
    } as ClientDetailResponse);
  }

  return error(404, 'Client not found');
};
