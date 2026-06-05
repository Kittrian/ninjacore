import { QueryClient } from '@tanstack/svelte-query';
import * as api from './api';

/**
 * TanStack Query v5 configuration
 * Optimized for low-latency Unix socket communication
 */
export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// Data is fresh for 60 seconds - good for real-time collaboration
			staleTime: 1000 * 60,

			// Keep cached data for 5 minutes - allows offline browsing
			gcTime: 1000 * 60 * 5,

			// Retry failed requests once with exponential backoff
			retry: 1,
			retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

			// Don't refetch on window focus for fast local network
			refetchOnWindowFocus: false,

			// Don't refetch on mount unless data is stale
			refetchOnMount: false,
		},
		mutations: {
			// Optimistic updates support
			retry: 1,
		},
	},
});

/**
 * Query keys for consistent cache management
 */
export const queryKeys = {
	all: ['api'] as const,
	clients: () => [...queryKeys.all, 'clients'] as const,
	clientsInfinite: () => [...queryKeys.clients(), 'infinite'] as const,
	clientsSearch: (query: string) => [...queryKeys.clients(), 'search', query] as const,
	client: (id: string) => [...queryKeys.all, 'client', id] as const,
	health: () => [...queryKeys.all, 'health'] as const,
	settings: () => [...queryKeys.all, 'settings'] as const,
};

/**
 * Prefetch a client's detail data
 */
export async function prefetchClient(id: string) {
	return queryClient.prefetchQuery({
		queryKey: queryKeys.client(id),
		queryFn: () => api.getClient(id),
		staleTime: 1000 * 60, // 1 minute
	});
}

/**
 * Prefetch clients list
 */
export async function prefetchClients(offset: number = 0, limit: number = 100) {
	return queryClient.prefetchQuery({
		queryKey: [...queryKeys.clients(), offset, limit],
		queryFn: () => api.getClients(offset, limit),
		staleTime: 1000 * 60, // 1 minute
	});
}
