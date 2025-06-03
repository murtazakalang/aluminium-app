'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { quotationApi } from '@/lib/api/quotationService';
import { orderApi } from '@/lib/api/orderService';
import { Quotation, QuotationFilters } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import QuotationStatusBadge from '@/components/quotations/QuotationStatusBadge';
import QuotationFiltersComponent from '@/components/quotations/QuotationFilters';
import { Plus } from 'lucide-react';

// Helper function to safely format currency from Decimal128 or number
const formatCurrency = (value: any): string => {
  if (!value) return '₹0.00';
  
  let numValue = 0;
  
  // If it's a Decimal128 object with $numberDecimal property
  if (typeof value === 'object' && value.$numberDecimal) {
    numValue = parseFloat(value.$numberDecimal) || 0;
  } else if (typeof value === 'number') {
    numValue = value;
  } else if (typeof value === 'string') {
    numValue = parseFloat(value) || 0;
  }
  
  return `₹${numValue.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

export default function QuotationsPage() {
  const router = useRouter();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [convertingQuotationId, setConvertingQuotationId] = useState<string | null>(null);
  const [filters, setFilters] = useState<QuotationFilters>({
    page: 1,
    limit: 10,
    search: '',
    status: '',
    clientId: '',
    startDate: '',
    endDate: ''
  });
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0
  });

  // Load quotations
  const loadQuotations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await quotationApi.listQuotations(filters);
      setQuotations(response.data.quotations);
      setPagination(response.data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quotations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuotations();
  }, [filters]);

  // Handle filter changes
  const handleFiltersChange = (newFilters: QuotationFilters) => {
    setFilters(newFilters);
  };

  // Handle search
  const handleSearch = () => {
    setFilters(prev => ({ ...prev, page: 1 }));
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  // Handle delete quotation
  const handleDeleteQuotation = async (quotationId: string) => {
    if (!confirm('Are you sure you want to delete this quotation?')) return;
    
    try {
      await quotationApi.deleteQuotation(quotationId);
      loadQuotations(); // Reload the list
    } catch (err) {
      alert('Failed to delete quotation');
    }
  };

  // Handle send quotation
  const handleSendQuotation = async (quotationId: string) => {
    try {
      await quotationApi.sendQuotation(quotationId);
      loadQuotations(); // Reload to update status
    } catch (err) {
      alert('Failed to send quotation');
    }
  };

  // Handle PDF generation for a quotation
  const handleGeneratePDF = async (quotationId: string, quotationIdDisplay: string) => {
    try {
      // Use the robust PDF utilities
      const { generateAndDownloadPDF } = await import('@/lib/utils/pdfUtils');
      
      await generateAndDownloadPDF(
        () => quotationApi.generatePDF(quotationId),
        `quotation-${quotationIdDisplay}.pdf`
      );
      
    } catch (err) {
      console.error('PDF Generation Error:', err);
      
      // Enhanced error handling
      if (err instanceof Error) {
        if (err.message.includes('Invalid PDF')) {
          alert('Server returned invalid PDF data. Please contact support.');
        } else if (err.message.includes('empty')) {
          alert('Generated PDF is empty. Please try again.');
        } else if (err.message.includes('authentication') || err.message.includes('logged in')) {
          alert('Please log in again to download PDF.');
        } else {
          alert(`PDF Error: ${err.message}`);
        }
      } else {
        alert('Failed to generate PDF. Please try again.');
      }
    }
  };

  // Handle Convert to Order
  const handleConvertToOrder = async (quotationId: string) => {
    if (!confirm('Are you sure you want to convert this quotation to an order?')) return;
    
    setConvertingQuotationId(quotationId);
    setError(null);
    try {
      const response = await orderApi.createFromQuotation(quotationId);
      if (response && response.data && response.data.order && response.data.order._id) {
        alert('Quotation successfully converted to order!');
        router.push(`/dashboard/orders/${response.data.order._id}`);
      } else {
        throw new Error('Failed to get order details from conversion response.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to convert quotation to order');
      alert(err instanceof Error ? err.message : 'Failed to convert quotation to order');
    } finally {
      setConvertingQuotationId(null);
    }
  };

  // Transform quotations data for table
  const tableData = quotations.map(quotation => ({
    id: quotation._id,
    quotationId: (
      <button
        onClick={() => router.push(`/dashboard/quotations/${quotation._id}`)}
        className="text-blue-600 hover:text-blue-800 font-medium"
      >
        {quotation.quotationIdDisplay}
      </button>
    ),
    clientName: quotation.clientSnapshot.clientName,
    status: <QuotationStatusBadge status={quotation.status} size="sm" />,
    grandTotal: formatCurrency(quotation.grandTotal),
    validUntil: quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : '—',
    createdAt: new Date(quotation.createdAt).toLocaleDateString(),
    actions: (
      <div className="flex space-x-2">
        <Button
          onClick={() => router.push(`/dashboard/quotations/${quotation._id}`)}
          variant="outline"
          size="sm"
        >
          View
        </Button>
        {(quotation.status === 'Draft' || quotation.status === 'Sent') && (
          <Button
            onClick={() => router.push(`/dashboard/quotations/${quotation._id}/edit`)}
            variant="outline"
            size="sm"
          >
            Edit
          </Button>
        )}
        {quotation.status === 'Draft' && (
          <>
            <Button
              onClick={() => handleSendQuotation(quotation._id)}
              variant="default"
              size="sm"
            >
              Send
            </Button>
            <Button
              onClick={() => handleDeleteQuotation(quotation._id)}
              variant="destructive"
              size="sm"
            >
              Delete
            </Button>
          </>
        )}
        {quotation.status !== 'Draft' && (
          <Button
            onClick={() => handleGeneratePDF(quotation._id, quotation.quotationIdDisplay)}
            variant="outline"
            size="sm"
          >
            PDF
          </Button>
        )}
        {quotation.status === 'Accepted' && (
          <Button
            onClick={() => handleConvertToOrder(quotation._id)}
            variant="default"
            size="sm"
            disabled={convertingQuotationId === quotation._id}
          >
            {convertingQuotationId === quotation._id ? 'Converting...' : 'Convert to Order'}
          </Button>
        )}
      </div>
    )
  }));

  const columns = [
    { header: 'Quotation ID', accessor: 'quotationId' as const },
    { header: 'Client', accessor: 'clientName' as const },
    { header: 'Status', accessor: 'status' as const },
    { header: 'Total', accessor: 'grandTotal' as const },
    { header: 'Valid Until', accessor: 'validUntil' as const },
    { header: 'Created', accessor: 'createdAt' as const },
    { header: 'Actions', accessor: 'actions' as const },
  ];

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">Error: {error}</p>
          <Button onClick={loadQuotations} className="mt-2">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotations</h1>
          <p className="text-gray-600">Manage your quotations and track their status</p>
        </div>
        <Button
          onClick={() => router.push('/dashboard/quotations/new')}
          className="flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>New Quotation</span>
        </Button>
      </div>

      {/* Filters */}
      <QuotationFiltersComponent
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onSearch={handleSearch}
      />

      {/* Table */}
      <div className="bg-white rounded-lg border">
        <Table
          columns={columns}
          data={tableData}
          keyExtractor={(item) => item.id}
          emptyStateMessage="No quotations found"
          isLoading={loading}
        />

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-center mt-4 pb-4">
            <nav className="flex items-center space-x-2">
              <Button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                variant="outline"
                size="sm"
              >
                Previous
              </Button>
              <span className="px-4 py-2 text-sm text-gray-700">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                variant="outline"
                size="sm"
              >
                Next
              </Button>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
} 