<script>
	import { createVirtualizer } from '@tanstack/svelte-virtual';
	import { createQuery } from '@tanstack/svelte-query';
	import { onMount } from 'svelte';
	import { searchQuery, filterStatus } from '$lib/stores';
	import { queryKeys, prefetchClient } from '$lib/query';
	import * as api from '$lib/api';
	import { initializeSearchIndex, searchClients } from '$lib/search';

	let clients = [];
	let allClients = []; // All clients loaded in background
	let filteredClients = [];
	let searchWorker;
	let totalCount = 0;
	let isLoadingMore = false;
	const CHUNK_SIZE = 500;

	// Fetch initial clients (first 100 for fast render)
	const clientsQuery = createQuery({
		queryKey: queryKeys.clients(),
		queryFn: () => api.getClients(0, 100), // Initial 100 for SSR/fast render
		staleTime: 1000 * 60, // 1 minute
		gcTime: 1000 * 60 * 5, // 5 minutes
	});

	// Load remaining clients in background (for search + counts)
	const allClientsQuery = createQuery({
		queryKey: [...queryKeys.clients(), 'all'],
		queryFn: async () => {
			const initial = await api.getClients(0, 100);
			totalCount = initial.length || 100; // Estimate total

			// If we have more than 100, load in chunks
			if (totalCount > 100) {
				const allData = [...(initial || [])];
				for (let offset = 100; offset < 3500; offset += CHUNK_SIZE) {
					try {
						const chunk = await api.getClients(offset, CHUNK_SIZE);
						if (!chunk || chunk.length === 0) break;
						allData.push(...chunk);
						if (chunk.length < CHUNK_SIZE) break; // Stop if we got fewer than chunk size
					} catch (e) {
						console.warn(`Failed to load chunk at offset ${offset}:`, e);
						break;
					}
				}
				return allData;
			}
			return initial;
		},
		staleTime: 1000 * 60 * 5, // 5 minutes (longer for full dataset)
		gcTime: 1000 * 60 * 10, // 10 minutes
	});

	// Show initial 100 immediately
	$: if ($clientsQuery.data) {
		clients = $clientsQuery.data;
		// For non-search display, use initial 100
		if (!$searchQuery.trim()) {
			updateFiltered();
		}
	}

	// Load all clients in background for search + counts
	$: if ($allClientsQuery.data) {
		allClients = $allClientsQuery.data;
		totalCount = allClients.length;

		// Initialize FULL search index with ALL clients
		initializeSearchIndex(allClients);
		if (searchWorker) {
			searchWorker.postMessage({
				type: 'init',
				clients: allClients,
			});
		}

		// If user was searching, update results with full dataset
		if ($searchQuery.trim()) {
			updateFiltered();
		}
	}

	// Update filtered list when search/filter changes
	$: if ($searchQuery || $filterStatus !== 'all') {
		updateFiltered();
	}

	function updateFiltered() {
		const isSearching = $searchQuery.trim().length > 0;

		if (isSearching) {
			// SEARCH: Use full dataset (all loaded clients) via MiniSearch
			// This will be empty if still loading, shows incremental results as data loads
			filteredClients = searchClients($searchQuery);
		} else {
			// BROWSE: Use initial 100 for fast render, expand to all when available
			const sourceClients = allClients.length > 100 ? allClients : clients;

			// Apply status filter
			filteredClients = sourceClients.filter(
				(c) => $filterStatus === 'all' || c.status === $filterStatus
			);
		}
	}

	// Load more clients when user scrolls near bottom
	async function loadMore() {
		if (isLoadingMore || allClients.length === 0) return;
		isLoadingMore = true;

		try {
			const nextOffset = clients.length;
			const moreClients = await api.getClients(nextOffset, CHUNK_SIZE);
			if (moreClients && moreClients.length > 0) {
				clients = [...clients, ...moreClients];
				updateFiltered();
			}
		} catch (e) {
			console.error('Failed to load more clients:', e);
		} finally {
			isLoadingMore = false;
		}
	}

	// Virtual scroller
	const virtualizer = createVirtualizer({
		count: filteredClients.length,
		getScrollElement: () => document.querySelector('.clients-list'),
		estimateSize: () => 60,
		overscan: 10,
	});

	// Prefetch on hover
	function onClientHover(clientId) {
		prefetchClient(clientId);
	}

	onMount(() => {
		// Initialize Web Worker for search
		searchWorker = new Worker(new URL('$lib/workers/search.worker.ts', import.meta.url), {
			type: 'module',
		});

		return () => {
			searchWorker?.terminate();
		};
	});
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex justify-between items-center">
		<h2 class="text-3xl font-bold text-gray-900">Clients</h2>
		<span class="text-gray-600">
			{filteredClients.length} of {clients.length} clients
		</span>
	</div>

	<!-- Search and Filter -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
		<input
			type="text"
			placeholder="Search clients... (name, email, phone)"
			bind:value={$searchQuery}
			class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
		/>

		<select
			bind:value={$filterStatus}
			class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
		>
			<option value="all">All Status</option>
			<option value="client">Client</option>
			<option value="prospect">Prospect</option>
			<option value="archived">Archived</option>
		</select>

		<button
			class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
			on:click={() => {
				$searchQuery = '';
				$filterStatus = 'all';
			}}
		>
			Clear Filters
		</button>
	</div>

	<!-- Status -->
	{#if $clientsQuery.isLoading}
		<div class="text-center py-12">
			<p class="text-gray-600">Loading initial clients...</p>
		</div>
	{:else if $clientsQuery.isError}
		<div class="bg-red-50 border border-red-200 rounded-lg p-4">
			<p class="text-red-800">Error loading clients: {$clientsQuery.error?.message}</p>
		</div>
	{:else}
		<!-- Status info -->
		<div class="text-sm text-gray-500 mb-4">
			{#if $searchQuery.trim()}
				<!-- SEARCH MODE -->
				<p>
					Found {filteredClients.length} result{filteredClients.length !== 1 ? 's' : ''} in {totalCount} clients
					{#if $allClientsQuery.isPending}
						<span class="ml-2 text-blue-600 animate-pulse">🔍 Searching in {allClients.length}/{totalCount} loaded...</span>
					{:else}
						<span class="ml-2 text-green-600">✅ Searched all {totalCount} clients</span>
					{/if}
				</p>
			{:else}
				<!-- BROWSE MODE -->
				<p>
					Showing {filteredClients.length} of {totalCount} clients
					{#if $allClientsQuery.isPending}
						<span class="ml-2 text-blue-600 animate-pulse">📥 Loading all clients for search...</span>
					{:else if allClients.length >= 100}
						<span class="ml-2 text-green-600">✅ All {allClients.length} clients ready for search</span>
					{/if}
				</p>
			{/if}
		</div>

		<!-- Virtual List -->
		<div class="clients-list overflow-y-auto border border-gray-200 rounded-lg" style="height: 600px">
			<div style="height: {$virtualizer.getTotalSize()}px; position: relative;">
				{#each $virtualizer.getVirtualItems() as virtualItem (virtualItem.key)}
					{@const client = filteredClients[virtualItem.index]}
					<div
						style="position: absolute; top: 0; left: 0; width: 100%; height: {virtualItem.size}px; transform: translateY({virtualItem.start}px);"
					>
						<div
							class="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition"
							on:mouseenter={() => onClientHover(client.id)}
						>
							<div class="flex justify-between items-center">
								<div>
									<h3 class="font-medium text-gray-900">
										{client.first_name}
										{client.last_name}
									</h3>
									<p class="text-sm text-gray-500">
										{client.email || 'No email'}
									</p>
								</div>
								<div class="text-right">
									<span
										class="inline-block px-2 py-1 text-xs rounded {client.status === 'client'
											? 'bg-green-100 text-green-800'
											: 'bg-gray-100 text-gray-800'}"
									>
										{client.status || 'unknown'}
									</span>
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Load More Button (only show in browse mode) -->
		{#if !$searchQuery.trim() && clients.length < totalCount && clients.length < (allClients.length || 100)}
			<div class="mt-4 text-center">
				<button
					on:click={loadMore}
					disabled={isLoadingMore}
					class="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
				>
					{isLoadingMore ? 'Loading...' : `Load More (${clients.length}/${totalCount})`}
				</button>
			</div>
		{/if}
	{/if}
</div>
