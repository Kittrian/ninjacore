import Link from 'next/link';

export const metadata = {
  title: 'NinjaCore',
};

export default function HomePage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <div className="space-y-2 mb-12">
        <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-white via-cyan-300 to-cyan-400 bg-clip-text text-transparent">
          NinjaCore
        </h1>
        <p className="text-white/60 text-lg">
          Edge-rendered ops console for credit dispute operations.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mb-12">
        <Link
          href="/clients"
          className="group rounded-xl border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10 p-6 transition-all duration-200"
        >
          <div className="text-sm uppercase tracking-wider text-cyan-400 font-semibold">
            Clients
          </div>
          <div className="text-2xl font-semibold mt-2">Browse roster</div>
          <div className="text-white/50 text-sm mt-3 group-hover:text-white/70">
            List, search, and open a client's bureau cards →
          </div>
        </Link>

        <a
          href="/api/proxy/clients"
          className="group rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 p-6 transition-all duration-200"
        >
          <div className="text-sm uppercase tracking-wider text-emerald-400 font-semibold">
            API Health
          </div>
          <div className="text-2xl font-semibold mt-2">Probe upstream</div>
          <div className="text-white/50 text-sm mt-3 group-hover:text-white/70">
            Hit the Rust ninjacore API via proxy route →
          </div>
        </a>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-8 space-y-6">
        <div>
          <h2 className="text-sm uppercase tracking-wider text-white/50 font-semibold mb-4">
            Modern Architecture
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 text-sm text-white/70">
            <div>
              <div className="text-cyan-400 font-semibold">✨ Streaming SSR</div>
              <div className="text-white/60 mt-1">Progressive HTML delivery with Suspense</div>
            </div>
            <div>
              <div className="text-emerald-400 font-semibold">⚡ Partial Prerendering</div>
              <div className="text-white/60 mt-1">Static shell + dynamic holes</div>
            </div>
            <div>
              <div className="text-blue-400 font-semibold">🌍 Edge Runtime</div>
              <div className="text-white/60 mt-1">&lt;50ms TTFB globally via Cloudflare</div>
            </div>
            <div>
              <div className="text-purple-400 font-semibold">🎯 Server Components</div>
              <div className="text-white/60 mt-1">Zero client JS for static UI</div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6">
          <h2 className="text-sm uppercase tracking-wider text-white/50 font-semibold mb-4">
            Tech Stack
          </h2>
          <div className="grid gap-3 text-sm text-white/70">
            <div>
              <span className="text-cyan-400">Frontend:</span> Next.js 15 App Router · React 19 Server Components · Tailwind v4
            </div>
            <div>
              <span className="text-emerald-400">Runtime:</span> Cloudflare Workers (via OpenNext)
            </div>
            <div>
              <span className="text-blue-400">API:</span> Rust + Axum on Hetzner · SurrealDB backend
            </div>
            <div>
              <span className="text-purple-400">Data:</span> React Query · Streaming pagination · Smart prefetching
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 text-xs text-white/40 text-center">
        <Link href="#" className="hover:text-white/60 transition">
          View Architecture →
        </Link>
      </div>
    </div>
  );
}
