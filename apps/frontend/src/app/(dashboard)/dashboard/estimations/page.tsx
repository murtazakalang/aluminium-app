'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { estimationApi, Estimation } from '@/lib/api/estimationService';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Plus, FileText, Eye } from 'lucide-react';

interface EstimationWithClientDisplay extends Estimation {
  clientDisplayName?: string;
}

export default function EstimationsPage() {
  const router = useRouter();
  const [estimations, setEstimations] = useState<EstimationWithClientDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [recalculatingIds, setRecalculatingIds] = useState<Set<string>>(new Set());

  const fetchEstimations = async () => {
    try {
      setLoading(true);
      const response = await estimationApi.getEstimations(page, 10, statusFilter);
      
      const enhancedEstimations = response.estimations.map((est: Estimation) => {
        let nameToDisplay = 'No Client';
        if (est.clientNameSnapshot) {
          nameToDisplay = est.clientNameSnapshot;
        } else if (est.clientId && typeof est.clientId === 'object' && est.clientId.clientName) {
          nameToDisplay = est.clientId.clientName;
        } else if (typeof est.clientId === 'string' && est.clientId) {
          nameToDisplay = 'Client ID: ' + est.clientId;
        }
        return { ...est, clientDisplayName: nameToDisplay };
      });
      
      setEstimations(enhancedEstimations);
      setTotalPages(response.pagination.totalPages);
    } catch (err) {
      let errorMessage = 'Failed to load estimations';
      if (err instanceof Error) {
        errorMessage += ': ' + err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEstimations();
  }, [page, statusFilter]);

  const handleRecalculate = async (id: string) => {
    setRecalculatingIds(prev => new Set([...prev, id]));
    try {
      await estimationApi.calculateMaterials(id);
      // Refresh the estimations list to show updated status
      fetchEstimations();
      // Show success message (could be replaced with toast notification)
      alert('Materials recalculated successfully!');
    } catch (error) {
      setError('Failed to recalculate materials');
    } finally {
      setRecalculatingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this estimation?')) {
      try {
        await estimationApi.deleteEstimation(id);
        fetchEstimations();
      } catch (error) {
        setError('Failed to delete estimation');
      }
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'Calculated':
        return 'bg-blue-100 text-blue-800';
      case 'Converted':
        return 'bg-green-100 text-green-800';
      case 'Archived':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Material Estimations</h1>
        <Link 
          href="/dashboard/estimations/new"
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
        >
          New Estimation
        </Link>
      </div>

      <div className="mb-4 flex justify-between items-center">
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-1 block w-40 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="">All Status</option>
            <option value="Draft">Draft</option>
            <option value="Calculated">Calculated</option>
            <option value="Converted">Converted</option>
            <option value="Archived">Archived</option>
          </select>
        </div>
        <div className="text-sm text-gray-500">
          Page {page} of {totalPages}
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Material Recalculation Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Material Recalculation
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                Use the "Recalc" button to refresh material calculations when you've updated inventory, 
                added new materials, modified product formulas, or changed standard lengths. 
                This ensures your estimations reflect the latest data and rates.
              </p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <p className="text-gray-500">Loading estimations...</p>
        </div>
      ) : estimations.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-500">No estimations found. Create your first one!</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {estimations.map((estimation) => (
                <tr key={estimation._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{estimation.projectName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {estimation.clientDisplayName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(estimation.status)}`}>
                      {estimation.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {estimation.items.length}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {estimation.status === 'Draft' ? 
                      '—' : 
                      parseFloat(estimation.markedUpTotal).toFixed(2)
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {new Date(estimation.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => router.push(`/dashboard/estimations/${estimation._id}`)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        View
                      </button>
                      <button
                        onClick={() => router.push(`/dashboard/estimations/${estimation._id}/edit`)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleRecalculate(estimation._id)}
                        disabled={recalculatingIds.has(estimation._id)}
                        className={`text-green-600 hover:text-green-900 ${recalculatingIds.has(estimation._id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="Recalculate materials with latest inventory and formulas"
                      >
                        {recalculatingIds.has(estimation._id) ? 'Recalc...' : 'Recalc'}
                      </button>
                      <button
                        onClick={() => handleDelete(estimation._id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
            className={`px-4 py-2 border rounded ${page === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            Previous
          </button>
          <div className="text-sm text-gray-700">
            Page {page} of {totalPages}
          </div>
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page === totalPages}
            className={`px-4 py-2 border rounded ${page === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
} 