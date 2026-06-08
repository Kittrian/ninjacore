import MiniSearch from 'minisearch';

export interface Client {
	id: string;
	first_name: string;
	last_name: string;
	email?: string;
	phone?: string;
	status?: string;
	dob?: string;
}

let searchIndex: MiniSearch | null = null;

/**
 * Initialize the search index with clients
 */
export function initializeSearchIndex(clients: Client[]) {
	searchIndex = new MiniSearch({
		fields: [
			{ name: 'first_name', boost: 10 },
			{ name: 'last_name', boost: 10 },
			{ name: 'email', boost: 5 },
			{ name: 'phone', boost: 3 },
		],
		storeFields: ['id', 'first_name', 'last_name', 'email', 'phone', 'status'],
		searchOptions: {
			prefix: true,
			fuzzy: 0.2,
		},
	});

	searchIndex.addAll(clients);
}

/**
 * Search clients with the given query
 */
export function searchClients(query: string): Client[] {
	if (!searchIndex || !query.trim()) {
		return [];
	}

	const results = searchIndex.search(query);
	return results as unknown as Client[];
}

/**
 * Get the current index size
 */
export function getIndexSize(): number {
	return searchIndex ? Object.keys(searchIndex.documentStore).length : 0;
}

/**
 * Clear the index
 */
export function clearIndex() {
	searchIndex = null;
}
