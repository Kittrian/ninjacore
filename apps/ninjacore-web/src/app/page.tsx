import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">NinjaCore</h1>
      <p className="text-white/60 mt-3 text-lg">
        Edge-rendered ops console for credit dispute operations.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link
          href="/clients"
          className="group rounded-xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 transition"
        >
          <div className="text-sm uppercase tracking-wider text-cyan-400">Clients</div>
          <div className="text-2xl font-semibold mt-1">Browse roster</div>
          <div className="text-white/50 text-sm mt-2 group-hover:text-white/70">
            List, search, and open a client's bureau cards →
          </div>
        </Link>

        <a
          href="/api/proxy/clients"
          className="group rounded-xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 transition"
        >
          <div className="text-sm uppercase tracking-wider text-emerald-400">API health</div>
          <div className="text-2xl font-semibold mt-1">Probe upstream</div>
          <div className="text-white/50 text-sm mt-2 group-hover:text-white/70">
            Hit the Rust ninjacore API via the proxy route →
          </div>
        </a>
      </div>

      <div className="mt-12 text-xs text-white/40 space-y-1">
        <div>Frontend: Next.js 15 App Router · React 19 RSC · Tailwind v4</div>
        <div>Edge runtime: Cloudflare Workers (via OpenNext)</div>
        <div>API: Rust + Axum on Hetzner, SurrealDB on loopback</div>
      </div>
    </div>
  );
}
