import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

// Mock data for now - will connect to actual API
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

export const GET: RequestHandler = async () => {
  try {
    return json({
      statuses: ['active', 'completed', 'on-hold'],
      phases: ['intake', 'dispute', 'monitoring', 'closed'],
      clients: mockClients,
    });
  } catch (err) {
    return error(500, 'Failed to fetch clients');
  }
};
