import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Order } from '@/lib/api/orderService';
import { OrderStatusBadge } from './OrderStatusBadge';
import { OrderStatusUpdater } from './OrderStatusUpdater';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Table from '@/components/ui/Table';

interface OrderTableProps {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onSearch: (search: string) => void;
  onStatusFilter: (status: string) => void;
  onStatusUpdate: (orderId: string, newStatus: string, notes?: string) => void;
  isLoading?: boolean;
}

export const OrderTable: React.FC<OrderTableProps> = ({
  orders,
  total,
  page,
  limit,
  onPageChange,
  onSearch,
  onStatusFilter,
  onStatusUpdate,
  isLoading = false,
}) => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const totalPages = Math.ceil(total / limit);

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Measurement Confirmed', label: 'Measurement Confirmed' },
    { value: 'Ready for Optimization', label: 'Ready for Optimization' },
    { value: 'Optimization Complete', label: 'Optimization Complete' },
    { value: 'In Production', label: 'In Production' },
    { value: 'Cutting', label: 'Cutting' },
    { value: 'Assembly', label: 'Assembly' },
    { value: 'QC', label: 'QC' },
    { value: 'Packed', label: 'Packed' },
    { value: 'Delivered', label: 'Delivered' },
    { value: 'Completed', label: 'Completed' },
    { value: 'Cancelled', label: 'Cancelled' },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchTerm);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Transform orders data to format required by Table component
  const tableData = orders.map(order => ({
    id: order._id,
    orderIdDisplay: (
      <Link 
        href={`/dashboard/orders/${order._id}`} 
        className="text-blue-600 hover:text-blue-800 font-medium"
      >
        {order.orderIdDisplay}
      </Link>
    ),
    clientName: order.clientSnapshot.clientName,
    quotationId: order.quotationIdDisplaySnapshot || '—',
    status: <OrderStatusBadge status={order.status} />,
    finalGrandTotal: formatCurrency(order.finalGrandTotal),
    createdAt: formatDate(order.createdAt),
    actions: (
      <div className="flex space-x-2">
        <OrderStatusUpdater
          orderId={order._id}
          currentStatus={order.status}
          onStatusUpdate={(newStatus, notes) => onStatusUpdate(order._id, newStatus, notes)}
        />
        <Button
          onClick={() => router.push(`/dashboard/orders/${order._id}`)}
          variant="outline"
          size="sm"
        >
          View
        </Button>
      </div>
    )
  }));

  // Define the columns
  const columns = [
    { header: 'Order ID', accessor: 'orderIdDisplay' as const },
    { header: 'Client', accessor: 'clientName' as const },
    { header: 'Quotation', accessor: 'quotationId' as const },
    { header: 'Status', accessor: 'status' as const },
    { header: 'Total Amount', accessor: 'finalGrandTotal' as const },
    { header: 'Created', accessor: 'createdAt' as const },
    { header: 'Actions', accessor: 'actions' as const },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <form onSubmit={handleSearch} className="flex w-full md:w-1/3">
          <Input
            type="text"
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-r-none"
          />
          <Button type="submit" variant="default" className="rounded-l-none">
            Search
          </Button>
        </form>

        <div>
          <select
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            onChange={(e) => onStatusFilter(e.target.value)}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Table
        columns={columns}
        data={tableData}
        keyExtractor={(item) => item.id}
        emptyStateMessage="No orders found"
        isLoading={isLoading}
      />

      {totalPages > 1 && (
        <div className="flex justify-center mt-4">
          <nav className="flex items-center">
            <Button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              variant="outline"
              size="sm"
              className="mr-2"
            >
              Previous
            </Button>
            <span className="mx-4">
              Page {page} of {totalPages}
            </span>
            <Button
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              variant="outline"
              size="sm"
              className="ml-2"
            >
              Next
            </Button>
          </nav>
        </div>
      )}
    </div>
  );
}; 