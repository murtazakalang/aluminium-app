'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { orderApi, type Order, type OrderFilters } from '@/lib/api/orderService';
import { useAuthStore } from '@/lib/store/auth-store';
import { OrderTable } from '@/components/orders/OrderTable';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function OrdersPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<OrderFilters>({
    limit: 10,
  });

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await orderApi.listOrders({ ...filters, page });
      setOrders(response.data.orders);
      setTotal(response.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page, filters]);

  const handleSearch = (search: string) => {
    setFilters(prev => ({ ...prev, search }));
    setPage(1);
  };

  const handleStatusFilter = (status: string) => {
    setFilters(prev => ({ ...prev, status: status || undefined }));
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string, notes?: string) => {
    try {
      await orderApi.updateStatus(orderId, newStatus, notes);
      // Refresh the orders list
      fetchOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order status');
    }
  };

  const canCreateOrder = user?.role === 'Admin' || user?.role === 'Manager';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-600 mt-1">Manage your sales orders and track production</p>
        </div>
        {canCreateOrder && (
          <Button
            onClick={() => router.push('/dashboard/quotations')}
            variant="default"
          >
            Create from Quotation
          </Button>
        )}
      </div>

      {error && (
        <Card className="mb-6 p-4 bg-red-50 border-red-200">
          <p className="text-red-600">{error}</p>
        </Card>
      )}

      <Card className="p-6">
        <OrderTable
          orders={orders}
          total={total}
          page={page}
          limit={filters.limit || 10}
          onPageChange={handlePageChange}
          onSearch={handleSearch}
          onStatusFilter={handleStatusFilter}
          onStatusUpdate={handleStatusUpdate}
          isLoading={isLoading}
        />
      </Card>
    </div>
  );
} 