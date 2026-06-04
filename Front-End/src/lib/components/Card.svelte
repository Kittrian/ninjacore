<script lang="ts">
  export let title: string = '';
  export let subtitle: string = '';
  export let status: string = '';
</script>

<div class="bg-purple-900/30 backdrop-blur border border-purple-500/20 rounded-lg p-6 hover:border-purple-500/50 transition">
  {#if title}
    <h3 class="text-xl font-semibold text-white">{title}</h3>
  {/if}

  {#if subtitle}
    <p class="text-purple-300 text-sm mt-1">{subtitle}</p>
  {/if}

  <slot />

  {#if status}
    <div class="mt-4 pt-4 border-t border-purple-500/20">
      <span class="inline-block px-3 py-1 bg-purple-600/50 text-purple-200 rounded-full text-sm">
        {status}
      </span>
    </div>
  {/if}
</div>
