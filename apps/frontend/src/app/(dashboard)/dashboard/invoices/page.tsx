'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { invoiceApi, Invoice, InvoiceFilters } from '@/lib/api/invoiceService';
import { orderApi } from '@/lib/api/orderService';
import { Plus, Search, Filter, FileText, Download } from 'lucide-react';
import InvoiceTable from '@/components/invoices/InvoiceTable';

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<InvoiceFilters>({
    page: 1,
    limit: 20
  });
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0
  });

  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadInvoices();
    loadAvailableOrders();
  }, [filters]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const response = await invoiceApi.getInvoices(filters);
      setInvoices(response.data.invoices);
      setPagination(response.data.pagination);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableOrders = async () => {
    try {
      // Load orders that can be converted to invoices (status: Delivered, Completed)
      const response = await orderApi.listOrders({ 
        status: 'Delivered,Completed', 
        limit: 100 
      });
      setAvailableOrders(response.data.orders);
    } catch (err) {
    }
  };

  const handleCreateFromOrder = async (orderId: string) => {
    try {
      setLoading(true);
      await invoiceApi.createInvoiceFromOrder(orderId);
      setShowCreateModal(false);
      await loadInvoices();
      await loadAvailableOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (invoiceId: string) => {
    try {
      const blob = await invoiceApi.getInvoicePdf(invoiceId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoices.find(i => i._id === invoiceId)?.invoiceIdDisplay || invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download PDF');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  if (loading && invoices.length === 0) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 mt-1">Manage invoices and track payments</p>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create from Order
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search invoices..."
                className="pl-10"
                value={filters.search || ''}
                onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              className="w-full p-2 border border-gray-300 rounded-md"
              value={filters.status || ''}
              onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined, page: 1 })}
            >
              <option value="">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Paid">Paid</option>
              <option value="Overdue">Overdue</option>
              <option value="Void">Void</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <Input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined, page: 1 })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <Input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined, page: 1 })}
            />
          </div>
        </div>
      </Card>

      {/* Invoice Table */}
      <Card>
        <InvoiceTable 
          invoices={invoices} 
          onDownloadPDF={handleDownloadPDF}
          loading={loading && invoices.length === 0}
        />
      </Card>

      {/* Create from Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-96 overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Create Invoice from Order</h2>
            <div className="space-y-2 mb-4">
              {availableOrders.length === 0 ? (
                <p className="text-gray-500">No completed orders available for invoicing.</p>
              ) : (
                availableOrders.map((order) => (
                  <div key={order._id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <div className="font-medium">{order.orderIdDisplay}</div>
                      <div className="text-sm text-gray-500">
                        {order.clientSnapshot?.clientName} - {formatCurrency(order.finalGrandTotal)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleCreateFromOrder(order._id)}
                      disabled={loading}
                    >
                      Create Invoice
                    </Button>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 