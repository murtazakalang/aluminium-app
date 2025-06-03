'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clientApi } from '@/lib/api';
import { Client } from '@/lib/types';
import ClientTable from '@/components/clients/ClientTable';
import { Button } from '@/components/ui/Button';

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const fetchClients = async () => {
    setIsLoading(true);
    try {
      const params: any = { page, limit };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      
      const response = await clientApi.listClients(params);
      setClients(response.data);
      setTotal(response.total);
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchClients();
  }, [page, search, statusFilter]);
  
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };
  
  const handleSearch = (searchTerm: string) => {
    setSearch(searchTerm);
    setPage(1); // Reset to first page when searching
  };
  
  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setPage(1); // Reset to first page when filtering
  };
  
  const handleStatusUpdate = async (clientId: string, newStatus: string) => {
    try {
      await clientApi.updateStatus(clientId, newStatus);
      // Update the client in the local state
      setClients(clients.map(client => 
        client._id === clientId 
          ? { ...client, followUpStatus: newStatus as 'New Lead' | 'In Discussion' | 'Quoted' | 'Negotiation' | 'Converted' | 'Dropped' } 
          : client
      ));
    } catch (error) {
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    try {
      await clientApi.deleteClient(clientId);
      // Remove the client from the local state
      setClients(clients.filter(client => client._id !== clientId));
      // Update total count
      setTotal(prev => prev - 1);
    } catch (error) {
      throw error;
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Clients</h1>
        <Button 
          onClick={() => router.push('/dashboard/clients/new')}
        >
          Add Client
        </Button>
      </div>
      
      <ClientTable 
        clients={clients}
        total={total}
        page={page}
        limit={limit}
        onPageChange={handlePageChange}
        onSearch={handleSearch}
        onStatusFilter={handleStatusFilter}
        onStatusUpdate={handleStatusUpdate}
        onDeleteClient={handleDeleteClient}
        isLoading={isLoading}
      />
    </div>
  );
} 