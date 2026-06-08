<script lang="ts">
  import { page } from '$app/stores';
  import { useClient } from '$lib/stores/clients';
  import LetterGenerator from '$components/LetterGenerator.svelte';
  import { Loader2, ChevronLeft, BarChart3, Users, Mail } from 'lucide-svelte';

  const clientQuery = useClient($page.params.id);
</script>

<svelte:head>
  <title>Client · NinjaCore</title>
  <meta name="description" content="Client details and credit information" />
</svelte:head>

<div class="max-w-7xl mx-auto px-6 py-8">
  <a href="/clients" class="inline-flex items-center gap-2 text-xs text-white/50 hover:text-white/70 mb-6">
    <ChevronLeft class="w-4 h-4" />
    Back to clients
  </a>

  {#if $clientQuery.isPending}
    <div class="flex items-center gap-3 text-white/50">
      <Loader2 class="w-4 h-4 animate-spin" />
      <span>Loading client details…</span>
    </div>
  {:else if $clientQuery.error}
    <div class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm">
      <div class="font-semibold text-red-300">Error</div>
      <pre class="text-red-200/80 mt-1">{String($clientQuery.error)}</pre>
    </div>
  {:else if $clientQuery.data}
    {@const client = $clientQuery.data.client}
    <div class="space-y-8">
      {/* Header */}
      <div>
        <h1 class="text-4xl font-bold tracking-tight mb-2">
          {client.firstName} {client.lastName}
        </h1>
        <p class="text-white/60">
          {client.email} · {client.monitoringAgency} · ID: {client.id}
        </p>
      </div>

      {/* Stats Grid */}
      <div class="grid gap-4 sm:grid-cols-4">
        <div class="rounded-lg border border-white/10 bg-white/5 p-4">
          <div class="text-xs uppercase tracking-wider text-white/50 mb-2">Status</div>
          <div class="text-2xl font-semibold">{client.status}</div>
        </div>
        <div class="rounded-lg border border-white/10 bg-white/5 p-4">
          <div class="text-xs uppercase tracking-wider text-white/50 mb-2">Phase</div>
          <div class="text-2xl font-semibold">{client.phase}</div>
        </div>
        <div class="rounded-lg border border-white/10 bg-white/5 p-4">
          <div class="text-xs uppercase tracking-wider text-white/50 mb-2">Days Left</div>
          <div class={`text-2xl font-semibold ${client.daysLeft && client.daysLeft < 0 ? 'text-red-400' : 'text-white'}`}>
            {typeof client.daysLeft === 'number' ? client.daysLeft : '—'}
          </div>
        </div>
        <div class="rounded-lg border border-white/10 bg-white/5 p-4">
          <div class="text-xs uppercase tracking-wider text-white/50 mb-2">Last Report</div>
          <div class="text-lg font-semibold">{client.reportDate || '—'}</div>
        </div>
      </div>

      {/* Bureau Scores */}
      {#if client.creditScores}
        <div class="rounded-lg border border-white/10 bg-white/5 p-6">
          <div class="flex items-center gap-2 mb-4">
            <BarChart3 class="w-5 h-5 text-cyan-400" />
            <h2 class="text-xl font-semibold">Credit Scores</h2>
          </div>
          <div class="grid gap-4 sm:grid-cols-3">
            {#each Object.entries(client.creditScores) as [bureau, score]}
              <div class="rounded-lg bg-white/5 p-4 border border-white/10">
                <div class="text-sm text-white/60 uppercase tracking-wider mb-2">{bureau}</div>
                <div class="text-3xl font-bold text-cyan-400">{score}</div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {/* Contact Info */}
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="rounded-lg border border-white/10 bg-white/5 p-4">
          <div class="text-xs uppercase tracking-wider text-white/50 mb-2">Email</div>
          <div class="font-medium">{client.email || '—'}</div>
        </div>
        <div class="rounded-lg border border-white/10 bg-white/5 p-4">
          <div class="text-xs uppercase tracking-wider text-white/50 mb-2">Phone</div>
          <div class="font-medium">{client.phone || '—'}</div>
        </div>
        {#if client.dob}
          <div class="rounded-lg border border-white/10 bg-white/5 p-4">
            <div class="text-xs uppercase tracking-wider text-white/50 mb-2">DOB</div>
            <div class="font-medium">{client.dob}</div>
          </div>
        {/if}
        {#if client.address}
          <div class="rounded-lg border border-white/10 bg-white/5 p-4">
            <div class="text-xs uppercase tracking-wider text-white/50 mb-2">Address</div>
            <div class="font-medium">{client.address}</div>
          </div>
        {/if}
      </div>

      {/* Open Accounts */}
      {#if client.openAccounts && client.openAccounts.length > 0}
        <div class="rounded-lg border border-white/10 bg-white/5 p-6">
          <div class="flex items-center gap-2 mb-4">
            <Users class="w-5 h-5 text-emerald-400" />
            <h2 class="text-xl font-semibold">Open Accounts</h2>
          </div>
          <div class="text-white/70">
            {client.openAccounts.length} account(s) found
          </div>
        </div>
      {/if}

      {/* Letter Generation */}
      <div class="rounded-lg border border-white/10 bg-white/5 p-6">
        <div class="flex items-center gap-2 mb-4">
          <Mail class="w-5 h-5 text-blue-400" />
          <h2 class="text-xl font-semibold">Generate Letters</h2>
        </div>
        <LetterGenerator clientId={client.id} />
      </div>
    </div>
  {/if}
</div>
