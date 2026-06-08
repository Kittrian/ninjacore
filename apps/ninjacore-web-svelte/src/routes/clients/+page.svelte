<script lang="ts">
  import { Suspense } from 'svelte';
  import ClientTable from '$components/ClientTable.svelte';
  import { Loader2 } from 'lucide-svelte';
</script>

<svelte:head>
  <title>Clients · NinjaCore</title>
  <meta name="description" content="Browse and manage credit dispute clients with virtual scrolling" />
</svelte:head>

<div class="max-w-7xl mx-auto px-6 py-8">
  <div class="mb-8">
    <h1 class="text-3xl font-bold tracking-tight mb-2">Clients</h1>
    <p class="text-white/60">
      Virtual scrolling renders only visible rows. 3000+ clients load progressively.
    </p>
  </div>

  {#await new Promise(resolve => setTimeout(resolve, 0))}
    <div class="flex items-center gap-3 text-white/50">
      <Loader2 class="w-4 h-4 animate-spin" />
      <span>Initializing client table…</span>
    </div>
  {:then}
    <ClientTable />
  {/await}
</div>

