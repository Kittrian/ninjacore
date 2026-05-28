# NinjaCore Frontend Architecture

## Overview

This is a **Next.js 15 App Router** frontend built for optimal performance with streaming SSR, partial prerendering, and edge runtime optimization.

```
┌─ Server Components (default)
│  └─ Zero client-side JS for static UI
│  └─ Direct data fetching (no waterfall)
│
├─ Client Components (selective islands)
│  └─ Interactive features (search, filters, real-time)
│  └─ Client-side state management
│
├─ Streaming SSR + Suspense
│  └─ Progressive HTML delivery
│  └─ Skeleton loaders for FCP optimization
│
├─ Partial Prerendering (PPR)
│  └─ Static shell (0ms)
│  └─ Dynamic holes (streamed on-demand)
│
└─ Edge Runtime for API routes
   └─ <50ms TTFB globally via Cloudflare Workers
```

## File Structure

```
src/
├── app/
│  ├── layout.tsx              # Root layout (Server Component)
│  ├── page.tsx                # Homepage with static content
│  ├── globals.css             # Global styles + Tailwind
│  ├── providers.tsx           # Client context wrapper (Query)
│  │
│  ├── clients/
│  │  ├── page.tsx             # Clients list page (streaming)
│  │  └── [id]/
│  │     └── page.tsx          # Client detail (PPR + Suspense)
│  │
│  └── api/
│     └── proxy/[...path]/
│        └── route.ts          # API proxy (edge runtime)
│
├── components/
│  ├── clients-view.tsx        # List with filters (Client)
│  ├── client-detail-view.tsx  # Detail view (Client)
│  ├── clients-server.tsx      # Server wrapper with Suspense
│  ├── skeletons.tsx           # Loading UI components
│  ├── error-boundary.tsx      # Error boundary (Client)
│  ├── BureauCards.tsx         # Bureau score cards (Client)
│  └── UploadDocument.tsx      # Document upload (Client)
│
└── lib/
   ├── api.ts                  # API helpers
   └── types.ts                # TypeScript types
```

## Key Patterns

### 1. Server Components (Default)

The layout and page files are Server Components by default:

```tsx
// app/clients/page.tsx
export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  // Direct data fetching (no waterfall)
  const clients = await fetch('/api/proxy/clients');
  return <ClientsView data={clients} />;
}
```

**Benefits:**
- Zero client JS for static rendering
- Direct API access (no CORS)
- Automatic code splitting

### 2. Client Components (Interactive Islands)

Only interactive parts are marked `'use client'`:

```tsx
// components/clients-view.tsx
'use client';

export function ClientsView() {
  const [query, setQuery] = useState('');
  const { data } = useQuery({
    queryKey: ['clients'],
    queryFn: () => fetch('/api/proxy/clients'),
  });
  
  return <>...</>;
}
```

**Benefits:**
- Minimal JS overhead
- Hydration only where needed
- React Query for caching

### 3. Streaming with Suspense

Pages wrap Client Components in Suspense boundaries:

```tsx
// app/clients/page.tsx
<Suspense fallback={<ClientListSkeleton />}>
  <ClientsView />
</Suspense>
```

**Benefits:**
- Fast First Contentful Paint (FCP)
- Progressive HTML delivery
- Skeleton loaders for perceived performance

### 4. Partial Prerendering (PPR)

Enabled in `next.config.ts`:

```ts
experimental: {
  ppr: true,  // Static shell + dynamic holes
}
```

The static shell renders instantly (from cache), dynamic holes stream as they resolve.

**Use case:** Client detail pages with:
- Static header (prerendered)
- Dynamic bureau scores (streamed)

### 5. Edge Runtime for API Routes

The proxy API route runs on the edge:

```ts
// app/api/proxy/[...path]/route.ts
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  // Runs at Cloudflare POP closest to user
  // TTFB target: <50ms globally
}
```

**Benefits:**
- Lowest latency for geographically distributed users
- No cold starts (instant execution)
- Automatic cookie forwarding

## Data Fetching Strategy

### Query-Level Caching (React Query)

```tsx
useQuery({
  queryKey: ['clients'],
  queryFn: () => fetch('/api/proxy/clients'),
  staleTime: 30_000,        // 30s until stale
  gcTime: 5 * 60_000,       // 5m garbage collection
  refetchOnWindowFocus: false,
  retry: 1,
});
```

**Cache behavior:**
- Fresh data for 30s after fetch
- Can refetch if explicitly called
- Cleared after 5m of inactivity

### Prefetching

The list view prefetches detail pages on hover:

```tsx
function prefetchDetail(id: string) {
  qc.prefetchQuery({
    queryKey: ['client', id],
    queryFn: () => fetchClient(id),
    staleTime: 60_000,
  });
}
```

**Result:** Click-to-detail transition feels instant.

### Pagination

Client-side pagination with `requestIdleCallback`:

```tsx
// Stream 100 rows at a time in background
useEffect(() => {
  const handle = schedule(() => {
    setVisibleCount((n) => Math.min(n + PAGE_SIZE, filtered.length));
  }, { timeout: 500 });
}, [visibleCount, filtered.length]);
```

## Performance Metrics

**Target metrics:**
- **FCP (First Contentful Paint):** <1.5s (skeleton visible)
- **LCP (Largest Contentful Paint):** <2.5s (full page)
- **TTFB (Time to First Byte):** <50ms (edge proxy)
- **CLS (Cumulative Layout Shift):** <0.1 (fixed layouts)

## Development

### Running locally

```bash
cd apps/ninjacore-web
npm run dev
# Opens http://localhost:3100
```

### Building for production

```bash
npm run build
npm start
```

### Deploying to Cloudflare Workers

```bash
npm run cf:deploy
```

Uses OpenNextJS to transform Next.js output for Cloudflare.

## Key Dependencies

- **next** (15.5): App Router with streaming support
- **react** (19): Server & Client Components
- **@tanstack/react-query** (5): Data fetching & caching
- **tailwindcss** (4): Utility-first CSS
- **wrangler** (4): Cloudflare Workers CLI

## Patterns to Follow

1. **New Server Components** → no `'use client'` directive
2. **Interactive features** → wrap in `'use client'`
3. **Async operations** → use Server Components + async/await
4. **API calls in Client Components** → use React Query
5. **Loading states** → use Suspense + skeleton components
6. **Error handling** → use error boundaries + try/catch
