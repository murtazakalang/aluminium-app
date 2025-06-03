'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CuttingPlanVisualizer } from './CuttingPlanVisualizer';
import { PipeOrderSummaryTable } from './PipeOrderSummaryTable';
import { manufacturingApi, CuttingPlan } from '@/lib/api/manufacturingService';
import { Order } from '@/lib/api/orderService';
import { toast } from 'sonner';

interface ManufacturingViewProps {
  orderId: string;
  order: Order;
  onRefresh: () => void;
}

export function ManufacturingView({ orderId, order, onRefresh }: ManufacturingViewProps) {
  const [cuttingPlan, setCuttingPlan] = useState<CuttingPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimizationLoading, setOptimizationLoading] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastFetchedOrderId, setLastFetchedOrderId] = useState<string | null>(null);

  const fetchCuttingPlan = async () => {
    if (!orderId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await manufacturingApi.getCuttingPlan(orderId);
      if (response.data.cuttingPlan) {
        setCuttingPlan(response.data.cuttingPlan);
      } else {
        setCuttingPlan(null);
      }
    } catch (err: any) {
      if (err.message?.includes('404')) {
        setCuttingPlan(null);
      } else {
        setError(err.message || 'Failed to fetch cutting plan');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch if orderId changed or we haven't fetched for this orderId yet
    if (orderId && orderId !== lastFetchedOrderId) {
      fetchCuttingPlan();
    }
  }, [orderId]); // Remove lastFetchedOrderId from dependencies to avoid infinite loops

  const handleOptimizeCuts = async () => {
    if (!orderId) return;
    
    setOptimizationLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      await manufacturingApi.optimizeCuts(orderId);
      setSuccessMessage('Cuts optimized successfully!');
      // Force refetch by resetting the tracking state
      setLastFetchedOrderId(null);
      await fetchCuttingPlan();
      onRefresh(); // Refresh the parent order data
    } catch (err: any) {
      const message = err.message || 'Failed to optimize cuts';
      setError(message);
    } finally {
      setOptimizationLoading(false);
    }
  };

  const handleCommitCuts = async () => {
    if (!orderId) return;
    
    setCommitLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      await manufacturingApi.commitCuts(orderId);
      setSuccessMessage('Cuts committed to inventory successfully!');
      onRefresh(); // Refresh the parent order data
    } catch (err: any) {
      const message = err.message || 'Failed to commit cuts to inventory';
      setError(message);
    } finally {
      setCommitLoading(false);
    }
  };

  const isPlanGenerationAllowed = ['Ready for Optimization', 'Optimization Complete'].includes(order.status);
  const isCommitAllowed = cuttingPlan && order.cuttingPlanStatus !== 'Committed';

  // Add safety check
  const hasCuttingPlan = cuttingPlan && typeof cuttingPlan === 'object' && cuttingPlan._id;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Manufacturing Management</h2>
          
          <div className="flex space-x-2">
            {isPlanGenerationAllowed && (
              <Button
                onClick={handleOptimizeCuts}
                disabled={optimizationLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {optimizationLoading ? 'Optimizing...' : 'Optimize Cuts'}
              </Button>
            )}

            {isCommitAllowed && (
              <Button
                onClick={handleCommitCuts}
                disabled={commitLoading}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {commitLoading ? 'Committing...' : 'Commit Cuts to Inventory'}
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-4 mb-4 rounded">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-600 p-4 mb-4 rounded">
            {successMessage}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Current Status</h3>
            <div className="flex space-x-4">
              <div className="bg-gray-100 p-2 rounded">
                <span className="font-medium">Order Status:</span> {order.status}
              </div>
              <div className="bg-gray-100 p-2 rounded">
                <span className="font-medium">Cutting Plan:</span> {order.cuttingPlanStatus}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="text-gray-500">Loading cutting plan data...</div>
        </div>
      ) : hasCuttingPlan ? (
        <>
          <div className="space-y-6">
            <h3 className="text-xl font-bold">Cutting Plan Visualization</h3>
            <CuttingPlanVisualizer orderId={orderId} />
          </div>
          
          <div className="space-y-6">
            <h3 className="text-xl font-bold">Material Requirements</h3>
            <PipeOrderSummaryTable orderId={orderId} />
          </div>
        </>
      ) : (
        <Card className="p-6 bg-gray-50">
          <div className="text-center text-gray-600">
            {order.status === 'Optimization Failed' ? (
              <div>
                <div className="text-red-600 font-medium mb-2">Optimization Failed</div>
                <div className="text-sm mb-4">
                  The cutting optimization process failed. Please check the error details above and ensure sufficient inventory is available.
                </div>
                {isPlanGenerationAllowed && (
                  <div className="text-sm text-gray-500">
                    You can try optimizing again after resolving the inventory issues.
                  </div>
                )}
              </div>
            ) : isPlanGenerationAllowed ? (
              'No cutting plan has been generated yet. Click "Optimize Cuts" to create one.'
            ) : (
              'No cutting plan available. Order must be in "Ready for Optimization" status.'
            )}
          </div>
        </Card>
      )}
    </div>
  );
} 