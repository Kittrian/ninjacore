# FRONT-END: NinjaCore Dashboard

High-performance SvelteKit + Svelte 5 frontend with Unix domain socket communication.

## 🏗️ Architecture

```
SvelteKit + Svelte 5 ........... Routing, SSR, Svelte 5 runes
├── $state / $derived / $effect  Fine-grained reactivity
├── Bun ....................... Runtime (fast startup)
├── Tailwind v4 (Oxide) ....... CSS, only ships used styles
│
TanStack Query v5 .............. Server state management
├── staleTime: 60s ............ Fresh data window
├── gcTime: 5min .............. Cache retention
├── prefetchQuery on hover .... Load before click
└── Suspense support .......... Streaming responses
│
TanStack Virtual .............. Virtual scrolling
├── Renders ~15 visible rows .. Of 3000+ clients
├── Fixed row height .......... Fast measurement
└── Overscan: 10 ............. Smooth scrolling
│
MiniSearch .................... Client-side BM25 search
├── In-memory index .......... Fast full-text search
├── Web Worker ............... Off main thread
└── <100ms search ............ Instant results
│
Unix Sockets .................. Ultra-low latency
├── Direct IPC to BACK-END ... Microsecond latency
├── Caddy reverse proxy ...... HTTP/3 support
└── No TCP overhead .......... Same-VPS optimization
```

## 📦 Key Dependencies

```json
{
  "@tanstack/svelte-query": "^5.x",
  "@tanstack/svelte-virtual": "^3.x",
  "minisearch": "^6.x",
  "tailwindcss": "^4.x",
  "svelte": "^5.x"
}
```

## 🚀 Development

```bash
cd FRONT-END

# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📖 File Structure

```
src/
├── routes/
│   ├── +layout.svelte ........ Root layout (QueryClientProvider)
│   ├── +page.svelte .......... Home page
│   ├── clients/
│   │   └── +page.svelte ...... Client list with virtual scrolling
│   ├── settings/ ............ Settings page
│   └── [id]/ ............... Client detail page
│
├── lib/
│   ├── api.ts .............. API client (Unix socket → backend)
│   ├── stores.ts ........... Svelte stores (reactive state)
│   ├── query.ts ........... TanStack Query config
│   ├── search.ts .......... MiniSearch integration
│   └── components/ ........ Reusable Svelte components
│
├── workers/
│   └── search.worker.ts ... Web Worker for search
│
└── app.css ............... Tailwind + custom styles

static/
├── favicon.png
└── robots.txt
```

## 🎯 Key Features

### 1. Virtual Scrolling
- Renders only visible rows (~15 at a time)
- Handles 3000+ clients smoothly
- Fixed row height for accurate measurement

```svelte
const virtualizer = createVirtualizer({
  count: filteredClients.length,
  estimateSize: () => 60,
  overscan: 10,
});
```

### 2. Client-Side Search with Web Worker
- MiniSearch for BM25 full-text search
- Web Worker keeps UI responsive
- <100ms search on 5000 clients

```ts
// In Web Worker (off main thread)
const searchIndex = new MiniSearch({
  fields: [
    { name: 'first_name', boost: 10 },
    { name: 'email', boost: 5 },
  ],
});
```

### 3. TanStack Query v5 Caching
- Automatic cache management
- Prefetch on hover
- Optimistic updates for mutations
- Suspense boundaries for streaming

```ts
const clientsQuery = createQuery({
  queryKey: queryKeys.clients(),
  queryFn: () => api.getClients(),
  staleTime: 60000,    // 1 minute
  gcTime: 300000,      // 5 minutes
});
```

### 4. Unix Socket Communication
- Zero-copy IPC to BACK-END
- Caddy proxy configuration:
  ```
  reverse_proxy unix//run/ninjacore/ninjacore.sock
  ```
- Development fallback to TCP `:3019`

## 🔌 API Integration

All API calls go through `src/lib/api.ts`:

```ts
// Login
await login('admin', 'Texas123!')

// Get clients (loads 5000 at startup)
const clients = await getClients(0, 5000)

// Search (server-side fallback)
const results = await searchClients('john')

// Client detail (prefetched on hover)
const client = await getClient('123')
```

## 🎨 Styling

Tailwind CSS v4 with Oxide compiler:
- Only CSS used in components ships
- Significantly smaller CSS bundles
- PostCSS for autoprefixing

```svelte
<div class="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600">
  Content
</div>
```

## 🌐 Deployment

### Production Build

```bash
npm run build
node build
```

### Bun Runtime (Optional)
```bash
bun install
bun run dev
bun run build
bun run start
```

### Caddy Configuration
```
ninjacore.ninjadispute.com {
  # Static assets
  @static path *.css *.js *.woff2 *.png
  header @static Cache-Control "public, max-age=31536000, immutable"

  # API to BACK-END via Unix socket
  @api path /api/*
  reverse_proxy @api unix//run/ninjacore/ninjacore.sock {
    flush_interval -1
  }

  # Frontend app
  reverse_proxy localhost:3000 {
    flush_interval -1
  }

  # HTTP/3 (QUIC)
  encode gzip
}
```

## 📊 Performance Targets

- **FCP (First Contentful Paint):** <1.5s (SSR)
- **LCP (Largest Contentful Paint):** <2.5s
- **CLS (Cumulative Layout Shift):** <0.1
- **Search response:** <100ms
- **API latency:** <5ms (Unix socket)

## 🐛 Debugging

```bash
# Enable debug logging
export DEBUG=ninjacore:*
npm run dev

# Inspect virtual scroller
$virtualizer.getTotalSize()
$virtualizer.getVirtualItems()

# Check cache state
$clientsQuery.data
$clientsQuery.isLoading
```

## 🔗 Related

- **BACK-END:** `/BACK-END/` - Rust Axum API server
- **Database:** SurrealDB (ninja/dispute namespace)
- **Proxy:** Caddy with HTTP/3 support
