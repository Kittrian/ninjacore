'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { ClientDetailResponse } from '@/lib/types';
import BureauCards from '@/components/BureauCards';
import UploadDocument from '@/components/UploadDocument';

async function fetchClient(id: string): Promise<ClientDetailResponse> {
  const r = await fetch(`/api/proxy/clients/${encodeURIComponent(id)}`, { credentials: 'include' });
  if (!r.ok) throw new Error(`client ${r.status}`);
  return r.json();
}

export function ClientDetailView({ id }: { id: string }) {
  // Same query key the list view prefetches on hover — hits cache instantly.
  const { data, error, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => fetchClient(id),
    staleTime: 60_000,
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <Link href="/clients" className="text-xs text-white/50 hover:text-white">
        ← Back to clients
      </Link>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm">
          <div className="font-semibold text-red-300">API error</div>
          <pre className="text-red-200/80 mt-1 whitespace-pre-wrap">{String(error)}</pre>
        </div>
      )}

      {isLoading && !data && (
        <div className="mt-4 text-sm text-white/50">Loading…</div>
      )}

      {data && (
        <>
          <div className="mt-3 flex items-baseline gap-4">
            <h1 className="text-3xl font-bold tracking-tight">
              {data.client.firstName} {data.client.lastName}
            </h1>
            <span className="text-sm text-white/40 tabular-nums">id: {data.client.id}</span>
          </div>
          <div className="mt-1 text-sm text-white/60">
            {data.client.email || '—'} · {data.client.monitoringAgency || '—'} ·
            last sync {data.client.lastSyncedAt ? new Date(data.client.lastSyncedAt).toLocaleString() : '—'}
          </div>

          <section className="mt-8">
            <BureauCards client={data.client} />
          </section>

          <section className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wider text-white/50">Status</div>
              <div className="mt-1 text-lg">{data.client.status}</div>
              <div className="text-xs text-white/50 mt-3">Phase</div>
              <div className="text-lg">{data.client.phase}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wider text-white/50">Report</div>
              <div className="mt-1 text-lg tabular-nums">{data.client.reportDate || '—'}</div>
              <div className="text-xs text-white/50 mt-3">Open accounts</div>
              <div className="text-lg tabular-nums">{data.client.openAccounts?.length ?? 0}</div>
            </div>
          </section>

          <section className="mt-8">
            <UploadDocument clientId={data.client.id} />
          </section>
        </>
      )}
    </div>
  );
}
