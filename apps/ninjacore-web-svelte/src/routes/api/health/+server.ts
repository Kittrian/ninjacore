import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

async function checkRustBackend(): Promise<{
  status: 'connected' | 'unavailable';
  latency?: number;
  error?: string;
}> {
  const socketPath = process.env.RUST_API_ORIGIN || 'unix:///tmp/ninjacore.sock';

  if (!socketPath.startsWith('unix://')) {
    return { status: 'unavailable', error: 'Unix socket not configured' };
  }

  try {
    const start = Date.now();
    const url = `http://${socketPath}/api/health`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    } as any);

    const latency = Date.now() - start;

    if (response.ok) {
      return { status: 'connected', latency };
    } else {
      return { status: 'unavailable', error: `HTTP ${response.status}` };
    }
  } catch (err) {
    return {
      status: 'unavailable',
      error: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}

export const GET: RequestHandler = async () => {
  const timestamp = new Date().toISOString();
  const uptime = process.uptime ? process.uptime() : 0;
  const backend = await checkRustBackend();

  return json({
    status: backend.status === 'connected' ? 'healthy' : 'degraded',
    timestamp,
    uptime,
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    frontend: {
      status: 'ready',
      port: process.env.API_PORT || 3100,
    },
    backend: {
      unix_socket: process.env.RUST_API_ORIGIN || 'unix:///tmp/ninjacore.sock',
      ...backend,
    },
  });
};
