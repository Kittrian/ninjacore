import type { LayoutServerLoad } from './$types';

// Enable streaming SSR with Suspense
export const ssr = true;
export const csr = true;

export const load = (async ({ url }) => {
  return {
    url: url.pathname,
  };
}) satisfies LayoutServerLoad;
