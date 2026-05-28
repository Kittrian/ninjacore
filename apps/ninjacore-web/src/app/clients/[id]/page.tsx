import { Suspense } from 'react';
import { ClientDetailView } from '@/components/client-detail-view';
import { DetailViewSkeleton } from '@/components/skeletons';

export const dynamic = 'force-dynamic';
export const preferredRegion = 'auto';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return {
    title: `Client · NinjaCore`,
    description: 'View client details, bureau scores, and credit information',
  };
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-xs text-white/50 mb-4">← Back to clients</div>
        <DetailViewSkeleton />
      </div>
    }>
      <ClientDetailView id={id} />
    </Suspense>
  );
}
