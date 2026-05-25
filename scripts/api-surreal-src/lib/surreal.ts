// src/lib/surreal.ts
// SurrealDB HTTP client for the api app
// Replaces Sequelize — talks directly to SurrealDB via HTTP

const SURREAL_URL  = 'http://127.0.0.1:8000/sql';
const SURREAL_REST = 'http://127.0.0.1:8000';
const SURREAL_NS   = 'ninja';
const SURREAL_DB   = 'dispute';
const SURREAL_AUTH = 'Basic ' + Buffer.from('root:Malachi77').toString('base64');

const SURREAL_HEADERS = {
  Accept: 'application/json',
  Authorization: SURREAL_AUTH,
  'Surreal-NS': SURREAL_NS,
  'Surreal-DB': SURREAL_DB,
};

// ─── Raw query execution ──────────────────────────────────────────────────────

export async function surql(query: string): Promise<any[]> {
  const res = await fetch(SURREAL_URL, {
    method: 'POST',
    headers: { ...SURREAL_HEADERS, 'Content-Type': 'application/surrealql' },
    body: query,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SurrealDB HTTP ${res.status}: ${txt.slice(0, 400)}`);
  }
  const d: any[] = await res.json();
  const errs = d.filter((r: any) => r.status === 'ERR');
  if (errs.length) throw new Error(`SurrealDB ERR: ${JSON.stringify(errs[0])}`);
  return Array.isArray(d[0]?.result) ? d[0].result : [];
}

/** Execute multi-statement query, return all result arrays */
export async function surqlMulti(query: string): Promise<any[][]> {
  const res = await fetch(SURREAL_URL, {
    method: 'POST',
    headers: { ...SURREAL_HEADERS, 'Content-Type': 'application/surrealql' },
    body: query,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SurrealDB HTTP ${res.status}: ${txt.slice(0, 400)}`);
  }
  const d: any[] = await res.json();
  return d.map((r: any) => Array.isArray(r?.result) ? r.result : []);
}

export async function surqlOne(query: string): Promise<any | null> {
  const rows = await surql(query);
  return rows[0] ?? null;
}

// ─── REST API (PUT/PATCH for large payloads) ──────────────────────────────────

export async function restPut(table: string, id: string | number, data: Record<string, any>): Promise<any> {
  const res = await fetch(`${SURREAL_REST}/key/${table}/${id}`, {
    method: 'PUT',
    headers: { ...SURREAL_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SurrealDB PUT HTTP ${res.status}: ${txt.slice(0, 300)}`);
  }
  const d = await res.json();
  return Array.isArray(d) ? d[0] : d;
}

export async function restPatch(table: string, id: string | number, data: Record<string, any>): Promise<any> {
  const res = await fetch(`${SURREAL_REST}/key/${table}/${id}`, {
    method: 'PATCH',
    headers: { ...SURREAL_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SurrealDB PATCH HTTP ${res.status}: ${txt.slice(0, 300)}`);
  }
  const d = await res.json();
  return Array.isArray(d) ? d[0] : d;
}

export async function restGet(table: string, id: string | number): Promise<any | null> {
  const res = await fetch(`${SURREAL_REST}/key/${table}/${id}`, {
    method: 'GET',
    headers: SURREAL_HEADERS,
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SurrealDB GET HTTP ${res.status}: ${txt.slice(0, 300)}`);
  }
  const d = await res.json();
  return Array.isArray(d) ? (d[0] ?? null) : d;
}

export async function restDelete(table: string, id: string | number): Promise<void> {
  const res = await fetch(`${SURREAL_REST}/key/${table}/${id}`, {
    method: 'DELETE',
    headers: SURREAL_HEADERS,
  });
  if (!res.ok && res.status !== 404) {
    const txt = await res.text();
    throw new Error(`SurrealDB DELETE HTTP ${res.status}: ${txt.slice(0, 300)}`);
  }
}

// ─── String helpers ───────────────────────────────────────────────────────────

/** Escape a value for embedding in SurrealQL string literals */
export function sEsc(v: any): string {
  if (v == null) return '';
  return String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

/** Escape for use inside ⟨⟩ record ID syntax */
export function sId(v: any): string {
  return String(v ?? '').replace(/[⟨⟩]/g, '_');
}

/** Extract the ID suffix from a SurrealDB record ID like "table:123" */
export function extractId(recordId: string): string {
  const str = String(recordId || '');
  const idx = str.indexOf(':');
  return idx >= 0 ? str.slice(idx + 1) : str;
}

/** Return numeric id from SurrealDB record (extracts and parses if needed) */
export function numId(recordId: string): number {
  return parseInt(extractId(recordId), 10);
}

/** Safely parse JSON, return fallback on error */
export function safeJson<T = any>(v: any, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === 'object') return v as T;
  try { return JSON.parse(v) as T; } catch { return fallback; }
}

/** Format a JS Date for SurrealQL */
export function fmtDt(v: any): string | null {
  if (!v) return null;
  try { return new Date(v).toISOString(); } catch { return null; }
}

/** Normalise a SurrealDB record by stripping the id prefix and converting to expected integer id */
export function normalizeRecord(r: any): any {
  if (!r) return r;
  const out = { ...r };
  if (out.id && typeof out.id === 'string') {
    const suffix = extractId(out.id);
    const n = parseInt(suffix, 10);
    out.id = isNaN(n) ? suffix : n;
  }
  return out;
}

export function normalizeRecords(rows: any[]): any[] {
  return rows.map(normalizeRecord);
}
