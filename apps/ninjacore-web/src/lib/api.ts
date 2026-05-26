// Server-side fetch helper. Reaches the Rust ninjacore API directly from
// the Worker / Node runtime (no CORS, no preflight). Client Components should
// hit /api/proxy/* (the route handler in app/api/proxy/[...path]/route.ts)
// instead of importing this directly.

const ORIGIN =
  process.env.NINJACORE_API_ORIGIN ||
  process.env.NEXT_PUBLIC_API_BASE ||
  'https://api.ninjacore.ninjadispute.com';

export type ApiOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  // Pass through the inbound request's cookie so PASETO auth flows through.
  cookie?: string;
  // Next.js fetch cache hints (server-side).
  revalidate?: number | false;
  tags?: string[];
};

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const url = ORIGIN.replace(/\/+$/, '') + (path.startsWith('/') ? path : `/${path}`);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(opts.headers || {}),
  };
  if (opts.body !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (opts.cookie) headers.Cookie = opts.cookie;

  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers,
    body: opts.body === undefined ? undefined : typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body),
    // @ts-expect-error Next.js extends RequestInit with `next`
    next: opts.revalidate !== undefined || opts.tags ? { revalidate: opts.revalidate, tags: opts.tags } : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, text || res.statusText, url);
  }

  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export class ApiError extends Error {
  constructor(public status: number, public body: string, public url: string) {
    super(`API ${status} ${url}: ${body.slice(0, 200)}`);
    this.name = 'ApiError';
  }
}

export const apiOrigin = ORIGIN;
