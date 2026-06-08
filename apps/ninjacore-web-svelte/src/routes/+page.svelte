<script lang="ts">
  import { goto } from '$app/navigation';
</script>

<div class="max-w-5xl mx-auto px-6 py-16">
  <div class="space-y-2 mb-12">
    <h1 class="text-5xl font-bold tracking-tight bg-gradient-to-r from-white via-cyan-300 to-cyan-400 bg-clip-text text-transparent">
      NinjaCore
    </h1>
    <p class="text-white/60 text-lg">
      High-performance credit dispute operations frontend.
    </p>
  </div>

  <div class="grid gap-4 sm:grid-cols-2 mb-12">
    <a
      href="/clients"
      class="group rounded-xl border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10 p-6 transition-all duration-200"
    >
      <div class="text-sm uppercase tracking-wider text-cyan-400 font-semibold">
        Clients
      </div>
      <div class="text-2xl font-semibold mt-2">Browse roster</div>
      <div class="text-white/50 text-sm mt-3 group-hover:text-white/70">
        Virtual list of 3000+ clients with instant search →
      </div>
    </a>

    <a
      href="/clients"
      class="group rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 p-6 transition-all duration-200"
    >
      <div class="text-sm uppercase tracking-wider text-emerald-400 font-semibold">
        Performance
      </div>
      <div class="text-2xl font-semibold mt-2">Ultra-fast</div>
      <div class="text-white/50 text-sm mt-3 group-hover:text-white/70">
        Powered by virtual scrolling & MiniSearch →
      </div>
    </a>
  </div>

  <div class="rounded-xl border border-white/10 bg-white/5 p-8 space-y-6">
    <div>
      <h2 class="text-sm uppercase tracking-wider text-white/50 font-semibold mb-4">
        Modern Architecture
      </h2>
      <div class="grid gap-4 sm:grid-cols-2 text-sm text-white/70">
        <div>
          <div class="text-cyan-400 font-semibold">⚡ Virtual Scrolling</div>
          <div class="text-white/60 mt-1">Render only visible rows (~15 of 3000)</div>
        </div>
        <div>
          <div class="text-emerald-400 font-semibold">🔍 Instant Search</div>
          <div class="text-white/60 mt-1">MiniSearch on Web Worker, zero UI freeze</div>
        </div>
        <div>
          <div class="text-blue-400 font-semibold">📦 Smart Caching</div>
          <div class="text-white/60 mt-1">TanStack Query with 60s stale time</div>
        </div>
        <div>
          <div class="text-purple-400 font-semibold">🔗 Unix Sockets</div>
          <div class="text-white/60 mt-1">Microsecond latency to Rust backend</div>
        </div>
      </div>
    </div>

    <div class="border-t border-white/10 pt-6">
      <h2 class="text-sm uppercase tracking-wider text-white/50 font-semibold mb-4">
        Tech Stack
      </h2>
      <div class="grid gap-3 text-sm text-white/70">
        <div>
          <span class="text-cyan-400">Framework:</span> SvelteKit + Svelte 5 · Bun runtime
        </div>
        <div>
          <span class="text-emerald-400">Styling:</span> Tailwind v4 (Oxide) · tree-shaken CSS
        </div>
        <div>
          <span class="text-blue-400">Data:</span> TanStack Query · Virtual · MiniSearch
        </div>
        <div>
          <span class="text-purple-400">Network:</span> Unix sockets · Caddy reverse proxy
        </div>
      </div>
    </div>
  </div>
</div>
