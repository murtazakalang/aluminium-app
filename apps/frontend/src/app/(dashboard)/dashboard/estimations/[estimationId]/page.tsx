'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { estimationApi, Estimation, EstimationItem } from '@/lib/api/estimationService';
import { toast } from 'sonner';

interface PageProps {
  params: {
    estimationId: string;
  };
}

export default function EstimationDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { estimationId } = params;
  
  const [estimation, setEstimation] = useState<Estimation | null>(null);
  const [clientName, setClientName] = useState<string>('No Client Associated');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [convertingToQuote, setConvertingToQuote] = useState(false);

  useEffect(() => {
    if (!estimationId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await estimationApi.getEstimation(estimationId);
        setEstimation(data);
        
        if (data.clientNameSnapshot) {
          setClientName(data.clientNameSnapshot);
        } else if (data.clientId && typeof data.clientId === 'object' && data.clientId.clientName) {
          setClientName(data.clientId.clientName);
        } else {
          setClientName('No Client Associated');
        }
      } catch (err) {
        let errorMessage = 'Failed to load estimation details.';
        if (err instanceof Error) {
            errorMessage += ' ' + err.message;
        }
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [estimationId]);

  const handleGeneratePDF = async () => {
    try {
      const { generateAndDownloadPDF } = await import('@/lib/utils/pdfUtils');
      
      await generateAndDownloadPDF(
        () => estimationApi.generatePDF(estimationId),
        `estimation-${estimation?.projectName?.replace(/\s+/g, '-') || 'estimation'}.pdf`
      );
    } catch (err) {
      let errorMessage = 'Failed to generate PDF.';
      if (err instanceof Error) {
        errorMessage += ' ' + err.message;
      }
      setError(errorMessage);
    }
  };

  const handleConvertToQuotation = async () => {
    if (!estimationId) return;
    setConvertingToQuote(true);
    setError(null);
    try {
      const response = await estimationApi.convertToQuotation(estimationId);
      toast.success('Estimation Converted', {
        description: `Successfully converted to Quotation ID: ${response.quotationId}`,
        action: {
          label: 'View Quotation',
          onClick: () => router.push(`/dashboard/quotations/${response.quotationId}/edit`),
        },
      });
      const data = await estimationApi.getEstimation(estimationId);
      setEstimation(data);
      setTimeout(() => {
        router.push(`/dashboard/quotations/${response.quotationId}/edit`);
      }, 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to convert to quotation.';
      setError(errorMessage);
      toast.error('Conversion Failed', { description: errorMessage });
    } finally {
      setConvertingToQuote(false);
    }
  };

  const getStatusBadgeClass = (status: string | undefined) => {
    switch (status) {
      case 'Draft': return 'bg-yellow-100 text-yellow-800';
      case 'Calculated': return 'bg-blue-100 text-blue-800';
      case 'Converted': return 'bg-green-100 text-green-800';
      case 'Archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDecimal = (value: any, precision: number = 2): string => {
    if (value === null || value === undefined) return 'N/A';
    let numValue = NaN;
    if (typeof value === 'object' && value !== null && value.$numberDecimal !== undefined) {
      numValue = parseFloat(value.$numberDecimal);
    } else {
      numValue = parseFloat(value.toString());
    }
    if (isNaN(numValue)) return 'N/A';
    return numValue.toFixed(precision);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-10">
          <p className="text-gray-500">Loading estimation details...</p>
        </div>
      </div>
    );
  }

  if (!estimation) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error || 'Estimation not found'}
        </div>
        <button
          onClick={() => router.push('/dashboard/estimations')}
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
        >
          Back to Estimations
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{estimation.projectName}</h1>
          <div className="mt-2">
            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(estimation.status)}`}>
              {estimation.status}
            </span>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => router.push(`/dashboard/estimations/${estimationId}/edit`)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/estimations/${estimationId}/calculate`)}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
          >
            Material Calculation
          </button>
          {estimation.status !== 'Draft' && (
            <button
              type="button"
              onClick={() => router.push(`/dashboard/estimations/${estimationId}/summary`)}
              className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded"
            >
              View Summary
            </button>
          )}
          {estimation.status !== 'Draft' && (
            <button
              type="button"
              onClick={handleGeneratePDF}
              className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded"
            >
              Download PDF
            </button>
          )}
          {estimation.status === 'Calculated' && (
            <button
              type="button"
              onClick={handleConvertToQuotation}
              className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded"
              disabled={convertingToQuote}
            >
              {convertingToQuote ? 'Converting...' : 'Convert to Quotation'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Estimation Details</h3>
          <p className="mt-1 text-sm text-gray-500">Basic information about the estimation.</p>
        </div>
        <div className="border-t border-gray-200">
          <dl>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Project Name</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{estimation.projectName}</dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Client</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{clientName}</dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Dimension Unit</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{estimation.dimensionUnitUsed}</dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Created At</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {new Date(estimation.createdAt).toLocaleDateString()} {new Date(estimation.createdAt).toLocaleTimeString()}
              </dd>
            </div>
            {estimation.status !== 'Draft' && (
              <>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Total Materials Cost</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {formatDecimal(estimation.subtotalMaterials)}
                  </dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Manual Charges</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {formatDecimal(estimation.subtotalManualCharges)}
                  </dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Markup</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {formatDecimal(estimation.markupPercentage)}%
                  </dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 font-medium">
                  <dt className="text-sm font-medium text-gray-500">Final Total</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {formatDecimal(estimation.markedUpTotal)}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Estimation Items</h3>
          <p className="mt-1 text-sm text-gray-500">List of items included in this estimation.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Label
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Width
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Height
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {estimation.items.map((item: EstimationItem, index: number) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.itemLabel || `Item ${index + 1}`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDecimal(item.width)} {estimation.dimensionUnitUsed}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDecimal(item.height)} {estimation.dimensionUnitUsed}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.quantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 