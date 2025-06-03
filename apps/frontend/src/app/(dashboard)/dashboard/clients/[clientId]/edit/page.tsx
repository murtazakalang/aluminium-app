'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Client, ClientFormData } from '@/lib/types';
import { clientApi } from '@/lib/api';
import ClientForm from '@/components/clients/ClientForm';

export default function EditClientPage() {
  const { clientId } = useParams() as { clientId: string };
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useEffect(() => {
    const fetchClient = async () => {
      setIsLoading(true);
      try {
        const response = await clientApi.getClient(clientId);
        setClient(response.data);
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };

    fetchClient();
  }, [clientId]);
  
  const handleSubmit = async (data: ClientFormData) => {
    setIsSubmitting(true);
    try {
      await clientApi.updateClient(clientId, data);
    } catch (error) {
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen -mt-16">
        <div className="animate-pulse text-gray-500">Loading client details...</div>
      </div>
    );
  }
  
  if (!client) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Client Not Found</h2>
        <p className="mt-2 text-gray-500">The client you're looking for doesn't exist or you don't have permission to edit it.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Edit Client: {client.clientName}</h1>
      <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
        <ClientForm
          initialValues={client}
          onSubmit={handleSubmit}
          isLoading={isSubmitting}
          isEditMode={true}
        />
      </div>
    </div>
  );
} 