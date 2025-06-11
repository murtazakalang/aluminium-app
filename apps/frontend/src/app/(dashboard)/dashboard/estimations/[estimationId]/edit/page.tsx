'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { estimationApi, EstimationUpdateData } from '@/lib/api/estimationService';
import { clientApi } from '@/lib/api';
import EstimationItemInputGrid from '@/components/estimations/EstimationItemInputGrid';
import { useUnits } from '@/contexts/UnitContext';
import { FiSettings, FiInfo } from 'react-icons/fi';

interface Client {
  _id: string;
  clientName: string;
}

interface PageProps {
  params: { estimationId: string };
}

export default function EditEstimationPage({ params }: PageProps) {
  const router = useRouter();
  const estimationId = params.estimationId;
  const { dimensionUnit } = useUnits();
  
  const [formData, setFormData] = useState<EstimationUpdateData>({
    projectName: '',
    clientId: '',
    dimensionUnitUsed: 'inches',
    items: []
  });

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch estimation
        const estimation = await estimationApi.getEstimation(estimationId);
        
        let clientId = '';
        if (estimation.clientId && typeof estimation.clientId === 'object' && estimation.clientId._id) {
          clientId = estimation.clientId._id;
        } else if (typeof estimation.clientId === 'string') {
            clientId = estimation.clientId;
        }
        
        // Process items to extract product type IDs from populated objects
        const processedItems = estimation.items.map(item => ({
          ...item,
          // Extract the actual ID from populated productTypeId
          productTypeId: typeof item.productTypeId === 'string' 
            ? item.productTypeId 
            : (item.productTypeId as any)._id || item.productTypeId,
          // Convert Decimal128 values to numbers for the form
          width: typeof item.width === 'object' && (item.width as any).$numberDecimal 
            ? parseFloat((item.width as any).$numberDecimal) 
            : parseFloat(item.width.toString()),
          height: typeof item.height === 'object' && (item.height as any).$numberDecimal 
            ? parseFloat((item.height as any).$numberDecimal) 
            : parseFloat(item.height.toString()),
          // Ensure label field is properly handled
          itemLabel: item.itemLabel || ''
        }));
        
        setFormData({
          projectName: estimation.projectName,
          clientId: clientId,
          dimensionUnitUsed: estimation.dimensionUnitUsed,
          items: processedItems
        });
        
        // Fetch clients
        const clientsResponse = await clientApi.listClients();
        setClients(clientsResponse.data || []);
        
      } catch (err) {
        setError('Failed to load estimation data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [estimationId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleItemsChange = (items: any[]) => {
    setFormData(prev => ({
      ...prev,
      items
    }));
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    setError(null);

    try {
      const calculatedEstimation = await estimationApi.calculateMaterials(estimationId);
      // Show success message (could add toast notification here)
      alert('Materials recalculated successfully! The calculation page will show updated results.');
    } catch (err: any) {
      setError(err.message || 'Failed to recalculate materials');
    } finally {
      setRecalculating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.projectName.trim()) {
      setError('Project name is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await estimationApi.updateEstimation(estimationId, formData);
      
      // Check if materials were auto-recalculated
      if (response.message?.includes('recalculated')) {
        // Could add a toast notification here in the future
      } else if (response.warning) {
        // Could show a warning toast here in the future
      }
      
      router.push(`/dashboard/estimations/${estimationId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to update estimation');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-gray-500">Loading estimation...</div>
      </div>
    );
  }

  if (error && !formData.projectName) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 p-4 rounded-md text-red-800">
          <h3 className="text-lg font-medium">Error</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Estimation</h1>
        <p className="text-gray-600 mt-1">
          Update estimation details and items
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-md text-red-800 mb-6">
          <h3 className="text-lg font-medium">Error</h3>
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Project Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="projectName" className="block text-sm font-medium text-gray-700">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="projectName"
                name="projectName"
                value={formData.projectName}
                onChange={handleInputChange}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                required
              />
            </div>

            <div>
              <label htmlFor="clientId" className="block text-sm font-medium text-gray-700">
                Client
              </label>
              <select
                id="clientId"
                name="clientId"
                value={formData.clientId || ''}
                onChange={handleInputChange}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="">No Client</option>
                {clients.map((client) => (
                  <option key={client._id} value={client._id}>
                    {client.clientName}
                  </option>
                ))}
              </select>
            </div>
            </div>

          {/* Dimension Unit Display (Read-only for existing estimations) */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
                Dimension Unit
              <span className="ml-1 text-gray-500 text-xs">(Locked for existing estimation)</span>
              </label>
            <div className="flex items-center space-x-3">
              <div className="flex-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700">
                {formData.dimensionUnitUsed}
              </div>
              <div className="text-xs text-gray-500">
                <FiInfo size={16} className="inline mr-1" />
                Locked
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              The dimension unit cannot be changed for existing estimations to maintain data consistency.
              Current global setting: {dimensionUnit}
            </p>
          </div>

          {/* Unit Settings Info Panel */}
          {formData.dimensionUnitUsed !== dimensionUnit && (
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <FiInfo className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Unit Settings Notice
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      This estimation uses <strong>{formData.dimensionUnitUsed}</strong> while your current 
                      General Settings use <strong>{dimensionUnit}</strong>. New estimations will use 
                      the current setting.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>

          <div className="mt-6">
            <EstimationItemInputGrid
              items={formData.items}
              onChange={handleItemsChange}
              dimensionUnit={formData.dimensionUnitUsed}
            />
          </div>

        <div className="mt-6">
          {/* Recalculate Materials Section */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-yellow-800">
                  Material Recalculation
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    After adding items, updating inventory, or modifying product formulas, 
                    click "Recalculate Materials" to refresh material calculations with the latest data.
                  </p>
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handleRecalculate}
                    disabled={recalculating || submitting}
                    className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 ${recalculating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <svg className={`-ml-0.5 mr-2 h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {recalculating ? 'Recalculating...' : 'Recalculate Materials'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={submitting || recalculating}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || recalculating || formData.items.length === 0}
              className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {submitting ? 'Updating...' : 'Update Estimation'}
            </button>
          </div>
        </div>
        </form>
    </div>
  );
} 