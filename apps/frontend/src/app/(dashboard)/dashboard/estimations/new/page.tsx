'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { estimationApi, EstimationCreateData } from '@/lib/api/estimationService';
import { clientApi } from '@/lib/api';
import { Client } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import EstimationItemInputGrid from '@/components/estimations/EstimationItemInputGrid';
import { useUnits } from '@/contexts/UnitContext';
import { FiSettings } from 'react-icons/fi';

export default function NewEstimationPage() {
  const router = useRouter();
  const { getDefaultDimensionUnit, dimensionUnit, isUnitLoading } = useUnits();
  
  const [formData, setFormData] = useState<EstimationCreateData>({
    projectName: '',
    clientId: '',
    dimensionUnitUsed: getDefaultDimensionUnit(), // Auto-set from settings
    items: []
  });
  
  const [clients, setClients] = useState<Client[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update dimensionUnitUsed when global settings change
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      dimensionUnitUsed: getDefaultDimensionUnit()
    }));
  }, [dimensionUnit]);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await clientApi.listClients();
        setClients(response.data || []);
      } catch (err) {
      }
    };

    fetchClients();
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.projectName.trim()) {
      setError('Project name is required');
      return;
    }

    if (formData.items.length === 0) {
      setError('At least one item is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await estimationApi.createEstimation(formData);
      router.push(`/dashboard/estimations/${result._id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create estimation');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New Estimation</h1>
        <p className="text-gray-600 mt-1">
          Create a new estimation project with automatic unit configuration
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
                placeholder="Enter project name"
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

          {/* Dimension Unit Display (Auto-configured) */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
                Dimension Unit
              <span className="ml-1 text-gray-500 text-xs">(Auto-configured)</span>
              </label>
            <div className="flex items-center space-x-3">
              <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-700">
                {isUnitLoading ? 'Loading...' : `${dimensionUnit} (from General Settings)`}
              </div>
              <div className="text-xs text-gray-500">
                <FiSettings size={16} className="inline mr-1" />
                Auto
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Dimension unit is automatically set based on your General Settings. All width and height inputs will use this unit.
            </p>
          </div>

          {/* Unit Settings Info Panel */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <FiSettings className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Automatic Unit Configuration
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    This estimation will use <strong>{dimensionUnit}</strong> for all dimension inputs, 
                    automatically configured from your General Settings.
                  </p>
                  <p className="mt-1 text-xs">
                    Change this in Settings → General → Unit Settings to affect all new estimations.
                  </p>
                </div>
              </div>
            </div>
            </div>
          </div>

          <div className="mt-6">
            <EstimationItemInputGrid
              items={formData.items}
              onChange={handleItemsChange}
              dimensionUnit={formData.dimensionUnitUsed}
            />
          </div>

        <div className="mt-6 flex justify-end space-x-4">
          <Button
              type="button"
            variant="outline"
              onClick={() => router.back()}
            disabled={isSubmitting}
            >
              Cancel
          </Button>
          <Button
              type="submit"
            disabled={isSubmitting || formData.items.length === 0}
            >
            {isSubmitting ? 'Creating...' : 'Create Estimation'}
          </Button>
          </div>
        </form>
    </div>
  );
} 