<script lang="ts">
  import { onMount } from 'svelte';
  import { BarChart3, TrendingUp, TrendingDown, Activity } from 'lucide-svelte';

  interface VitalsData {
    totalMetrics: number;
    lastHour: number;
    byRating: {
      good: number;
      needsImprovement: number;
      poor: number;
    };
    byMetric: {
      FCP: number | null;
      LCP: number | null;
      CLS: number | null;
      INP: number | null;
      TTFB: number | null;
    };
  }

  let vitals: VitalsData | null = null;
  let loading = true;

  onMount(async () => {
    const response = await fetch('/api/vitals');
    if (response.ok) {
      vitals = await response.json();
    }
    loading = false;

    // Refresh every 10 seconds
    const interval = setInterval(async () => {
      const res = await fetch('/api/vitals');
      if (res.ok) {
        vitals = await res.json();
      }
    }, 10000);

    return () => clearInterval(interval);
  });

  function getRatingColor(rating: string): string {
    switch (rating) {
      case 'good':
        return 'text-emerald-400';
      case 'needs-improvement':
        return 'text-amber-400';
      case 'poor':
        return 'text-red-400';
      default:
        return 'text-white';
    }
  }

  function getProgressColor(value: number, thresholds: [number, number]): string {
    if (value <= thresholds[0]) return 'bg-emerald-500';
    if (value <= thresholds[1]) return 'bg-amber-500';
    return 'bg-red-500';
  }

  const thresholds: Record<string, [number, number]> = {
    FCP: [1800, 3000],
    LCP: [2500, 4000],
    CLS: [0.1, 0.25],
    INP: [200, 500],
    TTFB: [800, 1800],
  };
</script>

<svelte:head>
  <title>Web Vitals · NinjaCore</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-6 py-8">
  <div class="mb-8">
    <div class="flex items-center gap-2 mb-2">
      <Activity class="w-6 h-6 text-cyan-400" />
      <h1 class="text-3xl font-bold">Web Vitals Dashboard</h1>
    </div>
    <p class="text-white/60">Real-user performance metrics collected from the frontend</p>
  </div>

  {#if loading}
    <div class="text-white/50">Loading vitals data...</div>
  {:else if vitals}
    <!-- Summary Stats -->
    <div class="grid gap-4 sm:grid-cols-4 mb-8">
      <div class="rounded-lg border border-white/10 bg-white/5 p-4">
        <div class="text-xs uppercase tracking-wider text-white/50 mb-2">Total Metrics</div>
        <div class="text-3xl font-bold">{vitals.totalMetrics}</div>
      </div>
      <div class="rounded-lg border border-white/10 bg-white/5 p-4">
        <div class="text-xs uppercase tracking-wider text-white/50 mb-2">Last Hour</div>
        <div class="text-3xl font-bold">{vitals.lastHour}</div>
      </div>
      <div class="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div class="text-xs uppercase tracking-wider text-emerald-400 mb-2">Good</div>
        <div class="text-3xl font-bold">{vitals.byRating.good}</div>
      </div>
      <div class="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
        <div class="text-xs uppercase tracking-wider text-red-400 mb-2">Poor</div>
        <div class="text-3xl font-bold">{vitals.byRating.poor}</div>
      </div>
    </div>

    <!-- Metric Details -->
    <div class="rounded-lg border border-white/10 bg-white/5 p-6">
      <div class="flex items-center gap-2 mb-6">
        <BarChart3 class="w-5 h-5 text-cyan-400" />
        <h2 class="text-xl font-semibold">Core Web Vitals</h2>
      </div>

      <div class="space-y-6">
        {#each Object.entries(vitals.byMetric) as [name, value]}
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="font-medium">{name}</span>
              {#if value !== null}
                <span class="text-sm text-white/60">
                  {typeof value === 'number' && value % 1 !== 0
                    ? value.toFixed(2)
                    : value}
                  {name === 'CLS' ? '' : 'ms'}
                </span>
              {:else}
                <span class="text-sm text-white/40">No data</span>
              {/if}
            </div>

            {#if value !== null}
              <div class="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div
                  class="h-full transition-all duration-300 {getProgressColor(
                    value,
                    thresholds[name] || [100, 200]
                  )}"
                  style="width: {Math.min(100, (value / (thresholds[name]?.[1] || 100)) * 100)}%"
                ></div>
              </div>

              <div class="mt-1 text-xs text-white/40">
                {#if value <= thresholds[name][0]}
                  <span class="text-emerald-400">✓ Good</span>
                {:else if value <= thresholds[name][1]}
                  <span class="text-amber-400">⚠ Needs improvement</span>
                {:else}
                  <span class="text-red-400">✗ Poor</span>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <div class="mt-8 pt-6 border-t border-white/10">
        <h3 class="text-sm font-semibold mb-3">Thresholds</h3>
        <div class="grid gap-2 text-xs text-white/60">
          <div><span class="text-emerald-400">✓ Good:</span> FCP &lt;1.8s, LCP &lt;2.5s, CLS &lt;0.1, INP &lt;200ms, TTFB &lt;800ms</div>
          <div><span class="text-amber-400">⚠ Needs improvement:</span> Between good and poor thresholds</div>
          <div><span class="text-red-400">✗ Poor:</span> FCP &gt;3s, LCP &gt;4s, CLS &gt;0.25, INP &gt;500ms, TTFB &gt;1.8s</div>
        </div>
      </div>
    </div>

    <!-- Rating Distribution -->
    <div class="mt-6 rounded-lg border border-white/10 bg-white/5 p-6">
      <h3 class="text-sm font-semibold mb-4">Rating Distribution</h3>
      <div class="grid gap-4 sm:grid-cols-3">
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-emerald-400">Good</span>
            <span class="font-bold">{vitals.byRating.good}</span>
          </div>
          <div class="w-full bg-white/10 rounded-full h-2">
            <div
              class="bg-emerald-500 h-full rounded-full"
              style="width: {((vitals.byRating.good / vitals.totalMetrics) * 100) || 0}%"
            ></div>
          </div>
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-amber-400">Needs Improvement</span>
            <span class="font-bold">{vitals.byRating.needsImprovement}</span>
          </div>
          <div class="w-full bg-white/10 rounded-full h-2">
            <div
              class="bg-amber-500 h-full rounded-full"
              style="width: {((vitals.byRating.needsImprovement / vitals.totalMetrics) * 100) || 0}%"
            ></div>
          </div>
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-red-400">Poor</span>
            <span class="font-bold">{vitals.byRating.poor}</span>
          </div>
          <div class="w-full bg-white/10 rounded-full h-2">
            <div
              class="bg-red-500 h-full rounded-full"
              style="width: {((vitals.byRating.poor / vitals.totalMetrics) * 100) || 0}%"
            ></div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
