import { createQuery, useQueryClient } from '@tanstack/svelte-query';
import { writable, derived } from 'svelte/store';
import type { ClientItem, ClientListResponse } from '$lib/types/client';

// Streaming store for progressive data loading
export const clientsStore = writable<ClientItem[]>([]);
export const isLoadingStore = writable(true);
export const searchStore = writable('');

// Generate mock data (3000+ clients for virtual scrolling demo)
function generateMockClients(count: number): ClientItem[] {
  const firstNames = ['John', 'Jane', 'Bob', 'Alice', 'Charlie', 'Diana', 'Eve', 'Frank'];
  const lastNames = ['Smith', 'Johnson', 'Brown', 'Davis', 'Wilson', 'Moore', 'Taylor', 'Anderson'];
  const agencies = ['TransUnion', 'Equifax', 'Experian'];
  const statuses = ['active', 'completed', 'on-hold'];
  const phases = ['intake', 'dispute', 'monitoring', 'closed'];

  const clients: ClientItem[] = [];
  for (let i = 0; i < count; i++) {
    clients.push({
      id: `client-${i + 1}`,
      firstName: firstNames[Math.floor(Math.random() * firstNames.length)],
      lastName: lastNames[Math.floor(Math.random() * lastNames.length)],
      email: `client${i + 1}@example.com`,
      phone: `555-${String(i).padStart(4, '0')}`,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      phase: phases[Math.floor(Math.random() * phases.length)],
      monitoringAgency: agencies[Math.floor(Math.random() * agencies.length)],
      reportDate: `2026-0${Math.floor(Math.random() * 5) + 1}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
      daysLeft: Math.floor(Math.random() * 30) - 10,
    });
  }
  return clients;
}

// Streaming fetch with progressive updates
export async function* streamClients(): AsyncGenerator<ClientItem[]> {
  const allClients = generateMockClients(3000);
  const chunkSize = 100;

  for (let i = 0; i < allClients.length; i += chunkSize) {
    const chunk = allClients.slice(0, i + chunkSize);
    clientsStore.set(chunk);
    yield chunk;

    // Simulate streaming delay
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

// Filtered/searched clients
export const filteredClients = derived(
  [clientsStore, searchStore],
  ([$clients, $search]) => {
    if (!$search.trim()) return $clients;

    const query = $search.toLowerCase();
    return $clients.filter(c => {
      const hay = `${c.firstName} ${c.lastName} ${c.email} ${c.phone}`.toLowerCase();
      return hay.includes(query);
    });
  }
);

// Sort by daysLeft
export const sortedClients = derived(filteredClients, ($filtered) => {
  return [...$filtered].sort((a, b) => {
    const aVal = typeof a.daysLeft === 'number' ? a.daysLeft : Number.MAX_SAFE_INTEGER;
    const bVal = typeof b.daysLeft === 'number' ? b.daysLeft : Number.MAX_SAFE_INTEGER;
    if (aVal !== bVal) return aVal - bVal;
    const aName = `${a.lastName} ${a.firstName}`.toLowerCase();
    const bName = `${b.lastName} ${b.firstName}`.toLowerCase();
    return aName.localeCompare(bName);
  });
});

// API functions
export async function fetchClients(): Promise<ClientListResponse> {
  const response = await fetch('/api/clients');
  if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
  return response.json();
}

export async function fetchClient(id: string) {
  const response = await fetch(`/api/clients/${id}`);
  if (!response.ok) throw new Error(`Failed to fetch client: ${response.status}`);
  return response.json();
}

// TanStack Query hooks
export function useClients() {
  return createQuery({
    queryKey: ['clients'],
    queryFn: fetchClients,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useClient(id: string) {
  return createQuery({
    queryKey: ['client', id],
    queryFn: () => fetchClient(id),
    staleTime: 60 * 1000,
    enabled: !!id,
  });
}
