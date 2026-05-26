import Link from 'next/link';
import { headers } from 'next/headers';
import { api, ApiError } from '@/lib/api';
import type { ClientListResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const cookie = (await headers()).get('cookie') || '';

  let data: ClientListResponse | null = null;
  let error: string | null = null;
  try {
    data = await api<ClientListResponse>('/api/clients', { cookie });
  } catch (err) {
    error = err instanceof ApiError ? `${err.status}: ${err.body.slice(0, 200)}` : String(err);
  }

  const query = (q || '').toLowerCase().trim();
  const filtered = data
    ? data.clients.filter((c) => {
        if (!query) return true;
        const hay = `${c.firstName} ${c.lastName} ${c.email} ${c.phone}`.toLowerCase();
        return hay.includes(query);
      })
    : [];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold">Clients</h1>
        {data && (
          <span className="text-sm text-white/40">
            {filtered.length} of {data.clients.length}
          </span>
        )}
      </div>

      <form className="mt-4">
        <input
          name="q"
          defaultValue={q || ''}
          placeholder="Search by name, email, phone…"
          className="w-full max-w-md rounded-lg bg-white/5 border border-white/10 px-4 py-2 outline-none focus:border-cyan-400/60"
        />
      </form>

      {error && (
        <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm">
          <div className="font-semibold text-red-300">API error</div>
          <pre className="text-red-200/80 mt-1 whitespace-pre-wrap">{error}</pre>
          <div className="text-red-200/60 mt-2">
            Verify <code>NINJACORE_API_ORIGIN</code> in <code>.env.local</code> points at a reachable
            ninjacore API.
          </div>
        </div>
      )}

      {data && (
        <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-white/60 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Monitoring</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Phase</th>
                <th className="px-4 py-3">Last report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.slice(0, 250).map((c) => (
                <tr key={c.id} className="hover:bg-white/5 transition">
                  <td className="px-4 py-3">
                    <Link
                      href={`/clients/${c.id}`}
                      className="font-medium text-cyan-300 hover:text-cyan-200"
                    >
                      {c.firstName} {c.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-white/70">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-white/70">{c.monitoringAgency || '—'}</td>
                  <td className="px-4 py-3 text-white/70">{c.status}</td>
                  <td className="px-4 py-3 text-white/70">{c.phase}</td>
                  <td className="px-4 py-3 text-white/70 tabular-nums">{c.reportDate || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 250 && (
            <div className="px-4 py-3 text-xs text-white/50 bg-white/5 border-t border-white/5">
              Showing first 250. Refine the search to narrow.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
