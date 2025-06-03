'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { manufacturingApi } from '@/lib/api/manufacturingService';
import { Order } from '@/lib/api/orderService';

export default function ManufacturingQueuePage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [optimizingOrderId, setOptimizingOrderId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: 'Ready for Optimization',
    search: '',
    page: 1,
    limit: 10
  });

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await manufacturingApi.getManufacturingQueue(filters);
      setOrders(response.data.orders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch manufacturing queue');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [filters]);

  const handleOptimizeCuts = async (orderId: string) => {
    try {
      setOptimizingOrderId(orderId);
      setError(null);
      setSuccessMessage(null);
      
      await manufacturingApi.optimizeCuts(orderId);
      
      setSuccessMessage(`Cuts optimized successfully for order ${orderId}!`);
      fetchOrders(); // Refresh the queue
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to optimize cuts');
    } finally {
      setOptimizingOrderId(null);
    }
  };

  const handleViewOrder = (orderId: string) => {
    router.push(`/dashboard/orders/${orderId}`);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({
      ...filters,
      status: e.target.value
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({
      ...filters,
      search: e.target.value
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Manufacturing Queue</h1>
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

      <Card className="p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1">
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="status"
              className="block w-full p-2 border border-gray-300 rounded-md"
              value={filters.status}
              onChange={handleFilterChange}
            >
              <option value="Ready for Optimization">Ready for Optimization</option>
              <option value="Optimization Complete">Optimization Complete</option>
              <option value="In Production">In Production</option>
            </select>
          </div>
          
          <div className="flex-1">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="flex-1">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                  Search
                </label>
                <input
                  type="text"
                  id="search"
                  placeholder="Order ID, Client..."
                  className="block w-full p-2 border border-gray-300 rounded-md"
                  value={filters.search}
                  onChange={handleSearchChange}
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                  Search
                </Button>
              </div>
            </form>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading manufacturing queue...</div>
        </div>
      ) : orders.length === 0 ? (
        <Card className="p-6 bg-gray-50 text-center">
          <p className="text-gray-600">No orders found in the manufacturing queue.</p>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cutting Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map((order) => (
                <tr key={order._id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {order.orderIdDisplay}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {order.clientSnapshot.clientName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium 
                      ${order.status === 'Ready for Optimization' ? 'bg-yellow-100 text-yellow-800' : 
                        order.status === 'Optimization Complete' ? 'bg-green-100 text-green-800' : 
                          'bg-blue-100 text-blue-800'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium 
                      ${order.cuttingPlanStatus === 'Pending' ? 'bg-gray-100 text-gray-800' : 
                        order.cuttingPlanStatus === 'Generated' ? 'bg-blue-100 text-blue-800' : 
                          'bg-green-100 text-green-800'}`}>
                      {order.cuttingPlanStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => handleViewOrder(order._id)}
                        variant="outline"
                        className="text-sm"
                      >
                        View
                      </Button>
                      
                      {order.status === 'Ready for Optimization' && (
                        <Button
                          onClick={() => handleOptimizeCuts(order._id)}
                          disabled={optimizingOrderId === order._id}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
                        >
                          {optimizingOrderId === order._id ? 'Optimizing...' : 'Optimize Cuts'}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 