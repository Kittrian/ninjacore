/**
 * Web Worker for client-side search processing
 * Runs search operations off the main thread to keep UI responsive
 */

import MiniSearch from 'minisearch';

interface Client {
	id: string;
	first_name: string;
	last_name: string;
	email?: string;
	phone?: string;
	status?: string;
}

interface InitMessage {
	type: 'init';
	clients: Client[];
}

interface SearchMessage {
	type: 'search';
	query: string;
}

type WorkerMessage = InitMessage | SearchMessage;

let searchIndex: MiniSearch | null = null;

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
	const { type } = event.data;

	if (type === 'init') {
		const { clients } = event.data as InitMessage;
		try {
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
			self.postMessage({ type: 'init-complete', size: clients.length });
		} catch (error) {
			self.postMessage({ type: 'error', error: String(error) });
		}
	} else if (type === 'search') {
		const { query } = event.data as SearchMessage;
		try {
			if (!searchIndex || !query.trim()) {
				self.postMessage({ type: 'search-results', results: [] });
				return;
			}

			const results = searchIndex.search(query);
			self.postMessage({ type: 'search-results', results });
		} catch (error) {
			self.postMessage({ type: 'error', error: String(error) });
		}
	}
};
