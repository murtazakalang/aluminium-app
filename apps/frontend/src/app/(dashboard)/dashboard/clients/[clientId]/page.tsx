'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { clientApi } from '@/lib/api';
import { Client, ClientHistory, ClientNote } from '@/lib/types';
import ClientInfoCard from '@/components/clients/ClientInfoCard';
import ClientHistoryFeed from '@/components/clients/ClientHistoryFeed';
import NotesSection from '@/components/clients/NotesSection';

export default function ClientDetailPage() {
  const { clientId } = useParams() as { clientId: string };
  const [client, setClient] = useState<Client | null>(null);
  const [history, setHistory] = useState<ClientHistory[]>([]);
  const [activeTab, setActiveTab] = useState('info');
  const [isLoading, setIsLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  
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
  
  const fetchHistory = async () => {
    if (activeTab === 'history') {
      setIsHistoryLoading(true);
      try {
        const response = await clientApi.getHistory(clientId);
        if (response && response.data) { 
          setHistory(response.data);
        } else {
          setHistory([]); 
        }
      } catch (error) {
        setHistory([]);
      } finally {
        setIsHistoryLoading(false);
      }
    }
  };
  
  useEffect(() => {
    fetchClient();
  }, [clientId]);
  
  useEffect(() => {
    fetchHistory();
  }, [clientId, activeTab]);
  
  const handleAddNote = async (note: { text: string; reminderDate?: string }) => {
    try {
      await clientApi.addNote(clientId, note);
      // Refresh client data to get the updated notes
      fetchClient();
    } catch (error) {
      throw error; // Rethrow to handle in the component
    }
  };
  
  const tabs = [
    { id: 'info', label: 'Information' },
    { id: 'history', label: 'History' },
    { id: 'notes', label: 'Notes' },
  ];
  
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
        <p className="mt-2 text-gray-500">The client you're looking for doesn't exist or you don't have permission to view it.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">{client.clientName}</h1>
      
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      
      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'info' && (
          <ClientInfoCard client={client} />
        )}
        
        {activeTab === 'history' && (
          <ClientHistoryFeed 
            history={history} 
            isLoading={isHistoryLoading} 
          />
        )}
        
        {activeTab === 'notes' && (
          <NotesSection 
            notes={client.notes} 
            onAddNote={handleAddNote}
          />
        )}
      </div>
    </div>
  );
} 