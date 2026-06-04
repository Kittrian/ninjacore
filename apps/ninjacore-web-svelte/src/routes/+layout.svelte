<script lang="ts">
  import '../app.postcss';
  import { page } from '$app/stores';
  import { dev } from '$app/environment';

  let isDark = true;
</script>

<svelte:head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#000000" />
  <title>NinjaCore</title>
</svelte:head>

<div class="min-h-screen flex flex-col bg-black text-white">
  <header class="border-b border-white/10 bg-black/30 backdrop-blur-md sticky top-0 z-10">
    <nav class="max-w-7xl mx-auto px-6 py-4 flex items-center gap-6">
      <a href="/" class="font-bold tracking-tight text-lg hover:opacity-80 transition">
        <span class="text-white">Ninja</span>
        <span class="text-cyan-400">Core</span>
      </a>
      <a
        href="/clients"
        class="text-sm text-white/70 hover:text-white transition-colors"
      >
        Clients
      </a>
      <span class="ml-auto text-xs text-white/40">
        SvelteKit 5 · Bun · Unix Sockets
      </span>
    </nav>
  </header>

  <main class="flex-1 bg-gradient-to-br from-black via-black to-black/50">
    <slot />
  </main>

  <footer class="text-xs text-white/30 text-center py-4 border-t border-white/5">
    <div>ninjacore-web-svelte · High-performance frontend</div>
    <div class="text-white/20 mt-1">
      Virtual Scrolling · TanStack Query · MiniSearch
    </div>
  </footer>
</div>

<style global>
  :global(body) {
    margin: 0;
    padding: 0;
  }

  :global(html) {
    color-scheme: dark;
  }
</style>
