<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { Search, ChevronRight } from 'lucide-svelte';
  import type { ClientItem, ClientListResponse } from '$lib/types/client';

  let searchQuery = '';
  let filteredClients: ClientItem[] = [];

  async function fetchClients(): Promise<ClientListResponse> {
    const response = await fetch('/api/clients');
    if (!response.ok) throw new Error(`Failed to fetch clients: ${response.status}`);
    return response.json();
  }

  const clientsQuery = createQuery({
    queryKey: ['clients'],
    queryFn: fetchClients,
    staleTime: 60 * 1000, // 60 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  $: if ($clientsQuery.data) {
    filteredClients = $clientsQuery.data.clients.filter((client) => {
      if (!searchQuery.trim()) return true;
      const haystack = `${client.firstName} ${client.lastName} ${client.email} ${client.phone}`.toLowerCase();
      return haystack.includes(searchQuery.toLowerCase());
    });

    // Sort by daysLeft (negative first, then ascending)
    filteredClients.sort((a, b) => {
      const aVal = typeof a.daysLeft === 'number' ? a.daysLeft : Number.MAX_SAFE_INTEGER;
      const bVal = typeof b.daysLeft === 'number' ? b.daysLeft : Number.MAX_SAFE_INTEGER;
      if (aVal !== bVal) return aVal - bVal;
      const aName = `${a.lastName} ${a.firstName}`.toLowerCase();
      const bName = `${b.lastName} ${b.firstName}`.toLowerCase();
      return aName.localeCompare(bName);
    });
  }

  function handlePrefetch(clientId: string) {
    // Prefetch client detail on hover
    // Implementation will use TanStack Query prefetchQuery
  }
</script>

<svelte:head>
  <title>Clients · NinjaCore</title>
  <meta name="description" content="Browse and manage credit dispute clients" />
</svelte:head>

<div class="max-w-7xl mx-auto px-6 py-8">
  <div class="flex items-center gap-4 mb-6">
    <h1 class="text-3xl font-bold tracking-tight">Clients</h1>
    {#if $clientsQuery.data}
      <span class="text-sm text-white/40">
        {filteredClients.length} of {$clientsQuery.data.clients.length}
      </span>
    {/if}
  </div>

  <div class="mb-6">
    <div class="relative w-full max-w-md">
      <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search by name, email, phone…"
        class="input pl-10"
      />
    </div>
  </div>

  {#if $clientsQuery.isPending}
    <div class="text-sm text-white/50">Loading clients…</div>
  {:else if $clientsQuery.error}
    <div class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm">
      <div class="font-semibold text-red-300">API Error</div>
      <pre class="text-red-200/80 mt-1 whitespace-pre-wrap">
        {String($clientsQuery.error)}
      </pre>
    </div>
  {:else if $clientsQuery.data}
    <div class="overflow-x-auto rounded-xl border border-white/10">
      <table class="w-full text-sm">
        <thead class="bg-white/5 text-left text-white/60 uppercase text-xs tracking-wider sticky top-0">
          <tr>
            <th class="px-4 py-3">Days Left</th>
            <th class="px-4 py-3">Name</th>
            <th class="px-4 py-3">Email</th>
            <th class="px-4 py-3">Monitoring</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3">Phase</th>
            <th class="px-4 py-3">Last Report</th>
            <th class="px-4 py-3 w-8"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5">
          {#each filteredClients as client (client.id)}
            <tr
              class="hover:bg-white/5 transition cursor-pointer"
              on:mouseenter={() => handlePrefetch(client.id)}
              on:focus={() => handlePrefetch(client.id)}
            >
              <td class={`px-4 py-3 tabular-nums ${typeof client.daysLeft === 'number' && client.daysLeft < 0 ? 'text-red-300 font-semibold' : 'text-white/70'}`}>
                {typeof client.daysLeft === 'number' ? client.daysLeft : '—'}
              </td>
              <td class="px-4 py-3">
                <a
                  href={`/clients/${client.id}`}
                  class="font-medium text-cyan-300 hover:text-cyan-200"
                >
                  {client.firstName} {client.lastName}
                </a>
              </td>
              <td class="px-4 py-3 text-white/70">{client.email || '—'}</td>
              <td class="px-4 py-3 text-white/70">{client.monitoringAgency || '—'}</td>
              <td class="px-4 py-3 text-white/70">{client.status}</td>
              <td class="px-4 py-3 text-white/70">{client.phase}</td>
              <td class="px-4 py-3 text-white/70 tabular-nums">{client.reportDate || '—'}</td>
              <td class="px-4 py-3">
                <ChevronRight class="w-4 h-4 text-white/30" />
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if filteredClients.length === 0}
      <div class="text-center py-12 text-white/50">
        No clients found matching your search.
      </div>
    {/if}
  {/if}
</div>
