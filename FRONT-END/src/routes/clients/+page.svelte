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

	// Fetch full client payload once; backend already returns the whole list.
	const clientsQuery = createQuery({
		queryKey: queryKeys.clients(),
		queryFn: () => api.getClientsPayload(),
		staleTime: 1000 * 60, // 1 minute
		gcTime: 1000 * 60 * 5, // 5 minutes
	});

	$: if ($clientsQuery.data) {
		allClients = $clientsQuery.data.clients || [];
		clients = allClients;
		totalCount = $clientsQuery.data.totalCount || allClients.length;

		// Initialize FULL search index with ALL clients
		initializeSearchIndex(allClients);
		if (searchWorker) {
			searchWorker.postMessage({
				type: 'init',
				clients: allClients,
			});
		}

		updateFiltered();
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
			const sourceClients = allClients.length ? allClients : clients;

			// Apply status filter
			filteredClients = sourceClients.filter(
				(c) => $filterStatus === 'all' || String(c.status || '').toLowerCase() === $filterStatus
			);
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
					<span class="ml-2 text-green-600">✅ Searched all {totalCount} clients</span>
				</p>
			{:else}
				<!-- BROWSE MODE -->
				<p>
					Showing {filteredClients.length} of {totalCount} clients
					<span class="ml-2 text-green-600">✅ All {allClients.length} clients ready for search</span>
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
										class="inline-block px-2 py-1 text-xs rounded {String(client.status || '').toLowerCase() === 'client'
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
	{/if}
</div>
