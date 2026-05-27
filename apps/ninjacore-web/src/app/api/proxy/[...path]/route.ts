// Same-origin proxy. Browser hits /api/proxy/<anything>; the Worker forwards
// it to the Rust ninjacore API. No CORS, no preflight, no cookie domain dance.
//
// Cookies (PASETO `txn`, etc.) are forwarded both directions.
//
// Runtime: edge — runs at the Cloudflare POP closest to the user.

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ORIGIN =
  process.env.NINJACORE_API_ORIGIN ||
  process.env.NEXT_PUBLIC_API_BASE ||
  'https://api.ninjacore.ninjadispute.com';

// Strip request headers Cloudflare adds that the upstream doesn't want.
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

async function forward(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const suffix = (path || []).map(encodeURIComponent).join('/');
  const search = req.nextUrl.search || '';
  const url = `${ORIGIN.replace(/\/+$/, '')}/api/${suffix}${search}`;

  const headers = new Headers();
  for (const [k, v] of req.headers.entries()) {
    if (HOP_BY_HOP.has(k.toLowerCase())) continue;
    headers.set(k, v);
  }
  // Tell the upstream where the user actually came from.
  const fwd = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '';
  if (fwd) headers.set('x-forwarded-for', fwd);

  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body;

  const upstream = await fetch(url, {
    method: req.method,
    headers,
    body,
    // @ts-expect-error duplex required for streaming bodies in undici/Workers
    duplex: 'half',
    redirect: 'manual',
  });

  // Pass through Set-Cookie + other headers, strip hop-by-hop.
  const respHeaders = new Headers();
  for (const [k, v] of upstream.headers.entries()) {
    if (HOP_BY_HOP.has(k.toLowerCase())) continue;
    respHeaders.append(k, v);
  }
  // Make sure the browser doesn't cache auth responses by default.
  if (!respHeaders.has('cache-control')) respHeaders.set('cache-control', 'no-store');

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const HEAD = forward;
