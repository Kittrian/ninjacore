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
	let activeTab = 'client'; // default to Clients

	// Fetch Clients only by default (most negative days_left first, per backend sort)
	const clientsQuery = createQuery({
		queryKey: queryKeys.clients('client'),
		queryFn: () => api.getClientsPayload({ status: 'client' }),
		staleTime: 1000 * 60, // 1 minute
		gcTime: 1000 * 60 * 5, // 5 minutes
	});

	// Lazy-load Leads only when tab is clicked
	const leadsQuery = createQuery({
		queryKey: queryKeys.clients('lead'),
		queryFn: () => api.getClientsPayload({ status: 'lead' }),
		staleTime: 1000 * 60,
		gcTime: 1000 * 60 * 5,
		enabled: activeTab === 'lead', // Only fetch when Leads tab is active
	});

	// Use Clients or Leads query based on active tab
	$: activeQuery = activeTab === 'client' ? clientsQuery : leadsQuery;

	$: if ($activeQuery.data) {
		allClients = $activeQuery.data.clients || [];
		clients = allClients;
		totalCount = $activeQuery.data.totalCount || allClients.length;

		// Initialize search index with active tab's clients
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
	$: if ($searchQuery) {
		updateFiltered();
	}

	function updateFiltered() {
		const isSearching = $searchQuery.trim().length > 0;

		if (isSearching) {
			// SEARCH: Use full dataset via MiniSearch (already filtered by status at API level)
			filteredClients = searchClients($searchQuery);
		} else {
			// No search: show all loaded clients (already filtered by active tab status at API level)
			filteredClients = allClients.length ? allClients : clients;
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

	<!-- Tabs for Clients / Leads -->
	<div class="flex gap-4 border-b border-gray-200">
		<button
			on:click={() => {
				activeTab = 'client';
				$searchQuery = '';
			}}
			class="px-4 py-2 font-medium transition border-b-2 {activeTab === 'client'
				? 'border-blue-500 text-blue-600'
				: 'border-transparent text-gray-600 hover:text-gray-900'}"
		>
			Clients
		</button>
		<button
			on:click={() => {
				activeTab = 'lead';
				$searchQuery = '';
			}}
			class="px-4 py-2 font-medium transition border-b-2 {activeTab === 'lead'
				? 'border-blue-500 text-blue-600'
				: 'border-transparent text-gray-600 hover:text-gray-900'}"
		>
			Leads
		</button>
	</div>

	<!-- Search -->
	<div class="mt-4 flex gap-4">
		<input
			type="text"
			placeholder="Search {activeTab === 'client' ? 'clients' : 'leads'}... (name, email, phone)"
			bind:value={$searchQuery}
			class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
		/>

		<button
			class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
			on:click={() => {
				$searchQuery = '';
			}}
		>
			Clear Search
		</button>
	</div>

	<!-- Status -->
	{#if $activeQuery.isLoading}
		<div class="text-center py-12">
			<p class="text-gray-600">Loading {activeTab === 'client' ? 'clients' : 'leads'}...</p>
		</div>
	{:else if $activeQuery.isError}
		<div class="bg-red-50 border border-red-200 rounded-lg p-4">
			<p class="text-red-800">Error loading {activeTab === 'client' ? 'clients' : 'leads'}: {$activeQuery.error?.message}</p>
		</div>
	{:else}
		<!-- Status info -->
		<div class="text-sm text-gray-500 mb-4">
			{#if $searchQuery.trim()}
				<p>
					Found {filteredClients.length} result{filteredClients.length !== 1 ? 's' : ''} in {totalCount} {activeTab === 'client' ? 'clients' : 'leads'}
					<span class="ml-2 text-green-600">✅ Searched all {totalCount}</span>
				</p>
			{:else}
				<p>
					Showing {filteredClients.length} of {totalCount} {activeTab === 'client' ? 'clients' : 'leads'}
					<span class="ml-2 text-green-600">✅ Sorted by days left (most urgent first)</span>
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
