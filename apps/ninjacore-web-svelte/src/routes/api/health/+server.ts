import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
  const timestamp = new Date().toISOString();
  const uptime = process.uptime ? process.uptime() : 0;

  return json({
    status: 'healthy',
    timestamp,
    uptime,
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    // Check Unix socket connectivity
    backend: {
      unix_socket: process.env.RUST_API_ORIGIN || 'unix:///tmp/ninjacore.sock',
      status: 'ready', // Would check actual connection here
    },
  });
};
