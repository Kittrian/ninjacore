<script lang="ts">
  import { writable } from 'svelte/store';
  import { Loader2, Download, FileText } from 'lucide-svelte';

  export let clientId: string;

  let letterType: 'dispute' | 'cease' | 'validation' = 'dispute';
  let isGenerating = false;
  let progress = writable(0);
  let message = writable('');
  let pdfUrl: string | null = null;

  async function generateLetter() {
    isGenerating = true;
    progress.set(0);
    message.set('Starting generation...');

    try {
      const response = await fetch('/api/letters/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, type: letterType }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              progress.set(data.progress);
              message.set(data.message);

              if (data.pdfBase64) {
                const binaryString = atob(data.pdfBase64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: 'application/pdf' });
                pdfUrl = URL.createObjectURL(blob);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      message.set(`Error: ${error}`);
    } finally {
      isGenerating = false;
    }
  }

  function downloadPDF() {
    if (!pdfUrl) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `letter-${clientId}-${letterType}.pdf`;
    a.click();
  }
</script>

<div class="space-y-4">
  <div class="flex flex-col gap-4">
    <label class="text-sm font-medium">
      Letter Type
      <select bind:value={letterType} disabled={isGenerating} class="input mt-1">
        <option value="dispute">Dispute Letter</option>
        <option value="cease">Cease & Desist</option>
        <option value="validation">Debt Validation</option>
      </select>
    </label>

    <button
      on:click={generateLetter}
      disabled={isGenerating}
      class="btn btn-primary flex items-center gap-2 justify-center"
    >
      {#if isGenerating}
        <Loader2 class="w-4 h-4 animate-spin" />
        Generating...
      {:else}
        <FileText class="w-4 h-4" />
        Generate Letter
      {/if}
    </button>

    {#if isGenerating}
      <div class="space-y-2">
        <div class="w-full bg-white/10 rounded-full h-2 overflow-hidden">
          <div
            class="bg-cyan-500 h-full transition-all duration-300"
            style="width: {$progress}%"
          ></div>
        </div>
        <p class="text-sm text-white/60">{$message}</p>
      </div>
    {/if}

    {#if pdfUrl}
      <div class="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <FileText class="w-5 h-5 text-emerald-400" />
            <span class="text-sm font-medium">PDF Ready</span>
          </div>
          <button on:click={downloadPDF} class="btn btn-primary btn-sm">
            <Download class="w-4 h-4" />
            Download
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .btn-sm {
    @apply px-3 py-1 text-xs;
  }
</style>
