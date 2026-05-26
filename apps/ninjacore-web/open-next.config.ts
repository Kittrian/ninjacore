// OpenNext configuration for Cloudflare Workers deployment.
// Docs: https://opennext.js.org/cloudflare
import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';

export default defineCloudflareConfig({
  // Cache rendered pages in R2 so warm edges don't re-render.
  // Bind your R2 bucket as NEXT_INC_CACHE_R2_BUCKET in wrangler.toml.
  incrementalCache: r2IncrementalCache,
});
