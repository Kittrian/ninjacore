import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: {
    default: 'NinjaCore',
    template: '%s · NinjaCore',
  },
  description: 'Credit dispute operations console',
  keywords: ['credit', 'disputes', 'operations', 'bureau', 'monitoring'],
  authors: [{ name: 'NinjaDis' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  colorScheme: 'dark',
};

export const preferredRegion = 'auto';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
      </head>
      <body className="min-h-screen flex flex-col bg-black text-white">
        <header className="border-b border-white/10 bg-black/30 backdrop-blur-md sticky top-0 z-10">
          <nav className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-6">
            <Link href="/" className="font-bold tracking-tight text-lg hover:opacity-80 transition">
              <span className="text-white">Ninja</span>
              <span className="text-cyan-400">Core</span>
            </Link>
            <Link
              href="/clients"
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Clients
            </Link>
            <span className="ml-auto text-xs text-white/40">
              Next.js 15 · Edge · Streaming
            </span>
          </nav>
        </header>
        <main className="flex-1 bg-gradient-to-br from-black via-black to-black/50">
          <Providers>{children}</Providers>
        </main>
        <footer className="text-xs text-white/30 text-center py-4 border-t border-white/5">
          <div>ninjacore-web · OpenNext on Cloudflare Workers</div>
          <div className="text-white/20 mt-1">
            Streaming SSR · Partial Prerendering · Edge Runtime
          </div>
        </footer>
      </body>
    </html>
  );
}
