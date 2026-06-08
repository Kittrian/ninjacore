<script lang="ts">
  import { onMount } from 'svelte';
  import { sortedClients, searchStore, clientsStore, isLoadingStore, streamClients } from '$lib/stores/clients';
  import { Search, ChevronRight, Loader2 } from 'lucide-svelte';

  let virtualScroll: HTMLDivElement;
  let visibleStart = 0;
  let visibleEnd = 50;
  const rowHeight = 56; // Fixed row height in pixels
  const viewportHeight = 600; // Viewport visible area

  onMount(async () => {
    // Start streaming data
    isLoadingStore.set(true);
    for await (const chunk of streamClients()) {
      // Updates happen automatically via store
    }
    isLoadingStore.set(false);
  });

  function handleScroll(e: Event) {
    const target = e.target as HTMLDivElement;
    const scrollTop = target.scrollTop;
    visibleStart = Math.max(0, Math.floor(scrollTop / rowHeight) - 5);
    visibleEnd = Math.min($sortedClients.length, visibleStart + Math.ceil(viewportHeight / rowHeight) + 10);
  }

  function prefetchClient(id: string) {
    // Would prefetch via TanStack Query
  }

  const visibleClients = $sortedClients.slice(visibleStart, visibleEnd);
  const offsetY = visibleStart * rowHeight;
  const totalHeight = $sortedClients.length * rowHeight;
</script>

<div class="flex flex-col gap-6">
  {/* Search Bar */}
  <div class="relative w-full max-w-md">
    <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
    <input
      type="text"
      bind:value={$searchStore}
      placeholder="Search by name, email, phone…"
      class="input pl-10 w-full"
    />
  </div>

  {/* Status */}
  <div class="flex items-center justify-between text-sm text-white/60">
    <div>
      Showing {visibleStart + 1} to {Math.min(visibleEnd, $sortedClients.length)} of {$sortedClients.length}
    </div>
    {#if $isLoadingStore}
      <div class="flex items-center gap-2">
        <Loader2 class="w-4 h-4 animate-spin" />
        <span>Loading clients…</span>
      </div>
    {/if}
  </div>

  {/* Virtualized Table */}
  <div
    class="rounded-lg border border-white/10 bg-white/5 overflow-y-auto"
    style="height: {viewportHeight}px"
    on:scroll={handleScroll}
    bind:this={virtualScroll}
  >
    <div class="relative">
      {/* Header - fixed */}
      <div class="sticky top-0 bg-white/5 border-b border-white/10 z-10">
        <div class="grid grid-cols-8 gap-4 px-4 py-3 text-xs uppercase tracking-wider text-white/60">
          <div>Days Left</div>
          <div class="col-span-2">Name</div>
          <div class="col-span-2">Email</div>
          <div>Agency</div>
          <div>Status</div>
          <div></div>
        </div>
      </div>

      {/* Spacer for scrolled content */}
      <div style="height: {offsetY}px"></div>

      {/* Visible rows */}
      <div>
        {#each visibleClients as client (client.id)}
          <a
            href={`/clients/${client.id}`}
            class="grid grid-cols-8 gap-4 px-4 py-3 border-b border-white/5 hover:bg-white/5 transition cursor-pointer group"
            style="height: {rowHeight}px"
            on:mouseenter={() => prefetchClient(client.id)}
          >
            <div
              class={`text-sm tabular-nums flex items-center ${
                typeof client.daysLeft === 'number' && client.daysLeft < 0
                  ? 'text-red-300 font-semibold'
                  : 'text-white/70'
              }`}
            >
              {typeof client.daysLeft === 'number' ? client.daysLeft : '—'}
            </div>
            <div class="col-span-2 text-sm font-medium text-cyan-300 group-hover:text-cyan-200 flex items-center">
              {client.firstName} {client.lastName}
            </div>
            <div class="col-span-2 text-sm text-white/70 flex items-center truncate">
              {client.email}
            </div>
            <div class="text-sm text-white/70 flex items-center">
              {client.monitoringAgency}
            </div>
            <div class="text-sm text-white/70 flex items-center">
              {client.status}
            </div>
            <div class="flex items-center justify-end text-white/30 group-hover:text-white/60">
              <ChevronRight class="w-4 h-4" />
            </div>
          </a>
        {/each}
      </div>

      {/* Spacer for remaining content */}
      <div style="height: {Math.max(0, totalHeight - offsetY - visibleClients.length * rowHeight)}px"></div>
    </div>
  </div>
</div>
