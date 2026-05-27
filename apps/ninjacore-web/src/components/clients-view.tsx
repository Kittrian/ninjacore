'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClientListItem, ClientListResponse, ClientDetailResponse } from '@/lib/types';

const PAGE_SIZE = 100;

async function fetchClients(): Promise<ClientListResponse> {
  const r = await fetch('/api/proxy/clients', { credentials: 'include' });
  if (!r.ok) throw new Error(`clients ${r.status}`);
  return r.json();
}

async function fetchClient(id: string): Promise<ClientDetailResponse> {
  const r = await fetch(`/api/proxy/clients/${encodeURIComponent(id)}`, { credentials: 'include' });
  if (!r.ok) throw new Error(`client ${r.status}`);
  return r.json();
}

function compareClients(a: ClientListItem, b: ClientListItem): number {
  // Tier 1: negatives-first by daysLeft. Then 0+ in ascending order.
  // Missing daysLeft falls to the bottom.
  const av = typeof a.daysLeft === 'number' ? a.daysLeft : Number.MAX_SAFE_INTEGER;
  const bv = typeof b.daysLeft === 'number' ? b.daysLeft : Number.MAX_SAFE_INTEGER;
  if (av !== bv) return av - bv;
  // Tier 2: stable secondary by lastName, firstName.
  const an = `${a.lastName} ${a.firstName}`.toLowerCase();
  const bn = `${b.lastName} ${b.firstName}`.toLowerCase();
  return an.localeCompare(bn);
}

export function ClientsView() {
  const qc = useQueryClient();
  const { data, error, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: fetchClients,
  });

  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Filter + sort once per (data, query).
  const filtered = useMemo(() => {
    if (!data) return [] as ClientListItem[];
    const q = query.trim().toLowerCase();
    const rows = q
      ? data.clients.filter((c) => {
          const hay = `${c.firstName} ${c.lastName} ${c.email} ${c.phone}`.toLowerCase();
          return hay.includes(q);
        })
      : data.clients;
    return [...rows].sort(compareClients);
  }, [data, query]);

  // Silent background pagination: render first 100 immediately, then stream
  // the rest into view in 100-row chunks via requestIdleCallback.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, data]);

  useEffect(() => {
    if (visibleCount >= filtered.length) return;
    const w = window as Window & {
      requestIdleCallback?: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number;
      cancelIdleCallback?: (h: number) => void;
    };
    const schedule = w.requestIdleCallback || ((cb) => window.setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 } as IdleDeadline), 50));
    const cancel = w.cancelIdleCallback || window.clearTimeout;
    const handle = schedule(() => {
      setVisibleCount((n) => Math.min(n + PAGE_SIZE, filtered.length));
    }, { timeout: 500 });
    return () => cancel(handle as number);
  }, [visibleCount, filtered.length]);

  // Prefetch the detail for a row on hover. Cheap and cached — repeated hovers
  // hit the cache instead of refiring the request.
  function prefetchDetail(id: string) {
    qc.prefetchQuery({
      queryKey: ['client', id],
      queryFn: () => fetchClient(id),
      staleTime: 60_000,
    });
  }

  // When the active search narrows the list to exactly one client, eagerly
  // preload that client's detail so the click→navigate transition feels instant.
  useEffect(() => {
    if (!query.trim()) return;
    if (filtered.length !== 1) return;
    prefetchDetail(filtered[0].id);
    // prefetchDetail is stable (closure over qc); intentionally not in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filtered]);

  const visible = filtered.slice(0, visibleCount);
  const streaming = visibleCount < filtered.length;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold">Clients</h1>
        {data && (
          <span className="text-sm text-white/40">
            {filtered.length} of {data.clients.length}
            {streaming && <span className="ml-2 text-cyan-400/60">· loading {filtered.length - visibleCount} more…</span>}
          </span>
        )}
      </div>

      <div className="mt-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, phone…"
          className="w-full max-w-md rounded-lg bg-white/5 border border-white/10 px-4 py-2 outline-none focus:border-cyan-400/60"
        />
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm">
          <div className="font-semibold text-red-300">API error</div>
          <pre className="text-red-200/80 mt-1 whitespace-pre-wrap">{String(error)}</pre>
        </div>
      )}

      {isLoading && (
        <div className="mt-6 text-sm text-white/50">Loading clients…</div>
      )}

      {data && (
        <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-white/60 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-4 py-3">Days Left</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Monitoring</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Phase</th>
                <th className="px-4 py-3">Last report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {visible.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-white/5 transition"
                  onMouseEnter={() => prefetchDetail(c.id)}
                  onFocus={() => prefetchDetail(c.id)}
                >
                  <td className={`px-4 py-3 tabular-nums ${typeof c.daysLeft === 'number' && c.daysLeft < 0 ? 'text-red-300 font-semibold' : 'text-white/70'}`}>
                    {typeof c.daysLeft === 'number' ? c.daysLeft : '—'}
                  </td>
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
          {streaming && (
            <div className="px-4 py-3 text-xs text-white/40 bg-white/5 border-t border-white/5">
              Streaming remaining rows in the background…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
