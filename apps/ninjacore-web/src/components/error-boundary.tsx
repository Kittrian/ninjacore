'use client';

import { useEffect } from 'react';

export function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Error caught by boundary:', error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 text-center">
      <div className="text-red-400 text-sm font-semibold uppercase mb-2">Error</div>
      <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
      <p className="text-white/60 mb-6">{error.message || 'Please try again'}</p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition"
      >
        Try again
      </button>
    </div>
  );
}
