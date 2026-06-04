import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'NinjaCore',
  description: 'Credit dispute operations console',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-white/10 bg-black/30 backdrop-blur sticky top-0 z-10">
          <nav className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-6">
            <Link href="/" className="font-bold tracking-tight text-lg">
              <span className="text-white">Ninja</span>
              <span className="text-cyan-400">Core</span>
            </Link>
            <Link href="/clients" className="text-sm text-white/70 hover:text-white">Clients</Link>
            <span className="ml-auto text-xs text-white/40">Next.js 15 · Edge · Rust API</span>
          </nav>
        </header>
        <main className="flex-1"><Providers>{children}</Providers></main>
        <footer className="text-xs text-white/30 text-center py-4">
          ninjacore-web · OpenNext on Cloudflare Workers
        </footer>
      </body>
    </html>
  );
}
