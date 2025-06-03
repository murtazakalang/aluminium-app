'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TrendingUp, FileText, BarChart3, Calculator, AlertCircle } from 'lucide-react';
import { accountingApi } from '@/lib/api/accountingService';

interface FinancialSummary {
  totalRevenue: number | null;
  outstandingInvoices: number | null;
  netProfit: number | null;
}

export default function AccountingDashboard() {
  const [summaryData, setSummaryData] = useState<FinancialSummary>({
    totalRevenue: null,
    outstandingInvoices: null,
    netProfit: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return 'Loading...';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  useEffect(() => {
    const fetchFinancialData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch P&L data for revenue and net profit
        // Use default filters (e.g., last 90 days or year-to-date)
        const pnlFilters = {
          startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days ago
          endDate: new Date().toISOString().split('T')[0] // today
        };
        const pnlResponse = await accountingApi.getPnLSimple(pnlFilters);
        
        // Fetch Sales Ledger summary for outstanding invoices
        const salesLedgerResponse = await accountingApi.getSalesLedger(); // Default filters

        setSummaryData({
          totalRevenue: pnlResponse.data.revenue?.totalInvoiced || 0,
          netProfit: pnlResponse.data.summary?.netProfit || 0,
          outstandingInvoices: salesLedgerResponse.data.summary?.totalBalanceDue || 0,
        });

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load financial overview data');
        // Set data to 0 or keep null to show error specific messages
        setSummaryData({
          totalRevenue: 0, // Or null if you want to show 'Error loading'
          outstandingInvoices: 0,
          netProfit: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchFinancialData();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Accounting</h1>
        <p className="text-gray-500 mt-1">Manage your financial records and reports</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">Sales Ledger</h3>
              <p className="text-gray-500 text-sm">Track all invoice and payment transactions</p>
            </div>
          </div>
          <div className="mt-4">
            <Link href="/dashboard/accounting/sales-ledger">
              <Button className="w-full">
                View Sales Ledger
              </Button>
            </Link>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">Profit & Loss</h3>
              <p className="text-gray-500 text-sm">Analyze revenue, costs, and profitability</p>
            </div>
          </div>
          <div className="mt-4">
            <Link href="/dashboard/accounting/pnl">
              <Button className="w-full">
                View P&L Report
              </Button>
            </Link>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calculator className="h-6 w-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">Invoices</h3>
              <p className="text-gray-500 text-sm">Manage invoices and payments</p>
            </div>
          </div>
          <div className="mt-4">
            <Link href="/dashboard/invoices">
              <Button className="w-full" variant="outline">
                Manage Invoices
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Overview</h3>
          {loading && (
            <div className="space-y-4">
              <div className="h-6 bg-gray-200 rounded w-3/4 animate-pulse"></div>
              <div className="h-6 bg-gray-200 rounded w-1/2 animate-pulse"></div>
              <div className="h-6 bg-gray-200 rounded w-2/3 animate-pulse"></div>
            </div>
          )}
          {error && !loading && (
            <div className="flex items-center text-red-600">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>Error: {error}</span>
            </div>
          )}
          {!loading && !error && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Revenue</span>
                <span className="font-semibold text-gray-900">{formatCurrency(summaryData.totalRevenue)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Outstanding Invoices</span>
                <span className="font-semibold text-gray-900">{formatCurrency(summaryData.outstandingInvoices)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Net Profit</span>
                <span className={`font-semibold ${ (summaryData.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(summaryData.netProfit)}</span>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Link href="/dashboard/invoices">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Create New Invoice
              </Button>
            </Link>
            <Link href="/dashboard/accounting/sales-ledger">
              <Button variant="outline" className="w-full justify-start">
                <TrendingUp className="h-4 w-4 mr-2" />
                View Payment History
              </Button>
            </Link>
            <Link href="/dashboard/accounting/pnl">
              <Button variant="outline" className="w-full justify-start">
                <BarChart3 className="h-4 w-4 mr-2" />
                Generate P&L Report
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
} 