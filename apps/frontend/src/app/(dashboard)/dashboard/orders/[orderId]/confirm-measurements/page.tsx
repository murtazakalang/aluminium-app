'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { orderApi, type Order, type MeasurementConfirmationData } from '@/lib/api/orderService';
import { useAuthStore } from '@/lib/store/auth-store';
import { MeasurementForm } from '@/components/orders/MeasurementForm';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function ConfirmMeasurementsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await orderApi.getOrder(orderId);
      setOrder(response.data.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch order');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  const handleSubmit = async (data: MeasurementConfirmationData) => {
    try {
      setIsSubmitting(true);
      setError(null);
      await orderApi.confirmMeasurements(orderId, data);
      // Redirect back to order detail page
      router.push(`/dashboard/orders/${orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm measurements');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check permissions
  const canConfirmMeasurements = 
    (user?.role === 'Admin' || user?.role === 'Manager') &&
    order &&
    ['Pending', 'Measurement Confirmed'].includes(order.status);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading order details...</div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6 bg-red-50 border-red-200">
          <p className="text-red-600">{error || 'Order not found'}</p>
          <Button
            onClick={() => router.push('/dashboard/orders')}
            variant="outline"
            className="mt-4"
          >
            Back to Orders
          </Button>
        </Card>
      </div>
    );
  }

  if (!canConfirmMeasurements) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6 bg-yellow-50 border-yellow-200">
          <p className="text-yellow-800">
            {user?.role !== 'Admin' && user?.role !== 'Manager'
              ? 'You do not have permission to confirm measurements.'
              : `Measurements can only be confirmed for orders with status "Pending" or "Measurement Confirmed". Current status: ${order.status}`
            }
          </p>
          <Button
            onClick={() => router.push(`/dashboard/orders/${orderId}`)}
            variant="outline"
            className="mt-4"
          >
            Back to Order
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Confirm Measurements
          </h1>
          <p className="text-gray-600 mt-1">
            Order {order.orderIdDisplay} - {order.clientSnapshot.clientName}
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={() => router.push(`/dashboard/orders/${orderId}`)}
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      </div>

      {error && (
        <Card className="mb-6 p-4 bg-red-50 border-red-200">
          <p className="text-red-600">{error}</p>
        </Card>
      )}

      <Card className="p-6">
        <MeasurementForm
          order={order}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </Card>
    </div>
  );
} 