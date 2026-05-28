import { Suspense } from 'react';
import { ClientsView } from './clients-view';
import { ClientListSkeleton } from './skeletons';

export function ClientsStream() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold mb-4">Clients</h1>
        <ClientListSkeleton />
      </div>
    }>
      <ClientsView />
    </Suspense>
  );
}
