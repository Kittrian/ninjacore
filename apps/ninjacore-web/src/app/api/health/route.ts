import { NextResponse } from 'next/server';
import { apiOrigin } from '@/lib/api';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  let upstream: { ok: boolean; status?: number; error?: string } = { ok: false };
  try {
    const res = await fetch(`${apiOrigin.replace(/\/+$/, '')}/api/auth/status`, {
      headers: { Accept: 'application/json' },
    });
    upstream = { ok: res.ok, status: res.status };
  } catch (err) {
    upstream = { ok: false, error: String(err) };
  }
  return NextResponse.json({
    ok: true,
    edge: true,
    runtime: 'cloudflare-workers',
    apiOrigin,
    upstream,
    ts: new Date().toISOString(),
  });
}
