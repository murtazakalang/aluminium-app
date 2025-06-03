'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { accountingApi, SalesLedgerEntry, SalesLedgerFilters } from '@/lib/api/accountingService';
import LedgerTable from '@/components/invoices/LedgerTable';
import { Search, Calendar, TrendingUp, TrendingDown, FileText, Download } from 'lucide-react';

export default function SalesLedgerPage() {
  const [entries, setEntries] = useState<SalesLedgerEntry[]>([]);
  const [summary, setSummary] = useState({
    totalInvoiced: 0,
    totalPaid: 0,
    outstandingBalance: 0,
    overdueAmount: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SalesLedgerFilters>({
    page: 1,
    limit: 50
  });
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 0
  });

  useEffect(() => {
    loadSalesLedger();
  }, [filters]);

  const loadSalesLedger = async () => {
    try {
      setLoading(true);
      const response = await accountingApi.getSalesLedger(filters);
      setEntries(response.data.invoices || []);
      if (response.data.summary) {
        setSummary({
          totalInvoiced: response.data.summary.totalInvoiceAmount || 0,
          totalPaid: response.data.summary.totalAmountPaid || 0,
          outstandingBalance: response.data.summary.totalBalanceDue || 0,
          overdueAmount: (response.data.summary as any).overdueAmount || 0
        });
      }
      if (response.data.pagination) {
        setPagination({
          total: response.data.pagination.totalResults || 0,
          page: response.data.pagination.currentPage || 1,
          limit: response.data.pagination.resultsPerPage || 50,
          totalPages: response.data.pagination.totalPages || 0
        });
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sales ledger');
    } finally {
      setLoading(false);
    }
  };

  const parseNumericValue = (value: any): number => {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'object' && value !== null && value.hasOwnProperty('$numberDecimal')) {
      return parseFloat(value.$numberDecimal);
    }
    if (typeof value === 'string') {
      return parseFloat(value);
    }
    return 0; // Default or throw error
  };

  const formatCurrency = (amount: any) => {
    const numericAmount = parseNumericValue(amount);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(numericAmount);
  };

  const exportToCSV = () => {
    const csvContent = [
      ['Date', 'Type', 'Invoice ID', 'Client', 'Description', 'Debit', 'Credit', 'Running Balance'],
      ...entries.map(entry => [
        new Date(entry.date).toLocaleDateString('en-IN'),
        entry.type,
        entry.invoiceIdDisplay || '',
        entry.clientName,
        entry.description,
        entry.debitAmount ? entry.debitAmount.toString() : '',
        entry.creditAmount ? entry.creditAmount.toString() : '',
        entry.runningBalance.toString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-ledger-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales Ledger</h1>
          <p className="text-gray-500 mt-1">Track all invoice and payment transactions</p>
        </div>
        <Button 
          onClick={exportToCSV}
          className="flex items-center gap-2"
          disabled={!entries || entries.length === 0}
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Invoiced</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(summary.totalInvoiced)}
              </p>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Paid</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(summary.totalPaid)}
              </p>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Outstanding Balance</p>
              <p className="text-2xl font-bold text-orange-600">
                {formatCurrency(summary.outstandingBalance)}
              </p>
            </div>
            <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Calendar className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Overdue Amount</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(summary.overdueAmount)}
              </p>
            </div>
            <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              className="w-full p-2 border border-gray-300 rounded-md"
              value={filters.type || ''}
              onChange={(e) => setFilters({ ...filters, type: e.target.value as 'Invoice' | 'Payment' | undefined, page: 1 })}
            >
              <option value="">All Types</option>
              <option value="Invoice">Invoices</option>
              <option value="Payment">Payments</option>
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
          <div className="flex items-end">
            <Button
              onClick={() => setFilters({ page: 1, limit: 50 })}
              variant="outline"
              className="w-full"
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Sales Ledger Table */}
      <Card>
        <LedgerTable entries={entries} loading={loading && (!entries || entries.length === 0)} />

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t">
            <div className="text-sm text-gray-700">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setFilters({ ...filters, page: pagination.page - 1 })}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setFilters({ ...filters, page: pagination.page + 1 })}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
} 