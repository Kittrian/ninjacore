<script lang="ts">
  import './styles.css';
  import { onMount } from 'svelte';

  let clients: any[] = [];
  let loading = false;
  let error = '';

  onMount(async () => {
    await fetchClients();
  });

  async function fetchClients() {
    loading = true;
    error = '';
    try {
      const response = await fetch('/api/clients');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      clients = data.clients || [];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load clients';
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
  <!-- Header -->
  <header class="bg-black/50 backdrop-blur border-b border-purple-500/20">
    <div class="max-w-7xl mx-auto px-6 py-8">
      <h1 class="text-4xl font-bold text-white">Tools Ninja</h1>
      <p class="text-purple-300 mt-2">Client Management Dashboard</p>
    </div>
  </header>

  <!-- Main Content -->
  <main class="max-w-7xl mx-auto px-6 py-12">
    {#if loading}
      <div class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    {:else if error}
      <div class="bg-red-500/10 border border-red-500/50 rounded-lg p-6">
        <p class="text-red-300">Error: {error}</p>
        <button
          on:click={fetchClients}
          class="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition"
        >
          Retry
        </button>
      </div>
    {:else if clients.length === 0}
      <div class="text-center py-12">
        <p class="text-gray-400 text-lg">No clients found</p>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each clients as client (client.id)}
          <div class="bg-purple-900/30 backdrop-blur border border-purple-500/20 rounded-lg p-6 hover:border-purple-500/50 transition">
            <h3 class="text-xl font-semibold text-white">
              {client.firstName} {client.lastName}
            </h3>
            <p class="text-purple-300 text-sm mt-1">{client.email}</p>
            <div class="mt-4 pt-4 border-t border-purple-500/20">
              <span class="inline-block px-3 py-1 bg-purple-600/50 text-purple-200 rounded-full text-sm">
                {client.status}
              </span>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
      sans-serif;
  }
</style>
