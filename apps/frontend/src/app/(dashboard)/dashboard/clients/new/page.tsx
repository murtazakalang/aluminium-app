'use client';

import React, { useState } from 'react';
import { ClientFormData } from '@/lib/types';
import { clientApi } from '@/lib/api';
import ClientForm from '@/components/clients/ClientForm';

export default function NewClientPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async (data: ClientFormData) => {
    setIsSubmitting(true);
    try {
      await clientApi.createClient(data);
    } catch (error) {
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">New Client</h1>
      <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
        <ClientForm 
          onSubmit={handleSubmit} 
          isLoading={isSubmitting} 
        />
      </div>
    </div>
  );
} 