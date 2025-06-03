'use client';

import React, { useState, useEffect } from 'react';
import { manufacturingApi, PipeOrderSummary } from '@/lib/api/manufacturingService';
import { Card } from '@/components/ui/Card';

interface PipeOrderSummaryTableProps {
  orderId: string;
}

export function PipeOrderSummaryTable({ orderId }: PipeOrderSummaryTableProps) {
  const [summary, setSummary] = useState<PipeOrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await manufacturingApi.getPipeOrderSummary(orderId);
        setSummary(response.data.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load pipe order summary');
      } finally {
        setIsLoading(false);
      }
    };

    if (orderId) {
      fetchSummary();
    }
  }, [orderId]);

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex justify-center items-center h-32">
          <div className="text-gray-500">Loading pipe order summary...</div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 border-red-200 bg-red-50">
        <div className="text-red-600">
          {error}
        </div>
      </Card>
    );
  }

  if (!summary || summary.length === 0) {
    return (
      <Card className="p-6 bg-gray-50">
        <div className="text-gray-600 text-center">
          No pipe order summary available.
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-xl font-bold mb-4">Pipe Order Summary</h3>
      {summary.map((materialSummary, index) => (
        <div key={index} className="mb-6">
          <h4 className="text-lg font-semibold mb-2">
            {materialSummary.materialNameSnapshot} 
            {materialSummary.gaugeSnapshot && ` (${materialSummary.gaugeSnapshot})`}
          </h4>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pipe Length</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Scrap</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {materialSummary.totalPipesPerLength.map((pipe, pipeIndex) => (
                  <tr key={pipeIndex}>
                    <td className="px-4 py-2 whitespace-nowrap">{pipe.length} {pipe.unit}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{pipe.quantity}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{parseFloat(pipe.totalScrap || '0').toFixed(2)} {pipe.scrapUnit || pipe.unit}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100">
                  <td className="px-4 py-2 font-semibold" colSpan={2}>Total Weight:</td>
                  <td className="px-4 py-2">{parseFloat(materialSummary.totalWeight || '0').toFixed(2)} kg</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ))}
    </Card>
  );
} 