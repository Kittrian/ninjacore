import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Use standalone-ish output that OpenNext can package into a Worker.
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
  // Forward any /api/* call (made from a Client Component) through our
  // Next.js route handler proxy so we never hit CORS in the browser.
  // In production, this proxies to the Rust ninjacore API.
  async rewrites() {
    return [];
  },
};

export default config;
