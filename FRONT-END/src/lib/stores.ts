import { writable, derived } from 'svelte/store';
import { createQuery, createMutation } from '@tanstack/svelte-query';

// User auth state
export const user = writable<{ id: string; name: string; email: string } | null>(null);

// Client list search and filter state
export const searchQuery = writable<string>('');
export const sortBy = writable<'name' | 'status' | 'createdAt'>('name');
export const filterStatus = writable<string>('all'); // 'all', 'client', 'prospect', etc.

// Pagination state
export const currentPage = writable<number>(0);
export const pageSize = writable<number>(100);

// Derived: combined filter state for server queries
export const filterState = derived(
	[searchQuery, filterStatus],
	([$search, $status]) => ({
		search: $search,
		status: $status === 'all' ? null : $status,
	})
);

// Request context (for Unix socket communication)
export const apiBase = writable<string>(
	typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3019'
);

// Query result cache metadata
export const queryMetadata = writable({
	lastFetch: null as Date | null,
	totalCount: 0,
	loadedCount: 0,
});
