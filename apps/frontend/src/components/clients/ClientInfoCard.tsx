import React from 'react';
import { Client } from '@/lib/types';
import StatusBadge from './StatusBadge';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';

interface ClientInfoCardProps {
  client: Client;
}

export const ClientInfoCard: React.FC<ClientInfoCardProps> = ({ client }) => {
  const router = useRouter();
  
  const infoItems = [
    { label: 'Contact Person', value: client.contactPerson },
    { label: 'Contact Number', value: client.contactNumber },
    { label: 'Email', value: client.email },
    { label: 'Billing Address', value: client.billingAddress?.street || '' },
    { label: 'Site Address', value: client.siteAddress?.street || '' },
    { label: 'GSTIN', value: client.gstin },
    { label: 'Lead Source', value: client.leadSource },
    { label: 'Status', value: <StatusBadge status={client.followUpStatus} /> },
    { label: 'Active', value: client.isActive ? 'Yes' : 'No' },
  ];

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="flex justify-between items-center px-4 py-5 sm:px-6 border-b border-gray-200">
        <div>
          <h3 className="text-lg leading-6 font-medium text-gray-900">Client Information</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Details about {client.clientName}</p>
        </div>
        <Button 
          variant="outline"
          onClick={() => router.push(`/dashboard/clients/${client._id}/edit`)}
        >
          Edit
        </Button>
      </div>
      <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
        <dl className="sm:divide-y sm:divide-gray-200">
          {infoItems.map(item => (
            item.value ? (
              <div key={item.label} className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">{item.label}</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {typeof item.value === 'string' ? item.value : item.value}
                </dd>
              </div>
            ) : null
          ))}
          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Created On</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
              {new Date(client.createdAt).toLocaleDateString()}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
};

export default ClientInfoCard; 