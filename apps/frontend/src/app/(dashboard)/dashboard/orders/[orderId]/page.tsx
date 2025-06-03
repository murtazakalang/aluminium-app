'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { orderApi, type Order } from '@/lib/api/orderService';
import { useAuthStore } from '@/lib/store/auth-store';
import { OrderDetailView } from '@/components/orders/OrderDetailView';
import { OrderItemsView } from '@/components/orders/OrderItemsView';
import { RequiredCutsView } from '@/components/orders/RequiredCutsView';
import { OrderHistoryView } from '@/components/orders/OrderHistoryView';
import { ManufacturingView } from '@/components/manufacturing/ManufacturingView';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

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

  const handleStatusUpdate = async (newStatus: string, notes?: string) => {
    try {
      await orderApi.updateStatus(orderId, newStatus, notes);
      // Refresh the order data
      fetchOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order status');
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'items', label: 'Items' },
    { id: 'materials', label: 'Materials/Cuts' },
    { id: 'manufacturing', label: 'Manufacturing' },
    { id: 'history', label: 'History' },
  ];

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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Order {order.orderIdDisplay}
          </h1>
          <p className="text-gray-600 mt-1">
            Client: {order.clientSnapshot.clientName}
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={() => router.push('/dashboard/orders')}
            variant="outline"
          >
            Back to Orders
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <OrderDetailView
            order={order}
            onStatusUpdate={handleStatusUpdate}
            onRefresh={fetchOrder}
          />
        )}

        {activeTab === 'items' && (
          <OrderItemsView
            order={order}
            onRefresh={fetchOrder}
          />
        )}

        {activeTab === 'materials' && (
          <RequiredCutsView
            orderId={orderId}
            orderStatus={order.status}
          />
        )}

        {activeTab === 'manufacturing' && (
          <ManufacturingView
            orderId={orderId}
            order={order}
            onRefresh={fetchOrder}
          />
        )}

        {activeTab === 'history' && (
          <OrderHistoryView
            orderId={orderId}
          />
        )}
      </div>
    </div>
  );
} 