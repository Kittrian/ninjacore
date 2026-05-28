import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Partial Prerendering: static shell + dynamic holes for fast FCP + fresh data
    ppr: true,
    // Server Actions with streaming and dynamic metadata
    serverActions: { bodySizeLimit: '10mb' },
    // Enable dynamic I/O in Server Components
    dynamicIO: true,
  },
  // Cache static shell, stream dynamic holes
  onDemandEntries: {
    maxInactiveAge: 60 * 60 * 1000,
    pagesBufferLength: 5,
  },
  async rewrites() {
    return [];
  },
};

export default config;
