import { ClientsStream } from '@/components/clients-server';

export const metadata = {
  title: 'Clients · NinjaCore',
  description: 'Browse and manage credit dispute clients',
};

export const dynamic = 'force-dynamic';
export const preferredRegion = 'auto';

export default function ClientsPage() {
  return <ClientsStream />;
}
